/* Kyoshi · tests/sim/robust.js — D, robustness (testplan.md): milestones (screenshots, Export all into tests/sim/bundles at each
 * year's end), the timings that grow with the years (K.inbox, hoursSpent, a board redraw, Today, a reload), storage and
 * Export all's size, the moves (Export all → a fresh profile → Import all, giving the same answers; an old backup brought in
 * over current data; a month on two tabs), Feb 29 and the daylight saving days. */
"use strict";
const fs = require("fs");
const path = require("path");
const mo = require("../momo");
const { weekOf } = require("./lives");

const BUNDLES = path.join(__dirname, "bundles");

// What the apps answer, to compare before and after a move: Momo's needs and each goal's hours.
const ANSWERS = () => {
  const K = Kyoshi, U = K.util, M = K.apps.momo, today = U.todayStr(), sunday = U.addDays(M.nextWeekKey(), 6);
  const titles = K.apps.iroh && K.apps.iroh.started ? K.apps.iroh.liveGoals().map(g => g.title) : [];
  return { inbox: K.inbox(today, sunday).map(n => `${n.app}:${n.id}:${n.done}`), spent: Object.fromEntries(titles.map(t => [t, M.hoursSpent(t)])), weeks: Object.keys(M.S.data.weeks).length };
};

// --- Timings: each measured in the page (ms), a few times, the slowest kept ---
async function timings(L, label) {
  const p = L.page;
  await L.switchTo("momo", { observer: true });
  const inPage = await p.evaluate(() => {
    const K = Kyoshi, U = K.util, M = K.apps.momo, today = U.todayStr(), sunday = U.addDays(M.nextWeekKey(), 6), t = f => { const a = performance.now(); f(); return performance.now() - a; };
    const titles = K.apps.iroh && K.apps.iroh.started ? K.apps.iroh.liveGoals().map(g => g.title).slice(0, 5) : ["Run training"];
    const most = f => Math.max(t(f), t(f), t(f));
    return {
      inbox: most(() => K.inbox(today, sunday)), agenda: most(() => K.agenda(M.thisWeekKey(), sunday)),
      hoursSpent: most(() => titles.forEach(x => M.hoursSpent(x))), fill: most(() => M.fill()), render: most(() => M.renderAll()),
      weeks: Object.keys(M.S.data.weeks).length, bytes: JSON.stringify(M.S.data).length
    };
  });
  const t0 = Date.now();
  await mo.view(L.tab, "next");
  await mo.view(L.tab, "this");
  const tabSwitch = Date.now() - t0;
  const t1 = Date.now();
  await mo.showToday(L.tab);
  await mo.showBoard(L.tab);
  const today = Date.now() - t1;
  const t2 = Date.now();
  await L.open(L.device || "computer");
  const reload = Date.now() - t2;
  const storage = await p.evaluate(async () => { const u = await Kyoshi.storage.usage(); return u.bytes; });
  const file = await L.exportAll();
  const row = { label, date: L.today, ...inPage, tabSwitch, today, reload, storage, exportBytes: Buffer.byteLength(file) };
  L.timings.push(row);
  return { row, file };
}

// --- Export all → a fresh profile → Import all: the same answers, and how long it took ---
async function freshImport(L, file, { keep = false } = {}) {
  const before = await L.page.evaluate(ANSWERS);
  const ctx = await L.newContext(), page = await L.newPage(ctx);
  await page.goto(`${require("../lib").PAGE}#momo`);
  await page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
  const old = { ctx: L.ctx, page: L.page, tab: L.tab };
  Object.assign(L, { ctx, page, tab: { page, ctx } });
  const t0 = Date.now();
  await L.importAll(JSON.parse(file));
  const importMs = Date.now() - t0;
  await L.open(L.device || "phone");
  const after = await L.page.evaluate(ANSWERS);
  const same = JSON.stringify(before) === JSON.stringify(after);
  if (!same) L.find("move-differs", { kind: "bug", sev: "blocks the flow", title: "Export all → fresh profile → Import all changes what the apps answer", where: "core/backup.js importAllText" },
    `${L.today}: before ${before.inbox.length} needs, ${before.weeks} weeks; after ${after.inbox.length} needs, ${after.weeks} weeks; goals' hours ${JSON.stringify(before.spent) === JSON.stringify(after.spent) ? "same" : "differ"}`);
  if (keep) await old.ctx.close().catch(() => {});
  else { await ctx.close().catch(() => {}); Object.assign(L, old); }
  return { same, importMs };
}

// A device reinstall: Export all, a fresh profile, Import all, and the life goes on there.
async function reinstall(L) {
  const file = await L.exportAll();
  const r = await freshImport(L, file, { keep: true });
  L.timings.push({ label: "reinstall", date: L.today, importMs: r.importMs, same: r.same, exportBytes: Buffer.byteLength(file) });
  L.count("reinstalls");
}

// An old backup (the year-1 bundle) over current data, in a copy of this profile: what each app keeps. Import all replaces each
// app (after asking); folder sync's combine merges. Both are measured; the life goes on with its own data.
async function oldImport(L) {
  const bundle = path.join(BUNDLES, `${L.def.id}-y1.json`);
  if (!fs.existsSync(bundle)) return;
  const now = await L.exportAll(), oldFile = fs.readFileSync(bundle, "utf8");
  const ctx = await L.newContext(), page = await L.newPage(ctx), old = { ctx: L.ctx, page: L.page, tab: L.tab };
  await page.goto(`${require("../lib").PAGE}#momo`);
  await page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
  Object.assign(L, { ctx, page, tab: { page, ctx } });
  await L.importAll(JSON.parse(now));
  const counts = () => L.page.evaluate(() => { const A = Kyoshi.apps; return { weeks: Object.keys(A.momo.S.data.weeks).length, errands: A.hawky.S.items.length, people: A.pabu.S.people.length, records: A.appa.S.records.length, sessions: A.badgermole.S.sessions.length, goals: A.iroh.S.goals.length }; });
  const before = await counts();
  // The combine path (folder sync meeting an old copy): nothing of ours should go.
  const merged = await L.page.evaluate(raw => {
    const out = {};
    Kyoshi.order.forEach(id => { const A = Kyoshi.apps[id]; if (!raw.apps[id] || !A.data) return; const c = A.data.combine(raw.apps[id], { replace: false, plain: false, mine: { savedAt: "2", device: "b" }, theirs: { savedAt: "1", device: "a" } }); if (c) { c.apply(); out[id] = true; } });
    return out;
  }, JSON.parse(oldFile));
  const afterCombine = await counts();
  await L.importAll(JSON.parse(oldFile));
  const afterImport = await counts();
  // Older schema versions still import: a Momo backup from before titles had colours (schema 1, a colour on each card) and a
  // Bosco one from before doses were logged only once taken (schema 3).
  const older = await L.page.evaluate(() => {
    const w = Kyoshi.apps.momo.thisWeekKey(), day = Kyoshi.util.todayStr();
    const momo = Kyoshi.apps.momo.data.importBackup({ schemaVersion: 1, weeks: { [w]: { cards: [{ id: "o1", title: "Old card", hours: 2, day: 0, color: 3 }], closed: false, u: 1 } }, baseline: { cards: [{ id: "o2", title: "Sleep", hours: 8, day: 0, color: 1 }], u: 1 }, goals: [] }, false) === true;
    const bosco = Kyoshi.apps.bosco.data.importBackup({ schemaVersion: 3, unit: "lb", entries: [{ date: Kyoshi.util.addDays(day, -14), weight: 200, doseMg: 5 }, { date: Kyoshi.util.addDays(day, -7), weight: 199 }] }, false) === true;
    return { momo, bosco, card: !!Kyoshi.apps.momo.weekOf(w).cards.find(c => c.title === "Old card") };
  });
  L.count("olderSchemaChecked");
  if (!older.momo || !older.bosco || !older.card) L.find("older-schema", { kind: "bug", sev: "blocks the flow", title: "An older backup version doesn't import" }, JSON.stringify(older));
  const lostByCombine = Object.keys(before).filter(k => afterCombine[k] < before[k]), lostByImport = Object.keys(before).filter(k => afterImport[k] < before[k]);
  if (lostByCombine.length) L.find("combine-loses", { kind: "bug", sev: "blocks the flow", title: "Combining an old copy loses current data" }, `${lostByCombine.join(", ")}: ${JSON.stringify(before)} → ${JSON.stringify(afterCombine)}`);
  L.find("old-import-replaces", { kind: "design question", sev: "occasional", title: "Import all of an old backup replaces two years with one (after one confirm)", where: "core/backup.js:72 importAllText; each app's importBackup replaces", oldImport: true },
    `${L.today}: before ${JSON.stringify(before)}; after Import all of the year-1 backup ${JSON.stringify(afterImport)} (${lostByImport.join(", ") || "nothing"} fewer); folder sync's combine kept everything: ${!lostByCombine.length} (${Object.keys(merged).length} apps)`);
  await ctx.close().catch(() => {});
  Object.assign(L, old);
}

// A month on two tabs (a phone tab and a computer tab): each day, a change in one shows in the other's Momo within the minute.
async function twoTabs(L, on) {
  if (on) {
    L.page2 = await L.newPage(L.ctx);
    await L.page2.setViewportSize({ width: 1280, height: 1500 });
    await L.page2.goto(`${require("../lib").PAGE}#momo`);
    await L.page2.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
    L.count("twoTabs");
  } else if (L.page2) {
    await L.page2.close().catch(() => {});
    L.page2 = null;
  }
}
// The other tab, after this one's changes: its Momo draws the same needs within a minute; a close-out closed here is gone there.
async function otherTab(L) {
  if (!L.page2) return;
  await L.page2.waitForTimeout(150); // the store's broadcast and the other tab's reload (50 ms)
  await L.ctx.clock.fastForward(61000);
  const [a, b] = await Promise.all([L.page.evaluate(() => JSON.stringify(Kyoshi.inbox(Kyoshi.util.todayStr(), Kyoshi.util.addDays(Kyoshi.apps.momo.nextWeekKey(), 6)))),
    L.page2.evaluate(() => ({ drawn: Kyoshi.apps.momo.S.fill && Kyoshi.apps.momo.S.fill.key, closing: Kyoshi.apps.momo.S.closing && Kyoshi.apps.momo.S.closing.key, closed: Object.keys(Kyoshi.apps.momo.S.data.weeks).filter(k => Kyoshi.apps.momo.S.data.weeks[k].closed) }))]);
  L.count("twoTabChecks");
  if (a !== b.drawn) L.find("two-tabs-lag", { kind: "signal", sev: "occasional", title: "The other tab's Momo didn't catch up within a minute" }, `${L.today}: the computer tab still drew an older list of needs`);
  if (b.closing && b.closed.includes(b.closing)) L.find("two-tabs-closeout", { kind: "bug", sev: "occasional", title: "A close-out confirmed in one tab stays open in the other" }, `${L.today}: ${b.closing}`);
}

// Feb 29: a birthday on it shows on its day in a leap year (and on Feb 28 otherwise), on Momo's board as Pabu sends it.
async function leap(L) {
  if (!(L.def.world && L.def.world.pabu && L.def.world.pabu.leap)) return; // only a life with someone born on Feb 29
  const r = await L.page.evaluate(() => { const d = Kyoshi.util.todayStr(); return Kyoshi.agenda(d, d).filter(e => e.app === "pabu" && /Lee Ann/.test(e.title)).map(e => e.date); });
  const leapYear = +L.today.slice(0, 4) % 4 === 0, want = (leapYear && L.today.endsWith("02-29")) || (!leapYear && L.today.endsWith("02-28"));
  L.count("leapChecked");
  if (want !== r.length > 0) L.find("leap-birthday", { kind: "bug", sev: "occasional", title: "A Feb 29 birthday isn't on its day" }, `${L.today}: ${r.length ? "shown" : "not shown"}`);
}

// The calendar's edges, on the days they come: Dec 21 (winter belongs to the next year), Jan 1, Feb 28/29, a monthly meeting met
// on Jan 31 (due a month on: Feb 28 or 29).
async function dateProbes(L, date) {
  const md = date.slice(5), y = +date.slice(0, 4);
  if (md === "02-28" || md === "02-29") await leap(L);
  if (md >= "12-20" && md <= "12-23") {
    const r = await L.page.evaluate(() => { const I = Kyoshi.apps.iroh, d = Kyoshi.util.todayStr(); return { season: I.currentSeason(), year: I.thisYear(), winter: Kyoshi.seasons.seasonStart(+d.slice(0, 4), 3), d }; });
    L.count("winterChecked");
    if ((r.d >= r.winter) !== (r.season === `${y + 1}-winter`)) L.find("winter-year", { kind: "bug", sev: "occasional", title: "The winter that starts in December isn't the next year's in Iroh" }, JSON.stringify(r));
    else if (r.d >= r.winter && r.year !== String(y + 1)) L.find("winter-year", { kind: "bug", sev: "occasional", title: "Iroh's year doesn't move with the winter" }, JSON.stringify(r));
  }
  if (md === "01-31" && L.habits.irohLed && L.uses("iroh")) {
    const acts = require("./acts");
    await acts.meetingDone(L, "iroh", "reconcile");
    const line = await L.page.evaluate(() => Kyoshi.meetings.bugLine(Kyoshi.apps.iroh));
    const days = /reconcile every month, met 0 days ago, due in (\d+) days/.exec(line), want = y % 4 === 0 ? 29 : 28;
    L.count("jan31Checked");
    if (!days || +days[1] !== want) L.find("jan31-month", { kind: "bug", sev: "occasional", title: "A monthly meeting met on Jan 31 isn't due at February's end" }, `${date}: ${line}`);
  }
}

// Daylight saving (the long haul, America/Chicago): the night the clocks change, Kyoshi's day and Momo's rollover come once.
async function dst(L, sunday) {
  const sat = L.addDays(sunday, -1), read = () => L.page.evaluate(() => ({ today: Kyoshi.util.todayStr(), known: Kyoshi.apps.momo.S.knownToday, hours: Kyoshi.apps.momo.hoursNow() }));
  await L.clockTo(sat, "23:30");
  const a = await read();
  await L.clockTo(sunday, "03:30");
  const b = await read();
  await L.switchTo("momo", { observer: true });
  await L.page.evaluate(() => Kyoshi.apps.momo.renderAll());
  L.count("dstChecked");
  if (a.today !== sat || b.today !== sunday || b.known !== sunday) L.find("dst-day", { kind: "bug", sev: "occasional", title: "The night the clocks change, Kyoshi's day goes wrong" }, `${sunday}: Sat 23:30 → ${JSON.stringify(a)}, Sun 03:30 → ${JSON.stringify(b)}`);
}

// --- Milestones, at the end of each step's day ---
// A life's year is 52 weeks from its first (week 0, Sep 28 – Oct 4, 2026); it ends on the Sunday of week 52n − 1.
async function milestones(L, date) {
  if (L.dayIndex(date) !== 6) return;
  const week = weekOf(date) + 1;
  if ([1, 2, 4, 13, 26, 52].includes(week)) await L.milestoneShot(`week-${String(week).padStart(2, "0")}`);
  if (week % 52) return;
  const year = week / 52;
  await L.milestoneShot(`year-${year}`);
  const measure = (L.def.id === "long" && [1, 5, 10].includes(year)) || L.def.id === "changes" || L.def.id === "seasons";
  const { file } = measure ? await timings(L, `year ${year}`) : { file: await L.exportAll() };
  // The bundle for the owner's own testing, without Export all's indentation (Import all reads it the same), if under 2 MB.
  const compact = JSON.stringify(JSON.parse(file));
  fs.mkdirSync(BUNDLES, { recursive: true });
  if (Buffer.byteLength(compact) < 2 * 1024 * 1024) fs.writeFileSync(path.join(BUNDLES, `${L.def.id}-y${year}.json`), compact);
  else L.find("bundle-big", { kind: "sim", sev: "cosmetic", title: "An Export all bundle is over 2 MB" }, `${L.def.id} year ${year}: ${Buffer.byteLength(compact)} bytes`);
  if (measure) {
    const r = await freshImport(L, file);
    L.timings.push({ label: `import year ${year}`, date: L.today, importMs: r.importMs, same: r.same });
  }
}

module.exports = { timings, freshImport, reinstall, oldImport, twoTabs, otherTab, leap, dateProbes, dst, milestones, BUNDLES };
