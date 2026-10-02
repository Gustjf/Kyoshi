/* Sample data generator — run `node samples/make-sample-data.js` (optionally with a date, YYYY-MM-DD, as "today").
 * Writes samples/kyoshi-sample-year.json: one year of made-up data ending today, as a Kyoshi "Export all" file for
 * Bosco, Momo, Wan Shi Tong and Appa. Everything is invented (nothing personal); the same day gives the same file.
 * To use it: Developer Mode (Ctrl+9) → Import all → pick the file. It REPLACES what those four apps hold. */
"use strict";
const fs = require("fs");
const path = require("path");

const TODAY = process.argv[2] || new Date().toISOString().slice(0, 10);
const DAY = 864e5;
const ms = d => Date.parse(d + "T12:00:00Z");
const ds = t => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => ds(ms(d) + n * DAY);
const addMonths = (d, n) => { // months stop at the month's end
  const [y, m, day] = d.split("-").map(Number), t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return ds(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last), 12));
};
const START = addDays(TODAY, -364);
const dayOf = d => Math.round((ms(d) - ms(START)) / DAY); // 0 = START, 364 = today
const dow = d => (new Date(ms(d)).getUTCDay() + 6) % 7;    // 0 = Monday
const weekKey = d => addDays(d, -dow(d));

// Seeded random numbers, so the same day gives the same file.
let seed = 20261002;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (a, b) => a + rnd() * (b - a);
const chance = p => rnd() < p;
const pick = list => list[Math.floor(rnd() * list.length)];
const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const idChars = "abcdefghijklmnopqrstuvwxyz0123456789";
const newId = () => Array.from({ length: 8 }, () => idChars[Math.floor(rnd() * 36)]).join("");
const round = (v, p = 1) => Math.round(v * 10 ** p) / 10 ** p;

/* ======================= Bosco ======================= */
function bosco() {
  const rate = w => (w < 12 ? 0.8 : w < 30 ? 0.5 : w < 35 ? 0.05 : 0.4); // % of weight lost a week
  let trend = 236.4;
  const days = new Map();
  const away = [[88, 94], [231, 237]]; // trips with no weigh-ins
  for (let i = 0; i <= 364; i++) {
    trend *= 1 - rate(Math.floor(i / 7)) / 100 / 7;
    const gap = away.some(([a, b]) => i >= a && i <= b);
    if (!gap && chance(0.9)) {
      const date = addDays(START, i), weekend = dow(date) >= 5 ? 0.6 : 0;
      days.set(date, { date, weight: round(trend + weekend + normal() * 0.9), doseMg: null, medication: null });
    }
  }
  // Weekly tirzepatide, now and then a day late; the dose goes up every few weeks.
  const mgFor = n => (n < 4 ? 2.5 : n < 8 ? 5 : n < 12 ? 7.5 : n < 20 ? 10 : n < 36 ? 12.5 : 15);
  let date = addDays(START, 2), n = 0, doses = 0;
  while (date <= TODAY) {
    const e = days.get(date) || { date, weight: null, doseMg: null, medication: null };
    Object.assign(e, { doseMg: mgFor(n), medication: "tirzepatide" });
    days.set(date, e);
    doses += e.doseMg;
    date = addDays(date, 7 + (chance(0.12) ? 1 : 0));
    n++;
  }
  const entries = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const iso = addDays(TODAY, -30) + "T14:00:00.000Z";
  return {
    schemaVersion: 4, appVersion: "7.280", unit: "lb", name: "Sample", medication: "tirzepatide",
    dosePlan: { medication: "tirzepatide", intervalDays: 7, weeklyMg: 15, doseTime: "08:00", nextDose: null, savedAt: iso },
    vial: { medication: "tirzepatide", mgPerMl: 15, vialMg: 30, bacMl: 2, savedAt: iso },
    paceGoal: { dir: "lose", weeklyPct: 1, rangePct: 0.25 },
    entries, goals: [200, 175, 160, 150],
    cumulativeDoseMgByMedication: { tirzepatide: round(doses, 2) }
  };
}

/* ======================= Wan Shi Tong ======================= */
function wanshitong() {
  const at = off => ms(addDays(START, off));
  const mk = (cat, name, info, have, why, added, started, done) => ({
    id: newId(), cat, name, info, have, why,
    added: addDays(START, added), started: started === null ? "" : addDays(START, started), done: done === null ? "" : addDays(START, done),
    deleted: false, at: at(added), u: at(done ?? started ?? added)
  });
  const items = [
    // Finished
    mk("book", "Piranesi", "Susanna Clarke", "owned", "", -20, 5, 30),
    mk("book", "Project Hail Mary", "Andy Weir", "borrowed", "Everyone at work won't stop talking about it.", -5, 32, 60),
    mk("book", "The Name of the Wind", "Patrick Rothfuss", "owned", "", 10, 62, 110),
    mk("book", "Braiding Sweetgrass", "Robin Wall Kimmerer", "borrowed", "From the garden club.", 40, 112, 150),
    mk("book", "Klara and the Sun", "Kazuo Ishiguro", "downloaded", "", 60, 155, 176),
    mk("book", "Atomic Habits", "James Clear", "owned", "", 100, 180, 205),
    mk("book", "The Left Hand of Darkness", "Ursula K. Le Guin", "owned", "Recommended by Sam.", 120, 210, 240),
    mk("book", "Pachinko", "Min Jin Lee", "borrowed", "", 140, 245, 290),
    mk("book", "Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", "downloaded", "Pairs well with the game list.", 150, 292, 320),
    mk("movie", "Spirited Away", "Miyazaki, 2001", "owned", "", -10, 12, 12),
    mk("movie", "Everything Everywhere All at Once", "2022", "downloaded", "", 15, 40, 40),
    mk("movie", "Past Lives", "Celine Song, 2023", "downloaded", "", 50, 95, 95),
    mk("movie", "Arrival", "Villeneuve, 2016", "borrowed", "", 70, 140, 140),
    mk("movie", "The Grand Budapest Hotel", "Wes Anderson, 2014", "downloaded", "", 110, 200, 200),
    mk("movie", "Perfect Days", "Wim Wenders, 2023", "downloaded", "", 180, 260, 260),
    mk("movie", "Paddington 2", "2017", "downloaded", "Cheer-up movie.", 240, 300, 300),
    mk("movie", "Spider-Man: Across the Spider-Verse", "2023", "downloaded", "", 250, 330, 330),
    mk("tv", "Frieren: Beyond Journey's End", "2023, Crunchyroll", "downloaded", "", 5, 70, 130),
    mk("tv", "Arcane", "2021, Netflix", "downloaded", "", 80, 135, 160),
    mk("tv", "Severance", "2022, Apple TV+", "downloaded", "", 120, 175, 215),
    mk("tv", "Shōgun", "2024, FX", "downloaded", "", 160, 220, 250),
    mk("tv", "Cowboy Bebop", "1998, Netflix", "downloaded", "", 200, 262, 280),
    mk("game", "Outer Wilds", "Switch or PC", "owned", "Go in blind.", -3, 60, 100),
    mk("game", "Hades", "Switch", "owned", "", 90, 150, 190),
    mk("game", "Hollow Knight", "Switch", "owned", "", 130, 270, 330),
    // In progress
    mk("book", "Dune", "Frank Herbert", "owned", "", 190, 335, null),
    mk("tv", "The Bear", "2022, Hulu", "downloaded", "", 300, 345, null),
    mk("game", "Disco Elysium", "PC", "owned", "On sale, finally.", 280, 320, null),
    // Up next
    mk("book", "The Wind-Up Bird Chronicle", "Haruki Murakami", "owned", "After Dune, something shorter on the mood.", 260, null, null),
    // Backlog
    mk("book", "The Dispossessed", "Ursula K. Le Guin", "", "", 125, null, null),
    mk("book", "Gideon the Ninth", "Tamsyn Muir", "borrowed", "Skeleton lesbians in space, apparently.", 170, null, null),
    mk("book", "A Memory Called Empire", "Arkady Martine", "", "", 200, null, null),
    mk("book", "Educated", "Tara Westover", "", "", 230, null, null),
    mk("book", "The Overstory", "Richard Powers", "owned", "", 270, null, null),
    mk("movie", "Aftersun", "Charlotte Wells, 2022", "", "", 100, null, null),
    mk("movie", "Drive My Car", "Hamaguchi, 2021", "", "", 150, null, null),
    mk("movie", "The Iron Giant", "Brad Bird, 1999", "", "", 210, null, null),
    mk("movie", "Perfect Blue", "Satoshi Kon, 1997", "", "Not a relaxing one, I'm told.", 285, null, null),
    mk("tv", "Mushishi", "2005, anime", "", "", 30, null, null),
    mk("tv", "Station Eleven", "2021, Max", "", "", 165, null, null),
    mk("tv", "Fleabag", "2016, Prime Video", "", "", 235, null, null),
    mk("tv", "Delicious in Dungeon", "2024, Netflix", "", "", 310, null, null),
    mk("game", "Celeste", "Switch", "owned", "", 20, null, null),
    mk("game", "Return of the Obra Dinn", "PC", "", "", 135, null, null),
    mk("game", "Stardew Valley", "Switch", "", "For a rainy week.", 215, null, null),
    mk("game", "Tunic", "Switch or PC", "", "", 295, null, null),
    mk("game", "Slay the Spire", "Switch", "", "", 325, null, null)
  ];
  const spot = name => { const i = items.find(x => x.name === name); return { id: i.id, u: i.u }; };
  const slots = { now: spot("Dune"), now2: spot("The Bear"), now3: spot("Disco Elysium"), next: spot("The Wind-Up Bird Chronicle") };
  return { schemaVersion: 1, appVersion: "2.251", items, slots };
}

/* ======================= Momo ======================= */
function momo() {
  const stamp = off => ms(addDays(START, off));
  const mkGoal = (name, target, perWeek, due, maxWeek) => ({ id: newId(), name, target, perWeek, start: 0, due, maxWeek, log: {}, deleted: false, u: stamp(0) });
  const touch = mkGoal("Touch typing", 20, 0, "", 4);
  const japanese = mkGoal("Japanese", 300, 0, addDays(TODAY, 190), 6);
  const side = mkGoal("Side project", 500, 0, "", 8);
  const exercise = mkGoal("Exercise", 0, 4, "", 10);
  const goals = [japanese, side, exercise, touch];
  const card = (title, hours, day, goal = null, base = false) => ({ id: newId(), title, hours, day, goalId: goal ? goal.id : null, base, parentId: null, pos: "bottom", pin: null });

  const key0 = weekKey(START), thisKey = weekKey(TODAY), nextKey = addDays(thisKey, 7);
  const off = new Set([addDays(START, 150), addDays(START, 151)].map(weekKey).concat(weekKey(addDays(TODAY, -280)), addDays(weekKey(addDays(TODAY, -280)), 7))); // two vacation weeks
  const weeks = {};

  function buildWeek(key, kind) { // kind: "past" | "this" | "next"
    const w = Math.round((ms(key) - ms(key0)) / (7 * DAY)), cards = [], planned = {};
    const vacation = off.has(key);
    for (let d = 0; d < 7; d++) {
      const work = d < 5, list = [];
      const add = (c, goal) => { list.push(c); if (goal) planned[goal.id] = (planned[goal.id] || 0) + c.hours; };
      const doseDay = d === 6 && kind !== "past"; // the 0800 dose: Sleep ends first, with a little free time after it
      add(card("Sleep", doseDay ? 8 : d >= 5 ? 8.5 : chance(0.25) ? 7.5 : 8, d, null, true));
      if (doseDay) add(card("Free time", 0.5, d));
      if (work) add(card("Meals & chores", 1, d, null, true));
      if (work && !vacation) { add(card("Commute", 1, d, null, true)); add(card("Work", chance(0.15) ? 9 : 8, d, null, true)); }
      if (work && vacation) add(card("Time off", 8, d));
      if (!work) {
        add(card("Meals & chores", 2, d, null, true));
        if (d === 5 && !vacation) add(card("Errands", 2, d));
        if (d === 5 && vacation) add(card("Trip", 8, d));
      }
      // goal cards
      if (w < 10 && [0, 2, 4].includes(d)) add(card("Touch typing", 1, d, touch), touch);
      if (w >= 6 && [0, 2, 4, 6].includes(d)) add(card("Japanese", d === 6 ? 1.5 : 1, d, japanese), japanese);
      if (w >= 2 && (d === 5 || d === 6)) add(card("Side project", d === 5 ? 3 : 2, d, side), side);
      if (w >= 2 && [1, 3, 5].includes(d)) add(card("Exercise", 1, d, exercise), exercise);
      if (w >= 2 && d === 6) add(card("Exercise", 1, d, exercise), exercise);
      if (d === 6 || (d === 4 && chance(0.5))) add(card("Friends", d === 6 ? 3 : 2.5, d));
      // what Appa sends: the car and the vacuum
      if (kind !== "past" && d === 5) add(card("Civic maintenance", 1, d));
      if (kind !== "past" && d === 6) add(card("Roomba maintenance", 0.5, d));
      // whatever is left is free time (at most a day in all)
      const used = list.reduce((s, c) => s + c.hours, 0), free = Math.max(0, 24 - used);
      if (free > 0) list.push(card("Free time", free, d));
      cards.push(...list);
    }
    return { cards, planned };
  }

  for (let key = key0; key <= nextKey; key = addDays(key, 7)) {
    const kind = key === nextKey ? "next" : key === thisKey ? "this" : "past";
    const { cards, planned } = buildWeek(key, kind);
    weeks[key] = { cards, closed: kind === "past", u: ms(addDays(key, 6)) };
    if (kind === "past") { // closed out: what was planned happened, give or take a skipped session
      goals.forEach(g => {
        let h = planned[g.id] || 0;
        if (h && chance(0.18)) h = Math.max(0, h - pick([0.5, 1, 1.5, 2]));
        if (h > 0) g.log[key] = h;
      });
    }
  }
  goals.forEach(g => { g.u = ms(addDays(thisKey, -1)); });

  const SLEEP = { c: "violet" }, put = (c, off2) => ({ c, u: stamp(off2) });
  const colors = {
    "t:sleep": put("violet", 0), "t:work": put("blue", 0), "t:commute": put("teal", 0), "t:meals & chores": put("yellow", 0),
    "t:time off": put("green", 0), "t:trip": put("sky", 0), "t:errands": put("clay", 0), "t:friends": put("pink", 0),
    "t:civic maintenance": put("red", 0), "t:roomba maintenance": put("coral", 0),
    [`g:${japanese.id}`]: put("orange", 0), [`g:${side.id}`]: put("indigo", 0), [`g:${exercise.id}`]: put("lime", 0), [`g:${touch.id}`]: put("magenta", 0)
  };
  void SLEEP;

  const baseline = { cards: [], u: stamp(0) };
  for (let d = 0; d < 7; d++) {
    baseline.cards.push(card("Sleep", 8, d));
    if (d < 5) baseline.cards.push(card("Meals & chores", 1, d), card("Commute", 1, d), card("Work", 8, d));
    else baseline.cards.push(card("Meals & chores", 2, d));
  }
  return { schemaVersion: 2, appVersion: "5.764", weeks, baseline, goals, colors };
}

/* ======================= Appa ======================= */
function appa() {
  const T = n => ms(addDays(START, n));
  const idx = d => dayOf(d); // may be negative: before the year began
  const mk = o => ({ id: newId(), deleted: false, at: T(-300), u: T(-300), ...o });
  const doc = (title, link) => ({ id: newId(), title, link });

  // The Civic's odometer, a cumulative sum of days from before the year through today.
  const odo = {}; let miles = 58400 - 400 * 30;
  for (let i = -400; i <= 364; i++) { odo[i] = Math.round(miles); miles += Math.max(0, 30 + normal() * 18 + (dow(addDays(START, i)) >= 5 ? 8 : 0) + (i % 90 === 0 ? 150 : 0)); }
  const mower = {}; let hours = 31.2;
  for (let i = -400; i <= 364; i++) { const m = +addDays(START, i).slice(5, 7); mower[i] = round(hours, 1); if (m >= 4 && m <= 10 && dow(addDays(START, i)) === 5) hours += between(0.8, 1.4); }

  const civicManual = doc("Owner's manual", "https://example.com/manuals/civic-owners.pdf");
  const civicService = doc("Service schedule", "https://example.com/manuals/civic-service.pdf");
  const roombaDoc = doc("User guide", "https://example.com/manuals/roomba.pdf");
  const jackDoc = doc("Jack instructions", "https://example.com/manuals/floor-jack.pdf");
  const mowerDoc = doc("Operator's manual", "https://example.com/manuals/mower.pdf");

  const civic = mk({ name: "Civic", about: "2019 Honda Civic EX", serial: "", meter: "mi", pace: 11000, docs: [civicManual, civicService], archived: false });
  const roomba = mk({ name: "Roomba", about: "Robot vacuum", serial: "", meter: "", pace: 0, docs: [roombaDoc], archived: false });
  const jack = mk({ name: "Floor jack", about: "3-ton trolley jack", serial: "", meter: "", pace: 0, docs: [jackDoc], archived: false });
  const mowerT = mk({ name: "Lawn mower", about: "21-inch push mower", serial: "", meter: "h", pace: 40, docs: [mowerDoc], archived: false });
  const bike = mk({ name: "Old commuter bike", about: "Sold in the spring", serial: "", meter: "", pace: 0, docs: [], archived: true });
  const things = [civic, roomba, jack, mowerT, bike];

  // Jobs: where each counts from (days before the year started), how often, how long it takes, its source.
  // base: usual minutes · by: a shop that sometimes does it · parts: usual cost in dollars
  const job = (thing, name, every, opts = {}) => {
    const fromDay = opts.fromDay ?? -Math.round(between(30, 200));
    const reading = thing.meter === "mi" ? odo[fromDay] : thing.meter === "h" ? mower[fromDay] : null;
    return {
      ...mk({ thingId: thing.id, name, every: every || null, seasons: opts.seasons || [], meterEvery: opts.meterEvery || null,
        from: { date: addDays(START, fromDay), reading }, est: opts.est || null,
        source: { docId: (opts.doc || thing.docs[0] || { id: "" }).id, where: opts.where || "" }, notes: opts.notes || "" }),
      meta: { base: opts.base || 30, by: opts.by || "", parts: opts.parts || 0 }
    };
  };
  const jobs = [
    job(civic, "Oil & filter change", { n: 6, unit: "m" }, { meterEvery: 5000, base: 45, est: 45, by: "Quick Lube on 5th", parts: 62, doc: civicService, where: "p. 12",
      notes: "- 0W-20 full synthetic, 3.7 qt\n- 17 mm drain plug, 29 ft-lb\n- New crush washer every time\n- Reset the maintenance minder afterwards" }),
    job(civic, "Tire rotation", null, { meterEvery: 5000, base: 35, est: 30, by: "", parts: 0, doc: civicService, where: "p. 14", notes: "- Front to back, no side swap\n- Torque lugs to 80 ft-lb\n- Check pressure after" }),
    job(civic, "Engine air filter", { n: 1, unit: "y" }, { meterEvery: 15000, base: 10, est: 10, parts: 18, where: "p. 301", notes: "- Part: Honda 17220-5AA-A00" }),
    job(civic, "Cabin air filter", { n: 1, unit: "y" }, { base: 15, est: 15, parts: 16, where: "p. 304" }),
    job(civic, "Brake fluid", { n: 3, unit: "y" }, { base: 60, by: "Kai's Garage", parts: 95, doc: civicService, where: "p. 18", fromDay: -330 }),
    job(civic, "Wiper blades", { n: 1, unit: "y" }, { base: 10, parts: 28, where: "p. 296", fromDay: -280 }),
    job(civic, "Check tire pressure", { n: 1, unit: "m" }, { base: 8, est: 10, where: "p. 285", notes: "- 35 psi cold, front and rear\n- Don't forget the spare", fromDay: -20 }),
    job(civic, "Wash & wax", null, { seasons: [0, 2], base: 120, parts: 14, fromDay: -170 }),
    job(roomba, "Empty bin & clean brushes", { n: 2, unit: "w" }, { base: 10, est: 10, where: "p. 9", fromDay: -10 }),
    job(roomba, "Replace filter", { n: 2, unit: "m" }, { base: 5, parts: 7, where: "p. 11", fromDay: -40 }),
    job(roomba, "Replace side brush", { n: 6, unit: "m" }, { base: 5, parts: 9, where: "p. 12", fromDay: -120 }),
    job(roomba, "Replace main brush", { n: 1, unit: "y" }, { base: 10, parts: 22, where: "p. 12", fromDay: -200 }),
    job(jack, "Check hydraulic fluid", { n: 1, unit: "y" }, { base: 20, parts: 6, where: "p. 3", fromDay: -150 }),
    job(jack, "Lubricate pivots", { n: 6, unit: "m" }, { base: 10, where: "p. 3", fromDay: -90 }),
    job(mowerT, "Oil change", { n: 1, unit: "y" }, { meterEvery: 25, base: 25, est: 20, parts: 9, where: "p. 22", notes: "- SAE 30, 15 oz\n- Tip it air-filter side up\n- Run it dry of fuel first", fromDay: -260 }),
    job(mowerT, "Sharpen blade", null, { seasons: [0], base: 40, where: "p. 24", fromDay: -330 }),
    job(mowerT, "Air filter", { n: 1, unit: "y" }, { meterEvery: 50, base: 10, parts: 8, where: "p. 23", fromDay: -300 }),
    job(mowerT, "Spark plug", { n: 1, unit: "y" }, { base: 15, parts: 5, where: "p. 23", fromDay: -280 }),
    job(mowerT, "Winterize", null, { seasons: [3], base: 30, where: "p. 27", fromDay: -310, notes: "- Fuel stabilizer, then run 5 min\n- Clean the deck" })
  ];

  // Walk each job through the year: when it comes due (time, season or meter, whichever first), and when it got done.
  const SEASON_DAYS = ["03-20", "06-21", "09-22", "12-21"];
  const seasonAfter = (d, list) => {
    const y = +d.slice(0, 4);
    return [y, y + 1, y + 2].flatMap(yy => list.map(s => `${yy}-${SEASON_DAYS[s]}`)).filter(x => x > d).sort()[0];
  };
  const meterAt = (thing, i) => (thing.meter === "mi" ? odo[i] : thing.meter === "h" ? mower[i] : null);
  const events = []; // { job, date, reading }
  const thingOf = j => things.find(t => t.id === j.thingId);
  jobs.forEach(j => {
    const thing = thingOf(j);
    let last = { day: idx(j.from.date), reading: j.from.reading };
    for (let guard = 0; guard < 40; guard++) {
      const dueDates = [];
      if (j.every) dueDates.push(j.every.unit === "m" ? addMonths(addDays(START, last.day), j.every.n) : j.every.unit === "y" ? addMonths(addDays(START, last.day), 12 * j.every.n) : addDays(addDays(START, last.day), j.every.n * (j.every.unit === "w" ? 7 : 1)));
      if (j.seasons.length) dueDates.push(seasonAfter(addDays(START, last.day), j.seasons));
      if (j.meterEvery && last.reading !== null) {
        const target = last.reading + j.meterEvery;
        const hit = Object.keys(thing.meter === "mi" ? odo : mower).map(Number).find(i => i > last.day && meterAt(thing, i) >= target);
        if (hit !== undefined) dueDates.push(addDays(START, hit));
      }
      if (!dueDates.length) break;
      const due = dueDates.sort()[0];
      const doneDay = idx(due) + Math.floor(between(0, 11)) * (chance(0.2) ? 2 : 1);
      if (doneDay > 364) break;
      if (doneDay >= 0) events.push({ job: j, date: addDays(START, doneDay), reading: meterAt(thing, doneDay) });
      last = { day: doneDay, reading: meterAt(thing, doneDay) };
    }
  });

  // One record per thing and day, holding every job done then.
  const groups = new Map();
  events.forEach(e => { const k = e.job.thingId + e.date; (groups.get(k) || groups.set(k, []).get(k)).push(e); });
  const records = [...groups.values()].map(list => {
    const j0 = list[0].job, date = list[0].date, thing = thingOf(j0);
    const shop = list.find(e => e.job.meta.by && chance(0.6));
    const by = shop ? shop.job.meta.by : "";
    const cost = Math.round(list.reduce((s, e) => s + e.job.meta.parts, 0) * (by ? 1.4 : 1) * 100);
    const notes = list.some(e => e.job.name === "Oil & filter change") ? pick(["Oil was a little dark.", "Next one due in the spring.", "", "Dropped the drain plug; found it."]) : chance(0.1) ? "All good." : "";
    return {
      ...mk({ thingId: thing.id, date, reading: thing.meter ? list[0].reading : null, title: "", at: ms(date), u: ms(date),
        jobs: list.map(e => ({ jobId: e.job.id, name: e.job.name, minutes: Math.max(1, Math.round(e.job.meta.base * between(0.8, 1.25))), timed: !by && chance(0.5) })),
        by, cost: cost || null, notes, files: [],
        links: chance(0.15) && cost ? [{ url: `https://example.com/receipts/${date.replace(/-/g, "")}`, label: "Receipt" }] : [] })
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
  // A one-off record that isn't a job, and the bike's last days.
  records.push(mk({ thingId: civic.id, date: addDays(START, 120), reading: odo[120], title: "New battery", jobs: [], by: "Kai's Garage", cost: 14900, notes: "Old one was five years old and slow to start.", files: [], links: [], at: T(120), u: T(120) }));
  records.push(mk({ thingId: bike.id, date: addDays(START, 20), reading: null, title: "Chain & brake pads", jobs: [], by: "", cost: 4200, notes: "Last tune-up before selling it.", files: [], links: [], at: T(20), u: T(20) }));
  records.sort((a, b) => a.date.localeCompare(b.date));

  // Odometer and hour-meter readings, every month or so.
  const readings = [];
  for (let i = 3; i <= 364; i += Math.round(between(24, 38))) {
    readings.push(mk({ thingId: civic.id, date: addDays(START, i), value: odo[i], at: T(i), u: T(i) }));
    if (+addDays(START, i).slice(5, 7) >= 4 && +addDays(START, i).slice(5, 7) <= 10) readings.push(mk({ thingId: mowerT.id, date: addDays(START, i), value: mower[i], at: T(i), u: T(i) }));
  }
  readings.sort((a, b) => a.date.localeCompare(b.date));

  const strip = j => { const { meta, ...rest } = j; return rest; };
  return {
    schemaVersion: 1, appVersion: "1.131", things, jobs: jobs.map(strip), records, readings, files: [],
    settings: { name: "Sample Owner", u: T(-300) }
  };
}

/* ======================= Write it ======================= */
const checkup = (last, minutes = 30) => ({ checkup: { every: "whenever", minutes, last, since: START, u: ms(last) } });
const out = {
  kyoshiVersion: "2.710",
  exportedAt: new Date().toISOString(),
  apps: {
    bosco: { ...bosco(), meetings: checkup(addDays(TODAY, -9)) },
    momo: { ...momo(), meetings: checkup(addDays(TODAY, -3)) },
    wanshitong: { ...wanshitong(), meetings: checkup(addDays(TODAY, -21)) },
    appa: { ...appa(), meetings: checkup(addDays(TODAY, -40)) }
  }
};
const file = path.join(__dirname, "kyoshi-sample-year.json");
fs.writeFileSync(file, JSON.stringify(out));
const a = out.apps;
console.log(`${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB) for ${START} → ${TODAY}`);
console.log(`Bosco: ${a.bosco.entries.length} entries, ${a.bosco.entries[0].weight} → ${[...a.bosco.entries].reverse().find(e => e.weight).weight} lb`);
console.log(`Momo: ${Object.keys(a.momo.weeks).length} weeks, ${a.momo.goals.length} goals`);
console.log(`Wan Shi Tong: ${a.wanshitong.items.length} items`);
console.log(`Appa: ${a.appa.things.length} things, ${a.appa.jobs.length} jobs, ${a.appa.records.length} records, ${a.appa.readings.length} readings`);
