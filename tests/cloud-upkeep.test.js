/* Kyoshi · tests/cloud-upkeep.test.js — the cloud's upkeep (plan_2026-10-06 Phase 3), against the fake GitHub
 * (tests/cloud.js): the history trimmed on its own to the last 8 days (one first commit for the older saves, the later
 * ones made again, the files untouched; nothing again the next day; GitHub refusing it: the History line, tried again a
 * week later), the token's expiry (a line from 14 days before; the banner and the glyph from 3), and tools/decrypt.html
 * opened from disk with no network. */
"use strict";
const fs = require("fs");
const path = require("path");
const { ROOT, TODAY, DESKTOP, PHONE, DAY_MS, at, eq, ok, has, lacks, open, importBackup, text } = require("./lib");
const gen = require("./generate");
const hk = require("./hawky");
const cl = require("./cloud");

const ERRANDS = gen.ERRANDS.slice(0, 3).map(([text, minutes]) => ({ text, minutes }));
const T = at(TODAY);
const errands = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.items.filter(i => !i.deleted).map(i => i.text).sort());
const historyLine = tab => tab.page.evaluate(() => { const el = document.getElementById("kDevCloudHistory"); return el.hidden ? "" : el.textContent; });
const shas = fake => Object.fromEntries([...fake.files].map(([p, f]) => [p, f.sha]));
// The phone's clock moved on to ms (no timers fired on the way), then a check: the day's look at the history follows it.
async function dayLater(tab, ms) {
  await tab.page.clock.setSystemTime(ms);
  await cl.syncNow(tab);
}

module.exports = [
  {
    name: "cloud upkeep: the history keeps the last 8 days on its own — older saves folded into one commit, the files untouched; GitHub refusing it waits a week",
    async run(t) {
      // A computer whose clock says 20 days ago sets the cloud up, then saves 10 days ago, 3 days ago and an hour ago.
      const fake = cl.fakeGithub();
      fake.now = T - 20 * DAY_MS;
      const computer = await open(t, { app: "hawky", size: DESKTOP, time: T - 20 * DAY_MS });
      await fake.route(computer.ctx, "computer");
      await importBackup(computer, gen.hawkyItems(ERRANDS));
      const { key, refused } = await cl.setUp(computer);
      eq(refused, "", "set up");
      for (const [ago, words] of [[10 * DAY_MS, "Fix the shed"], [3 * DAY_MS, "Wash the car"], [3600000, "Feed the cat"]]) {
        fake.now = T - ago;
        await hk.addErrand(computer, words);
        await cl.syncNow(computer);
      }
      const before = fake.history(), files = shas(fake);
      eq(before.length, 5, "five saves: KYOSHI.md, Hawky's first, and three changes");
      eq(fake.moves, 0, "nothing trimmed while it all looked recent to the computer");
      eq(await historyLine(computer), "", "and nothing said about the history");

      // A phone, today: its first check looks at the history and trims it.
      const phone = await open(t, { app: "hawky", size: PHONE });
      await fake.route(phone.ctx, "phone");
      eq(await cl.enterKey(phone, key), "", "the phone took the key");
      const after = fake.history();
      eq(fake.moves, 1, "the branch moved once");
      eq(after.length, 3, "three commits left: the older saves in one, then the two of the last 7 days");
      const root = after[2];
      eq([root.parents.length, root.tree], [0, before[2].tree], "the first holds the files as they were 10 days ago, with no parents");
      ok(Math.abs(Date.parse(root.date) - (T - 7 * DAY_MS)) < 5 * 60000, `dated 7 days ago (${root.date})`);
      eq(after.slice(0, 2).map(c => [c.tree, c.message, c.date]), before.slice(0, 2).map(c => [c.tree, c.message, c.date]), "the later saves made again as they were");
      eq(shas(fake), files, "every file the same (no device reads anything again)");
      eq(fake.made, 3, "three commits written");
      eq(fake.odd, 0, "nothing else asked of GitHub");
      eq((await errands(phone)).length, 6, "the phone has every errand");
      eq(await cl.alarms(phone), [false, false], "nothing on the page");
      eq(await historyLine(phone), "", "nor in the block");

      // The next day: only the trim's own first commit is older than 8 days: nothing to do.
      await dayLater(phone, T + DAY_MS + 60000);
      eq(fake.moves, 1, "a day later, nothing trimmed again");
      // Five days on, the save of 3 days ago is past 8 days: trimmed again, but GitHub refuses to move the branch.
      fake.mode = "notidy";
      const head = fake.head;
      await dayLater(phone, T + 5 * DAY_MS + 60000);
      eq([fake.moves, fake.head], [1, head], "refused: the history stays whole");
      has(await historyLine(phone), "GitHub won't let Kyoshi trim it to the last 8 days", "the block says so");
      eq(await cl.alarms(phone), [false, false], "and nothing on the page");
      fake.mode = "ok";
      const made = fake.made;
      await dayLater(phone, T + 7 * DAY_MS + 60000);
      eq([fake.moves, fake.made], [1, made], "two days later, not tried again yet");
      await dayLater(phone, T + 13 * DAY_MS);
      eq(fake.moves, 2, "a week after the refusal, trimmed");
      eq(fake.history().map(c => c.parents.length), [0], "one commit left, holding the files as they are: every save was older than 7 days");
      eq(shas(fake), files, "the files still the same");
      eq(await historyLine(phone), "", "and the block says nothing again");
      eq(fake.odd, 0, "nothing else asked of GitHub");
    }
  },
  {
    name: "cloud upkeep: the token's end — a line in the block from 14 days before, the banner and the glyph from 3; Update token… clears it",
    async run(t) {
      const fake = cl.fakeGithub(), computer = await open(t, { app: "hawky", size: DESKTOP });
      await fake.route(computer.ctx, "computer");
      await importBackup(computer, gen.hawkyItems(ERRANDS));
      eq((await cl.setUp(computer)).refused, "", "set up");
      fake.expires = "2026-12-31 07:00:00 UTC";
      await cl.syncNow(computer);
      lacks(await cl.cloudText(computer), "expires", "months away: not a word");
      fake.expires = "2026-10-10 07:00:00 UTC";
      await cl.syncNow(computer);
      has(await cl.cloudText(computer), "The token in your cloud key expires on Oct 10 (in 10 days): Update token…", "10 days away: the block says when");
      eq(await cl.alarms(computer), [false, false], "nothing on the page yet");
      fake.expires = "2026-10-02 07:00:00 UTC";
      await cl.syncNow(computer);
      eq(await cl.alarms(computer), [true, true], "2 days away: the banner and the glyph");
      has(await cl.bannerText(computer), "expires on Oct 2 (in 2 days)", "the banner says when");
      eq(await text(computer, "#kCloudBannerBtn"), "Open Developer Mode", "its button opens the block");
      const fresh = "github_pat_TEST2222222222222222222222_aNewMadeUpTokenForKyoshiTests222222222222222222222222222";
      fake.token = fresh;
      fake.expires = "2027-10-01 07:00:00 UTC";
      eq((await cl.updateToken(computer, fresh)).refused, "", "Update token… went through");
      eq(await cl.alarms(computer), [false, false], "the new token: gone");
      lacks(await cl.cloudText(computer), "expires", "and from the block");
    }
  },
  {
    name: "cloud upkeep: tools/decrypt.html, opened from disk with no network, decrypts the repository's files with the key (each, and all in one)",
    async run(t) {
      const fake = cl.fakeGithub(), computer = await open(t, { app: "hawky", size: DESKTOP });
      await fake.route(computer.ctx, "computer");
      await importBackup(computer, gen.hawkyItems(ERRANDS));
      const { key } = await cl.setUp(computer);
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
      const json = (name, buffer) => ({ name, mimeType: "application/json", buffer });
      await page.setInputFiles("#files", [
        json("hawky.json", fake.files.get("data/hawky.json").bytes),
        json("pabu.json", Buffer.from(cl.encryptInNode({ people: [] }, "pabu", cl.secretOf(key)))),
        json("momo.json", Buffer.from(cl.encryptInNode({ weeks: [] }, "momo", Buffer.alloc(32, 9)))),
        json("notes.json", Buffer.from(JSON.stringify({ not: "a cloud file" })))
      ]);
      await page.click("#go");
      await page.waitForFunction(() => document.getElementById("said").className);
      const lines = await page.$$eval("#out li", els => els.map(li => li.textContent));
      has(lines[0], "hawky.json: hawky's data, decrypted.", "Hawky's file decrypted");
      has(lines[2], "momo.json: can't be read with this key", "a file locked with another key");
      has(lines[3], "notes.json: not a Kyoshi cloud file", "a file that isn't one");
      has(await page.textContent("#said"), "Decrypted 2 files of 4", "what it did");
      const [one] = await Promise.all([page.waitForEvent("download"), page.click("#out li:first-child a")]);
      ok(/^hawky-cloud-\d{4}-\d{2}-\d{2}\.json$/.test(one.suggestedFilename()), `named by its app (${one.suggestedFilename()})`);
      eq(JSON.parse(fs.readFileSync(await one.path(), "utf8")).items.map(i => i.text).sort(), ERRANDS.map(e => e.text).sort(), "its plain save holds the errands");
      const [all] = await Promise.all([page.waitForEvent("download"), page.click("#out li:last-child a")]);
      eq(Object.keys(JSON.parse(fs.readFileSync(await all.path(), "utf8")).apps).sort(), ["hawky", "pabu"], "all in one file, as Import all takes it");
      eq(network, 0, "nothing went over the network");
    }
  }
];
