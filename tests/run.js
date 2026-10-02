/* Kyoshi · tests/run.js — runs the end-to-end tests: the real index.html, opened from disk in Chromium (Playwright),
 * clicked and typed through as the user would, with made-up data (generate.js). Nothing here is part of the app: the
 * site never loads this folder.
 *   node tests/run.js              every test (each *.test.js in this folder)
 *   node tests/run.js session      only those whose name has "session" in it
 * Needs Node 18+ and Playwright with its Chromium (installed globally in Claude's cloud sessions; elsewhere
 * `npm i -g playwright && npx playwright install chromium`). Each test gets a fresh browser profile and a fixed clock
 * (lib.js); a test fails on a failed check, an error, or anything in the console. On a failure, a screenshot of each of
 * its tabs goes to the system's temp folder (kyoshi-tests/). Exit code 1 when any test failed. */
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

const OUT = path.join(os.tmpdir(), "kyoshi-tests"); // screenshots of failed tests (outside the repo)
const TIMEOUT_MS = 90000;

async function main() {
  const filter = process.argv.slice(2).join(" ").toLowerCase();
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort();
  const tests = files.flatMap(f => require(path.join(__dirname, f)).map(x => ({ ...x, file: f })))
    .filter(x => !filter || `${x.file} ${x.name}`.toLowerCase().includes(filter));
  const browser = await playwright().chromium.launch();
  const failed = [];
  const started = Date.now();
  for (const test of tests) {
    const t = { browser, contexts: [], tabs: [], allowProblems: false };
    const t0 = Date.now();
    try {
      await Promise.race([
        test.run(t),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS))
      ]);
      const problems = t.allowProblems ? [] : t.tabs.flatMap(tab => tab.problems);
      if (problems.length) throw new Error(`the console wasn't clean:\n      ${problems.join("\n      ")}`);
      console.log(`  ✓ ${test.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      failed.push(test.name);
      console.log(`  ✗ ${test.name}\n    ${String(err && err.message || err).split("\n").join("\n    ")}`);
      fs.mkdirSync(OUT, { recursive: true });
      for (const [i, tab] of t.tabs.entries()) {
        const file = path.join(OUT, `${test.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${i + 1}.png`);
        await tab.page.screenshot({ path: file, fullPage: true }).catch(() => {});
      }
      if (t.tabs.length) console.log(`    screenshots: ${OUT}`);
    }
    await Promise.all(t.contexts.map(c => c.close().catch(() => {})));
  }
  await browser.close();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${tests.length - failed.length} passed, ${failed.length} failed (${secs}s)${failed.length ? `: ${failed.join("; ")}` : ""}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
