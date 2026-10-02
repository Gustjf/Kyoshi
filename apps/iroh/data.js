/* Iroh · data.js — the saved data: loading, cleaning, saving, backups, and combining with other devices'
 * saves. A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js (folder sync) use.
 * Storage keys (A.store): areas, goals; sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_NAME, MAX_VISION, MAX_TITLE, MAX_WHY, MAX_NEXT, MAX_HOURS_WEEK, MAX_HOURS_TOTAL,
    cleanLine, cleanText, cleanHours, isSeason, isYear, live } = A;
  const LISTS = ["areas", "goals"];
  const STATUSES = ["open", "done", "dropped"];
  const MAX_MS = 8.64e15; // the last moment a date can hold

  const persist = () => LISTS.forEach(k => A.store.set(k, JSON.stringify(S[k])));

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  const idOf = v => (typeof v === "string" && v ? v.slice(0, 40) : "");
  const atOf = v => (isPos(v) && v < MAX_MS ? v : 0); // when it was added: the order within its list

  // Saved or imported areas in the current shape; anything unusable is dropped, so a damaged file can't
  // break the app. A deleted one keeps only what sync needs. New areas are made through here too, so every
  // copy has the same shape (two copies compare alike).
  function cleanAreas(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(a => {
      const gone = a.deleted === true;
      return {
        id: idOf(a.id) || newId(),
        name: gone ? "" : cleanLine(a.name, MAX_NAME),
        vision: gone ? "" : cleanText(a.vision, MAX_VISION),         // the picture in 10 years
        milestones: gone ? "" : cleanText(a.milestones, MAX_VISION), // the milestones 5 years out
        order: isNum(a.order) ? a.order : 0,                         // its place in Vision
        deleted: gone,
        at: atOf(a.at),
        u: isPos(a.u) ? a.u : 0
      };
    }).filter(a => (a.name || a.deleted) && !ids.has(a.id) && ids.add(a.id));
  }

  // Saved or imported goals, the same way. A goal's period is a year ("2027") or a season ("2026-fall"); it has
  // hours a week or in total (one, or neither).
  function cleanGoals(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(g => {
      const gone = g.deleted === true, hoursWeek = gone ? 0 : cleanHours(g.hoursWeek, MAX_HOURS_WEEK);
      return {
        id: idOf(g.id) || newId(),
        areaId: gone ? "" : idOf(g.areaId),
        period: !gone && (isSeason(g.period) || isYear(g.period)) ? g.period : "",
        title: gone ? "" : cleanLine(g.title, MAX_TITLE),
        why: gone ? "" : cleanText(g.why, MAX_WHY),
        doneWhen: gone ? "" : cleanText(g.doneWhen, MAX_WHY),
        parentId: gone ? "" : idOf(g.parentId),        // a season goal's year goal
        hoursWeek,
        hoursTotal: gone || hoursWeek ? 0 : cleanHours(g.hoursTotal, MAX_HOURS_TOTAL),
        next: gone ? "" : cleanLine(g.next, MAX_NEXT), // the next step
        reconciled: !gone && isDate(g.reconciled) ? g.reconciled : "",
        status: !gone && STATUSES.includes(g.status) ? g.status : "open",
        deleted: gone,
        at: atOf(g.at),
        u: isPos(g.u) ? g.u : 0
      };
    }).filter(g => ((g.title && g.period) || g.deleted) && !ids.has(g.id) && ids.add(g.id));
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    S.areas = cleanAreas(A.store.json("areas"));
    S.goals = cleanGoals(A.store.json("goals"));
  }

  // An Iroh backup or sync file: areas and goals. Momo's backups keep "goals" too, but no areas.
  const looksLike = raw => Array.isArray(raw.areas) && Array.isArray(raw.goals);

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, areas: S.areas, goals: S.goals };
  }

  // Replaces everything with the backup's areas and goals, after checking it has some (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anything to
  // lose. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) return alert("That file doesn't look like an Iroh backup.");
    const areas = cleanAreas(raw.areas), goals = cleanGoals(raw.goals);
    const count = (a, g) => `${a} area${a === 1 ? "" : "s"} and ${g} goal${g === 1 ? "" : "s"}`;
    const theirs = [live(areas).length, live(goals).length], mine = [A.liveAreas().length, A.liveGoals().length];
    if (!theirs[0] && !theirs[1]) return alert("That backup has no areas or goals in it, so nothing was changed.");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Iroh. Importing it anyway, but some data may not carry over.");
    }
    if (ask && (mine[0] || mine[1]) && !confirm(`Replace your ${count(...mine)} with the ${count(...theirs)} in this backup? This can't be undone.`)) return;
    S.areas = areas;
    S.goals = goals;
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // A save from the sync folder (see core/sync.js): taken whole, or combined with ours item by item (list by
  // list), the later change winning, in the order they were added. The same on every device, so two combining
  // at once agree.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  function merge(mine, theirs) {
    const byId = new Map(mine.map(i => [i.id, i]));
    theirs.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
    return inOrder([...byId.values()]);
  }
  const dataKey = d => JSON.stringify(LISTS.map(k => inOrder(d[k])));
  function combine(raw, { replace, plain }) {
    const their = { areas: cleanAreas(raw.areas), goals: cleanGoals(raw.goals) };
    if (plain && !their.areas.length && !their.goals.length) return null;
    const next = replace ? their : { areas: merge(S.areas, their.areas), goals: merge(S.goals, their.goals) };
    return {
      same: dataKey(next) === dataKey(their),
      apply() {
        if (dataKey(next) === dataKey(S)) return false; // nothing new here
        S.areas = next.areas;
        S.goals = next.goals;
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
  A.data = { schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike, hasData: () => S.areas.length > 0 || S.goals.length > 0, importBackup, combine, afterSync };
  Object.assign(A, { save, cleanAreas, cleanGoals });
})(Kyoshi, Kyoshi.apps.iroh);
