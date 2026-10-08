/* Kyoshi · tests/generate.js — made-up user data for the end-to-end tests (never real data: the repo is public), from a
 * seeded random generator, so every run gets the same: Badgermole histories (weeks of sessions in a rotation, weights
 * creeping up, bodyweight exercises, either unit, deleted markers), a damaged backup, other apps' backups (to be
 * refused), an Appa job (for its timer), Turtleduck's recipes with a plan and shopping trips (and a damaged one), Pabu's
 * people (a version 1 backup, one in today's shape with groups, and a damaged one), and Momo weeks with "Workout", meal,
 * "Cooking", "Groceries" and "Keep in touch" cards.
 * Then fuller worlds, for the flow simulator (tests/sim) and any test: core's meetings, many Hawky errands, Iroh's areas
 * and goals, Bosco's weekly dose and weigh-ins (and injection sites), Appa's things with meters, seasonal and meter jobs, Wan Shi Tong's
 * recommendations, Momo's baseline, and an Export all file of them.
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
    { id: "r1", name: "A".repeat(80), minutes: 1e9, items: [{ exerciseId: "e1", sets: 99, reps: -3, weight: "heavy", unit: "stone" }, { exerciseId: "e1", sets: 2 }, { exerciseId: "missing", sets: 3, reps: 5 }, "junk"] },
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
// cards ({ date, title, hours }; another app's: also app, and need "<app>:<id>", the need it holds).
function momo(dates, others = []) {
  const weeks = {}, t = at("2026-01-05");
  dates.map(date => ({ date, title: "Workout", hours: 1 })).concat(others).forEach((c, i) => {
    const key = mondayOf(c.date), week = weeks[key] || (weeks[key] = { cards: [], closed: false, u: t });
    week.cards.push({ id: `card-${i}`, title: c.title, hours: c.hours, day: (new Date(`${c.date}T00:00:00Z`).getUTCDay() + 6) % 7, ...(c.app ? { app: c.app, need: c.need || null } : {}) });
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
// A Turtleduck backup: the recipes (all, or those named; a recipe given whole is added as it is: a test's own, a
// store-bought one with its stock for instance), planned meals ({ id?, date, meal, recipeId | kind, … } → whole entries),
// trips (dates), the weeks confirmed for Momo (their Mondays), and anything else given (checked, manual, sections,
// templates, slotTimes, tripSkips, settings).
function turtleduck({ recipes = RECIPES.map(r => r.id), plan = [], trips = [], confirmed = [], ...rest } = {}) {
  const t = at("2026-01-05"), whole = recipes.filter(r => typeof r === "object"), known = RECIPES.concat(whole);
  return {
    confirmed: Object.fromEntries(confirmed.map(m => [m, { at: t, u: t }])),
    schemaVersion: 1, appVersion: "1.000",
    recipes: RECIPES.filter(r => recipes.includes(r.id)).concat(whole).map((r, i) => ({ prepMin: null, cookMin: null, kcal: null, protein: null, carbs: null, fat: null, fiber: null, link: "", archived: false, ...r, deleted: false, at: t + i, u: t })),
    plan: plan.map((e, i) => {
      const r = known.find(x => x.id === e.recipeId);
      return { id: `pl-${i}`, kind: "recipe", recipeId: "", name: r ? r.name : "", leftover: false, from: "", scale: 1, servings: e.meal === "cook" ? 0 : 1, kcal: null, protein: null, carbs: null, fat: null, fiber: null, deleted: false, at: t + 100 + i, u: t, ...e };
    }),
    trips: trips.map((date, i) => ({ id: `tr-${i}`, date, deleted: false, at: t + 200 + i, u: t })),
    checked: {}, manual: [], sections: {}, templates: [], settings: { targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, u: 0 },
    ...rest
  };
}
// A Turtleduck backup made of junk: wrong types, duplicates, out-of-range numbers, a leftover on the Cook row, a bad section,
// a count on hand too big and one on a recipe that isn't store-bought.
const damagedTurtleduck = () => ({
  schemaVersion: 1,
  recipes: [null, "x", { id: "r1", name: "  Chili \n con carne ", meal: "brunch", servings: 99, kcal: -5, protein: "lots", ingredients: "2 eggs\n\n 1 cup rice ", steps: 42, bought: true, stock: { count: 1500.4, date: TODAY } },
    { id: "r1", name: "Copy" }, { name: "" }, { id: "r2", name: "Oats", ingredients: [{ qty: 50, unit: "g", name: "oats" }, 7, null], bought: "yes", stock: { count: 3, date: TODAY } }, { id: "r3", deleted: true, name: "Gone" }],
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
// Pabu's people in today's shape (schemaVersion 2): a group, notes, a birthday, and calls, texts and visits each on its own
// schedule ({ id, every, how, minutes, talks: days back, newest first }); added: days back (else a fixed stamp). As of
// TODAY (Wed Sep 30), This week holds Mom's visit (overdue 9 days), Bo's text (never talked: due Monday, the day he was
// added), Dad's text (talked yesterday), Mom's weekly call (due today) and Raj's call (Saturday); Zoe's visit is due Oct
// 12; Ivy is birthday only (Feb 29); Mom's group is "Family", Dad's "family"; Mom turns 60 on Oct 12, Zoe's birthday is
// Oct 15.
const CIRCLE = [
  { id: "pc-mom", name: "Mom", group: "Family", birthday: "1966-10-12", note: "Ask about the garden.\nShe's back from the lake on Friday.",
    cadences: [{ id: "c1", every: "week", how: "call", minutes: 30, talks: [7, 14] }, { id: "c2", every: "month", how: "visit", minutes: 120, talks: [40] }] },
  { id: "pc-dad", name: "Dad", group: "family", cadences: [{ id: "c1", every: "2weeks", how: "text", minutes: 10, talks: [1, 15] }] },
  { id: "pc-raj", name: "Raj", group: "Work", cadences: [{ id: "c1", every: "month", how: "call", minutes: 30, talks: [27] }] },
  { id: "pc-zoe", name: "Zoe", group: "Friends", birthday: "10-15", cadences: [{ id: "c1", every: "quarter", how: "visit", minutes: 120, talks: [80] }] },
  { id: "pc-ivy", name: "Ivy", birthday: "2000-02-29", cadences: [] },
  { id: "pc-bo", name: "Bo", added: 2, cadences: [{ id: "c1", every: "week", how: "text", minutes: 10, talks: [] }] },
  { id: "pc-gone", deleted: true }
];
// A Pabu backup of those people (or others in the same shape), each exactly as Pabu keeps them (so Export gives it back).
function pabuCircle(people = CIRCLE) {
  const t = at("2026-01-05");
  return {
    schemaVersion: 2, appVersion: "2.110",
    people: people.map((p, i) => {
      const added = p.added === undefined ? t + i : at(addDays(TODAY, -p.added)), gone = !!p.deleted;
      return {
        id: p.id, name: gone ? "" : p.name, group: gone ? "" : p.group || "", note: gone ? "" : p.note || "", birthday: gone ? "" : p.birthday || "",
        cadences: gone ? [] : (p.cadences || []).map(c => ({ id: c.id, every: c.every, how: c.how, minutes: c.minutes, talks: c.talks.map(n => addDays(TODAY, -n)), at: added })),
        deleted: gone, at: added, u: t
      };
    })
  };
}

// --- Fuller worlds (the flow simulator, tests/sim, builds its lives from these; any test can too) ---
// Made-up first names (never real people's data), and a pick from a seeded rng.
const NAMES = ["Ada", "Bram", "Cleo", "Dov", "Esme", "Fitz", "Gale", "Hux", "Ines", "Jory", "Kesi", "Lark", "Milo", "Nell", "Odo", "Pia", "Quill",
  "Rafe", "Suki", "Teo", "Una", "Vale", "Wynn", "Xan", "Yara", "Zev", "Aldo", "Bea", "Cass", "Dara", "Elio", "Fern", "Gil", "Hana", "Ivo", "Juno"];
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const T0 = at("2026-01-05"); // stamps well before TODAY

// Core's meetings for an app's backup (core/meetings.js): { id: { every, minutes, last ("YYYY-MM-DD" or ""), since } }.
function meetings(spec) {
  return Object.fromEntries(Object.entries(spec).map(([id, m]) => [id, { every: m.every || "whenever", minutes: m.minutes || 15, last: m.last || "", since: m.since || m.last || TODAY, u: T0 }]));
}

// Hawky: errands, each { text, due ("" for none), minutes, done ("" or the day), added (a day), postponed (how often:
// left out of the file unless given, as in backups from before it) }.
function hawkyItems(list, meet) {
  return {
    schemaVersion: 1, appVersion: "1.000", ...(meet ? { meetings: meet } : {}),
    items: list.map((e, i) => ({
      id: `hk${String(i).padStart(4, "0")}`, text: e.text, due: e.due || "", minutes: e.minutes || 15, done: e.done || "",
      ...(e.postponed ? { postponed: e.postponed } : {}), deleted: false, at: at(e.added || addDays(TODAY, -3), "08:00") + i, u: T0 + i
    }))
  };
}
// Errands to make up: what, and how long (minutes).
const ERRANDS = [["Return library books", 15], ["Pick up dry cleaning", 30], ["Buy a birthday card", 15], ["Call the dentist", 15], ["Renew passport form", 60],
  ["Drop off donations", 30], ["Buy stamps", 15], ["Fix the drawer handle", 30], ["Order printer ink", 15], ["Pay the parking ticket", 15], ["Get a key cut", 30],
  ["Book a haircut", 15], ["Return the parcel", 30], ["Pick up the prescription", 30], ["Buy light bulbs", 15], ["Mail the form", 15], ["Sharpen the knives", 30],
  ["Hang the picture", 30], ["Sort the recycling", 15], ["Update the address", 15], ["Buy a gift", 60], ["Clean out the car", 60], ["Replace the batteries", 15]];

// Iroh: areas [{ id, name, vision }], goals [{ id, period, title, areaId, parentId, hoursWeek, hoursTotal, next, status, reconciled, at }].
function iroh({ areas = [], goals = [], meet = null } = {}) {
  return {
    schemaVersion: 1, appVersion: "1.000", ...(meet ? { meetings: meet } : {}),
    areas: areas.map((a, i) => ({ id: a.id, name: a.name, vision: a.vision || "", milestones: a.milestones || "", order: i, deleted: false, at: T0 + i, u: T0 })),
    goals: goals.map((g, i) => ({
      id: g.id, areaId: g.areaId || "", period: g.period, title: g.title, why: g.why || "", doneWhen: g.doneWhen || "", parentId: g.parentId || "",
      hoursWeek: g.hoursWeek || 0, hoursTotal: g.hoursWeek ? 0 : g.hoursTotal || 0, next: g.next || "", reconciled: g.reconciled || TODAY,
      status: g.status || "open", deleted: false, at: g.at || T0 + 1000 + i, u: g.u || T0
    }))
  };
}

// Bosco: a weekly GLP-1 dose (its plan, the last dose taken) and weigh-ins [{ date, weight }] in lb. sites: the injection
// sites on, doseSites: where the last doses went (the latest last); without them, a backup from before injection sites.
function bosco({ medication = "tirzepatide", intervalDays = 7, weeklyMg = 5, doseTime = null, lastDose = addDays(TODAY, -5), doses = 4, weights = [], meet = null, sites, doseSites = [] } = {}) {
  const entries = weights.map(w => ({ date: w.date, weight: w.weight, doseMg: null, medication: null }));
  for (let i = 0; i < doses; i++) {
    const date = addDays(lastDose, -i * intervalDays), e = entries.find(x => x.date === date);
    if (e) Object.assign(e, { doseMg: weeklyMg * intervalDays / 7, medication });
    else entries.push({ date, weight: null, doseMg: weeklyMg * intervalDays / 7, medication });
  }
  doseSites.slice(-doses).forEach((site, i, list) => { entries.find(e => e.date === addDays(lastDose, (i - list.length + 1) * intervalDays)).site = site; });
  return {
    schemaVersion: 4, appVersion: "5.900", unit: "lb", name: "", medication, ...(meet ? { meetings: meet } : {}), ...(sites ? { sites } : {}),
    dosePlan: { medication, intervalDays, weeklyMg, doseTime, nextDose: null, savedAt: "2026-01-05T00:00:00.000Z" },
    vial: null, paceGoal: null, goals: [180, 170], entries: entries.sort((a, b) => a.date.localeCompare(b.date))
  };
}

// Appa: things [{ id, name, meter, pace }], jobs [{ id, thingId, name, every: [n, unit] | null, seasons, meterEvery, from: { date, reading }, est }],
// readings [{ thingId, date, value }]. Ids are letters and digits only.
function appaWorld({ things = [], jobs = [], readings = [], meet = null } = {}) {
  return {
    schemaVersion: 1, appVersion: "1.132", ...(meet ? { meetings: meet } : {}),
    things: things.map((t, i) => ({ id: t.id, name: t.name, about: "", serial: "", meter: t.meter || "", pace: t.pace || 0, docs: [], archived: false, deleted: false, at: T0 + i, u: T0 })),
    jobs: jobs.map((j, i) => ({
      id: j.id, thingId: j.thingId, name: j.name, every: j.every ? { n: j.every[0], unit: j.every[1] } : null, seasons: j.seasons || [], meterEvery: j.meterEvery || null,
      from: { date: (j.from && j.from.date) || "", reading: j.from && j.from.reading !== undefined ? j.from.reading : null }, est: j.est || null, source: { docId: "", where: "" }, notes: "", deleted: false, at: T0 + 100 + i, u: T0
    })),
    records: [], files: [], settings: { name: "", u: 0 },
    readings: readings.map((r, i) => ({ id: `rd${String(i).padStart(4, "0")}`, thingId: r.thingId, date: r.date, value: r.value, deleted: false, at: T0 + 500 + i, u: T0 }))
  };
}

// Wan Shi Tong: recommendations [{ name, cat, info, now: true (in progress) | next: true }], in the shape before 2.472 (no
// movie's director or year).
function library(list, meet = null) {
  const items = list.map((x, i) => ({ id: `ws${String(i).padStart(3, "0")}`, cat: x.cat || "book", name: x.name, info: x.info || "", have: "", why: "", added: addDays(TODAY, -60 + i), started: x.now ? addDays(TODAY, -10) : "", done: "", deleted: false, at: T0 + i, u: T0 }));
  const spot = (k, i) => ({ id: i >= 0 ? items[i].id : "", u: T0 });
  const now = list.map((x, i) => (x.now ? i : -1)).filter(i => i >= 0);
  return {
    schemaVersion: 1, appVersion: "2.252", ...(meet ? { meetings: meet } : {}), items,
    slots: { now: spot("now", now[0] ?? -1), now2: spot("now2", now[1] ?? -1), now3: spot("now3", now[2] ?? -1), next: spot("next", list.findIndex(x => x.next)) }
  };
}

// Momo: a baseline [{ title, hours, days: [0-6], pin }] (each day's cards in the order given), weeks as momo() makes them.
function momoWorld({ baseline = [], meet = null } = {}) {
  const cards = [];
  [0, 1, 2, 3, 4, 5, 6].forEach(d => baseline.filter(c => c.days.includes(d)).forEach(c => cards.push({
    id: `bl${cards.length}`, title: c.title, hours: c.hours, day: d, goalId: null, base: false, parentId: null, pos: "bottom", pin: c.pin === undefined ? null : c.pin
  })));
  return { schemaVersion: 2, appVersion: "6.964", ...(meet ? { meetings: meet } : {}), weeks: {}, baseline: { cards, u: T0 }, goals: [], colors: {} };
}

// Every app's backup in one Export all file (Developer Mode's Import all takes it).
const exportAll = apps => ({ kyoshiVersion: "3.330", exportedAt: "2026-01-05T00:00:00.000Z", apps });

module.exports = {
  random, LB_PER_KG, EXERCISES, ROUTINES, setup, session, history, damaged, hawky, wanshitong, appa, momo, RECIPES, turtleduck, damagedTurtleduck, PEOPLE, pabu, damagedPabu,
  CIRCLE, pabuCircle, NAMES, pick, meetings, hawkyItems, ERRANDS, iroh, bosco, appaWorld, library, momoWorld, exportAll
};
