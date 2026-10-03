/* Badgermole · app.js — registers Badgermole with Kyoshi, plus its constants (limits, steps, minutes,
 * the starter exercises), state (A.S) and small helpers: text, minutes, days and weeks, units, and lookups (which
 * exercise, routine or session is which). Loads first of the app's files: the others destructure what's here at
 * the top, and call functions from each other as A.name(). File map and data model: apps/badgermole/CLAUDE.md. */
(function (K) {
  "use strict";
  const { addDays, dateMs, fmtDate, fmtShort, fmtNum, todayStr } = K.util;

  const A = K.register({
    id: "badgermole",
    name: "Badgermole",
    title: "Badgermole — Workouts",
    subtitle: "Workouts in a rotation, each set logged with one thumb, for Momo to fit into your week.",
    width: 780,
    backupNote: "Your workouts live only in this browser. Export a backup now and then, or sync to a folder to keep them on other devices too. A session in progress stays on the device it started on until you finish it.",
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }],
    // The "dumbbell" icon from Lucide (ISC license) — Toph's badgermoles, the first earthbenders — in Earth Kingdom green.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65a30d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1,
    MAX_EXERCISE: 40,         // an exercise's name
    MAX_ROUTINE: 30,          // a routine's name, which is its card's title in Momo
    MAX_LINES: 20,            // exercises in a routine, each once
    MAX_SETS: 10,             // planned sets of a routine's line (more can be logged)
    MAX_REPS: 100,
    MAX_WEIGHT: 2000,         // in either unit, up to 2 decimals
    MAX_TARGET: 14,           // workouts a week
    DEFAULT_TARGET: 3,
    MAX_PROGRAM: 50,          // routines in the rotation, repeats allowed
    MAX_SESSION_SETS: 200,
    STEP: { lb: 5, kg: 2.5 }, // − / + on a weight, and the progression step
    LB_PER_KG: 2.2046226218,
    DEFAULT_MINUTES: 60,      // a routine's length before it's been done
    ESTIMATE_RUNS: 5,         // its usual length is the average of this many latest sessions
    MAX_SESSION_MINUTES: 300, // a forgotten session can't make its routine look longer than this
    STALE_HOURS: 6,           // a session finished this long after it started ends at its last set
    // Offered while there are no exercises (never added by themselves: two devices would add them twice).
    STARTER: [["Squat"], ["Bench press"], ["Deadlift"], ["Overhead press"], ["Barbell row"], ["Pull-up", true], ["Push-up", true]]
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Saved and synced (CLAUDE.md has their shapes). Deleted items stay as markers so sync can't bring them back.
    exercises: [], routines: [], sessions: [],
    program: { order: [], u: 0 },                   // the rotation: routine ids, repeats allowed
    settings: { unit: "lb", weeklyTarget: 3, u: 0 },
    live: null,       // this device's session in progress (session.js) — never synced or backed up
    version: 0,       // counts every change to the stored data, so the worked-out stats are redone (stats.js)
    // On screen
    view: "home",     // "home" | "session"
    month: "",        // the calendar's month, "YYYY-MM" ("" for this month)
    editing: null,    // the exercise or routine pop-up's state (editors.js)
    day: null,        // the day pop-up's state (day.js)
    knownToday: ""    // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // A line as it's kept: runs of spaces and line breaks become one space, cut to max characters
  // without splitting an emoji.
  const cleanLine = (v, max) => (typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");
  // A whole number from min to max, or fallback when it's no number.
  const clampInt = (v, min, max, fallback) => (typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const round2 = v => Math.round(v * 100) / 100;
  // A number field's text ("?" when the browser couldn't read what was typed, so it never passes for empty).
  const fieldText = el => (el.validity.badInput ? "?" : el.value);
  // A field's text as a number, or null when it isn't one: a whole number from min to max; a weight from 0 to
  // MAX_WEIGHT, to 2 decimals (empty is 0).
  const wholeIn = (t, min, max) => { const v = String(t).trim() === "" ? NaN : Number(t); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
  const weightIn = t => { const v = String(t).trim() === "" ? 0 : Number(t); return Number.isFinite(v) && v >= 0 && v <= A.MAX_WEIGHT ? round2(v) : null; };

  // "45 min", "1 h 15 min", "2 h".
  function fmtMinutes(m) {
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
  }
  // Minutes, rounded to what suits their size: 5-minute steps under an hour, quarter hours to 2 hours,
  // half hours to 4, then whole hours (as Appa's).
  function niceMinutes(m) {
    if (!(m > 0)) return 0;
    const step = m < 60 ? 5 : m < 120 ? 15 : m < 240 ? 30 : 60;
    return Math.max(5, Math.round(m / step) * step);
  }

  // --- Days: a week runs Monday to Sunday, as in Momo ---
  const mondayOf = d => addDays(d, -((new Date(dateMs(d)).getUTCDay() + 6) % 7));
  const sundayOf = d => addDays(mondayOf(d), 6);
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));

  // --- Units: every set and routine line keeps the unit it was typed in; settings.unit picks the unit for new
  // sets and for showing them (others converted, 1 decimal). Nothing is converted in storage. ---
  const unit = () => S.settings.unit;
  const toKg = (w, u) => (u === "kg" ? w : w / A.LB_PER_KG);
  const fromKg = (kg, u) => (u === "kg" ? kg : kg * A.LB_PER_KG);
  const convert = (w, from, to) => (from === to ? w : fromKg(toKg(w, from), to));
  const roundHalf = v => Math.round(v * 2) / 2;
  // A weight for a stepper or field, in the unit shown: as typed, or converted to the nearest 0.5.
  const inUnit = (w, from) => (from === unit() ? w : roundHalf(convert(w, from, unit())));
  // A weight in the unit shown: as typed when it's in that unit, else converted (1 decimal).
  const shownWeight = (w, u) => (u === unit() ? +fmtNum(w, 2) : +fmtNum(convert(w, u, unit()), 1));
  // "185 lb", "61.2 kg".
  const fmtWeight = (w, u) => `${shownWeight(w, u)} ${unit()}`;
  // A set as words: "135 lb × 5"; a bodyweight one "12 reps" or "12 reps +25 lb".
  const fmtSet = s => (s.bodyweight ? `${plural(s.reps, "rep")}${s.weight > 0 ? ` +${fmtWeight(s.weight, s.unit)}` : ""}` : `${fmtWeight(s.weight, s.unit)} × ${s.reps}`);

  // --- Which exercise, routine or session is which (deleted ones are only markers) ---
  const live = list => list.filter(x => !x.deleted);
  const byAdded = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
  const liveExercises = () => live(S.exercises).sort(byAdded);
  const liveRoutines = () => live(S.routines).sort(byAdded);
  const exerciseById = id => (id && S.exercises.find(e => e.id === id && !e.deleted)) || null;
  const routineById = id => (id && S.routines.find(r => r.id === id && !r.deleted)) || null;
  const sessionById = id => (id && S.sessions.find(s => s.id === id && !s.deleted)) || null;
  // The rotation, its deleted routines skipped (sync can bring back an id another device still had).
  const liveOrder = () => S.program.order.filter(id => routineById(id));
  // A routine's lines with their exercise's name and kind, those whose exercise is gone left out.
  const routineItems = r => (r ? r.items : []).map(x => ({ x, e: exerciseById(x.exerciseId) })).filter(({ e }) => e)
    .map(({ x, e }) => ({ exerciseId: e.id, name: e.name, bodyweight: e.bodyweight, sets: x.sets, reps: x.reps, weight: x.weight, unit: x.unit }));
  // Sessions in the order they happened: by day, then when each started.
  const bySession = (a, b) => a.date.localeCompare(b.date) || a.started - b.started || (a.id < b.id ? -1 : 1);
  const sortedSessions = () => live(S.sessions).sort(bySession);
  // Sets get their number within their exercise, in the order they were logged (1-based).
  function numbered(sets) {
    const count = new Map();
    return sets.map(s => { const n = (count.get(s.exerciseId) || 0) + 1; count.set(s.exerciseId, n); return { ...s, n }; });
  }

  Object.assign(A, {
    cleanLine, clampInt, plural, round2, fieldText, wholeIn, weightIn, fmtMinutes, niceMinutes, mondayOf, sundayOf, fmtDay,
    unit, toKg, fromKg, convert, roundHalf, inUnit, shownWeight, fmtWeight, fmtSet,
    live, liveExercises, liveRoutines, exerciseById, routineById, sessionById, liveOrder, routineItems, bySession, sortedSessions, numbered
  });
})(Kyoshi);
