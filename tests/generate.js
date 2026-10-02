/* Kyoshi · tests/generate.js — made-up user data for the end-to-end tests (never real data: the repo is public), from a
 * seeded random generator, so every run gets the same: Badgermole histories (weeks of sessions in a rotation, weights
 * creeping up, bodyweight exercises, either unit, deleted markers), a damaged backup, other apps' backups (to be
 * refused), an Appa job (for its timer), and Momo weeks with "Workout" cards. Dates count back from the tests' TODAY
 * (lib.js). */
"use strict";
const { TODAY, addDays, mondayOf, at } = require("./lib");

// mulberry32: the same numbers for the same seed.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const LB_PER_KG = 2.2046226218;
// Ids are fixed, so tests can name them: [id, name, bodyweight].
const EXERCISES = [
  ["ex-squat", "Squat", false], ["ex-bench", "Bench press", false], ["ex-dead", "Deadlift", false], ["ex-ohp", "Overhead press", false],
  ["ex-row", "Barbell row", false], ["ex-pullup", "Pull-up", true], ["ex-pushup", "Push-up", true], ["ex-curl", "Curl", false]
];
// [id, name, lines: [exerciseId, sets, reps, weight (lb)]]
const ROUTINES = [
  ["rt-push", "Push", [["ex-bench", 3, 5, 135], ["ex-ohp", 3, 8, 75], ["ex-pushup", 3, 15, 0]]],
  ["rt-pull", "Pull", [["ex-row", 3, 8, 115], ["ex-pullup", 3, 8, 0], ["ex-curl", 3, 12, 30]]],
  ["rt-legs", "Legs", [["ex-squat", 3, 5, 185], ["ex-dead", 1, 5, 225]]]
];
const nameOf = id => EXERCISES.find(e => e[0] === id)[1];
const isBodyweight = id => EXERCISES.find(e => e[0] === id)[2];

// The exercises, routines and program alone (no sessions yet). Stamps are fixed, well before TODAY.
function setup({ program = ["rt-push", "rt-pull", "rt-legs"], target = 3, unit = "lb", extraExercises = [] } = {}) {
  const t = at("2026-01-05");
  return {
    schemaVersion: 1, appVersion: "1.000",
    exercises: EXERCISES.concat(extraExercises).map(([id, name, bodyweight], i) => ({ id, name, bodyweight, deleted: false, at: t + i, u: t })),
    routines: ROUTINES.map(([id, name, lines], i) => ({
      id, name, items: lines.map(([exerciseId, sets, reps, weight]) => ({ exerciseId, sets, reps, weight, unit: "lb" })), deleted: false, at: t + 100 + i, u: t
    })),
    program: { order: program, u: t },
    sessions: [],
    settings: { unit, weeklyTarget: target, u: t }
  };
}

// One session of a routine on a day: every planned set, the weights a few steps up per `level`, a set short now and
// then (rng), started at 18:00 and lasting 40–70 minutes; kg sessions keep their weights in kg (to the nearest 2.5).
function session(id, routineId, date, { level = 0, rng = Math.random, kg = false, allHit = false } = {}) {
  const [, name, lines] = ROUTINES.find(r => r[0] === routineId);
  const started = at(date, "18:00") + Math.floor(rng() * 20) * 60000, minutes = 40 + Math.floor(rng() * 31);
  const sets = [];
  lines.forEach(([exerciseId, count, reps, weight]) => {
    for (let n = 1; n <= count; n++) {
      const bw = isBodyweight(exerciseId), lb = weight + level * 5, short = !allHit && rng() < 0.15;
      sets.push({
        exerciseId, name: nameOf(exerciseId), bodyweight: bw, n,
        reps: Math.max(1, reps - (short ? 1 + Math.floor(rng() * 2) : 0) + (bw ? Math.floor(level / 2) : 0)),
        weight: bw ? 0 : kg ? Math.round(lb / LB_PER_KG / 2.5) * 2.5 : lb, unit: kg ? "kg" : "lb",
        at: started + sets.length * 3 * 60000
      });
    }
  });
  return { id, date, routineId, name, sets, started, finished: started + minutes * 60000, deleted: false, u: started + minutes * 60000 };
}

// A history: `weeks` full weeks before this one (perWeek sessions each, on Mon/Wed/Fri…, in program order), skipping
// the weeks `gaps` back (1 = last week), then this week's sessions from Monday, on the days before TODAY (`thisWeek`).
// Sessions before `kgBefore` weeks back were logged in kg. Returns the backup.
function history({ weeks = 12, perWeek = 3, gaps = [], thisWeek = 0, kgBefore = Infinity, seed = 1, ...rest } = {}) {
  const rng = random(seed), data = setup(rest), order = data.program.order, monday = mondayOf(TODAY), days = [0, 2, 4, 1, 3, 5, 6];
  let i = 0;
  for (let w = weeks; w >= 0; w--) {
    if (gaps.includes(w)) continue;
    const count = w === 0 ? thisWeek : perWeek, list = w === 0 ? [0, 1, 2, 3, 4, 5, 6] : days; // this week: from Monday on
    for (let k = 0; k < count; k++) {
      const date = addDays(monday, -7 * w + list[k % 7]);
      if (w === 0 && date >= TODAY) break;
      data.sessions.push(session(`s-${String(i).padStart(4, "0")}`, order[i % order.length], date, { level: Math.floor((weeks - w) / 2), rng, kg: w > kgBefore }));
      i++;
    }
  }
  // Markers of what was deleted: they must stay out of sight.
  const t = at(addDays(TODAY, -3));
  data.exercises.push({ id: "ex-gone", deleted: true, at: t, u: t });
  data.sessions.push({ id: "s-gone", deleted: true, started: t, u: t });
  return data;
}

// A backup made of junk: wrong types, duplicates, out-of-range numbers, unknown units, missing ids and dates. The app
// should keep only what it can use, and never break.
const damaged = () => ({
  schemaVersion: 1,
  exercises: [null, 5, "x", { id: "e1", name: "  Squat  \n deep ", bodyweight: "yes" }, { id: "e1", name: "Copy" }, { name: "" }, { id: "e2", name: "Pull-up", bodyweight: true }, { id: "e3", deleted: true, name: "Gone" }],
  routines: [
    { id: "r1", name: "A".repeat(80), items: [{ exerciseId: "e1", sets: 99, reps: -3, weight: "heavy", unit: "stone" }, { exerciseId: "e1", sets: 2 }, { exerciseId: "missing", sets: 3, reps: 5 }, "junk"] },
    { id: "r2" }
  ],
  program: { order: ["r1", "nope", 42, "r1"], u: "soon" },
  sessions: [
    { id: "s1", date: "2026-02-30", sets: [] },
    { id: "s2", date: addDays(TODAY, -2), routineId: "r1", name: "A", started: at(addDays(TODAY, -2), "18:00"), finished: 1,
      sets: [{ exerciseId: "e1", reps: 5.4, weight: 1e9, unit: "kg" }, { reps: 5 }, { exerciseId: "e2", reps: 12, weight: -10, bodyweight: true }] }
  ],
  settings: { unit: "furlongs", weeklyTarget: 99 }
});

// Other apps' backups: Badgermole's Import JSON must refuse them.
const hawky = () => ({ schemaVersion: 1, appVersion: "1.000", items: [{ id: "h1", text: "Buy milk", due: "", minutes: 15, done: "", deleted: false, at: 1, u: 1 }] });
const wanshitong = () => ({ schemaVersion: 1, appVersion: "2.252", items: [{ id: "w1", name: "Dune", kind: "book", deleted: false, at: 1, u: 1 }] });

// An Appa backup: one thing with one job, overdue (so it's on Home's Coming up). Appa's ids are letters and digits only.
const appa = () => ({
  schemaVersion: 1, appVersion: "1.132",
  things: [{ id: "vacuum1", name: "Robot vacuum", meter: "", deleted: false, at: 1, u: 1 }],
  jobs: [{ id: "filter1", thingId: "vacuum1", name: "Clean the filter", every: { n: 2, unit: "w" }, from: { date: addDays(TODAY, -30) }, est: 15, deleted: false, at: 2, u: 2 }],
  records: [], readings: [], files: [], settings: { name: "", u: 0 }
});

// A Momo backup whose weeks have cards titled "Workout" (1 hour each) on the days given ("YYYY-MM-DD"), and any other
// cards ({ date, title, hours }).
function momo(dates, others = []) {
  const weeks = {}, t = at("2026-01-05");
  dates.map(date => ({ date, title: "Workout", hours: 1 })).concat(others).forEach((c, i) => {
    const key = mondayOf(c.date), week = weeks[key] || (weeks[key] = { cards: [], closed: false, u: t });
    week.cards.push({ id: `card-${i}`, title: c.title, hours: c.hours, day: (new Date(`${c.date}T00:00:00Z`).getUTCDay() + 6) % 7 });
  });
  return { schemaVersion: 2, appVersion: "6.964", weeks, baseline: { cards: [], u: 0 }, goals: [], colors: {} };
}

module.exports = { random, LB_PER_KG, EXERCISES, ROUTINES, setup, session, history, damaged, hawky, wanshitong, appa, momo };
