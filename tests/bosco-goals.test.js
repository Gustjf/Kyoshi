/* Kyoshi · tests/bosco-goals.test.js — Bosco's goals and deletes (Phase 3 of 2026-10-06_feedback_batch_plan.md): a goal
 * counts as reached once the 7-day average passes it, not a single weigh-in, dated the first day the average got there
 * (the chart then drops its line); the ETAs and the season projections start from the latest average, while the chart's
 * dots stay the weigh-ins; deleting a weigh-in, a day with a dose or a goal asks first, and No keeps it. The progress
 * image (Phase 3 of 2026-10-08_feedback_batch_plan.md) joins the weigh-ins with straight lines, a dot at each. */
"use strict";
const { TODAY, DESKTOP, eq, has, open, importBackup, lastDialog, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
// The goals table's rows: [goal, status, ETA or date reached].
const goals = tab => tab.page.$$eval(`${M} #goalsBody tr`, rows => rows.map(r => [...r.cells].slice(0, 3).map(c => c.textContent.trim())));
// The chart: weigh-in dots and goal lines.
const chart = tab => tab.page.evaluate(m => [document.querySelectorAll(`${m} #chartSvg circle`).length, document.querySelectorAll(`${m} #chartSvg line.goal`).length], M);
const text = (tab, selector) => tab.page.locator(`${M} ${selector}`).first().innerText();
const historyDates = tab => tab.page.$$eval(`${M} #historyBody tr`, rows => rows.map(r => r.cells[0].textContent.trim()));
// The progress image, drawn: its width, its dots' radii in the order drawn (null for one off the canvas's numbers), and
// how many curves it drew.
const image = tab => tab.page.evaluate(() => {
  const P = CanvasRenderingContext2D.prototype, kept = { arc: P.arc, quadraticCurveTo: P.quadraticCurveTo, bezierCurveTo: P.bezierCurveTo }, dots = [];
  let curves = 0;
  P.arc = function (x, y, r, ...rest) { dots.push(Number.isFinite(x) && Number.isFinite(y) ? r : null); return kept.arc.call(this, x, y, r, ...rest); };
  P.quadraticCurveTo = function (...args) { curves++; return kept.quadraticCurveTo.apply(this, args); };
  P.bezierCurveTo = function (...args) { curves++; return kept.bezierCurveTo.apply(this, args); };
  try {
    const A = Kyoshi.apps.bosco;
    return { width: A.drawReport(A.model()).width, dots, curves };
  } finally { Object.assign(P, kept); }
});

module.exports = [
  {
    name: "bosco goals: a goal is reached once the 7-day average passes it, not one day's weigh-in; ETAs and projections start from the average",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Two weeks losing 0.6 lb a day from 190, then today one weigh-in under the 180 goal: the average isn't.
      const dip = Array.from({ length: 14 }, (_, i) => ({ date: D(i - 14), weight: +(190 - 0.6 * i).toFixed(1) })).concat({ date: TODAY, weight: 179 });
      await importBackup(tab, gen.bosco({ doses: 0, weights: dip }));
      eq(await text(tab, "#statAvg"), "183.0 lb", "the 7-day average");
      const rate = await p.evaluate(() => Kyoshi.apps.bosco.model().rate), weeks = Math.log(180 / 183) / Math.log1p(-rate);
      const rows = await goals(tab);
      eq(rows.map(r => r.slice(0, 2)), [["180.0 lb", "In progress"], ["170.0 lb", "In progress"]], "neither reached");
      has(rows[0][2], `${weeks.toFixed(1)} wks`, "180's ETA counted from the average");
      eq(await text(tab, "#futureWeightGrid .stat .val"), `${(183 * Math.pow(1 - rate, 4)).toFixed(1)} lb`, "a month out, from the average");
      eq(await chart(tab), [15, 2], "every weigh-in's dot, both goals' lines");
      eq(await image(tab), { width: 1080, dots: Array(14).fill(5).concat(7), curves: 0 }, "the progress image: straight lines, a dot at each weigh-in, the latest bigger");
      has(await text(tab, "#goalsSection"), "A goal counts as reached once the 7-day average passes it.", "the note under the goals");

      // A week at 185, then a week at 175: the average passes 180 on the fourth day at 175, not the first.
      const week = Array.from({ length: 14 }, (_, i) => ({ date: D(i - 13), weight: i < 7 ? 185 : 175 }));
      await importBackup(tab, gen.bosco({ doses: 0, weights: week }));
      eq((await goals(tab)).map(r => r.slice(0, 2)), [["180.0 lb", "Reached"], ["170.0 lb", "In progress"]], "180 reached");
      eq((await goals(tab))[0][2], "Sep 27, 2026", "on the day the average crossed it");
      eq(await chart(tab), [14, 1], "its line gone, the dots all there");

      // A single weigh-in: the image has its one dot, and no line to draw.
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: TODAY, weight: 181.4 }] }));
      eq(await image(tab), { width: 1080, dots: [7], curves: 0 }, "the progress image with one weigh-in");
    }
  },
  {
    name: "bosco goals: deleting a weigh-in, a day with a dose, or a goal asks first; No keeps it",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      const weights = Array.from({ length: 6 }, (_, i) => ({ date: D(i - 5), weight: +(186 - 0.4 * i).toFixed(1) }));
      await importBackup(tab, gen.bosco({ doses: 1, lastDose: D(-2), weights }));
      eq((await historyDates(tab)).length, 6, "six days");

      // A weigh-in: No keeps it, Yes deletes it.
      tab.answers.push(false);
      await p.click(`${M} #historyBody button[data-date="${TODAY}"]`);
      eq(lastDialog(tab), "Delete the weigh-in of 184.0 lb on Sep 30? This can't be undone.", "asked");
      eq((await historyDates(tab))[0], "Sep 30, 2026", "kept");
      await p.click(`${M} #historyBody button[data-date="${TODAY}"]`);
      eq((await historyDates(tab))[0], "Sep 29, 2026", "deleted");

      // A day with a dose says the dose, and the weigh-in with it.
      tab.answers.push(false);
      await p.click(`${M} #historyBody button[data-date="${D(-2)}"]`);
      eq(lastDialog(tab), "Delete the 5 mg Tirzepatide dose logged Sep 28, 2026, and that day's weigh-in? This can't be undone.", "the dose's question");
      eq((await historyDates(tab)).length, 5, "kept");

      // A goal: No keeps it, Yes removes it.
      tab.answers.push(false);
      await p.click(`${M} #goalsBody button[data-goal="170"]`);
      eq(lastDialog(tab), "Remove the 170.0 lb goal? This can't be undone.", "asked");
      eq((await goals(tab)).map(r => r[0]), ["180.0 lb", "170.0 lb"], "kept");
      await p.click(`${M} #goalsBody button[data-goal="170"]`);
      eq((await goals(tab)).map(r => r[0]), ["180.0 lb"], "removed");
    }
  }
];
