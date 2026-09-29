/* Kyoshi · core/files.js — apps' photos and documents (binary files), as K.files; each app gets its
 * own space as A.files (core/shell.js). They live apart from the text data (core/storage.js), in their
 * own IndexedDB database "kyoshi-files" (store "files": "<app>/<id>" → { app, id, type, size, blob, at }),
 * opened the first time one is needed and read one at a time — never all into memory at start.
 * Folder sync copies them both ways as plain files, <folder>/<app>/files/<id>.<jpg|pdf> (mirror, called
 * by core/sync.js). Backups (Export JSON) hold only the apps' data, not these files.
 * An app lists the files its data uses in A.data.files() → { live: [{ id, type, size }], gone: [ids] }
 * (gone: marked deleted); gone ones are removed here and from the folder, and nothing else is ever
 * deleted on its own. In test mode (time travel) new files and removals stay in memory. */
(function (K) {
  "use strict";
  const DB_NAME = "kyoshi-files", STORE = "files";
  const NAME_RE = /^([a-z0-9]{8,40})\.(jpg|pdf)$/; // a file in the sync folder: its id and kind
  const EXT = { "image/jpeg": "jpg", "application/pdf": "pdf" };
  const BATCH = 10;           // files copied per sync pass, so other apps' saves aren't held up
  const RETRY_MS = 30000;     // how often to look again for files the folder doesn't have yet
  const REFRESH_MS = 600000;  // and for anything else amiss (a file taken out of the folder by hand)
  let opening = null;         // Promise of the database, or of null when there's none to be had
  let shadow = null;          // test mode: key -> record, or null once removed
  const keyOf = (app, id) => `${app}/${id}`;

  // ==========================================================================
  // The database
  // ==========================================================================
  // Opens it once (no version number, like kyoshi-data, so a later Kyoshi can still upgrade it);
  // null when this browser has no IndexedDB or won't open it.
  function db() {
    if (opening) return opening;
    opening = new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      let req;
      try { req = indexedDB.open(DB_NAME); } catch (err) { return resolve(null); }
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => {
        const d = req.result;
        d.onversionchange = () => { d.close(); opening = null; }; // a newer Kyoshi upgrades it: open it again next time
        resolve(d);
      };
      req.onerror = () => { console.warn("Kyoshi couldn't open its files database.", req.error); resolve(null); };
      req.onblocked = () => console.warn("Kyoshi's files database is waiting for another tab to let go of it.");
    });
    return opening;
  }
  // Whether files can be kept in this browser (attaching one is pointless otherwise).
  const ready = () => db().then(d => !!d);

  async function tx(mode, action) {
    const d = await db();
    if (!d) throw new Error("This browser can't keep photos or documents");
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode), req = action(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = t.onabort = () => reject(t.error || new Error("The file couldn't be saved"));
    });
  }

  // ==========================================================================
  // Reading & writing
  // ==========================================================================
  const inTest = () => { if (K.testMode && !shadow) shadow = new Map(); return !!shadow; };
  const startTest = () => { if (!shadow) shadow = new Map(); };

  async function put(app, id, blob) {
    const rec = { app, id, type: blob.type || "application/octet-stream", size: blob.size, blob, at: Date.now() };
    if (inTest()) shadow.set(keyOf(app, id), rec);
    else await tx("readwrite", store => store.put(rec, keyOf(app, id)));
    return id;
  }
  async function record(app, id) {
    const key = keyOf(app, id);
    if (inTest() && shadow.has(key)) return shadow.get(key);
    if (!(await db())) return null;
    return (await tx("readonly", store => store.get(key))) || null;
  }
  const get = (app, id) => record(app, id).then(r => (r ? r.blob : null));
  const has = (app, id) => record(app, id).then(r => !!r);
  async function remove(app, id) {
    if (inTest()) return void shadow.set(keyOf(app, id), null);
    if (await db()) await tx("readwrite", store => store.delete(keyOf(app, id)));
  }
  // The ids an app has here.
  async function ids(app) {
    const out = new Set();
    if (await db()) {
      const keys = await tx("readonly", store => store.getAllKeys(IDBKeyRange.bound(`${app}/`, `${app}/￿`)));
      keys.forEach(k => out.add(String(k).slice(app.length + 1)));
    }
    if (inTest()) shadow.forEach((rec, key) => {
      if (!key.startsWith(`${app}/`)) return;
      if (rec) out.add(key.slice(app.length + 1)); else out.delete(key.slice(app.length + 1));
    });
    return [...out];
  }

  // Every app's files: how many, and how big (Developer Mode).
  async function usage() {
    const d = await db();
    if (!d) return { count: 0, bytes: 0 };
    return new Promise(resolve => {
      let count = 0, bytes = 0;
      const req = d.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve({ count, bytes });
        count++;
        bytes += (c.value && c.value.size) || 0;
        c.continue();
      };
      req.onerror = () => resolve({ count, bytes });
    });
  }

  // The files an app has here that its data doesn't use any more, live or gone (Developer Mode's clean-up).
  async function unused(A) {
    if (!A.data || !A.data.files) return [];
    const f = A.data.files(), known = new Set(f.live.map(x => x.id).concat(f.gone));
    return (await ids(A.id)).filter(id => !known.has(id));
  }

  // ==========================================================================
  // The sync folder: <root>/<app>/files/, both ways
  // ==========================================================================
  // Copies up to BATCH files: this device's the folder lacks go there, the folder's this device lacks
  // come here (once the whole file is there: its size matches), and gone ones are removed from both.
  // Only runs when the app's files changed, on a new folder, every RETRY_MS while some are still
  // missing, and every REFRESH_MS anyway. alive() says whether sync is still on with this folder.
  // Never throws: a file that can't be copied is tried again later. Returns true when there's more
  // to do (another pass soon).
  async function mirror(A, root, alive) {
    if (!A.data || !A.data.files) return false;
    const st = A._files || (A._files = { root: null, key: "", missingAt: 0, at: 0 });
    const want = A.data.files(), key = JSON.stringify([want.live.map(f => [f.id, f.size]), want.gone]);
    if (!want.live.length && !want.gone.length) return false;
    const now = Date.now();
    const due = st.root !== root || st.key !== key || now - st.at >= REFRESH_MS || (st.missingAt && now - st.missingAt >= RETRY_MS);
    if (!due) return false;
    st.at = now;
    let more = false, missing = 0, got = 0;
    try {
      const sub = await (await root.getDirectoryHandle(A.id, { create: true })).getDirectoryHandle("files", { create: true });
      const there = new Map(); // id -> { name, handle }
      for await (const [name, handle] of sub.entries()) {
        const m = handle.kind === "file" && NAME_RE.exec(name);
        if (m) there.set(m[1], { name, handle });
      }
      if (!alive()) return false;
      const here = new Set(await ids(A.id));
      let budget = BATCH;
      const step = async fn => {
        if (budget <= 0) { more = true; return; }
        budget--;
        try { await fn(); } catch (err) { missing++; }
      };
      for (const id of want.gone) {
        if (!alive()) return false;
        if (here.has(id)) await step(() => remove(A.id, id));
        if (there.has(id)) await step(() => sub.removeEntry(there.get(id).name));
      }
      for (const f of want.live) {
        if (!alive()) return false;
        const ext = EXT[f.type];
        if (!ext) continue;
        if (here.has(f.id) && !there.has(f.id)) {
          await step(async () => {
            const blob = await get(A.id, f.id);
            if (!blob || !alive()) return;
            const out = await (await sub.getFileHandle(`${f.id}.${ext}`, { create: true })).createWritable();
            await out.write(blob);
            await out.close();
          });
        } else if (!here.has(f.id)) {
          if (!there.has(f.id)) { missing++; continue; }
          await step(async () => {
            const file = await there.get(f.id).handle.getFile();
            if (file.size !== f.size) { missing++; return; } // still arriving
            if (!alive()) return;
            await put(A.id, f.id, new Blob([file], { type: f.type }));
            got++;
          });
        }
      }
    } catch (err) {
      console.warn(`Couldn't copy ${A.meta.name}'s photos and documents with the sync folder; trying again soon.`);
      missing++;
    }
    if (!alive()) return false;
    Object.assign(st, { root, key: more ? "" : key, missingAt: missing ? Date.now() : 0 });
    if (got && A.data.afterFiles) {
      try { A.data.afterFiles(); } catch (err) { console.error(`${A.meta.name} couldn't show the files that arrived.`, err); }
    }
    return more;
  }

  // One app's space (A.files, made by K.register): put(blob, id?) → id, get(id) → Blob | null,
  // has(id), remove(id), ids() → [id]. All return promises.
  const scoped = app => ({
    put: (blob, id = K.util.newId()) => put(app, id, blob),
    get: id => get(app, id),
    has: id => has(app, id),
    remove: id => remove(app, id),
    ids: () => ids(app)
  });

  K.files = { scoped, ready, startTest, usage, unused, mirror, EXT };
})(Kyoshi);
