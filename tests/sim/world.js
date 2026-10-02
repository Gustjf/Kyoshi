/* Kyoshi · tests/sim/world.js — a life's world on its first day: every app's backup (made-up data from a seeded rng, through
 * tests/generate.js), as one Export all file for Import all, plus what the person knows about it (their goals' titles, the
 * baseline's blocks, the recipes they cook, the errands they make up). A world spec (lives.js) says what's in it:
 *   { apps, baseline: "full" | "light" | "none", hawky: { open }, pabu: { people, visits }, appa: { things }, badgermole: { target,
 *     weeks }, turtleduck: "full" | "dinners" | null, iroh: { areas, year, season }, bosco, wanshitong, checkups: days ago }
 * Nothing real: names from generate.NAMES, numbers invented. */
"use strict";
const { TODAY, addDays } = require("../lib");
const gen = require("../generate");

// --- Momo's baseline: the week's routine blocks, each day's cards in order. Titles are the blocks the apps fill. ---
const WD = [0, 1, 2, 3, 4], ALL = [0, 1, 2, 3, 4, 5, 6];
function baseline(kind, goals) {
  if (kind === "none") return [];
  const g = t => goals.some(x => x.title === t); // a goal's own block, when the life has that goal
  const out = [
    { title: "Sleep", hours: 8, days: ALL },
    { title: "Breakfast", hours: 0.5, days: ALL },
    { title: "Commute", hours: 0.5, days: WD },
    { title: "Work", hours: 8, days: WD },
    { title: "Lunch", hours: 0.5, days: ALL },
    { title: "Commute", hours: 0.5, days: WD },
    { title: "Workout", hours: 1, days: [0, 2, 4] },
    { title: "Errands", hours: 0.5, days: [0, 2] },
    { title: "Errands", hours: 1.5, days: [5] },
    { title: "Groceries", hours: 1, days: [5] },
    { title: "Keep in touch", hours: 0.5, days: [1, 3] },
    { title: "Keep in touch", hours: 1.5, days: [6] },
    { title: "Cooking", hours: 2, days: [6] },
    { title: "Meeting", hours: 0.5, days: [6], pin: 18 },
    { title: "House maintenance", hours: 1, days: [5] },
    { title: "Dinner", hours: 1, days: ALL }
  ];
  if (kind === "full") {
    if (g("Side project")) out.push({ title: "Side project", hours: 1, days: [0, 2] }, { title: "Side project", hours: 2, days: [6] });
    if (g("Spanish practice")) out.push({ title: "Spanish practice", hours: 1, days: [1, 3, 5] });
    if (g("Run training")) out.push({ title: "Run training", hours: 1, days: [1, 5] });
  }
  return out;
}

// --- Iroh's ladder: areas, the year's goals, the season's (hours a week or in total) ---
const AREAS = [["ar-health", "Health"], ["ar-craft", "Craft"], ["ar-family", "Family"], ["ar-home", "Home"], ["ar-mind", "Mind"]];
const YEAR = [["yr-half", "Run a half marathon", "ar-health"], ["yr-ship", "Ship the side project", "ar-craft"], ["yr-calm", "A calmer home", "ar-home"],
  ["yr-close", "Close to family", "ar-family"], ["yr-learn", "Learn something new", "ar-mind"]];
// Season goals by life: [id, title, year goal, hours a week, hours in total].
const SEASON = {
  planner: [["sg-run", "Run training", "yr-half", 2, 0], ["sg-side", "Side project", "yr-ship", 4, 0], ["sg-spanish", "Spanish practice", "yr-learn", 3, 0], ["sg-books", "Read 6 books", "", 0, 30]],
  parent: [["sg-yoga", "Yoga", "yr-calm", 2, 0], ["sg-garden", "Garden beds", "yr-calm", 2, 0], ["sg-piano", "Piano", "yr-learn", 2, 0], ["sg-kids", "Kids' craft night", "yr-close", 2, 0], ["sg-course", "Online course", "yr-learn", 2, 0]],
  light: [["sg-walk", "Long walks", "", 2, 0], ["sg-sketch", "Sketching", "", 0, 12]],
  seasons: [["sg-run", "Run training", "yr-half", 3, 0], ["sg-side", "Side project", "yr-ship", 0, 40], ["sg-spanish", "Spanish practice", "yr-learn", 2, 0]]
};

// --- Pabu: n people on cadences, some visits, some birthdays, some birthday only ---
function people(rng, n, visits) {
  const EVERY = ["week", "2weeks", "month", "month", "month", "quarter", "quarter", "year"], out = [];
  for (let i = 0; i < n; i++) {
    const every = i % 7 === 6 ? "none" : gen.pick(rng, EVERY), how = rng() < visits ? "visit" : rng() < 0.6 ? "call" : "text";
    const span = { week: 7, "2weeks": 14, month: 30, quarter: 91, year: 365, none: 30 }[every];
    out.push({
      id: `pp-${i}`, name: `${gen.NAMES[i % gen.NAMES.length]}${i >= gen.NAMES.length ? " " + String.fromCharCode(65 + Math.floor(i / gen.NAMES.length)) : ""}`,
      every, how, minutes: { visit: 120, call: 30, text: 10 }[how], talks: every === "none" ? [] : [1 + Math.floor(rng() * span)],
      birthday: rng() < 0.5 ? `${String(1 + Math.floor(rng() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rng() * 28)).padStart(2, "0")}` : ""
    });
  }
  return out;
}

// --- Appa: a house and a car with an odometer (and more things for a bigger life), jobs spread over the year ---
function appa(rng, kind) {
  const d = n => addDays(TODAY, n);
  const things = [{ id: "thouse", name: "House" }, { id: "tcar", name: "Car", meter: "mi", pace: 12000 }];
  const jobs = [
    { id: "jfilter", thingId: "thouse", name: "Replace the HVAC filter", every: [3, "m"], from: { date: d(-70) }, est: 15 },
    { id: "jsmoke", thingId: "thouse", name: "Test the smoke alarms", every: [6, "m"], from: { date: d(-152) }, est: 10 },
    { id: "jgutter", thingId: "thouse", name: "Clean the gutters", seasons: [0, 2], from: { date: d(-5) }, est: 90 },
    { id: "jfurnace", thingId: "thouse", name: "Service the furnace", seasons: [2], from: { date: d(-365) }, est: 45 },
    { id: "jac", thingId: "thouse", name: "Service the AC", seasons: [0], from: { date: d(-168) }, est: 45 },
    { id: "jheater", thingId: "thouse", name: "Flush the water heater", every: [1, "y"], from: { date: d(-330) }, est: 60 },
    { id: "jdryer", thingId: "thouse", name: "Clean the dryer vent", every: [1, "y"], from: { date: d(-253) }, est: 30 },
    { id: "jhood", thingId: "thouse", name: "Clean the range hood filter", every: [2, "m"], from: { date: d(-36) }, est: 15 },
    { id: "joil", thingId: "tcar", name: "Change the oil", every: [6, "m"], meterEvery: 5000, from: { date: d(-121), reading: 45000 }, est: 60 },
    { id: "jrotate", thingId: "tcar", name: "Rotate the tires", meterEvery: 7500, from: { date: d(-213), reading: 42000 }, est: 45 },
    { id: "jwinter", thingId: "tcar", name: "Put the winter tires on", seasons: [3], from: { date: d(-189) }, est: 60 },
    { id: "jwipers", thingId: "tcar", name: "Replace the wiper blades", every: [1, "y"], from: { date: d(-303) }, est: 15 }
  ];
  if (kind === "big") {
    things.push({ id: "tvan", name: "Minivan", meter: "mi", pace: 9000 }, { id: "tmower", name: "Lawn mower", meter: "h", pace: 40 }, { id: "tbike", name: "Bikes" });
    jobs.push(
      { id: "jvanoil", thingId: "tvan", name: "Change the oil", every: [6, "m"], meterEvery: 5000, from: { date: d(-60), reading: 61000 }, est: 60 },
      { id: "jvanbrake", thingId: "tvan", name: "Check the brakes", every: [1, "y"], from: { date: d(-340) }, est: 45 },
      { id: "jvanseat", thingId: "tvan", name: "Clean the car seats", every: [3, "m"], from: { date: d(-80) }, est: 60 },
      { id: "jblade", thingId: "tmower", name: "Sharpen the blade", meterEvery: 25, every: [1, "y"], from: { date: d(-200), reading: 110 }, est: 30 },
      { id: "jmoweroil", thingId: "tmower", name: "Change the mower oil", seasons: [0], from: { date: d(-190) }, est: 30 },
      { id: "jwinterize", thingId: "tmower", name: "Winterize the mower", seasons: [2], from: { date: d(-370) }, est: 45 },
      { id: "jchain", thingId: "tbike", name: "Oil the chains", every: [1, "m"], from: { date: d(-20) }, est: 15 },
      { id: "jtubes", thingId: "tbike", name: "Check the tires", every: [2, "w"], from: { date: d(-9) }, est: 10 }
    );
  }
  const readings = [{ thingId: "tcar", date: d(-10), value: 48210 }].concat(kind === "big" ? [{ thingId: "tvan", date: d(-12), value: 63400 }, { thingId: "tmower", date: d(-30), value: 118 }] : []);
  return gen.appaWorld({ things, jobs, readings });
}

// --- Turtleduck: the recipes, and the plan from today through next Sunday (dinners only, or every meal), a trip each Saturday ---
function turtleduck(rng, kind) {
  const plan = [], next = addDays(TODAY, 11), dinners = ["rc-chili", "rc-friedrice", "rc-curry", "rc-stew"];
  for (let d = TODAY; d <= next; d = addDays(d, 1)) {
    if (kind === "full") plan.push({ date: d, meal: "breakfast", recipeId: "rc-oats" }, { date: d, meal: "lunch", recipeId: rng() < 0.5 ? "rc-salad" : "rc-bowl" });
    plan.push({ date: d, meal: "dinner", recipeId: gen.pick(rng, dinners) });
  }
  return gen.turtleduck({ plan, trips: [addDays(TODAY, 3), addDays(TODAY, 10)] });
}

// Errands to start with: some overdue, some this week, some with no day.
function errands(rng, n) {
  return Array.from({ length: n }, (_, i) => {
    const [text, minutes] = gen.ERRANDS[i % gen.ERRANDS.length], r = rng();
    return { text, minutes, due: r < 0.25 ? addDays(TODAY, -1 - Math.floor(rng() * 5)) : r < 0.65 ? addDays(TODAY, Math.floor(rng() * 9)) : "", added: addDays(TODAY, -Math.floor(rng() * 10)) };
  });
}

// The world: { file: an Export all file, goals: Iroh's season goals [{ title, hoursWeek, hoursTotal }], blocks: the baseline's titles }.
function buildWorld(spec, rng) {
  const has = id => spec.apps.includes(id), apps = {}, ago = n => addDays(TODAY, -n);
  const checkup = (n, minutes = 15) => gen.meetings({ checkup: { every: "whenever", minutes, last: ago(n) } });
  const goals = (spec.iroh && SEASON[spec.iroh.season]) || [];
  const seasonGoals = has("iroh") ? goals.map(([id, title, parentId, hoursWeek, hoursTotal]) => ({ id, title, parentId, hoursWeek, hoursTotal })) : [];
  if (has("momo")) apps.momo = gen.momoWorld({ baseline: baseline(spec.baseline, seasonGoals), meet: checkup(spec.checkups || 10, 30) });
  if (has("bosco")) apps.bosco = gen.bosco({ lastDose: ago(5), weights: Array.from({ length: 30 }, (_, i) => ({ date: ago(60 - 2 * i), weight: 212 - i * 0.4 })), meet: checkup(spec.checkups || 20) });
  if (has("wanshitong")) apps.wanshitong = gen.library([{ name: "The Glass Orchard", now: true }, { name: "Lantern Coast", cat: "game", now: true }, { name: "Paper Tides", next: true },
    { name: "Salt and Signal" }, { name: "The Ninth Lighthouse", cat: "movie" }, { name: "Moss Kingdom", cat: "tv" }], checkup(spec.checkups || 30));
  if (has("appa")) apps.appa = { ...appa(rng, spec.appa), meetings: checkup(spec.checkups || 15, 30) };
  if (has("hawky")) apps.hawky = gen.hawkyItems(errands(rng, spec.hawky.open), checkup(spec.checkups || 7));
  if (has("iroh")) {
    const areas = AREAS.slice(0, spec.iroh.areas).map(([id, name]) => ({ id, name, vision: "Made-up words about ten years from now." }));
    const year = YEAR.filter(([id]) => goals.some(g => g[2] === id)).slice(0, spec.iroh.year).map(([id, title, areaId]) => ({ id, title, areaId, period: "2026", doneWhen: "Made up.", reconciled: ago(20) }));
    const season = seasonGoals.map(g => {
      const parentId = year.some(y => y.id === g.parentId) ? g.parentId : "";
      return { ...g, parentId, areaId: parentId ? "" : (areas[0] || {}).id || "", period: "2026-fall", next: "The next small step.", reconciled: ago(6) };
    });
    apps.iroh = gen.iroh({ areas, goals: year.concat(season), meet: gen.meetings({ reconcile: { every: "month", minutes: 20, last: ago(20) }, season: { every: "season", minutes: 60, last: ago(6) }, year: { every: "year", minutes: 120, last: "2026-01-04" } }) });
  }
  if (has("badgermole")) apps.badgermole = { ...gen.history({ weeks: spec.badgermole.weeks, perWeek: Math.min(3, spec.badgermole.target), thisWeek: 1, target: spec.badgermole.target, seed: Math.floor(rng() * 1e6) }), meetings: checkup(spec.checkups || 12) };
  if (has("turtleduck") && spec.turtleduck) apps.turtleduck = { ...turtleduck(rng, spec.turtleduck), meetings: checkup(spec.checkups || 9) };
  if (has("pabu")) {
    const list = people(rng, spec.pabu.people, spec.pabu.visits);
    if (spec.pabu.leap) list.push({ id: "pp-leap", name: "Lee Ann", every: "year", how: "call", minutes: 30, talks: [40], birthday: "02-29" });
    apps.pabu = { ...gen.pabu(list), meetings: checkup(spec.checkups || 14) };
  }
  return { file: gen.exportAll(apps), goals: seasonGoals, blocks: [...new Set(baseline(spec.baseline, seasonGoals).map(c => c.title))] };
}

module.exports = { buildWorld, baseline, SEASON, AREAS, YEAR };
