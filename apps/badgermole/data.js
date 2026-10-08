/* Badgermole · data.js — the saved data: cleaning, loading, saving, backups, and combining with other devices'
 * saves. A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js (folder sync) use. Storage keys
 * (A.store): exercises, routines, sessions, programs, program, settings; live (this device's session in progress:
 * never synced, backed up, combined or counted); sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_EXERCISE, MAX_ROUTINE, MAX_LINES, MAX_SETS, MAX_REPS, MAX_WEIGHT, MAX_TARGET,
    DEFAULT_TARGET, MAX_PROGRAM, MAX_PROGRAM_NAME, MAIN_PROGRAM, MAX_SESSION_SETS, STEPS, DEFAULT_STEP, MAX_PAIR,
    MIN_ROUTINE_MINUTES, DEFAULT_MINUTES, MAX_SESSION_MINUTES, cleanLine, clampInt, plural, round2, numbered, fixPairs } = A;
  const LISTS = ["exercises", "routines", "sessions", "programs"];
  const MAX_MS = 8.64e15; // the last moment a date can hold

  // ==========================================================================
  // CLEANING: saved, imported and new data all pass through here, so every copy has the same shape (two copies
  // compare alike) and anything unusable is dropped (a damaged file can't break the app). A deleted item keeps
  // only what sync needs: { id, deleted, at (started for a session), u }.
  // ==========================================================================
  const idOf = v => (typeof v === "string" && v ? v.slice(0, 40) : "");
  const msOf = v => (isPos(v) && v < MAX_MS ? v : 0);
  const unitOf = u => (u === "kg" ? "kg" : "lb");
  const cleanWeight = w => (isNum(w) && w > 0 ? Math.min(MAX_WEIGHT, round2(w)) : 0);
  const uOf = x => (isPos(x.u) ? x.u : 0);
  const pairOf = v => (Number.isInteger(v) && v >= 1 && v <= MAX_PAIR ? v : 0);
  const orderOf = v => (Array.isArray(v) ? v : []).map(idOf).filter(Boolean).slice(0, MAX_PROGRAM);
  // Keeps the first of each id, and those still worth keeping.
  const unique = (list, keep) => { const ids = new Set(); return list.filter(x => keep(x) && !ids.has(x.id) && ids.add(x.id)); };
  const objects = list => (Array.isArray(list) ? list : []).filter(isObj);

  function cleanExercises(list) {
    return unique(objects(list).map(e => (e.deleted === true ? { id: idOf(e.id) || newId(), deleted: true, at: msOf(e.at), u: uOf(e) } : {
      id: idOf(e.id) || newId(),
      name: cleanLine(e.name, MAX_EXERCISE),
      bodyweight: e.bodyweight === true, // reps and an added weight, rather than a weight
      step: STEPS.includes(e.step) ? e.step : DEFAULT_STEP, // its progression step, in lb
      deleted: false, at: msOf(e.at), u: uOf(e)
    })), e => e.deleted || e.name);
  }

  // A routine's lines: each exercise once, the same reps for every set (a minimum when it goes to failure: the good
  // reps are logged), its weight in the unit it was typed in, and a superset's number shared with the line next to it.
  function cleanItems(list) {
    const seen = new Set();
    return fixPairs(objects(list).map(x => ({
      exerciseId: idOf(x.exerciseId),
      sets: clampInt(x.sets, 1, MAX_SETS, 3),
      reps: clampInt(x.reps, 1, MAX_REPS, 5),
      weight: cleanWeight(x.weight),
      unit: unitOf(x.unit),
      toFailure: x.toFailure === true,
      pair: pairOf(x.pair)
    })).filter(x => x.exerciseId && !seen.has(x.exerciseId) && seen.add(x.exerciseId)).slice(0, MAX_LINES));
  }

  function cleanRoutines(list) {
    return unique(objects(list).map(r => (r.deleted === true ? { id: idOf(r.id) || newId(), deleted: true, at: msOf(r.at), u: uOf(r) } : {
      id: idOf(r.id) || newId(),
      name: cleanLine(r.name, MAX_ROUTINE),
      minutes: clampInt(r.minutes, MIN_ROUTINE_MINUTES, MAX_SESSION_MINUTES, DEFAULT_MINUTES), // how long it takes, as typed (60 until it is)
      items: cleanItems(r.items),
      deleted: false, at: msOf(r.at), u: uOf(r)
    })), r => r.deleted || r.name);
  }

  // The programs: each a rotation of routines (repeats allowed), one followed at a time (program.active).
  function cleanPrograms(list) {
    return unique(objects(list).map(p => (p.deleted === true ? { id: idOf(p.id) || newId(), deleted: true, at: msOf(p.at), u: uOf(p) } : {
      id: idOf(p.id) || newId(),
      name: cleanLine(p.name, MAX_PROGRAM_NAME),
      order: orderOf(p.order),
      deleted: false, at: msOf(p.at), u: uOf(p)
    })), p => p.deleted || p.name);
  }

  // Which program is followed (active: its id, "" for none) and since when (only sessions from then on place its next
  // routine, so picking one starts it from its first), its rotation again in order (older copies read only that).
  const cleanProgram = p => (isObj(p) ? { order: orderOf(p.order), active: idOf(p.active), since: msOf(p.since), u: uOf(p) }
    : { order: [], active: "", since: 0, u: 0 });

  const cleanSettings = s => (isObj(s) ? {
    unit: unitOf(s.unit),
    weeklyTarget: clampInt(s.weeklyTarget, 1, MAX_TARGET, DEFAULT_TARGET),
    u: uOf(s)
  } : { unit: "lb", weeklyTarget: DEFAULT_TARGET, u: 0 });

  // Logged sets, numbered within their exercise. A set keeps its exercise's name and kind as they were (bodyweight:
  // its weight is the added weight, for good); reps can be 0 only from editing a past session.
  const cleanSets = list => numbered(objects(list).map(x => ({
    exerciseId: idOf(x.exerciseId),
    name: cleanLine(x.name, MAX_EXERCISE) || "Exercise",
    bodyweight: x.bodyweight === true,
    n: 0,
    reps: clampInt(x.reps, 0, MAX_REPS, 0),
    weight: cleanWeight(x.weight),
    unit: unitOf(x.unit),
    at: msOf(x.at)
  })).filter(x => x.exerciseId).slice(0, MAX_SESSION_SETS));

  function cleanSessions(list) {
    return unique(objects(list).map(s => {
      if (s.deleted === true) return { id: idOf(s.id) || newId(), deleted: true, started: msOf(s.started), u: uOf(s) };
      const started = msOf(s.started);
      return {
        id: idOf(s.id) || newId(),
        date: isDate(s.date) ? s.date : "",            // the day it started; sets after midnight belong to it
        routineId: idOf(s.routineId),
        name: cleanLine(s.name, MAX_ROUTINE),          // the routine's, as it was
        sets: cleanSets(s.sets),
        started, finished: Math.max(started, msOf(s.finished)),
        deleted: false, u: uOf(s)
      };
    }), s => s.deleted || s.date);
  }

  // This device's session in progress: a copy of the routine's lines at start (so editing or deleting the
  // routine or an exercise meanwhile changes nothing), the sets logged so far, the exercise on screen, the
  // steppers as left (a field left empty is null) and a logged set tapped to change (held: back in its place
  // unless it's logged again). null when there's none, or it can't be used.
  function cleanLive(l) {
    if (!isObj(l) || !isDate(l.date) || !idOf(l.id)) return null;
    const items = fixPairs(objects(l.items).map(x => ({
      exerciseId: idOf(x.exerciseId), name: cleanLine(x.name, MAX_EXERCISE) || "Exercise", bodyweight: x.bodyweight === true,
      sets: clampInt(x.sets, 1, MAX_SETS, 3), reps: clampInt(x.reps, 1, MAX_REPS, 5), weight: cleanWeight(x.weight), unit: unitOf(x.unit),
      toFailure: x.toFailure === true, pair: pairOf(x.pair)
    })).filter(x => x.exerciseId).slice(0, MAX_LINES));
    if (!items.length) return null;
    const numOrNull = v => (isNum(v) ? v : null), s = l.show, h = isObj(l.held) && cleanSets([l.held.set])[0];
    return {
      id: idOf(l.id), date: l.date, routineId: idOf(l.routineId), name: cleanLine(l.name, MAX_ROUTINE) || "Workout",
      started: msOf(l.started), items, sets: cleanSets(l.sets),
      pos: { item: clampInt(isObj(l.pos) ? l.pos.item : 0, 0, items.length - 1, 0) },
      show: isObj(s) ? { item: clampInt(s.item, 0, items.length - 1, 0), weight: numOrNull(s.weight), reps: numOrNull(s.reps), unit: unitOf(s.unit), up: s.up === true } : null,
      held: h ? { index: clampInt(l.held.index, 0, MAX_SESSION_SETS, 0), set: h } : null
    };
  }

  // From before programs, the one rotation becomes the program "Program", followed with every session counting (so
  // its next routine stays): its id fixed and its stamps the rotation's, so two devices doing this apart agree.
  function cleanAll(raw) {
    const out = {
      exercises: cleanExercises(raw.exercises), routines: cleanRoutines(raw.routines), sessions: cleanSessions(raw.sessions),
      programs: cleanPrograms(raw.programs), program: cleanProgram(raw.program), settings: cleanSettings(raw.settings)
    };
    const p = out.program;
    if (p.order.length && !out.programs.some(x => !x.deleted)) {
      out.programs = out.programs.filter(x => x.id !== MAIN_PROGRAM).concat({ id: MAIN_PROGRAM, name: "Program", order: p.order.slice(), deleted: false, at: p.u, u: p.u });
      out.program = { ...p, active: MAIN_PROGRAM };
    }
    return out;
  }

  // ==========================================================================
  // STORING
  // ==========================================================================
  // The six keys as stored, to tell whether another tab changed them or only its session in progress.
  const KEYS = LISTS.concat("program", "settings");
  const storedKey = () => KEYS.map(k => A.store.get(k)).join("\n");
  let loadedKey = "";

  // Keeps everything in storage; every change counts up S.version, so the worked-out stats are redone.
  function persist() {
    KEYS.forEach(k => A.store.set(k, JSON.stringify(S[k])));
    loadedKey = storedKey();
    S.version++;
  }
  // A change made on this device: stored, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }
  // The session in progress is this device's own: stored (or removed) without counting as a change to sync, and
  // without redoing the stats (it's in none of them until it's finished).
  function storeLive() {
    if (S.live) A.store.set("live", JSON.stringify(S.live));
    else A.store.remove("live");
  }

  // Reads everything from storage (at start, and when another tab saved): the six only when they changed (a tab
  // logging sets stores just its session in progress). The session's steppers as typed in this tab stay.
  function load() {
    const key = storedKey();
    if (key !== loadedKey) {
      const raw = {};
      KEYS.forEach(k => { raw[k] = A.store.json(k); });
      Object.assign(S, cleanAll(raw));
      loadedKey = key;
      S.version++;
    }
    const live = cleanLive(A.store.json("live"));
    if (live && S.live && live.id === S.live.id && S.live.show) live.show = S.live.show;
    S.live = live;
  }

  // ==========================================================================
  // BACKUPS (Export / Import JSON): the six, never the session in progress
  // ==========================================================================
  // No other app keeps both lists (Appa: things and jobs; Iroh: areas and goals; Hawky and Wan Shi Tong: items).
  const looksLike = raw => Array.isArray(raw.exercises) && Array.isArray(raw.sessions);

  // A backup from before programs (no programs in it) imports as it is: cleanAll makes its rotation a program.
  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, exercises: S.exercises, routines: S.routines, programs: S.programs, program: S.program, sessions: S.sessions, settings: S.settings };
  }

  // Replaces the six with the backup's, after checking it has exercises or sessions in it (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anything to lose.
  // A session in progress stays. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) {
      alert("That file doesn't look like a Badgermole backup.");
      return false;
    }
    const next = cleanAll(raw), count = d => `${plural(A.live(d.exercises).length, "exercise")} and ${plural(A.live(d.sessions).length, "session")}`;
    if (!A.live(next.exercises).length && !A.live(next.sessions).length) {
      alert("That backup has no exercises or sessions in it, so nothing was changed.");
      return false;
    }
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Badgermole. Importing it anyway, but some data may not carry over.");
    }
    const mine = A.live(S.exercises).length || A.live(S.sessions).length;
    if (ask && mine && !K.backup.ask(A, raw, `Replace your ${count(S)} with the ${count(next)} in this backup?`)) return false;
    Object.assign(S, next);
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // A save from the sync folder: taken whole, or combined with ours item by item (list by list), the later change
  // winning (programs too), and the program followed and settings whole by their u. The same on every device, so two
  // combining at once agree.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  const orderKey = x => (x.started !== undefined ? x.started : x.at);
  const inOrder = list => list.slice().sort((a, b) => orderKey(a) - orderKey(b) || (a.id < b.id ? -1 : 1));
  function merge(mine, theirs) {
    const byId = new Map(mine.map(i => [i.id, i]));
    theirs.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
    return inOrder([...byId.values()]);
  }
  const dataKey = d => JSON.stringify(LISTS.map(k => inOrder(d[k])).concat(d.program, d.settings));
  function combine(raw, { replace, plain }) {
    const their = cleanAll(raw);
    if (plain && !their.exercises.length && !their.sessions.length) return null;
    const next = replace ? their : {
      ...Object.fromEntries(LISTS.map(k => [k, merge(S[k], their[k])])),
      program: newer(their.program, S.program) ? their.program : S.program,
      settings: newer(their.settings, S.settings) ? their.settings : S.settings
    };
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

  A.load = load;
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike,
    hasData: () => ["exercises", "routines", "sessions"].some(k => S[k].length > 0), // programs alone don't count
    importBackup, combine, afterSync
  };
  Object.assign(A, { cleanExercises, cleanRoutines, cleanPrograms, cleanSessions, cleanLive, cleanWeight, save, persist, storeLive });
})(Kyoshi, Kyoshi.apps.badgermole);
