/* Kyoshi · tests/sim/events.js — a life's events (lives.js): which are under way on a day (vacation, sick, gap, baby, two tabs)
 * and the one-off ones, run on their day before the morning look: an app first used (the cold start's: set up through its own
 * screens), a goal renamed or dropped, a baby (the baseline rewritten, goals paused a season, less done for three months), a
 * device reinstall, an old backup imported, a month on two tabs, Feb 29, and the long haul's changes (things replaced, a new
 * job, retirement). Moves and timings are robust.js's. */
"use strict";
const mo = require("../momo");
const bm = require("../badgermole");
const pb = require("../pabu");
const acts = require("./acts");
const robust = require("./robust");

// What's under way on a day: { kinds (vacation, sick, gap, baby, twoTabs), on: one-offs, starts and ends, until: { kind: last day } }.
function today(L, date) {
  const kinds = new Set(), on = [], until = {};
  L.def.events.forEach(e => {
    if (e.on === date) on.push(e);
    if (e.from && e.from <= date && date <= e.to) { kinds.add(e.kind); until[e.kind] = e.to; if (e.from === date) on.push({ ...e, start: true }); }
    if (e.to && L.addDays(e.to, 1) === date) on.push({ ...e, end: true });
  });
  Object.entries(L.habits.joins || {}).forEach(([app, d]) => { if (d === date) on.push({ kind: "join", app }); });
  return { kinds, on, until };
}

async function run(L, e) {
  try {
    if (e.kind === "join") return await join(L, e.app);
    if (e.kind === "renameGoal") return await renameGoal(L, e);
    if (e.kind === "dropGoal") return await dropGoal(L);
    if (e.kind === "baby") return e.start ? await baby(L, true) : e.end ? await baby(L, false) : null;
    if (e.kind === "gap" && e.end) { L.count("returns"); return null; }
    if (e.kind === "reinstall") return await robust.reinstall(L);
    if (e.kind === "oldImport") return await robust.oldImport(L);
    if (e.kind === "twoTabs") return e.start ? await robust.twoTabs(L, true) : e.end ? await robust.twoTabs(L, false) : null;
    if (e.kind === "leap") return await robust.leap(L);
    if (e.kind === "newJob" || e.kind === "retire") return await workChange(L, e.kind);
    if (e.kind === "replaceThings") return await replaceThings(L);
  } catch (err) {
    L.simErrors.push({ date: L.today, event: e.kind, error: String(err && err.stack || err).slice(0, 600) });
  }
  return null;
}

// --- The cold start: each app set up through its own screens the day it's first used ---
async function join(L, app) {
  L.count(`joined:${app}`);
  const keep = L.mode;
  L.mode = "screens";
  await L.open("phone");
  if (app === "hawky") {
    for (const [text, minutes, due] of [["Buy stamps", 15, L.today], ["Return the parcel", 30, L.addDays(L.today, 2)], ["Book a haircut", 15, ""]]) await acts.hawkyAdd(L, { text, minutes, due });
  } else if (app === "pabu") {
    for (const [name, every, how] of [["Ada", "week", "call"], ["Bram", "month", "call"], ["Cleo", "2weeks", "text"], ["Dov", "quarter", "visit"], ["Esme", "none", "call"]]) await acts.pabuAdd(L, { name, every, how });
  } else if (app === "badgermole") {
    await L.switchTo("badgermole");
    const p = L.page, tab = { page: p };
    await bm.openFold(tab, "exercises");
    await p.click("#kMount #starterBtn");
    for (const [name, lines] of [["Upper", [["Bench press", 3, 5, 95], ["Barbell row", 3, 8, 75]]], ["Lower", [["Squat", 3, 5, 135], ["Deadlift", 1, 5, 155]]]]) {
      await bm.openFold(tab, "routines");
      await p.click("#kMount #addRoutineBtn");
      await p.fill("#kMount #routineName", name);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) await p.click("#kMount #routineAddLineBtn");
        const [exercise, sets, reps, weight] = lines[i], line = p.locator("#kMount #routineLines .line").nth(i);
        await line.locator("select").selectOption({ label: exercise });
        await line.locator('input[data-f="sets"]').fill(String(sets));
        await line.locator('input[data-f="reps"]').fill(String(reps));
        await line.locator('input[data-f="weight"]').fill(String(weight));
      }
      await p.click('#kMount #routineForm button[type="submit"]');
    }
    await bm.openFold(tab, "program");
    for (const name of ["Upper", "Lower"]) { await p.selectOption("#kMount #programSelect", { label: name }); await p.click("#kMount #programAddBtn"); }
    L.tap(24);
  } else if (app === "iroh") {
    // Iroh's meetings have asked for time since the first day: the person holds them now, setting this season's goals.
    for (const m of ["year", "season", "reconcile"]) await acts.meetingDone(L, "iroh", m);
    const goals = require("./world").SEASON.light.map(([id, title, parentId, hoursWeek, hoursTotal]) => ({ title, hoursWeek, hoursTotal }));
    for (const g of goals) await acts.addGoal(L, g);
    L.world.goals = goals;
  } else if (app === "turtleduck") {
    await L.switchTo("turtleduck");
    const p = L.page;
    await p.click('#kMount #nav [data-view="recipes"]');
    await p.click("#kMount #pasteBtn");
    await p.fill("#kMount #pasteText", ["# Chili", "Meal: dinner", "Serves: 4", "Prep: 15", "Cook: 45", "- 500 g ground beef", "- 2 cans kidney beans", "Brown the beef, add the rest.", "",
      "# Fried rice", "Meal: dinner", "Serves: 2", "Cook: 15", "- 1 kg rice", "- 2 eggs", "Fry it all.", "", "# Lentil soup", "Meal: dinner", "Serves: 4", "Cook: 40", "- 400 g lentils", "- 1 onion", "Simmer."].join("\n"));
    await p.click("#kMount #pastePreviewBtn");
    await p.click("#kMount #pasteAddBtn");
    L.tap(5);
    L.habits.turtleduck = "dinners";
  }
  L.mode = keep;
}

// --- Iroh: a goal renamed mid-season; one dropped at a reconcile ---
async function renameGoal(L, e) {
  const id = await L.page.evaluate(t => { const I = Kyoshi.apps.iroh, g = I.goalsIn(I.currentSeason()).find(x => x.id === t || x.title === t); return g ? g.id : ""; }, e.goal);
  if (!id) return;
  const old = await L.page.evaluate(id => Kyoshi.apps.iroh.goalById(id).title, id);
  await acts.renameGoal(L, id, e.title);
  L.count("goalRenamed");
  L.memory.renamed = { from: old, to: e.title, on: L.today };
}
async function dropGoal(L) {
  const g = await L.page.evaluate(() => { const I = Kyoshi.apps.iroh, list = I.goalsIn(I.currentSeason()).filter(I.isOpen); return list.length ? { id: list[list.length - 1].id, title: list[list.length - 1].title } : null; });
  if (!g) return;
  await acts.reconcile(L, g.id, "dropped");
  L.count("goalDropped");
}

// --- A baby: the baseline rewritten (a care block every day, work off for a while), goals paused a season; back to work after ---
async function baby(L, start) {
  await L.open("computer");
  await mo.view(L.tab, "base");
  const p = L.page;
  if (start) {
    await mo.newCard(L.tab, { title: "Baby care", hours: 5, days: [0, 1, 2, 3, 4, 5, 6] });
    await removeTitled(L, "Work");
    await removeTitled(L, "Commute");
    L.pauseGoals = true;
  } else {
    await mo.newCard(L.tab, { title: "Work", hours: 7, days: [0, 1, 2, 3, 4] });
    L.pauseGoals = false;
  }
  L.tap(12);
  L.count(start ? "babyBorn" : "backToWork");
  await mo.view(L.tab, "this");
  return p;
}
// Every card of a title on the board on screen, deleted with Alt+click (the board's quick delete).
async function removeTitled(L, title) {
  for (let i = 0; i < 20; i++) {
    const id = await L.page.evaluate(t => { const c = Kyoshi.apps.momo.shownList().cards.find(x => x.title === t); return c ? c.id : ""; }, title);
    if (!id) return;
    await L.page.click(`#kMount #board .card[data-id="${id}"]`, { modifiers: ["Alt"], position: { x: 10, y: 6 } });
    L.tap(1);
  }
}

// --- The long haul: a new job's baseline (longer days), then retirement's (no work) ---
async function workChange(L, kind) {
  await L.open("computer");
  await mo.view(L.tab, "base");
  await removeTitled(L, "Work");
  await removeTitled(L, "Commute");
  if (kind === "newJob") await mo.newCard(L.tab, { title: "Work", hours: 9, days: [0, 1, 2, 3, 4] });
  else await mo.newCard(L.tab, { title: "Volunteering", hours: 3, days: [1, 3] });
  L.count(kind);
  await mo.view(L.tab, "this");
}
// Appa: the car replaced (the old one archived, a new one with its jobs).
async function replaceThings(L) {
  await L.page.evaluate(() => {
    const A = Kyoshi.apps.appa, U = Kyoshi.util, now = Date.now(), car = A.thingById("tcar");
    if (car) Object.assign(car, { archived: true, u: now });
    A.S.things.push(...A.cleanThings([{ id: "tcar2", name: "New car", meter: "mi", pace: 10000, at: now, u: now }]));
    A.S.jobs.push(...A.cleanJobs([
      { id: "jnewoil", thingId: "tcar2", name: "Change the oil", every: { n: 12, unit: "m" }, meterEvery: 10000, from: { date: U.todayStr(), reading: 10 }, est: 60, at: now, u: now },
      { id: "jnewrot", thingId: "tcar2", name: "Rotate the tires", meterEvery: 7500, from: { date: U.todayStr(), reading: 10 }, est: 45, at: now, u: now }
    ]));
    A.S.readings.push(...A.cleanReadings([{ id: "rdnew1", thingId: "tcar2", date: U.todayStr(), value: 10, at: now, u: now }]));
    A.save(); A.renderAll();
  });
  L.count("thingsReplaced");
}

module.exports = { today, run, join };
