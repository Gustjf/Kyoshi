/* Kyoshi · tests/bosco-entries.test.js — Bosco's weigh-ins and what's worked out from them: Add Entry checked as typed
 * (a date, a weight, positive, not a day ahead), Enter adds, replacing a weigh-in asks (No keeps it), the Date field
 * moves to the new day at midnight unless picked; Current Trend's weekly rate against the weekly pace goal (on pace,
 * slightly or too slow, the wrong way), its windows (n/a without enough weigh-ins), the rolling average's window; the
 * goals' rate (Current Trend's or a custom one: the projections, a flat rate, moving away); the pace goal in start-up
 * info, checked as typed; the first open carrying over what the standalone Bosco left in the browser (left as it was);
 * and another tab's change shown here at once (a dose logged there closes this tab's pop-up). */
"use strict";
const { TODAY, DESKTOP, eq, open, lastDialog, importBackup } = require("./lib");
const { M, D, history, weights, weighIn, dosePopup, startupShown, saveStartup, editStartup, bugLine, saved } = require("./bosco");
const gen = require("./generate");

// Current Trend and the goals' projections, as shown.
const trend = tab => tab.page.evaluate(m => {
  const $ = id => document.querySelector(`${m} #${id}`);
  return {
    rate: $("statRate").innerText, cls: $("statRate").className, note: $("statRateNote").textContent, pace: $("statPace").innerText,
    avg: `${$("statAvg").textContent} (${$("statAvgLabel").textContent})`
  };
}, M);
const projections = tab => tab.page.evaluate(m => ({
  note: document.querySelector(`${m} #goalsRateNote`).textContent,
  month: document.querySelector(`${m} #futureWeightGrid .stat .val`).textContent,
  goals: [...document.querySelectorAll(`${m} #goalsBody tr`)].map(r => [...r.cells].slice(0, 3).map(c => c.textContent.trim()).join(" | "))
}), M);
const pill = (tab, wrap, attr, value) => tab.page.click(`${M} #${wrap} [${attr}="${value}"]`);
// The custom rate's slider set to a value, as dragging it does.
const slide = (tab, value) => tab.page.$eval(`${M} #customRate`, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, String(value));
// Start-up info's pace goal: the direction, the target and range typed; the note under it.
async function pace(tab, { dir, pct, range }) {
  if (dir) await pill(tab, "paceDirToggle", "data-pace-dir", dir);
  if (pct !== undefined) await tab.page.fill(`${M} #pacePctInput`, String(pct));
  if (range !== undefined) await tab.page.fill(`${M} #paceRangeInput`, String(range));
  return tab.page.locator(`${M} #paceNote`).evaluate(n => (n.hidden ? "" : n.textContent));
}

module.exports = [
  {
    name: "bosco entries: Add Entry checked as typed; Enter adds; replacing a weigh-in asks; the Date field follows midnight unless picked",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      eq(await p.inputValue(`${M} #dateInput`), TODAY, "the Date field on today");
      // Each refusal says why, and adds nothing.
      await weighIn(tab, TODAY, "");
      eq(lastDialog(tab), "Enter a weight.", "no weight");
      await weighIn(tab, TODAY, -190);
      eq(lastDialog(tab), "Please enter a valid positive weight.", "a negative one");
      await weighIn(tab, D(1), 190);
      eq(lastDialog(tab), "Weigh-ins can't be dated in the future.", "tomorrow");
      await weighIn(tab, "", 190);
      eq(lastDialog(tab), "Please enter a date.", "no date");
      eq(await weights(tab), [], "nothing added");

      // Enter in the weight field adds it, and empties the field.
      await weighIn(tab, TODAY, 190, { enter: true });
      eq([await weights(tab), await p.inputValue(`${M} #weightInput`)], [["190.0 lb"], ""], "added with Enter");
      // Another weight on the same day asks; No keeps the first. The same weight again asks nothing.
      tab.answers.push(false);
      await weighIn(tab, TODAY, 189.4);
      eq(lastDialog(tab), "Sep 30, 2026 already has a weigh-in of 190.0 lb. Replace it with 189.4 lb?", "asked");
      eq(await weights(tab), ["190.0 lb"], "No: kept");
      await weighIn(tab, TODAY, 189.4);
      eq([lastDialog(tab), await weights(tab)], ["Sep 30, 2026 already has a weigh-in of 190.0 lb. Replace it with 189.4 lb?", ["189.4 lb"]], "Yes: replaced");
      await weighIn(tab, TODAY, 189.4);
      eq(tab.dialogs.length, 0, "the same weight: nothing asked");
      // Enter in the goal field adds a goal, among the defaults a new device starts with.
      await p.fill(`${M} #goalInput`, "172.5");
      await p.press(`${M} #goalInput`, "Enter");
      eq((await saved(tab)).goals, [200, 175, 172.5, 160, 150], "a goal with Enter, in order");

      // Left open past midnight: the Date field moves to the new day; a day picked by hand stays.
      await tab.ctx.clock.fastForward(17 * 3600000 + 60000); // 00:01
      eq(await p.inputValue(`${M} #dateInput`), D(1), "tomorrow's date");
      await p.fill(`${M} #dateInput`, D(-3));
      await tab.ctx.clock.fastForward(24 * 3600000);
      eq(await p.inputValue(`${M} #dateInput`), D(-3), "a day picked stays");
    }
  },
  {
    name: "bosco entries: Current Trend against the pace goal, its windows; the rolling average; the goals' custom rate; the pace goal checked as typed",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // A week at 200 lb, then a week at 198: 1% a week, the default goal's middle (lose 1% ± 0.25%).
      const days = Array.from({ length: 14 }, (_, i) => ({ date: D(i - 13), weight: i < 7 ? 200 : 198 }));
      await importBackup(tab, gen.bosco({ doses: 0, weights: days }));
      await saveStartup(tab); // the name, so start-up info is out of the way
      eq(await trend(tab), { rate: "-1.00%/wk|-2.0 lb/wk", cls: "val good", note: "200.0 → 198.0 lb over 7 days", pace: "On pace|Goal: lose 1% ± 0.25% per week",
        avg: "198.0 lb (7-day rolling avg)" }, "on pace");
      eq(await projections(tab), { note: "Using the 7d weekly rate from Current Trend (set above).", month: "190.2 lb", goals: ["180.0 lb | In progress | 9.5 wks (Dec 5, 2026)", "170.0 lb | In progress | 15.2 wks (Jan 14, 2027)"] },
        "the goals at that rate");

      // The rolling average over 14 days; the trend over 14 days has no week before it to compare.
      await pill(tab, "avgWindowWrap", "data-avg-window", "14");
      eq((await trend(tab)).avg, "199.0 lb (14-day rolling avg)", "14 days averaged");
      await pill(tab, "trendWindowWrap", "data-window", "14");
      let tr = await trend(tab);
      eq([tr.rate, tr.note, tr.pace], ["n/a", "Needs 3+ weigh-ins in each week compared", "Goal: lose 1% ± 0.25% per week"], "n/a over 14 days");
      let pr = await projections(tab);
      eq([pr.note, pr.goals], ["Current Trend has no 14d weekly rate yet, so there's nothing to project from.", ["180.0 lb | Flat rate | Requires active rate", "170.0 lb | Flat rate | Requires active rate"]], "nothing to project from");
      await pill(tab, "trendWindowWrap", "data-window", "7");

      // A custom rate: losing 1% a week is Current Trend's; none is flat; gaining moves away from the goals.
      await pill(tab, "rateModeToggle", "data-rate-mode", "custom");
      eq(await p.isVisible(`${M} #customRateWrap`), true, "the slider shows");
      await slide(tab, -1);
      pr = await projections(tab);
      eq([await p.textContent(`${M} #customRateValue`), pr.note, pr.month], ["-1%", "Using the custom weekly rate above.", "190.2 lb"], "-1% a week");
      await slide(tab, 0);
      eq((await projections(tab)).goals[0], "180.0 lb | Flat rate | Requires active rate", "flat");
      await slide(tab, 1);
      eq((await projections(tab)).goals[0], "180.0 lb | Wrong direction | Moving away", "gaining");
      await pill(tab, "rateModeToggle", "data-rate-mode", "trend");
      eq([await p.isVisible(`${M} #customRateWrap`), (await projections(tab)).month], [false, "190.2 lb"], "back to Current Trend's");

      // The pace goal in start-up info: its note as typed; checked on Save (a target up to 3%, a range under it).
      await editStartup(tab);
      eq(await pace(tab, {}), "Green: losing 0.75–1.25% a week, about 1.5–2.5 lb at 198.0 lb. Yellow: 0.5–1.5%.", "the default's note");
      eq(await pace(tab, { pct: 4 }), "", "no note for 4%");
      await saveStartup(tab);
      eq(lastDialog(tab), "Please enter a weekly target above 0 and up to 3%, and an on-pace range of 0 or more that's smaller than the target.", "4% refused");
      await pace(tab, { pct: 1.5, range: 1.5 });
      await saveStartup(tab);
      eq(lastDialog(tab), "Please enter a weekly target above 0 and up to 3%, and an on-pace range of 0 or more that's smaller than the target.", "a range as big as the target refused");
      eq(await pace(tab, { range: 0.25 }), "Green: losing 1.25–1.75% a week, about 2.5–3.5 lb at 198.0 lb. Yellow: 1–2%.", "1.5% ± 0.25%");
      await saveStartup(tab);
      eq((await startupShown(tab))[0], false, "saved");
      tr = await trend(tab);
      eq([tr.cls, tr.pace], ["val warn", "Slightly slow|Goal: lose 1.5% ± 0.25% per week"], "slightly slow");
      eq(await bugLine(tab, "- Pace goal"), "- Pace goal: lose 1.5% ± 0.25% a week", "the bug line");
      await editStartup(tab);
      await pace(tab, { pct: 2 });
      await saveStartup(tab);
      eq((await trend(tab)).pace, "Too slow|Goal: lose 2% ± 0.25% per week", "too slow");
      await editStartup(tab);
      eq(await pace(tab, { dir: "gain", pct: 1 }), "Green: gaining 0.75–1.25% a week, about 1.5–2.5 lb at 198.0 lb. Yellow: 0.5–1.5%.", "gaining");
      await saveStartup(tab);
      tr = await trend(tab);
      eq([tr.cls, tr.pace], ["val bad", "Wrong direction|Goal: gain 1% ± 0.25% per week"], "the wrong way");
      eq((await saved(tab)).paceGoal, { dir: "gain", weeklyPct: 1, rangePct: 0.25 }, "kept with the data");
    }
  },
  {
    name: "bosco entries: the first open carries over the standalone Bosco's data, leaving it as it was; another tab's change shows at once",
    async run(t) {
      // What the standalone Bosco left in this browser: an older profile ("Do you take Tirzepatide?" answered), a weigh-in
      // and a dose (schema 3: no medication on it), a goal.
      const left = {
        weightTrackerEntries_v1: JSON.stringify([{ date: "2026-09-23", weight: 201.2, doseMg: 5 }, { date: "2026-09-29", weight: 199.8, doseMg: null }]),
        weightTrackerGoals_v1: JSON.stringify([185]),
        weightTrackerProfile_v1: JSON.stringify({ name: "Sam", unit: "lb", usesTirzepatide: true, usesTirzepatideAsked: true, dosingAsked: 4, paceGoal: { dir: "lose", weeklyPct: 1, rangePct: 0.25 },
          dosePlan: { medication: "tirzepatide", intervalDays: 7, weeklyMg: 5, doseTime: null, nextDose: null, savedAt: "2026-01-05T00:00:00.000Z" } })
      };
      const init = keys => { for (const k in keys) if (localStorage.getItem(k) === null) localStorage.setItem(k, keys[k]); };
      const tab = await open(t, { app: "bosco", size: DESKTOP, init: `(${init})(${JSON.stringify(left)})` }), p = tab.page;
      eq(await history(tab), [["Sep 29", "—"], ["Sep 23", "5 mg"]], "the days");
      eq((await saved(tab)).goals, [185], "the goal");
      eq([await p.textContent("#kAppSubtitle"), await bugLine(tab, "- GLP-1"), await startupShown(tab)], ["Sam's health tracker", "- GLP-1 medication: tirzepatide", [false, false]],
        "its answers: nothing asked");
      eq(await p.evaluate(keys => keys.map(k => localStorage.getItem(k)), Object.keys(left)), Object.values(left), "the standalone's data left as it was");
      eq((await dosePopup(tab)).open, true, "Sep 30's dose due");

      // A second tab of the same browser: the same data (not carried over again). The dose logged there closes the pop-up
      // here, and a weigh-in there shows here.
      const other = await open(t, { app: "bosco", size: DESKTOP, ctx: tab.ctx });
      eq([await history(other), (await dosePopup(other)).open], [await history(tab), true], "the same days, the same dose due");
      await other.page.click(`${M} #doseLogBtn`);
      await p.waitForFunction(m => !document.querySelector(`${m} #doseOverlay`).classList.contains("open"), M);
      await weighIn(other, TODAY, 199.1);
      await p.waitForFunction(m => document.querySelector(`${m} #historyBody tr td:nth-child(2)`).textContent === "199.1 lb", M);
      eq(await history(tab), [["Sep 30", "5 mg|Abd L upper"], ["Sep 29", "—"], ["Sep 23", "5 mg"]], "this tab shows both");
    }
  }
];
