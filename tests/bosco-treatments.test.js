/* Kyoshi · tests/bosco-treatments.test.js — Bosco's non-daily treatments (9.037, in place of the retinoid build-ups):
 * start-up info's list (Add, Enter, renamed in place, Remove with its question, Save adding what's typed); the section's
 * cards ("Not taken yet", Took it today → "9/30 - (today)", Undo; "(yesterday)", "(n days ago)" as days pass; amber once
 * the days between have passed, set in Developer Mode); the bug report's counts; an old retinoid regimen carried over
 * (named after its retinoid, its last step's days, its log kept), older and damaged backups, sync's combine; on a
 * phone; nothing in Momo's agenda. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, has, lacks, open, devPanel, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
const BUILD_UP = [{ every: 3, weeks: 2 }, { every: 2, weeks: 2 }, { every: 1, weeks: null }];

// The section: shown, and each card's [name, last taken, amber, button].
const section = tab => tab.page.evaluate(m => {
  const s = document.querySelector(`${m} #treatmentsSection`);
  return { shown: !s.hidden, cards: [...s.querySelectorAll(".stat")].map(c => [c.querySelector(".val").textContent, c.querySelector(".lbl").textContent, c.classList.contains("due"), c.querySelector("button").textContent]) };
}, M);
// Start-up info's list: the names in their boxes.
const names = tab => tab.page.evaluate(m => [...document.querySelectorAll(`${m} #treatmentList input`)].map(i => i.value), M);
const addTreatment = async (tab, name, enter = false) => {
  await tab.page.fill(`${M} #treatmentNew`, name);
  if (enter) await tab.page.press(`${M} #treatmentNew`, "Enter");
  else await tab.page.click(`${M} #addTreatmentBtn`);
};
const card = (tab, i) => tab.page.locator(`${M} #treatmentsGrid .stat`).nth(i).locator("button");
const bugLine = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.bugState().find(l => l.startsWith("- Non-daily")));
const travel = (tab, days) => tab.page.evaluate(n => Kyoshi.dev.travel(n), days);
// Developer Mode's days between: [name, value] each.
const devDays = tab => tab.page.evaluate(() => [...document.querySelectorAll("#kDevPanel .treatment-every")].map(l => [l.querySelector("span").textContent, l.querySelector("input").value]));
const setDays = async (tab, i, n) => {
  const box = tab.page.locator("#kDevPanel .treatment-every input").nth(i);
  await box.fill(String(n));
  await box.dispatchEvent("change");
};
// Tazarotene 0.1% on the face, the old build-up (8.601–8.937), applied on the days given (made-up data).
const taz = (start, days = []) => ({
  regimens: [{ id: "taz1", retinoid: "tazarotene", pct: 0.1, where: "face", time: "21:00", start, steps: BUILD_UP, next: null, at: 1, u: 1 }],
  log: days.map(d => ({ id: `taz1:${d}`, r: "taz1", date: d, u: 1 }))
});
const combine = (tab, how) => tab.page.evaluate(h => {
  const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
  if (h === "removed") { const r = raw.retinoids.regimens[0]; Object.assign(r, { x: true, u: r.u + 1 }); }
  if (h === "older") delete raw.retinoids;
  if (h === "added") raw.retinoids.regimens.push({ id: "new1", name: "Glycopyrrolate 2%", every: 2, at: Date.now(), u: Date.now() });
  const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
  const changed = c.apply();
  if (changed) A.data.afterSync();
  return [c.same, changed];
}, how);

module.exports = [
  {
    name: "bosco treatments: added in start-up info, taken today, Undo, days going by, days between in Developer Mode, renamed, removed",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      eq([await names(tab), (await section(tab)).shown], [[], false], "none yet: no section");
      eq(await bugLine(tab), "- Non-daily treatments: 0; days taken logged: 0", "the bug line with none");

      await addTreatment(tab, "Tretinoin");
      await addTreatment(tab, "  Tazarotene  ", true);
      await p.fill(`${M} #treatmentNew`, "Glycopyrrolate 2%");
      await p.click(`${M} #oneTimeInfoSaveBtn`); // Save adds what's typed
      eq(await names(tab), ["Tretinoin", "Tazarotene", "Glycopyrrolate 2%"], "the list");
      let s = await section(tab);
      eq(s.cards, [["Tretinoin", "Not taken yet", true, "Took it today"], ["Tazarotene", "Not taken yet", true, "Took it today"],
        ["Glycopyrrolate 2%", "Not taken yet", true, "Took it today"]], "a card each, amber");

      // Taken today, then taken back.
      await card(tab, 0).click();
      await card(tab, 1).click();
      s = await section(tab);
      eq(s.cards.slice(0, 2), [["Tretinoin", "9/30 - (today)", false, "Undo"], ["Tazarotene", "9/30 - (today)", false, "Undo"]], "taken today");
      await card(tab, 1).click();
      eq((await section(tab)).cards[1], ["Tazarotene", "Not taken yet", true, "Took it today"], "undone");
      let backup = await exportBackup(tab);
      eq(backup.retinoids.regimens.map(r => [r.name, r.every]), [["Tretinoin", 3], ["Tazarotene", 3], ["Glycopyrrolate 2%", 3]], "in Export, 3 days between");
      eq(backup.retinoids.log.map(l => !!l.x), [false, true], "the undo a marker");
      eq(await bugLine(tab), "- Non-daily treatments: 3; days taken logged: 1", "the bug line");

      // Days going by: yesterday, then 3 days ago (amber at 3 days between).
      await travel(tab, 1);
      eq((await section(tab)).cards[0].slice(0, 3), ["Tretinoin", "9/30 - (yesterday)", false], "yesterday");
      await travel(tab, 2);
      eq((await section(tab)).cards[0].slice(0, 3), ["Tretinoin", "9/30 - (3 days ago)", true], "3 days ago: amber");

      // Developer Mode's days between: 5 for Tretinoin, not amber any more; a bad number goes back.
      await devPanel(tab, true);
      eq(await devDays(tab), [["Tretinoin", "3"], ["Tazarotene", "3"], ["Glycopyrrolate 2%", "3"]], "Developer Mode's days between");
      await setDays(tab, 0, 5);
      eq([(await section(tab)).cards[0][2], (await devDays(tab))[0]], [false, ["Tretinoin", "5"]], "5 days between");
      await setDays(tab, 1, 0);
      eq((await devDays(tab))[1], ["Tazarotene", "3"], "0 days: back to 3");
      await devPanel(tab, false);

      // Renamed in place; removed after asking (its days stay in the data).
      await p.evaluate(() => Kyoshi.apps.bosco.renderOneTimeInfo(true));
      const box = p.locator(`${M} #treatmentList input`).nth(1);
      await box.fill("Tazarotene 0.1%");
      await box.dispatchEvent("change");
      eq((await section(tab)).cards[1][0], "Tazarotene 0.1%", "renamed");
      tab.answers.push(false, true);
      await p.locator(`${M} #treatmentList button[data-remove-treatment]`).first().click();
      eq((await names(tab)).length, 3, "kept when you say no");
      await p.locator(`${M} #treatmentList button[data-remove-treatment]`).first().click();
      eq(await names(tab), ["Tazarotene 0.1%", "Glycopyrrolate 2%"], "removed");
      has(tab.dialogs.map(d => d[1]).join("\n"), "Remove Tretinoin? The days you took it stay in your data.", "the question");
      backup = await exportBackup(tab);
      eq([backup.retinoids.regimens[0].x, backup.retinoids.log.length], [true, 2], "a marker, its day kept");
      eq((await section(tab)).cards.map(c => c[0]), ["Tazarotene 0.1%", "Glycopyrrolate 2%"], "the section");

      // Nothing in Momo's agenda.
      eq(await p.evaluate(([from, to]) => Kyoshi.agenda(from, to).filter(e => e.app === "bosco" && !e.id.startsWith("dose:")).length, [D(-7), D(14)]), 0, "no treatment events");
      eq(tab.problems, [], "no console errors");
    }
  },
  {
    name: "bosco treatments: an old retinoid carried over; older and damaged backups; sync's combine; on a phone",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: PHONE }), p = tab.page;
      // The old build-up: named after its retinoid, its last step's days (every day), its log kept.
      await importBackup(tab, gen.bosco({ retinoids: taz(D(-40), [D(-10), D(-4)]) }));
      eq((await section(tab)).cards, [["Tazarotene", "9/26 - (4 days ago)", true, "Took it today"]], "carried over");
      let backup = await exportBackup(tab);
      eq(backup.retinoids.regimens[0], { id: "taz1", name: "Tazarotene", every: 1, at: 1, u: backup.retinoids.regimens[0].u }, "as kept now");
      eq(await p.evaluate(() => document.documentElement.scrollWidth <= 390), true, "fits a phone");

      // An older backup (none): ours stay. A damaged one: the unusable left out, a name escaped, the year when not this one.
      await importBackup(tab, gen.bosco());
      eq((await section(tab)).cards.map(c => c[0]), ["Tazarotene"], "kept over an older backup");
      await importBackup(tab, gen.bosco({ retinoids: {
        regimens: [{ id: "d1", name: "<b>Cream</b>", every: 500, at: 5, u: 5 }, { id: "bad!", name: "X" }, { id: "d2", name: "  " }],
        log: [{ r: "d1", date: "2025-12-30", u: 1 }, { r: "d1", date: "2026-02-30", u: 1 }, "junk"] } }));
      eq((await section(tab)).cards.map(c => c.slice(0, 2)), [["Tazarotene", "9/26 - (4 days ago)"], ["<b>Cream</b>", "12/30/25 - (274 days ago)"]], "cleaned, escaped");
      backup = await exportBackup(tab);
      eq(backup.retinoids.regimens[1].every, 3, "a bad days between: 3");

      // Sync's combine of another device's save: [same, changed].
      eq(await combine(tab, "removed"), [true, true], "removed there (theirs as it is: nothing to save back)");
      eq((await section(tab)).cards.map(c => c[0]), ["<b>Cream</b>"], "gone here");
      eq(await combine(tab, "older"), [true, false], "an older copy's save changes nothing");
      eq(await combine(tab, "added"), [true, true], "a newer save's treatment");
      eq((await section(tab)).cards.map(c => c[0]), ["<b>Cream</b>", "Glycopyrrolate 2%"], "it shows");
      lacks(await p.locator(M).innerText(), "Retinoid", "no retinoid wording left");
      eq(tab.problems, [], "no console errors");
    }
  }
];
