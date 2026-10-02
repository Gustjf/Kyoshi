/* Kyoshi · tests/sim/day.js — what the person does on a day (testplan.md, "A day in the loop"): the morning look at Momo on the
 * phone (Today), the close-out if it's up, then the day's doing by this person's reliability: what today's cards hold (from
 * Today's card pop-up and "Open in <App>" on a screens week), the goals' hours on their cards, what's due in the apps with no
 * card, the dose, a meeting and its work (the season review carries goals over, the monthly reconcile), new errands and
 * people, a checkup now and then; and on the planning day, the evening's sitting at the computer (Turtleduck's week, then
 * Momo's: plan.js). A weekly life does it all on Monday morning and Sunday evening. */
"use strict";
const mo = require("../momo");
const gen = require("../generate");
const acts = require("./acts");
const plan = require("./plan");
const events = require("./events");
const robust = require("./robust");
const { weekOf, START } = require("./lives");

const poisson = (rng, mean) => { let n = 0, p = Math.exp(-mean), s = p; const u = rng(); while (u > s && n < 30) { n++; p *= mean / n; s += p; } return n; };

// --- One need done, from Momo's plan (its card) ---
async function viaToday(L, n, b) {
  if (L.mode !== "screens" || L.device !== "phone" || !(await mo.isToday(L.tab).catch(() => false))) return;
  if (!(await L.page.locator(`#kMount #todayBody [data-card="${b.card}"]`).count())) return;
  await mo.openTodayCard(L.tab, b.card);
  L.tap(1);
  L.count("todayCardOpened");
  if (await L.page.locator(`#kMount #detailFrom a[data-app="${n.app}"][data-id="${n.id}"]`).count()) {
    await mo.openInApp(L.tab, n.app, n.id, "detailFrom");
    L.tap(1);
    L.count("openInApp");
  } else await mo.closeTodayCard(L.tab);
}
// The needs this person acts on (a meal is eaten, not marked: Turtleduck's carry no done).
const actable = n => ["hawky", "pabu", "appa"].includes(n.app) || (n.app === "badgermole" && n.id.startsWith("next:")) ||
  (n.app === "turtleduck" && n.id.startsWith("groceries:")) || (n.app === "iroh" && n.id.startsWith("meeting:"));
async function doNeed(L, n, b) {
  if (!actable(n)) return false;
  if (b) await viaToday(L, n, b);
  let ok = false;
  if (n.app === "hawky") ok = await acts.hawkyTick(L, n.id);
  else if (n.app === "pabu") ok = await acts.pabuTick(L, n.id.replace(/^p:/, "").replace(/:\d{4}-\d{2}-\d{2}$/, ""));
  else if (n.app === "appa") ok = n.id.startsWith("reading:") ? await acts.appaReading(L, n.id.slice(8)) : await acts.appaLog(L, n.id);
  else if (n.app === "badgermole") ok = n.id.startsWith("next:") && L.rng() < L.habits.workouts ? await acts.workout(L) : false;
  else if (n.app === "turtleduck") ok = n.id.startsWith("groceries:") ? await acts.buyGroceries(L, n.id.slice("groceries:".length)) : false;
  else if (n.app === "iroh" && n.id.startsWith("meeting:")) ok = await meeting(L, n);
  if (ok) {
    L.memory.doneLog.push({ app: n.app, id: n.id, date: L.today, title: n.title });
    if (n.app === "appa" && !n.id.startsWith("reading:")) L.memory.recorded.push({ id: n.id, date: L.today, title: n.title });
    L.count(`did:${n.app}`);
  }
  return ok;
}

// --- Iroh: a meeting held (Done ✓), and its work ---
async function meeting(L, n) {
  const mid = n.id.split(":")[1];
  if (L.rng() >= L.habits.meetings) { L.count("meetingSkipped"); return false; }
  if (!(await acts.meetingDone(L, "iroh", mid))) return false;
  L.count(`meeting:${mid}`);
  if (mid === "season") await seasonReview(L);
  if (mid === "reconcile") await reconcileAll(L);
  return true;
}
// The season review: this season's goals, carried over from the last (all open ones, unless this person is pausing them).
async function seasonReview(L) {
  if (L.pauseGoals) { L.count("goalsPaused"); return; }
  const info = await L.page.evaluate(() => {
    const I = Kyoshi.apps.iroh, now = I.goalsIn(I.currentSeason()).map(g => g.title.toLowerCase());
    const past = I.liveGoals().filter(g => I.isSeason(g.period) && I.isPast(g.period) && I.isOpen(g)).sort((a, b) => I.startOf(b.period).localeCompare(I.startOf(a.period)));
    const latest = past.length ? past[0].period : "";
    return { now, carry: past.filter(g => g.period === latest && !now.includes(g.title.toLowerCase())).map(g => ({ id: g.id, title: g.title })) };
  });
  for (const g of info.carry) if (await acts.carryOver(L, g.id)) L.count("carriedOver");
  if (!info.carry.length && !info.now.length && L.world.goals.length) {
    // Nothing to carry (all done or dropped): the person sets them again, as at the start.
    for (const g of L.world.goals) await acts.addGoal(L, g);
  }
}
async function reconcileAll(L) {
  const ids = await L.page.evaluate(() => { const I = Kyoshi.apps.iroh; return I.goalsIn(I.currentSeason()).filter(I.isOpen).map(g => g.id); });
  for (const id of ids) if (L.rng() < 0.9) await acts.reconcile(L, id);
}

// --- The goals' hours: today's cards (a weekly life: the week's from today) titled like an open season goal, done by this
// person's reliability ---
function goalHours(L, s, days = 1) {
  const goals = ((s.truth.iroh && s.truth.iroh.goals) || []).map(g => g.title.toLowerCase());
  const week = s.thisKey, did = L.memory.did[week] || (L.memory.did[week] = {}), from = L.dayIndex(s.today);
  L.memory.goalsByWeek[week] = [...new Set((L.memory.goalsByWeek[week] || []).concat(((s.truth.iroh && s.truth.iroh.goals) || []).filter(g => g.weekly > 0).map(g => g.title)))];
  (s.momo.cards[week] || []).filter(c => c.day !== null && c.day >= from && c.day < from + days && goals.includes(c.title.toLowerCase())).forEach(c => {
    if (L.rng() < L.rel("iroh")) did[c.title.toLowerCase()] = (did[c.title.toLowerCase()] || 0) + c.hours;
  });
}

// --- New things: errands (some undated, some overdue on arrival, some weeks out), a person, a checkup ---
async function newThings(L, s, days = 1) {
  if (L.uses("hawky")) {
    const n = poisson(L.rng, (L.habits.errands * days) / 7);
    for (let i = 0; i < n; i++) {
      const [text, minutes] = gen.pick(L.rng, gen.ERRANDS), r = L.rng();
      const due = r < L.habits.overdueShare ? L.addDays(L.today, -1 - Math.floor(L.rng() * 3)) : r < 0.35 ? "" : r < 0.45 ? L.addDays(L.today, 20 + Math.floor(L.rng() * 30)) : L.addDays(L.today, Math.floor(L.rng() * 12));
      if (await acts.hawkyAdd(L, { text, due, minutes })) { L.memory.errands++; L.count("errandsAdded"); }
    }
  }
  if (L.uses("pabu") && L.habits.people && L.rng() < days / L.habits.people) {
    const i = 40 + L.memory.people++, name = `${gen.NAMES[i % gen.NAMES.length]} ${String.fromCharCode(65 + (i % 26))}.`;
    await acts.pabuAdd(L, { name, every: gen.pick(L.rng, ["week", "2weeks", "month", "month", "quarter"]), how: gen.pick(L.rng, ["call", "call", "text", "visit"]) });
    L.count("peopleAdded");
  }
  if (L.habits.checkups && L.rng() < (days * 9) / L.habits.checkups) {
    const oldest = Object.entries(s.meetings).map(([app, line]) => [app, /checkup whenever, (?:met (\d+) days ago|not met yet)/.exec(line)]).filter(([app, m]) => m && L.uses(app))
      .map(([app, m]) => [app, m[1] === undefined ? 1e9 : +m[1]]).sort((a, b) => b[1] - a[1])[0];
    if (oldest && (await acts.meetingDone(L, oldest[0], "checkup"))) L.count("checkupsDone");
  }
}

// --- The day's doing ---
async function doTheDay(L, s, days = 1) {
  const byKey = new Map(s.drawn.needs.map(n => [n.key, n])), done = new Set(), today = s.today;
  const todays = s.drawn.blocks.filter(b => b.date === today || (days > 1 && b.date >= today && b.date < L.addDays(today, days)));
  for (const b of todays) for (const k of b.needs) {
    const n = byKey.get(k);
    if (!n || n.done || n.fill === "ongoing" || n.fill === "hours" || done.has(k) || !L.uses(n.app)) continue;
    if (L.rng() >= L.rel(n.app)) continue;
    if (await doNeed(L, n, b)) done.add(k);
  }
  goalHours(L, s, days);
  // What's due in the apps with no card for it today: some of it remembered there.
  const placedToday = new Set(todays.flatMap(b => b.needs));
  for (const n of s.drawn.needs) {
    if (n.done || done.has(n.key) || placedToday.has(n.key) || !["hawky", "pabu", "appa", "turtleduck", "iroh"].includes(n.app) || !L.uses(n.app)) continue;
    const due = n.date || n.due || "", late = n.overdue || (due && due <= L.addDays(today, days - 1)) || (n.app === "appa" && n.id.startsWith("reading:"));
    if (!late || (n.app === "turtleduck" && !n.id.startsWith("groceries:")) || (n.app === "iroh" && !n.id.startsWith("meeting:"))) continue;
    if (L.rng() < L.rel(n.app) * (n.app === "iroh" ? 0.3 : 0.5) && (await doNeed(L, n, null))) done.add(n.key);
  }
  const t = s.truth;
  if (L.uses("badgermole") && t.badgermole && t.badgermole.planned && t.badgermole.done < t.badgermole.target && t.badgermole.target - t.badgermole.done >= t.badgermole.left - 1 &&
    !todays.some(b => b.title.toLowerCase() === "workout") && L.rng() < L.rel("badgermole") * L.habits.workouts * 0.6) { if (await acts.workout(L)) L.count("did:badgermole"); }
  if (L.uses("bosco") && t.bosco && t.bosco.asking && L.rng() < L.rel("bosco")) { if (await acts.dose(L)) L.count("did:bosco"); }
  await newThings(L, s, days);
}

// --- The evening's sitting: Turtleduck's next week, then Momo's (plan.js) ---
function plansToday(L, date) {
  const c = L.habits.computer, d = L.dayIndex(date);
  if (date === START && L.def.world) return true; // the first day: this week and next set up at once
  if (L.habits.phoneOnly) return d === 6;
  return c === "alternate" ? d === 6 && weekOf(date) % 2 === 0 : c.includes(d);
}
async function mealsFor(L, monday) {
  const dinners = ["rc-chili", "rc-friedrice", "rc-curry", "rc-stew"], out = [];
  for (let i = 0; i < 7; i++) {
    const date = L.addDays(monday, i);
    if (L.habits.turtleduck === "full") out.push({ date, meal: "breakfast", recipeId: "rc-oats" }, { date, meal: "lunch", recipeId: L.rng() < 0.5 ? "rc-salad" : "rc-bowl" });
    out.push({ date, meal: "dinner", recipeId: gen.pick(L.rng, dinners) });
  }
  return out;
}
async function evening(L, date) {
  await L.clockTo(date, L.habits.planAt);
  await L.open(L.habits.phoneOnly ? "phone" : "computer");
  await plan.closeOut(L, "evening");
  const next = L.addDays(L.thisKey(), 7);
  if (L.uses("turtleduck") && L.habits.turtleduck && L.rng() < Math.max(0.5, L.rel("turtleduck"))) {
    await acts.planMeals(L, await mealsFor(L, next), [L.addDays(next, 5)]);
    L.count("mealsPlanned");
  }
  const r = await plan.sitting(L, { first: date === START });
  Object.assign(L.stat(next), { taps: (L.stat(next).taps || 0) + r.next.taps + r.now.taps, drags: (L.stat(next).drags || 0) + r.next.drags + r.now.drags, full: r.next.full, msg: r.next.msg, afterBaseline: r.next.afterBaseline });
  L.shortfalls(next, r.next.afterBaseline || []);
  await L.tick();
  await L.observe("evening");
}

// --- A whole day of a daily life; a step of a weekly one ---
async function daily(L, date) {
  L.today = date;
  L.week = weekOf(date);
  L.mode = L.opts.mode || (L.def.screens(L.week, date, L) ? "screens" : "functions");
  const ev = events.today(L, date);
  L.away = ev.kinds.has("vacation") || ev.kinds.has("gap");
  L.lowFor = ev.kinds.has("baby") && date < ev.until.baby;
  await L.clockTo(date, "07:00");
  for (const e of ev.on) await events.run(L, e);
  const opens = !L.away && (L.habits.phoneDays === undefined || L.rng() < L.habits.phoneDays);
  if (opens) await L.open("phone");
  const s = await L.observe("morning");
  await robust.dateProbes(L, date);
  if (opens) {
    await plan.closeOut(L, "morning");
    // A week left unplanned (no computer last Sunday): some Mondays it's planned on the phone instead.
    if (L.habits.mondayPhonePlan && L.dayIndex(date) === 0 && !s.momo.cards[s.thisKey].length && L.rng() < L.habits.mondayPhonePlan) {
      const r = await plan.planWeek(L, "this");
      Object.assign(L.stat(s.thisKey), { taps: (L.stat(s.thisKey).taps || 0) + r.taps, drags: (L.stat(s.thisKey).drags || 0) + r.drags, full: r.full, msg: r.msg, phone: true });
      L.count("phonePlanned");
    }
    if (!ev.kinds.has("sick")) await doTheDay(L, await L.snapshot());
    await L.tick();
    if (L.page2) await robust.otherTab(L);
    await L.observe("day");
  }
  if (!L.away && plansToday(L, date)) await evening(L, date);
  await robust.milestones(L, date);
  return s;
}
async function weekly(L, monday) {
  L.week = weekOf(monday);
  L.mode = L.opts.mode || (L.def.screens(L.week, monday, L) ? "screens" : "functions");
  const ev = events.today(L, monday);
  L.away = false;
  await L.clockTo(monday, "07:00");
  L.today = monday;
  for (const e of ev.on) await events.run(L, e);
  await L.open("phone");
  await L.observe("morning");
  await plan.closeOut(L, "morning");
  await doTheDay(L, await L.snapshot(), 7);
  await L.tick();
  await L.observe("day");
  const sunday = L.addDays(monday, 6);
  // The week's calendar edges (Feb 29, Dec 21, Jan 31) and a night the clocks change: the clock stops there too.
  for (let d = L.addDays(monday, 1); d < sunday; d = L.addDays(d, 1)) {
    if (["02-28", "02-29", "12-21", "12-22", "01-31"].includes(d.slice(5))) { await L.clockTo(d, "07:00"); await robust.dateProbes(L, d); }
  }
  const dstDay = (m, n) => { const first = `${sunday.slice(0, 4)}-${m}-01`, k = (7 - L.dayIndex(first) + 6) % 7; return L.addDays(first, k + 7 * (n - 1)); };
  if (L.def.tz !== "UTC" && (sunday === dstDay("03", 2) || sunday === dstDay("11", 1))) await robust.dst(L, sunday);
  await evening(L, sunday);
  await robust.milestones(L, sunday);
}

module.exports = { daily, weekly, doTheDay, doNeed, evening, plansToday, seasonReview, newThings };
