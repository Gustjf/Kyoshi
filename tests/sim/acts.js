/* Kyoshi · tests/sim/acts.js — what a person does in each app that feeds Momo, two ways: through the real page (screens: taps
 * and typing, as tests/<app>.js and the selectors here do it) or through the app's own functions in the page (functions:
 * the same changes its buttons make, and the same save, without drawing the screen). L is the running life (life.js):
 * L.page, L.mode ("screens" | "functions"), L.today, L.rng, L.switchTo(app), L.tap(n). Each returns true when it did it. */
"use strict";
const bm = require("../badgermole");
const td = require("../turtleduck");
const pb = require("../pabu");

const M = "#kMount";
const inPage = (L, fn, arg) => L.page.evaluate(fn, arg);
const clickIf = async (L, sel) => { const el = L.page.locator(sel).first(); if (!(await el.count()) || !(await el.isVisible())) return false; await el.click(); L.tap(1); return true; };

// --- Hawky: quick add (the day and minutes chips), and ✓ ---
async function hawkyAdd(L, e) {
  if (L.mode === "functions") return inPage(L, ({ text, due, minutes }) => {
    const A = Kyoshi.apps.hawky, now = Date.now();
    A.S.items.push({ id: Kyoshi.util.newId(), text, due, minutes, done: "", deleted: false, at: now, u: now });
    A.save(); A.renderAll(); return true;
  }, e);
  await L.switchTo("hawky");
  const p = L.page, tomorrow = L.addDays(L.today, 1);
  await p.fill(`${M} #addText`, e.text);
  const day = !e.due ? "none" : e.due === L.today ? "today" : e.due === tomorrow ? "tomorrow" : "pick";
  await p.click(`${M} #addDays [data-day="${day}"]`);
  if (day === "pick") await p.fill(`${M} #addDate`, e.due);
  const chip = [15, 30, 60].includes(e.minutes) ? String(e.minutes) : "other";
  await p.click(`${M} #addMinutes [data-minutes="${chip}"]`);
  if (chip === "other") await p.fill(`${M} #addOther`, String(e.minutes));
  await p.click(`${M} #addBtn`);
  L.tap(4 + (day === "pick") + (chip === "other"));
  return true;
}
async function hawkyTick(L, id) {
  if (L.mode === "functions") return inPage(L, id => {
    const A = Kyoshi.apps.hawky, i = A.itemById(id);
    if (!i || i.done) return false;
    Object.assign(i, { done: Kyoshi.util.todayStr(), u: Date.now() }); A.save(); A.renderAll(); return true;
  }, id);
  await L.switchTo("hawky");
  return clickIf(L, `${M} .errand[data-id="${id}"] .tick[data-act="tick"]`);
}

// --- Pabu: ✓ (talked today), quick add ---
async function pabuTick(L, id) {
  if (L.mode === "functions") return inPage(L, id => {
    const A = Kyoshi.apps.pabu, p = A.personById(id), today = Kyoshi.util.todayStr();
    if (!p || p.talks.includes(today)) return false;
    p.talks = [today].concat(p.talks).sort().reverse().slice(0, A.MAX_TALKS); p.u = Date.now(); A.save(); A.renderAll(); return true;
  }, id);
  await L.switchTo("pabu");
  return clickIf(L, `${M} .person[data-id="${id}"] .tick[data-act="tick"]`);
}
async function pabuAdd(L, { name, every, how }) {
  if (L.mode === "functions") return inPage(L, ({ name, every, how }) => {
    const A = Kyoshi.apps.pabu;
    A.S.people.push({ id: Kyoshi.util.newId(), name, every, how, minutes: A.HOW[how].minutes, talks: [], note: "", birthday: "", deleted: false, at: Kyoshi.util.now(), u: Date.now() });
    A.save(); A.renderAll(); return true;
  }, { name, every, how });
  await L.switchTo("pabu");
  await pb.quickAdd({ page: L.page }, name, { every, how });
  L.tap(4);
  return true;
}

// --- Appa: a job logged as done ("Already done? Log it", then Done), a meter reading ---
async function appaLog(L, jobId) {
  if (L.mode === "functions") return inPage(L, id => {
    const A = Kyoshi.apps.appa;
    if (!A.jobById(id)) return false;
    A.openRecord({ mode: "log", jobId: id });
    A.$("rcSaveBtn").click();
    return !A.S.rec;
  }, jobId);
  await L.switchTo("appa");
  const p = L.page;
  await p.evaluate(() => Kyoshi.apps.appa.showView("home")); // the person taps back to Appa's home
  if (!(await clickIf(L, `${M} #comingUp button[data-act="open-job"][data-id="${jobId}"]`))) return false;
  if (!(await clickIf(L, `${M} [data-act="log-it"][data-id="${jobId}"]`))) return false;
  await p.waitForSelector(`${M} #recOverlay.open`);
  await p.click(`${M} #rcSaveBtn`);
  L.tap(1);
  return !(await p.locator(`${M} #recOverlay`).evaluate(el => el.classList.contains("open")));
}
async function appaReading(L, thingId) {
  const value = await inPage(L, id => { const A = Kyoshi.apps.appa, t = A.thingById(id), v = t && A.estimate(t); return v === null || v === undefined ? null : Math.round(v); }, thingId);
  if (value === null) return false;
  if (L.mode === "functions") return inPage(L, ([id, v]) => Kyoshi.apps.appa.saveReading(id, v), [thingId, value]);
  await L.switchTo("appa");
  await L.page.evaluate(() => Kyoshi.apps.appa.showView("home"));
  const field = L.page.locator(`${M} input[data-ask="${thingId}"]`);
  if (!(await field.count())) return false;
  await field.fill(String(value));
  await L.page.click(`${M} [data-act="save-ask"][data-id="${thingId}"]`);
  L.tap(2);
  return true;
}

// --- Badgermole: the next workout, every set as planned ---
async function workout(L) {
  if (L.mode === "functions") return inPage(L, () => {
    const A = Kyoshi.apps.badgermole, U = Kyoshi.util, r = A.upNext(0);
    if (!r) return false;
    const now = U.now(), sets = [];
    A.routineItems(r).forEach(x => { for (let n = 1; n <= x.sets; n++) sets.push({ exerciseId: x.exerciseId, name: x.name, bodyweight: x.bodyweight, n, reps: x.reps, weight: x.weight, unit: x.unit, at: now + sets.length * 180000 }); });
    const s = A.cleanSessions([{ id: U.newId(), date: U.todayStr(), routineId: r.id, name: r.name, sets, started: now, finished: now + 45 * 60000, deleted: false, u: Date.now() }])[0];
    A.S.sessions.push(s); A.save(); A.renderAll(); return true;
  });
  await L.switchTo("badgermole");
  const name = await L.page.evaluate(() => { const r = Kyoshi.apps.badgermole.upNext(0); return r ? r.name : ""; });
  if (!name) return false;
  await bm.doSession({ page: L.page, ctx: L.ctx }, name, { minutes: 45 });
  L.tap(4 + 3 * 2);
  return true;
}

// --- Turtleduck: next week's meals and its trip; a trip's groceries bought ---
// plan: [{ date, meal, recipeId }]; trips: dates. On the computer the recipes are dragged onto the grid; on a phone picked.
async function planMeals(L, plan, trips) {
  if (L.mode === "functions") return inPage(L, ({ plan, trips }) => {
    const A = Kyoshi.apps.turtleduck;
    plan.forEach(x => { if (!A.entriesOn(x.date, x.meal).length) A.addRecipe(x.recipeId, x.date, x.meal); });
    trips.forEach(d => { if (!A.hasTrip(d)) A.toggleTrip(d); });
    return true;
  }, { plan, trips });
  await L.switchTo("turtleduck");
  const tab = { page: L.page }, phone = L.device === "phone", names = await L.page.evaluate(() => Object.fromEntries(Kyoshi.apps.turtleduck.S.recipes.map(r => [r.id, r.name])));
  await clickIf(L, `${M} [data-act="cook-back"]`);
  await td.view(tab, "plan");
  if (!phone) await td.week(tab, "next");
  for (const x of plan) {
    if (await L.page.evaluate(([d, m]) => Kyoshi.apps.turtleduck.entriesOn(d, m).length, [x.date, x.meal])) continue;
    if (phone) {
      await L.page.evaluate(([d, m]) => Kyoshi.apps.turtleduck.revealCell(d, m), [x.date, x.meal]);
      await L.page.click(`${M} [data-act="pick"][data-date="${x.date}"][data-meal="${x.meal}"]`);
      await L.page.waitForSelector(`${M} #pickOverlay.open`);
      await td.pickRecipe(tab, names[x.recipeId]);
      L.tap(2);
    } else {
      await td.dragRecipe(tab, x.recipeId, x.date, x.meal);
      L.drag(1);
    }
  }
  for (const d of trips) if (!(await L.page.evaluate(d => Kyoshi.apps.turtleduck.hasTrip(d), d))) { await td.cart(tab, d); L.tap(1); }
  return true;
}
// Every row on a trip's list (or Now) ticked: bought.
async function buyGroceries(L, list) {
  if (L.mode === "functions") return inPage(L, list => {
    const A = Kyoshi.apps.turtleduck;
    A.renderGroceries();
    for (let n = 0; n < 200; n++) {
      const box = A.root.querySelector(`.g-list[data-list="${CSS.escape(list)}"] > .g-row:not(.ticked) .g-check`);
      if (!box) break;
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      A.renderGroceries();
    }
    return true;
  }, list);
  await L.switchTo("turtleduck");
  await clickIf(L, `${M} [data-act="cook-back"]`); // in the cook view: ← Back first
  if (!(await L.page.locator(`${M} #groceriesView`).isVisible())) { await td.view({ page: L.page }, "groceries"); L.tap(1); }
  for (let n = 0; n < 200; n++) {
    const row = L.page.locator(`${M} .g-list[data-list="${list}"] > .g-row:not(.ticked) .g-main`).first();
    if (!(await row.count())) break;
    await row.click();
    L.tap(1);
  }
  return true;
}

// --- Core's meetings and checkups: Done ✓ on the app's header line ---
async function meetingDone(L, app, id) {
  if (L.mode === "functions") return inPage(L, ([app, id]) => {
    const A = Kyoshi.apps[app], rec = (A._meet || {})[id];
    if (!rec) return false;
    Kyoshi.meetings.take(A, { [id]: { ...rec, last: Kyoshi.util.todayStr(), u: Date.now() } });
    A.changed();
    return true;
  }, [app, id]);
  await L.switchTo(app);
  return clickIf(L, `#kMeeting [data-done="${id}"]`);
}

// --- Iroh: a season goal added, carried over, reconciled, renamed or dropped ---
async function addGoal(L, g) {
  if (L.mode === "functions") return inPage(L, g => {
    const A = Kyoshi.apps.iroh, U = Kyoshi.util, now = Date.now(), period = A.currentSeason();
    if (A.goalsIn(period).some(x => x.title.toLowerCase() === g.title.toLowerCase())) return false;
    const fresh = A.cleanGoals([{ id: U.newId(), areaId: g.areaId || "", period, title: g.title, parentId: g.parentId || "", hoursWeek: g.hoursWeek || 0, hoursTotal: g.hoursTotal || 0, next: "The next small step.", reconciled: U.todayStr(), status: "open", at: now, u: now }])[0];
    A.S.goals.push(fresh); A.save(); A.renderAll(); return true;
  }, g);
  await L.switchTo("iroh");
  const p = L.page;
  await p.click(`${M} [data-act="add-season"]`);
  await p.waitForSelector(`${M} #goalOverlay.open`);
  await p.fill(`${M} #goalTitle`, g.title);
  await p.click(`${M} #goalHoursMode [data-mode="${g.hoursWeek ? "week" : "total"}"]`);
  await p.fill(`${M} #goalHours`, String(g.hoursWeek || g.hoursTotal));
  if (g.parentId && (await p.locator(`${M} #goalParent option[value="${g.parentId}"]`).count())) await p.selectOption(`${M} #goalParent`, g.parentId);
  await p.click(`${M} #goalForm button[type="submit"]`);
  L.tap(5);
  return !(await p.locator(`${M} #goalOverlay`).evaluate(el => el.classList.contains("open")));
}
async function carryOver(L, id) {
  if (L.mode === "functions") return inPage(L, id => { const b = Kyoshi.apps.iroh.root.querySelector(`[data-act="carry"][data-id="${CSS.escape(id)}"]`); if (!b) return false; b.click(); return true; }, id);
  await L.switchTo("iroh");
  const box = L.page.locator(`${M} #earlierBox`);
  if ((await box.count()) && !(await box.evaluate(el => el.open))) { await L.page.click(`${M} #earlierBox > summary`); L.tap(1); }
  return clickIf(L, `${M} [data-act="carry"][data-id="${id}"]`);
}
async function reconcile(L, id, status = "") {
  if (L.mode === "functions") return inPage(L, ([id, status]) => {
    const A = Kyoshi.apps.iroh;
    A.openReconcile(id);
    // A form's submit button in an app off screen doesn't submit (its form isn't in the page): its submit event, as Enter would.
    if (status) (status === "done" ? A.$("recDoneBtn") : A.$("recDropBtn")).click();
    else A.$("recForm").dispatchEvent(new Event("submit", { cancelable: true }));
    return true;
  }, [id, status]);
  await L.switchTo("iroh");
  if (!(await clickIf(L, `${M} [data-act="reconcile"][data-id="${id}"]`))) return false;
  await L.page.waitForSelector(`${M} #recOverlay.open`);
  await L.page.click(status === "done" ? `${M} #recDoneBtn` : status === "dropped" ? `${M} #recDropBtn` : `${M} #recForm button[type="submit"]`);
  L.tap(1);
  return true;
}
async function renameGoal(L, id, title) {
  if (L.mode === "functions") return inPage(L, ([id, title]) => {
    const A = Kyoshi.apps.iroh, g = A.goalById(id);
    if (!g) return false;
    Object.assign(g, { title, u: Date.now() }); A.save(); A.renderAll(); return true;
  }, [id, title]);
  await L.switchTo("iroh");
  if (!(await clickIf(L, `${M} .goal[data-id="${id}"] [data-act="edit"]`))) return false;
  await L.page.waitForSelector(`${M} #goalOverlay.open`);
  await L.page.fill(`${M} #goalTitle`, title);
  await L.page.click(`${M} #goalForm button[type="submit"]`);
  L.tap(2);
  return true;
}

// --- Bosco: the dose pop-up's Log dose ---
async function dose(L) {
  if (L.mode === "functions") return inPage(L, () => { const A = Kyoshi.apps.bosco; if (!A.S.doseAsking) return false; A.confirmDose(false); return true; });
  await L.switchTo("bosco");
  return clickIf(L, `${M} #doseOverlay.open #doseLogBtn`);
}

module.exports = { hawkyAdd, hawkyTick, pabuTick, pabuAdd, appaLog, appaReading, workout, planMeals, buyGroceries, meetingDone, addGoal, carryOver, reconcile, renameGoal, dose };
