/* Kyoshi · core/sync-folder.js — folder autosave & sync, as K.folder: a transport of the sync engine (core/sync.js:
 * the version counters, combining saves). No UI (that's core/backup.js).
 * Changes are saved as JSON into a folder the user picks once (e.g. one Syncthing shares
 * between their phone and computer), each app in its own subfolder (<folder>/<app id>/),
 * and other devices' saves are loaded from it, checking every few seconds (each one brought in is stored at once,
 * in the same write as the app's version counters, so the two never part). Each device
 * writes only its own file per app (meta.file), so a sync tool never sees two devices edit the same
 * file. An app with photos or documents (A.data.files) also has them copied both ways as plain files in
 * <folder>/<app id>/files/ (core/files.js mirror). A save made by a newer Kyoshi (a later version of the app, or of its
 * file format) is never brought in: folder sync stops ("error") until the page is reloaded, as the cloud does, so this
 * copy can't strip what it doesn't know and save that for every device.
 * Per app (A._sync.folder): seen (file name -> "lastModified:size" already read), note (last thing it did), queued,
 * timer; the engine's meta.dirty says the app has changes the folder lacks. */
(function (K) {
  "use strict";
  const { isObj, clockTime } = K.util;

  const later = (a, b) => parseFloat(a) > parseFloat(b); // "10.380" after "10.374" (false when either isn't a version)
  const SYNC_CHECK_MS = 5000;    // how often the folder is checked for other devices' saves
  const AUTOSAVE_DELAY_MS = 400; // quick edits in a row are saved to the folder once
  const RETRY_NOTE = "Couldn't reach the folder, retrying";

  const supported = typeof window.showDirectoryPicker === "function";
  let dir = null;       // the chosen folder
  let state = "off";    // "off" | "on" | "paused" (needs permission again) | "error"
  let message = "";     // banner text while in "error"
  let queue = Promise.resolve();
  const apps = () => K.sync.apps();
  const ui = () => K.backup.render();
  // An app's folder sync, made on first use.
  const fo = A => A._sync.folder || (A._sync.folder = { seen: new Map(), note: "", queued: false, timer: 0 });

  // The folder's handle isn't text, so it has its own IndexedDB database ("kyoshi"), apart from the data (core/storage.js).
  function folderStore(mode, action) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("kyoshi", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("handles");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction("handles", mode), req = action(tx.objectStore("handles"));
          tx.oncomplete = () => { db.close(); resolve(req.result); };
          tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
        } catch (err) { db.close(); reject(err); }
      };
    });
  }
  const loadFolder = () => folderStore("readonly", store => store.get("syncFolder"));
  const storeFolder = d => folderStore("readwrite", store => (d ? store.put(d, "syncFolder") : store.delete("syncFolder")));

  // --- Reading & writing the folder ---
  // Reads the app's saves that are new or changed since last time, most up to
  // date first, and brings them in (core/sync.js).
  async function readFolder(A, root) {
    const ch = fo(A), sub = await root.getDirectoryHandle(A.id, { create: true }), changedFiles = [];
    for await (const [name, handle] of sub.entries()) {
      if (handle.kind !== "file" || !/\.json$/i.test(name)) continue;
      try {
        const file = await handle.getFile();
        const sig = `${file.lastModified}:${file.size}`;
        if (ch.seen.get(name) !== sig) changedFiles.push({ name, file, sig });
      } catch (err) { /* mid-transfer; the next check gets it */ }
    }
    changedFiles.sort((a, b) => b.file.lastModified - a.file.lastModified);
    let what = "";
    for (const { name, file, sig } of changedFiles) {
      let raw = null;
      try { raw = JSON.parse(await file.text()); } catch (err) { /* not a save, or changed while being read: retried once it changes */ }
      if (root !== dir || K.testMode) return;
      const save = isObj(raw) && A.data.looksLike(raw);
      if (save && (later(raw.appVersion, A.VERSION) || later(raw.schemaVersion, A.data.schemaVersion))) { // not marked seen: read again once reloaded
        return setState("error", `“${name}” in the sync folder was saved by a newer Kyoshi (${A.meta.name} ${raw.appVersion}; this page has ${A.VERSION}): reload this page to get it. Until then nothing is saved to the folder from here.`);
      }
      ch.seen.set(name, sig);
      const result = save ? K.sync.incorporate(A, raw) : null;
      if (!result) continue;
      // The app stores and redraws what came in straight away, in the same tick as its version counters (one write,
      // core/storage.js): the folder let go or the tab closed before the next file is read can't leave the counters
      // claiming changes the stored data doesn't have (the file would never be read again).
      K.sync.settle(A, result.data);
      if (!what) what = `${result.what} “${name}”`;
    }
    if (!what) return;
    ch.note = `${what} at ${clockTime()}`;
    ui();
  }

  // Saves the app's file in its subfolder, if it has changes the folder lacks.
  async function writeAutosave(A) {
    const root = dir, ch = fo(A), m = A._sync.meta;
    if (state !== "on" || !m.dirty || K.testMode) return;
    const version = K.sync.version(A);
    const text = JSON.stringify(K.sync.saveOf(A), null, 2);
    const sub = await root.getDirectoryHandle(A.id, { create: true });
    const handle = await sub.getFileHandle(m.file, { create: true });
    const out = await handle.createWritable();
    await out.write(text);
    await out.close();
    const file = await handle.getFile();
    if (root !== dir) return;
    ch.seen.set(m.file, `${file.lastModified}:${file.size}`); // our own save isn't news
    if (K.sync.saved(A, version, { dirty: false })) K.backup.setUnsaved(A, false); // nothing changed while writing, here or in another tab
    ch.note = `Saved at ${clockTime()}`;
    ui();
  }

  // Other devices' saves come in first, then the app's photos and documents are copied both ways
  // (core/files.js), so a save in the folder never names a file the folder doesn't have yet.
  async function syncPass(A) {
    if (state !== "on" || K.testMode) return;
    await readFolder(A, dir);
    const root = dir;
    if (root && A.data.files && await K.files.mirror(A, root, () => root === dir && state === "on" && !K.testMode)) request(A);
    await writeAutosave(A);
    if (fo(A).note === RETRY_NOTE) { fo(A).note = ""; ui(); }
  }

  // Folder work runs one step at a time, so saving and checking never overlap.
  function task(A, fn) {
    queue = queue.then(fn).catch(err => onError(A, err));
  }

  // Checks the folder for an app (or every app) soon.
  function request(A = null) {
    if (!A) return apps().forEach(x => request(x));
    if (!A._sync || state !== "on" || K.testMode) return;
    const ch = fo(A);
    if (ch.queued) return;
    ch.queued = true;
    task(A, () => { ch.queued = false; return syncPass(A); });
  }

  function scheduleAutosave(A) {
    const ch = fo(A);
    clearTimeout(ch.timer);
    ch.timer = state === "on" && !K.testMode ? setTimeout(() => flush(A), AUTOSAVE_DELAY_MS) : 0;
  }

  // Saves a pending change now (e.g. when the page is being hidden or closed).
  function flush(A = null) {
    if (!A) return apps().forEach(x => flush(x));
    const ch = fo(A);
    if (!ch.timer) return;
    clearTimeout(ch.timer);
    ch.timer = 0;
    task(A, () => writeAutosave(A));
  }

  const stopTimers = () => apps().forEach(A => { clearTimeout(fo(A).timer); fo(A).timer = 0; });

  function onError(A, err) {
    const ch = fo(A);
    if (A._sync.meta.dirty) K.backup.setUnsaved(A, true);
    if (ch.note !== RETRY_NOTE) console.error(`Folder sync failed (${A.meta.name}).`, err); // once per outage
    if (state !== "on") return;
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") setState("paused");
    else if (name === "NotFoundError") setState("error", `Couldn't find the sync folder “${dir.name}”. It may have been moved or deleted.`);
    else { ch.note = RETRY_NOTE; ui(); }
  }

  function setState(next, msg = "") {
    state = next;
    message = msg;
    if (next !== "on") stopTimers(); // unsaved changes go once it's back on
    ui();
  }

  // --- Choosing, reconnecting and stopping ---
  async function choose() {
    let picked;
    try {
      picked = await window.showDirectoryPicker({ id: "kyoshi-sync", mode: "readwrite" });
    } catch (err) {
      if (err.name === "AbortError") return; // picker cancelled
      console.error("Couldn't open that folder.", err);
      return alert("Couldn't use that folder. Try choosing another one.");
    }
    dir = picked;
    apps().forEach(A => {
      Object.assign(fo(A), { seen: new Map(), note: "" });
      A._sync.meta.dirty = true; // so this device's data is in the folder from the start
      K.sync.storeMeta(A);
    });
    storeFolder(dir).catch(err => console.warn("Couldn't remember the sync folder for next time.", err));
    setState("on");
    request();
  }

  // Browsers ask again for folder access after a restart, and only on a click.
  async function reconnect() {
    let permission = "denied";
    try { permission = await dir.requestPermission({ mode: "readwrite" }); } catch (err) { console.warn("Folder permission request failed.", err); }
    if (permission !== "granted") return setState("error", `Access to “${dir.name}” wasn't allowed. Choose the folder again to resume autosave & sync.`);
    setState("on");
    request();
  }

  function stop() {
    if (!confirm(`Stop autosave & sync with “${dir.name}”? Your data stays on this device, and the files already in that folder are left as they are.`)) return;
    dir = null;
    apps().forEach(A => Object.assign(fo(A), { seen: new Map(), note: "" }));
    setState("off");
    storeFolder(null).catch(err => console.warn("Couldn't forget the sync folder.", err));
  }

  // Picks up the folder chosen last time: straight away if the browser still allows
  // access, otherwise once the user reconnects. Then keeps checking while on screen
  // (the engine also asks on focus, and for a pending autosave when the page is hidden or closed).
  async function init() {
    ui();
    setInterval(() => { if (!document.hidden) request(); }, SYNC_CHECK_MS);
    if (!supported) return;
    try { dir = (await loadFolder()) || null; } catch (err) { console.warn("Couldn't load the sync folder setting.", err); }
    if (!dir) return;
    let permission = "prompt";
    try { permission = await dir.queryPermission({ mode: "readwrite" }); } catch (err) { /* ask again */ }
    setState(permission === "granted" ? "on" : "paused");
    request();
  }

  K.folder = {
    id: "folder", init, changed: scheduleAutosave, request, flush, stopTimers,
    state: () => (supported ? state : "unsupported"), message: () => message, dirty: A => !!(A._sync && A._sync.meta.dirty),
    supported, folderName: () => (dir ? dir.name : ""), note: A => (A._sync && A._sync.folder ? A._sync.folder.note : ""),
    choose, reconnect, stop
  };
  K.sync.use(K.folder);
})(Kyoshi);
