/* Kyoshi · tests/badgermole-session.test.js — a workout on the phone, tap by tap: the prefill from the routine, − / +
 * and typing, ✓ and Log all sets (the screen stays: "Set 4"), Next, Back and the list, PRs as they happen (never the
 * first set ever), a logged set tapped to change (in its place; back as it was if you move on), Finish and its day
 * pop-up; the next session's prefill (from last time, one step up when every set hit); units (kg shown, lb kept as
 * typed); a reload resumes; Cancel and an empty Finish keep nothing; a forgotten session ends at its last set. */
"use strict";
const { TODAY, eq, ok, has, open, lastDialog, importBackup, exportBackup, addDays, at } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");

module.exports = [
  {
    name: "session: prefill, steppers, typing, Log all, extra sets, Next / Back / the list, PRs, a set changed, Finish",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.setup());
      await bm.start(tab, "Push");
      let s = await bm.screen(tab);
      eq([s.exercise, s.set, s.weight, s.reps, s.weightLabel, s.up], ["Bench press", "Set 1 of 3", "135", "5", "Weight (lb)", false], "the first set, from the routine");
      eq(s.next, "Next: Overhead press", "Next names the next exercise");
      await p.click("#logBtn");
      s = await bm.screen(tab);
      eq(s.logged, ["1 135 lb × 5 ✓"], "set 1 logged, no PR (the first ever)");
      eq([s.set, s.weight, s.reps], ["Set 2 of 3", "135", "5"], "set 2 starts from set 1");
      await p.click('[data-step="weight"][data-dir="1"]');
      eq(await p.locator("#weightInput").inputValue(), "140", "+ adds 5 lb");
      await p.click("#logBtn");
      s = await bm.screen(tab);
      eq(s.logged[1], "2 140 lb × 5 ✓ PR", "a heavier set is a PR, at once");
      has(s.status, "Set 2 logged: 140 lb × 5", "what was logged");
      // Typing: 145 × 4 (est. 1RM 164.3) beats 140 × 5 (163.3).
      await p.fill("#weightInput", "145");
      await p.fill("#repsInput", "4");
      await p.click("#logBtn");
      s = await bm.screen(tab);
      eq([s.logged[2], s.set], ["3 145 lb × 4 ✓ PR", "Set 4"], "typed values logged; past the plan it's Set 4");
      ok(await p.locator("#logAllBtn").isDisabled(), "Log all sets is done once the planned sets are");
      await p.click("#logBtn");
      s = await bm.screen(tab);
      eq([s.exercise, s.set, s.logged.length], ["Bench press", "Set 5", 4], "an extra set; the screen stays on the exercise");

      // Log all sets: the rest of the plan at the values shown; the screen stays ("Set 4") until Next.
      await p.click("#nextBtn");
      eq((await bm.screen(tab)).weight, "75", "Overhead press starts from its routine line");
      await p.click("#logAllBtn");
      s = await bm.screen(tab);
      eq([s.exercise, s.set, s.logged.length], ["Overhead press", "Set 4", 3], "Log all sets logged 3 and stayed");
      has(s.list.join(" | "), "Overhead press 3/3 ✓", "the list ticks it off");
      await p.click("#backBtn");
      eq((await bm.screen(tab)).set, "Set 5", "Back: Bench press, 4 logged");
      // A jump from the list to the bodyweight exercise: reps first, added weight 0.
      await p.click('#exList .ex-chip:has-text("Push-up")');
      s = await bm.screen(tab);
      eq([s.exercise, s.weightLabel, s.weight, s.reps, s.next], ["Push-up", "Added weight (lb)", "0", "15", "Last exercise"], "the bodyweight exercise");
      await p.click("#logBtn");
      eq((await bm.screen(tab)).logged, ["1 15 reps ✓"], "a bodyweight set");

      // A set tapped to change: held in the steppers; moving on puts it back as it was.
      await p.click('#exList .ex-chip:has-text("Bench press")');
      await p.click('#loggedList .logged-set >> nth=1');
      s = await bm.screen(tab);
      eq([s.set, s.weight, s.reps, s.logged.length], ["Set 2 of 3", "140", "5", 3], "set 2 waits in the steppers");
      has(s.status, "is in the steppers", "it says so");
      await p.click("#nextBtn");
      await p.click("#backBtn");
      eq((await bm.screen(tab)).logged[1], "2 140 lb × 5 ✓ PR", "moving on put it back, in its place");
      // Changed and logged again: in its place.
      await p.click('#loggedList .logged-set >> nth=1');
      await p.fill("#repsInput", "6");
      await p.click("#logBtn");
      s = await bm.screen(tab);
      eq(s.logged.map(x => x.replace(/ ✓.*/, "")), ["1 135 lb × 5", "2 140 lb × 6", "3 145 lb × 4", "4 145 lb × 4"], "re-logged in its place");

      await t.contexts[0].clock.fastForward(40 * 60000);
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      has(await p.locator("#dayTitle").innerText(), "Wed, Sep 30", "Finish opens the day's pop-up");
      has(await p.locator("#daySessions").innerText(), "40 min · 8 sets", "its length and sets");
      ok(await p.locator("#daySessions .badge.pr").count() >= 1, "PR marks in the day pop-up");
      await p.click("#dayCancelBtn");
      eq(await bm.stats(tab), { week: "1 of 3", streak: "No streak yet" }, "this week counts it");
      eq(Object.keys(await bm.filledDays(tab)), [TODAY], "the calendar fills today");
      has(await bm.nextUp(tab), "Pull", "Next up moves on in the program");
      await bm.openFold(tab, "exercises");
      has((await bm.rows(tab, "exercises")).find(r => r.startsWith("Bench press")), "best 140 lb × 6 (est. 1RM 168) · Sep 30", "the best set");
    }
  },
  {
    name: "session: the next one starts from last time, a step up when every set hit",
    async run(t) {
      const tab = await open(t), p = tab.page, data = gen.setup(), day = addDays(TODAY, -2);
      const last = gen.session("s-last", "rt-push", day, { allHit: true });
      last.sets.filter(x => x.exerciseId === "ex-ohp")[2].reps = 7; // one short set: no step up for it
      last.sets.filter(x => x.exerciseId === "ex-ohp")[0].weight = 80;
      data.sessions.push(last);
      await importBackup(tab, data);
      await bm.start(tab, "Push");
      let s = await bm.screen(tab);
      eq([s.weight, s.reps, s.up], ["140", "5", true], "Bench: last time's 135, a step up, with the note");
      await p.click("#logBtn");
      eq([(await bm.screen(tab)).weight, (await bm.screen(tab)).up], ["140", false], "set 2 starts from set 1, no note");
      await p.click("#nextBtn");
      s = await bm.screen(tab);
      eq([s.weight, s.reps, s.up], ["80", "8", false], "Overhead press: last time's set 1, no step (a set fell short)");
      await p.click("#nextBtn");
      s = await bm.screen(tab);
      eq([s.weight, s.reps, s.up], ["0", "16", true], "Push-up: one rep more");
    }
  },
  {
    name: "session: units — kg shows old lb sets converted, logs in kg, and the lb sets stay exactly as typed",
    async run(t) {
      const tab = await open(t), p = tab.page, data = gen.setup(), day = addDays(TODAY, -2);
      const last = gen.session("s-last", "rt-push", day);
      last.sets.forEach(x => { if (x.exerciseId === "ex-bench") x.reps = x.n === 3 ? 4 : 5; });
      data.sessions.push(last);
      await importBackup(tab, data);
      await bm.openFold(tab, "settings");
      await p.click('#unitToggle [data-unit="kg"]');
      await bm.openFold(tab, "exercises");
      has((await bm.rows(tab, "exercises")).find(r => r.startsWith("Bench press")), "best 61.2 kg × 5", "135 lb shows as 61.2 kg");
      await p.click(`#calGrid [data-date="${day}"]`);
      eq(await p.locator("#daySessions .day-w").first().inputValue(), "61.2", "the day pop-up converts");
      await p.click("#dayCancelBtn");
      await bm.start(tab, "Push");
      let s = await bm.screen(tab);
      eq([s.weightLabel, s.weight, s.up], ["Weight (kg)", "61", false], "prefill converted to the nearest 0.5 kg");
      await p.click('[data-step="weight"][data-dir="1"]');
      eq(await p.locator("#weightInput").inputValue(), "63.5", "+ adds 2.5 kg");
      await p.click("#logBtn");
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      await p.click("#dayCancelBtn");
      await p.click('#unitToggle [data-unit="lb"]');
      await p.click(`#calGrid [data-date="${day}"]`);
      eq(await p.locator("#daySessions .day-w").first().inputValue(), "135", "back in lb: exactly as typed");
      await p.click("#dayCancelBtn");
      const backup = await exportBackup(tab), today = backup.sessions.find(x => x.date === TODAY && !x.deleted);
      eq([today.sets[0].weight, today.sets[0].unit], [63.5, "kg"], "the new set is stored in kg");
      eq([backup.sessions[0].sets[0].weight, backup.sessions[0].sets[0].unit], [135, "lb"], "the old set is still 135 lb");
      eq(backup.live, undefined, "a backup never holds the session in progress");
    }
  },
  {
    name: "session: a reload resumes it; Cancel and an empty Finish keep nothing; a forgotten one ends at its last set",
    async run(t) {
      const tab = await open(t), p = tab.page, clock = () => t.contexts[0].clock;
      await importBackup(tab, gen.setup());
      await bm.start(tab, "Legs");
      await p.click("#logBtn");
      await p.fill("#repsInput", "7");
      await p.locator("#repsInput").blur();
      await p.reload();
      await p.waitForSelector("#sessionView:not([hidden])");
      const s = await bm.screen(tab);
      eq([s.exercise, s.logged.length, s.reps], ["Squat", 1, "7"], "the reload resumed it, steppers as left");
      await p.click("#cancelSessionBtn");
      has(lastDialog(tab), "Cancel this session and its 1 set?", "cancel asks");
      await bm.start(tab, "Legs");
      await p.click("#finishBtn");
      has(lastDialog(tab), "Nothing was logged. Discard this session?", "an empty Finish asks");
      eq(await p.evaluate(() => Kyoshi.apps.badgermole.S.sessions.length), 0, "nothing kept");

      // Forgotten: a set 10 minutes in, then Finish 7 hours later.
      await bm.start(tab, "Legs");
      await clock().fastForward(10 * 60000);
      await p.click("#logBtn");
      await clock().fastForward(7 * 3600000);
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      has(await p.locator("#daySessions").innerText(), "· 10 min · 1 set", "it ended at its last set");
      await p.click("#dayCancelBtn");
      const started = await p.evaluate(() => Kyoshi.apps.badgermole.S.sessions[0].started);
      ok(started >= at(TODAY) && started < at(TODAY, "08:00"), "times follow the clock (time travel aware)");
    }
  },
  {
    name: "session: past midnight it stays on the day it started; Enter only puts the keyboard away; a held set is kept at Finish",
    async run(t) {
      const tab = await open(t, { time: at(TODAY, "23:50") }), p = tab.page;
      await importBackup(tab, gen.setup());
      await bm.start(tab, "Push");
      await p.click("#logBtn");
      await p.locator("#repsInput").press("Enter");
      eq((await bm.screen(tab)).logged.length, 1, "Enter in a field logs nothing");
      await p.click('#loggedList .logged-set >> nth=0');
      eq((await bm.screen(tab)).logged.length, 0, "the set is held in the steppers");
      await tab.ctx.clock.fastForward(20 * 60000); // past midnight
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      has(await p.locator("#dayTitle").innerText(), "Wed, Sep 30", "the session is on the day it started");
      has(await p.locator("#daySessions").innerText(), "1 set", "the held set was kept");
      await p.click("#dayCancelBtn");
      eq(await p.evaluate(() => Kyoshi.util.todayStr()), addDays(TODAY, 1), "it is the next day now");
      eq(Object.keys(await bm.filledDays(tab)), [TODAY], "the calendar shows it on the day it started");
    }
  },
  {
    name: "session: a held set through a unit switch keeps its own unit; another tab's save keeps what's being typed",
    async run(t) {
      const a = await open(t), p = a.page;
      await importBackup(a, gen.setup());
      await bm.start(a, "Push");
      await p.click("#logBtn");
      await p.click('#loggedList .logged-set >> nth=0');
      await p.click('#sessionView [data-act="home"]');
      await bm.openFold(a, "settings");
      await p.click('#unitToggle [data-unit="kg"]');
      await p.click('#nextUp [data-act="resume"]');
      let s = await bm.screen(a);
      eq([s.weight, s.weightLabel], ["61", "Weight (kg)"], "the held 135 lb set, shown in kg");
      has(s.status, "is in the steppers", "still held");
      await p.click("#logBtn");
      const kept = await p.evaluate(() => Kyoshi.apps.badgermole.S.live.sets[0]);
      eq([kept.weight, kept.unit], [135, "lb"], "logged again unchanged: its own weight and unit");

      // A second tab of the same browser saves; the reps typed here (not yet left) stay.
      const b = await open(t, { ctx: a.ctx });
      const before = await b.page.evaluate(() => Kyoshi.apps.badgermole.S.version);
      await p.click('[data-step="weight"][data-dir="1"]'); // stores the session: the other tab reloads just that
      // The other tab has read the stored session (its reload is a 50 ms timer after that): run the timer, then check.
      await b.page.waitForFunction(w => Kyoshi.apps.badgermole.store.json("live")?.show?.weight === w, Number(await p.locator("#weightInput").inputValue()));
      await b.ctx.clock.runFor(100);
      eq(await b.page.evaluate(() => Kyoshi.apps.badgermole.S.version), before, "the other tab didn't redo its stats");
      await p.fill("#repsInput", "9"); // typed, the field not left: not stored yet
      await b.page.evaluate(() => { const A = Kyoshi.apps.badgermole; A.S.settings = { ...A.S.settings, weeklyTarget: 4, u: Date.now() }; A.save(); });
      await p.waitForFunction(() => Kyoshi.apps.badgermole.S.settings.weeklyTarget === 4);
      eq(await p.locator("#repsInput").inputValue(), "9", "the typed reps survived the other tab's save");
    }
  }
];
