/* Kyoshi · tests/cloud.test.js — cloud sync through a private GitHub repository (plan_2026-10-06 Phase 2), against a
 * fake GitHub (tests/cloud.js): set up on a computer (the key; KYOSHI.md and Hawky's file, locked: no errand's words in
 * it, the save inside; no secret in a bug report), a phone filling up from the key, changes both ways (a combine, and a
 * clash: read again, combined, saved), a decrypted copy of every app (Import all takes it; the block's word on it fades,
 * and goes when Developer Mode closes) and Decrypt a file…, a wrong
 * key and other bad pastes refused, a refused token (the banner and the glyph; Update token… mends it), the cloud lost
 * (at once when Kyoshi opens offline, after CLOUD_LOST_MS in use, saves failing alone too; Try now), Disconnect while a
 * check reads, two tabs (a save coming back after the other's change), a file from a newer Kyoshi (it stops: Reload),
 * test mode and another copy's key doing nothing, a key not remembered, and text only (Appa's photo stays on its
 * device). Nothing shows on the page while all is well (D1). */
"use strict";
const fs = require("fs");
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, devPanel, importBackup, travel, text } = require("./lib");
const gen = require("./generate");
const hk = require("./hawky");
const cl = require("./cloud");

const ERRANDS = gen.ERRANDS.slice(0, 3).map(([text, minutes]) => ({ text, minutes }));
const TEXTS = ERRANDS.map(e => e.text);
const errands = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.items.filter(i => !i.deleted).map(i => i.text).sort());
const ready = tab => tab.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
const until = async (check, what) => {
  for (let i = 0; i < 250; i++) { if (check()) return; await new Promise(r => setTimeout(r, 20)); }
  throw new Error(`${what}: not within 5s`);
};
// Every file in the fake is KYOSHI.md or an app's data/<id>.json, and nothing else was asked of GitHub.
function onlyText(fake) {
  ok(fake.paths().every(p => p === "KYOSHI.md" || /^data\/[a-z][a-z0-9]*\.json$/.test(p)), `only KYOSHI.md and data/<app>.json in the repository (${fake.paths()})`);
  eq(fake.odd, 0, "nothing else asked of GitHub");
}

// A computer with three of Hawky's errands that sets up the cloud: { fake, computer, key }.
async function computerWithCloud(t, fake = cl.fakeGithub()) {
  const computer = await open(t, { app: "hawky", size: DESKTOP });
  await fake.route(computer.ctx, "computer");
  await importBackup(computer, gen.hawkyItems(ERRANDS));
  const { key, refused } = await cl.setUp(computer);
  eq(refused, "", "Set up a new cloud… went through");
  return { fake, computer, key };
}
// A phone on the same cloud, the key entered.
async function phoneWith(t, fake, key, app = "hawky") {
  const phone = await open(t, { app, size: PHONE });
  await fake.route(phone.ctx, "phone");
  eq(await cl.enterKey(phone, key), "", "the phone took the key");
  return phone;
}

module.exports = [
  {
    name: "cloud: set up on a computer — the key, KYOSHI.md and Hawky's file, locked; a change goes up; nothing on the page while all is well",
    async run(t) {
      const fake = cl.fakeGithub(), computer = await open(t, { app: "hawky", size: DESKTOP }), p = computer.page;
      await fake.route(computer.ctx);
      await importBackup(computer, gen.hawkyItems(ERRANDS));
      eq(await cl.cloudState(computer), "off", "off at first");
      eq(await cl.alarms(computer), [false, false], "no banner, no glyph");
      const { key, refused } = await cl.setUp(computer);
      eq(refused, "", "set up went through");
      ok(key.startsWith(`kyoshi1.${cl.REPO}.`) && key.split(".").pop().length === 43, "the key: kyoshi1., the repository, the token, a 43-character secret");
      eq(await cl.cloudState(computer), `on · ${cl.REPO}`, "on");
      eq(fake.paths().filter(x => x === "KYOSHI.md" || x === "data/hawky.json"), ["KYOSHI.md", "data/hawky.json"], "the cloud holds KYOSHI.md and Hawky's file");
      onlyText(fake);
      const envelope = fake.text("data/hawky.json"), env = JSON.parse(envelope);
      TEXTS.forEach(w => lacks(envelope, w, "no errand's words in the cloud's file"));
      eq([env.kyoshi, env.app, env.alg, env.zip, Buffer.from(env.iv, "base64").length], [1, "hawky", "AES-256-GCM", "gzip", 12], "the envelope says what it is");
      const save = cl.decryptInNode(envelope, cl.secretOf(key));
      eq(save.items.map(i => i.text).sort(), TEXTS.slice().sort(), "decrypted in Node as KYOSHI.md says, it holds the errands");
      ok(save.sync && Object.keys(save.sync.clock).length === 1 && save.meetings && typeof save.meetings === "object", "with its version counters and meetings");
      has(fake.text("KYOSHI.md"), "# Kyoshi's cloud", "KYOSHI.md says what the repository is");
      TEXTS.forEach(w => lacks(fake.text("KYOSHI.md"), w, "with no data in it"));
      has(fake.files.get("data/hawky.json").message, "Kyoshi: hawky from desktop-", "each save is a commit naming the app and the device");
      eq(await cl.alarms(computer), [false, false], "nothing on the page while all is well");

      // A change goes up a few seconds later (and no sooner than 15 s after the app's last save); a fresh nonce for it.
      const puts = fake.puts;
      await hk.addErrand(computer, "Buy stamps");
      await p.clock.runFor(16000);
      await cl.settled(computer);
      eq(fake.puts, puts + 1, "a change goes up on its own, once");
      const again = JSON.parse(fake.text("data/hawky.json"));
      eq(cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key)).items.length, 4, "with the new errand");
      ok(again.iv !== env.iv, "a fresh nonce for every save");
      has(await cl.cloudText(computer), "Up to date", "the block says it's up to date");
      eq(await cl.alarms(computer), [false, false], "still nothing on the page");
      // No key, token or repository name in a bug report.
      const report = await p.evaluate(() => Kyoshi.bugs.build(Kyoshi.active(), "test"));
      [cl.TOKEN, cl.REPO, key.split(".").pop()].forEach(s => lacks(report, s, "no secret in a bug report"));
      has(report, "sync cloud on · cloud waiting 0", "the report says the cloud is on, and nothing is waiting");
    }
  },
  {
    name: "cloud: a phone fills up from the key (files over 1 MB come as blobs), keeps it after a reload, and shows nothing on its page",
    async run(t) {
      const { fake, key } = await computerWithCloud(t);
      fake.big = 0; // every file comes as GitHub sends one over 1 MB: without its content, then by its blob
      const phone = await phoneWith(t, fake, key);
      eq(await errands(phone), TEXTS.slice().sort(), "Hawky on the phone shows the errands");
      eq(await cl.cloudState(phone), `on · ${cl.REPO}`, "on");
      eq(await cl.alarms(phone), [false, false], "nothing on the page");
      await phone.page.reload();
      await ready(phone);
      await cl.settled(phone);
      eq(await cl.cloudState(phone), `on · ${cl.REPO}`, "the key is remembered after a reload (D2)");
      eq(await cl.alarms(phone), [false, false], "nothing on the page after it either");
      onlyText(fake);
    }
  },
  {
    name: "cloud: changes go both ways; two made apart are combined, and a save that clashes reads again, combines and saves",
    async run(t) {
      const { fake, computer, key } = await computerWithCloud(t);
      const phone = await phoneWith(t, fake, key);
      await hk.addErrand(phone, "Call the plumber");
      await cl.syncNow(phone);
      await cl.syncNow(computer);
      ok((await errands(computer)).includes("Call the plumber"), "the computer gets the phone's errand");

      // Each adds one before either syncs: the computer saves first, the phone combines and saves, the computer catches up.
      const puts = fake.puts;
      await hk.addErrand(computer, "Water the plants");
      await hk.addErrand(phone, "Book the car service");
      await cl.syncNow(computer);
      await cl.syncNow(phone);
      await cl.syncNow(computer);
      const all = [...TEXTS, "Call the plumber", "Water the plants", "Book the car service"].sort();
      eq(await errands(computer), all, "the computer lists every errand");
      eq(await errands(phone), all, "and so does the phone");
      ok(fake.puts > puts, "both saved to the cloud");

      // A clash: the phone's save waits while the computer saves; GitHub refuses the phone's (its file changed), so the
      // phone reads the file again, combines and saves.
      await hk.addErrand(computer, "Renew the parking permit");
      await hk.addErrand(phone, "Return the library card");
      const release = fake.hold("phone");
      const phoneSync = cl.syncNow(phone);
      await until(() => fake.held === 1, "the phone's save reached GitHub");
      await cl.syncNow(computer);
      release();
      await phoneSync;
      eq(fake.clashes, 1, "the phone's save clashed once");
      await cl.syncNow(computer);
      const both = [...all, "Renew the parking permit", "Return the library card"].sort();
      eq(await errands(phone), both, "the phone has both");
      eq(await errands(computer), both, "and so does the computer");
      eq(cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key)).items.map(i => i.text).sort(), both, "and the cloud");
      eq([await cl.alarms(phone), await cl.alarms(computer)], [[false, false], [false, false]], "nothing on either page");
      onlyText(fake);
    }
  },
  {
    name: "cloud: Download decrypted copy holds every app's save (Import all takes it; the block's word on it fades); Decrypt a file… opens one (Import JSON takes it)",
    async run(t) {
      const { fake, computer, key } = await computerWithCloud(t), p = computer.page;
      await devPanel(computer, true);
      const [download] = await Promise.all([p.waitForEvent("download"), p.click("#kDevCloudExport")]);
      eq(download.suggestedFilename(), `kyoshi-cloud-${TODAY}.json`, "its name");
      const all = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
      eq([all.cloud, all.apps.hawky.items.map(i => i.text).sort()], [true, TEXTS.slice().sort()], "Hawky's errands, decrypted");
      eq(Object.keys(all.apps).sort(), fake.paths().filter(x => x.startsWith("data/")).map(x => x.slice(5, -5)).sort(), "every app in the cloud");
      has(await text(computer, "#kDevCloudSaid"), "Downloaded", "the block says what it did");
      // That last word goes when Developer Mode closes, and fades on its own while it stays open.
      const said = () => p.evaluate(() => { const e = document.getElementById("kDevCloudSaid"); return [e.hidden, e.textContent]; });
      await devPanel(computer, false);
      await devPanel(computer, true);
      eq(await said(), [true, ""], "closing Developer Mode clears it");
      await Promise.all([p.waitForEvent("download"), p.click("#kDevCloudExport")]);
      await p.waitForFunction(() => /^Downloaded/.test(document.getElementById("kDevCloudSaid").textContent));
      await p.clock.runFor(await p.evaluate(() => Kyoshi.cloudUI.SAID_MS) + 1000);
      eq([await said(), await p.evaluate(() => Kyoshi.dev.isOn())], [[true, ""], true], "it fades while the panel stays open");
      const fresh = await open(t, { app: "hawky" });
      await devPanel(fresh, true);
      const [chooser] = await Promise.all([fresh.page.waitForEvent("filechooser"), fresh.page.click("#kDevImportAll")]);
      await chooser.setFiles({ name: "kyoshi-cloud.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(all)) });
      await fresh.page.waitForTimeout(300);
      eq(await errands(fresh), TEXTS.slice().sort(), "Import all takes it back");

      // Decrypt a file…: Hawky's file as it is in the repository → its plain save.
      const pick = async (name, bytes) => {
        const [c] = await Promise.all([p.waitForEvent("filechooser"), p.click("#kDevCloudDecrypt")]);
        await c.setFiles({ name, mimeType: "application/json", buffer: bytes });
      };
      const [plain] = await Promise.all([p.waitForEvent("download"), pick("hawky.json", fake.files.get("data/hawky.json").bytes)]);
      eq(plain.suggestedFilename(), `hawky-cloud-${TODAY}.json`, "Decrypt a file… names it by its app");
      const save = JSON.parse(fs.readFileSync(await plain.path(), "utf8"));
      eq(save.items.map(i => i.text).sort(), TEXTS.slice().sort(), "its plain save");
      const other = await open(t, { app: "hawky" });
      await importBackup(other, save);
      eq(await errands(other), TEXTS.slice().sort(), "Import JSON takes it");
      await pick("notes.json", Buffer.from(JSON.stringify({ not: "a cloud file" })));
      await p.waitForFunction(() => /isn't a Kyoshi cloud file/.test(document.getElementById("kDevCloudSaid").textContent));
      ok(await p.evaluate(() => document.getElementById("kDevCloudSaid").classList.contains("bad")), "a file that isn't one is refused");
      ok(key, "the key was made");
    }
  },
  {
    name: "cloud: a wrong key, a token alone, a key cut short, a public repository and a set-up over data are refused; nothing is written",
    async run(t) {
      const { fake } = await computerWithCloud(t);
      const puts = fake.puts, other = await open(t, { app: "hawky" });
      await fake.route(other.ctx);
      has(await cl.enterKey(other, cl.keyOf({ secret: Buffer.alloc(32, 9) })), "That key doesn't fit the data already in that repository", "the pop-up says the key doesn't fit");
      eq(await cl.cloudState(other), "off", "the state stays off");
      const asked = fake.requests;
      has(await cl.enterKey(other, cl.TOKEN), "That's a token on its own", "a token alone");
      has(await cl.enterKey(other, cl.KEY.slice(0, -5)), "cut short", "a key cut short");
      eq(fake.requests, asked, "none of those went to GitHub");
      has((await cl.setUp(other)).refused, "already holds Kyoshi data", "a new cloud over data already there");
      fake.isPrivate = false;
      has(await cl.enterKey(other, cl.KEY), "That repository is public", "a public repository");
      eq([fake.puts, await cl.cloudState(other)], [puts, "off"], "nothing written; still off");
      eq(await other.page.evaluate(() => [localStorage.getItem("kyoshi.cloud"), sessionStorage.getItem("kyoshi.cloud")]), [null, null], "no key kept");
    }
  },
  {
    name: "cloud: a refused token stops it, with the banner and the glyph (they open Developer Mode); Update token… mends it",
    async run(t) {
      t.allowProblems = true; // for the one console line, checked below
      const { fake, computer, key } = await computerWithCloud(t), p = computer.page;
      eq(await cl.alarms(computer), [false, false], "nothing while all is well (D1)");
      fake.mode = "auth";
      await cl.syncNow(computer);
      eq(await cl.cloudState(computer), "needs you", "the block: needs you");
      has(await cl.cloudText(computer), "no longer accepts the token", "it names the token");
      eq(await cl.alarms(computer), [true, true], "the banner and the glyph show");
      has(await cl.bannerText(computer), "GitHub no longer accepts the token in your key", "the banner says the token is no longer accepted");
      eq(await text(computer, "#kCloudBannerBtn"), "Open Developer Mode", "its button");
      await devPanel(computer, false);
      await p.click("#kCloudBtn");
      ok(await p.evaluate(() => document.body.classList.contains("dev-mode")), "the glyph opens Developer Mode");
      eq(await p.$$eval("#kDevCloudActions button:not([hidden])", els => els.map(b => b.id)), ["kDevCloudEnter", "kDevCloudToken", "kDevCloudDecrypt", "kDevCloudOff"], "the block's buttons for a refused token");
      const lines = computer.problems.filter(l => !/^error: Failed to load resource/.test(l));
      eq(lines.length, 1, `one console line (${lines})`);
      has(lines[0], "Cloud sync stopped (auth)", "it says why");
      [cl.TOKEN, cl.REPO, key.split(".").pop()].forEach(s => lacks(lines[0], s, "with no secret in it"));

      const fresh = "github_pat_TEST1111111111111111111111_aNewMadeUpTokenForKyoshiTests111111111111111111111111111";
      fake.mode = "ok";
      fake.token = fresh;
      const { key: renewed, refused } = await cl.updateToken(computer, fresh);
      eq(refused, "", "Update token… went through");
      ok(renewed.startsWith(`kyoshi1.${cl.REPO}.${fresh}.`) && renewed.endsWith(`.${key.split(".").pop()}`), "the new key: the same repository and secret, the new token");
      eq(await cl.cloudState(computer), `on · ${cl.REPO}`, "on again");
      eq(await cl.alarms(computer), [false, false], "the banner and the glyph are gone");
      eq(await p.evaluate(() => JSON.parse(localStorage.getItem("kyoshi.cloud")).key), renewed, "the new key is kept");
    }
  },
  {
    name: "cloud: lost — at once when Kyoshi opens offline (when last reached, a change waiting), after CLOUD_LOST_MS in use; Try now",
    async run(t) {
      const { fake, key } = await computerWithCloud(t);
      const phone = await phoneWith(t, fake, key), p = phone.page;
      // Where the switcher and Theme sit, in whole pixels: the glyph slots in before them, and they stay put.
      const where = () => p.evaluate(() => ["kSwitchBtn", "kThemeToggle"].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
      const before = await where();
      fake.mode = "offline";
      await p.reload();
      await ready(phone);
      await cl.settled(phone);
      eq(await cl.alarms(phone), [true, true], "at once: the banner and the glyph");
      eq(await where(), before, "the switcher and Theme stay where they were");
      const words = await cl.bannerText(phone);
      has(words, "Cloud sync can't reach GitHub (since you opened Kyoshi; last reached at ", "it can't reach GitHub, and says when it last did");
      has(words, "What you see may be behind your other devices.", "what that means");
      eq(await text(phone, "#kCloudBannerBtn"), "Try now", "its button");
      await hk.addErrand(phone, "Fix the gate");
      has(await cl.bannerText(phone), "and 1 change made here is waiting to go up.", "the change waits, and the banner says so");
      const box = await p.locator("#kCloudBtn").boundingBox();
      ok(box && box.x + box.width <= PHONE.width && box.width <= 30, "the glyph fits the phone's header");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "nothing wider than the phone");

      fake.mode = "ok";
      await p.click("#kCloudBannerBtn");
      await cl.settled(phone);
      eq(await cl.alarms(phone), [false, false], "once GitHub answers, both go");
      ok(cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key)).items.some(i => i.text === "Fix the gate"), "and the errand went up");

      // In use: one failed check is a blip; lost once CLOUD_LOST_MS pass without one getting through.
      fake.mode = "offline";
      await cl.syncNow(phone);
      eq(await cl.alarms(phone), [false, false], "a blip shows nothing");
      await p.clock.runFor(await p.evaluate(() => Kyoshi.cloud.LOST_MS) + 1000);
      await cl.settled(phone); // a check the run started may still be reading or saving: done before the fake changes mode
      eq(await cl.alarms(phone), [true, true], "lost after CLOUD_LOST_MS: the banner and the glyph");
      has(await cl.bannerText(phone), "Cloud sync can't reach GitHub (since ", "since when");
      fake.mode = "ok";
      await p.click("#kCloudBannerBtn");
      await cl.settled(phone);
      eq(await cl.alarms(phone), [false, false], "Try now: gone");

      // Saves failing while reading works: a blip at first, lost after CLOUD_LOST_MS too.
      fake.mode = "nosave";
      await hk.addErrand(phone, "Sweep the porch");
      await cl.syncNow(phone);
      eq(await cl.alarms(phone), [false, false], "one save that fails is a blip");
      await p.clock.runFor(await p.evaluate(() => Kyoshi.cloud.LOST_MS) + 1000);
      await cl.settled(phone);
      eq(await cl.alarms(phone), [true, true], "saves failing for CLOUD_LOST_MS: the banner and the glyph");
      has(await cl.bannerText(phone), "and 1 change made here is waiting to go up.", "the change still waits");
      fake.mode = "ok";
      await p.click("#kCloudBannerBtn");
      await cl.settled(phone);
      eq(await cl.alarms(phone), [false, false], "gone once it's saved");
      ok(cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key)).items.some(i => i.text === "Sweep the porch"), "and the errand is in the cloud");
    }
  },
  {
    name: "cloud: Disconnect while a check is still reading leaves it off and quiet (nothing taken in); the key again brings the news",
    async run(t) {
      const { fake, computer, key } = await computerWithCloud(t);
      const phone = await phoneWith(t, fake, key), p = phone.page;
      await hk.addErrand(computer, "Oil the hinges");
      await cl.syncNow(computer); // news for the phone
      const release = fake.hold("phone", "read");
      await p.evaluate(() => Kyoshi.cloud.syncNow());
      await until(() => fake.held === 1, "the phone's read reached GitHub");
      await devPanel(phone, true);
      await p.click("#kDevCloudOff"); // Disconnect: its question answered yes
      release();
      await cl.settled(phone);
      eq(await cl.cloudState(phone), "off", "off");
      eq(await cl.alarms(phone), [false, false], "no banner, no glyph (the cut-off check stops quietly)");
      ok(!(await errands(phone)).includes("Oil the hinges"), "the cut-off read brought nothing in");
      eq(await cl.enterKey(phone, key), "", "the key again");
      ok((await errands(phone)).includes("Oil the hinges"), "brings the news");
    }
  },
  {
    name: "cloud: two tabs — a save that comes back after the other tab's change neither marks that change sent nor moves its counter back",
    async run(t) {
      const { fake, computer, key } = await computerWithCloud(t), a = computer.page;
      const second = await open(t, { app: "hawky", size: DESKTOP, ctx: computer.ctx });
      await cl.settled(second);
      // This device's counter for Hawky as a tab's store holds it (another tab's writes land there before it reloads).
      const stored = tab => tab.page.evaluate(() => { const A = Kyoshi.apps.hawky; return (A.store.json("sync").clock || {})[A._sync.meta.device] || 0; });
      const mine = tab => tab.page.evaluate(() => Kyoshi.sync.version(Kyoshi.apps.hawky));
      const waitFor = async (fn, what) => { for (let i = 0; i < 250; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error(`${what}: not within 5s`); };
      // Time stands still, so a tab reloads another's change only when the test lets the clock run.
      await a.clock.pauseAt(await a.evaluate(() => Date.now()) + 1000);
      await hk.addErrand(computer, "Paint the fence");
      const v = await mine(computer);
      await waitFor(async () => (await stored(second)) === v, "the other tab's store has the change");
      await a.clock.runFor(100);
      eq(await mine(second), v, "and it reloaded it");
      const release = fake.hold("computer");
      await a.evaluate(() => Kyoshi.cloud.syncNow());
      await until(() => fake.held === 1, "the save reached GitHub");
      await hk.addErrand(second, "Fix the gutter");
      await waitFor(async () => (await stored(computer)) === v + 1, "the saving tab's store has the other tab's change");
      eq(await mine(computer), v, "which it hasn't reloaded yet");
      release();
      await cl.settled(computer);
      eq(await stored(computer), v + 1, "the save that came back didn't move the counter back");
      await a.clock.resume();
      await cl.syncNow(second);
      const texts = cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key)).items.map(i => i.text);
      ok(texts.includes("Paint the fence") && texts.includes("Fix the gutter"), "both tabs' changes reached the cloud");
    }
  },
  {
    name: "cloud: a file saved by a newer Kyoshi stops it here (Reload), so this older version never sends what it would drop",
    async run(t) {
      t.allowProblems = true; // for the one console line, checked below
      const { fake, key } = await computerWithCloud(t);
      // Another device, on a later version of Hawky, saved the file.
      const save = cl.decryptInNode(fake.text("data/hawky.json"), cl.secretOf(key));
      fake.plant("data/hawky.json", Buffer.from(cl.encryptInNode({ ...save, appVersion: "99.000" }, "hawky", cl.secretOf(key))));
      const puts = fake.puts, phone = await open(t, { app: "hawky", size: PHONE });
      await fake.route(phone.ctx, "phone");
      eq(await cl.enterKey(phone, key), "", "the key fits");
      eq(await cl.cloudState(phone), "needs you", "it stops");
      has(await cl.bannerText(phone), "saved by a newer Kyoshi: reload this page to get it", "the banner says why");
      eq(await text(phone, "#kCloudBannerBtn"), "Reload", "with Reload");
      eq(await errands(phone), [], "nothing taken in");
      await hk.addErrand(phone, "Mow the lawn");
      await phone.page.clock.runFor(20000);
      await cl.settled(phone);
      eq(fake.puts, puts, "nothing sent");
      const lines = phone.problems.filter(l => !/^error: Failed to load resource/.test(l));
      eq(lines.length, 1, `one console line (${lines})`);
      has(lines[0], "Cloud sync stopped (newer)", "it says why");
    }
  },
  {
    name: "cloud: test mode sends nothing; a key saved for another copy stays unused; a key not remembered stays with its tab",
    async run(t) {
      const { fake, computer, key } = await computerWithCloud(t), p = computer.page;
      const asked = fake.requests;
      await travel(computer, 1);
      await hk.addErrand(computer, "Practise test mode");
      await p.clock.runFor(70000); // the change's delay and a minute's check both pass
      await cl.settled(computer);
      eq(fake.requests, asked, "in test mode nothing goes to GitHub");
      has(await cl.cloudText(computer), "Paused in test mode", "the block says so");
      eq(await cl.alarms(computer), [false, false], "and nothing on the page");

      await p.evaluate(() => {
        const r = JSON.parse(localStorage.getItem("kyoshi.cloud"));
        localStorage.setItem("kyoshi.cloud", JSON.stringify({ ...r, at: "file:///another/copy/" }));
      });
      await p.reload();
      await ready(computer);
      await cl.settled(computer);
      eq(await cl.cloudState(computer), "off", "a key saved for another copy of Kyoshi: off");
      has(await cl.cloudText(computer), "belongs to another copy of Kyoshi", "and the block says why");
      eq(fake.requests, asked, "nothing went to GitHub");

      // Remember on this device unticked: the key stays with this tab only.
      const shared = await open(t, { app: "hawky" });
      await fake.route(shared.ctx);
      eq(await cl.enterKey(shared, key, false), "", "connected without remembering");
      eq(await shared.page.evaluate(() => [localStorage.getItem("kyoshi.cloud"), !!sessionStorage.getItem("kyoshi.cloud")]), [null, true], "kept for this tab only");
      const second = await open(t, { app: "hawky", ctx: shared.ctx });
      eq(await cl.cloudState(second), "off", "another tab of that browser doesn't have it");
    }
  },
  {
    name: "cloud: text only — Appa's record goes up, its photo doesn't; the phone shows the record with the photo not on this device",
    async run(t) {
      const fake = cl.fakeGithub(), computer = await open(t, { app: "appa", size: DESKTOP }), p = computer.page;
      await fake.route(computer.ctx, "computer");
      const T = Date.parse("2026-09-20T12:00:00Z"), PHOTO = "photo0000001";
      const world = gen.appaWorld({ things: [{ id: "car00001", name: "Car" }], jobs: [{ id: "job00001", thingId: "car00001", name: "Oil change", every: [6, "m"] }] });
      world.records = [{ id: "rec00001", thingId: "car00001", date: "2026-09-20", reading: null, title: "", jobs: [{ jobId: "job00001", name: "Oil change", minutes: 30, timed: false }],
        by: "", cost: null, notes: "", files: [PHOTO], links: [], deleted: false, at: T, u: T }];
      world.files = [{ id: PHOTO, kind: "photo", name: "receipt.jpg", type: "image/jpeg", size: 4, pages: 0, w: 2, h: 2, deleted: false, at: T, u: T }];
      await importBackup(computer, world);
      await p.evaluate(id => Kyoshi.apps.appa.files.put(new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])], { type: "image/jpeg" }), id), PHOTO);
      eq(await p.evaluate(id => Kyoshi.apps.appa.files.has(id), PHOTO), true, "the photo is on the computer");
      const { key } = await cl.setUp(computer);
      await cl.syncNow(computer);
      ok(fake.paths().includes("data/appa.json"), "Appa's records went up");
      onlyText(fake);
      ok([...fake.files.values()].every(f => !f.bytes.includes(Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]))), "the photo's bytes are in no file");
      eq(cl.decryptInNode(fake.text("data/appa.json"), cl.secretOf(key)).files.map(f => [f.id, f.size]), [[PHOTO, 4]], "the save lists the photo by id and size only");

      const phone = await phoneWith(t, fake, key, "appa"), q = phone.page;
      eq(await q.evaluate(id => Kyoshi.apps.appa.files.has(id), PHOTO), false, "the photo isn't on the phone");
      await q.click('#kMount tr[data-act="open-record"][data-id="rec00001"]');
      eq(await q.locator("#kMount .proof-missing").first().textContent(), "Not on this device", "the record shows where its photo would be");
      onlyText(fake);
    }
  }
];
