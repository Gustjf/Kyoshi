// Curated screenshots for report.md: a year-1 bundle opened in a fresh profile, the clock set near its last week, and the
// screens behind the top findings — Momo's board (this week, next week), its Tasks, and the phone's Today.
//   node tests/sim/curated.js [life=planner] [when=2027-09-22T09:00:00Z]
// Reads tests/sim/bundles/<life>-y1.json, writes tests/sim/shots/<life>-board-this.png, -board-next, -tasks-this, -phone-today.
// Made-up data only. Not part of the site.
const path = require("path"), fs = require("fs");
const { PAGE } = require("../lib");
const mo = require("../momo");
const OUT = path.join(__dirname, "shots");
const started = page => page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.order.every(id => Kyoshi.apps[id].started));
(async () => {
  const pw = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
  const browser = await pw.chromium.launch();
  const life = process.argv[2] || "planner", when = process.argv[3] || "2027-09-22T09:00:00Z";
  const file = fs.readFileSync(path.join(__dirname, `bundles/${life}-y1.json`), "utf8");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 }, locale: "en-US", timezoneId: "UTC" });
  await ctx.clock.install({ time: Date.parse(when) });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept().catch(() => {}));
  page.on("pageerror", e => console.log("PAGE ERROR", e.message));
  await page.goto(`${PAGE}#momo`);
  await page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
  await page.click("#kDevBadge");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#kDevImportAll")]);
  await chooser.setFiles({ name: "bundle.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.waitForTimeout(400);
  await page.click("#kDevBadge");
  await page.reload();
  await started(page);
  await page.evaluate(() => { const o = Kyoshi.modal.top(); if (o) Kyoshi.modal.close(o); Kyoshi.apps.momo.S.closing = null; });
  const tab = { page, ctx };
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (name, sel) => { const el = sel ? page.locator(sel).first() : page; await el.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log("shot", name); };
  await mo.view(tab, "this");
  await shot(`${life}-board-this`, "#kMount #boardView");
  await mo.view(tab, "next");
  await shot(`${life}-board-next`, "#kMount #boardView");
  await mo.view(tab, "this");
  await shot(`${life}-tasks-this`, "#kMount #bank");
  // The phone: Today.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await started(page);
  await page.evaluate(() => { const o = Kyoshi.modal.top(); if (o) Kyoshi.modal.close(o); });
  await shot(`${life}-phone-today`);
  console.log(JSON.stringify(await mo.model(tab).then(m => ({ today: m.today, tasks: m.tasks.this.map(t => t.title + " " + t.hours + (t.overdue ? " late" : "")) }))));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
