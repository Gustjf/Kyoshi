/* Kyoshi · core/storage.js — where Kyoshi keeps data: each app's A.store and core's own K.store.
 * The data lives in the browser's large built-in store (IndexedDB database "kyoshi-data", object
 * store "kv": "kyoshi.<app>.<key>" → text), with room for hundreds of MB and more. K.storage.open()
 * (at start) reads it all into memory, so reads are instant; each write changes memory at once and
 * is saved to IndexedDB right after (one transaction per burst of writes), then other open tabs are
 * told (BroadcastChannel) and reload what changed (onChange).
 * If IndexedDB can't be opened, the same data goes in localStorage (about 5 MB) — unless it already
 * lives in IndexedDB: then changes stay in memory and Kyoshi says so, rather than show an old copy.
 * If a newer Kyoshi in another tab upgrades the database, this tab lets go of it and says so too.
 * K.storage.get/set/remove/json are localStorage itself: only for tiny preferences read before the
 * page draws (theme, last app; also Bugs & requests' last pick) and for reading what the standalone apps left behind.
 * In test mode (time travel) apps' writes stay in memory; core's (bug reports) are still kept. */
(function (K) {
  "use strict";
  const DB_NAME = "kyoshi-data", STORE = "kv";
  const PREFS = ["kyoshi.theme", "kyoshi.lastApp", "kyoshi.storage", "kyoshi.bugKind"]; // these stay in localStorage
  const MOVED = "kyoshi.storage.moved"; // in IndexedDB: when Kyoshi's localStorage data was moved over
  const LOCAL_LIMIT = 5 * 1024 * 1024; // localStorage's room, for everything at this address
  let backend = "opening";  // "opening" (until open() is done) | "indexeddb" | "localStorage" | "memory"
  let db = null;
  const cache = new Map();  // every key -> its text, as saved
  let shadow = null;        // apps' keys -> text (null once removed), while in test mode
  let pending = new Map();  // writes not yet sent to IndexedDB: key -> text, or null to remove
  let failed = false;       // a save failed: said once
  const listeners = [];
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("kyoshi-store") : null;

  // ==========================================================================
  // localStorage: preferences, and what the standalone apps left behind
  // ==========================================================================
  let warned = false;
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Couldn't save to local storage.", e);
      if (!warned) alert("This browser isn't letting Kyoshi save your data, so it will be lost when the page closes. Use Export JSON in Developer Mode (Ctrl+9, or the DEV badge) to keep a copy.");
      warned = true;
    }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* nothing to clean up */ }
  }
  const parse = text => { try { return JSON.parse(text); } catch (e) { return null; } };
  const json = key => parse(get(key));
  // Every localStorage key and value (nothing if storage is blocked).
  function localEntries() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.push([k, localStorage.getItem(k)]); }
    } catch (e) { /* blocked */ }
    return out;
  }
  const isData = k => k.startsWith("kyoshi.") && !PREFS.includes(k); // Kyoshi's data, not its preferences

  // ==========================================================================
  // IndexedDB
  // ==========================================================================
  const done = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME); // no version number: an older Kyoshi can still open it after a newer one upgrades it
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        // A newer Kyoshi in another tab needs to upgrade the database: let go, stop saving, and say so.
        req.result.onversionchange = () => {
          req.result.close();
          db = null;
          backend = "memory";
          K.backup.checkStorage();
        };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  // Every key and its text, in one read.
  function readAll() {
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    return Promise.all([done(store.getAllKeys()), done(store.getAll())]).then(([keys, values]) => keys.map((k, i) => [k, values[i]]));
  }
  // Saves and removals (text null) in one transaction; resolves once they're stored.
  function writeAll(entries) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
      entries.forEach(([k, v]) => (v === null ? store.delete(k) : store.put(v, k)));
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("The save was cancelled"));
      if (tx.commit) tx.commit(); // on disk sooner
    });
  }

  // First open with IndexedDB: brings over what Kyoshi kept in localStorage, then frees that space.
  async function moveFromLocalStorage(all) {
    const have = new Set(all.map(([k]) => k)), local = localEntries().filter(([k]) => isData(k));
    const entries = local.filter(([k]) => !have.has(k)).concat([[MOVED, new Date().toISOString()]]);
    await writeAll(entries);
    local.forEach(([k]) => remove(k));
    return readAll(); // again: another tab may have moved it all first
  }

  // Loads everything into memory (K.start waits for it). Other tabs' changes come in from then on.
  async function open() {
    try {
      if (!window.indexedDB) throw new Error("This browser has no IndexedDB");
      db = await openDB();
      let all = await readAll();
      if (!all.some(([k]) => k === MOVED)) all = await moveFromLocalStorage(all);
      all.forEach(([k, v]) => cache.set(k, v));
      backend = "indexeddb";
      set("kyoshi.storage", "indexeddb"); // from now on a failure never falls back to an old copy
      if (channel) channel.onmessage = e => refresh(e.data && e.data.keys);
    } catch (err) {
      console.warn("Kyoshi couldn't open its database.", err);
      db = null;
      if (get("kyoshi.storage") === "indexeddb") { backend = "memory"; return; } // its data is there, out of reach
      backend = "localStorage";
      localEntries().forEach(([k, v]) => { if (isData(k)) cache.set(k, v); });
      window.addEventListener("storage", onLocalStorage);
    }
  }

  // A key saved or removed: in memory now, stored right after.
  function write(key, value) {
    if (value === null) cache.delete(key); else cache.set(key, value);
    if (backend === "indexeddb") {
      if (!pending.size) queueMicrotask(flush);
      pending.set(key, value);
    } else if (backend === "localStorage") {
      if (value === null) remove(key); else set(key, value);
    }
  }

  // Sends this burst of writes to IndexedDB in one transaction, then tells other tabs.
  function flush() {
    const entries = [...pending];
    pending = new Map();
    writeAll(entries).then(() => {
      if (channel) channel.postMessage({ keys: entries.map(([k]) => k) });
    }).catch(err => {
      console.error("Couldn't save to the browser's storage.", err);
      if (!failed) alert("Kyoshi couldn't save your latest change in this browser. Export JSON in Developer Mode (Ctrl+9, or the DEV badge) to keep a copy, then reload.");
      failed = true;
    });
  }

  // Another tab saved these keys: read them again, then tell Kyoshi (a change waiting to be saved here wins).
  async function refresh(keys) {
    if (shadow || !db || !Array.isArray(keys) || !keys.length) return;
    let values;
    try {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      values = await Promise.all(keys.map(k => done(store.get(k))));
    } catch (err) { return console.warn("Couldn't read another tab's changes.", err); }
    keys.forEach((k, i) => {
      if (pending.has(k)) return;
      if (values[i] === undefined) cache.delete(k); else cache.set(k, values[i]);
    });
    listeners.forEach(fn => fn(keys));
  }

  // localStorage fallback: another tab saved (keys null: everything was cleared).
  function onLocalStorage(e) {
    if (shadow || (e.key !== null && !isData(e.key))) return;
    if (e.key === null) {
      cache.clear();
      localEntries().forEach(([k, v]) => { if (isData(k)) cache.set(k, v); });
    } else if (e.newValue === null) cache.delete(e.key);
    else cache.set(e.key, e.newValue);
    listeners.forEach(fn => fn(e.key === null ? null : [e.key]));
  }

  // ==========================================================================
  // The stores apps and core use
  // ==========================================================================
  // One space in the store: the same calls as localStorage, with keys under prefix
  // ("kyoshi.<id>."), and keys() listing them. A testable one keeps its writes in memory in test mode.
  function scoped(prefix, testable = true) {
    const key = k => prefix + k;
    const sget = k => {
      const full = key(k);
      if (testable && shadow && shadow.has(full)) return shadow.get(full);
      return cache.has(full) ? cache.get(full) : null;
    };
    return {
      prefix, key,
      get: sget,
      set: (k, v) => (testable && shadow ? void shadow.set(key(k), String(v)) : write(key(k), String(v))),
      remove: k => (testable && shadow ? void shadow.set(key(k), null) : write(key(k), null)),
      json: k => parse(sget(k)),
      keys: () => [...cache.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)) // as saved
    };
  }

  // Test mode: from now on, apps' writes stay in memory.
  const startTest = () => { if (!shadow) shadow = new Map(); };

  // Calls fn(keys) after other tabs' saves reach this tab (keys null: everything may have changed).
  const onChange = fn => listeners.push(fn);

  // How much Kyoshi keeps, how much this site may use, and whether the browser has promised to
  // keep it through automatic clean-ups: { backend, bytes, used, quota, persisted }.
  async function usage() {
    let bytes = 0;
    cache.forEach((v, k) => { bytes += k.length + v.length; });
    const s = navigator.storage;
    const est = s && s.estimate ? await s.estimate().catch(() => null) : null;
    const persisted = s && s.persisted ? await s.persisted().catch(() => false) : false;
    let used = est ? est.usage : 0, quota = est ? est.quota : 0;
    if (backend === "localStorage") {
      used = localEntries().reduce((n, [k, v]) => n + k.length + v.length, 0);
      quota = LOCAL_LIMIT;
    }
    return { backend, bytes, used, quota, persisted };
  }

  // Asks the browser to keep Kyoshi's data through automatic clean-ups (once, on the first click or key).
  function protect() {
    const s = navigator.storage;
    if (s && s.persisted && s.persist) s.persisted().then(p => p || s.persist()).catch(() => {});
  }
  function onFirstInput() {
    ["pointerdown", "keydown"].forEach(t => document.removeEventListener(t, onFirstInput, true));
    protect();
  }
  ["pointerdown", "keydown"].forEach(t => document.addEventListener(t, onFirstInput, true));

  K.storage = { get, set, remove, json, open, scoped, startTest, onChange, usage, backend: () => backend };
  K.store = scoped("kyoshi.", false); // core's own data: device id, bug reports
})(Kyoshi);
