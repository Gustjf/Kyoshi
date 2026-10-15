/* Kyoshi · tests/run.js — runs the end-to-end tests: the real index.html, opened from disk in Chromium (Playwright),
 * clicked and typed through as the user would, with made-up data (generate.js). Nothing here is part of the app: the
 * site never loads this folder.
 *   node tests/run.js                  every test (each *.test.js in this folder), several side by side
 *   node tests/run.js session          only those whose name has "session" in it
 *   node tests/run.js --parallel 2 …   2 at a time (default: twice the core count, as measured on 4 cores: 1 at a
 *                                      time 173 s, 2 98 s, 3 79 s, 4 69 s, 6 62 s, 8 58 s, before launchBrowser below;
 *                                      the tests are CPU-bound: ~2.7 CPU-seconds each over the whole process tree
 *                                      (browser, pages, GPU, Node; measured under load), of which `time` shows only
 *                                      about 40%, the rest being processes it can't reap)
 *   node tests/run.js --serial …       one at a time (= --parallel 1)
 * Needs Node 18+ and Playwright with its Chromium (installed globally in Claude's cloud sessions; elsewhere
 * `npm i -g playwright && npx playwright install chromium`). One browser (launchBrowser); each test gets fresh browser
 * profiles of its own (contexts) and a fixed clock (lib.js), so tests side by side share nothing but the browser. A test with
 * `serial: true` (one that measures speed) runs alone, after the others. Longest first, from the last run's times
 * (kyoshi-tests/times.json in the system's temp folder), so the long ones don't finish last and alone; each line prints
 * as its test finishes (only the tests that passed leave their time). A test fails on a failed check, an error, anything
 * in the console (any tab; a last look at each page first, so what it wrote just before the end counts, and a page
 * that no longer answers fails), a promise nobody awaited that failed (a forgotten `await`: named, and the run goes
 * on) or 90 s; on a failure, its console lines are listed and a screenshot of each of its tabs goes to the temp folder
 * (kyoshi-tests/). Exit code 1 when any test failed or none matches the filter; 2 for a bad option. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");

// Playwright from this folder's node_modules, the global install, or NODE_PATH.
function playwright() {
  try { return require("playwright"); } catch (err) { /* not local */ }
  const root = require("child_process").execSync("npm root -g").toString().trim();
  return require(path.join(root, "playwright"));
}

// The one browser. Two of Playwright's defaults cost the tests about a tenth of their CPU (14-test sample, whole process
// tree, median of 3 under heavy load: 40.7 → 36.4 CPU-seconds, 84 → 57 s wall): --disable-dev-shm-usage keeps Chromium's
// shared memory (a file per file:// load) in /tmp, a real disk on many machines, so it's dropped when /dev/shm has room;
// and Chromium streams each of the page's ~160 file:// scripts on a worker thread of its own (~100 threads per page, each
// one re-read by the browser from /proc), so that one feature is turned off (ScriptStreamingForNonHTTP; nothing the page
// or a test can see). Chromium keeps only the last --disable-features, so Playwright's own list is read back from a first
// launch and kept; if anything here fails, the plain browser is used (same behaviour, only slower).
async function launchBrowser(chromium) {
  const opts = {};
  try { const st = fs.statfsSync("/dev/shm"); if (st.bavail * st.bsize >= 2 ** 30) opts.ignoreDefaultArgs = ["--disable-dev-shm-usage"]; } catch (err) { /* no /dev/shm, or an older Node */ }
  const first = await chromium.launch(opts);
  let own;
  try {
    const { arguments: argv } = await (await first.newBrowserCDPSession()).send("Browser.getBrowserCommandLine");
    own = (argv.find(a => a.startsWith("--disable-features=")) || "--disable-features=").slice("--disable-features=".length);
  } catch (err) { return first; }
  await first.close();
  return chromium.launch({ ...opts, args: [`--disable-features=${[own, "ScriptStreamingForNonHTTP"].filter(Boolean).join(",")}`] });
}

const OUT = path.join(os.tmpdir(), "kyoshi-tests"); // screenshots of failed tests and times.json (outside the repo)
const TIMES = path.join(OUT, "times.json");
const TIMEOUT_MS = 90000;
const SETTLE_MS = 100; // after a test's last step: what the page does a moment later (a debounced save, a timer) still counts

// A failed promise nobody awaited (a forgotten `await`) would crash the whole run: it's named after the test it was made
// in, and the run goes on to fail at the end.
const inTest = new AsyncLocalStorage();
const strays = [];
process.on("unhandledRejection", err => {
  const t = inTest.getStore(), name = t ? t.name : "a promise made outside any test";
  strays.push(name);
  console.log(`  ✗ ${name}\n    a promise nobody awaited failed (a forgotten await?):\n    ${String(err && err.stack || err).split("\n").join("\n    ")}`);
  process.exitCode = 1;
});

// --parallel N / --serial; the other words are the filter.
function args(argv) {
  let parallel = 2 * os.cpus().length;
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--serial") parallel = 1;
    else if (argv[i] === "--parallel") {
      if (!/^\d+$/.test(argv[i + 1] || "")) usage("--parallel needs a number");
      parallel = Math.max(1, +argv[++i]);
    } else if (argv[i].startsWith("--")) usage(`unknown option ${argv[i]}`);
    else words.push(argv[i]);
  }
  return { parallel, filter: words.join(" ").toLowerCase() };
}
function usage(why) { console.error(`${why}\nusage: node tests/run.js [--serial | --parallel N] [filter words]`); process.exit(2); }

function readTimes() {
  try { const times = JSON.parse(fs.readFileSync(TIMES, "utf8")); return times && typeof times === "object" ? times : {}; } catch (err) { return {}; }
}
// Adds this run's times to the file as it is now (a run beside this one may have added its own), swapped in whole so no
// run reads half a file. Only an aid to the order: if it can't be written, the run's result still counts.
function saveTimes(ms) {
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const tmp = `${TIMES}.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ ...readTimes(), ...ms }, null, 1));
    fs.renameSync(tmp, TIMES);
  } catch (err) { /* the next run just starts without them */ }
}

// Whether a page answers (a closed one counts: the test did that) within 5 s.
const answers = page => new Promise(done => {
  const timer = setTimeout(() => done(false), 5000);
  page.evaluate(() => 0).then(() => true, () => true).then(yes => { clearTimeout(timer); done(yes); });
});

// One test: its own t (contexts, tabs), the 90 s limit, the console check, its line (a failure's whole block in one
// write, so lines side by side never interleave), screenshots, its contexts closed. t.over: it has ended (or timed out);
// a test still running by then opens nothing more.
async function runOne(browser, test) {
  const t = { name: test.name, browser, contexts: [], tabs: [], allowProblems: false, over: false };
  const t0 = Date.now();
  const problems = () => t.allowProblems ? [] : t.tabs.flatMap(tab => tab.problems);
  const shown = () => problems().slice(0, 12).concat(problems().length > 12 ? [`… and ${problems().length - 12} more`] : []).join("\n").split("\n").join("\n      "); // a line may have a stack under it
  let timer, ok = true;
  try {
    await Promise.race([
      inTest.run(t, () => test.run(t)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS); })
    ]);
    // A moment for what the page does next, then the lines it has written are all here: they come in order ahead of its
    // answer to anything asked of it.
    await new Promise(r => setTimeout(r, SETTLE_MS));
    if ((await Promise.all(t.tabs.map(tab => answers(tab.page)))).includes(false)) throw new Error("a page stopped answering at the end of the test (stuck in a loop?)");
    if (problems().length) throw new Error(`the console wasn't clean:\n      ${shown()}`);
    console.log(`  ✓ ${test.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (err) {
    ok = false;
    const lines = [`  ✗ ${test.name}\n    ${String(err && err.message || err).split("\n").join("\n    ")}`];
    if (problems().length && !/^the console wasn't clean/.test(String(err && err.message))) lines.push(`    and the console wasn't clean:\n      ${shown()}`);
    fs.mkdirSync(OUT, { recursive: true });
    for (const [i, tab] of t.tabs.entries()) {
      const file = path.join(OUT, `${test.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 100)}-${i + 1}.png`); // a file name can't be long
      await tab.page.screenshot({ path: file, fullPage: true, timeout: 10000 }).catch(() => {});
    }
    if (t.tabs.length) lines.push(`    screenshots: ${OUT}`);
    console.log(lines.join("\n"));
  } finally {
    clearTimeout(timer);
    t.over = true;
  }
  await Promise.all(t.contexts.map(c => c.close().catch(() => {})));
  return { name: test.name, ok, ms: Date.now() - t0 };
}

async function main() {
  const { parallel, filter } = args(process.argv.slice(2));
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort();
  const times = readTimes();
  const every = files.flatMap(f => require(path.join(__dirname, f)).map(x => ({ ...x, file: f })));
  const tests = every.filter(x => !filter || `${x.file} ${x.name}`.toLowerCase().includes(filter))
    .sort((a, b) => (times[b.name] || 0) - (times[a.name] || 0)); // stable: file order without times
  if (!tests.length) { console.log(`no test matches "${filter}" (of ${every.length})`); process.exitCode = 1; return; }
  const queue = tests.filter(x => !x.serial), alone = tests.filter(x => x.serial);
  const browser = await launchBrowser(playwright().chromium);
  const results = [];
  const started = Date.now();
  const width = Math.min(parallel, queue.length) || 1;
  const worker = async () => { while (queue.length) results.push(await runOne(browser, queue.shift())); };
  await Promise.all(Array.from({ length: queue.length ? width : 0 }, worker));
  for (const test of alone) results.push(await runOne(browser, test));
  await browser.close();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  saveTimes(Object.fromEntries(results.filter(r => r.ok).map(r => [r.name, r.ms]))); // a failure's time (cut short, or the 90 s) says nothing of the test
  const failed = results.filter(r => !r.ok).map(r => r.name).concat(strays.map(name => `${name} (a promise nobody awaited)`));
  const slowest = results.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(r => `${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
  console.log(`\n${results.filter(r => r.ok).length} passed, ${failed.length} failed (${secs}s, ${width} at a time)${failed.length ? `: ${failed.join("; ")}` : ""}`);
  if (slowest.length) console.log(`slowest: ${slowest.join("; ")}`);
  process.exitCode = failed.length ? 1 : 0;
}

// Then out, whatever a test left running (a timer of its own that outlived the browser would keep the process alive).
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(), 2000).unref());
