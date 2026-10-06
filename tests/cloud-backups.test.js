/* Kyoshi · tests/cloud-backups.test.js — the cloud's daily backups (2026-10-06 feedback batch, Phase 6), against the fake
 * GitHub (tests/cloud.js): a dated folder a day beside the constant sync (each app's data/ file as it is, all.json: an
 * Export all file, locked; one commit; once a day, a phone the same day making none; the last 8 days kept; Back up now;
 * GitHub refusing it when another device saved meanwhile, made at the next check), Restore a day… (the app on screen or
 * every app, through the ordinary import and its question; the sync carrying it to the phone; a day with nothing for the
 * app), and the cloud's encrypted files imported as they are (Import JSON, Import all; no key, another key: refused),
 * and tools/decrypt.html handing all.json back as an Export all file. Made-up data only. */
"use strict";
const fs = require("fs");
const path = require("path");
const { ROOT, TODAY, DESKTOP, PHONE, eq, ok, has, lacks, at, addDays, open, devPanel, importBackup, switchTo, lastDialog, text } = require("./lib");
const gen = require("./generate");
const hk = require("./hawky");
const cl = require("./cloud");

const D = TODAY; // the day the cloud is set up
const ERRANDS = gen.ERRANDS.slice(0, 3).map(([text, minutes]) => ({ text, minutes }));
const TEXTS = ERRANDS.map(e => e.text).sort();
const REPORT = "Lists could say when they unlock";
const OTHER = "tester/kyoshi-other-test"; // another (empty) repository, for a device holding a key of the same secret

const errands = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.items.filter(i => !i.deleted).map(i => i.text).sort());
const baseline = tab => tab.page.evaluate(() => [...new Set(Kyoshi.apps.momo.S.data.baseline.cards.filter(c => !c.slot && !c.auto).map(c => c.title))]);
const reports = tab => tab.page.evaluate(() => Kyoshi.record.live().map(r => r.description));
// The backups' days (oldest first), a day's files, and each commit of a history (newest first) as what made it.
const days = fake => [...new Set(fake.paths().filter(p => p.startsWith("backups/")).map(p => p.split("/")[1]))];
const names = (fake, day) => fake.paths().filter(p => p.startsWith(`backups/${day}/`)).map(p => p.split("/")[2]);
const kinds = list => list.map(c => (/^Kyoshi: daily backup /.test(c.message) ? "backup" : /^Kyoshi: trimmed /.test(c.message) ? "trim" : "save"));
const backupShas = fake => Object.fromEntries([...fake.files].filter(([p]) => p.startsWith("backups/")).map(([p, f]) => [p, f.sha]));
const backupsLine = tab => tab.page.evaluate(() => { const el = document.getElementById("kDevCloudBackups"); return el.hidden ? "" : el.textContent; });
const status = tab => tab.page.evaluate(() => { const el = document.getElementById("kCloudStatus"); return [el.textContent, el.className.replace("modal-status", "").trim()]; });
const until = async (check, what) => {
  for (let i = 0; i < 250; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 20)); }
  throw new Error(`${what}: not within 5s`);
};

// Import all (Developer Mode), picking a file made from data (an object, or text as it is); its question answered yes.
async function importAll(tab, data, name = "all.json") {
  const was = await devPanel(tab, true);
  const [chooser] = await Promise.all([tab.page.waitForEvent("filechooser"), tab.page.click("#kDevImportAll")]);
  await chooser.setFiles({ name, mimeType: "application/json", buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)) });
  await tab.page.waitForTimeout(300);
  await devPanel(tab, was);
}
// A bug report filed through Bugs & requests (the hidden Kyoshi app's log).
async function fileReport(tab, words) {
  const p = tab.page;
  await p.click("#kReportBug");
  await p.fill("#kBugText", words);
  await p.click("#kBugSubmit");
  await p.locator("#kBugStatus", { hasText: "Saved" }).waitFor({ timeout: 5000 });
  await p.click("#kBugOverlay .modal-close");
}
// A computer with three of Hawky's errands, Momo's baseline (Gym) and, with report, a bug report, that sets the cloud up
// on day D: { fake, computer, key, secret }.
async function computerWithCloud(t, { report = false } = {}) {
  const fake = cl.fakeGithub(), computer = await open(t, { app: "hawky", size: DESKTOP });
  await fake.route(computer.ctx, "computer");
  await importAll(computer, gen.exportAll({ hawky: gen.hawkyItems(ERRANDS), momo: gen.momoWorld({ baseline: [{ title: "Gym", hours: 1, days: [0, 2, 4] }] }) }));
  if (report) await fileReport(computer, REPORT);
  computer.dialogs.length = 0;
  const { key, refused } = await cl.setUp(computer);
  eq(refused, "", "Set up a new cloud… went through");
  return { fake, computer, key, secret: cl.secretOf(key) };
}
// A phone on the same cloud, the key entered.
async function phoneWith(t, fake, key) {
  const phone = await open(t, { app: "hawky", size: PHONE });
  await fake.route(phone.ctx, "phone");
  eq(await cl.enterKey(phone, key), "", "the phone took the key");
  return phone;
}
// The device's clock (and GitHub's) moved on to a day's 07:00 (no timers fired on the way), then Sync now.
async function onDay(fake, tab, day) {
  fake.now = at(day);
  await tab.page.clock.setSystemTime(at(day));
  await cl.syncNow(tab);
}
// Restore a day… opened in Developer Mode, its days listed: [value, words] of each.
async function restoreDays(tab) {
  const p = tab.page;
  await devPanel(tab, true);
  await p.click("#kDevCloudRestore");
  await p.waitForFunction(() => !document.getElementById("kCloudDay").disabled || /No backups/.test(document.getElementById("kCloudDay").textContent));
  return p.$$eval("#kCloudDay option", els => els.map(o => [o.value, o.textContent]));
}
// Picks a day and presses Restore <app> (or, all, Restore every app); waits for the outcome: [words, "good" | "bad" | ""].
async function restore(tab, day, all = false) {
  const p = tab.page;
  await p.selectOption("#kCloudDay", day);
  await p.click(all ? "#kCloudGoAll" : "#kCloudGo");
  await p.waitForFunction(() => /^(Restored|Nothing)|backup has nothing/.test(document.getElementById("kCloudStatus").textContent));
  return status(tab);
}

module.exports = [
  {
    name: "cloud backups: a dated folder a day beside the constant sync — each app's file as it is, all.json; one commit, once a day (a phone the same day makes none); the last 8 days kept; Back up now; refused, then made at the next check",
    async run(t) {
      const { fake, computer, key, secret } = await computerWithCloud(t, { report: true }), p = computer.page;
      // The day's folder: each app's data/ file, the very same blob, and all.json, in one commit on top of the saves.
      eq(names(fake, D), ["all.json", "hawky.json", "kyoshi.json", "momo.json"], "today's folder: each app's file, and all.json");
      for (const id of ["hawky", "momo", "kyoshi"]) eq(fake.files.get(`backups/${D}/${id}.json`).sha, fake.files.get(`data/${id}.json`).sha, `${id}.json: the very file data/ holds`);
      const envelope = fake.text(`backups/${D}/all.json`), all = cl.decryptInNode(envelope, secret);
      eq(JSON.parse(envelope).app, "all", "all.json's envelope says it holds every app");
      TEXTS.forEach(w => lacks(envelope, w, "no errand's words readable in it"));
      eq([all.cloud, Object.keys(all.apps).sort()], [true, ["hawky", "kyoshi", "momo"]], "decrypted: an Export all file of every app with data");
      eq([all.apps.hawky.items.map(i => i.text).sort(), all.apps.kyoshi.bugReports.map(r => r.description)], [TEXTS, [REPORT]], "with Hawky's errands and the bug log inside");
      eq(kinds(fake.history()), ["backup", "save", "save", "save", "save"], "one commit, on top of KYOSHI.md's and each app's");
      eq(fake.history()[0].message, `Kyoshi: daily backup ${D}`, "named by its day");
      eq(fake.odd, 0, "nothing else asked of GitHub");
      has(await backupsLine(computer), "Daily backups: the last 8 days, in backups/ in the repository; today's is in (7:0", "the block says today's is in, and when");

      // The constant sync as before: a change goes up within the usual delay, into data/; the day's folder stays.
      const folder = backupShas(fake), puts = fake.puts;
      await hk.addErrand(computer, "Buy stamps");
      await p.clock.runFor(16000);
      await cl.settled(computer);
      eq(fake.puts, puts + 1, "a change still goes up on its own, once");
      ok(cl.decryptInNode(fake.text("data/hawky.json"), secret).items.some(i => i.text === "Buy stamps"), "into data/hawky.json");
      eq(backupShas(fake), folder, "the day's folder stays as it was");
      // Another check the same day makes nothing; nor does a phone, which finds the folder.
      const made = fake.made;
      await cl.syncNow(computer);
      const phone = await phoneWith(t, fake, key);
      eq(fake.made, made, "another check, and a phone the same day: no new commit");
      has(await backupsLine(phone), "today's is in.", "the phone says today's is in (made elsewhere)");

      // The next day: Sync now makes a second folder; those older than the 7 days before it leave in its commit.
      const N = addDays(D, 1), stray = Buffer.from(cl.encryptInNode({ items: [] }, "hawky", secret));
      for (const d of [addDays(N, -9), addDays(N, -8), addDays(N, -7)]) fake.plant(`backups/${d}/hawky.json`, stray);
      await onDay(fake, computer, N);
      eq(days(fake), [addDays(N, -7), D, N], "a second folder; those 9 and 8 days before it gone, 7 days before it kept");
      eq(names(fake, N), ["all.json", "hawky.json", "kyoshi.json", "momo.json"], "the new day's files");
      ok(cl.decryptInNode(fake.text(`backups/${N}/hawky.json`), secret).items.some(i => i.text === "Buy stamps"), "as data/ held them that day");
      eq(kinds(fake.history().slice(0, 1)), ["backup"], "in one commit");
      // Back up now, today's in: nothing made.
      const madeN = fake.made;
      await devPanel(computer, true);
      await p.click("#kDevCloudBackup");
      await p.waitForFunction(() => /already there/.test(document.getElementById("kDevCloudSaid").textContent));
      eq([await text(computer, "#kDevCloudSaid"), fake.made], ["Today's backup is already there.", madeN], "Back up now: today's is already there");
      await devPanel(computer, false);

      // The day after, the phone saves while the computer's backup is on its way (between reading the branch and moving
      // it): GitHub refuses to move it on (the head moved), nothing is recorded, and the next check makes it.
      const N2 = addDays(N, 1);
      await hk.addErrand(phone, "Water the plants");
      const releaseSave = fake.hold("phone", "save");
      await phone.page.evaluate(() => Kyoshi.cloud.syncNow());
      await until(() => fake.held === 1, "the phone's save reached GitHub");
      fake.now = at(N2);
      await p.clock.setSystemTime(at(N2));
      const releaseTree = fake.hold("computer", "tree");
      await p.evaluate(() => Kyoshi.cloud.syncNow());
      await until(() => fake.held === 2, "the computer's backup reached GitHub");
      releaseSave();
      await cl.settled(phone);
      releaseTree();
      eq(await p.evaluate(() => Kyoshi.cloud.backedUp()), "stopped (invalid)", "GitHub refused it: another save moved the branch meanwhile");
      eq(days(fake).includes(N2), false, "no folder for the day yet");
      has(await backupsLine(computer), "today's hasn't been made yet: it's made after a check gets through.", "the block says so");
      await cl.syncNow(computer);
      eq(names(fake, N2), ["all.json", "hawky.json", "kyoshi.json", "momo.json"], "the next check made it");
      ok(cl.decryptInNode(fake.text(`backups/${N2}/hawky.json`), secret).items.some(i => i.text === "Water the plants"), "with the phone's save in it");
      ok(fake.paths().every(x => x === "KYOSHI.md" || /^data\/[a-z][a-z0-9]*\.json$/.test(x) || /^backups\/\d{4}-\d{2}-\d{2}\/[a-z0-9]+\.json$/.test(x)), `only text files where they belong (${fake.paths()})`);
      eq(fake.odd, 0, "nothing else asked of GitHub");
    }
  },
  {
    name: "cloud backups: Restore a day… brings the app on screen back as it was (its question names the day) and the sync carries it to the phone; Restore every app asks once; a day with nothing for the app says so",
    async run(t) {
      const { fake, computer, key, secret } = await computerWithCloud(t, { report: true }), p = computer.page;
      const phone = await phoneWith(t, fake, key);
      // The next day the computer deletes two errands and adds one, Momo's baseline changes and another report is filed,
      // then Back up now: a check (the changes go up), and the day's backup made with them.
      const N = addDays(D, 1);
      fake.now = at(N);
      await p.clock.setSystemTime(at(N));
      for (const id of ["hk0000", "hk0001"]) {
        await p.click(`#kMount .errand[data-id="${id}"] .errand-text`);
        await p.click("#kMount #errandDeleteBtn");
      }
      await hk.addErrand(computer, "Fix the gate");
      await switchTo(computer, "momo");
      await importBackup(computer, gen.momoWorld({ baseline: [{ title: "Swim", hours: 1, days: [1] }] }));
      await switchTo(computer, "hawky");
      await fileReport(computer, "Store colours could be brighter");
      await devPanel(computer, true);
      await p.click("#kDevCloudBackup");
      await p.waitForFunction(() => /^Backed up/.test(document.getElementById("kDevCloudSaid").textContent));
      eq(await text(computer, "#kDevCloudSaid"), `Backed up 3 apps into backups/${N}.`, "Back up now: the day's backup made");
      await devPanel(computer, false);
      await cl.syncNow(phone);
      const changed = ["Buy a birthday card", "Fix the gate"];
      eq([await errands(computer), await errands(phone)], [changed, changed], "the day's changes on both");
      eq(days(fake), [D, addDays(D, 1)], "two days of backups");

      // Restore a day…: both days, newest first; Sep 30, Restore Hawky: its question names that day, then Hawky is as it
      // was, and nothing else changes.
      eq(await restoreDays(computer), [[N, "Thu, Oct 1"], [D, "Wed, Sep 30"]], "Restore a day… lists both days, newest first");
      eq(await text(computer, "#kCloudGo"), "Restore Hawky", "its button names the app on screen");
      computer.dialogs.length = 0;
      eq(await restore(computer, D), ["Restored Hawky from Sep 30's backup.", "good"], "the pop-up says it's done");
      const asked = lastDialog(computer);
      has(asked, "Replace your 2 errands with the 3 errands in this backup?", "Hawky's own question");
      has(asked, "This backup is from Sep 30, 2026", "naming the backup's day");
      eq(await errands(computer), TEXTS, "Hawky's errands as they were that day");
      eq([await baseline(computer), (await reports(computer)).length], [["Swim"], 2], "Momo and the bug log untouched");
      await p.click("#kCloudCancel");

      // The restore is a change like any: the next check saves it over data/hawky.json, and the phone takes it.
      await cl.syncNow(computer);
      eq(cl.decryptInNode(fake.text("data/hawky.json"), secret).items.filter(i => !i.deleted).map(i => i.text).sort(), TEXTS, "the cloud's Hawky is the restored one");
      await cl.syncNow(phone);
      eq(await errands(phone), TEXTS, "and the phone's list matches that day");

      // Restore every app from Sep 30: one question naming them all, then every app as it was.
      await restoreDays(computer);
      computer.dialogs.length = 0;
      eq(await restore(computer, D, true), ["Restored every app from Sep 30's backup.", "good"], "every app restored");
      eq(computer.dialogs.length, 1, "after one question");
      has(computer.dialogs[0][1], "Replace everything in Momo, Hawky and Kyoshi with this backup?", "naming every app in the backup");
      eq([await baseline(computer), await reports(computer), await errands(computer)], [["Gym"], [REPORT], TEXTS], "Momo, the bug log and Hawky as they were");
      // A question answered no changes nothing.
      computer.answers.push(false);
      eq(await restore(computer, N, true), ["Nothing was restored.", ""], "a question answered no: nothing restored");
      eq(await baseline(computer), ["Gym"], "nothing changed");
      await p.click("#kCloudCancel");

      // A day with nothing for the app on screen (Appa has no data): the pop-up says so.
      await devPanel(computer, false);
      await switchTo(computer, "appa");
      await restoreDays(computer);
      eq(await text(computer, "#kCloudGo"), "Restore Appa", "the button names Appa");
      eq(await restore(computer, D), ["Sep 30's backup has nothing for Appa.", "bad"], "a day with nothing for the app says so");
      await p.click("#kCloudCancel");
      eq(fake.odd, 0, "nothing else asked of GitHub");
    }
  },
  {
    name: "cloud backups: the cloud's encrypted files imported as they are — Import JSON (no key, another key: refused), Import all of all.json (one question); tools/decrypt.html hands all.json back as an Export all file",
    async run(t) {
      const { fake, key, secret } = await computerWithCloud(t);
      const hawkyFile = fake.text(`backups/${D}/hawky.json`), allFile = fake.text(`backups/${D}/all.json`);

      // A device without the key: refused, saying what to do.
      const fresh = await open(t, { app: "hawky", size: PHONE });
      await importBackup(fresh, hawkyFile, "hawky.json");
      await until(() => fresh.dialogs.length, "its alert");
      eq(lastDialog(fresh), "That file is encrypted. Enter the cloud key first (Developer Mode → Cloud sync → Enter key…), or use Decrypt a file… there.", "without the key: refused, saying what to do");
      eq(await errands(fresh), [], "nothing came in");

      // With a key of the same secret (for another, empty repository: nothing comes from the cloud itself): Import JSON
      // takes the backup's file as it is.
      const other = cl.fakeGithub({ repo: OTHER });
      await other.route(fresh.ctx, "fresh");
      eq(await cl.enterKey(fresh, cl.keyOf({ repo: OTHER, secret })), "", "the key entered");
      eq(await errands(fresh), [], "nothing from that cloud");
      await importBackup(fresh, hawkyFile, "hawky.json");
      await until(async () => (await errands(fresh)).length === 3, "the errands");
      eq(await errands(fresh), TEXTS, "Import JSON of backups/<day>/hawky.json, as it is: the errands come in");
      // A file locked with another key: refused.
      fresh.dialogs.length = 0;
      await importBackup(fresh, cl.encryptInNode({ items: [] }, "hawky", Buffer.alloc(32, 9)), "hawky.json");
      await until(() => fresh.dialogs.length, "its alert");
      eq(lastDialog(fresh), "That file can't be read with this device's key: it was locked with another one.", "a file locked with another key: refused");

      // Import all of all.json, as it is: one question naming every app in it; both come in.
      await importAll(fresh, allFile);
      await until(async () => (await baseline(fresh)).length === 1, "Momo's baseline");
      const asked = fresh.dialogs.filter(d => d[0] === "confirm");
      eq(asked.length, 1, "one question");
      has(asked[0][1], "Replace everything in Momo and Hawky with this backup?", "naming every app in it");
      eq([await baseline(fresh), await errands(fresh)], [["Gym"], TEXTS], "Momo and Hawky in");

      // tools/decrypt.html, from disk with no network: all.json back as the Export all file it holds.
      const ctx = await t.browser.newContext({ viewport: PHONE, locale: "en-US", timezoneId: "UTC", acceptDownloads: true });
      t.contexts.push(ctx);
      const page = await ctx.newPage(), tab = { ctx, page, problems: [] };
      t.tabs.push(tab);
      let network = 0;
      ctx.on("request", r => { if (!r.url().startsWith("file:")) network++; });
      page.on("console", m => { if (m.type() === "error" || m.type() === "warning") tab.problems.push(`${m.type()}: ${m.text()}`); });
      page.on("pageerror", e => tab.problems.push(`page error: ${e.message}`));
      await page.goto(`file://${path.join(ROOT, "tools", "decrypt.html")}`);
      await page.fill("#key", key);
      await page.setInputFiles("#files", [{ name: "all.json", mimeType: "application/json", buffer: Buffer.from(allFile) }]);
      await page.click("#go");
      await page.waitForFunction(() => document.getElementById("said").className);
      eq(await page.$$eval("#out li", els => els.map(li => li.textContent.replace(/ Save .*$/, ""))), ["all.json: every app's data, decrypted (Kyoshi's Import all takes it)."], "one line: every app's data (no second all-in-one)");
      const [file] = await Promise.all([page.waitForEvent("download"), page.click("#out li:first-child a")]);
      ok(/^kyoshi-cloud-\d{4}-\d{2}-\d{2}\.json$/.test(file.suggestedFilename()), `named as an Export all file (${file.suggestedFilename()})`);
      const back = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
      eq([back.cloud, Object.keys(back.apps).sort(), back.apps.hawky.items.map(i => i.text).sort()], [true, ["hawky", "momo"], TEXTS], "an Export all file as it is (apps at the top, not under apps.all)");
      eq(network, 0, "nothing went over the network");
    }
  }
];
