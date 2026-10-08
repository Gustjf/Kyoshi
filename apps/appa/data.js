/* Appa · data.js — the saved data: loading, saving, backups, and combining with other devices' saves.
 * A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js (folder sync) use; it also
 * lists the photos and PDFs the data uses (files), which folder sync copies as plain files and backups
 * leave out. Storage keys (A.store): things, jobs, records, readings, files, settings; timer (this
 * device's running timer: never synced or backed up); sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, newer, mergeById } = K.util;
  const { DATA_SCHEMA_VERSION } = A;
  const LISTS = ["things", "jobs", "records", "readings", "files"];

  // Keeps everything in storage; every change counts up S.version, so worked-out schedules are redone.
  function persist() {
    LISTS.forEach(k => A.store.set(k, JSON.stringify(S[k])));
    A.store.set("settings", JSON.stringify(S.settings));
    S.version++;
  }
  // A change made on this device: stored, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  const cleanAll = raw => ({
    things: A.cleanThings(raw.things), jobs: A.cleanJobs(raw.jobs), records: A.cleanRecords(raw.records),
    readings: A.cleanReadings(raw.readings), files: A.cleanFiles(raw.files), settings: A.cleanSettings(raw.settings)
  });

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    const raw = {};
    LISTS.concat("settings").forEach(k => { raw[k] = A.store.json(k); });
    Object.assign(S, cleanAll(raw));
    const t = A.store.json("timer");
    S.timer = isObj(t) && typeof t.jobId === "string" && isNum(t.start) ? { jobId: t.jobId, start: t.start } : null;
    S.version++;
  }
  const storeTimer = () => (S.timer ? A.store.set("timer", JSON.stringify(S.timer)) : A.store.remove("timer"));

  // ==========================================================================
  // BACKUPS (Export / Import JSON): the data only, never the photos and PDFs themselves
  // ==========================================================================
  const looksLike = raw => Array.isArray(raw.things) && Array.isArray(raw.jobs);

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, things: S.things, jobs: S.jobs, records: S.records, readings: S.readings, files: S.files, settings: S.settings };
  }

  // Replaces everything with the backup's, after checking it can be read and asking first (unless
  // ask is false: Import all already did). True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) {
      alert("That file doesn't look like an Appa backup.");
      return false;
    }
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Appa. Importing it anyway, but some data may not carry over.");
    }
    const next = cleanAll(raw), n = d => A.live(d.things).length, things = k => `${k} thing${k === 1 ? "" : "s"}`;
    if (ask && A.live(S.things).length && !K.backup.ask(A, raw, `Replace your ${things(n(S))} and their records with the ${things(n(next))} in this backup?`)) return false;
    Object.assign(S, next);
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // A save from the sync folder: taken whole, or combined with ours item by item (list by list),
  // the later change winning, and the settings by their u. The same on every device, so two
  // combining at once agree.
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const merge = (mine, theirs) => inOrder(mergeById(mine, theirs)); // each id's later change (K.util), in order
  const dataKey = d => JSON.stringify(LISTS.map(k => inOrder(d[k])).concat(d.settings));
  function combine(raw, { replace, plain }) {
    const their = cleanAll(raw);
    if (plain && !their.things.length) return null;
    const next = replace ? their : { ...Object.fromEntries(LISTS.map(k => [k, merge(S[k], their[k])])), settings: newer(their.settings, S.settings) ? their.settings : S.settings };
    return {
      same: dataKey(next) === dataKey(their),
      apply() {
        if (dataKey(next) === dataKey(S)) return false; // nothing new here
        Object.assign(S, next);
        S.version++;
        return true;
      }
    };
  }

  // Other devices' data came in from the folder: keep it, and show it.
  function afterSync() {
    persist();
    A.renderAll();
  }

  // The photos and PDFs the data uses, and those deleted, for folder sync (core/files.js).
  const files = () => ({
    live: A.live(S.files).map(f => ({ id: f.id, type: f.type, size: f.size })),
    gone: S.files.filter(f => f.deleted).map(f => f.id)
  });

  A.load = load;
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike,
    hasData: () => LISTS.some(k => S[k].length > 0),
    importBackup, combine, afterSync, files,
    afterFiles: () => A.renderAll() // photos that arrived show up
  };
  Object.assign(A, { save, persist, storeTimer });
})(Kyoshi, Kyoshi.apps.appa);
