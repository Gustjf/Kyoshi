/* Kyoshi · tests/momo-sleep.test.js — Momo's sleep routine (Phase 6 of plan_2026-10-05): the Baseline tab's Sleep
 * routine… makes pinned sleep cards in the baseline, a night's part on each day it touches (split at midnight), a
 * wind-down at the top of the evening's card and a morning routine at the bottom of the morning's (ordinary cards inside
 * them); a wind-down that starts before a bedtime after midnight begins on a card of its own that evening. The pop-up
 * reads itself back from those cards; saving again replaces them (asked first); what can't be a night is refused in its
 * status line; cards of yours they run into show red and it says so. Load baseline brings them into a week, Remove takes
 * them out of the baseline (a week keeps its own); a pasted copy is yours; the mark survives Export and Import; on a
 * phone the pop-up fits. */
"use strict";
const { DESKTOP, PHONE, eq, ok, open, lastDialog, importBackup, exportBackup } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

// A day's cards on the board in time order, each as "Title 0900–0930".
const block = d => d.cards.filter(c => c.time).sort((a, b) => a.time.localeCompare(b.time)).map(c => `${c.title} ${c.time}`);
// The sleep routine's cards as stored in the baseline (or a week, by its Monday), in order: [title, hours, day, pin, the
// cards inside it].
const sleepCards = (tab, key = "base") => tab.page.evaluate(k => {
  const A = Kyoshi.apps.momo, list = k === "base" ? A.S.data.baseline : A.S.data.weeks[k] || { cards: [] };
  return list.cards.filter(c => c.sleep).map(c => [c.title, c.hours, c.day, c.pin, A.innerCards(list, c).map(x => `${x.title} ${x.hours * 60}m at the ${x.pos}`).join(", ")]);
}, key);
// No meal slots from Turtleduck's routine: the board holds only the test's cards.
const noSlots = tab => tab.page.evaluate(() => { Kyoshi.apps.turtleduck.routine = () => []; Kyoshi.tick(); });
const ALL = [0, 1, 2, 3, 4, 5, 6];

module.exports = [
  {
    name: "momo sleep: pinned sleep cards split at midnight with a wind-down inside; read back, replaced when saved again, loaded into a week, removed",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await noSlots(tab);
      await mo.view(tab, "base");
      eq((await mo.bank(tab)).buttons, ["Start from a sample", "Sleep routine…"], "on the Baseline tab");

      // A new routine: 2300 to 0700, every night, nothing before or after.
      let form = await mo.sleepRoutine(tab, {}, false);
      eq(form, { open: true, bed: "2300", wake: "0700", nights: ALL, wind: 0, windTitle: "Wind down", rise: 0, riseTitle: "Morning routine", title: "Sleep",
        note: "8h of sleep a night.", status: "", remove: false, cancel: "Cancel" }, "a new one");
      // 2200 to 0500 with a 30-minute wind-down: Monday's evening is a block pinned at 2130, Tuesday's morning 0000–0500.
      form = await mo.sleepRoutine(tab, { bed: "2200", wake: "0500", wind: 30 });
      eq(form.open, false, "saved and closed");
      let days = await mo.days(tab);
      eq(block(days[0]), ["Sleep 0000–0500", "Wind down 2130–2200", "Sleep 2200–2400"], "Monday: Sunday night's morning, then its own evening, the wind-down first");
      eq(block(days[1]), ["Sleep 0000–0500", "Wind down 2130–2200", "Sleep 2200–2400"], "Tuesday: Monday night's morning, and so on");
      eq(days[0].cards.find(c => c.time === "2200–2400").label, "Sleep, 2h + Wind down 30m = 2.5h, pinned at 2130", "pinned where its block starts");
      eq(days.map(d => d.total), [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5], "7h of sleep and 30m before it a day");
      let stored = await sleepCards(tab);
      eq(stored.length, 14, "14 cards: an evening's and a morning's for each night");
      eq(stored.filter(c => c[2] === 0), [["Sleep", 5, 0, 0, ""], ["Sleep", 2, 0, 21.5, "Wind down 30m at the top"]], "pinned, the wind-down an ordinary card inside");

      // Reopened: read back from its cards.
      form = await mo.sleepRoutine(tab, {}, false);
      eq(form, { open: true, bed: "2200", wake: "0500", nights: ALL, wind: 30, windTitle: "Wind down", rise: 0, riseTitle: "Morning routine", title: "Sleep",
        note: "7h of sleep a night, 7.5h with the time before and after.", status: "", remove: true, cancel: "Cancel" }, "as saved");
      // Saved again at 2300 with no wind-down: asked, then the old cards are replaced.
      form = await mo.sleepRoutine(tab, { bed: "2300", wind: 0 });
      eq([lastDialog(tab), form.open], ["Replace the baseline's sleep cards?", false], "asked first");
      eq(block((await mo.days(tab))[2]), ["Sleep 0000–0500", "Sleep 2300–2400"], "replaced");
      stored = await sleepCards(tab);
      eq([stored.length, stored.filter(c => c[4]).length], [14, 0], "still 14, nothing inside them");
      // Asked again and answered No: nothing changes, the pop-up stays.
      tab.answers.push(false);
      form = await mo.sleepRoutine(tab, { bed: "2330" });
      eq([lastDialog(tab), form.open], ["Replace the baseline's sleep cards?", true], "No keeps it open");
      eq(block((await mo.days(tab))[2]), ["Sleep 0000–0500", "Sleep 2300–2400"], "as they were");
      await mo.closeSleep(tab);
      eq([(await mo.sleepForm(tab)).open, tab.dialogs.length], [false, 0], "Cancel closes without asking");

      // Load baseline brings them into this week; the button is the baseline's only.
      await mo.view(tab, "this");
      ok(!(await mo.visible(tab, "sleepBtn")), "not on a week");
      await mo.loadBaseline(tab);
      eq(block((await mo.days(tab))[3]), ["Sleep 0000–0500", "Sleep 2300–2400"], "this week has them");
      const tk = await p.evaluate(() => Kyoshi.apps.momo.thisWeekKey());
      eq((await sleepCards(tab, tk)).length, 14, "still marked there");

      // Remove: out of the baseline, asked first; this week keeps its own.
      await mo.view(tab, "base");
      await mo.sleepRoutine(tab, {}, false);
      await mo.removeSleep(tab);
      eq(lastDialog(tab), "Remove the baseline's 14 sleep cards? Weeks already loaded keep theirs.", "asked first");
      eq([(await sleepCards(tab)).length, (await sleepCards(tab, tk)).length, (await mo.sleepForm(tab)).open], [0, 14, false], "gone from the baseline only");
      eq((await mo.bank(tab)).buttons, ["Start from a sample", "Sleep routine…"], "an empty baseline again");
    }
  },
  {
    name: "momo sleep: a bedtime after midnight starts its wind-down the evening before; refusals; cards running into them are flagged; a copy is yours; through a backup",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await noSlots(tab);
      await importBackup(tab, gen.momoWorld({ baseline: [{ title: "Work", hours: 8, days: [0, 1, 2, 3, 4] }, { title: "Gym", hours: 1, days: [0], pin: 22.5 }, { title: "Sleep", hours: 8, days: [5, 6] }] }));
      await mo.view(tab, "base");

      // 0030 to 0730 with an hour's wind-down, on the nights before a weekday (Sunday to Thursday): it starts at 2330.
      let form = await mo.sleepRoutine(tab, { bed: "0030", wake: "0730", wind: 60, nights: [0, 1, 2, 3, 6] });
      eq(form.open, false, "nothing runs into them: saved and closed");
      let days = await mo.days(tab);
      eq(block(days[0]), ["Wind down 0000–0030", "Sleep 0030–0730", "Work 0730–1530", "Gym 2230–2330", "Wind down 2330–2400"], "Monday: Sunday night's, Work after it, then Monday night's start");
      eq(block(days[4]), ["Wind down 0000–0030", "Sleep 0030–0730", "Work 0730–1530"], "Friday: Thursday night's, none of its own");
      eq(block(days[5]), ["Sleep 0000–0800"], "Saturday: only the Sleep card made by hand");
      eq(block(days[6]), ["Sleep 0000–0800", "Wind down 2330–2400"], "Sunday: Sunday night's start");
      eq((await sleepCards(tab)).filter(c => c[2] === 6), [["Wind down", 0.5, 6, 23.5, ""]], "the wind-down's start, a card of its own");
      form = await mo.sleepRoutine(tab, {}, false);
      eq([form.bed, form.wake, form.wind, form.windTitle, form.nights, form.note], ["0030", "0730", 60, "Wind down", [0, 1, 2, 3, 6], "7h of sleep a night, 8h with the time before and after."], "read back");

      // What can't be a night: said in its status line, nothing saved.
      const refused = [
        [{ bed: "25" }, "Enter your bedtime, like 2230 or 22:30."],
        [{ bed: "0730" }, "Bedtime and wake up can't be the same time."],
        [{ bed: "2000", wake: "1800", wind: 240, rise: 240 }, "A night can't take more than 24 hours: this one takes 30h with the time before and after."],
        [{ bed: "1500", wake: "2300", wind: 0, rise: 120 }, "The morning routine can't run past midnight: wake up earlier or shorten it."],
        [{ bed: "2300", wake: "0700", rise: 0, wind: 30, windTitle: "sleep" }, "Give the wind-down a name of its own, e.g. Wind down."],
        [{ windTitle: "Wind down", nights: [] }, "Pick at least one night."]
      ];
      for (const [fields, why] of refused) {
        form = await mo.sleepRoutine(tab, fields);
        eq([form.open, form.status], [true, why], `refused: ${why}`);
      }
      eq(tab.dialogs.length, 0, "nothing asked");
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await mo.sleepForm(tab)).open], ["Discard your changes to the sleep routine?", false], "Esc asks first");
      eq((await sleepCards(tab)).length, 10, "the routine as it was");

      // 2300 to 0700 every night: Monday's Gym runs into its Sleep. Flagged red as any; the pop-up stays to say so.
      form = await mo.sleepRoutine(tab, { bed: "2300", wake: "0700", wind: 0, nights: ALL });
      eq(lastDialog(tab), "Replace the baseline's sleep cards?", "asked first");
      eq([form.open, form.status, form.cancel, form.remove], [true, "Saved. Cards running into them show in red: arrange them once. The “Sleep” cards you made yourself are still there: delete them if these take their place.", "Close", true], "saved, and said");
      eq((await sleepCards(tab)).length, 14, "replaced");
      days = await mo.days(tab);
      eq(days[0].cards.find(c => c.time === "2300–2400").label, "Sleep, 1h, pinned at 2300 — the cards above run 30m into it", "Monday's evening, run into");
      eq((await mo.bank(tab)).msg, "Monday's cards don't fit around its pinned times — move one into free time or trim it.", "the bank says so");
      eq(block(days[5]), ["Sleep 0000–0700", "Sleep 0700–1500", "Sleep 2300–2400"], "Saturday: yours after the morning's");
      await mo.closeSleep(tab);
      eq([(await mo.sleepForm(tab)).open, tab.dialogs.length], [false, 0], "Close: nothing to ask");

      // A copy (Ctrl+C, Ctrl+V) is yours: the routine never replaces it.
      const tue = days[1].cards.find(c => c.time === "2300–2400").id;
      await mo.shortcut(tab, "c", `#kMount #board .card[data-id="${tue}"]`);
      await mo.shortcut(tab, "v", '#kMount #board .col[data-day="2"] .col-body > .free');
      const marks = () => p.evaluate(() => Kyoshi.apps.momo.S.data.baseline.cards.filter(c => c.day === 2 && c.pin === 23).map(c => c.sleep));
      eq(await marks(), [true, false], "Wednesday: the routine's and your copy");

      // Through a backup: still marked, still read back.
      const backup = await exportBackup(tab);
      eq(backup.baseline.cards.filter(c => c.sleep === true).length, 14, "in the backup");
      await importBackup(tab, backup);
      eq([(await sleepCards(tab)).length, await marks()], [14, [true, false]], "imported");
      form = await mo.sleepRoutine(tab, {}, false);
      eq([form.bed, form.wake, form.wind, form.nights], ["2300", "0700", 0, ALL], "read back after it");

      // Remove: the routine's go; your copy and your own Sleep cards stay.
      await mo.removeSleep(tab);
      eq((await sleepCards(tab)).length, 0, "the routine's are gone");
      eq(await marks(), [false], "the copy stays");
      days = await mo.days(tab);
      eq([block(days[0]), block(days[5])], [["Work 0000–0800", "Gym 2230–2330"], ["Sleep 0000–0800"]], "your cards as they were");
    }
  },
  {
    name: "momo sleep: on a phone the pop-up fits, bedtime beside wake up and each minutes beside its title; a morning routine at the bottom of the morning's card",
    async run(t) {
      const tab = await open(t, { app: "momo", size: PHONE }), p = tab.page;
      await noSlots(tab);
      await mo.view(tab, "base");
      await mo.sleepRoutine(tab, {}, false);
      const box = id => p.locator(`#kMount #${id}`).boundingBox();
      const [bed, wake, rise, riseTitle] = [await box("sleepBed"), await box("sleepWake"), await box("sleepRise"), await box("sleepRiseTitle")];
      eq([bed.y === wake.y, rise.y === riseTitle.y], [true, true], "side by side");
      ok(wake.x + wake.width <= PHONE.width && riseTitle.x + riseTitle.width <= PHONE.width, "within the screen");
      // The − / + step the minutes by 15.
      await p.click('#kMount #sleepRise ~ [data-step="1"]');
      await p.click('#kMount #sleepRise ~ [data-step="1"]');
      await p.click('#kMount #sleepRise ~ [data-step="1"]');
      const form = await mo.sleepRoutine(tab, { bed: "2230", wake: "0630", nights: [4, 5] });
      eq(form.open, false, "saved");
      const days = await mo.days(tab);
      eq([block(days[4]), block(days[5]), block(days[6])], [["Sleep 2230–2400"], ["Sleep 0000–0630", "Morning routine 0630–0715", "Sleep 2230–2400"], ["Sleep 0000–0630", "Morning routine 0630–0715"]],
        "Friday and Saturday nights, the morning routine after waking");
      eq((await sleepCards(tab)).filter(c => c[2] === 6), [["Sleep", 6.5, 6, 0, "Morning routine 45m at the bottom"]], "inside the morning's card");
    }
  }
];
