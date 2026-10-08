/* Kyoshi · core/record.js — core's own record, as K.record: the one hidden app, "Kyoshi" (id kyoshi; core/shell.js: no
 * page, never shown nor in the switcher, its writes kept in test mode), whose save holds the Bugs & requests log
 * (core/bugs.js: the pop-up, the list, Developer Mode's exports) and core's preferences that are the same on every device
 * (prefs: the theme, core/shell.js). Being an app's data, both go wherever that goes (core/sync.js): its store
 * ("kyoshi.kyoshi.bugReports", "kyoshi.kyoshi.prefs"), the cloud (data/kyoshi.json), the sync folder (kyoshi/) and
 * Export all (apps.kyoshi); the log combined report by report, the later change winning, the preferences whole, the later
 * pick winning. Another core record could join them later, under another key of the same save.
 * A report: { id, timestamp, app, description, markdown (its text, core/bugs.js: Markdown before Kyoshi 3.440, plain
 * since), kind ("bug" | "request"), u (when it last changed), edited ("" or when), deleted (a marker) } — Kyoshi 3.750
 * also kept done (a Done ✓ per report), no longer read. Clear turns each report into a marker (no words), and so does
 * Delete, one at a time, so a device that still had it can't bring it back; markers go after MARKER_DAYS. Before Kyoshi
 * 5.070 the log was this device's only (K.store "bugReports"): carried over once.
 * prefs (since Kyoshi 5.270; a save from before has none): { theme ("" until one is picked, "light" | "dark"), u (when one
 * was last picked, anywhere; 0 never) }. A device where none was ever picked keeps its own theme (core/shell.js: the
 * hour's guess) until a pick comes in.
 * The save: { schemaVersion: 1, appVersion (Kyoshi's), bugReports, prefs }. */
(function (K) {
  "use strict";
  const { isObj, isPos, newer, mergeById } = K.util;
  const SCHEMA = 1;
  const REPORTS_MAX = 200; // reports kept (markers aside): beyond, the oldest become markers
  const MARKER_DAYS = 60;  // how long a cleared report's marker is kept
  const THEMES = ["light", "dark"];
  let R = null;            // the hidden Kyoshi app (registered at start: core/shell.js loads after this file)
  let reports = [];        // the log, in the order the reports were logged, markers too
  let prefs = { theme: "", u: 0 }; // core's preferences, the same on every device (cleanPrefs)

  const live = () => reports.filter(r => !r.deleted);
  const marker = (r, u) => ({ ...r, description: "", markdown: "", edited: "", deleted: true, u });
  // In the order they were logged: by id, the moment each was (later than every one before it on its device; an id that
  // isn't a number, from no Kyoshi so far, after those that are).
  const inOrder = list => list.slice().sort((a, b) => (typeof a.id !== typeof b.id ? (typeof a.id === "number" ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shown = () => K.bugs.redraw(); // the list, the footer link and Developer Mode's count follow every change

  // Reports as kept, from storage, a backup or another device, in the order they were logged: in the current shape
  // (reports from before Kyoshi 3.750 are bugs; one from before 5.070, with no u, last changed when it was logged), markers
  // without words and gone after MARKER_DAYS, each id once.
  function clean(list) {
    const ids = new Set(), since = Date.now() - MARKER_DAYS * 864e5;
    return inOrder((Array.isArray(list) ? list : []).filter(r => isObj(r) && (r.deleted === true || typeof r.markdown === "string")).map(r => {
      const gone = r.deleted === true;
      return {
        id: isPos(r.id) || (typeof r.id === "string" && r.id) ? r.id : 0, timestamp: typeof r.timestamp === "string" ? r.timestamp : "",
        app: typeof r.app === "string" ? r.app : "", description: !gone && typeof r.description === "string" ? r.description : "",
        markdown: gone ? "" : r.markdown, kind: r.kind === "request" ? "request" : "bug",
        u: isPos(r.u) ? r.u : Date.parse(r.timestamp) || 0, edited: !gone && typeof r.edited === "string" ? r.edited : "", deleted: gone
      };
    }).filter(r => r.id && (!r.deleted || r.u > since) && !ids.has(r.id) && ids.add(r.id)));
  }
  // Core's preferences as kept, from storage, a backup or another device: the theme picked ("" when none, or not one
  // Kyoshi knows) and when (0 when never: a save from before Kyoshi 5.270 has none). Another preference joins here
  // (setPref keeps only what this keeps).
  const cleanPrefs = raw => (isObj(raw) ? { theme: THEMES.includes(raw.theme) ? raw.theme : "", u: isPos(raw.u) ? raw.u : 0 } : { theme: "", u: 0 });

  // --- Kept here ---
  // Reads the log and the preferences (at start, and when another tab saved them). The log kept before Kyoshi 5.070
  // (K.store "bugReports", this device's only) joins it, each report last changed when it was logged, then goes: a change
  // counted once the app's sync identity is read (catchUp), when it brought any.
  function load() {
    reports = clean(R.store.json("bugReports"));
    prefs = cleanPrefs(R.store.json("prefs"));
    const old = K.store.json("bugReports");
    if (Array.isArray(old)) {
      const have = new Set(reports.map(r => r.id));
      const next = clean(reports.concat(old.filter(r => isObj(r) && !have.has(r.id)).map(r => ({ ...r, u: Date.parse(r.timestamp) || Date.now() }))));
      if (next.length > reports.length) {
        reports = next;
        store();
        R.store.set("pending", "1");
      }
      K.store.remove("bugReports");
    }
    applyPrefs();
    shown();
  }
  const store = () => R.store.set("bugReports", JSON.stringify(reports));
  const storePrefs = () => R.store.set("prefs", JSON.stringify(prefs));
  // A change made here, counted for sync (the cloud, the sync folder and Export all's highlight follow: core/sync.js). In
  // test mode it's kept all the same (its writes are real) but nothing syncs, so it's counted at the next start. quiet: a
  // preference picked, which doesn't make the data here newer (an import's question says when that last changed).
  const counted = (quiet = false) => (K.testMode ? R.store.set("pending", "1") : R.changed(true, quiet));
  // A change to the log made here: kept, counted and shown.
  function save() {
    store();
    counted();
    shown();
  }
  // The preferences take effect, whenever they're read (load: at start, and when another tab saved them) or come in
  // (another device's, a backup's): the theme picked last, anywhere (core/shell.js's K.setTheme shows it and keeps it on
  // this device, where the page draws from at its next start). None picked: this device keeps its own.
  function applyPrefs() {
    if (prefs.theme && prefs.theme !== document.documentElement.dataset.theme) K.setTheme(prefs.theme);
  }
  // A change kept while it couldn't be counted (in test mode, or the log carried over), counted once the sync identity is
  // read: at start (A.init), or in another tab outside test mode once it reloads the log.
  function catchUp() {
    if (K.testMode || R.store.get("pending") === null) return;
    R.store.remove("pending");
    R.changed();
  }

  // --- The changes core/bugs.js makes ---
  // A new report ({ app, description, markdown, kind }), logged after every one here (should the clock go back).
  function add(f) {
    const now = Date.now(), id = reports.reduce((n, r) => (isPos(r.id) && r.id >= n ? r.id + 1 : n), now);
    reports = reports.concat({ id, timestamp: new Date(now).toISOString(), app: f.app, description: f.description, markdown: f.markdown, kind: f.kind, u: now, edited: "", deleted: false });
    const over = live().slice(0, -REPORTS_MAX).map(r => r.id);
    if (over.length) reports = reports.map(r => (over.includes(r.id) ? marker(r, now) : r));
    save();
  }
  // A report edited: its new words, kind and text ({ description, kind, markdown }), and when; false once it's been
  // cleared (on another device, say: it isn't brought back).
  function edit(id, f) {
    const r = live().find(x => x.id === id), now = Date.now();
    if (!r) return false;
    reports = reports.map(x => (x === r ? { ...r, description: f.description, kind: f.kind, markdown: f.markdown, u: now, edited: new Date(now).toISOString() } : x));
    save();
    return true;
  }
  // Delete: one report a marker, as Clear makes, so it goes from every device; false once it's gone already (cleared or
  // deleted on another device, say).
  function remove(id) {
    const r = live().find(x => x.id === id);
    if (!r) return false;
    reports = reports.map(x => (x === r ? marker(r, Date.now()) : x));
    save();
    return true;
  }
  // Clear: every report a marker, on every device.
  function clear() {
    const now = Date.now();
    reports = reports.map(r => (r.deleted ? r : marker(r, now)));
    save();
  }

  // --- Core's preferences: the same on every device (the theme, core/shell.js) ---
  const pref = name => prefs[name];
  // A pick made here: kept and counted for sync. It's later than every pick this device has seen, so it wins over them
  // everywhere, whatever the other devices' clocks say. Before the record is read (a tap while the browser's storage
  // opens) it isn't kept: the theme tapped shows until the record is read, then the one last picked anywhere, if any.
  function setPref(name, value) {
    if (!R || !R.started) return;
    prefs = cleanPrefs({ ...prefs, [name]: value, u: Math.max(Date.now(), prefs.u + 1) });
    storePrefs();
    counted(true);
  }

  // --- Sync and backups: the hidden app's A.data (core/sync.js, core/backup.js) ---
  const looksLike = raw => Array.isArray(raw.bugReports);
  const count = n => (n === 1 ? "1 bug or request" : `${n} bugs and requests`);
  // Import all (Kyoshi is never the app on screen, so never Import JSON): the backup's log replaces this one; its
  // preferences only when picked later than these (an older backup's theme doesn't undo a later pick; one from before
  // Kyoshi 5.270 has none). Not in test mode, where its writes would be kept: the record stays as it is.
  function importBackup(raw, ask = true) {
    if (!isObj(raw) || !looksLike(raw)) return alert("That file doesn't hold Kyoshi's bugs and requests.");
    if (K.testMode) return undefined;
    const next = clean(raw.bugReports), mine = live().length, theirPrefs = cleanPrefs(raw.prefs);
    if (ask && mine && !K.backup.ask(R, raw, `Replace your ${count(mine)} with the ${count(next.filter(r => !r.deleted).length)} in this backup?`)) return undefined;
    reports = next;
    if (newer(theirPrefs, prefs)) prefs = theirPrefs;
    store();
    storePrefs();
    R.changed(false); // it's from a backup, so there's nothing new to export
    applyPrefs();
    shown();
    return true;
  }
  // Another device's save: taken whole, or combined with this log report by report, the later change winning (so a
  // marker over the report it cleared); the preferences whole, the later pick winning either way (an older copy's save
  // has none: these stay). The same on every device, so two combining at once agree.
  const sameAs = (a, b) => JSON.stringify(inOrder(a)) === JSON.stringify(inOrder(b));
  const samePrefs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function combine(raw, { replace, plain }) {
    const theirs = clean(raw.bugReports), theirPrefs = cleanPrefs(raw.prefs);
    if (plain && !theirs.length && !theirPrefs.u) return null;
    let next = theirs;
    if (!replace) next = inOrder(mergeById(clean(reports), theirs)); // each report's later change (K.util)
    const nextPrefs = newer(prefs, theirPrefs) ? prefs : theirPrefs;
    return {
      same: sameAs(next, theirs) && samePrefs(nextPrefs, theirPrefs),
      apply() {
        if (sameAs(next, reports) && samePrefs(nextPrefs, prefs)) return false; // nothing new here
        reports = next;
        prefs = nextPrefs;
        return true;
      }
    };
  }
  // What came in from another device: kept, the preferences taking effect, and shown.
  function afterSync() {
    store();
    storePrefs();
    applyPrefs();
    shown();
  }

  // Registers the hidden Kyoshi app (core/shell.js's K.start, before the apps start, so it starts last). Its hooks: load,
  // init (once its sync identity is read: a change kept while it couldn't be counted) and reload (load has read the
  // preferences and they took effect); no page.
  function init() {
    R = K.register({ id: "kyoshi", name: "Kyoshi", hidden: true });
    Object.assign(R, {
      VERSION: K.VERSION, CHANGELOG: K.CHANGELOG, load, init: catchUp, onReload: () => { catchUp(); shown(); },
      data: {
        schemaVersion: SCHEMA, build: () => ({ schemaVersion: SCHEMA, appVersion: K.VERSION, bugReports: reports, prefs }), looksLike,
        // Markers too (a log cleared here is news for a device that still has it), and a preference picked.
        hasData: () => reports.length > 0 || prefs.u > 0,
        importBackup, combine, afterSync
      }
    });
  }

  // live(): the reports (not the markers), in the order they were logged, as kept (read-only). pref(name): one of core's
  // preferences ("" when none was picked).
  K.record = { init, load, live, add, edit, remove, clear, pref, setPref };
})(Kyoshi);
