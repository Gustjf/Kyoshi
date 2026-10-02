/* Iroh · app.js — registers Iroh with Kyoshi, plus its constants (limits, how long a reconcile lasts), state
 * (A.S) and small helpers: text and hours, seasons (keys and labels, the season a day is in, a season's weeks)
 * and lookups (a goal's year goal, area and chain, its hours, Momo's share of them each week).
 * Loads first of the app's files: the others destructure what's here at the top, and call
 * functions from each other as A.name(). File map and data model: apps/iroh/CLAUDE.md. */
(function (K) {
  "use strict";
  const { isNum, fmtNum, dateMs, addDays, daysBetween, fmtShort, todayStr } = K.util;

  const A = K.register({
    id: "iroh",
    name: "Iroh",
    title: "Iroh — Goals",
    subtitle: "Where you're headed: a vision for each part of your life, this year's goals and this season's, with the hours Momo makes time for.",
    width: 780,
    backupNote: "Your goals live only in this browser. Export a backup now and then, or sync to a folder to keep them on other devices too.",
    // Its meetings with you (core/meetings.js), on a schedule: each fills a "Meeting" card in Momo, and an overdue one
    // dots the icon. The season review comes up in each new season's first week.
    meetings: [
      { id: "reconcile", title: "Reconcile the goals", every: "month", minutes: 20 },
      { id: "season", title: "Season review", every: "season", minutes: 60 },
      { id: "year", title: "Re-read the vision, set the year", every: "year", minutes: 120 }
    ],
    // The "compass" icon from Lucide (ISC license) — Iroh is the Dragon of the West — in Fire Nation red.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1,
    MAX_NAME: 30,          // an area's name
    MAX_VISION: 1000,      // an area's 10-year picture, and its 5-year milestones
    MAX_TITLE: 40,         // a goal's title: the title of its cards in Momo
    MAX_WHY: 300,          // a goal's why, and its done-when
    MAX_NEXT: 200,         // a goal's next step
    HOURS_STEP: 0.25,      // hours go in 15-minute steps
    MAX_HOURS_WEEK: 100,
    MAX_HOURS_TOTAL: 2000,
    RECONCILE_DAYS: 30     // a goal last reconciled longer ago than this turns amber
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Saved (CLAUDE.md has the details); deleted ones stay as markers so sync can't bring them back.
    areas: [], // { id, name, vision, milestones, order, deleted, at, u }
    goals: [], // { id, areaId, period, title, why, doneWhen, parentId, hoursWeek, hoursTotal, next, reconciled, status, deleted, at, u }
    // This device only.
    editing: null,     // the goal pop-up: { id ("" for a new one), period, season (a season goal), mode, status, snapshot }
    reconciling: null, // the reconcile pop-up: { id, snapshot }
    areaEditing: null, // the area pop-up: { id ("" for a new one), snapshot }
    knownToday: ""     // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // --- Text and hours ---
  // A line as it's kept: runs of spaces and line breaks become one space, cut to max characters
  // without splitting an emoji.
  const cleanLine = (v, max) => (typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");
  // Text that keeps its lines (a vision, a why): each line's spaces tidied, at most one empty line in a row, cut the same way.
  const cleanText = (v, max) => (typeof v === "string"
    ? [...v.replace(/\r\n?/g, "\n").split("\n").map(l => l.replace(/[^\S\n]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim()].slice(0, max).join("").trim() : "");
  // Hours as kept: on the 15-minute grid, from a quarter of an hour up to max; 0 for none.
  const cleanHours = (h, max) => (isNum(h) && h > 0 ? Math.min(max, Math.max(A.HOURS_STEP, Math.round(h / A.HOURS_STEP) * A.HOURS_STEP)) : 0);
  // "5 h", "1.75 h".
  const fmtHours = h => `${fmtNum(h)} h`;

  // --- Seasons (core/seasons.js): a season's key is "2026-fall", its label "Fall 2026". A year's four are winter,
  // spring, summer and fall: the winter that starts in December belongs to the year most of it falls in, the next
  // one ("2027-winter"). A year goal's period is its year ("2027"). A week belongs to its Monday's season. ---
  const SEASONS = ["winter", "spring", "summer", "fall"];
  const NUMBER = { spring: 0, summer: 1, fall: 2, winter: 3 }; // K.seasons' numbering
  const isSeason = p => typeof p === "string" && /^\d{4}-(winter|spring|summer|fall)$/.test(p);
  const isYear = p => typeof p === "string" && /^\d{4}$/.test(p);
  const yearOf = period => +period.slice(0, 4); // a season's year, or a year's
  const nameOf = key => key.slice(5);
  const seasonsOf = year => SEASONS.map(s => `${year}-${s}`);
  const seasonLabel = key => `${nameOf(key)[0].toUpperCase()}${nameOf(key).slice(1)} ${yearOf(key)}`;
  const nextSeason = key => (nameOf(key) === "fall" ? `${yearOf(key) + 1}-winter` : `${yearOf(key)}-${SEASONS[SEASONS.indexOf(nameOf(key)) + 1]}`);
  // The day a season starts (worked out once each) and its last day.
  const starts = new Map();
  function startOf(key) {
    if (!starts.has(key)) starts.set(key, nameOf(key) === "winter" ? K.seasons.seasonStart(yearOf(key) - 1, 3) : K.seasons.seasonStart(yearOf(key), NUMBER[nameOf(key)]));
    return starts.get(key);
  }
  const endOf = key => addDays(startOf(nextSeason(key)), -1);
  // The season a day falls in: the latest to start on or before it.
  function seasonOf(date) {
    const y = +date.slice(0, 4);
    return [`${y + 1}-winter`, `${y}-fall`, `${y}-summer`, `${y}-spring`].find(key => startOf(key) <= date) || `${y}-winter`;
  }
  const currentSeason = () => seasonOf(todayStr());
  const thisYear = () => String(yearOf(currentSeason()));
  // Whether a period (a season or a year) is over: before the current one.
  const isPast = p => (isSeason(p) ? startOf(p) < startOf(currentSeason()) : +p < +thisYear());
  // Weeks run Monday to Sunday, as in Momo; a season's weeks are the Mondays in it (worked out once each).
  const mondayOf = d => addDays(d, -((new Date(dateMs(d)).getUTCDay() + 6) % 7));
  const weekLists = new Map();
  function weeksOf(key) {
    if (!weekLists.has(key)) {
      const out = [], end = endOf(key);
      for (let m = mondayOf(addDays(startOf(key), 6)); m <= end; m = addDays(m, 7)) out.push(m);
      weekLists.set(key, out);
    }
    return weekLists.get(key);
  }

  // --- Areas and goals ---
  const live = list => list.filter(x => !x.deleted);
  const byAdded = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
  const liveAreas = () => live(S.areas).sort((a, b) => a.order - b.order || byAdded(a, b));
  const liveGoals = () => live(S.goals);
  const areaById = id => (id && S.areas.find(a => a.id === id && !a.deleted)) || null;
  const goalById = id => (id && S.goals.find(g => g.id === id && !g.deleted)) || null;
  const goalsIn = period => liveGoals().filter(g => g.period === period).sort(byAdded);
  const isOpen = g => g.status === "open";
  // A year goal's season goals, by season.
  const childrenOf = id => liveGoals().filter(g => g.parentId === id && isSeason(g.period))
    .sort((a, b) => startOf(a.period).localeCompare(startOf(b.period)) || byAdded(a, b));
  // A season goal's year goal (while there is one), and a goal's area (its year goal's, if it has one).
  const parentOf = g => (isSeason(g.period) && goalById(g.parentId)) || null;
  const areaOf = g => { const p = parentOf(g); return areaById(p ? p.areaId : g.areaId); };
  // Where a goal leads: "→ Conversational by June → Language" (its year goal, then its area).
  const chainOf = g => { const p = parentOf(g), a = areaOf(g); return [p && p.title, a && a.name].filter(Boolean).map(s => `→ ${s}`).join(" "); };

  // A goal is due a reconcile when it never was, or longer ago than RECONCILE_DAYS.
  const isStale = (g, today = todayStr()) => !g.reconciled || daysBetween(g.reconciled, today) > A.RECONCILE_DAYS;
  // "today", "yesterday", "23 days ago".
  const ago = (d, today = todayStr()) => { const n = daysBetween(d, today); return n === 0 ? "today" : n === 1 ? "yesterday" : n > 1 ? `${n} days ago` : `on ${fmtShort(d)}`; };

  // Momo's share of a season goal each week, in minutes: its hours a week, or its total over its season's weeks
  // (rounded up to 15 minutes); 0 without hours.
  function weeklyMinutes(g) {
    if (g.hoursWeek) return Math.round(g.hoursWeek * 60);
    if (!g.hoursTotal || !isSeason(g.period)) return 0;
    return Math.ceil(g.hoursTotal * 60 / Math.max(1, weeksOf(g.period).length) / 15) * 15;
  }
  // "5 h a week", "20 h in total, 1.75 h a week", "" without hours.
  const hoursText = g => (g.hoursWeek ? `${fmtHours(g.hoursWeek)} a week`
    : g.hoursTotal ? `${fmtHours(g.hoursTotal)} in total${weeklyMinutes(g) ? `, ${fmtHours(weeklyMinutes(g) / 60)} a week` : ""}` : "");

  Object.assign(A, {
    cleanLine, cleanText, cleanHours, fmtHours,
    isSeason, isYear, yearOf, seasonsOf, seasonLabel, nextSeason, startOf, endOf, seasonOf, currentSeason, thisYear, isPast, mondayOf, weeksOf,
    live, liveAreas, liveGoals, areaById, goalById, goalsIn, isOpen, childrenOf, parentOf, areaOf, chainOf, isStale, ago, weeklyMinutes, hoursText
  });
})(Kyoshi);
