/* Kyoshi · tests/sim/plan.js — the person in Momo, always through its screens (it's the subject): the close-out when it's up
 * (answered as this person does: honest numbers and Confirm, Later twice, or left), and planning a week (Load or Reload the
 * baseline, or Copy previous week; each task in Tasks onto a day with room, by this person's skill: dragged on the computer,
 * tapped on a phone; a day pushed past 24 hours balanced by shrinking its Free time; Fill gaps with Free time), counting the
 * taps and drags it took, what was left in Tasks, and checking the close-out's rows and what Confirm keeps. */
"use strict";
const mo = require("../momo");

const DAY_HOURS = 24;

// --- The close-out ---
// The pop-up, if it's up: its week, its rows checked against that week's goals and cards, then answered.
async function closeOut(L, where) {
  const co = await mo.closeOut(L.tab);
  if (!co.open) return false;
  const info = await L.page.evaluate(() => {
    const M = Kyoshi.apps.momo, key = M.S.closing.key, w = M.S.data.weeks[key] || { cards: [] }, free = M.FREE_TIME.toLowerCase();
    const planned = {};
    w.cards.forEach(c => { if (c.day !== null && c.title.toLowerCase() !== free) planned[c.title.toLowerCase()] = (planned[c.title.toLowerCase()] || 0) + c.hours; });
    return { key, planned, pending: M.reviewWeeks(), today: Kyoshi.util.todayStr() };
  });
  const age = L.daysBetween(L.addDays(info.key, 6), info.today);
  L.count("closeOutShown");
  if (info.pending.length && info.key !== info.pending[0]) L.find("closeout-not-oldest", { kind: "bug", sev: "occasional", title: "The close-out didn't start with the oldest week" }, `${info.today}: ${info.key} of ${info.pending.join(", ")}`);
  // "Later" lasts until the next week, or until Momo is opened again (it's kept in memory): on a phone, the next morning.
  if ((L.memory.laters[info.key] || 0) > 0 && L.memory.laterOn && L.memory.laterOn[info.key] && L.thisKey() === L.memory.laterOn[info.key]) L.find("later-forgotten", { kind: "flow", sev: "daily rub", title: "“Later” on the close-out only lasts until Momo is opened again", where: "apps/momo/closeout.js:159 (S.closeOutLater, in memory; app.js state)" },
    `${info.today}: the close-out of ${info.key}, put off with Later in the same week, came back when Momo was opened again`);
  if (where === "morning" && L.device === "phone") { L.count("closeOutFirstThing"); L.find("closeout-first-thing", { kind: "flow", sev: "occasional", title: "The close-out pops up first thing on the phone", where: "apps/momo/events.js:132 onShow → closeout.js checkCloseOuts" }, `${L.today}: Momo opened on the phone with the close-out of ${info.key} on top of Today`); }
  if (age > 30) L.find("closeout-old", { kind: "flow", sev: "occasional", title: "The close-out asks about a week more than a month old" }, `${L.today}: the close-out of ${info.key} (${age} days after it ended), ${info.pending.length} weeks waiting`);
  // Its rows: that week's goals (as they were then: the life remembers), each with the hours its cards had.
  const then = (L.memory.goalsByWeek[info.key] || []).map(t => t.toLowerCase()), rows = co.rows.map(r => r.title.toLowerCase());
  const lost = then.filter(t => !rows.includes(t)), added = rows.filter(t => !then.includes(t));
  if (then.length && (lost.length || added.length)) L.find("closeout-goals-now", { kind: "design question", sev: "occasional", title: "The close-out lists the goals as they are now, not as they were that week", where: "apps/momo/closeout.js:46 trackedTitles (K.inbox now)", suspect: 12 },
    `${info.key}: that week's goals were ${then.join(", ")}; the close-out listed ${rows.join(", ") || "none"}`);
  co.rows.forEach(r => {
    const want = info.planned[r.title.toLowerCase()] || 0;
    if (Math.abs(want - r.done) > 0.01) L.find("closeout-planned", { kind: "bug", sev: "daily rub", title: "The close-out's planned hours aren't the week's cards" }, `${info.key} ${r.title}: shows ${r.done}h, its cards had ${want}h`);
  });
  // The answer: Later (twice per week, for some), else honest numbers and Confirm.
  const later = L.memory.laters[info.key] || 0;
  if ((L.habits.closeOut === "later2" && later < 2) || L.away) {
    L.memory.laters[info.key] = later + 1;
    (L.memory.laterOn || (L.memory.laterOn = {}))[info.key] = L.thisKey();
    await mo.later(L.tab);
    L.tap(1);
    L.count("closeOutLater");
    return true;
  }
  const did = L.memory.did[info.key] || {}, honest = {};
  for (const [i, r] of co.rows.entries()) {
    const h = Math.round((did[r.title.toLowerCase()] || 0) * 4) / 4;
    honest[r.title] = h;
    if (Math.abs(h - r.done) > 0.01) { await mo.setDone(L.tab, i, h); L.tap(2); }
  }
  await mo.confirmCloseOut(L.tab);
  L.tap(1);
  const after = await L.page.evaluate(([key, titles]) => {
    const M = Kyoshi.apps.momo, w = M.S.data.weeks[key];
    return { closed: !!w && w.closed, spent: w && w.spent, hours: Object.fromEntries(titles.map(t => [t, M.hoursSpent(t)[key]])) };
  }, [info.key, Object.keys(honest)]);
  if (!after.closed) L.find("closeout-not-closed", { kind: "bug", sev: "blocks the flow", title: "Confirm didn't close the week" }, info.key);
  Object.entries(honest).forEach(([t, h]) => {
    if (Math.abs((after.hours[t] || 0) - h) > 0.01) L.find("closeout-spent", { kind: "bug", sev: "blocks the flow", title: "hoursSpent doesn't give back what the close-out logged" }, `${info.key} ${t}: logged ${h}h, hoursSpent says ${after.hours[t]}`);
  });
  L.closed(info.key, L.today);
  L.memory.confirmed.push({ key: info.key, rows: honest, on: L.today });
  return true;
}

// --- Planning a week ---
// The soonest day of a board (which: "this" | "next") with room for a task, within its needs' days; else one whose Free time
// could give the room (shrink: true); else null.
function chooseDay(L, s, which, t, days) {
  const key = which === "this" ? s.thisKey : s.nextKey, first = which === "this" ? L.dayIndex(s.today) : 0;
  const needs = t.needs.map(k => s.drawn.needs.find(n => n.key === k)).filter(Boolean);
  const late = needs.some(n => n.overdue || (n.due && n.due < s.today));
  let lo = first, hi = 6;
  needs.forEach(n => {
    if (n.date) { lo = Math.max(lo, L.daysBetween(key, n.date)); hi = Math.min(hi, L.daysBetween(key, n.date)); }
    if (n.from) lo = Math.max(lo, L.daysBetween(key, n.from));
    if (n.due && !late) hi = Math.min(hi, L.daysBetween(key, n.due));
  });
  if (late) { lo = first; hi = 6; }
  if (lo > hi || lo > 6 || hi < first) return null;
  const free = d => { const day = days.find(x => x.day === d); return day ? day.cards.filter(c => c.title === "Free time").reduce((h, c) => h + c.hours, 0) : 0; };
  const total = d => (days.find(x => x.day === d) || { total: 0 }).total;
  for (let d = lo; d <= hi; d++) if (DAY_HOURS - total(d) >= t.hours) return { day: d, shrink: false };
  for (let d = lo; d <= hi; d++) if (free(d) + DAY_HOURS - total(d) >= t.hours) return { day: d, shrink: true };
  return null;
}

// A day past 24 hours after a drop: its Free time shrunk by what's over (its editor: hours, then Save).
async function balance(L, d) {
  const day = (await mo.days(L.tab)).find(x => x.day === d);
  const over = day ? day.total - DAY_HOURS : 0;
  if (over <= 0) return;
  const spare = day.cards.filter(c => c.title === "Free time").sort((a, b) => b.hours - a.hours)[0];
  if (!spare || spare.hours < over) { L.count("leftOverbooked"); return; }
  await mo.openCard(L.tab, spare.id);
  const left = spare.hours - over;
  if (left > 0) {
    await L.page.fill("#kMount #cardHours", String(left));
    await L.page.click("#kMount #cardSaveBtn");
  } else {
    await L.page.click("#kMount #cardDeleteBtn");
  }
  L.tap(3);
  L.count("balanced");
}

// Plans the week on a board: the baseline (or a copy), then Tasks, then Fill gaps. Returns what it took.
async function planWeek(L, which, { tasksOnly = false } = {}) {
  const tab = L.tab, habit = L.habits.plan, taps0 = L.taps, drags0 = L.drags;
  await L.switchTo("momo");
  await mo.view(tab, which);
  if ((await mo.tasks(tab)).hidden) return { taps: 0, drags: 0, full: false, msg: "closed", left: [], afterBaseline: [], closed: true }; // a closed week: no Tasks
  let b = await mo.bank(tab);
  const notPlanned = /not planned yet/.test((await mo.tabs(tab))[which].status);
  if (!tasksOnly) {
    const useBaseline = habit.baseline !== "none" && L.week >= (habit.baselineFrom || 0);
    if (useBaseline && b.buttons.includes("Load baseline")) {
      await mo.loadBaseline(tab);
      L.tap(1);
      L.count("loadBaseline");
      // Loaded cards fill at once, and the baseline's pinned times hold.
      const s = await L.snapshot(), key = which === "this" ? s.thisKey : s.nextKey;
      if (s.stale) L.find("load-not-filled", { kind: "bug", sev: "daily rub", title: "Cards loaded from the baseline aren't filled at once" }, key);
      const pins = await L.page.evaluate(k => { const M = Kyoshi.apps.momo, base = M.S.data.baseline.cards.filter(M.pinned), w = M.weekOf(k).cards; return base.map(c => [c.title, c.day, c.pin, (w.find(x => x.base && x.title === c.title && x.day === c.day) || {}).pin]); }, key);
      pins.forEach(([title, day, want, got]) => { if (want !== got) L.find("baseline-pin", { kind: "bug", sev: "occasional", title: "A pinned time from the baseline didn't hold" }, `${key} ${title} day ${day}: ${want} → ${got}`); });
      if (pins.length) L.count("pinsChecked", pins.length);
    }
    else if (useBaseline && habit.baseline === "reload" && b.buttons.includes("Reload baseline")) {
      // Reload swaps only the baseline's cards: the person's own stay as they were.
      const key = which === "this" ? L.thisKey() : L.addDays(L.thisKey(), 7), own = (await L.snapshot()).momo.cards[key].filter(c => !c.base);
      await mo.loadBaseline(tab);
      L.tap(2);
      L.count("reloadBaseline");
      const after = (await L.snapshot()).momo.cards[key];
      own.forEach(c => { const a = after.find(x => x.id === c.id); if (!a || a.hours !== c.hours || a.day !== c.day) L.find("reload-own-card", { kind: "bug", sev: "blocks the flow", title: "Reload baseline changed a card of the person's own", dataLoss: true }, `${key}: ${c.title} ${c.hours}h on day ${c.day} → ${a ? `${a.hours}h on day ${a.day}` : "gone"}`); });
    }
    else if (notPlanned && b.buttons.includes("Copy previous week")) { await mo.copyPrevious(tab); L.tap(1); L.count("copyPrevious"); }
  }
  const tried = new Set(), first = await L.snapshot();
  // What the baseline left uncovered for this week: its tasks that can go on it (another week's, shown here too, aside).
  const key = which === "this" ? first.thisKey : first.nextKey;
  const afterBaseline = first.drawn.tasks[which].filter(t => !t.ongoing && L.canGoOn(first, t, key)).map(t => `${t.title} ${t.hours}h`);
  for (let round = 0; round < 40; round++) {
    const s = await L.snapshot();
    const list = s.drawn.tasks[which].filter(t => !t.ongoing && !tried.has(t.key));
    if (!list.length) break;
    const t = list[0];
    tried.add(t.key);
    // A task only from apps this person doesn't use (Iroh's meetings before they've ever opened it): left, as noise.
    if (t.needs.every(k => !L.uses(k.split(":")[0]))) { L.count("taskFromUnusedApp"); L.find("task-unused-app", { kind: "flow", sev: "occasional", title: "Tasks asks for time for an app the person doesn't use", where: "core/meetings.js:62-66 (a meeting never had is due the day it's first seen)" }, `${t.title} ${t.hours}h, from ${[...new Set(t.needs.map(k => L.appName(k.split(":")[0])))].join(", ")}, which this person has never opened`); continue; }
    if (L.rng() > habit.skill) { L.count("taskLeft"); continue; }
    const days = await mo.days(tab), spot = chooseDay(L, s, which, t, days);
    if (!spot) { L.count("taskNoDay"); continue; }
    if (L.device === "phone") { await mo.placeTask(tab, t.key, [spot.day]); L.tap(3); }
    else { await mo.dragTask(tab, t.key, spot.day); L.drag(1); }
    L.count(`placed:${t.title}`);
    if (spot.shrink) await balance(L, spot.day);
  }
  if (!tasksOnly && habit.fillGaps && (await mo.visible(tab, "fillGapsBtn"))) { await mo.fillGaps(tab); L.tap(1); }
  b = await mo.bank(tab);
  const left = (await mo.tasks(tab)).tasks.filter(t => !t.ongoing);
  return { taps: L.taps - taps0, drags: L.drags - drags0, full: /Every hour has a job ✓/.test(b.msg), msg: b.msg, left: left.map(t => `${t.title} ${t.hours}h`), afterBaseline };
}

// Suspect 8, once a life (a screens week, on the computer): a filled card's editor, its hours changed and not saved, then "Open in
// <App>": asked first? kept?
async function probeOpenInApp(L) {
  if (L.memory.probedOpenIn || L.mode !== "screens" || L.device !== "computer") return;
  const s = await L.snapshot(), b = s.drawn.blocks.find(x => x.key === s.nextKey && x.needs.some(k => !k.startsWith("wanshitong:")));
  if (!b) return;
  L.memory.probedOpenIn = true;
  await mo.view(L.tab, "next");
  const before = await mo.openCard(L.tab, b.card), n = before.from.find(x => x.app !== "wanshitong") || before.from[0];
  if (!n) return mo.closeCard(L.tab);
  await L.page.fill("#kMount #cardHours", String(before.hours + 0.5));
  const asked0 = L.dialogs.length;
  await mo.openInApp(L.tab, n.app, n.id, "cardFrom");
  const asked = L.dialogs.length > asked0;
  await L.switchTo("momo", { observer: true });
  await mo.view(L.tab, "next");
  const after = (await mo.days(L.tab)).flatMap(d => d.cards).find(c => c.id === b.card);
  L.count("openInAppProbe");
  if (after && Math.abs(after.hours - before.hours) < 0.01 && !asked) L.find("open-in-loses-edit", { kind: "bug", sev: "occasional", title: "“Open in <App>” from the card editor drops an unsaved edit without asking", where: "apps/momo/card-editor.js:27 (K.modal.dismiss, where × and Esc ask first)", suspect: 8 },
    `${b.title} on ${b.date}: its hours changed ${before.hours} → ${before.hours + 0.5} in the editor, then Open in ${L.appName(n.app)}: no question asked, and the card kept ${after.hours}h`);
}
// Reopen, once a life (a screens Sunday, just after closing out early): the week opens again without its logged hours, then
// closes again.
async function probeReopen(L) {
  if (L.memory.probedReopen || L.mode !== "screens" || !(await mo.visible(L.tab, "reopenBtn"))) return;
  L.memory.probedReopen = true;
  await mo.reopen(L.tab);
  const r = await L.page.evaluate(k => { const w = Kyoshi.apps.momo.S.data.weeks[k]; return { closed: !!w && w.closed, spent: !!w && !!w.spent }; }, L.thisKey());
  L.count("reopenProbe");
  if (r.closed || r.spent) L.find("reopen-failed", { kind: "bug", sev: "occasional", title: "Reopen didn't open the week again" }, JSON.stringify(r));
  if (await mo.visible(L.tab, "closeOutNowBtn")) { await mo.closeOutNow(L.tab); await closeOut(L, "early"); }
}

// Sunday evening's sitting (or whenever this person plans): close out the week early if that's their habit, plan what's left
// of this week, then next week.
async function sitting(L, { first = false } = {}) {
  await L.switchTo("momo");
  if (L.habits.plan.early && (await mo.visible(L.tab, "closeOutNowBtn"))) {
    await mo.closeOutNow(L.tab);
    L.tap(1);
    if (!(await closeOut(L, "early"))) L.closed(L.thisKey(), L.today); // a week with no goals closes at once
    await probeReopen(L);
  }
  const now = await planWeek(L, "this", { tasksOnly: !first });
  const next = await planWeek(L, "next");
  await probeOpenInApp(L);
  return { now, next };
}

module.exports = { closeOut, chooseDay, balance, planWeek, sitting, probeOpenInApp, probeReopen };
