/* Kyoshi · tests/generate.js — made-up user data for the end-to-end tests (never real data: the repo is public), from a
 * seeded random generator, so every run gets the same: Badgermole histories (weeks of sessions in a rotation, weights
 * creeping up, bodyweight exercises, either unit, deleted markers), a damaged backup, other apps' backups (to be
 * refused), an Appa job (for its timer), Turtleduck's recipes with a plan and shopping trips (and a damaged one), Pabu's
 * people (and a damaged backup), and Momo weeks with "Workout", meal, "Cooking", "Groceries" and "Keep in touch" cards.
 * Dates count back from the tests' TODAY (lib.js). */
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

// --- Turtleduck: made-up recipes, with fixed ids so tests can name them ---
const RECIPES = [
  { id: "rc-chili", name: "Chili", meal: "dinner", servings: 4, prepMin: 15, cookMin: 45, kcal: 650, protein: 45, carbs: 40, fat: 30, fiber: 8,
    ingredients: ["500 g ground beef", "2 cans kidney beans, drained", "200 g rice", "1 onion, diced", "salt"], steps: "Brown the beef.\n- Add the beans\n- Simmer 30 min\nSeason to taste.", link: "https://example.com/chili" },
  { id: "rc-friedrice", name: "Fried rice", meal: "dinner", servings: 2, prepMin: 10, cookMin: 15, kcal: 520, protein: 20, carbs: 70, fat: 15, fiber: 3,
    ingredients: ["1 kg rice", "2 eggs", "1 cup frozen peas", "2 tbsp soy sauce"], steps: "Fry it all." },
  { id: "rc-oats", name: "Overnight oats", meal: "breakfast", servings: 1, prepMin: 5, kcal: 400, protein: 25, carbs: 50, fat: 10, fiber: 7,
    ingredients: ["50 g oats", "200 ml milk", "1 banana"], steps: "Mix, and leave overnight." },
  { id: "rc-salad", name: "Salad", meal: "lunch", servings: 1, prepMin: 10, kcal: 250, protein: 8, carbs: 20, fat: 15, fiber: 6,
    ingredients: ["1 head lettuce", "2 tomatoes", "1 cup rice"], steps: "Toss it." },
  { id: "rc-curry", name: "Curry", meal: "dinner", servings: 6, prepMin: 20, cookMin: 40, kcal: 700, protein: 40, carbs: 60, fat: 32, fiber: 5,
    ingredients: ["1.5 kg chicken thighs", "2 cans coconut milk", "2 tbsp curry paste", "400 g rice"], steps: "Simmer until done." },
  { id: "rc-bowl", name: "Rice bowl", meal: "lunch", servings: 1, kcal: 600, protein: 30, ingredients: ["2 cups rice", "1 avocado"], steps: "" },
  { id: "rc-stew", name: "Mystery stew", meal: "dinner", servings: 4, ingredients: ["1 kg potatoes", "2 carrots"], steps: "Stew it." },
  { id: "rc-soup", name: "Old soup", meal: "lunch", servings: 2, kcal: 300, ingredients: ["1 l stock"], steps: "Heat.", archived: true }
];
// A Turtleduck backup: the recipes (all, or those named), planned meals ({ id?, date, meal, recipeId | kind, … } → whole
// entries), trips (dates), and anything else given (checked, manual, sections, templates, settings).
function turtleduck({ recipes = RECIPES.map(r => r.id), plan = [], trips = [], ...rest } = {}) {
  const t = at("2026-01-05");
  return {
    schemaVersion: 1, appVersion: "1.000",
    recipes: RECIPES.filter(r => recipes.includes(r.id)).map((r, i) => ({ prepMin: null, cookMin: null, kcal: null, protein: null, carbs: null, fat: null, fiber: null, link: "", archived: false, ...r, deleted: false, at: t + i, u: t })),
    plan: plan.map((e, i) => {
      const r = RECIPES.find(x => x.id === e.recipeId);
      return { id: `pl-${i}`, kind: "recipe", recipeId: "", name: r ? r.name : "", leftover: false, from: "", scale: 1, servings: e.meal === "cook" ? 0 : 1, kcal: null, protein: null, carbs: null, fat: null, fiber: null, deleted: false, at: t + 100 + i, u: t, ...e };
    }),
    trips: trips.map((date, i) => ({ id: `tr-${i}`, date, deleted: false, at: t + 200 + i, u: t })),
    checked: {}, manual: [], sections: {}, templates: [], settings: { targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, u: 0 },
    ...rest
  };
}
// A Turtleduck backup made of junk: wrong types, duplicates, out-of-range numbers, a leftover on the Cook row, a bad section.
const damagedTurtleduck = () => ({
  schemaVersion: 1,
  recipes: [null, "x", { id: "r1", name: "  Chili \n con carne ", meal: "brunch", servings: 99, kcal: -5, protein: "lots", ingredients: "2 eggs\n\n 1 cup rice ", steps: 42 },
    { id: "r1", name: "Copy" }, { name: "" }, { id: "r2", name: "Oats", ingredients: [{ qty: 50, unit: "g", name: "oats" }, 7, null] }, { id: "r3", deleted: true, name: "Gone" }],
  plan: [{ id: "p1", date: addDays(TODAY, 1), meal: "dinner", recipeId: "r1", scale: 37, servings: -2 }, { id: "p2", date: "2026-02-30", meal: "dinner", recipeId: "r1" },
    { id: "p3", date: TODAY, meal: "cook", kind: "quick", name: "Shake" }, { id: "p4", date: TODAY, meal: "brunch", recipeId: "r1" }, { id: "p5", date: TODAY, meal: "lunch", kind: "quick", name: "Shake", kcal: 1e9 }],
  trips: [{ id: "t1", date: addDays(TODAY, 2) }, { id: "t2", date: "soon" }],
  checked: { "rice|cup": { ranges: [[addDays(TODAY, 1), addDays(TODAY, 3)], ["2026-13-01", "x"], [addDays(TODAY, 5), addDays(TODAY, 2)]], u: 1 }, "nounit": { ranges: [] }, "x|g": "yes" },
  manual: [{ id: "m1", text: "  olive   oil " }, { id: "m2", text: "" }],
  sections: { rice: { section: "Pantry", u: 1 }, beans: { section: "Garden" } },
  templates: [{ id: "tp1", name: "Week", entries: [{ day: 9, meal: "lunch", kind: "quick", name: "Shake" }, { day: 1, meal: "dinner", leftover: true, recipeId: "r1", from: 5 }] }],
  settings: { targets: { kcal: "2000", protein: 150, fat: -1 } }
});

// --- Pabu: made-up people, with fixed ids so tests can name them. talks: days back from TODAY (newest first); added: days
// back (else a fixed stamp well before TODAY). As of TODAY (Wed Sep 30): Gran, Mom and Ana are overdue (Ana never talked,
// so due the day she was added), Sam and Jo come up within two weeks (Jo not before Oct 4 in Momo), Lee is due in
// December, Kai is birthday only (tomorrow), and Mom turns 60 on Oct 12. ---
const PEOPLE = [
  { id: "pp-gran", name: "Gran", every: "month", how: "visit", minutes: 120, talks: [40] },
  { id: "pp-mom", name: "Mom", every: "month", how: "call", minutes: 30, talks: [35, 70], birthday: "1966-10-12", note: "Ask about the garden.\nShe's back from the lake on Friday." },
  { id: "pp-ana", name: "Ana", every: "2weeks", how: "call", minutes: 30, talks: [], added: 3 },
  { id: "pp-sam", name: "Sam", every: "week", how: "text", minutes: 10, talks: [1] },
  { id: "pp-jo", name: "Jo", every: "2weeks", how: "call", minutes: 30, talks: [4] },
  { id: "pp-lee", name: "Lee", every: "quarter", how: "visit", minutes: 120, talks: [10] },
  { id: "pp-kai", name: "Kai", every: "none", how: "call", minutes: 30, talks: [], birthday: "10-01" },
  { id: "pp-gone", deleted: true }
];
// A Pabu backup of those people (or others in the same shape), each as Pabu keeps them.
function pabu(people = PEOPLE) {
  const t = at("2026-01-05");
  return {
    schemaVersion: 1, appVersion: "1.000",
    people: people.map((p, i) => ({
      id: p.id, name: p.deleted ? "" : p.name, every: p.every || "month", how: p.how || "call", minutes: p.minutes || 30,
      talks: p.deleted ? [] : (p.talks || []).map(n => addDays(TODAY, -n)), note: p.deleted ? "" : p.note || "", birthday: p.deleted ? "" : p.birthday || "",
      deleted: !!p.deleted, at: p.added === undefined ? t + i : at(addDays(TODAY, -p.added)), u: t
    }))
  };
}
// A Pabu backup made of junk: wrong types, a duplicate id, no names, a 500-character name, a how often from a newer
// version ("fortnight", kept but read as every month), minutes out of range, bad days and one ahead of today, an
// impossible birthday, a moment no date can hold, and a deleted marker. Three people are usable: Rae Lynn, the long name
// and Old clock.
const damagedPabu = () => ({
  schemaVersion: 1,
  people: [
    null, 7, "x",
    { id: "d1", name: "  Rae \n  Lynn ", every: "fortnight", how: 3, minutes: 1e9, talks: ["2026-02-30", 5, addDays(TODAY, -3), addDays(TODAY, -3), addDays(TODAY, 2), "soon"], birthday: "13-45", note: 42 },
    { id: "d1", name: "Copy" }, { name: "" }, { id: "d5", name: "   " },
    { id: "d2", name: "N".repeat(500), every: "week", how: "visit", minutes: "lots", talks: "yesterday", birthday: "02-29", at: -5 },
    { id: "d3", deleted: true, name: "Gone", talks: [TODAY], at: 1, u: 1 },
    { id: "d4", name: "Old clock", every: "month", how: "text", minutes: 12.6, talks: [addDays(TODAY, 1)], at: 9e15, u: "soon" }
  ]
});

module.exports = { random, LB_PER_KG, EXERCISES, ROUTINES, setup, session, history, damaged, hawky, wanshitong, appa, momo, RECIPES, turtleduck, damagedTurtleduck, PEOPLE, pabu, damagedPabu };
