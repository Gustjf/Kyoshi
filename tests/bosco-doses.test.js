/* Kyoshi · tests/bosco-doses.test.js — Bosco's injection sites (Phase 8 of plan_2026-10-05; by body part in Phase 3 of
 * 2026-10-06_feedback_batch_plan.md): the body parts with a site on take turns (abdomen, thighs, buttocks, upper arms),
 * and within each the doses go on through its sites in its own order (an X: the abdomen's and buttocks' four, the
 * thighs' twelve, the arms' two), each part from the last site logged in it; the dose pop-up offers the sites that are
 * on by body part (the planned one picked) and the others under Other, keeps a site picked there while it's kept up to
 * date, and logs it, History saying where it went and the rotation going on from there; start-up info turns sites on
 * and off (a group per part, four to a row, two on a phone) and asks once more on each device; an older version's site
 * turns on every site it's split into, reads as it did and counts as the one it stands for; Developer Mode skips the
 * next dose's site until a dose is logged; Export and Import JSON keep them, an older backup (no sites) keeps yours, a
 * damaged one is cleaned; with every site off, no site shows anywhere; folder sync's combine takes the newer save's
 * sites and skips and never loses a dose's site to an older copy; Momo's board leaves the site out of a dose's note
 * (the owner's choice). Start-up info's answers travel with the data (Phase 3 of 2026-10-08_feedback_batch_plan.md):
 * answered on one device, not asked on another (Export and Import, sync's combine), the medication's answer with them;
 * an older or unanswered save never takes them back, a later version's counts, a damaged one is cleaned. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, has, lacks, open, devPanel, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
const ABD = ["Abdomen · left, upper", "Abdomen · right, lower", "Abdomen · left, lower", "Abdomen · right, upper"];
const THIGH = ["Thigh · left front, upper", "Thigh · right side, middle", "Thigh · left side, lower", "Thigh · right front, upper",
  "Thigh · left front, middle", "Thigh · right side, lower", "Thigh · left side, upper", "Thigh · right front, middle",
  "Thigh · left front, lower", "Thigh · right side, upper", "Thigh · left side, middle", "Thigh · right front, lower"];
const GLUTE = ["Buttock · left, upper", "Buttock · right, lower", "Buttock · left, lower", "Buttock · right, upper"];
const ARM = ["Upper arm · left", "Upper arm · right"];
const THIGH_IDS = ["thigh-l-front-upper", "thigh-r-side-middle", "thigh-l-side-lower", "thigh-r-front-upper", "thigh-l-front-middle", "thigh-r-side-lower",
  "thigh-l-side-upper", "thigh-r-front-middle", "thigh-l-front-lower", "thigh-r-side-upper", "thigh-l-side-middle", "thigh-r-front-lower"];
// Start-up info's buttons, by body part: the X's short words.
const PILLS = ["L upper", "R lower", "L lower", "R upper", "L front upper", "R side middle", "L side lower", "R front upper", "L front middle", "R side lower",
  "L side upper", "R front middle", "L front lower", "R side upper", "L side middle", "R front lower", "L upper", "R lower", "L lower", "R upper", "L", "R"];

// The upcoming doses' sites, as their cards say them ("" for none).
const cardSites = tab => tab.page.$$eval(`${M} #upcomingDosesGrid .stat`, cards => cards.map(c => (c.querySelector(".lbl.site") || { textContent: "" }).textContent));
// History's rows: [date, dose].
const history = tab => tab.page.$$eval(`${M} #historyBody tr`, rows => rows.map(r => [r.cells[0].textContent.trim(), r.cells[3].innerText.trim()]));
// The dose pop-up: open, its site shown, the site picked, and its menu's groups [label, [sites]] (the parts', then Other).
const popup = tab => tab.page.evaluate(m => {
  const o = document.querySelector(`${m} #doseOverlay`), sel = o.querySelector("#doseSiteSelect"), text = el => el.textContent;
  return {
    open: o.classList.contains("open"), shown: !o.querySelector("#doseSiteField").hidden,
    picked: sel.selectedOptions[0] ? text(sel.selectedOptions[0]) : "",
    groups: [...sel.children].map(g => [g.label, [...g.children].map(text)])
  };
}, M);
// Start-up info's site buttons, [text, on]; the ids of those on; the parts' headings; and how they're laid out (rows × columns).
const buttons = tab => tab.page.$$eval(`${M} #sitePills button`, bs => bs.map(b => [b.textContent, b.classList.contains("active") && b.getAttribute("aria-pressed") === "true"]));
const sitesOn = tab => tab.page.$$eval(`${M} #sitePills button.active`, bs => bs.map(b => b.dataset.site));
const headings = tab => tab.page.$$eval(`${M} #sitePills .site-part-head`, hs => hs.map(h => h.textContent));
const grid = tab => tab.page.$$eval(`${M} #sitePills button`, bs => {
  const boxes = bs.map(b => b.getBoundingClientRect());
  return [new Set(boxes.map(r => Math.round(r.top))).size, new Set(boxes.map(r => Math.round(r.left))).size];
});
const tapSite = (tab, id) => tab.page.click(`${M} #sitePills button[data-site="${id}"]`);
// Saves start-up info, naming you first if it asks (a made-up name).
async function saveStartup(tab) {
  const name = tab.page.locator(`${M} #oneTimeInput_name`);
  if (await name.count()) await name.fill("Sam");
  await tab.page.click(`${M} #oneTimeInfoSaveBtn`);
}
const startupShown = tab => tab.page.evaluate(m => [!document.querySelector(`${m} #oneTimeInfoSection`).hidden, !document.querySelector(`${m} #dosingBox`).hidden], M);
const bugLine = (tab, start = "- Injection sites") => tab.page.evaluate(s => Kyoshi.apps.bosco.bugState().find(l => l.startsWith(s)), start);
const entrySite = (backup, date) => backup.entries.find(e => e.date === date).site;
// Developer Mode's injection site tools (open): the next dose's line, the skipped line, and whether Skip is enabled and Undo shown.
const devSites = tab => tab.page.evaluate(() => {
  const box = document.querySelector("#boscoSkipBtn").closest(".dev-block"), skipped = [...box.querySelectorAll(".dev-hint")].find(h => h.textContent.startsWith("Skipped"));
  return { next: box.querySelector(".dev-block-head").textContent, skipped: skipped ? skipped.textContent : "", skip: !document.querySelector("#boscoSkipBtn").disabled, undo: !!document.querySelector("#boscoUnskipBtn") };
});

module.exports = [
  {
    name: "bosco doses: each upcoming dose has the next site on; a site picked in the pop-up is logged, the rotation goes on from it; start-up info, export, import",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Start-up info's 22 sites, a group per body part, four to a row, the abdomen and thighs on.
      eq(await headings(tab), ["Abdomen", "Thighs", "Buttocks", "Upper arms"], "the body parts");
      eq(await buttons(tab), PILLS.map((b, i) => [b, i < 16]), "the sites, the abdomen and thighs on");
      eq(await grid(tab), [6, 4], "four to a row: 1 + 3 + 1 + 1 rows");
      eq(await bugLine(tab), "- Injection sites on: 16 (default)", "the bug report's count");

      // A dose due today; the doses before it from before injection sites, so the abdomen starts, at its first site.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq(await cardSites(tab), [ABD[0], THIGH[0], ABD[1]], "the upcoming doses' sites: the parts take turns");
      let pop = await popup(tab);
      eq([pop.open, pop.shown, pop.picked, pop.groups], [true, true, ABD[0], [["Abdomen", ABD], ["Thighs", THIGH], ["Other", GLUTE.concat(ARM)]]],
        "the pop-up: the planned site picked, the sites on by body part, the others under Other");

      // Another site picked stays picked as the pop-up is kept up to date (every minute); Log dose logs it there.
      await p.selectOption(`${M} #doseSiteSelect`, "abd-r-upper");
      await tab.ctx.clock.fastForward(61000);
      pop = await popup(tab);
      eq([pop.open, pop.picked], [true, ABD[3]], "still picked a minute later");
      await p.click(`${M} #doseLogBtn`);
      eq((await popup(tab)).open, false, "logged");
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg|Abd R upper"], "History says where it went");
      // The thighs' turn; the abdomen then goes on from the site used, starting over after its last (not from the planned one).
      eq(await cardSites(tab), [THIGH[0], ABD[0], THIGH[1]], "on from Abd R upper");

      // Start-up info (it asks about the sites): the abdomen off. Only the thighs take turns.
      eq(await startupShown(tab), [true, true], "start-up info asks");
      for (const id of ["abd-l-upper", "abd-r-lower", "abd-l-lower", "abd-r-upper"]) await tapSite(tab, id);
      eq((await buttons(tab)).slice(0, 5), [["L upper", false], ["R lower", false], ["L lower", false], ["R upper", false], ["L front upper", true]], "toggled off");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "answered");
      eq(await cardSites(tab), THIGH.slice(0, 3), "the abdomen left out");
      eq(await bugLine(tab), "- Injection sites on: 12", "12 on");

      // Export keeps the sites on and where each dose went.
      const backup = await exportBackup(tab);
      eq(backup.schemaVersion, 4, "still schema 4");
      eq([backup.sites, backup.skipSites], [THIGH_IDS, null], "the sites on, none skipped");
      eq([entrySite(backup, TODAY), entrySite(backup, D(-7))], ["abd-r-upper", null], "each dose's site");

      // Momo's board leaves the site out of a dose's note.
      const notes = await p.evaluate(([from, to]) => Kyoshi.agenda(from, to).filter(e => e.app === "bosco").map(e => e.note), [D(-7), D(14)]);
      eq(notes, ["5 mg", "5 mg", "5 mg", "5 mg"], "Momo's notes");

      // Another device: the backup brings the sites and the doses' sites with it.
      const other = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(other, backup);
      eq((await buttons(other)).map(b => b[1]), PILLS.map((b, i) => i >= 4 && i < 16), "its start-up info: the thighs on");
      eq(await cardSites(other), THIGH.slice(0, 3), "the same doses' sites");
      eq((await history(other))[0], ["Sep 30, 2026", "5 mg|Abd R upper"], "the same History");

      // A week on (time travel; its pop-up then covers Developer Mode's badge): the next dose comes due at its
      // site; logged, the next ones follow it.
      await other.page.evaluate(() => Kyoshi.dev.travel(7));
      pop = await popup(other);
      eq([pop.open, pop.picked, pop.groups], [true, THIGH[0], [["Thighs", THIGH], ["Other", ABD.concat(GLUTE, ARM)]]], "the pop-up a week on");
      await other.page.click(`${M} #doseLogBtn`);
      eq((await history(other))[0], ["Oct 7, 2026", "5 mg|Thigh L front upper"], "logged at the planned site");
      eq(await cardSites(other), THIGH.slice(1, 4), "the next ones");
    }
  },
  {
    name: "bosco doses: the body parts take turns, each going on through its own X, over ten doses; the buttocks turned on take theirs after the thigh",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      // Each dose as it comes due (time travel, a week at a time), logged at the site the pop-up planned.
      const logged = [];
      for (let i = 0; i < 10; i++) {
        if (i) await p.evaluate(() => Kyoshi.dev.travel(7));
        eq((await popup(tab)).open, true, `dose ${i + 1} due`);
        await p.click(`${M} #doseLogBtn`);
        logged.push((await history(tab))[0][1].replace("5 mg|", ""));
      }
      eq(logged, ["Abd L upper", "Thigh L front upper", "Abd R lower", "Thigh R side middle", "Abd L lower", "Thigh L side lower", "Abd R upper",
        "Thigh R front upper", "Abd L upper", "Thigh L front middle"], "the abdomen starting over every fourth of its turns, the thighs going on");
      eq(await cardSites(tab), [ABD[1], THIGH[5], ABD[2]], "the next ones");

      // Start-up info: the buttocks on. Their turn comes after the thigh's, starting at their first site.
      eq(await startupShown(tab), [true, true], "start-up info asks");
      for (const id of ["glute-l-upper", "glute-r-lower", "glute-l-lower", "glute-r-upper"]) await tapSite(tab, id);
      await saveStartup(tab);
      eq(await cardSites(tab), [GLUTE[0], ABD[1], THIGH[5]], "buttock, abdomen, thigh");
      eq(await bugLine(tab), "- Injection sites on: 20", "20 on");
    }
  },
  {
    name: "bosco doses: an older version's sites turn on every site they're split into, read as they did, and count as the one they stand for",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // From before 7.500: the left abdomen and the left thigh's upper spot on; a dose at abd-l, then one at thigh-r-middle.
      await importBackup(tab, gen.bosco({ lastDose: D(-7), sites: ["abd-l", "thigh-l-upper"], doseSites: ["abd-l", "thigh-r-middle"] }));
      eq(await sitesOn(tab), ["abd-l-upper", "abd-l-lower", "thigh-l-front-upper", "thigh-l-side-upper"], "both left abdomen heights, both left upper thigh faces");
      eq((await history(tab)).slice(0, 3).map(r => r[1]), ["5 mg|Thigh R middle", "5 mg|Abdomen L", "5 mg"], "History reads as it did");
      // The abdomen's turn, on from Abd L upper (what abd-l stands for); the thigh on from its front middle (off now).
      const pop = await popup(tab);
      eq([pop.open, pop.picked], [true, ABD[2]], "the dose due: Abd L lower");
      eq(await cardSites(tab), [ABD[2], THIGH[0], ABD[0]], "the next ones");
      await p.click(`${M} #doseSnoozeBtn`); // Not yet: the pop-up would cover Developer Mode's badge
      const backup = await exportBackup(tab);
      eq([backup.sites, entrySite(backup, D(-14)), entrySite(backup, D(-7))], [["abd-l-upper", "abd-l-lower", "thigh-l-front-upper", "thigh-l-side-upper"], "abd-l", "thigh-r-middle"],
        "exported: the sites on, the old doses' sites as they were");

      // Stored by an older version on this device: the right abdomen and the left buttock, read on the next start.
      await p.evaluate(() => { const A = Kyoshi.apps.bosco, pr = A.store.json("profile"); pr.sites = ["abd-r", "glute-l", "arm-r"]; A.store.set("profile", JSON.stringify(pr)); });
      await p.reload();
      await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
      eq(await sitesOn(tab), ["abd-r-lower", "abd-r-upper", "glute-l-upper", "glute-l-lower", "arm-r"], "both heights of each, the arm as it was");
    }
  },
  {
    name: "bosco doses: Developer Mode skips the next dose's site within its body part, again, and undoes it; a logged dose forgets the skips; a part all skipped gives its turn",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      await p.click(`${M} #doseSnoozeBtn`); // Not yet: the pop-up would cover Developer Mode's badge
      await devPanel(tab, true);
      eq(await devSites(tab), { next: `Next dose: ${ABD[0]}`, skipped: "", skip: true, undo: false }, "the next dose's site");

      // Skip: the abdomen's next site; again: the one after. The thigh's turn and the dose after stay as they were.
      await p.click("#boscoSkipBtn");
      eq(await devSites(tab), { next: `Next dose: ${ABD[1]}`, skipped: `Skipped: ${ABD[0]}.`, skip: true, undo: true }, "skipped once");
      eq(await cardSites(tab), [ABD[1], THIGH[0], ABD[2]], "the cards");
      await p.click("#boscoSkipBtn");
      eq((await devSites(tab)).next, `Next dose: ${ABD[2]}`, "skipped twice");
      eq(await cardSites(tab), [ABD[2], THIGH[0], ABD[3]], "the cards again");
      eq(await bugLine(tab, "- Sites skipped"), "- Sites skipped: 2", "the bug report's count");
      eq((await exportBackup(tab)).skipSites, ["abd-l-upper", "abd-r-lower"], "Export carries them");

      // Undo skips: back as planned.
      await p.click("#boscoUnskipBtn");
      eq(await devSites(tab), { next: `Next dose: ${ABD[0]}`, skipped: "", skip: true, undo: false }, "undone");
      eq(await cardSites(tab), [ABD[0], THIGH[0], ABD[1]], "the cards as planned");

      // Skipped once more, then the dose logged (at the site it went to): the skip is forgotten, the abdomen goes on from there.
      await p.click("#boscoSkipBtn");
      await devPanel(tab, false);
      await p.click(`${M} #upcomingDosesGrid button[data-confirm-dose]`);
      eq((await popup(tab)).picked, ABD[1], "the pop-up plans the next site");
      await p.click(`${M} #doseLogBtn`);
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg|Abd R lower"], "logged there");
      eq(await cardSites(tab), [THIGH[0], ABD[2], THIGH[1]], "on from it");
      eq([(await exportBackup(tab)).skipSites, await bugLine(tab, "- Sites skipped")], [null, "- Sites skipped: 0"], "forgotten");

      // Only the abdomen's left upper and the left arm on, the last dose at the arm: the abdomen's turn. Skipping its one
      // site gives the turn to the arm; the arm's site is then the last one left, so it can't be skipped.
      const two = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(two, gen.bosco({ lastDose: D(-7), sites: ["abd-l-upper", "arm-l"], doseSites: ["arm-l"] }));
      await two.page.click(`${M} #doseSnoozeBtn`);
      eq(await cardSites(two), [ABD[0], ARM[0], ABD[0]], "the two parts take turns");
      await devPanel(two, true);
      await two.page.click("#boscoSkipBtn");
      eq(await devSites(two), { next: `Next dose: ${ARM[0]}`, skipped: `Skipped: ${ABD[0]}.`, skip: false, undo: true }, "the arm's turn; no more skips");
      eq(await cardSites(two), [ARM[0], ABD[0], ARM[0]], "the cards");
    }
  },
  {
    name: "bosco doses: on a phone; an older backup keeps your sites, a damaged one is cleaned; every site off; asked once more; sync's combine",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: PHONE }), p = tab.page;
      eq(await grid(tab), [11, 2], "two to a row on a phone: 2 + 6 + 2 + 1 rows");

      // An older backup (no sites): the default rotation. Not yet for now.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq(await cardSites(tab), [ABD[0], THIGH[0], ABD[1]], "the default rotation");
      await p.click(`${M} #doseSnoozeBtn`);

      // A damaged one: unknown and repeated sites dropped (the rest in SITES' order), a site from a newer version kept as
      // it is (no part here, so the rotation starts at the first part on), a broken one dropped, and one on a weigh-in
      // without a dose dropped; skips that aren't sites dropped.
      const damaged = { ...gen.bosco({ lastDose: D(-7), sites: ["thigh-r-front-upper", "nope", "abd-r-lower", "thigh-r-front-upper", 5, null] }), skipSites: ["nope", 3] };
      damaged.entries.find(e => e.date === D(-7)).site = "hip-l";
      damaged.entries.find(e => e.date === D(-14)).site = "<b>abd-l</b>";
      damaged.entries.push({ date: D(-1), weight: 190, doseMg: null, medication: null, site: "abd-l" });
      await importBackup(tab, damaged);
      eq(await sitesOn(tab), ["abd-r-lower", "thigh-r-front-upper"], "start-up info: the two sites kept");
      eq(await cardSites(tab), [ABD[1], THIGH[3], ABD[1]], "from the first part on (hip-l isn't a site here)");
      eq((await history(tab)).slice(0, 3).map(r => r[1]), ["—", "5 mg|hip-l", "5 mg"], "History");
      let backup = await exportBackup(tab);
      eq([backup.sites, backup.skipSites], [["abd-r-lower", "thigh-r-front-upper"], null], "cleaned sites and skips");
      eq([entrySite(backup, D(-1)), entrySite(backup, D(-7)), entrySite(backup, D(-14))], [null, "hip-l", null], "cleaned doses' sites");

      // The older backup again: your sites stay.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq((await exportBackup(tab)).sites, ["abd-r-lower", "thigh-r-front-upper"], "kept");

      // Every site off: no site on the cards or in the pop-up, and a dose logged has none.
      await tapSite(tab, "abd-r-lower");
      await tapSite(tab, "thigh-r-front-upper");
      await saveStartup(tab);
      eq(await cardSites(tab), ["", "", ""], "no sites on the cards");
      eq(await bugLine(tab), "- Injection sites on: 0", "none on");
      await p.click(`${M} #upcomingDosesGrid button[data-confirm-dose]`);
      eq([(await popup(tab)).open, (await popup(tab)).shown], [true, false], "the pop-up without a site");
      await p.click(`${M} #doseLogBtn`);
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg"], "logged without a site");
      backup = await exportBackup(tab);
      eq([backup.sites, entrySite(backup, TODAY)], [[], null], "exported: sites off");

      // A device updated from before the sites by body part asks once more; once saved, it doesn't.
      await p.evaluate(() => { const A = Kyoshi.apps.bosco, pr = A.store.json("profile"); pr.dosingAsked = 3; A.store.set("profile", JSON.stringify(pr)); });
      const reload = async () => { await p.reload(); await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started); };
      await reload();
      eq(await startupShown(tab), [true, true], "asked once more");
      eq(await sitesOn(tab), [], "with every site off, as saved");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "saved");
      await reload();
      eq(await startupShown(tab), [false, false], "not asked again");

      // Folder sync: a newer save from another device brings its sites and a dose's site; then its skip; a copy older
      // than sites and skips (no sites, no dose sites, no skips) changes nothing; a newer save without skips (its dose
      // logged) forgets them.
      const combine = (edit, newer = true) => p.evaluate(([how, mineFirst]) => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
        if (how === "arms") { raw.sites = ["arm-l", "arm-r"]; raw.entries[raw.entries.length - 1].site = "arm-l"; }
        if (how === "skip") raw.skipSites = ["arm-r"];
        if (how === "older") { delete raw.sites; delete raw.skipSites; delete raw.asked; raw.entries.forEach(e => delete e.site); }
        if (how === "logged") raw.skipSites = null;
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: mineFirst ? "1" : "3", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return changed;
      }, [edit, newer]);
      eq(await combine("arms"), true, "the newer save combined");
      eq(await cardSites(tab), [ARM[1], ARM[0], ARM[1]], "its sites, on from its dose's");
      eq((await history(tab))[0], ["Sep 30, 2026", "5 mg|Upper arm L"], "its dose's site");
      eq(await combine("skip"), true, "a newer save's skip");
      eq(await cardSites(tab), [ARM[0], ARM[1], ARM[0]], "the next dose passes over the right arm");
      eq(await combine("older"), false, "an older copy, even saved later, changes nothing");
      eq(await combine("older", false), false, "nor saved earlier");
      backup = await exportBackup(tab);
      eq([backup.sites, backup.skipSites, entrySite(backup, TODAY)], [["arm-l", "arm-r"], ["arm-r"], "arm-l"], "kept");
      eq(await combine("logged"), true, "a newer save without skips");
      eq(await cardSites(tab), [ARM[1], ARM[0], ARM[1]], "forgotten");
      has(await p.locator(`${M} #upcomingDosesSection`).innerText(), ARM[1], "shown on a phone");
      lacks(await p.locator(`${M} #upcomingDosesSection`).innerText(), "Abdomen", "nothing off");
    }
  },
  {
    name: "bosco doses: start-up info answered on one device isn't asked on another (Export and Import, sync's combine); an older or unanswered save leaves the answers; a damaged one is cleaned",
    async run(t) {
      // Sync's combine of this device's own save with its answers set (or none: a copy from before them); [same, changed].
      const combine = (tab, asked, replace = false) => tab.page.evaluate(([how, whole]) => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
        if (how) raw.asked = how; else delete raw.asked;
        const c = A.data.combine(raw, { replace: whole, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return [c.same, changed];
      }, [asked, replace]);

      // A computer with a weigh-in and no dose yet: start-up info asks it all. Answered: Semaglutide, the buttocks on too.
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }] }));
      eq(await startupShown(tab), [true, true], "start-up info asks");
      eq(await bugLine(tab, "- Start-up asked"), "- Start-up asked: medication no, dosing v0", "nothing answered yet");
      await p.click(`${M} #oneTimeInput_medication button[data-value="semaglutide"]`);
      for (const id of ["glute-l-upper", "glute-r-lower", "glute-l-lower", "glute-r-upper"]) await tapSite(tab, id);
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "answered");
      const backup = await exportBackup(tab);
      eq([backup.asked, backup.medication, backup.sites.length], [{ medication: true, dosing: 4 }, "semaglutide", 20], "Export carries the answers");

      // A phone importing it isn't asked: the answers came with the data, Semaglutide with them (no dose shows it yet).
      const phone = await open(t, { app: "bosco", size: PHONE });
      eq(await startupShown(phone), [true, true], "a new phone asks");
      await importBackup(phone, backup);
      eq(await startupShown(phone), [false, false], "not after the import");
      eq([await bugLine(phone, "- GLP-1"), await bugLine(phone, "- Start-up asked")], ["- GLP-1 medication: semaglutide", "- Start-up asked: medication yes, dosing v4"], "its answers");
      eq((await exportBackup(phone)).asked, { medication: true, dosing: 4 }, "its Export carries them");

      // A backup from before the answers traveled, and one that answered nothing, leave them as they are.
      await importBackup(phone, gen.bosco());
      eq(await startupShown(phone), [false, false], "an older backup: still answered");
      await importBackup(phone, { ...gen.bosco(), asked: { medication: false, dosing: 0 } });
      eq(await startupShown(phone), [false, false], "one that answered nothing: still answered");
      eq(await bugLine(phone, "- GLP-1"), "- GLP-1 medication: semaglutide", "the answer kept over the backup's doses");
      // So does sync: a copy from before (and this device saves its answers back for it), or one taken whole that answered nothing.
      eq(await combine(phone, null), [false, false], "a copy from before changes nothing");
      eq(await combine(phone, { medication: false, dosing: 0 }, true), [false, false], "nor one taken whole");
      eq((await exportBackup(phone)).asked, { medication: true, dosing: 4 }, "kept");

      // A damaged file's answers are cleaned: nothing counts as asked, and its medication isn't taken.
      const third = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(third, { ...gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }] }), medication: "semaglutide", asked: { medication: "yes", dosing: 4.5 } });
      eq(await startupShown(third), [true, true], "still asked");
      eq([(await exportBackup(third)).asked, await bugLine(third, "- GLP-1")], [{ medication: false, dosing: 0 }, "- GLP-1 medication: tirzepatide"], "cleaned");
      // Sync's combine with a save that answered them answers them here; a later version's answers count too.
      eq(await combine(third, { medication: true, dosing: 4 }), [true, true], "combined");
      eq(await startupShown(third), [true, false], "the dosing questions answered (your name still asked)");
      eq(await bugLine(third, "- Start-up asked"), "- Start-up asked: medication yes, dosing v4", "both answered");
      eq(await combine(third, { medication: true, dosing: 5 }), [true, true], "a later version's");
      eq([await startupShown(third), (await exportBackup(third)).asked], [[true, false], { medication: true, dosing: 5 }], "answered, the version kept");
    }
  }
];
