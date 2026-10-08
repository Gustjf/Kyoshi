/* Kyoshi · tests/run.js — runs the end-to-end tests: the real index.html, opened from disk in Chromium (Playwright),
 * clicked and typed through as the user would, with made-up data (generate.js). Nothing here is part of the app: the
 * site never loads this folder.
 *   node tests/run.js                  every test (each *.test.js in this folder), several side by side
 *   node tests/run.js session          only those whose name has "session" in it
 *   node tests/run.js --parallel 2 …   2 at a time (default: twice the core count, as measured on 4 cores: 1 at a
 *                                      time 173 s, 2 98 s, 3 79 s, 4 69 s, 6 62 s, 8 58 s; a test waits on its page
 *                                      as much as it works)
 *   node tests/run.js --serial …       one at a time (= --parallel 1)
 * Needs Node 18+ and Playwright with its Chromium (installed globally in Claude's cloud sessions; elsewhere
 * `npm i -g playwright && npx playwright install chromium`). One browser; each test gets fresh browser profiles of its
 * own (contexts) and a fixed clock (lib.js), so tests side by side share nothing but the browser. A test with
 * `serial: true` (one that measures speed) runs alone, after the others. Longest first, from the last run's times
 * (kyoshi-tests/times.json in the system's temp folder), so the long ones don't finish last and alone; each line prints
 * as its test finishes. A test fails on a failed check, an error, anything in the console, or 90 s; on a failure, a
 * screenshot of each of its tabs goes to the temp folder (kyoshi-tests/). Exit code 1 when any test failed. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

// Playwright from this folder's node_modules, the global install, or NODE_PATH.
function playwright() {
  try { return require("playwright"); } catch (err) { /* not local */ }
  const root = require("child_process").execSync("npm root -g").toString().trim();
  return require(path.join(root, "playwright"));
}

const OUT = path.join(os.tmpdir(), "kyoshi-tests"); // screenshots of failed tests and times.json (outside the repo)
const TIMES = path.join(OUT, "times.json");
const TIMEOUT_MS = 90000;

// --parallel N / --serial; the other words are the filter.
function args(argv) {
  let parallel = 2 * os.cpus().length;
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--serial") parallel = 1;
    else if (argv[i] === "--parallel") parallel = Math.max(1, parseInt(argv[++i], 10) || 1);
    else words.push(argv[i]);
  }
  return { parallel, filter: words.join(" ").toLowerCase() };
}

function readTimes() {
  try { return JSON.parse(fs.readFileSync(TIMES, "utf8")); } catch (err) { return {}; }
}

// One test: its own t (contexts, tabs), the 90 s limit, the console check, its line (a failure's whole block in one
// write, so lines side by side never interleave), screenshots, its contexts closed.
async function runOne(browser, test) {
  const t = { browser, contexts: [], tabs: [], allowProblems: false };
  const t0 = Date.now();
  let timer, ok = true;
  try {
    await Promise.race([
      test.run(t),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS); })
    ]);
    const problems = t.allowProblems ? [] : t.tabs.flatMap(tab => tab.problems);
    if (problems.length) throw new Error(`the console wasn't clean:\n      ${problems.join("\n      ")}`);
    console.log(`  ✓ ${test.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (err) {
    ok = false;
    const lines = [`  ✗ ${test.name}\n    ${String(err && err.message || err).split("\n").join("\n    ")}`];
    fs.mkdirSync(OUT, { recursive: true });
    for (const [i, tab] of t.tabs.entries()) {
      const file = path.join(OUT, `${test.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${i + 1}.png`);
      await tab.page.screenshot({ path: file, fullPage: true }).catch(() => {});
    }
    if (t.tabs.length) lines.push(`    screenshots: ${OUT}`);
    console.log(lines.join("\n"));
  } finally {
    clearTimeout(timer);
  }
  await Promise.all(t.contexts.map(c => c.close().catch(() => {})));
  return { name: test.name, ok, ms: Date.now() - t0 };
}

async function main() {
  const { parallel, filter } = args(process.argv.slice(2));
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort();
  const times = readTimes();
  const tests = files.flatMap(f => require(path.join(__dirname, f)).map(x => ({ ...x, file: f })))
    .filter(x => !filter || `${x.file} ${x.name}`.toLowerCase().includes(filter))
    .sort((a, b) => (times[b.name] || 0) - (times[a.name] || 0)); // stable: file order without times
  const queue = tests.filter(x => !x.serial), alone = tests.filter(x => x.serial);
  const browser = await playwright().chromium.launch();
  const results = [];
  const started = Date.now();
  const worker = async () => { while (queue.length) results.push(await runOne(browser, queue.shift())); };
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));
  for (const test of alone) results.push(await runOne(browser, test));
  await browser.close();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(TIMES, JSON.stringify({ ...times, ...Object.fromEntries(results.map(r => [r.name, r.ms])) }, null, 1));
  const failed = results.filter(r => !r.ok).map(r => r.name);
  const slowest = results.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(r => `${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${secs}s, ${Math.min(parallel, tests.length) || 1} at a time)${failed.length ? `: ${failed.join("; ")}` : ""}`);
  if (slowest.length) console.log(`slowest: ${slowest.join("; ")}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
