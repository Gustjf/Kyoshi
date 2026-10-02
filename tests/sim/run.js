/* Kyoshi · tests/sim/run.js — the flow simulator (testplan.md): made-up lives lived through the real page, day by day, checked
 * every step. Not part of the site, and not one of tests/run.js's tests (it only reads tests/*.test.js).
 *   node tests/sim/run.js [life…] [--weeks N] [--parallel 3] [--out tests/sim/out] [--mode screens|functions] [--no-shots]
 * life: an id (planner, parent, light, changes, seasons, long) or its number (1–6); none: all six. --weeks N stops each after
 * N weeks (the same seed replays the same life, so a finding's date and step come back). One browser, one profile per life,
 * lives side by side; each writes <out>/<life>.json (and screenshots in <out>/<life>/), then report.js writes
 * tests/sim/report.md from every life's last results. */
"use strict";
const fs = require("fs");
const path = require("path");
const { LIVES, START, weekOf } = require("./lives");
const { Life, addDays, dayIndex } = require("./life");
const day = require("./day");
const report = require("./report");

function playwright() {
  try { return require("playwright"); } catch (err) { /* not local */ }
  return require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright"));
}

function args(argv) {
  const o = { lives: [], weeks: 0, parallel: 3, out: path.join(__dirname, "out"), mode: "", shots: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--weeks") o.weeks = +argv[++i];
    else if (a === "--parallel") o.parallel = +argv[++i];
    else if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--mode") o.mode = argv[++i];
    else if (a === "--no-shots") o.shots = false;
    else o.lives.push(a);
  }
  return o;
}

// The days a life steps through: every day (daily) or Mondays (weekly, whose step does Monday and Sunday), to the Sunday of
// its last week (52 a year), or of week N.
function steps(def, weeks) {
  const last = addDays("2026-10-04", 7 * ((weeks || def.years * 52) - 1)), out = [];
  if (def.step === "weekly") { out.push(START); for (let d = "2026-10-05"; d <= last; d = addDays(d, 7)) out.push(d); }
  else for (let d = START; d <= last; d = addDays(d, 1)) out.push(d);
  return out;
}

async function live(browser, def, o) {
  const L = new Life(def, browser, o), t0 = Date.now(), file = path.join(o.out, `${def.id}.json`);
  const save = () => fs.writeFileSync(file, JSON.stringify({ ...L.result(), seconds: Math.round((Date.now() - t0) / 1000), weeksAsked: o.weeks || def.years * 52 }, null, 1));
  let errors = 0;
  try {
    await L.start();
    for (const date of steps(def, o.weeks)) {
      try {
        if (def.step === "weekly") {
          if (date === START) { await L.clockTo(date, "07:00"); await L.open("phone"); await L.observe("morning"); await day.evening(L, "2026-10-04"); }
          else await day.weekly(L, date);
        } else await day.daily(L, date);
        errors = 0;
      } catch (err) {
        errors++;
        L.simErrors.push({ date, step: L.stepNo, error: String(err && err.stack || err).slice(0, 800) });
        await L.page.screenshot({ path: path.join(L.out, `sim-error-${date}.png`) }).catch(() => {});
        await L.page.keyboard.press("Escape").catch(() => {});
        await L.open(L.device || "phone").catch(() => {});
        if (errors >= 8) throw new Error(`${def.id}: 8 days in a row failed; last: ${err && err.message}`);
      }
      if (dayIndex(date) === 6 || def.step === "weekly") {
        const w = weekOf(date) + 1;
        if (w % 4 === 0) save();
        console.log(`  [${def.id}] week ${w} (${date}) ${Math.round((Date.now() - t0) / 1000)}s · ${L.findings.size} findings · ${L.problems.length} console · ${L.simErrors.length} sim errors`);
      }
    }
  } catch (err) {
    L.simErrors.push({ date: L.today, fatal: true, error: String(err && err.stack || err).slice(0, 800) });
    console.log(`  [${def.id}] stopped: ${err && err.message}`);
  }
  save();
  await L.close();
  console.log(`  [${def.id}] done in ${Math.round((Date.now() - t0) / 1000)}s`);
}

async function main() {
  const o = args(process.argv.slice(2));
  // The longest first, so the shorter ones run beside it.
  const cost = l => l.years * 52 * (l.step === "weekly" ? 0.6 : 1);
  const chosen = LIVES.filter(l => !o.lives.length || o.lives.includes(l.id) || o.lives.includes(String(l.n))).sort((a, b) => cost(b) - cost(a));
  fs.mkdirSync(o.out, { recursive: true });
  const browser = await playwright().chromium.launch();
  const queue = chosen.slice();
  const worker = async () => { while (queue.length) await live(browser, queue.shift(), o); };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.parallel, chosen.length)) }, worker));
  await browser.close();
  report.write(o.out);
  console.log(`report: ${path.relative(process.cwd(), report.FILE)}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
