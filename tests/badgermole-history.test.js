/* Kyoshi · tests/badgermole-history.test.js — Badgermole with lots of made-up history: what it works out (this week,
 * the streak, the next routine, every exercise's best, the calendar) checked against the data, worked out again here
 * the simple way; ten years of workouts stay quick; the streak through time travel; the day pop-up's edits; Export and
 * Import (counts, the session in progress kept), backups that aren't Badgermole's refused, a damaged one cleaned; and
 * bug reports that hold no names. */
"use strict";
const { TODAY, eq, ok, has, lacks, open, lastDialog, importBackup, exportBackup, travel, addDays, mondayOf, at } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");

// What the app should show, worked out from a backup the plain way (no code shared with the app).
function expected(data) {
  const sessions = data.sessions.filter(s => !s.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.started - b.started);
  const weeks = new Map();
  sessions.forEach(s => { const m = mondayOf(s.date); weeks.set(m, (weeks.get(m) || 0) + 1); });
  const target = data.settings.weeklyTarget, monday = mondayOf(TODAY);
  let streak = (weeks.get(monday) || 0) >= target ? 1 : 0;
  for (let m = addDays(monday, -7); (weeks.get(m) || 0) >= target; m = addDays(m, -7)) streak++;
  const order = data.program.order, last = sessions[sessions.length - 1];
  const next = order[(order.indexOf(last.routineId) + 1) % order.length]; // the generator keeps strictly to the order
  const best = {};
  sessions.forEach(s => s.sets.forEach(x => {
    if (x.bodyweight || x.reps < 1) return;
    const kg = x.unit === "kg" ? x.weight : x.weight / gen.LB_PER_KG, score = kg * (1 + x.reps / 30);
    if (!best[x.exerciseId] || score > best[x.exerciseId].score + 1e-9) best[x.exerciseId] = { score, set: x, date: s.date };
  }));
  return { sessions, thisWeek: weeks.get(monday) || 0, streak, next: data.routines.find(r => r.id === next).name, best };
}
const short = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.slice(0, 4) === TODAY.slice(0, 4) ? undefined : "numeric", timeZone: "UTC" });
const lb = x => (x.unit === "lb" ? String(+x.weight.toFixed(2)) : String(+(x.weight * gen.LB_PER_KG).toFixed(1)));

module.exports = [
  {
    name: "history: two years of generated workouts — week, streak, next routine, bests and calendar match the data",
    async run(t) {
      const tab = await open(t), p = tab.page;
      const data = gen.history({ weeks: 104, gaps: [10, 40], thisWeek: 1, kgBefore: 80, seed: 7 }), want = expected(data);
      await importBackup(tab, data);
      eq(await bm.stats(tab), { week: `${want.thisWeek} of 3`, streak: `${want.streak} weeks` }, "this week and the streak");
      has(await bm.nextUp(tab), `\n${want.next}\n`, "the next routine follows the program");
      await bm.openFold(tab, "exercises");
      const rows = await bm.rows(tab, "exercises");
      for (const [id, b] of Object.entries(want.best)) {
        const name = gen.EXERCISES.find(e => e[0] === id)[1], row = rows.find(r => r.startsWith(`${name} ·`));
        const oneRM = Math.round(b.score * gen.LB_PER_KG);
        has(row, `best ${lb(b.set)} lb × ${b.set.reps} (est. 1RM ${oneRM}) · ${short(b.date)}`, `${name}'s best`);
      }
      // The calendar: this month's days, then the month before.
      for (const month of [TODAY.slice(0, 7), addDays(`${TODAY.slice(0, 7)}-01`, -1).slice(0, 7)]) {
        const days = [...new Set(want.sessions.filter(s => s.date.startsWith(month)).map(s => s.date))].sort();
        eq(Object.keys(await bm.filledDays(tab)).filter(d => d.startsWith(month)).sort(), days, `the filled days of ${month}`);
        await p.click("#calPrev");
      }
      ok(await p.locator("#calNext").isEnabled(), "› comes back toward this month");
      // Deleted markers never show; nothing reads "undefined" or "NaN".
      const page = await p.locator("#kMount").innerText();
      for (const bad of ["undefined", "NaN", "null"]) lacks(page, bad, "the page's text");
      // An export holds what was imported, cleaned the same way.
      const out = await exportBackup(tab);
      eq([out.sessions.length, out.exercises.length, out.schemaVersion], [data.sessions.length, data.exercises.length, 1], "the export's counts");
    }
  },
  {
    name: "history: ten years of workouts stay quick to draw and to read for Momo",
    serial: true, // it times the import and a redraw: run alone, after the others
    async run(t) {
      const tab = await open(t), p = tab.page, data = gen.history({ weeks: 520, thisWeek: 1, seed: 3 });
      const t0 = Date.now();
      await importBackup(tab, data);
      const importMs = Date.now() - t0;
      const ms = await p.evaluate(() => {
        const A = Kyoshi.apps.badgermole, t1 = Date.now();
        for (let i = 0; i < 5; i++) { A.S.version++; A.renderAll(); A.inbox("2026-09-30", "2026-10-11"); }
        return (Date.now() - t1) / 5;
      });
      ok(importMs < 4000, `the import took ${importMs} ms`);
      ok(ms < 300, `a full redraw and Momo's read take ${ms.toFixed(0)} ms with ${data.sessions.length} sessions`);
      eq((await bm.stats(tab)).streak, "520 weeks", "the streak over ten years");
    }
  },
  {
    name: "history: the streak through time travel — an open week never breaks it, a short one does",
    async run(t) {
      const tab = await open(t);
      await importBackup(tab, gen.history({ weeks: 6, thisWeek: 2 }));
      eq(await bm.stats(tab), { week: "2 of 3", streak: "6 weeks" }, "six full weeks; this one still open");
      await bm.doSession(tab, "Push");
      eq(await bm.stats(tab), { week: "3 of 3", streak: "7 weeks" }, "this week hits the target");
      await travel(tab, 7);
      eq(await bm.stats(tab), { week: "0 of 3", streak: "7 weeks" }, "a new week, still open");
      await bm.doSession(tab, (await bm.nextUp(tab)).split("\n")[1]);
      await travel(tab, 7);
      eq(await bm.stats(tab), { week: "0 of 3", streak: "No streak yet" }, "last week fell short");
      for (let i = 0; i < 3; i++) await bm.doSession(tab, (await bm.nextUp(tab)).split("\n")[1]);
      eq(await bm.stats(tab), { week: "3 of 3", streak: "1 week" }, "a new streak");
      has(await tab.page.locator("#kTestBanner").innerText(), "Test mode", "time travel is in test mode");
    }
  },
  {
    name: "history: the day pop-up — two sessions a day, fix a set, remove one, add one, delete a session",
    async run(t) {
      const tab = await open(t), p = tab.page, data = gen.setup(), day = addDays(TODAY, -1);
      data.sessions.push(gen.session("s-push", "rt-push", day, { allHit: true }), gen.session("s-legs", "rt-legs", day, { allHit: true }));
      data.sessions[1].started = data.sessions[0].finished + 600000;
      data.sessions[1].finished = data.sessions[1].started + 1800000;
      await importBackup(tab, data);
      eq((await bm.filledDays(tab))[day], "29×2", "two sessions on a day");
      await p.click(`#calGrid [data-date="${day}"]`);
      eq(await p.locator("#daySessions .day-session").count(), 2, "both in the pop-up");
      const push = p.locator('#daySessions .day-session[data-id="s-push"]');
      // Esc with a change asks; saying no keeps it open.
      await push.locator(".day-w").first().fill("150");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      has(lastDialog(tab), "Discard your changes to this day's sets?", "Esc asks first");
      await push.locator(".day-r").nth(1).fill("0");
      await push.locator('[data-day="remove"]').nth(2).click();
      await push.locator('[data-day="add"]').nth(1).click();
      await p.click('#dayForm button[type="submit"]');
      const saved = await p.evaluate(() => Kyoshi.apps.badgermole.sessionById("s-push").sets.map(x => `${x.name} ${x.n}: ${x.weight}${x.unit}×${x.reps}`));
      eq(saved.slice(0, 2), ["Bench press 1: 150lb×5", "Bench press 2: 135lb×0"], "fixed weight, 0 reps kept");
      eq(saved.filter(x => x.startsWith("Overhead press")).length, 4, "+ set added one");
      eq(saved.length, 9, "one removed, one added");
      await bm.openFold(tab, "exercises");
      has((await bm.rows(tab, "exercises")).find(r => r.startsWith("Bench press")), "best 150 lb × 5 (est. 1RM 175)", "the best follows the fix");
      // Delete the Legs session: the day is back to one.
      await p.click(`#calGrid [data-date="${day}"]`);
      await p.click('#daySessions .day-session[data-id="s-legs"] [data-day="delete"]');
      has(lastDialog(tab), "Delete this session (Legs, 4 sets)?", "delete asks");
      eq(await p.locator("#daySessions .day-session").count(), 1, "one left in the pop-up");
      await p.click("#dayCancelBtn");
      eq((await bm.filledDays(tab))[day], "29", "the calendar follows");
      const marker = await p.evaluate(() => Kyoshi.apps.badgermole.S.sessions.find(x => x.id === "s-legs"));
      eq(Object.keys(marker).sort(), ["deleted", "id", "started", "u"], "a deleted session is a bare marker");
    }
  },
  {
    name: "history: Export / Import keep a session in progress; other apps' and broken backups are refused; a damaged one is cleaned",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.history({ weeks: 4 }));
      await bm.start(tab, "Push");
      await p.click("#logBtn");
      tab.answers.push(false); // Cancel the session, then "no": it was a slip
      await p.click("#cancelSessionBtn");
      ok(await p.locator("#sessionView").isVisible(), "saying no keeps the session");
      await p.click('#sessionView [data-act="home"]');
      has((await bm.nextUp(tab)).toLowerCase(), "in progress", "Home while it's in progress");
      await importBackup(tab, gen.history({ weeks: 8, seed: 2 }));
      has(lastDialog(tab), "Replace your 8 exercises and 12 sessions with the 8 exercises and 24 sessions in this backup?", "the confirm counts");
      has((await bm.nextUp(tab)).toLowerCase(), "in progress", "the session in progress stays");
      await p.click('#nextUp [data-act="resume"]');
      await p.click("#finishBtn");
      await p.click("#dayCancelBtn");
      eq(await p.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 25, "it finished into the imported data");

      for (const [file, says] of [[gen.hawky(), "doesn't look like a Badgermole backup"], [gen.wanshitong(), "doesn't look like a Badgermole backup"],
        ["{not json", "isn't a valid Badgermole backup"], [{ exercises: [], sessions: [] }, "has no exercises or sessions in it"]]) {
        await importBackup(tab, file);
        has(lastDialog(tab), says, "refused");
        eq(await p.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 25, "nothing changed");
      }
      await importBackup(tab, { ...gen.history({ weeks: 1 }), schemaVersion: 9 });
      has(tab.dialogs.map(d => d[1]).join(" | "), "made by a newer version of Badgermole", "a newer backup is imported with a heads-up");

      const fresh = await open(t);
      await importBackup(fresh, gen.damaged());
      await bm.openFold(fresh, "exercises");
      eq(await bm.rows(fresh, "exercises"), ["Squat deep · best 4409.2 lb × 5 (est. 1RM 5144) · Sep 28", "Pull-up · best 12 reps · Sep 28"], "only usable exercises, cleaned");
      eq(await bm.rows(fresh, "routines"), [`${"A".repeat(30)} · 1 exercise · usually 5 min`], "the routine, its name cut, its dangling line skipped");
      eq(await bm.stats(fresh), { week: "1 of 14", streak: "No streak yet" }, "settings cleaned (target 14)");
      has(await bm.nextUp(fresh), "A".repeat(30), "the program skips ids it doesn't know");
    }
  },
  {
    name: "history: bug reports hold counts, never exercise or routine names",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.history({ weeks: 3 }));
      await p.click("#kReportBug");
      await p.fill("#kBugText", "Testing the report");
      await p.click("#kBugSubmit");
      const report = await p.evaluate(() => Kyoshi.apps.kyoshi.store.json("bugReports").pop().markdown);
      has(report, "state: Exercises: 8 (2 bodyweight); routines: 3; programs: 1 (active 1), rotation 3", "the app's counts, on one dense line");
      for (const name of ["Bench press", "Squat", "Push", "Pull-up"]) lacks(report, name, "no names in a bug report");
    }
  }
];
