/* Kyoshi · tests/bosco-doses.test.js — Bosco's injection sites (Phase 8 of plan_2026-10-05): each upcoming dose goes to
 * the next site that's on, after the one the last dose was logged at (Abdomen L → R, the thighs' upper, middle and lower
 * spots swapping legs, then the upper arms and buttocks, which start off), starting over after the last; the dose pop-up
 * offers the sites that are on (the planned one picked) and the others under Other, keeps a site picked there while it's
 * kept up to date, and logs it, History saying where it went and the rotation going on from there; start-up info turns
 * sites on and off (four to a row, two on a phone) and asks once more on each device; Export and Import JSON keep them,
 * an older backup (no sites) keeps yours, a damaged one is cleaned; with every site off, no site shows anywhere; folder
 * sync's combine takes the newer save's sites and never loses a dose's site to an older copy; Momo's board leaves the
 * site out of a dose's note (the owner's choice). */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, has, lacks, open, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
const ON = ["Abdomen · left", "Abdomen · right", "Thigh · left, upper", "Thigh · right, upper", "Thigh · left, middle", "Thigh · right, middle", "Thigh · left, lower", "Thigh · right, lower"];
const OFF = ["Upper arm · left", "Upper arm · right", "Buttock · left", "Buttock · right"];
const BUTTONS = ["Abdomen L", "Abdomen R", "Thigh L upper", "Thigh R upper", "Thigh L middle", "Thigh R middle", "Thigh L lower", "Thigh R lower", "Upper arm L", "Upper arm R", "Buttock L", "Buttock R"];

// The upcoming doses' sites, as their cards say them ("" for none).
const cardSites = tab => tab.page.$$eval(`${M} #upcomingDosesGrid .stat`, cards => cards.map(c => (c.querySelector(".lbl.site") || { textContent: "" }).textContent));
// History's rows: [date, dose].
const history = tab => tab.page.$$eval(`${M} #historyBody tr`, rows => rows.map(r => [r.cells[0].textContent.trim(), r.cells[3].innerText.trim()]));
// The dose pop-up: open, its site shown, the site picked, the sites on and the others (under Other).
const popup = tab => tab.page.evaluate(m => {
  const o = document.querySelector(`${m} #doseOverlay`), sel = o.querySelector("#doseSiteSelect"), text = el => el.textContent;
  return {
    open: o.classList.contains("open"), shown: !o.querySelector("#doseSiteField").hidden,
    picked: sel.selectedOptions[0] ? text(sel.selectedOptions[0]) : "",
    on: [...sel.children].filter(c => c.tagName === "OPTION").map(text), other: [...sel.querySelectorAll("optgroup option")].map(text)
  };
}, M);
// Start-up info's site buttons, [text, on], and how they're laid out (rows × columns).
const buttons = tab => tab.page.$$eval(`${M} #sitePills button`, bs => bs.map(b => [b.textContent, b.classList.contains("active") && b.getAttribute("aria-pressed") === "true"]));
const grid = tab => tab.page.$$eval(`${M} #sitePills button`, bs => {
  const boxes = bs.map(b => b.getBoundingClientRect());
  return [new Set(boxes.map(r => Math.round(r.top))).size, new Set(boxes.map(r => Math.round(r.left))).size];
});
const tapSite = (tab, text) => tab.page.click(`${M} #sitePills button:text-is("${text}")`);
// Saves start-up info, naming you first if it asks (a made-up name).
async function saveStartup(tab) {
  const name = tab.page.locator(`${M} #oneTimeInput_name`);
  if (await name.count()) await name.fill("Sam");
  await tab.page.click(`${M} #oneTimeInfoSaveBtn`);
}
const startupShown = tab => tab.page.evaluate(m => [!document.querySelector(`${m} #oneTimeInfoSection`).hidden, !document.querySelector(`${m} #dosingBox`).hidden], M);
const bugLine = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.bugState().find(l => l.startsWith("- Injection sites")));
const entrySite = (backup, date) => backup.entries.find(e => e.date === date).site;

module.exports = [
  {
    name: "bosco doses: each upcoming dose has the next site on; a site picked in the pop-up is logged, the rotation goes on from it; start-up info, export, import",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Start-up info's twelve sites, four to a row, the abdomen and thighs on.
      eq(await buttons(tab), BUTTONS.map((b, i) => [b, i < 8]), "the sites, the abdomen and thighs on");
      eq(await grid(tab), [3, 4], "four to a row");
      eq(await bugLine(tab), "- Injection sites on: 8 (default)", "the bug report's count");

      // A dose due today; the doses before it from before injection sites, so the rotation starts at the first site on.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq(await cardSites(tab), ["Abdomen · left", "Abdomen · right", "Thigh · left, upper"], "the upcoming doses' sites");
      let pop = await popup(tab);
      eq([pop.open, pop.shown, pop.picked, pop.on, pop.other], [true, true, "Abdomen · left", ON, OFF], "the pop-up: the planned site picked, the others under Other");

      // Another site picked stays picked as the pop-up is kept up to date (every minute); Log dose logs it there.
      await p.selectOption(`${M} #doseSiteSelect`, "thigh-r-lower");
      await tab.ctx.clock.fastForward(61000);
      pop = await popup(tab);
      eq([pop.open, pop.picked], [true, "Thigh · right, lower"], "still picked a minute later");
      await p.click(`${M} #doseLogBtn`);
      eq((await popup(tab)).open, false, "logged");
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg|Thigh R lower"], "History says where it went");
      // The rotation goes on from the site used, starting over after the last one on (not from the planned Abdomen L).
      eq(await cardSites(tab), ["Abdomen · left", "Abdomen · right", "Thigh · left, upper"], "on from Thigh R lower");

      // Start-up info (it asks about the sites): the abdomen off. The doses skip it.
      eq(await startupShown(tab), [true, true], "start-up info asks");
      await tapSite(tab, "Abdomen L");
      await tapSite(tab, "Abdomen R");
      eq((await buttons(tab)).slice(0, 3), [["Abdomen L", false], ["Abdomen R", false], ["Thigh L upper", true]], "toggled off");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "answered");
      eq(await cardSites(tab), ["Thigh · left, upper", "Thigh · right, upper", "Thigh · left, middle"], "the abdomen skipped");
      eq(await bugLine(tab), "- Injection sites on: 6", "6 on");

      // Export keeps the sites on and where each dose went.
      const backup = await exportBackup(tab);
      eq(backup.schemaVersion, 4, "still schema 4");
      eq(backup.sites, ["thigh-l-upper", "thigh-r-upper", "thigh-l-middle", "thigh-r-middle", "thigh-l-lower", "thigh-r-lower"], "the sites on");
      eq([entrySite(backup, TODAY), entrySite(backup, D(-7))], ["thigh-r-lower", null], "each dose's site");

      // Momo's board leaves the site out of a dose's note.
      const notes = await p.evaluate(([from, to]) => Kyoshi.agenda(from, to).filter(e => e.app === "bosco").map(e => e.note), [D(-7), D(14)]);
      eq(notes, ["5 mg", "5 mg", "5 mg", "5 mg"], "Momo's notes");

      // Another device: the backup brings the sites and the doses' sites with it.
      const other = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(other, backup);
      eq((await buttons(other)).map(b => b[1]), BUTTONS.map((b, i) => i > 1 && i < 8), "its start-up info: the thighs on");
      eq(await cardSites(other), ["Thigh · left, upper", "Thigh · right, upper", "Thigh · left, middle"], "the same doses' sites");
      eq((await history(other))[0], ["Sep 30, 2026", "5 mg|Thigh R lower"], "the same History");

      // A week on (time travel; its pop-up then covers Developer Mode's badge): the next dose comes due at its
      // site; logged, the next ones follow it.
      await other.page.evaluate(() => Kyoshi.dev.travel(7));
      pop = await popup(other);
      eq([pop.open, pop.picked, pop.on, pop.other], [true, "Thigh · left, upper", ON.slice(2), ON.slice(0, 2).concat(OFF)], "the pop-up a week on");
      await other.page.click(`${M} #doseLogBtn`);
      eq((await history(other))[0], ["Oct 7, 2026", "5 mg|Thigh L upper"], "logged at the planned site");
      eq(await cardSites(other), ["Thigh · right, upper", "Thigh · left, middle", "Thigh · right, middle"], "the next ones");
    }
  },
  {
    name: "bosco doses: on a phone; an older backup keeps your sites, a damaged one is cleaned; every site off; asked once more; sync's combine",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: PHONE }), p = tab.page;
      eq(await grid(tab), [6, 2], "two to a row on a phone");

      // An older backup (no sites): the default rotation. Not yet for now.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq(await cardSites(tab), ["Abdomen · left", "Abdomen · right", "Thigh · left, upper"], "the default rotation");
      await p.click(`${M} #doseSnoozeBtn`);

      // A damaged one: unknown and repeated sites dropped (the rest in the rotation's order), a site from a newer
      // version kept as it is, a broken one dropped, and one on a weigh-in without a dose dropped.
      const damaged = gen.bosco({ lastDose: D(-7), sites: ["thigh-r-upper", "nope", "abd-r", "thigh-r-upper", 5, null] });
      damaged.entries.find(e => e.date === D(-7)).site = "hip-l";
      damaged.entries.find(e => e.date === D(-14)).site = "<b>abd-l</b>";
      damaged.entries.push({ date: D(-1), weight: 190, doseMg: null, medication: null, site: "abd-l" });
      await importBackup(tab, damaged);
      eq(await buttons(tab), BUTTONS.map(b => [b, b === "Abdomen R" || b === "Thigh R upper"]), "start-up info: the two sites kept");
      eq(await cardSites(tab), ["Abdomen · right", "Thigh · right, upper", "Abdomen · right"], "from the first site on (hip-l isn't one here)");
      eq((await history(tab)).slice(0, 3).map(r => r[1]), ["—", "5 mg|hip-l", "5 mg"], "History");
      let backup = await exportBackup(tab);
      eq(backup.sites, ["abd-r", "thigh-r-upper"], "cleaned sites");
      eq([entrySite(backup, D(-1)), entrySite(backup, D(-7)), entrySite(backup, D(-14))], [null, "hip-l", null], "cleaned doses' sites");

      // The older backup again: your sites stay.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq((await exportBackup(tab)).sites, ["abd-r", "thigh-r-upper"], "kept");

      // Every site off: no site on the cards or in the pop-up, and a dose logged has none.
      await tapSite(tab, "Abdomen R");
      await tapSite(tab, "Thigh R upper");
      await saveStartup(tab);
      eq(await cardSites(tab), ["", "", ""], "no sites on the cards");
      eq(await bugLine(tab), "- Injection sites on: 0", "none on");
      await p.click(`${M} #upcomingDosesGrid button[data-confirm-dose]`);
      eq([(await popup(tab)).open, (await popup(tab)).shown], [true, false], "the pop-up without a site");
      await p.click(`${M} #doseLogBtn`);
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg"], "logged without a site");
      backup = await exportBackup(tab);
      eq([backup.sites, entrySite(backup, TODAY)], [[], null], "exported: sites off");

      // A device updated from before sites asks once more; once saved, it doesn't.
      await p.evaluate(() => { const A = Kyoshi.apps.bosco, pr = A.store.json("profile"); pr.dosingAsked = 2; A.store.set("profile", JSON.stringify(pr)); });
      const reload = async () => { await p.reload(); await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started); };
      await reload();
      eq(await startupShown(tab), [true, true], "asked once more");
      eq((await buttons(tab)).filter(b => b[1]), [], "with every site off, as saved");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "saved");
      await reload();
      eq(await startupShown(tab), [false, false], "not asked again");

      // Folder sync: a newer save from another device brings its sites and a dose's site; then a copy older than sites
      // (no sites, no dose sites) changes nothing.
      const combine = (edit, newer = true) => p.evaluate(([how, mineFirst]) => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
        if (how === "arms") { raw.sites = ["arm-l", "arm-r"]; raw.entries[raw.entries.length - 1].site = "arm-l"; }
        if (how === "older") { delete raw.sites; raw.entries.forEach(e => delete e.site); }
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: mineFirst ? "1" : "3", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return changed;
      }, [edit, newer]);
      eq(await combine("arms"), true, "the newer save combined");
      eq(await cardSites(tab), ["Upper arm · right", "Upper arm · left", "Upper arm · right"], "its sites, on from its dose's");
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg|Upper arm L"], "its dose's site");
      eq(await combine("older"), false, "an older copy, even saved later, changes nothing");
      eq(await combine("older", false), false, "nor saved earlier");
      backup = await exportBackup(tab);
      eq([backup.sites, entrySite(backup, TODAY)], [["arm-l", "arm-r"], "arm-l"], "kept");
      has(await p.locator(`${M} #upcomingDosesSection`).innerText(), "Upper arm · right", "shown on a phone");
      lacks(await p.locator(`${M} #upcomingDosesSection`).innerText(), "Abdomen", "nothing off");
    }
  }
];
