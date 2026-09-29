/* Kyoshi · core/sync.js — folder autosave & sync engine, as K.sync. No UI (that's core/backup.js).
 * Changes are saved as JSON into a folder the user picks once (e.g. one Syncthing shares
 * between their phone and computer), each app in its own subfolder (<folder>/<app id>/),
 * and other devices' saves are loaded from it, checking every few seconds. Each device
 * writes only its own file per app, so a sync tool never sees two devices edit the same
 * file. Saves carry version counters (how many changes each device has made) that tell
 * whether another device's save is newer (load it), older (ignore it), or was made while
 * this device also had unsynced changes (combine the two, via the app's A.data.combine).
 * An app with photos or documents (A.data.files) also has them copied both ways as plain files in
 * <folder>/<app id>/files/ (core/files.js mirror).
 * Per app (A._sync): meta { device, file, clock, changedAt, dirty } kept in A.store "sync",
 * seen (file name -> "lastModified:size" already read), note (last thing it did), queued, timer. */
(function (K) {
  "use strict";
  const { isObj, isPos, clockTime } = K.util;

  const SYNC_CHECK_MS = 5000;    // how often the folder is checked for other devices' saves
  const AUTOSAVE_DELAY_MS = 400; // quick edits in a row are saved to the folder once
  const RETRY_NOTE = "Couldn't reach the folder, retrying";

  const supported = typeof window.showDirectoryPicker === "function";
  let dir = null;       // the chosen folder
  let state = "off";    // "off" | "on" | "paused" (needs permission again) | "error"
  let message = "";     // banner text while in "error"
  let queue = Promise.resolve();
  const apps = () => K.order.map(id => K.apps[id]).filter(A => A.started && A._sync);
  const ui = () => K.backup.render();

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

  // --- Version counters ---
  // A save's counters, { deviceId: changes made there }, minus anything invalid.
  function cleanClock(c) {
    if (!isObj(c)) return null;
    const out = {};
    Object.keys(c).forEach(k => { if (isPos(c[k])) out[k] = c[k]; });
    return out;
  }
  // Whether version a is the "same" as b, "ahead" (has all of b's changes and
  // more), "behind", or "diverged" (each has changes the other doesn't).
  function compareClocks(a, b) {
    let ahead = false, behind = false;
    Object.keys({ ...a, ...b }).forEach(k => {
      if ((a[k] || 0) > (b[k] || 0)) ahead = true;
      if ((a[k] || 0) < (b[k] || 0)) behind = true;
    });
    return ahead && behind ? "diverged" : ahead ? "ahead" : behind ? "behind" : "same";
  }
  const maxClocks = (a, b) => Object.keys(b).reduce((c, k) => ({ ...c, [k]: Math.max(c[k] || 0, b[k]) }), { ...a });

  // --- Each app's sync identity ---
  // This browser's id, shared by every app's save files.
  function deviceId() {
    let id = K.store.get("device");
    if (!/^[a-z0-9]{6}$/.test(id || "")) K.store.set("device", id = Math.random().toString(36).slice(2, 8).padEnd(6, "0"));
    return id;
  }

  // Reads (or makes) an app's sync identity; call after its data is loaded. A new one counts
  // data already here as a change, so a sync folder's data is combined with it rather than replacing it.
  function loadMeta(A) {
    const ch = A._sync || (A._sync = { meta: {}, seen: new Map(), note: "", queued: false, timer: 0 });
    const s = A.store.json("sync"), clock = s && cleanClock(s.clock);
    if (clock && typeof s.device === "string" && typeof s.file === "string") {
      ch.meta = { device: s.device, file: s.file, clock, changedAt: String(s.changedAt || ""), dirty: !!s.dirty };
    } else {
      const device = deviceId(), has = A.data.hasData();
      const kind = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) ? "phone" : "desktop";
      ch.meta = { device, file: `${A.id}-autosave-${kind}-${device}.json`, clock: has ? { [device]: 1 } : {}, changedAt: "", dirty: has };
    }
  }
  const storeMeta = A => A.store.set("sync", JSON.stringify(A._sync.meta));

  // Each change made here counts up this device's version, which is how other
  // devices tell its saves apart from ones they've already seen.
  function markLocalChange(A) {
    const m = A._sync.meta;
    m.clock[m.device] = (m.clock[m.device] || 0) + 1;
    m.changedAt = new Date().toISOString();
    m.dirty = true; // not in the sync folder yet
    storeMeta(A);
  }

  // An app kept a change (A.changed): counts it, highlights Export JSON while it's in no
  // backup (unless sync is on, whose autosave stands in for that), and autosaves it soon.
  function changed(A, unsaved = true) {
    if (K.testMode || !A._sync) return;
    markLocalChange(A);
    K.backup.setUnsaved(A, unsaved && state !== "on");
    scheduleAutosave(A);
  }

  // --- Reading & writing the folder ---
  // Brings in a save found in the folder; returns what happened, or "" if nothing.
  function incorporate(A, raw) {
    const ch = A._sync, clock = raw.sync && cleanClock(raw.sync.clock);
    const rel = clock ? compareClocks(ch.meta.clock, clock) : "plain";
    // A device with no data yet (a new phone, say) takes a save as it is.
    // Plain backups (Export JSON files) are only ever used that way.
    const replace = rel === "behind" || (!A.data.hasData() && (rel === "diverged" || rel === "plain"));
    if (!replace && rel !== "diverged") return "";
    const result = A.data.combine(raw, {
      replace, plain: !clock,
      mine: { savedAt: ch.meta.changedAt, device: ch.meta.device },
      theirs: { savedAt: String(raw.savedAt || ""), device: String((raw.sync && raw.sync.device) || "") }
    });
    if (!result) return "";
    if (clock) ch.meta.clock = maxClocks(ch.meta.clock, clock);
    if (!clock || !result.same) {
      markLocalChange(A); // a version the folder doesn't have yet, so it gets saved there
    } else {
      ch.meta.changedAt = String(raw.savedAt || ch.meta.changedAt);
      storeMeta(A);
    }
    if (!result.apply()) return ""; // nothing new here
    return replace ? "Loaded" : "Combined changes with";
  }

  // Reads the app's saves that are new or changed since last time, most up to
  // date first, and brings them in.
  async function readFolder(A, root) {
    const ch = A._sync, sub = await root.getDirectoryHandle(A.id, { create: true }), changedFiles = [];
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
      ch.seen.set(name, sig);
      const result = isObj(raw) && A.data.looksLike(raw) ? incorporate(A, raw) : "";
      if (result && !what) what = `${result} “${name}”`;
    }
    if (!what) return;
    A.data.afterSync(); // the app stores and redraws what came in
    ch.note = `${what} at ${clockTime()}`;
    ui();
    K.refreshSwitcher();
  }

  // Saves the app's file in its subfolder, if it has changes the folder lacks.
  async function writeAutosave(A) {
    const root = dir, ch = A._sync, m = ch.meta;
    if (state !== "on" || !m.dirty || K.testMode) return;
    const version = m.clock[m.device];
    const text = JSON.stringify({ ...A.data.build(), savedAt: m.changedAt, sync: { device: m.device, clock: m.clock } }, null, 2);
    const sub = await root.getDirectoryHandle(A.id, { create: true });
    const handle = await sub.getFileHandle(m.file, { create: true });
    const out = await handle.createWritable();
    await out.write(text);
    await out.close();
    const file = await handle.getFile();
    if (root !== dir) return;
    ch.seen.set(m.file, `${file.lastModified}:${file.size}`); // our own save isn't news
    if (m.clock[m.device] === version) { // nothing changed while writing
      m.dirty = false;
      storeMeta(A);
      K.backup.setUnsaved(A, false);
    }
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
    if (A._sync.note === RETRY_NOTE) { A._sync.note = ""; ui(); }
  }

  // Folder work runs one step at a time, so saving and checking never overlap.
  function task(A, fn) {
    queue = queue.then(fn).catch(err => onError(A, err));
  }

  // Checks the folder for an app (or every app) soon.
  function request(A = null) {
    if (!A) return apps().forEach(x => request(x));
    const ch = A._sync;
    if (!ch || state !== "on" || ch.queued || K.testMode) return;
    ch.queued = true;
    task(A, () => { ch.queued = false; return syncPass(A); });
  }

  function scheduleAutosave(A) {
    const ch = A._sync;
    clearTimeout(ch.timer);
    ch.timer = state === "on" && !K.testMode ? setTimeout(() => flush(A), AUTOSAVE_DELAY_MS) : 0;
  }

  // Saves a pending change now (e.g. when the page is being hidden or closed).
  function flush(A = null) {
    if (!A) return apps().forEach(x => flush(x));
    const ch = A._sync;
    if (!ch.timer) return;
    clearTimeout(ch.timer);
    ch.timer = 0;
    task(A, () => writeAutosave(A));
  }

  const stopTimers = () => apps().forEach(A => { clearTimeout(A._sync.timer); A._sync.timer = 0; });

  function onError(A, err) {
    const ch = A._sync;
    if (ch.meta.dirty) K.backup.setUnsaved(A, true);
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
      Object.assign(A._sync, { seen: new Map(), note: "" });
      A._sync.meta.dirty = true; // so this device's data is in the folder from the start
      storeMeta(A);
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
    apps().forEach(A => Object.assign(A._sync, { seen: new Map(), note: "" }));
    setState("off");
    storeFolder(null).catch(err => console.warn("Couldn't forget the sync folder.", err));
  }

  // Picks up the folder chosen last time: straight away if the browser still allows
  // access, otherwise once the user reconnects. Then keeps checking while on screen;
  // a pending autosave is written straight away when the page is hidden or closed.
  async function init() {
    ui();
    setInterval(() => { if (!document.hidden) request(); }, SYNC_CHECK_MS);
    window.addEventListener("focus", () => request());
    window.addEventListener("pagehide", () => flush());
    document.addEventListener("visibilitychange", () => (document.hidden ? flush() : request()));
    if (!supported) return;
    try { dir = (await loadFolder()) || null; } catch (err) { console.warn("Couldn't load the sync folder setting.", err); }
    if (!dir) return;
    let permission = "prompt";
    try { permission = await dir.queryPermission({ mode: "readwrite" }); } catch (err) { /* ask again */ }
    setState(permission === "granted" ? "on" : "paused");
    request();
  }

  K.sync = {
    supported, init, loadMeta, changed, request, flush, choose, reconnect, stop, stopTimers,
    state: () => state, message: () => message, folderName: () => (dir ? dir.name : ""),
    note: A => (A._sync ? A._sync.note : ""), dirty: A => !!(A._sync && A._sync.meta.dirty)
  };
})(Kyoshi);
