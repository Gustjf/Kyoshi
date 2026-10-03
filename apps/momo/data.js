/* Momo · data.js — Momo's saved data: loading (and, on the first open, bringing in what the
 * standalone Momo left in this browser), cleaning, saving with undo, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use — not to be confused with A.S.data, Momo's data itself.
 * Storage keys (A.store): data, sync and meetings (core's), and later (closeout.js: the day the close-out was put
 * off, this device's own, never synced or backed up). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isNum, isPos, isObj, isDate, newId } = K.util;
  const { DAY_HOURS, STEP, POSITIONS, OLD_COLORS, MAX_GOAL_HOURS, GOAL_MAX_WEEK, UNDO_MAX, UNDO_MAX_CHARS, DATA_SCHEMA_VERSION, PLAN_MAX,
    snap, clampHours, cleanText, isDueDate, isWeekKey, dayIndex, thisWeekKey, nextWeekKey } = A;

  const STANDALONE_KEY = "momoData_v1"; // the standalone Momo's data: read (never changed) on the first open in Kyoshi
  const APP_ID = /^[a-z][a-z0-9]{0,30}$/; // an app's id, as Kyoshi.register takes it

  const persist = () => A.store.set("data", JSON.stringify(S.data));
  function remember() {
    S.lastSavedJSON = JSON.stringify(S.data);
    S.lastSaved = JSON.parse(S.lastSavedJSON);
  }

  // Stamps each week, the baseline, each goal, each colour, each week's asks and each weekend's plan that
  // changed since the last save with the time, so sync knows which side's copy is newer.
  function stampChanges(prev) {
    if (!prev) return;
    const data = S.data, now = Date.now(), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    Object.keys(data.weeks).forEach(k => { if (!same(data.weeks[k], prev.weeks[k])) data.weeks[k].u = now; });
    if (!same(data.baseline, prev.baseline)) data.baseline.u = now;
    const old = new Map(prev.goals.map(g => [g.id, g]));
    data.goals.forEach(g => { if (!same(g, old.get(g.id))) g.u = now; });
    const had = prev.colors || {};
    Object.keys(data.colors).forEach(k => { if (!same(data.colors[k], had[k])) data.colors[k].u = now; });
    const asked = prev.asks || {};
    Object.keys(data.asks).forEach(k => { if (!same(data.asks[k], asked[k])) data.asks[k].u = now; });
    const planned = prev.weekends || {};
    Object.keys(data.weekends).forEach(k => { if (!same(data.weekends[k], planned[k])) data.weekends[k].u = now; });
  }

  // Keeps a change made on this device, with colours for any new titles: the
  // previous version goes on the undo list, then it's stored locally and
  // autosaved to the sync folder (which, when on, stands in for Export JSON).
  // quiet: Momo's own bookkeeping (a week's asks), which leaves Export JSON as it was and isn't a change of
  // yours for an import's question (core/backup.js).
  // Returns false if nothing actually changed.
  function save({ undo = true, quiet = false } = {}) {
    A.ensureColors();
    if (JSON.stringify(S.data) === S.lastSavedJSON) return false;
    stampChanges(S.lastSaved);
    if (undo && S.lastSavedJSON) {
      S.undoStack.push(S.lastSavedJSON);
      while (S.undoStack.length > UNDO_MAX || (S.undoStack.length > 1 && S.undoStack.length * S.lastSavedJSON.length > UNDO_MAX_CHARS)) S.undoStack.shift();
    }
    remember();
    store(!quiet || K.backup.isUnsaved(A), quiet);
    return true;
  }

  // Writes the current data out: locally, then (through Kyoshi) counted for sync
  // and autosaved. In test mode (time travel) Kyoshi keeps it in memory.
  function store(unsaved = true, quiet = false) {
    persist();
    A.changed(unsaved, quiet);
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
    // Another app's card (model.js): its app's id, and the need it's for or the slot of its routine it keeps, both that app's.
    const app = typeof c.app === "string" && APP_ID.test(c.app) ? c.app : null;
    const appKey = k => (app && typeof k === "string" && k.startsWith(`${app}:`) && k.length > app.length + 1 ? k.slice(0, 100) : null);
    const need = appKey(c.need), slot = appKey(c.slot);
    return {
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : newId(),
      title,
      hours: clampHours(c.hours),
      day: onDay ? c.day : null,
      goalId: typeof c.goalId === "string" && c.goalId ? c.goalId.slice(0, 40) : null,
      base: c.base === true,
      parentId,
      pos: POSITIONS.includes(c.pos) ? c.pos : "bottom", // where cards inside one showed before positions
      pin: onDay && !parentId && isNum(c.pin) && c.pin >= 0 && c.pin < DAY_HOURS ? Math.min(DAY_HOURS - STEP, snap(c.pin)) : null,
      need,
      app,
      auto: (!!need || !!slot) && c.auto === true,
      slot,
      fixed: !!app && c.fixed === true
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
  // The times other apps' events were moved to in a week (see model.js): null when there's none.
  function cleanEvents(raw) {
    const out = {};
    if (isObj(raw)) Object.keys(raw).sort().forEach(k => {
      const e = raw[k];
      if (/^[\w-]+:./.test(k) && k.length <= 120 && isObj(e) && isNum(e.at) && e.at >= 0 && e.at < DAY_HOURS) out[k] = { at: Math.min(DAY_HOURS - STEP, snap(e.at)) };
    });
    return Object.keys(out).length ? out : null;
  }
  // The hours a closed week's close-out logged by title (see model.js): each title once, any case (the
  // first spelling kept), on the 15-minute grid, at most the week's 168 hours. Kept even when empty: the
  // week was reviewed and nothing was done.
  function cleanSpent(raw) {
    const out = {}, spelt = new Map();
    Object.keys(raw).forEach(k => {
      const title = cleanText(k), h = isPos(raw[k]) ? snap(raw[k]) : 0, low = title.toLowerCase();
      if (!title || h <= 0) return;
      if (!spelt.has(low)) spelt.set(low, title);
      const t = spelt.get(low);
      out[t] = Math.min(7 * DAY_HOURS, (out[t] || 0) + h);
    });
    return out;
  }
  // What the apps asked of each week, by app and block title (see model.js): minutes, each title once (any case, the
  // first spelling kept), "<app>|" (no title) for an app's own cards, in key order; a week that asked nothing keeps its
  // empty record (it counts 0 in the average). Older files simply have none.
  function cleanAsks(raw) {
    const out = {};
    if (isObj(raw)) Object.keys(raw).sort().forEach(k => {
      const w = raw[k], by = {}, spelt = new Map();
      if (!isWeekKey(k) || !isObj(w) || !isObj(w.by)) return;
      Object.keys(w.by).forEach(ak => {
        const bar = ak.indexOf("|"), app = ak.slice(0, bar), title = cleanText(ak.slice(bar + 1)), m = w.by[ak], low = `${app}|${title.toLowerCase()}`;
        if (!APP_ID.test(app) || (!title && ak !== `${app}|`) || !isPos(m)) return;
        if (!spelt.has(low)) spelt.set(low, `${app}|${title}`);
        const key = spelt.get(low);
        by[key] = Math.min(100000, (by[key] || 0) + Math.round(m));
      });
      out[k] = { by: Object.fromEntries(Object.keys(by).sort().map(x => [x, by[x]])), u: cleanU(w.u) };
    });
    return out;
  }
  // Each weekend's plan by its Saturday (see model.js), in key order: one line, at most PLAN_MAX characters; "" once
  // cleared (with its time, so the clearing wins over an older copy's plan). Older files simply have none.
  function cleanWeekends(raw) {
    const out = {};
    if (isObj(raw)) Object.keys(raw).sort().forEach(k => {
      const w = raw[k], plan = isObj(w) && typeof w.plan === "string" ? cleanText(w.plan, PLAN_MAX) : "";
      if (isDate(k) && dayIndex(k) === 5 && isObj(w) && (plan || isPos(w.u))) out[k] = { plan, u: cleanU(w.u) };
    });
    return out;
  }
  function normalizeData(raw) {
    const out = A.emptyData();
    if (!isObj(raw)) return out;
    if (isObj(raw.weeks)) {
      Object.keys(raw.weeks).sort().forEach(k => {
        const w = raw.weeks[k], events = isObj(w) && cleanEvents(w.events), spent = isObj(w) && w.closed === true && isObj(w.spent) && cleanSpent(w.spent);
        if (isWeekKey(k) && isObj(w)) out.weeks[k] = { cards: cleanCards(w.cards, true), closed: w.closed === true, u: cleanU(w.u), ...(events ? { events } : {}), ...(spent ? { spent } : {}) };
      });
    }
    if (isObj(raw.baseline)) out.baseline = { cards: cleanCards(raw.baseline.cards, false), u: cleanU(raw.baseline.u) };
    const ids = new Set();
    out.goals = (Array.isArray(raw.goals) ? raw.goals : []).map(cleanGoal).filter(g => g && !ids.has(g.id) && ids.add(g.id));
    out.colors = isObj(raw.colors) ? cleanColors(raw.colors) : oldColors(raw, out);
    out.asks = cleanAsks(raw.asks);
    out.weekends = cleanWeekends(raw.weekends);
    return out;
  }
  // Colours as saved (a title's, an old goal's or an app's: colors.js), in key order; ensureColors sorts out any two keys
  // with the same one.
  function cleanColors(raw) {
    const out = {};
    Object.keys(raw).sort().forEach(k => {
      const e = raw[k];
      if ((/^[tg]:./.test(k) || (k.startsWith("a:") && APP_ID.test(k.slice(2)))) && k.length <= 200 && isObj(e) && A.isColor(e.c)) out[k] = { c: e.c, u: cleanU(e.u) };
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
    A.placeCards(); // what's set in other apps heals at once (their slots, their dated cards)
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
      colors: S.data.colors,
      asks: S.data.asks,
      weekends: S.data.weekends
    };
  }

  // Replaces everything with the backup's data (raw: its parsed JSON), after validating
  // it first so a bad file never changes anything, and asking first (unless ask is
  // false: Import all already did) if there's data to lose. True once it's in.
  function importBackup(raw, ask = true) {
    if (!isMomoData(raw)) return alert("That file doesn't look like a Momo backup: no weeks or baseline found.");
    const clean = normalizeData(raw);
    if (!A.hasData(clean)) return alert("That backup has nothing in it Momo can use.");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Momo. Importing it anyway, but some data may not carry over.");
    }
    if (ask && A.hasData(S.data) && !K.backup.ask(A, raw, "Replace everything in Momo — your weeks, baseline and weekend plans — with this backup?")) return;
    S.data = clean;
    A.ensureColors();
    S.undoStack = [];
    remember();
    store(false);
    A.clearLater(); // its close-outs come up again
    A.forgetAsks(); // this week's asks are seen afresh, over the backup's
    A.renderAll();
    A.checkCloseOuts(false); // Import all brings Iroh's goals in after Momo's weeks
    return true;
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // Combines two versions changed separately: every week, the baseline, every
  // goal, every title's colour, every week's asks and every weekend's plan is taken from
  // whichever side changed it last, and goal hours logged on either side are all kept. Gives
  // the same result on every device, so two devices combining at once still agree.
  function mergeVersions(a, b) {
    const [older, newer] = a.savedAt + a.device > b.savedAt + b.device ? [b, a] : [a, b];
    const pick = (o, n) => (!o ? n : !n ? o : o.u > n.u ? o : n); // a tie goes to the newer save
    const byKey = (x, y) => { const out = {}; [...new Set(Object.keys(x).concat(Object.keys(y)))].sort().forEach(k => { out[k] = pick(x[k], y[k]); }); return out; };
    const goals = new Map(older.goals.map(g => [g.id, g]));
    newer.goals.forEach(g => {
      const o = goals.get(g.id);
      if (!o) return goals.set(g.id, g);
      const win = pick(o, g), lose = win === o ? g : o;
      goals.set(g.id, { ...win, log: { ...lose.log, ...win.log } });
    });
    const colors = {};
    [older.colors, newer.colors].forEach(side => Object.keys(side).forEach(k => { colors[k] = pick(colors[k], side[k]); }));
    return { weeks: byKey(older.weeks, newer.weeks), baseline: pick(older.baseline, newer.baseline), goals: [...goals.values()], colors, asks: byKey(older.asks || {}, newer.asks || {}),
      weekends: byKey(older.weekends || {}, newer.weekends || {}) };
  }
  const sorted = o => Object.keys(o).sort().map(k => [k, o[k]]);
  const dataKey = d => JSON.stringify([sorted(d.weeks), d.baseline, d.goals, d.colors, sorted(d.asks), sorted(d.weekends)]);

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
        S.data = { weeks: next.weeks, baseline: next.baseline, goals: next.goals, colors: next.colors, asks: next.asks, weekends: next.weekends };
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
    A.checkCloseOuts(false); // Iroh's goals may still be on their way
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
