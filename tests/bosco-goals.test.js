/* Kyoshi · tests/bosco-goals.test.js — Bosco's goals and deletes (Phase 3 of 2026-10-06_feedback_batch_plan.md): a goal
 * counts as reached once the 7-day average passes it, not a single weigh-in, dated the first day the average got there
 * (the chart then drops its line); the ETAs and the season projections start from the latest average, while the chart's
 * dots stay the weigh-ins; deleting a weigh-in, a day with a dose or a goal asks first, and No keeps it. The progress
 * image (Phase 3 of 2026-10-08_feedback_batch_plan.md) joins the weigh-ins with straight lines, a dot at each. A goal keeps
 * the number typed through a change of units and back (8.812), as does a weigh-in (8.813), and History's last page keeps
 * seven rows. */
"use strict";
const { TODAY, DESKTOP, eq, has, open, importBackup, exportBackup, lastDialog } = require("./lib");
const { M, D, weights: history, weighIn: weigh, editStartup, reload, saved } = require("./bosco");
const gen = require("./generate");

// The goals table's rows: [goal, status, ETA or date reached].
const goals = tab => tab.page.$$eval(`${M} #goalsBody tr`, rows => rows.map(r => [...r.cells].slice(0, 3).map(c => c.textContent.trim())));
// The chart: weigh-in dots and goal lines.
const chart = tab => tab.page.evaluate(m => [document.querySelectorAll(`${m} #chartSvg circle`).length, document.querySelectorAll(`${m} #chartSvg line.goal`).length], M);
const text = (tab, selector) => tab.page.locator(`${M} ${selector}`).first().innerText();
const historyDates = tab => tab.page.$$eval(`${M} #historyBody tr`, rows => rows.map(r => r.cells[0].textContent.trim()));
// The progress image, drawn: its width; its circles' radii in the order drawn, as runs [radius, how many] (null for one
// off the canvas's numbers); how many curves it drew; how many weigh-ins after the first a straight line ends at; and of
// the weigh-ins before the latest, how many are blue at their middle and halfway to the next, and how many have their
// white ring across the line beside them, toward the next (the latest's own ring, drawn over all, aside).
const image = tab => tab.page.evaluate(() => {
  const P = CanvasRenderingContext2D.prototype, kept = { arc: P.arc, lineTo: P.lineTo, quadraticCurveTo: P.quadraticCurveTo, bezierCurveTo: P.bezierCurveTo };
  const dots = [], centers = new Map(), ends = new Set();
  let curves = 0;
  P.arc = function (x, y, r, ...rest) {
    const radius = Number.isFinite(x) && Number.isFinite(y) ? r : null, run = dots[dots.length - 1];
    if (run && run[0] === radius) run[1]++;
    else dots.push([radius, 1]);
    centers.set(`${x},${y}`, { x, y });
    return kept.arc.call(this, x, y, r, ...rest);
  };
  P.lineTo = function (x, y) { ends.add(`${x},${y}`); return kept.lineTo.call(this, x, y); };
  P.quadraticCurveTo = function (...args) { curves++; return kept.quadraticCurveTo.apply(this, args); };
  P.bezierCurveTo = function (...args) { curves++; return kept.bezierCurveTo.apply(this, args); };
  try {
    const A = Kyoshi.apps.bosco, canvas = A.drawReport(A.model());
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data; // read once
    const pixel = (x, y) => { const at = (Math.floor(y) * canvas.width + Math.floor(x)) * 4; return [...data.slice(at, at + 4)]; }; // the one the point is in
    const isBlue = (x, y) => { const [r, , b] = pixel(x, y); return b > 200 && r < 90; };
    const isWhite = (x, y) => pixel(x, y).slice(0, 3).every(v => v > 200); // the ring's, not the line's blue
    const pts = [...centers.values()], earlier = pts.slice(0, -1), end = pts[pts.length - 1];
    const toward = (p, q, d) => { const len = Math.hypot(q.x - p.x, q.y - p.y); return [p.x + (q.x - p.x) * d / len, p.y + (q.y - p.y) * d / len]; };
    const besideRing = (p, q) => { const [x, y] = toward(p, q, 5); return Math.hypot(x - end.x, y - end.y) > 10 && isWhite(x, y); };
    return {
      width: canvas.width, dots, curves,
      joined: pts.slice(1).filter(p => ends.has(`${p.x},${p.y}`)).length,
      blue: earlier.filter((p, i) => isBlue(p.x, p.y) && isBlue((p.x + pts[i + 1].x) / 2, (p.y + pts[i + 1].y) / 2)).length,
      ringed: earlier.filter((p, i) => besideRing(p, pts[i + 1])).length
    };
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
      eq(await image(tab), { width: 1080, dots: [[5, 14], [3.5, 14], [7, 1]], curves: 0, joined: 14, blue: 14, ringed: 14 },
        "the progress image: straight lines from weigh-in to weigh-in, a dot at each in a white ring across the line, the latest bigger");
      has(await text(tab, "#goalsSection"), "A goal counts as reached once the 7-day average passes it.", "the note under the goals");

      // A week at 185, then a week at 175: the average passes 180 on the fourth day at 175, not the first.
      const week = Array.from({ length: 14 }, (_, i) => ({ date: D(i - 13), weight: i < 7 ? 185 : 175 }));
      await importBackup(tab, gen.bosco({ doses: 0, weights: week }));
      eq((await goals(tab)).map(r => r.slice(0, 2)), [["180.0 lb", "Reached"], ["170.0 lb", "In progress"]], "180 reached");
      eq((await goals(tab))[0][2], "Sep 27, 2026", "on the day the average crossed it");
      eq(await chart(tab), [14, 1], "its line gone, the dots all there");

      // Two hundred days of weigh-ins, closer together than a ring is wide, and a year of weekly ones changing little (too
      // short a line between two rings): the rings go under the line, so the dots and the line between them stay blue. A
      // single weigh-in: its dot alone.
      const daily = Array.from({ length: 200 }, (_, i) => ({ date: D(i - 199), weight: +(215 - 0.05 * i + (i % 2) * 0.4).toFixed(1) }));
      await importBackup(tab, gen.bosco({ doses: 0, weights: daily }));
      eq(await image(tab), { width: 1080, dots: [[5, 199], [3.5, 199], [7, 1]], curves: 0, joined: 199, blue: 199, ringed: 0 }, "the progress image of a long history");
      const weekly = Array.from({ length: 53 }, (_, i) => ({ date: D(7 * i - 364), weight: +(215 - 0.2 * i).toFixed(1) }));
      await importBackup(tab, gen.bosco({ doses: 0, weights: weekly }));
      eq(await image(tab), { width: 1080, dots: [[5, 52], [3.5, 52], [7, 1]], curves: 0, joined: 52, blue: 52, ringed: 0 }, "the progress image of a steady weekly history");
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: TODAY, weight: 181.4 }] }));
      eq(await image(tab), { width: 1080, dots: [[7, 1]], curves: 0, joined: 0, blue: 0, ringed: 0 }, "the progress image with one weigh-in");
    }
  },
  {
    name: "bosco goals: deleting a weigh-in, a day with a dose, or a goal asks first; No keeps it",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // History gives a day's year only when it isn't this year.
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-300), weight: 190 }, { date: TODAY, weight: 184 }] }));
      eq(await historyDates(tab), ["Sep 30", "Dec 4, 2025"], "this year's day without its year, last year's with it");
      await p.setViewportSize({ width: 360, height: 800 });
      eq(await p.evaluate(() => [...document.querySelectorAll("#historyBody td:first-child .nowrap")].map(s => s.getClientRects().length)), [1, 1],
        "on a phone, each date's month and day stay on one line (Sep 30, Dec 4,)");
      await p.setViewportSize(DESKTOP);
      const weights = Array.from({ length: 6 }, (_, i) => ({ date: D(i - 5), weight: +(186 - 0.4 * i).toFixed(1) }));
      await importBackup(tab, gen.bosco({ doses: 1, lastDose: D(-2), weights }));
      eq((await historyDates(tab)).length, 6, "six days");

      // A weigh-in: No keeps it, Yes deletes it.
      tab.answers.push(false);
      await p.click(`${M} #historyBody button[data-date="${TODAY}"]`);
      eq(lastDialog(tab), "Delete the weigh-in of 184.0 lb on Sep 30? This can't be undone.", "asked");
      eq((await historyDates(tab))[0], "Sep 30", "kept");
      await p.click(`${M} #historyBody button[data-date="${TODAY}"]`);
      eq((await historyDates(tab))[0], "Sep 29", "deleted");

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
  },
  {
    name: "bosco goals: a goal and a weigh-in keep the number typed when units change and back; History's last page keeps seven rows",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Ten weigh-ins: two pages, the last with three.
      const weights = Array.from({ length: 10 }, (_, i) => ({ date: D(i - 9), weight: +(190 - 0.5 * i).toFixed(1) }));
      await importBackup(tab, gen.bosco({ doses: 0, weights }));
      const rows = () => p.$$eval(`${M} #historyBody tr`, rs => rs.map(r => [r.classList.contains("blank"), Math.round(r.getBoundingClientRect().height)]));
      const pager = () => p.evaluate(m => Math.round(document.querySelector(`${m} #nextPageBtn`).getBoundingClientRect().top + scrollY), M);
      const top = await pager(), first = await rows();
      eq(first.length, 7, "seven on the first page");
      await p.click(`${M} #nextPageBtn`);
      const last = await rows();
      eq(last.map(r => r[0]), [false, false, false, true, true, true, true], "three weigh-ins, four blank rows");
      eq(new Set(last.map(r => r[1])).size, 1, "the blank rows as tall as the others");
      eq(await pager(), top, "the page buttons stay put");

      // 150 lb typed in lb, 68 kg typed in kg: each comes back as typed, the other unit converted.
      const units = async unit => {
        await editStartup(tab);
        await p.click(`${M} #oneTimeInput_unit button[data-value="${unit}"]`);
        await p.click(`${M} #oneTimeInfoSaveBtn`);
      };
      const addGoal = async v => { await p.fill(`${M} #goalInput`, String(v)); await p.click(`${M} #addGoalBtn`); };
      await addGoal(150); // with the backup's 180 and 170
      await units("kg");
      await addGoal(70);
      const shown = async () => (await goals(tab)).map(r => r[0]);
      eq(await shown(), ["81.6 kg", "77.1 kg", "70.0 kg", "68.0 kg"], "in kg: 150 lb converted, 70 kg as typed");
      await units("lb");
      eq(await shown(), ["180.0 lb", "170.0 lb", "154.3 lb", "150.0 lb"], "back in lb: 150 as typed (not 149.9), 70 kg converted");
      eq((await exportBackup(tab)).goalsAsEntered, [{ weight: 180, unit: "lb" }, { weight: 170, unit: "lb" }, { weight: 70, unit: "kg" }, { weight: 150, unit: "lb" }], "the backup says how each was typed");
      await units("kg");
      eq(await shown(), ["81.6 kg", "77.1 kg", "70.0 kg", "68.0 kg"], "and in kg again: 70 as typed");
      // Kept through a reload.
      await reload(tab);
      await units("lb");
      eq(await shown(), ["180.0 lb", "170.0 lb", "154.3 lb", "150.0 lb"], "after a reload");

      // Weigh-ins: 184 lb (once back as 184.1) typed in lb today, and 84 kg typed in kg: each as typed after kg and lb and back.
      await weigh(tab, TODAY, 184); // in place of the backup's 185.5
      eq((await history(tab))[0], "184.0 lb", "184 lb today");
      await units("kg");
      eq((await history(tab))[0], "83.5 kg", "in kg, converted");
      await weigh(tab, D(-12), 84);
      await units("lb");
      eq((await history(tab))[0], "184.0 lb", "back in lb: as typed (not 184.1)");
      const back = await exportBackup(tab), byDay = d => back.entries.find(e => e.date === d);
      eq([byDay(TODAY).weight, byDay(TODAY).typed], [184, undefined], "typed in this unit: nothing more kept");
      eq([byDay(D(-12)).weight, byDay(D(-12)).typed], [185.2, { weight: 84, unit: "kg" }], "the one typed in kg says so");
      eq(back.entries.filter(e => e.typed).length, 1, "only it");
      eq(back.entries.map(e => e.weight), [185.2].concat(weights.slice(0, -1).map(w => w.weight), 184), "every weigh-in as it was typed in lb");
      await units("kg");
      await units("lb");
      eq((await saved(tab)).entries.map(e => e.weight), back.entries.map(e => e.weight), "the same after kg and lb again");
      await units("kg");
      const kg = await saved(tab);
      eq([kg.entries[0].weight, kg.entries[0].typed], [84, undefined], "in kg: 84 as typed");
      eq(kg.entries.filter(e => e.typed).length, kg.entries.length - 1, "the others typed in lb");
    }
  }
];
