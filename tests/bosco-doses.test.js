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
 * answered on one device, not asked on another (Export and Import, sync's combine), the medication's answer with them
 * (None too, never undone by the doses from before it); an older or unanswered save never takes them back, nor saves
 * back and forth over two answers; a later version's counts; a damaged one is cleaned, and a medication this version
 * doesn't know answers nothing (a dose may answer the medication, then the dosing questions are asked). */
"use strict";
const { DESKTOP, PHONE, TODAY, eq, has, lacks, open, devPanel, importBackup, exportBackup } = require("./lib");
const { M, D, history, cardSites, dosePopup: popup, startupShown, saveStartup, bugLine, reload, saved, combine } = require("./bosco");
const gen = require("./generate");

const ABD = ["Abdomen · left, upper", "Abdomen · right, lower", "Abdomen · left, lower", "Abdomen · right, upper"];
const THIGH = ["Thigh · left front, upper", "Thigh · right outer, middle", "Thigh · left outer, lower", "Thigh · right front, upper",
  "Thigh · left front, middle", "Thigh · right outer, lower", "Thigh · left outer, upper", "Thigh · right front, middle",
  "Thigh · left front, lower", "Thigh · right outer, upper", "Thigh · left outer, middle", "Thigh · right front, lower"];
const GLUTE = ["Buttock · left, upper", "Buttock · right, lower", "Buttock · left, lower", "Buttock · right, upper"];
const ARM = ["Upper arm · left", "Upper arm · right"];
const THIGH_IDS = ["thigh-l-front-upper", "thigh-r-side-middle", "thigh-l-side-lower", "thigh-r-front-upper", "thigh-l-front-middle", "thigh-r-side-lower",
  "thigh-l-side-upper", "thigh-r-front-middle", "thigh-l-front-lower", "thigh-r-side-upper", "thigh-l-side-middle", "thigh-r-front-lower"];
// Start-up info's buttons, by body part: the X's short words.
const PILLS = ["L upper", "R lower", "L lower", "R upper", "L front upper", "R outer middle", "L outer lower", "R front upper", "L front middle", "R outer lower",
  "L outer upper", "R front middle", "L front lower", "R outer upper", "L outer middle", "R front lower", "L upper", "R lower", "L lower", "R upper", "L", "R"];

// Start-up info's site buttons, [text, on]; the ids of those on; the parts' headings; and how they're laid out (rows × columns).
const buttons = tab => tab.page.$$eval(`${M} #sitePills button`, bs => bs.map(b => [b.textContent, b.classList.contains("active") && b.getAttribute("aria-pressed") === "true"]));
const sitesOn = tab => tab.page.$$eval(`${M} #sitePills button.active`, bs => bs.map(b => b.dataset.site));
const headings = tab => tab.page.$$eval(`${M} #sitePills .site-part-head`, hs => hs.map(h => h.textContent));
const grid = tab => tab.page.$$eval(`${M} #sitePills button`, bs => {
  const boxes = bs.map(b => b.getBoundingClientRect());
  return [new Set(boxes.map(r => Math.round(r.top))).size, new Set(boxes.map(r => Math.round(r.left))).size];
});
const tapSite = (tab, id) => tab.page.click(`${M} #sitePills button[data-site="${id}"]`);
const sitesLine = tab => bugLine(tab, "- Injection sites");
const entrySite = (backup, date) => backup.entries.find(e => e.date === date).site;
// Developer Mode's injection site tools (open): the next dose's line, the skipped line, and whether Skip is enabled and Undo shown.
const devSites = tab => tab.page.evaluate(() => {
  const box = document.querySelector("#boscoSkipBtn").closest(".dev-block"), skipped = [...box.querySelectorAll(".dev-hint")].find(h => h.textContent.startsWith("Skipped"));
  return { next: box.querySelector(".dev-block-head").textContent, skipped: skipped ? skipped.textContent : "", skip: !document.querySelector("#boscoSkipBtn").disabled, undo: !!document.querySelector("#boscoUnskipBtn") };
});
// A save that answered the medication question with `medication` and the dosing questions' version `dosing` (for combine).
const answered = (medication, dosing = 4) => raw => { raw.asked = { medication: true, dosing }; raw.medication = medication; };
// Two devices at once (their own profiles), on Bosco.
const two = (t, size = DESKTOP) => Promise.all([open(t, { app: "bosco", size }), open(t, { app: "bosco", size })]);

module.exports = [
  {
    name: "bosco doses: each upcoming dose has the next site on; a site picked in the pop-up is logged, the rotation goes on from it; start-up info, export, import",
    async run(t) {
      const [tab, other] = await two(t), p = tab.page;
      // Start-up info's 22 sites, a group per body part, four to a row, the abdomen and thighs on.
      eq(await headings(tab), ["Abdomen", "Thighs", "Buttocks", "Upper arms"], "the body parts");
      eq(await buttons(tab), PILLS.map((b, i) => [b, i < 16]), "the sites, the abdomen and thighs on");
      eq(await grid(tab), [6, 4], "four to a row: 1 + 3 + 1 + 1 rows");
      eq(await sitesLine(tab), "- Injection sites on: 16 (default)", "the bug report's count");

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
      eq((await history(tab))[0], ["Sep 30", "5 mg|Abd R upper"], "History says where it went");
      // The thighs' turn; the abdomen then goes on from the site used, starting over after its last (not from the planned one).
      eq(await cardSites(tab), [THIGH[0], ABD[0], THIGH[1]], "on from Abd R upper");

      // Start-up info (it asks about the sites): the abdomen off. Only the thighs take turns.
      eq(await startupShown(tab), [true, true], "start-up info asks");
      for (const id of ["abd-l-upper", "abd-r-lower", "abd-l-lower", "abd-r-upper"]) await tapSite(tab, id);
      eq((await buttons(tab)).slice(0, 5), [["L upper", false], ["R lower", false], ["L lower", false], ["R upper", false], ["L front upper", true]], "toggled off");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "answered");
      eq(await cardSites(tab), THIGH.slice(0, 3), "the abdomen left out");
      eq(await sitesLine(tab), "- Injection sites on: 12", "12 on");

      // Export keeps the sites on and where each dose went.
      const backup = await exportBackup(tab);
      eq(backup.schemaVersion, 4, "still schema 4");
      eq([backup.sites, backup.skipSites], [THIGH_IDS, null], "the sites on, none skipped");
      eq([entrySite(backup, TODAY), entrySite(backup, D(-7))], ["abd-r-upper", null], "each dose's site");

      // Momo's board leaves the site out of a dose's note.
      const notes = await p.evaluate(([from, to]) => Kyoshi.agenda(from, to).filter(e => e.app === "bosco").map(e => e.note), [D(-7), D(14)]);
      eq(notes, ["5 mg", "5 mg", "5 mg", "5 mg"], "Momo's notes");

      // Another device: the backup brings the sites and the doses' sites with it.
      await importBackup(other, backup);
      eq((await buttons(other)).map(b => b[1]), PILLS.map((b, i) => i >= 4 && i < 16), "its start-up info: the thighs on");
      eq(await cardSites(other), THIGH.slice(0, 3), "the same doses' sites");
      eq((await history(other))[0], ["Sep 30", "5 mg|Abd R upper"], "the same History");

      // A week on (time travel; its pop-up then covers Developer Mode's badge): the next dose comes due at its
      // site; logged, the next ones follow it.
      await other.page.evaluate(() => Kyoshi.dev.travel(7));
      pop = await popup(other);
      eq([pop.open, pop.picked, pop.groups], [true, THIGH[0], [["Thighs", THIGH], ["Other", ABD.concat(GLUTE, ARM)]]], "the pop-up a week on");
      await other.page.click(`${M} #doseLogBtn`);
      eq((await history(other))[0], ["Oct 7", "5 mg|Thigh L front upper"], "logged at the planned site");
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
      eq(logged, ["Abd L upper", "Thigh L front upper", "Abd R lower", "Thigh R outer middle", "Abd L lower", "Thigh L outer lower", "Abd R upper",
        "Thigh R front upper", "Abd L upper", "Thigh L front middle"], "the abdomen starting over every fourth of its turns, the thighs going on");
      eq(await cardSites(tab), [ABD[1], THIGH[5], ABD[2]], "the next ones");

      // Start-up info: the buttocks on. Their turn comes after the thigh's, starting at their first site.
      eq(await startupShown(tab), [true, true], "start-up info asks");
      for (const id of ["glute-l-upper", "glute-r-lower", "glute-l-lower", "glute-r-upper"]) await tapSite(tab, id);
      await saveStartup(tab);
      eq(await cardSites(tab), [GLUTE[0], ABD[1], THIGH[5]], "buttock, abdomen, thigh");
      eq(await sitesLine(tab), "- Injection sites on: 20", "20 on");
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
      await reload(tab);
      eq(await sitesOn(tab), ["abd-r-lower", "abd-r-upper", "glute-l-upper", "glute-l-lower", "arm-r"], "both heights of each, the arm as it was");
    }
  },
  {
    name: "bosco doses: Developer Mode skips the next dose's site within its body part, again, and undoes it; a logged dose forgets the skips; a part all skipped gives its turn",
    async run(t) {
      const [tab, other] = await two(t), p = tab.page;
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
      eq((await history(tab))[0], ["Sep 30", "5 mg|Abd R lower"], "logged there");
      eq(await cardSites(tab), [THIGH[0], ABD[2], THIGH[1]], "on from it");
      eq([(await saved(tab)).skipSites, await bugLine(tab, "- Sites skipped")], [null, "- Sites skipped: 0"], "forgotten");

      // Only the abdomen's left upper and the left arm on, the last dose at the arm: the abdomen's turn. Skipping its one
      // site gives the turn to the arm; the arm's site is then the last one left, so it can't be skipped.
      await importBackup(other, gen.bosco({ lastDose: D(-7), sites: ["abd-l-upper", "arm-l"], doseSites: ["arm-l"] }));
      await other.page.click(`${M} #doseSnoozeBtn`);
      eq(await cardSites(other), [ABD[0], ARM[0], ABD[0]], "the two parts take turns");
      await devPanel(other, true);
      await other.page.click("#boscoSkipBtn");
      eq(await devSites(other), { next: `Next dose: ${ARM[0]}`, skipped: `Skipped: ${ABD[0]}.`, skip: false, undo: true }, "the arm's turn; no more skips");
      eq(await cardSites(other), [ARM[0], ABD[0], ARM[0]], "the cards");
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
      eq((await saved(tab)).sites, ["abd-r-lower", "thigh-r-front-upper"], "kept");

      // Every site off: no site on the cards or in the pop-up, and a dose logged has none.
      await tapSite(tab, "abd-r-lower");
      await tapSite(tab, "thigh-r-front-upper");
      await saveStartup(tab);
      eq(await cardSites(tab), ["", "", ""], "no sites on the cards");
      eq(await sitesLine(tab), "- Injection sites on: 0", "none on");
      await p.click(`${M} #upcomingDosesGrid button[data-confirm-dose]`);
      eq([(await popup(tab)).open, (await popup(tab)).shown], [true, false], "the pop-up without a site");
      await p.click(`${M} #doseLogBtn`);
      eq((await history(tab))[0], ["Sep 30", "5 mg"], "logged without a site");
      backup = await saved(tab);
      eq([backup.sites, entrySite(backup, TODAY)], [[], null], "kept: sites off");

      // A device updated from before the sites by body part asks once more; once saved, it doesn't.
      await p.evaluate(() => { const A = Kyoshi.apps.bosco, pr = A.store.json("profile"); pr.dosingAsked = 3; A.store.set("profile", JSON.stringify(pr)); });
      await reload(tab);
      eq(await startupShown(tab), [true, true], "asked once more");
      eq(await sitesOn(tab), [], "with every site off, as saved");
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "saved");
      await reload(tab);
      eq(await startupShown(tab), [false, false], "not asked again");

      // Folder sync: a newer save from another device brings its sites and a dose's site; then its skip; a copy older
      // than sites and skips (no sites, no dose sites, no skips) changes nothing; a newer save without skips (its dose
      // logged) forgets them.
      const last = raw => raw.entries[raw.entries.length - 1];
      const arms = raw => { raw.sites = ["arm-l", "arm-r"]; last(raw).site = "arm-l"; };
      const older = raw => { delete raw.sites; delete raw.skipSites; delete raw.asked; raw.entries.forEach(e => delete e.site); };
      const changed = async (edit, opts) => (await combine(tab, edit, opts))[1];
      eq(await changed(arms), true, "the newer save combined");
      eq(await cardSites(tab), [ARM[1], ARM[0], ARM[1]], "its sites, on from its dose's");
      eq((await history(tab))[0], ["Sep 30", "5 mg|Upper arm L"], "its dose's site");
      eq(await changed(raw => { raw.skipSites = ["arm-r"]; }), true, "a newer save's skip");
      eq(await cardSites(tab), [ARM[0], ARM[1], ARM[0]], "the next dose passes over the right arm");
      eq(await changed(older), false, "an older copy, even saved later, changes nothing");
      eq(await changed(older, { mine: "3" }), false, "nor saved earlier");
      backup = await saved(tab);
      eq([backup.sites, backup.skipSites, entrySite(backup, TODAY)], [["arm-l", "arm-r"], ["arm-r"], "arm-l"], "kept");
      eq(await changed(raw => { raw.skipSites = null; }), true, "a newer save without skips");
      eq(await cardSites(tab), [ARM[1], ARM[0], ARM[1]], "forgotten");
      has(await p.locator(`${M} #upcomingDosesSection`).innerText(), ARM[1], "shown on a phone");
      lacks(await p.locator(`${M} #upcomingDosesSection`).innerText(), "Abdomen", "nothing off");
    }
  },
  {
    name: "bosco doses: start-up info answered on one device isn't asked on another (Export and Import, sync's combine); an older or unanswered backup or save leaves the answers",
    async run(t) {
      // A computer with a weigh-in and no dose yet: start-up info asks it all. Answered: Semaglutide, the buttocks on too.
      const [tab, phone] = await Promise.all([open(t, { app: "bosco", size: DESKTOP }), open(t, { app: "bosco", size: PHONE })]), p = tab.page;
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
      eq(await startupShown(phone), [true, true], "a new phone asks");
      await importBackup(phone, backup);
      eq(await startupShown(phone), [false, false], "not after the import");
      eq([await bugLine(phone, "- GLP-1"), await bugLine(phone, "- Start-up asked")], ["- GLP-1 medication: semaglutide", "- Start-up asked: medication yes, dosing v4"], "its answers");
      eq((await saved(phone)).asked, { medication: true, dosing: 4 }, "kept with its data");

      // A backup from before the answers traveled, and one that answered nothing, leave them as they are.
      await importBackup(phone, gen.bosco());
      eq(await startupShown(phone), [false, false], "an older backup: still answered");
      await importBackup(phone, { ...gen.bosco(), asked: { medication: false, dosing: 0 } });
      eq(await startupShown(phone), [false, false], "one that answered nothing: still answered");
      eq(await bugLine(phone, "- GLP-1"), "- GLP-1 medication: semaglutide", "the answer kept over the backup's doses");
      // So does sync: a copy from before (nothing to save back for it), one taken whole that answered nothing (this device's
      // answers go back to it), and one that answered Tirzepatide (the same as here, so nothing goes back and forth).
      eq(await combine(phone, raw => { delete raw.asked; }), [true, false], "a copy from before changes nothing");
      eq(await combine(phone, raw => { raw.asked = { medication: false, dosing: 0 }; }, { replace: true }), [false, false], "nor one taken whole that answered nothing");
      eq(await combine(phone, answered("tirzepatide")), [true, false], "nor one that answered another medication");
      eq([(await saved(phone)).asked, await bugLine(phone, "- GLP-1")], [{ medication: true, dosing: 4 }, "- GLP-1 medication: semaglutide"], "kept, Semaglutide too");
    }
  },
  {
    name: "bosco doses: a damaged file's answers are cleaned; a medication this version doesn't know answers nothing; a later version's counts; None travels",
    async run(t) {
      const [third, fourth, fifth, sixth] = await Promise.all([1, 2, 3, 4].map(() => open(t, { app: "bosco", size: DESKTOP })));
      // A damaged file's answers are cleaned: nothing counts as asked, and its medication isn't taken.
      await importBackup(third, { ...gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }] }), medication: "semaglutide", asked: { medication: "yes", dosing: 4.5 } });
      eq(await startupShown(third), [true, true], "still asked");
      eq([(await saved(third)).asked, await bugLine(third, "- GLP-1")], [{ medication: false, dosing: 0 }, "- GLP-1 medication: tirzepatide"], "cleaned");
      // Sync's combine: a save that answered a medication this version doesn't know takes nothing here (the dosing
      // questions still come with its question) and needs nothing back; one that answered Semaglutide answers both, with
      // Semaglutide; then a later version's dosing answer counts, whatever medication it came with.
      eq((await combine(third, answered("orforglipron")))[0], true, "an unknown medication: nothing to save back");
      eq([await startupShown(third), await bugLine(third, "- Start-up asked")], [[true, true], "- Start-up asked: medication no, dosing v0"], "still asked, the dosing questions with it");
      eq(await combine(third, answered("semaglutide")), [true, true], "combined");
      eq(await startupShown(third), [true, false], "the dosing questions answered (your name still asked)");
      eq([await bugLine(third, "- GLP-1"), await bugLine(third, "- Start-up asked")], ["- GLP-1 medication: semaglutide", "- Start-up asked: medication yes, dosing v4"], "both answered");
      eq(await combine(third, answered("orforglipron", 5)), [true, true], "a later version's, with a medication unknown here");
      eq([await startupShown(third), (await saved(third)).asked, await bugLine(third, "- GLP-1")], [[true, false], { medication: true, dosing: 5 }, "- GLP-1 medication: semaglutide"],
        "answered, the version kept, Semaglutide too");

      // A new device given a save whole that answered None takes None.
      await importBackup(fourth, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }] }));
      eq(await combine(fourth, answered("none"), { replace: true }), [true, true], "taken whole");
      eq([await startupShown(fourth), await bugLine(fourth, "- GLP-1")], [[true, false], "- GLP-1 medication: none"], "None taken, the dosing questions answered");
      // Imported on new devices: a backup that answered None, its doses from before, gives None (no dose's medication over
      // it); one that answered a medication this version doesn't know, with doses, has the last dose's medication answer
      // it here, and the dosing questions are asked (not this device's answer to stand on).
      await importBackup(fifth, { ...gen.bosco(), medication: "none", asked: { medication: true, dosing: 4 } });
      eq([await startupShown(fifth), await bugLine(fifth, "- GLP-1")], [[true, false], "- GLP-1 medication: none"], "None, over the doses");
      await importBackup(sixth, { ...gen.bosco(), medication: "orforglipron", asked: { medication: true, dosing: 4 } });
      eq([await startupShown(sixth), await bugLine(sixth, "- GLP-1")], [[true, true], "- GLP-1 medication: tirzepatide"], "the last dose's medication, the dosing questions asked");
    }
  }
];
