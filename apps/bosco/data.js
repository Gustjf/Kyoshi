/* Bosco · data.js — Bosco's saved data: loading (and, on the first open, bringing in what the
 * standalone Bosco left in this browser), cleaning, saving, backups, and combining with other
 * devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js
 * (folder sync) use. Storage keys (A.store): entries, goals, profile, doseSnooze, sync (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isNum, isPos, isDate, isTime, todayStr } = K.util;
  const { DEFAULT_GOALS, MEDICATIONS, LEGACY_MEDICATION, BAC_ML_RANGE, MAX_PACE_PCT, DATA_SCHEMA_VERSION,
    byDate, convertWeight, isDoseInterval, weeklyFor, hasDose } = A;

  // The standalone Bosco's keys: read (never changed) on the first open in Kyoshi.
  const STANDALONE_KEYS = { entries: "weightTrackerEntries_v1", goals: "weightTrackerGoals_v1", profile: "weightTrackerProfile_v1" };

  function persist() {
    A.store.set("entries", JSON.stringify(S.entries));
    A.store.set("goals", JSON.stringify(S.goals));
    A.store.set("profile", JSON.stringify(S.profile));
  }

  // Keeps a change made on this device: stored locally, then counted for sync and
  // autosaved to the sync folder (if one is on, that save stands in for Export JSON).
  function save(unsaved = true) {
    persist();
    A.changed(unsaved);
  }

  /**
   * Cleans backup (or saved) data from any app version into the current shape,
   * converting weights from the data's unit (lb when missing, the only unit
   * older backups had) into targetUnit. Rows with an invalid date, or without a
   * valid weight or dose, are dropped — as are fields from removed features,
   * and (before v4) doses still ahead of today, which were never taken.
   * On duplicate dates the last row wins. Missing goals fall back to defaults.
   */
  function normalizeBackup(raw, targetUnit) {
    const from = raw.unit === "kg" ? "kg" : "lb";
    const pos = v => (isPos(v) ? v : null);
    const schemaVersion = isNum(raw.schemaVersion) ? raw.schemaVersion : 0, today = todayStr();
    const wasUpcoming = e => schemaVersion < 4 && e.date > today;
    const days = new Map();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach(e => {
      if (!e || !isDate(e.date)) return;
      const weight = pos(convertWeight(pos(e.weight), from, targetUnit));
      const doseMg = wasUpcoming(e) ? null : pos(e.doseMg);
      // Unknown but plain ids (from a newer version) are kept as they are.
      const med = typeof e.medication === "string" ? e.medication.trim().toLowerCase() : "";
      const medication = doseMg === null ? null : /^[a-z0-9 -]{1,40}$/.test(med) ? med : LEGACY_MEDICATION;
      if (weight !== null || doseMg !== null) days.set(e.date, { date: e.date, weight, doseMg, medication });
    });
    const goalList = Array.isArray(raw.goals)
      ? raw.goals.filter(isPos).map(g => convertWeight(g, from, targetUnit))
      : DEFAULT_GOALS.map(g => convertWeight(g, "lb", targetUnit));
    return {
      schemaVersion,
      entries: [...days.values()].sort(byDate),
      goals: [...new Set(goalList.filter(isPos))].sort((a, b) => b - a),
      name: typeof raw.name === "string" ? raw.name.trim() : "",
      medication: MEDICATIONS[raw.medication] ? raw.medication : "",
      dosePlan: cleanDosePlan(raw.dosePlan),
      vial: cleanVial(raw.vial),
      paceGoal: cleanPaceGoal(raw.paceGoal)
    };
  }

  // A dosing plan or vial from storage or a backup, or null if it's unusable.
  // Each keeps when it was saved: where two meet, the more recent one wins.
  function cleanDosePlan(p) {
    if (!p || typeof p !== "object" || !Object.hasOwn(MEDICATIONS, p.medication)) return null;
    const n = p.nextDose || (p.postponed && { after: p.postponed.after, date: p.postponed.to }); // "postponed" { after, to } in 5.397–5.407
    const intervalDays = isDoseInterval(p.intervalDays) ? p.intervalDays : null;
    return {
      medication: p.medication,
      intervalDays,
      // Before 5.608 a plan held each dose (doseMg) instead of the weekly dose.
      weeklyMg: isPos(p.weeklyMg) ? p.weeklyMg : isPos(p.doseMg) && intervalDays ? weeklyFor(p.doseMg, intervalDays) : null,
      doseTime: isTime(p.doseTime) ? p.doseTime : null, // a dose is asked about from then on its day
      // The next dose set to a day (by postponing it, or as an anchor dose), until
      // a dose is logged after the last one taken when it was set (after, "" if none).
      nextDose: n && (n.after === "" || isDate(n.after)) && isDate(n.date) ? { after: n.after, date: n.date } : null,
      savedAt: String(p.savedAt || "")
    };
  }
  function cleanVial(v) {
    if (!v || typeof v !== "object" || !Object.hasOwn(MEDICATIONS, v.medication)) return null;
    // A mixed vial's concentration always comes from its mg and BAC water.
    const mixed = isPos(v.vialMg) && isNum(v.bacMl) && v.bacMl >= BAC_ML_RANGE[0] && v.bacMl <= BAC_ML_RANGE[1];
    const mgPerMl = mixed ? v.vialMg / v.bacMl : v.mgPerMl;
    if (!isPos(mgPerMl)) return null;
    return { medication: v.medication, mgPerMl, vialMg: mixed ? v.vialMg : null, bacMl: mixed ? v.bacMl : null, savedAt: String(v.savedAt || "") };
  }
  const latest = (a, b) => (!a || (b && b.savedAt >= a.savedAt) ? b : a); // b on a tie

  // A weekly pace goal from storage, a backup, or start-up info, or null if it's
  // unusable. A range as wide as the target would count no change as on pace.
  function cleanPaceGoal(g) {
    if (!g || typeof g !== "object" || (g.dir !== "lose" && g.dir !== "gain")) return null;
    const { weeklyPct, rangePct } = g;
    if (!isPos(weeklyPct) || weeklyPct > MAX_PACE_PCT || !isNum(rangePct) || rangePct < 0 || rangePct >= weeklyPct) return null;
    return { dir: g.dir, weeklyPct, rangePct };
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    // First open in Kyoshi: bring in what the standalone Bosco left in this browser (on the
    // same site, e.g. GitHub Pages), leaving it as it is.
    if (A.store.get("entries") === null && A.store.get("profile") === null) {
      Object.keys(STANDALONE_KEYS).forEach(k => {
        const v = K.storage.get(STANDALONE_KEYS[k]);
        if (v !== null) A.store.set(k, v);
      });
    }
    const p = A.store.json("profile");
    S.profile = p && typeof p === "object" && !Array.isArray(p) ? p : {};
    if (typeof S.profile.name !== "string") S.profile.name = "";
    if (S.profile.unit !== "kg" && S.profile.unit !== "lb") S.profile.unit = ""; // not answered yet
    S.unit = S.profile.unit || "lb";
    S.profile.dosePlan = cleanDosePlan(S.profile.dosePlan);
    S.profile.vial = cleanVial(S.profile.vial);
    S.profile.paceGoal = cleanPaceGoal(S.profile.paceGoal);
    // Older versions only asked "Do you take Tirzepatide?"; carry that answer over.
    if ("usesTirzepatide" in S.profile) {
      if (!S.profile.medication) S.profile.medication = S.profile.usesTirzepatide === false ? "none" : LEGACY_MEDICATION;
      if (S.profile.usesTirzepatideAsked) S.profile.medicationAsked = true;
      delete S.profile.usesTirzepatide;
      delete S.profile.usesTirzepatideAsked;
      A.store.set("profile", JSON.stringify(S.profile));
    }

    // Saved data goes through the same cleanup as imports (as the schema it was
    // saved in, noted since v4), so damaged storage can't break the app; write
    // it back if anything had to change.
    const storedEntries = A.store.get("entries"), storedGoals = A.store.get("goals");
    const clean = normalizeBackup({ unit: S.unit, schemaVersion: S.profile.schemaVersion || 3, entries: A.store.json("entries"), goals: A.store.json("goals") }, S.unit);
    S.entries = clean.entries;
    S.goals = clean.goals;
    if (storedEntries !== null && (storedEntries !== JSON.stringify(S.entries) || storedGoals !== JSON.stringify(S.goals))) {
      A.store.set("entries", JSON.stringify(S.entries));
      A.store.set("goals", JSON.stringify(S.goals));
    }
    if (S.profile.schemaVersion !== DATA_SCHEMA_VERSION) {
      S.profile.schemaVersion = DATA_SCHEMA_VERSION;
      if (storedEntries !== null) A.store.set("profile", JSON.stringify(S.profile)); // else saved with the first entry
    }
  }

  // ==========================================================================
  // BACKUPS (Export / Import JSON)
  // ==========================================================================
  function buildBackup() {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      appVersion: A.VERSION,
      unit: S.unit,
      name: S.profile.name,
      medication: A.currentMedication(),
      dosePlan: S.profile.dosePlan,
      vial: S.profile.vial,
      paceGoal: S.profile.paceGoal,
      entries: S.entries,
      goals: S.goals,
      cumulativeDoseMgByMedication: A.cumulativeDoseMg() // derived totals for reference; not read on import
    };
  }

  // Swaps in cleaned backup data (from Import JSON or the sync folder) for all
  // entries and goals. A backupUnit answers the Units question with the backup's.
  function applyBackup(clean, backupUnit) {
    if (backupUnit) S.unit = S.profile.unit = backupUnit;
    S.entries = clean.entries;
    S.goals = clean.goals;
    if (clean.name) S.profile.name = clean.name; // older backups have no name; keep ours
    if (clean.paceGoal) S.profile.paceGoal = clean.paceGoal; // nor a pace goal
    // The most recently saved dosing plan and vial are kept, so an older backup
    // never brings back an old vial's concentration.
    S.profile.dosePlan = latest(S.profile.dosePlan, clean.dosePlan);
    S.profile.vial = latest(S.profile.vial, clean.vial);
    // Dose entries prove a medication is in use, so that start-up question is
    // answered (with the backup's own answer, else its latest dose's medication).
    const lastDose = S.entries.filter(hasDose).pop();
    if (lastDose && (!S.profile.medicationAsked || !A.medicationEnabled())) {
      Object.assign(S.profile, { medication: clean.medication || lastDose.medication, medicationAsked: true });
    }
  }

  // Replaces all entries and goals with the backup's (raw: its parsed JSON), after
  // validating it first so a bad file never changes anything, and asking first
  // (unless ask is false: Import all already did) if there's data to lose.
  function importBackup(raw, ask = true) {
    if (!raw || !Array.isArray(raw.entries)) return alert("Invalid backup file: no entries found.");
    // Until Units is answered, the backup's own unit answers it, so its weights aren't converted.
    const backupUnit = !S.profile.unit && (raw.unit === "kg" || raw.unit === "lb") ? raw.unit : "";
    const clean = normalizeBackup(raw, backupUnit || S.unit);
    if (!clean.entries.length) return alert("Invalid backup file: no usable entries found.");
    if (clean.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Bosco. Importing it anyway, but some data may not carry over.");
    }
    const count = n => `${n} ${n === 1 ? "entry" : "entries"}`;
    if (ask && S.entries.length && !confirm(`Replace your ${count(S.entries.length)} and goals with the ${count(clean.entries.length)} in this backup? This can't be undone.`)) return;
    applyBackup(clean, backupUnit);
    save(false);
    S.currentPage = 1;
    A.renderOneTimeInfo();
    A.renderAll();
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // Combines two versions changed separately: every day and goal from either is
  // kept (so something deleted meanwhile can come back), and a day both changed
  // takes each value from the more recent save. Gives the same result on every
  // device, so two devices combining at once still agree.
  function mergeVersions(a, b) {
    const [older, newer] = a.savedAt + a.device > b.savedAt + b.device ? [b, a] : [a, b];
    const days = new Map(older.entries.map(e => [e.date, e]));
    newer.entries.forEach(e => {
      const o = days.get(e.date) || {};
      const d = isNum(e.doseMg) ? e : o; // a dose and its medication travel together
      days.set(e.date, { date: e.date, weight: e.weight ?? o.weight ?? null, doseMg: d.doseMg ?? null, medication: d.medication ?? null });
    });
    return {
      entries: [...days.values()].sort(byDate),
      goals: [...new Set(older.goals.concat(newer.goals))].sort((x, y) => y - x),
      name: newer.name || older.name,
      dosePlan: latest(older.dosePlan, newer.dosePlan),
      vial: latest(older.vial, newer.vial),
      paceGoal: newer.paceGoal || older.paceGoal
    };
  }
  const dataKey = d => JSON.stringify([d.entries, d.goals, d.name, d.dosePlan, d.vial, d.paceGoal]);

  // A save from the folder, taken whole (replace) or combined with ours; see core/sync.js.
  function combine(raw, { replace, plain, mine, theirs }) {
    // Taking a save whole can answer Units, as an import does; combining keeps ours.
    const backupUnit = replace && !S.profile.unit && (raw.unit === "kg" || raw.unit === "lb") ? raw.unit : "";
    const their = normalizeBackup(raw, backupUnit || S.unit);
    if (plain && !their.entries.length) return null;
    const ours = { entries: S.entries, goals: S.goals, name: S.profile.name, dosePlan: S.profile.dosePlan, vial: S.profile.vial, paceGoal: S.profile.paceGoal };
    const next = replace
      ? { ...their, dosePlan: latest(ours.dosePlan, their.dosePlan), vial: latest(ours.vial, their.vial) } // as on import
      : mergeVersions({ ...ours, ...mine }, { ...their, ...theirs });
    return {
      same: dataKey(next) === dataKey(their),
      apply() {
        if (!backupUnit && dataKey({ ...next, name: next.name || S.profile.name, paceGoal: next.paceGoal || S.profile.paceGoal }) === dataKey(ours)) return false; // nothing new here
        applyBackup(next, backupUnit);
        return true;
      }
    };
  }

  // Other devices' data came in from the folder: keep it, and show it.
  function afterSync() {
    persist();
    if (A.$("oneTimeInfoCancelBtn").hidden) A.renderOneTimeInfo(); // not while start-up info is being edited
    A.renderAll();
  }

  A.load = load;
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION,
    build: buildBackup,
    looksLike: raw => Array.isArray(raw.entries),
    hasData: () => S.entries.length > 0,
    importBackup, combine, afterSync
  };
  Object.assign(A, { persist, save, normalizeBackup, cleanPaceGoal });
})(Kyoshi, Kyoshi.apps.bosco);
