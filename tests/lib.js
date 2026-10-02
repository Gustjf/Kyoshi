/* Kyoshi · tests/lib.js — what the end-to-end tests share: opening Kyoshi from disk the way the user does (index.html,
 * no server) in a fresh browser profile (its own storage) with a fixed clock (so "today" is always TODAY, whatever the
 * real date), watching the console, answering dialogs (alert / confirm; a test can queue answers and read what was
 * asked), switching apps through the switcher, importing a backup through the file picker, exporting one, time travel
 * through Developer Mode, and small checks. Used by run.js and every *.test.js. */
"use strict";
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PAGE = `file://${path.join(ROOT, "index.html")}`;
const TODAY = "2026-09-30";               // a Wednesday: this week has days before and after it
const PHONE = { width: 390, height: 844 }; // a phone held upright
const DESKTOP = { width: 1280, height: 900 };

// --- Checks: each throws with what was expected, so the runner can say which step failed ---
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}
function ok(value, what) { if (!value) throw new Error(`${what}: not true`); }
function has(text, part, what) {
  if (!String(text).includes(part)) throw new Error(`${what}: expected to find ${JSON.stringify(part)} in ${JSON.stringify(String(text).slice(0, 400))}`);
}
function lacks(text, part, what) {
  if (String(text).includes(part)) throw new Error(`${what}: didn't expect ${JSON.stringify(part)} in ${JSON.stringify(String(text).slice(0, 400))}`);
}

// --- Dates, as the app counts them (calendar days in UTC; weeks Monday to Sunday) ---
const DAY_MS = 86400000;
const dateMs = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const addDays = (d, n) => new Date(dateMs(d) + n * DAY_MS).toISOString().slice(0, 10);
const mondayOf = d => addDays(d, -((new Date(dateMs(d)).getUTCDay() + 6) % 7));
// A moment on a day: "2026-09-30", "18:05" → ms.
const at = (d, hm = "07:00") => Date.parse(`${d}T${hm}:00Z`);

// --- A browser tab on Kyoshi ---
// Opens Kyoshi on an app in a new profile (or ctx: another tab of the same one), the clock at time (ms or ISO), the
// console watched: { ctx, page, problems, dialogs, answers }. problems: console errors and warnings and page errors;
// dialogs: every alert / confirm, as [type, message]; answers: what the next confirms say (true when empty).
async function open(t, { app = "badgermole", size = PHONE, time = at(TODAY), ctx = null } = {}) {
  if (!ctx) {
    ctx = await t.browser.newContext({ viewport: size, locale: "en-US", timezoneId: "UTC" });
    await ctx.clock.install({ time });
    t.contexts.push(ctx);
  }
  const page = await ctx.newPage();
  const tab = { ctx, page, problems: [], dialogs: [], answers: [] };
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") tab.problems.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", e => tab.problems.push(`page error: ${e.message}`));
  page.on("dialog", d => {
    tab.dialogs.push([d.type(), d.message()]);
    const yes = d.type() !== "confirm" || !tab.answers.length || tab.answers.shift();
    (yes ? d.accept() : d.dismiss()).catch(() => {});
  });
  t.tabs.push(tab);
  await page.goto(app ? `${PAGE}#${app}` : PAGE); // no app: whichever Kyoshi opens on
  await page.waitForFunction(id => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started && (!id || Kyoshi.active() === Kyoshi.apps[id]), app);
  return tab;
}

// The last dialog's message (and forgets them all), to check what the user was told or asked.
function lastDialog(tab) {
  const d = tab.dialogs[tab.dialogs.length - 1];
  tab.dialogs.length = 0;
  return d ? d[1] : "";
}

// Switches app through the switcher, as the user does.
async function switchTo(tab, id) {
  await tab.page.click("#kSwitchBtn");
  await tab.page.click(`#kSwitchMenu [data-app="${id}"]`);
  await tab.page.waitForFunction(x => Kyoshi.active() === Kyoshi.apps[x], id);
}

// Import JSON in the app on screen, picking a file made from data (an object, or text for a broken file).
async function importBackup(tab, data, name = "backup.json") {
  const [chooser] = await Promise.all([
    tab.page.waitForEvent("filechooser"),
    tab.page.click('#kMount [data-kyoshi="backup"] button:has-text("Import JSON")')
  ]);
  await chooser.setFiles({ name, mimeType: "application/json", buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)) });
  await tab.page.waitForTimeout(150);
}

// Export JSON in the app on screen: the backup, read back.
async function exportBackup(tab) {
  const [download] = await Promise.all([tab.page.waitForEvent("download"), tab.page.click('#kMount [data-kyoshi="backup"] button:has-text("Export JSON")')]);
  const file = await download.path();
  return JSON.parse(require("fs").readFileSync(file, "utf8"));
}

// Time travel (Developer Mode): days forward; the first jump switches to test mode (nothing saved until a reload).
async function travel(tab, days) {
  const p = tab.page;
  if (!(await p.evaluate(() => document.body.classList.contains("dev-mode")))) await p.click("#kDevBadge");
  const btn = { 1: "#kDevPlusDay", 7: "#kDevPlusWeek" }[days];
  if (btn) await p.click(btn);
  else await p.evaluate(n => Kyoshi.dev.travel(n), days);
  await p.click("#kDevBadge"); // the panel closes again
}

// The page's visible text in an element.
const text = (tab, selector) => tab.page.locator(selector).first().innerText();

module.exports = { ROOT, PAGE, TODAY, PHONE, DESKTOP, eq, ok, has, lacks, DAY_MS, addDays, mondayOf, at, open, lastDialog, switchTo, importBackup, exportBackup, travel, text };
