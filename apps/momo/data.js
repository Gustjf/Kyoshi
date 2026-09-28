/* Momo · data.js — Momo's saved data: loading (and, on the first open, bringing in what the
 * standalone Momo left in this browser), cleaning, saving with undo, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use — not to be confused with A.S.data, Momo's data itself.
 * Storage keys (A.store): data, sync (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isNum, isPos, isObj, newId } = K.util;
  const { DAY_HOURS, STEP, POSITIONS, OLD_COLORS, MAX_GOAL_HOURS, GOAL_MAX_WEEK, UNDO_MAX, DATA_SCHEMA_VERSION,
    snap, clampHours, cleanText, isDueDate, isWeekKey, thisWeekKey, nextWeekKey } = A;

  const STANDALONE_KEY = "momoData_v1"; // the standalone Momo's data: read (never changed) on the first open in Kyoshi

  const persist = () => A.store.set("data", JSON.stringify(S.data));
  function remember() {
    S.lastSavedJSON = JSON.stringify(S.data);
    S.lastSaved = JSON.parse(S.lastSavedJSON);
  }

  // Stamps each week, the baseline, each goal and each colour that changed
  // since the last save with the time, so sync knows which side's copy is newer.
  function stampChanges(prev) {
    if (!prev) return;
    const data = S.data, now = Date.now(), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    Object.keys(data.weeks).forEach(k => { if (!same(data.weeks[k], prev.weeks[k])) data.weeks[k].u = now; });
    if (!same(data.baseline, prev.baseline)) data.baseline.u = now;
    const old = new Map(prev.goals.map(g => [g.id, g]));
    data.goals.forEach(g => { if (!same(g, old.get(g.id))) g.u = now; });
    const had = prev.colors || {};
    Object.keys(data.colors).forEach(k => { if (!same(data.colors[k], had[k])) data.colors[k].u = now; });
  }

  // Keeps a change made on this device, with colours for any new titles: the
  // previous version goes on the undo list, then it's stored locally and
  // autosaved to the sync folder (which, when on, stands in for Export JSON).
  // Returns false if nothing actually changed.
  function save({ undo = true } = {}) {
    A.ensureColors();
    if (JSON.stringify(S.data) === S.lastSavedJSON) return false;
    stampChanges(S.lastSaved);
    if (undo && S.lastSavedJSON) {
      S.undoStack.push(S.lastSavedJSON);
      if (S.undoStack.length > UNDO_MAX) S.undoStack.shift();
    }
    remember();
    store();
    return true;
  }

  // Writes the current data out: locally, then (through Kyoshi) counted for sync
  // and autosaved. In test mode (time travel) Kyoshi keeps it in memory.
  function store(unsaved = true) {
    persist();
    A.changed(unsaved);
  }

  /**
   * Cleans backup (or saved) data into the current shape. Cards without a
   * title or valid hours, and goals without a name or target, are dropped, as
   * are unknown fields; hours are put on the 15-minute grid. Damaged storage
   * or a hand-edited file can't break the app this way.
   */
  function cleanCard(c, allowParked) {
    if (!isObj(c)) return null;
    const title = typeof c.title === "string" ? cleanText(c.title) : "";
    if (!title || !isPos(c.hours)) return null;
    const onDay = Number.isInteger(c.day) && c.day >= 0 && c.day <= 6;
    if (!onDay && !allowParked) return null;
    const parentId = typeof c.parentId === "string" && c.parentId ? c.parentId.slice(0, 40) : null;
    return {
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : newId(),
      title,
      hours: clampHours(c.hours),
      day: onDay ? c.day : null,
      goalId: typeof c.goalId === "string" && c.goalId ? c.goalId.slice(0, 40) : null,
      base: c.base === true,
      parentId,
      pos: POSITIONS.includes(c.pos) ? c.pos : "bottom", // where cards inside one showed before positions
      pin: onDay && !parentId && isNum(c.pin) && c.pin >= 0 && c.pin < DAY_HOURS ? Math.min(DAY_HOURS - STEP, snap(c.pin)) : null
    };
  }
  function cleanCards(list, allowParked) {
    const ids = new Set();
    const cards = (Array.isArray(list) ? list : []).map(c => cleanCard(c, allowParked)).filter(Boolean).map(c => {
      if (ids.has(c.id)) c.id = newId();
      ids.add(c.id);
      return c;
    });
    A.tidyNesting({ cards });
    return cards;
  }
  const cleanU = u => (isPos(u) ? u : 0);
  function cleanGoal(g) {
    if (!isObj(g) || typeof g.id !== "string" || !g.id) return null;
    const name = typeof g.name === "string" ? cleanText(g.name) : "";
    const perWeek = isPos(g.perWeek) ? Math.min(7 * DAY_HOURS, Math.max(STEP, snap(g.perWeek))) : 0;
    if (!name || !(isPos(g.target) || perWeek)) return null;
    const log = {}; // a week can't hold more than its 168 hours
    if (isObj(g.log)) Object.keys(g.log).forEach(k => {
      const h = isPos(g.log[k]) ? Math.min(7 * DAY_HOURS, snap(g.log[k])) : 0;
      if (isWeekKey(k) && h > 0) log[k] = h;
    });
    return {
      id: g.id.slice(0, 40),
      name,
      target: perWeek ? 0 : Math.min(MAX_GOAL_HOURS, Math.max(STEP, snap(g.target))),
      perWeek,
      start: isNum(g.start) ? Math.min(MAX_GOAL_HOURS, Math.max(-MAX_GOAL_HOURS, snap(g.start))) : 0,
      due: !perWeek && isDueDate(g.due) ? g.due : "",
      maxWeek: isPos(g.maxWeek) ? Math.min(7 * DAY_HOURS, Math.max(STEP, snap(g.maxWeek))) : GOAL_MAX_WEEK,
      log,
      deleted: g.deleted === true,
      u: cleanU(g.u)
    };
  }
  function normalizeData(raw) {
    const out = A.emptyData();
    if (!isObj(raw)) return out;
    if (isObj(raw.weeks)) {
      Object.keys(raw.weeks).sort().forEach(k => {
        const w = raw.weeks[k];
        if (isWeekKey(k) && isObj(w)) out.weeks[k] = { cards: cleanCards(w.cards, true), closed: w.closed === true, u: cleanU(w.u) };
      });
    }
    if (isObj(raw.baseline)) out.baseline = { cards: cleanCards(raw.baseline.cards, false), u: cleanU(raw.baseline.u) };
    const ids = new Set();
    out.goals = (Array.isArray(raw.goals) ? raw.goals : []).map(cleanGoal).filter(g => g && !ids.has(g.id) && ids.add(g.id));
    out.colors = isObj(raw.colors) ? cleanColors(raw.colors) : oldColors(raw, out);
    return out;
  }
  // Colours as saved, in key order; ensureColors sorts out any two keys with the same one.
  function cleanColors(raw) {
    const out = {};
    Object.keys(raw).sort().forEach(k => {
      const e = raw[k];
      if (/^[tg]:./.test(k) && k.length <= 200 && isObj(e) && A.isColor(e.c)) out[k] = { c: e.c, u: cleanU(e.u) };
    });
    return out;
  }
  // Before titles had colours of their own, each card and goal kept one.
  // Each title and goal on show keeps the one most of its cards had (a
  // goal's cards were its colour), unless a title or goal with more cards
  // has it too; the rest get new ones (ensureColors).
  function oldColors(raw, d) {
    const tally = [], live = new Set(d.goals.filter(g => !g.deleted).map(g => g.id)), goalCards = new Map();
    const add = (key, old, n) => {
      const c = Number.isInteger(old) && OLD_COLORS[old], t = c && tally.find(x => x.key === key && x.c === c);
      if (t) t.n += n;
      else if (c) tally.push({ key, c, n });
    };
    const weeks = isObj(raw.weeks) ? raw.weeks : {};
    [raw.baseline, weeks[thisWeekKey()], weeks[nextWeekKey()]].forEach(list => {
      if (isObj(list) && Array.isArray(list.cards)) list.cards.forEach(rc => {
        const c = cleanCard(rc, true);
        if (c && live.has(c.goalId)) goalCards.set(c.goalId, (goalCards.get(c.goalId) || 0) + 1);
        else if (c) add(A.titleKey(c.title, d), rc.color, 1);
      });
    });
    (Array.isArray(raw.goals) ? raw.goals : []).forEach(rg => {
      const g = cleanGoal(rg);
      if (g && live.has(g.id)) add(A.goalKey(g.id), rg.color, 1 + (goalCards.get(g.id) || 0));
    });
    const colors = {}, taken = new Set();
    tally.sort((a, b) => b.n - a.n).forEach(({ key, c }) => {
      if (colors[key] || taken.has(c)) return;
      colors[key] = { c, u: 0 };
      taken.add(c);
    });
    return colors;
  }
  const isMomoData = raw => isObj(raw) && (isObj(raw.weeks) || isObj(raw.baseline) || Array.isArray(raw.goals));

  // Reads everything from storage (at start, and when another tab saved). Saved data goes
  // through the same cleanup as imports; it's written back if anything had to change.
  function load() {
    // First open in Kyoshi: bring in what the standalone Momo left in this browser (on the
    // same site, e.g. GitHub Pages), leaving it as it is.
    if (A.store.get("data") === null) {
      const standalone = K.storage.get(STANDALONE_KEY);
      if (standalone !== null) A.store.set("data", standalone);
    }
    const stored = A.store.get("data");
    S.data = normalizeData(A.store.json("data"));
    A.ensureColors();
    if (stored !== null && stored !== JSON.stringify(S.data)) persist();
    remember();
  }

  // ==========================================================================
  // UNDO — Ctrl/Cmd+Z, or Undo in Developer Mode (for phones), steps back one change.
  // ==========================================================================
  function undo() {
    if (!S.undoStack.length) return;
    S.data = JSON.parse(S.undoStack.pop());
    save({ undo: false });
    A.renderAll();
  }

  // ==========================================================================
  // BACKUPS (Export / Import JSON)
  // ==========================================================================
  function buildBackup() {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      appVersion: A.VERSION,
      weeks: S.data.weeks,
      baseline: S.data.baseline,
      goals: S.data.goals,
      colors: S.data.colors
    };
  }

  // Replaces everything with the backup's data (raw: its parsed JSON), after validating
  // it first so a bad file never changes anything, and asking first (unless ask is
  // false: Import all already did) if there's data to lose.
  function importBackup(raw, ask = true) {
    if (!isMomoData(raw)) return alert("That file doesn't look like a Momo backup: no weeks, baseline or goals found.");
    const clean = normalizeData(raw);
    if (!A.hasData(clean)) return alert("That backup has nothing in it Momo can use.");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Momo. Importing it anyway, but some data may not carry over.");
    }
    if (ask && A.hasData(S.data) && !confirm("Replace everything in Momo — weeks, baseline and goals — with this backup? This can't be undone.")) return;
    S.data = clean;
    A.ensureColors();
    S.undoStack = [];
    remember();
    store(false);
    S.closeOutLater = false;
    A.renderAll();
    A.checkCloseOuts();
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // Combines two versions changed separately: every week, the baseline, every
  // goal and every title's colour is taken from whichever side changed it
  // last, and goal hours logged on either side are all kept. Gives the same
  // result on every device, so two devices combining at once still agree.
  function mergeVersions(a, b) {
    const [older, newer] = a.savedAt + a.device > b.savedAt + b.device ? [b, a] : [a, b];
    const pick = (o, n) => (!o ? n : !n ? o : o.u > n.u ? o : n); // a tie goes to the newer save
    const weeks = {};
    [...new Set(Object.keys(older.weeks).concat(Object.keys(newer.weeks)))].sort().forEach(k => { weeks[k] = pick(older.weeks[k], newer.weeks[k]); });
    const goals = new Map(older.goals.map(g => [g.id, g]));
    newer.goals.forEach(g => {
      const o = goals.get(g.id);
      if (!o) return goals.set(g.id, g);
      const win = pick(o, g), lose = win === o ? g : o;
      goals.set(g.id, { ...win, log: { ...lose.log, ...win.log } });
    });
    const colors = {};
    [older.colors, newer.colors].forEach(side => Object.keys(side).forEach(k => { colors[k] = pick(colors[k], side[k]); }));
    return { weeks, baseline: pick(older.baseline, newer.baseline), goals: [...goals.values()], colors };
  }
  const dataKey = d => JSON.stringify([Object.keys(d.weeks).sort().map(k => [k, d.weeks[k]]), d.baseline, d.goals, d.colors]);

  // A save from the folder, taken whole (replace) or combined with ours; see core/sync.js.
  function combine(raw, { replace, plain, mine, theirs }) {
    const their = normalizeData(raw);
    if (plain && !A.hasData(their)) return null;
    const theirKey = dataKey(their);
    const next = replace ? their : mergeVersions({ ...S.data, ...mine }, { ...their, ...theirs });
    A.ensureColors(next); // titles from either side, and two with the same colour
    return {
      same: dataKey(next) === theirKey,
      apply() {
        if (dataKey(next) === dataKey(S.data)) return false; // nothing new here
        S.data = { weeks: next.weeks, baseline: next.baseline, goals: next.goals, colors: next.colors };
        return true;
      }
    };
  }

  // Other devices' data came in from the folder: keep it, and show it.
  function afterSync() {
    S.undoStack = []; // undo would otherwise step back over the other device's changes
    remember();
    persist();
    A.renderAll();
    A.checkCloseOuts();
  }

  A.load = load;
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION,
    build: buildBackup,
    looksLike: isMomoData,
    hasData: () => A.hasData(S.data),
    importBackup, combine, afterSync
  };
  Object.assign(A, { persist, remember, save, undo, normalizeData });
})(Kyoshi, Kyoshi.apps.momo);
