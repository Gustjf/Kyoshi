/* Kyoshi · tests/bosco-retinoids.test.js — Bosco's retinoids (roadmap/archive/2026-10-11_bosco_retinoids_plan.md):
 * start-up info's Retinoids block (Add retinoid: Tazarotene, its lowest strength, 9 PM, today and the default build-up,
 * the steps' live note; Edit, Remove with its question); the "Upcoming <X> Doses" section (one retinoid's name, or
 * Retinoid for several), each retinoid's head (last applied, where it stands in its build-up) and its next three
 * applications by step; the pop-up once one is due (Applied, Applied it <day> / today for a late one, Not yet for an hour,
 * Postpone to tomorrow, Skip to the next one on the schedule), one at a time; the build-up over time (a new step's first application one old interval after
 * the last), missed ones dropped; the bug report's counts; Export, Import (an older backup keeps yours, a damaged one is
 * cleaned, the backup's records win where both have them) and sync's combine (a marker removes, an older copy's save
 * changes nothing, a newer one's regimen comes in); on a phone. Phase 2: Hold this step a week, Undo, Developer Mode's
 * lines and its Skip this application, and nothing in Momo's agenda. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, has, lacks, open, devPanel, lastDialog, importBackup, exportBackup, addDays, at } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
const BUILD_UP = [{ every: 3, weeks: 2 }, { every: 2, weeks: 2 }, { every: 1, weeks: null }];

// The Upcoming section: its title, and each group's [head, progress, cards: [weekday, date line, step, due]] (the head's
// buttons left out: buttons() has them).
const section = tab => tab.page.evaluate(m => {
  const s = document.querySelector(`${m} #upcomingRetinoidsSection`);
  const text = el => [...el.childNodes].filter(n => n.nodeName !== "BUTTON").map(n => n.textContent).join("").trim();
  return {
    shown: !s.hidden, title: s.querySelector("h2").textContent,
    groups: [...s.querySelectorAll(".retinoid-group")].map(g => [text(g.querySelector(".retinoid-head > span")), g.querySelector(".retinoid-progress").textContent,
      [...g.querySelectorAll(".stat")].map(c => [c.querySelector(".val").textContent, c.querySelector(".lbl").textContent, c.querySelector(".dose").textContent, c.classList.contains("due")])])
  };
}, M);
const cards = (s, i = 0) => s.groups[i][2].map(c => c[1].split(" · ")[0]);
// Each group's head buttons (Undo, Hold this step a week).
const buttons = tab => tab.page.evaluate(m => [...document.querySelectorAll(`${m} .retinoid-head`)].map(h => [...h.querySelectorAll("button")].map(b => b.textContent)), M);
// The pop-up: open, title, text, the step, and the buttons shown.
const popup = tab => tab.page.evaluate(m => {
  const o = document.querySelector(`${m} #retinoidOverlay`), t = id => o.querySelector(id).textContent;
  return { open: o.classList.contains("open"), title: t("#retinoidModalTitle"), text: t("#retinoidModalText"), step: t("#retinoidModalStep"),
    buttons: [...o.querySelectorAll(".modal-actions button")].filter(b => !b.hidden).map(b => b.textContent) };
}, M);
// Start-up info's block: shown, its list lines, the none line, and the editor (null when closed).
const editor = tab => tab.page.evaluate(m => {
  const $ = id => document.querySelector(`${m} #${id}`), ed = $("retinoidEditor");
  return {
    shown: !$("retinoidBox").hidden, list: [...$("retinoidList").querySelectorAll(".summary-line > span:first-child")].map(s => s.textContent.trim()),
    none: !$("retinoidNone").hidden,
    editor: ed.hidden ? null : {
      kind: ($("retinoidKind").querySelector(".active") || { textContent: "" }).textContent, strengths: [...$("retinoidStrength").options].map(o => o.textContent),
      strength: $("retinoidStrength").selectedOptions[0].textContent, where: $("retinoidWhere").value, time: $("retinoidTime").value, start: $("retinoidStart").value,
      rows: [...$("retinoidSteps").querySelectorAll(".step-row")].map(r => [...r.children].map(c => (c.tagName === "INPUT" ? `[${c.value}]` : c.textContent)).join(" ")),
      note: $("retinoidStepsNote").textContent
    }
  };
}, M);
async function saveStartup(tab) {
  const name = tab.page.locator(`${M} #oneTimeInput_name`);
  if (await name.count()) await name.fill("Sam");
  await tab.page.click(`${M} #oneTimeInfoSaveBtn`);
}
const bugLine = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.bugState().find(l => l.startsWith("- Retinoids")));
const travel = (tab, days) => tab.page.evaluate(n => Kyoshi.dev.travel(n), days);
const until = (tab, hm) => tab.ctx.clock.fastForward(at(TODAY, hm) - at(TODAY, "07:00")); // from 07:00 on any day
// Tazarotene 0.1% on the face from start, the default build-up, applied on the days given (made-up data).
const taz = (start, days = [], extra = {}) => ({
  regimens: [{ id: "taz1", retinoid: "tazarotene", pct: 0.1, where: "face", time: "21:00", start, steps: BUILD_UP, next: null, at: 1, u: 1, ...extra }],
  log: days.map(d => ({ id: `taz1:${d}`, r: "taz1", date: d, u: 1 }))
});

module.exports = [
  {
    name: "bosco retinoids: set up in start-up info, due, logged; two retinoids and the title; removed; Export",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      let ed = await editor(tab), s = await section(tab);
      eq([ed.shown, ed.list, ed.none, ed.editor, s.shown], [true, [], true, null, false], "start-up info's block, no retinoid yet, no section");
      eq(await bugLine(tab), "- Retinoids: 0; applications logged: 0; due now: 0", "the bug line with none");

      await p.click(`${M} #addRetinoidBtn`);
      eq(await p.evaluate(m => [...document.querySelectorAll(`${m} #retinoidKind button`)].map(b => b.textContent), M), ["Tretinoin", "Tazarotene", "Trifarotene"], "the retinoids to pick (no Adapalene)");
      ed = await editor(tab);
      eq(ed.editor, { kind: "Tazarotene", strengths: ["0.05%", "0.1%"], strength: "0.05%", where: "", time: "21:00", start: TODAY,
        rows: ["every [3] days for [2] weeks ✕", "every [2] days for [2] weeks ✕", "then every [1] days from then on"],
        note: "Step 1: every 3 days, Sep 30 – Oct 13 · Step 2: every other day, Oct 14 – Oct 27 · then every day from Oct 28" }, "the editor, prefilled");
      await p.selectOption(`${M} #retinoidStrength`, "0.1");
      await p.fill(`${M} #retinoidWhere`, "face");
      await p.click(`${M} #saveRetinoidBtn`);
      ed = await editor(tab);
      eq([ed.list, ed.none, ed.editor], [["Tazarotene 0.1% · face every 3 days for 2 weeks, every other day for 2 weeks, then every day · from Sep 30"], false, null], "the list");
      s = await section(tab);
      eq([s.shown, s.title], [true, "Upcoming Tazarotene Doses"], "the section");
      const step1 = "Step 1 of 3 · every 3 days";
      eq(s.groups, [["Tazarotene 0.1% · face", "Step 1 of 3 · every 3 days · week 1 of 2 · every other day from Wednesday, Oct 14",
        [["Wednesday", "Sep 30 · 9:00 PM", step1, false], ["Saturday", "Oct 3 · 9:00 PM", step1, false], ["Tuesday", "Oct 6 · 9:00 PM", step1, false]]]], "its group");
      eq((await popup(tab)).open, false, "nothing due yet");

      // 9:01 PM: due, the pop-up asks.
      await until(tab, "21:01");
      let pop = await popup(tab);
      eq(pop, { open: true, title: "Did you apply your Tazarotene?", text: "Tazarotene 0.1% on your face was due Wednesday, Sep 30 at 9:00 PM. It goes in your log once you confirm it.",
        step: step1, buttons: ["Applied", "Not yet", "Postpone to tomorrow", "Skip to Saturday"] }, "the pop-up");
      eq((await section(tab)).groups[0][2][0][3], true, "its card due");
      eq(await p.evaluate(() => Kyoshi.apps.bosco.attention()), "a retinoid is waiting to be confirmed", "the switcher's dot");
      await p.click(`${M} #retinoidLogBtn`);
      s = await section(tab);
      eq([(await popup(tab)).open, s.groups[0][0], cards(s)], [false, "Tazarotene 0.1% · face · last applied Wednesday, Sep 30", ["Oct 3", "Oct 6", "Oct 9"]], "logged");
      eq(await bugLine(tab), "- Retinoids: 1 (steps 3); applications logged: 1; due now: 0", "the bug line");
      eq(await buttons(tab), [["Undo", "Hold this step a week"]], "Undo after today's, Hold during step 1");

      // A second (start-up info still open: the name isn't answered): Tretinoin 0.05% on the body, every other day.
      await p.click(`${M} #addRetinoidBtn`);
      await p.click(`${M} #retinoidKind button[data-value="tretinoin"]`);
      eq((await editor(tab)).editor.strengths, ["0.025%", "0.05%", "0.1%"], "Tretinoin's strengths");
      await p.selectOption(`${M} #retinoidStrength`, "0.05");
      await p.fill(`${M} #retinoidWhere`, "body");
      await p.click(`${M} #retinoidSteps button[data-remove-step="0"]`);
      await p.click(`${M} #retinoidSteps button[data-remove-step="0"]`);
      await p.fill(`${M} #retinoidSteps .step-every`, "2");
      ed = await editor(tab);
      eq([ed.editor.rows, ed.editor.note], [["every [2] days"], "Every other day from Sep 30"], "one step");
      await p.click(`${M} #saveRetinoidBtn`);
      // Its first application is due already (9 PM passed): its pop-up, put off.
      pop = await popup(tab);
      eq([pop.open, pop.title, pop.step], [true, "Did you apply your Tretinoin?", "Every other day"], "Tretinoin's pop-up");
      await p.click(`${M} #retinoidSnoozeBtn`);
      s = await section(tab);
      eq(s.title, "Upcoming Retinoid Doses", "both: Retinoid");
      eq([s.groups.length, s.groups[1][0], s.groups[1][1], s.groups[1][2].map(c => [c[1], c[2]])], [2, "Tretinoin 0.05% · body", "Every other day",
        [["Sep 30 · 9:00 PM", "Every other day"], ["Oct 2 · 9:00 PM", "Every other day"], ["Oct 4 · 9:00 PM", "Every other day"]]], "Tretinoin's group");

      // Tazarotene removed, after asking.
      await p.click(`${M} #retinoidList button[data-remove-regimen]`);
      eq(lastDialog(tab), "Remove Tazarotene 0.1% · face? Its past applications stay in your data.", "asked");
      s = await section(tab);
      eq([s.title, s.groups.length, (await editor(tab)).list.length], ["Upcoming Tretinoin Doses", 1, 1], "Tretinoin alone");
      eq(await buttons(tab), [[]], "a steady schedule, nothing applied today: no Hold, no Undo");

      const backup = await exportBackup(tab);
      const [a, b] = backup.retinoids.regimens;
      eq([backup.schemaVersion, a.retinoid, a.x, a.steps, b.retinoid, b.x, b.steps, b.where], [4, "tazarotene", true, BUILD_UP, "tretinoin", undefined, [{ every: 2, weeks: null }], "body"], "Export's regimens");
      eq(backup.retinoids.log.map(l => [l.id, l.r, l.date]), [[`${a.id}:${TODAY}`, a.id, TODAY]], "Export's log");
    }
  },
  {
    name: "bosco retinoids: the build-up over time; late, Not yet, today, missed, Postpone",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Started Sep 18 (step 1 runs to Oct 1), applied every 3 days since; a weigh-in, no dose to count from.
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }], retinoids: taz(D(-12), [D(-12), D(-9), D(-6), D(-3)]) }));
      let s = await section(tab);
      eq([s.groups[0][0], s.groups[0][1]], ["Tazarotene 0.1% · face · last applied Sunday, Sep 27", "Step 1 of 3 · every 3 days · week 2 of 2 · every other day from Friday, Oct 2"], "the head");
      eq(s.groups[0][2].map(c => [c[1], c[2], c[3]]), [["Sep 30 · 9:00 PM", "Step 1 of 3 · every 3 days", false], ["Oct 3 · 9:00 PM", "Step 2 of 3 · every other day", false],
        ["Oct 5 · 9:00 PM", "Step 2 of 3 · every other day", false]], "today's, then step 2's");

      // The next morning: late. Not yet puts it off an hour.
      await travel(tab, 1);
      let pop = await popup(tab);
      eq([pop.open, pop.buttons], [true, ["Applied it Wednesday", "Applied it today", "Not yet", "Postpone to tomorrow", "Skip to Saturday"]], "late");
      await p.click(`${M} #retinoidSnoozeBtn`);
      eq((await popup(tab)).open, false, "put off");
      await tab.ctx.clock.fastForward(61 * 60000);
      eq((await popup(tab)).open, true, "asked again an hour later");
      await p.click(`${M} #retinoidLogBtn`);
      s = await section(tab);
      eq([s.groups[0][0], cards(s)], ["Tazarotene 0.1% · face · last applied Wednesday, Sep 30", ["Oct 3", "Oct 5", "Oct 7"]], "logged on its day");

      // Day by day to step 3's first day (Oct 16), applying each at the pop-up as it comes.
      const steps = [];
      for (let i = 0; i < 15; i++) {
        await travel(tab, 1);
        pop = await popup(tab);
        if (pop.open) { steps.push(pop.step); await p.click(`${M} #retinoidLogBtn`); }
      }
      eq(steps, Array(7).fill("Step 2 of 3 · every other day"), "seven of step 2 (Oct 3 – Oct 15)");
      s = await section(tab);
      eq([s.groups[0][1], cards(s), s.groups[0][2][0][2]], ["Step 3 of 3 · every day from Oct 16 on", ["Oct 17", "Oct 18", "Oct 19"], "Step 3 of 3 · every day"],
        "step 3: its first one interval of step 2 after the last");

      // Ten days without: the last three kept (the earlier ones missed); Applied it today, then on from tomorrow.
      await travel(tab, 10);
      s = await section(tab);
      eq(s.groups[0][2].map(c => [c[1].split(" · ")[0], c[3]]), [["Oct 24", true], ["Oct 25", true], ["Oct 26", false]], "missed ones dropped");
      eq(await bugLine(tab), "- Retinoids: 1 (steps 3); applications logged: 12; due now: 2", "the bug line");
      eq((await popup(tab)).buttons[0], "Applied it Saturday", "the earliest due one");
      await p.click(`${M} #retinoidTodayBtn`);
      eq(cards(await section(tab)), ["Oct 27", "Oct 28", "Oct 29"], "from tomorrow");

      // That evening's, postponed to tomorrow.
      await travel(tab, 1);
      await until(tab, "21:01");
      eq((await popup(tab)).open, true, "Oct 27's due");
      await p.click(`${M} #retinoidPostponeBtn`);
      eq([(await popup(tab)).open, cards(await section(tab))], [false, ["Oct 28", "Oct 29", "Oct 30"]], "moved a day");
      eq((await exportBackup(tab)).retinoids.regimens[0].next, { after: "2026-10-26", date: "2026-10-28" }, "next in Export");
    }
  },
  {
    name: "bosco retinoids: Skip goes to the next one on the schedule (on time, late onto today's, late past a missed one)",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Started Sep 18: step 1 (every 3 days) to Oct 1, then every other day; applied every 3 days since, today's due at 9 PM.
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }], retinoids: taz(D(-12), [D(-12), D(-9), D(-6), D(-3)]) }));
      const log = async () => (await exportBackup(tab)).retinoids.log.length;
      await until(tab, "21:01");
      eq((await popup(tab)).buttons, ["Applied", "Not yet", "Postpone to tomorrow", "Skip to Saturday"], "on time: Skip to its next one, 3 days on");
      await p.click(`${M} #retinoidSkipBtn`);
      let s = await section(tab);
      eq([(await popup(tab)).open, s.groups[0][0], cards(s)], [false, "Tazarotene 0.1% · face · last applied Sunday, Sep 27", ["Oct 3", "Oct 5", "Oct 7"]], "skipped: the schedule's days");
      eq([(await exportBackup(tab)).retinoids.regimens[0].next, await log()], [{ after: D(-3), date: "2026-10-03" }, 4], "next in Export, nothing logged");

      // Monday Oct 5 at 9 PM, Saturday's not applied: skipping it goes to today's, which asks next.
      await travel(tab, 5);
      let pop = await popup(tab);
      eq([pop.text.split(" was due ")[1].split(" at ")[0], pop.buttons], ["Saturday, Oct 3", ["Applied it Saturday", "Applied it today", "Not yet", "Postpone to tomorrow", "Skip to today"]], "late, the next one today");
      await p.click(`${M} #retinoidSkipBtn`);
      pop = await popup(tab);
      eq([pop.open, pop.text.split(" was due ")[1].split(" at ")[0], pop.buttons], [true, "Monday, Oct 5", ["Applied", "Not yet", "Postpone to tomorrow", "Skip to Wednesday"]], "today's asks");
      await p.click(`${M} #retinoidSnoozeBtn`);

      // Thursday Oct 8, neither applied: skipping Monday's passes Wednesday's too (past), to tomorrow's.
      await travel(tab, 3);
      pop = await popup(tab);
      eq([pop.buttons[0], pop.buttons[4]], ["Applied it Monday", "Skip to tomorrow"], "two late ones");
      await p.click(`${M} #retinoidSkipBtn`);
      s = await section(tab);
      eq([(await popup(tab)).open, cards(s), s.groups[0][2].map(c => c[3]), await log()], [false, ["Oct 9", "Oct 11", "Oct 13"], [false, false, false], 4], "on from tomorrow");

      // Applied as it comes: the skip is behind it.
      await travel(tab, 1);
      await p.click(`${M} #retinoidLogBtn`);
      s = await section(tab);
      eq([s.groups[0][0], cards(s), await log()], ["Tazarotene 0.1% · face · last applied Friday, Oct 9", ["Oct 11", "Oct 13", "Oct 15"], 5], "applied");
    }
  },
  {
    name: "bosco retinoids: Developer Mode's Skip this application goes to the next one on the schedule, again, and undoes it; applied, the skips are behind it",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }], retinoids: taz(D(-12), [D(-12), D(-9), D(-6), D(-3)]) }));
      await devPanel(tab, true);
      // The retinoid's block in Developer Mode: its line, the skipped line, Undo shown.
      const dev = () => p.evaluate(() => {
        const box = document.querySelector("[data-skip]").closest(".dev-block"), hint = box.querySelector(".dev-hint");
        return [box.querySelector(".dev-block-head").textContent, hint ? hint.textContent : "", !!box.querySelector("[data-unskip]")];
      });
      const next = async () => (await exportBackup(tab)).retinoids.regimens[0].next;
      eq(await dev(), ["Next Tazarotene (face): Wednesday, Sep 30 · step 1 of 3 · every 3 days", "", false], "the next application");

      await p.click("[data-skip]");
      eq([await dev(), cards(await section(tab))], [["Next Tazarotene (face): Saturday, Oct 3 · step 2 of 3 · every other day", "Skipped: 1 application.", true], ["Oct 3", "Oct 5", "Oct 7"]], "skipped");
      await p.click("[data-skip]");
      eq([(await dev()).slice(1), cards(await section(tab))], [["Skipped: 2 applications.", true], ["Oct 5", "Oct 7", "Oct 9"]], "again");
      eq([await next(), (await exportBackup(tab)).retinoids.log.length], [{ after: D(-3), date: "2026-10-05" }, 4], "next in Export, nothing logged");
      await p.click("[data-unskip]");
      eq([await dev(), cards(await section(tab)), await next()], [["Next Tazarotene (face): Wednesday, Sep 30 · step 1 of 3 · every 3 days", "", false], ["Sep 30", "Oct 3", "Oct 5"], null], "undone");

      // Skipped, then applied on its new day: the skips are behind it.
      await p.click("[data-skip]");
      await devPanel(tab, false);
      await travel(tab, 3);
      await until(tab, "21:01");
      await p.click(`${M} #retinoidLogBtn`);
      await devPanel(tab, true);
      eq(await dev(), ["Next Tazarotene (face): Monday, Oct 5 · step 2 of 3 · every other day", "", false], "applied: no skips");
    }
  },
  {
    name: "bosco retinoids: on a phone; older and damaged backups, Import, sync's combine; hidden without one",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: PHONE }), p = tab.page;
      await p.click(`${M} #addRetinoidBtn`);
      eq(await p.evaluate(() => document.documentElement.scrollWidth <= 390), true, "the editor fits a phone");
      await p.click(`${M} #saveRetinoidBtn`);
      has(await p.locator(`${M} #upcomingRetinoidsSection`).innerText(), "Tazarotene 0.05%", "the section on a phone");
      const mine = (await exportBackup(tab)).retinoids.regimens[0];

      // An older backup (no retinoids): yours stay.
      await importBackup(tab, gen.bosco());
      eq((await section(tab)).groups.map(g => g[0]), ["Tazarotene 0.05%"], "kept over an older backup");

      // A damaged one: a bad step dropped, the last step open-ended, an unknown retinoid shown as it is, a bad record gone.
      const damaged = gen.bosco({ retinoids: {
        regimens: [{ id: "d1", retinoid: "newstuff", pct: 0.2, where: "<b>back</b>", time: "25:00", start: D(-1), steps: [{ every: 0, weeks: "two" }, { every: 3, weeks: 2 }, { every: 2, weeks: 3 }], u: 5 },
          { id: "bad", retinoid: "tretinoin", pct: 0, start: D(-1), steps: BUILD_UP }],
        log: [{ r: "d1", date: "2026-02-30", u: 1 }, { id: "wrong", r: "d1", date: D(-1), u: 1 }, "junk"] } });
      await importBackup(tab, damaged);
      let s = await section(tab);
      eq(s.groups.map(g => [g[0], g[1]]), [["Newstuff 0.2% · <b>back</b> · last applied Tuesday, Sep 29", "Step 1 of 2 · every 3 days · week 1 of 2 · every other day from Tuesday, Oct 13"],
        ["Tazarotene 0.05%", "Step 1 of 3 · every 3 days · week 1 of 2 · every other day from Wednesday, Oct 14"]], "cleaned, escaped, first by when added");
      let backup = await exportBackup(tab);
      eq(backup.retinoids.regimens[0], { id: "d1", retinoid: "newstuff", pct: 0.2, where: "<b>back</b>", time: null, start: D(-1), steps: [{ every: 3, weeks: 2 }, { every: 2, weeks: null }],
        next: null, at: 0, u: backup.retinoids.regimens[0].u }, "the damaged regimen as kept");
      eq(backup.retinoids.log.map(l => l.id), [`d1:${D(-1)}`], "the log's one good record, its id rebuilt");

      // A backup with Tazarotene's steps changed (an older stamp) and without the other: the backup's wins, the other stays.
      const edited = JSON.parse(JSON.stringify(backup));
      edited.retinoids.regimens = [{ ...mine, steps: [{ every: 2, weeks: null }], u: 1 }];
      edited.retinoids.log = [];
      await importBackup(tab, edited);
      s = await section(tab);
      eq(s.groups.map(g => [g[0].split(" · ")[0], g[1]]), [["Newstuff 0.2%", s.groups[0][1]], ["Tazarotene 0.05%", "Every other day"]], "the backup's steps, the other kept");

      // Sync's combine of another device's save: [same, changed].
      await until(tab, "21:01");
      eq((await popup(tab)).title, "Did you apply your Tazarotene?", "today's due");
      await p.click(`${M} #retinoidLogBtn`);
      const combine = how => p.evaluate(h => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build())), taz = raw.retinoids.regimens.find(r => r.retinoid === "tazarotene");
        if (h === "removed") { Object.assign(taz, { x: true, u: taz.u + 1 }); raw.retinoids.log = []; }
        if (h === "older") delete raw.retinoids;
        const add = (id, retinoid, pct, t) => ({ id, retinoid, pct, where: "", time: null, start: "2026-09-30", steps: [{ every: 1, weeks: null }], next: null, at: t, u: t });
        if (h === "added") raw.retinoids.regimens.push(add("new1", "adapalene", 0.1, Date.now()), add("new2", "trifarotene", 0.005, Date.now() + 1));
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return [c.same, changed];
      }, how);
      eq(await combine("removed"), [false, true], "removed there");
      eq((await section(tab)).groups.map(g => g[0].split(" · ")[0]), ["Newstuff 0.2%"], "gone here");
      backup = await exportBackup(tab);
      eq(backup.retinoids.log.map(l => l.date), [D(-1), TODAY], "its application kept");
      eq(await combine("older"), [true, false], "an older copy's save changes nothing");
      eq(await combine("added"), [true, true], "a newer save's two retinoids");
      eq((await section(tab)).groups.map(g => g[0]), ["Newstuff 0.2% · <b>back</b> · last applied Tuesday, Sep 29", "Adapalene 0.1%", "Trifarotene 0.005%"], "they show");
      // Both due (no usual time: from the start of the day): one pop-up at a time, the next once it closes.
      eq((await popup(tab)).title, "Did you apply your Adapalene?", "the first added first");
      await p.click(`${M} #retinoidSnoozeBtn`);
      eq((await popup(tab)).title, "Did you apply your Trifarotene?", "then the next");
      await p.click(`${M} #retinoidSnoozeBtn`);
      eq((await popup(tab)).open, false, "both put off");

      // Removing them all hides the section.
      tab.answers.push(true, true, true);
      await p.evaluate(() => { const A = Kyoshi.apps.bosco; A.renderOneTimeInfo(true); });
      for (let i = 0; i < 3; i++) await p.click(`${M} #retinoidList button[data-remove-regimen]`);
      eq((await section(tab)).shown, false, "hidden");
      lacks(await p.locator(M).innerText(), "Upcoming Retinoid", "nowhere");
    }
  },
  {
    name: "bosco retinoids: Hold this step a week, Undo, Developer Mode's lines; nothing in Momo's agenda",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }], retinoids: taz(D(-12), [D(-12), D(-9), D(-6), D(-3)]) }));
      const dev = () => p.evaluate(() => { const box = document.createElement("div"); Kyoshi.apps.bosco.renderDev(box); return [...box.querySelectorAll(".dev-block-head")].map(e => e.textContent).filter(l => !l.startsWith("Next dose")); });
      let s = await section(tab);
      eq([s.groups[0][1], await buttons(tab)], ["Step 1 of 3 · every 3 days · week 2 of 2 · every other day from Friday, Oct 2", [["Hold this step a week"]]], "Hold during step 1, no Undo");
      eq(await dev(), ["Next Tazarotene (face): Wednesday, Sep 30 · step 1 of 3 · every 3 days"], "Developer Mode's line");

      // Held a week: step 2 a week later, the cards in step 1 longer.
      await p.click(`${M} button[data-hold]`);
      s = await section(tab);
      eq([s.groups[0][1], s.groups[0][2].map(c => [c[1].split(" · ")[0], c[2]])], ["Step 1 of 3 · every 3 days · week 2 of 3 · every other day from Friday, Oct 9",
        [["Sep 30", "Step 1 of 3 · every 3 days"], ["Oct 3", "Step 1 of 3 · every 3 days"], ["Oct 6", "Step 1 of 3 · every 3 days"]]], "held a week");
      eq((await exportBackup(tab)).retinoids.regimens[0].steps, [{ every: 3, weeks: 3 }, { every: 2, weeks: 2 }, { every: 1, weeks: null }], "weeks: 3 in Export");
      has((await editor(tab)).list[0], "every 3 days for 3 weeks", "start-up info's list");
      await p.click(`${M} button[data-hold]`);
      eq((await section(tab)).groups[0][1], "Step 1 of 3 · every 3 days · week 2 of 4 · every other day from Friday, Oct 16", "held again");

      // Applied tonight, then taken back: the card due again, the pop-up put off, a marker in Export.
      await until(tab, "21:01");
      await p.click(`${M} #retinoidLogBtn`);
      s = await section(tab);
      eq([s.groups[0][0], await buttons(tab)], ["Tazarotene 0.1% · face · last applied Wednesday, Sep 30", [["Undo", "Hold this step a week"]]], "applied: Undo");
      await p.click(`${M} button[data-undo]`);
      s = await section(tab);
      eq([s.groups[0][0], await buttons(tab), s.groups[0][2][0].slice(1), (await popup(tab)).open], ["Tazarotene 0.1% · face · last applied Sunday, Sep 27", [["Hold this step a week"]],
        ["Sep 30 · 9:00 PM", "Step 1 of 3 · every 3 days", true], false], "undone: due again, no pop-up");
      eq(await dev(), ["Next Tazarotene (face): Wednesday, Sep 30 · step 1 of 3 · every 3 days · due"], "Developer Mode: due");
      let rec = (await exportBackup(tab)).retinoids.log.find(l => l.date === TODAY);
      eq([rec.id, rec.x], [`taz1:${TODAY}`, true], "the marker in Export");
      eq(await bugLine(tab), "- Retinoids: 1 (steps 3); applications logged: 4; due now: 1", "the bug line counts it out");

      // Another device's copy of the record (an older change): the undo stays.
      const changed = await p.evaluate(today => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build())), l = raw.retinoids.log.find(x => x.date === today);
        delete l.x;
        l.u = 1;
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const ch = c.apply();
        if (ch) A.data.afterSync();
        return ch;
      }, TODAY);
      eq(changed, false, "nothing changes here");
      eq((await section(tab)).groups[0][0], "Tazarotene 0.1% · face · last applied Sunday, Sep 27", "still undone");
      rec = (await exportBackup(tab)).retinoids.log.find(l => l.date === TODAY);
      eq(rec.x, true, "still a marker");

      // Nothing in Momo's agenda (only doses, none here).
      eq(await p.evaluate(([from, to]) => Kyoshi.agenda(from, to).filter(e => e.app === "bosco" && !e.id.startsWith("dose:")).length, [D(-12), D(14)]), 0, "no retinoid events");

      // Step 2 (Oct 16 on): Hold still there; the last step (Oct 30 on): gone.
      await travel(tab, 16);
      eq([(await section(tab)).groups[0][1], (await buttons(tab))[0].includes("Hold this step a week")], ["Step 2 of 3 · every other day · week 1 of 2 · every day from Friday, Oct 30", true], "step 2");
      await travel(tab, 14);
      eq([(await section(tab)).groups[0][1], (await buttons(tab))[0].includes("Hold this step a week")], ["Step 3 of 3 · every day from Oct 30 on", false], "the last step: no Hold");
    }
  }
];
