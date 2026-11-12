/* Bosco · data.js — Bosco's saved data: loading (and, on the first open, bringing in what the
 * standalone Bosco left in this browser), cleaning, saving, backups, and combining with other
 * devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js
 * (folder sync) use. Storage keys (A.store): entries, gone (deleted days' markers), goals, profile, retinoids (the non-daily treatments: treatments.js),
 * goalsAsEntered (each goal as typed, 8.812 on), doseSnooze, sync and meetings (core's). A day's weigh-in or dose set here is stamped (setDay: wu, du), and a day deleted leaves a
 * marker of what it deleted (forget). A day holds a dose per medication (its first's fields, the others' in `more`, 10.137 on); each
 * medication has its own dosing plan and vial (profile.dosePlans, profile.vials). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isNum, isPos, isDate, isTime, todayStr } = K.util;
  const { DEFAULT_GOALS, MEDICATIONS, LEGACY_MEDICATION, SITES, LEGACY_SITES, BAC_ML_RANGE, MAX_PACE_PCT, DATA_SCHEMA_VERSION,
    byDate, convertWeight, typedAs, goalsAsEntered, isDoseInterval, weeklyFor, hasWeight, hasDose, dosesOf } = A;

  // The standalone Bosco's keys: read (never changed) on the first open in Kyoshi.
  const STANDALONE_KEYS = { entries: "weightTrackerEntries_v1", goals: "weightTrackerGoals_v1", profile: "weightTrackerProfile_v1" };

  const persist = () => ["entries", "gone", "goals", "goalsAsEntered", "profile", "retinoids"].forEach(k => A.store.set(k, JSON.stringify(S[k])));

  // A day as kept, its fields in this order: its weigh-in, then its doses (doses: [{ doseMg, medication, site, du }], in the
  // order logged, one per medication): the first's as the day's own fields (what older copies read), the others' in
  // `more` (10.137 on), only when there are any. Its weigh-in's stamp (wu: when it last changed, 7.601 on) and each dose's
  // (du) only once they have one, so older data reads as it was; typed ({ weight, unit }, 8.813 on) only while its weigh-in
  // shows in another unit than the one it was typed in: what it's shown from, so it never drifts as units change.
  const stamped = (k, v) => (v ? { [k]: v } : {});
  function day(date, weight, doses, wu, typed) {
    const [d, ...more] = doses;
    return { date, weight, doseMg: d ? d.doseMg : null, medication: d ? d.medication : null, site: d ? d.site ?? null : null, ...stamped("wu", wu), ...stamped("du", d && d.du),
      ...(more.length ? { more: more.map(o => ({ doseMg: o.doseMg, medication: o.medication, site: o.site ?? null, ...stamped("du", o.du) })) } : {}),
      ...(typed && weight !== null ? { typed } : {}) };
  }
  // A day's weigh-in ({ weight }) or a dose ({ doseMg, medication, site }: that medication's that day) set here: its entry
  // made or changed, and that part stamped now, so where two devices changed it, the later change wins (mergeVersions);
  // always later than the version it replaces (and than the day's other doses: a dose logged now is the day's last) and
  // than its deletion here, whatever the clocks say (another device's may run ahead).
  function setDay(date, part) {
    const old = S.entries.find(x => x.date === date), mark = S.gone.find(g => g.date === date), doses = old ? dosesOf(old) : [];
    const next = "doseMg" in part
      ? day(date, old ? old.weight : null, doses.filter(d => d.medication !== part.medication).concat({ ...part, du: above(...doses, mark, "du") }), old && old.wu, old && old.typed)
      : day(date, part.weight, doses, above(old, mark, "wu"), null); // a weigh-in set here is typed in this unit
    S.entries = S.entries.filter(x => x !== old).concat(next).sort(byDate);
  }
  // A stamp for a part (k: "wu", "du") changed now: later than now and than its stamp in each copy or marker given.
  const above = (...args) => { const k = args.pop(); return Math.max(Date.now(), ...args.map(x => ((x && x[k]) ?? -1) + 1)); };
  // A day deleted here: out of the entries, and a marker kept apart from them (nothing else sees it) holding the stamps
  // of the weigh-in and the dose it deleted (0: unstamped), so another device's copy of those doesn't bring them back,
  // while a change made there that this device never saw (a later stamp) stays.
  function forget(date) {
    const e = S.entries.find(x => x.date === date);
    if (!e) return;
    S.entries = S.entries.filter(x => x !== e);
    S.gone = joinGone([S.gone, [{ date, ...(hasWeight(e) ? { wu: e.wu || 0 } : {}), ...(hasDose(e) ? { du: Math.max(...dosesOf(e).map(d => d.du || 0)) } : {}) }]]);
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
   * Weigh-ins (typed, 8.813 on) and goals (goalsAsEntered, 8.812 on) are converted from how each was typed, so they
   * never drift as units change.
   * A day's stamps (wu, du: 7.601 on) are kept only with their part, so older data reads as it was. A day's doses: its own
   * fields' and those in `more` (10.137 on), one per medication (the first of each).
   */
  function normalizeBackup(raw, targetUnit) {
    const from = raw.unit === "kg" ? "kg" : "lb";
    const pos = v => (isPos(v) ? v : null);
    const schemaVersion = isNum(raw.schemaVersion) ? raw.schemaVersion : 0, today = todayStr();
    const wasUpcoming = e => schemaVersion < 4 && e.date > today;
    const days = new Map();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach(e => {
      if (!e || !isDate(e.date)) return;
      const typed = isPos(e.weight) ? typedAs(e.typed, e.weight, from) : null;
      const weight = typed ? pos(convertWeight(typed.weight, typed.unit, targetUnit)) : null;
      const dose = d => {
        const doseMg = !d || typeof d !== "object" || wasUpcoming(e) ? null : pos(d.doseMg);
        if (doseMg === null) return null;
        // Unknown but plain ids (from a newer version) are kept as they are.
        const med = typeof d.medication === "string" ? d.medication.trim().toLowerCase() : "";
        const medication = /^[a-z0-9 -]{1,40}$/.test(med) ? med : LEGACY_MEDICATION;
        // Where a dose went: a site's id (one from a newer version kept as it is), or null.
        const site = typeof d.site === "string" && /^[a-z0-9-]{1,40}$/.test(d.site) ? d.site : null;
        return { doseMg, medication, site, du: isPos(d.du) ? d.du : 0 };
      };
      const doses = [e].concat(Array.isArray(e.more) ? e.more : []).map(dose).filter((d, i, all) => d && all.findIndex(o => o && o.medication === d.medication) === i);
      if (weight !== null || doses.length) days.set(e.date, day(e.date, weight, doses, weight !== null && isPos(e.wu) ? e.wu : 0, typed && typed.unit !== targetUnit ? typed : null));
    });
    const typed = (Array.isArray(raw.goalsAsEntered) ? raw.goalsAsEntered : [])
      .filter(o => o && isPos(o.weight) && (o.unit === "lb" || o.unit === "kg")).map(o => ({ weight: o.weight, unit: o.unit }));
    const asTyped = Array.isArray(raw.goals) ? goalsAsEntered(raw.goals.filter(isPos), from, typed) : DEFAULT_GOALS.map(g => ({ weight: g, unit: "lb" }));
    const goalList = new Map(); // goal (in targetUnit) → as typed; the first of a goal wins
    asTyped.forEach(o => { const g = convertWeight(o.weight, o.unit, targetUnit); if (isPos(g) && !goalList.has(g)) goalList.set(g, o); });
    const goals = [...goalList.keys()].sort((a, b) => b - a);
    return {
      schemaVersion,
      entries: [...days.values()].sort(byDate),
      gone: cleanGone(raw.gone),
      goals,
      goalsAsEntered: goals.map(g => goalList.get(g)),
      name: typeof raw.name === "string" ? raw.name.trim() : "",
      medications: cleanMedications(raw.medications, raw.medication),
      dosePlans: perMed(listOf(raw.dosePlans).map(cleanDosePlan), cleanDosePlan(raw.dosePlan)),
      vials: perMed(listOf(raw.vials).map(cleanVial), cleanVial(raw.vial)),
      paceGoal: cleanPaceGoal(raw.paceGoal),
      sites: cleanSites(raw.sites),
      skipSites: cleanSkips(raw.skipSites),
      asked: cleanAsked(raw.asked, cleanMedications(raw.medications, raw.medication)),
      retinoids: A.cleanRetinoids(raw.retinoids) // undefined from a file without them (an older copy's): ours stay
    };
  }

  // Deleted days' markers (7.601 on; none in an older version's), lists of them joined: [{ date, wu, du }], one per
  // date, by date; a part's stamp only when that part was deleted, the latest one (a later deletion deleted a later version).
  function joinGone(lists) {
    const days = new Map(), at = v => (Number.isFinite(v) && v >= 0 ? v : -1);
    lists.flat().forEach(g => {
      if (!g || !isDate(g.date)) return;
      const o = days.get(g.date) || {}, wu = Math.max(at(o.wu), at(g.wu)), du = Math.max(at(o.du), at(g.du));
      if (wu >= 0 || du >= 0) days.set(g.date, { date: g.date, ...(wu >= 0 ? { wu } : {}), ...(du >= 0 ? { du } : {}) });
    });
    return [...days.values()].sort(byDate);
  }
  const cleanGone = list => joinGone([Array.isArray(list) ? list : []]);

  // The injection sites on, from storage or a backup: known ones only, in SITES' order; null if there's
  // no list (never picked, or an older version's file). A site of a version before 7.500 turns on every
  // site it's now split into ("abd-l": the left abdomen's two heights; "thigh-l-upper": the left thigh's
  // two upper faces), so what was on stays on.
  function cleanSites(list) {
    if (!Array.isArray(list)) return null;
    const words = id => id.split("-");
    const on = list.flatMap(id => (LEGACY_SITES.some(s => s[0] === id) ? SITES.map(s => s[0]).filter(s => words(id).every(w => words(s).includes(w))) : [id]));
    return SITES.map(s => s[0]).filter(id => on.includes(id));
  }
  // The sites the next dose passes over (Developer Mode's Skip this site): known ones, null for none;
  // undefined from a copy older than skips, so combining keeps the other save's.
  function cleanSkips(list) {
    if (list === undefined) return undefined;
    const ids = Array.isArray(list) ? SITES.map(s => s[0]).filter(id => list.includes(id)) : [];
    return ids.length ? ids : null;
  }
  // The medications a save names as taken, known ones only, in its order (the first: the one older copies go by): its list
  // (medications, 10.137 on), else its one medication ("none": []); null when it names none this version knows.
  function cleanMedications(list, medication) {
    if (Array.isArray(list)) {
      const ids = [...new Set(list)].filter(id => Object.hasOwn(MEDICATIONS, id));
      return ids.length || !list.length ? ids : null;
    }
    return medication === "none" ? [] : Object.hasOwn(MEDICATIONS, medication) ? [medication] : null;
  }
  const listOf = v => (Array.isArray(v) ? v : []);
  // Start-up info's answers in a save, { medication: true|false, dosing } in the file (7.600 on; undefined from an older
  // copy, which leaves ours as they are): whether the medication question was answered there, its answer if this version
  // knows it (meds: the save's medications, [] for none; else null), and the version of the dosing questions
  // answered (0: never). Once asked on one device, asked on all; the version only grows.
  function cleanAsked(a, meds) {
    if (!a || typeof a !== "object") return undefined;
    const asked = a.medication === true;
    return { medication: asked, answer: asked && meds ? meds : null, dosing: askedVersion(a.dosing) };
  }
  const askedVersion = v => (Number.isInteger(v) && v >= 0 && v < 100 ? v : 0);
  // Two saves' answers: asked on either, asked (the first one's answer where both have one; a device that answered keeps
  // its own anyway, applyBackup); the dosing questions by the later version. One undefined (an older copy's): the other's.
  const joinAsked = (a, b) => (a && b ? { medication: a.medication || b.medication, answer: a.answer || b.answer, dosing: Math.max(a.dosing, b.dosing) } : a || b);

  // A dosing plan or vial from storage or a backup, or null if it's unusable. Each is for one medication, and keeps
  // when it was saved: where two of a medication's meet, the more recent one wins (perMed).
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
  // Dosing plans (or vials) joined, one per medication, each the most recently saved of that medication's (the later list's
  // on a tie); nulls passed over. A save's list (10.137 on) with its one plan, what an older copy saves.
  function perMed(...lists) {
    const by = new Map();
    lists.flat().forEach(x => { if (x) by.set(x.medication, latest(by.get(x.medication), x)); });
    return [...by.values()];
  }

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
    // Each medication's dosing plan and vial (10.137 on), the one kept before carried over into them.
    S.profile.dosePlans = perMed(listOf(S.profile.dosePlans).map(cleanDosePlan), cleanDosePlan(S.profile.dosePlan));
    S.profile.vials = perMed(listOf(S.profile.vials).map(cleanVial), cleanVial(S.profile.vial));
    delete S.profile.dosePlan;
    delete S.profile.vial;
    S.profile.paceGoal = cleanPaceGoal(S.profile.paceGoal);
    S.profile.sites = cleanSites(S.profile.sites);
    S.profile.skipSites = cleanSkips(S.profile.skipSites) ?? null;
    // Older versions only asked "Do you take Tirzepatide?"; carry that answer over.
    if ("usesTirzepatide" in S.profile) {
      if (!S.profile.medication) S.profile.medication = S.profile.usesTirzepatide === false ? "none" : LEGACY_MEDICATION;
      if (S.profile.usesTirzepatideAsked) S.profile.medicationAsked = true;
      delete S.profile.usesTirzepatide;
      delete S.profile.usesTirzepatideAsked;
      A.store.set("profile", JSON.stringify(S.profile));
    }
    // The medications taken (10.137 on), from the one medication answered before; Tirzepatide until answered.
    S.profile.medications = cleanMedications(S.profile.medications) ?? cleanMedications(undefined, S.profile.medication) ?? [LEGACY_MEDICATION];

    // Saved data goes through the same cleanup as imports (as the schema it was
    // saved in, noted since v4), so damaged storage can't break the app; write
    // it back if anything had to change.
    const storedEntries = A.store.get("entries"), storedGoals = A.store.get("goals"), storedGone = A.store.get("gone");
    const clean = normalizeBackup({ unit: S.unit, schemaVersion: S.profile.schemaVersion || 3, entries: A.store.json("entries"), goals: A.store.json("goals"), goalsAsEntered: A.store.json("goalsAsEntered"), gone: A.store.json("gone") }, S.unit);
    S.entries = clean.entries;
    S.goals = clean.goals;
    S.goalsAsEntered = clean.goalsAsEntered; // (stored with the next change)
    S.gone = clean.gone;
    S.retinoids = A.cleanRetinoids(A.store.json("retinoids")) || { regimens: [], log: [] };
    if (A.store.get("retinoidSnooze") !== null) A.store.remove("retinoidSnooze"); // the old retinoid pop-up's "Not yet"s (this device's), gone with it (9.037)
    if (storedEntries !== null && (storedEntries !== JSON.stringify(S.entries) || storedGoals !== JSON.stringify(S.goals))) {
      A.store.set("entries", JSON.stringify(S.entries));
      A.store.set("goals", JSON.stringify(S.goals));
    }
    if (storedGone !== null && storedGone !== JSON.stringify(S.gone)) A.store.set("gone", JSON.stringify(S.gone));
    // A weigh-in or dose set again here after its day was deleted, whose stamp an older tab took away (7.600 drops them):
    // back above its marker, or the next combine would take it as deleted (in memory; kept with the next change).
    const marks = new Map(S.gone.map(g => [g.date, g]));
    S.entries = S.entries.map(e => {
      const m = marks.get(e.date) || {}, wu = hasWeight(e) && m.wu >= (e.wu || 0) ? m.wu + 1 : e.wu, doses = dosesOf(e);
      const later = doses.map(d => (m.du >= (d.du || 0) ? { ...d, du: m.du + 1 } : d));
      return wu === e.wu && later.every((d, i) => d === doses[i]) ? e : day(e.date, e.weight, later, wu, e.typed);
    });
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
      medication: A.medications()[0] || "none", // what older copies read: the first medication's, and its plan and vial
      medications: A.medications(), // the medications taken (10.137 on)
      dosePlan: A.planFor(A.medications()[0]),
      dosePlans: S.profile.dosePlans, // each medication's (10.137 on)
      vial: A.vialFor(A.medications()[0]),
      vials: S.profile.vials,
      paceGoal: S.profile.paceGoal,
      sites: S.profile.sites,
      skipSites: S.profile.skipSites,
      asked: { medication: !!S.profile.medicationAsked, dosing: askedVersion(S.profile.dosingAsked) }, // start-up info's answers
      retinoids: S.retinoids, // the non-daily treatments and the days taken (treatments.js)
      entries: S.entries,
      gone: S.gone, // deleted days' markers (7.601 on)
      goals: S.goals,
      goalsAsEntered: S.goalsAsEntered, // each goal as typed (8.812 on): what goals is shown from, in either unit
      cumulativeDoseMgByMedication: A.cumulativeDoseMg() // derived totals for reference; not read on import
    };
  }

  // Swaps in cleaned backup data (from Import JSON or the sync folder) for all
  // entries and goals. A backupUnit answers the Units question with the backup's.
  function applyBackup(clean, backupUnit) {
    if (backupUnit) S.unit = S.profile.unit = backupUnit;
    S.entries = clean.entries;
    S.gone = clean.gone; // an older backup has none
    S.goals = clean.goals;
    S.goalsAsEntered = goalsAsEntered(clean.goals, S.unit, clean.goalsAsEntered);
    if (clean.name) S.profile.name = clean.name; // older backups have no name; keep ours
    if (clean.paceGoal) S.profile.paceGoal = clean.paceGoal; // nor a pace goal
    if (clean.sites) S.profile.sites = clean.sites; // nor injection sites
    if (clean.skipSites !== undefined) S.profile.skipSites = clean.skipSites; // nor skips
    // Each medication's most recently saved dosing plan and vial are kept, so an older backup
    // never brings back an old vial's concentration.
    S.profile.dosePlans = perMed(S.profile.dosePlans, clean.dosePlans);
    S.profile.vials = perMed(S.profile.vials, clean.vials);
    // Start-up info answered on another device: asked there, asked here, taking its answer if this device had none…
    const asked = clean.asked, took = !!(asked && asked.answer && !S.profile.medicationAsked), answered = took || !!S.profile.medicationAsked;
    if (took) {
      A.setMedications(asked.answer);
      S.profile.medicationAsked = true;
    }
    // Dose entries prove a medication is in use, so that start-up question is answered (with the backup's own
    // medications, else its latest dose's medication) — not over an answer just taken (None).
    const lastDose = S.entries.filter(hasDose).pop();
    if (lastDose && !took && (!S.profile.medicationAsked || !A.medicationEnabled())) {
      const med = dosesOf(lastDose).pop().medication;
      A.setMedications(clean.medications && clean.medications.length ? clean.medications : [Object.hasOwn(MEDICATIONS, med) ? med : LEGACY_MEDICATION]);
      S.profile.medicationAsked = true;
    }
    // …and the dosing questions by the later version answered, if this device's medication question was answered, by itself
    // or by the save (one a dose answered just now, or none, leaves the dosing questions to be asked).
    if (asked && answered && asked.dosing > askedVersion(S.profile.dosingAsked)) S.profile.dosingAsked = asked.dosing;
    if (clean.retinoids) S.retinoids = A.mergeRetinoids(S.retinoids, clean.retinoids); // record by record; none in the file: ours
  }

  // Replaces all entries and goals with the backup's (raw: its parsed JSON), after
  // validating it first so a bad file never changes anything, and asking first
  // (unless ask is false: Import all already did) if there's data to lose. True once it's in.
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
    if (ask && S.entries.length && !K.backup.ask(A, raw, `Replace your ${count(S.entries.length)} and goals with the ${count(clean.entries.length)} in this backup?`)) return;
    const was = { entries: new Map(S.entries.map(e => [e.date, e])), gone: S.gone };
    // Its retinoids too are a change made here now: where both have a record, the backup's wins; the ones it lacks stay.
    if (clean.retinoids) {
      const ours = new Map(S.retinoids.regimens.concat(S.retinoids.log).map(x => [x.id, x]));
      const restamp = list => list.map(x => ({ ...x, u: Math.max(x.u, A.stampAbove(ours.get(x.id))) }));
      clean.retinoids = { regimens: restamp(clean.retinoids.regimens), log: restamp(clean.retinoids.log) };
    }
    applyBackup(clean, backupUnit);
    // An import is a change made here now: its days win over older changes elsewhere, and a day deleted since that it
    // brings back stays (each part stamped above every version of it known here: this device's, the backup's, and
    // their markers, which stay); a day deleted here that the backup doesn't have stays deleted.
    S.gone = joinGone([was.gone, S.gone]);
    const marks = new Map(S.gone.map(g => [g.date, g]));
    S.entries = S.entries.map(e => {
      const old = was.entries.get(e.date), mark = marks.get(e.date), oldDoses = old ? dosesOf(old) : [];
      return day(e.date, e.weight, dosesOf(e).map(d => ({ ...d, du: above(d, ...oldDoses, mark, "du") })), hasWeight(e) ? above(e, old, mark, "wu") : 0, e.typed);
    });
    save(false);
    S.currentPage = 1;
    A.renderOneTimeInfo();
    A.renderAll();
    return true;
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // Combines two versions changed separately, day by day and part by part (the weigh-in; each medication's dose with its
  // site): each part takes the later change to it (wu, du; with neither stamped, from before 7.601, or a tie, the
  // more recent save's), and a part only one side has comes along (a day's doses then in the order logged: by du). A marker (gone) deletes the versions of the parts it
  // names up to the stamps it holds, on either side, so a part changed after them (on a device that hadn't seen the
  // deletion, or set again) stays. Every goal from either is kept. Gives the same result on every device, so two devices
  // combining at once still agree.
  function mergeVersions(a, b) {
    const [older, newer] = a.savedAt + a.device > b.savedAt + b.device ? [b, a] : [a, b];
    const gone = joinGone([older.gone, newer.gone]), marks = new Map(gone.map(g => [g.date, g])), days = new Map();
    // A day's parts that outlive the markers: { w: the entry if its weigh-in does, d: its doses that do }.
    const none = { w: null, d: [] };
    const parts = e => { const m = marks.get(e.date) || {}; return { w: hasWeight(e) && !(m.wu >= (e.wu || 0)) ? e : null, d: dosesOf(e).filter(x => !(m.du >= (x.du || 0))) }; };
    older.entries.forEach(e => days.set(e.date, { o: parts(e), n: none }));
    newer.entries.forEach(e => { (days.get(e.date) || days.set(e.date, { o: none }).get(e.date)).n = parts(e); });
    const later = (o, n, k) => (!o ? n : !n ? o : (o[k] || 0) > (n[k] || 0) ? o : n); // the newer save's on a tie
    const entries = [...days].map(([date, { o, n }]) => {
      const w = later(o.w, n.w, "wu"), meds = [...new Set(n.d.concat(o.d).map(x => x.medication))];
      const doses = meds.map(med => {
        const a = o.d.find(x => x.medication === med), b = n.d.find(x => x.medication === med), d = later(a, b, "du"), x = d === b ? a : b;
        // (the same dose without a site keeps the other's: a copy older than sites drops them)
        return { ...d, site: d.site ?? (x && x.doseMg === d.doseMg ? x.site : null) ?? null };
      }).sort((a, b) => (a.du || 0) - (b.du || 0));
      if (!w && !doses.length) return null;
      return day(date, w ? w.weight : null, doses, w ? w.wu : 0, w ? w.typed : null);
    }).filter(Boolean).sort(byDate);
    return {
      entries,
      gone,
      goals: [...new Set(older.goals.concat(newer.goals))].sort((x, y) => y - x),
      goalsAsEntered: newer.goalsAsEntered.concat(older.goalsAsEntered), // each goal's (applyBackup picks them out)
      name: newer.name || older.name,
      dosePlans: perMed(older.dosePlans, newer.dosePlans),
      vials: perMed(older.vials, newer.vials),
      paceGoal: newer.paceGoal || older.paceGoal,
      sites: newer.sites || older.sites,
      // The newer save's skips whenever it knows them: a device that logged the dose (and so forgot them) wins.
      skipSites: newer.skipSites === undefined ? older.skipSites : newer.skipSites,
      asked: joinAsked(newer.asked, older.asked),
      retinoids: A.mergeRetinoids(older.retinoids, newer.retinoids)
    };
  }
  // The answers count only as asked or not, and the dosing version: each device keeps its own medication answer, so two
  // different ones never keep the devices saving back and forth. stamps: false leaves out the days' stamps and markers
  // (an older copy's save has none: it isn't set apart by them alone, as for the answers); meds: the medications whose
  // plans and vials count, and only each day's first dose (an older copy's save, before 10.137, has only those).
  function dataKey(d, stamps = true, meds = null) {
    const doses = e => (meds ? dosesOf(e).slice(0, 1) : dosesOf(e)).map(x => [x.doseMg, x.medication, x.site].concat(stamps ? [x.du || 0] : []));
    const only = list => (meds ? list.filter(x => meds.includes(x.medication)) : list);
    return JSON.stringify([d.entries.map(e => [e.date, e.weight, doses(e)].concat(stamps ? [e.wu || 0] : [])),
      stamps ? d.gone : [], d.goals, d.name, only(d.dosePlans), only(d.vials), d.paceGoal, d.sites, d.skipSites, d.asked && [d.asked.medication, d.asked.dosing], d.retinoids]);
  }

  // A save from the folder, taken whole (replace) or combined with ours; see core/sync.js.
  function combine(raw, { replace, plain, mine, theirs }) {
    // Taking a save whole can answer Units, as an import does; combining keeps ours.
    const backupUnit = replace && !S.profile.unit && (raw.unit === "kg" || raw.unit === "lb") ? raw.unit : "";
    const their = normalizeBackup(raw, backupUnit || S.unit);
    if (plain && !their.entries.length) return null;
    const ours = { entries: S.entries, gone: S.gone, goals: S.goals, goalsAsEntered: S.goalsAsEntered, name: S.profile.name, dosePlans: S.profile.dosePlans, vials: S.profile.vials, paceGoal: S.profile.paceGoal, sites: S.profile.sites, skipSites: S.profile.skipSites, retinoids: S.retinoids,
      asked: { medication: !!S.profile.medicationAsked, answer: S.profile.medicationAsked ? A.medications() : null, dosing: askedVersion(S.profile.dosingAsked) } };
    const next = replace // as on import: each medication's later dosing plan and vial, and the answers of both
      ? { ...their, dosePlans: perMed(ours.dosePlans, their.dosePlans), vials: perMed(ours.vials, their.vials), asked: joinAsked(ours.asked, their.asked),
        retinoids: A.mergeRetinoids(ours.retinoids, their.retinoids) }
      : mergeVersions({ ...ours, ...mine }, { ...their, ...theirs });
    const stamps = Array.isArray(raw.gone); // a save from 7.601 on: its days' stamps and markers count
    // A save from before 10.137 has only each day's first dose, and one plan and vial: only those count.
    const meds = Array.isArray(raw.medications) ? null : their.dosePlans.concat(their.vials).map(x => x.medication);
    return {
      // An older copy's save says nothing of the answers, nor of the days' stamps and markers, so they alone don't set
      // ours apart from it (saving ours back for it would stamp them newer than that copy's next change, which a combine
      // would then lose).
      same: dataKey(next, stamps, meds) === dataKey({ ...their, ...(their.asked ? {} : { asked: next.asked }), ...(their.retinoids ? {} : { retinoids: next.retinoids }) }, stamps, meds),
      apply() {
        const kept = { name: next.name || S.profile.name, paceGoal: next.paceGoal || S.profile.paceGoal, sites: next.sites || S.profile.sites,
          skipSites: next.skipSites === undefined ? S.profile.skipSites : next.skipSites, retinoids: next.retinoids || S.retinoids };
        if (!backupUnit && dataKey({ ...next, ...kept }) === dataKey(ours)) return false; // nothing new here
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
    hasData: () => S.entries.length > 0 || S.gone.length > 0 || S.retinoids.regimens.length > 0, // markers too: a device that deleted every day still combines
    importBackup, combine, afterSync
  };
  Object.assign(A, { persist, save, setDay, forget, normalizeBackup, cleanPaceGoal, askedVersion });
})(Kyoshi, Kyoshi.apps.bosco);
