/* Kyoshi · tests/harness.test.js — the test helpers themselves (lib.js): the checks fail when they should (NaN is not null,
 * one Set is not another, an empty part is in every text), opening an app that isn't there says so at once (not after
 * 30 s of waiting), and time travel that didn't happen (the test-mode question answered "no") throws instead of passing
 * on. How the runner (run.js) fails a test is not checked here: it is the runner. */
"use strict";
const { eq, ok, has, lacks, open, travel } = require("./lib");

// What fn throws (its message), or "" when it doesn't; async or not.
async function thrown(fn) {
  try { await fn(); } catch (err) { return String(err && err.message || err); }
  return "";
}

module.exports = [
  {
    name: "harness: the checks fail when they should, and say what was expected",
    async run() {
      has(await thrown(() => eq(NaN, null, "nan")), "nan: expected null", "NaN is not null");
      has(await thrown(() => eq(Infinity, -Infinity, "inf")), "inf: expected", "Infinity is not -Infinity");
      has(await thrown(() => eq(new Set([1]), new Set([2]), "set")), "set: expected", "one Set is not another");
      has(await thrown(() => eq(new Map([[1, 2]]), new Map([[1, 3]]), "map")), "map: expected", "one Map is not another");
      has(await thrown(() => eq({ a: [1, 2] }, { a: [1, 3] }, "deep")), `deep: expected {"a":[1,3]}, got {"a":[1,2]}`, "a deep difference, shown");
      eq(await thrown(() => { eq(NaN, NaN, "same"); eq([new Set([1, 2])], [new Set([1, 2])], "same sets"); eq({ a: [1, { b: null }] }, { a: [1, { b: null }] }, "same objects"); }), "", "equal things pass");
      has(await thrown(() => ok(0, "zero")), "zero: not true", "ok fails on a falsy value");
      has(await thrown(() => has("some text", "", "empty")), "empty: nothing to look for", "an empty part isn't found by accident");
      has(await thrown(() => has("some text", "other", "missing")), `missing: expected to find "other"`, "a missing part");
      has(await thrown(() => lacks("some text", "text", "present")), `present: didn't expect "text"`, "a part that is there");
      eq(await thrown(() => { has("some text", "me te", "found"); lacks("some text", "other", "absent"); }), "", "has and lacks pass when they should");
    }
  },
  {
    name: "harness: opening an app that isn't there says so at once; time travel that didn't happen throws",
    async run(t) {
      const t0 = Date.now();
      has(await thrown(() => open(t, { app: "nosuchapp" })), `open nosuchapp: there is no app "nosuchapp"`, "an app that isn't there");
      ok(Date.now() - t0 < 20000, `said at once, not after the 30 s of a wait (${Date.now() - t0} ms)`);
      const tab = await open(t, { app: "momo" });
      await travel(tab, 2);
      eq(await tab.page.evaluate(() => Kyoshi.dayOffset), 2, "two days on");
      eq(await tab.page.evaluate(() => document.body.classList.contains("dev-mode")), false, "the panel is closed again");
      // The test-mode question asked afresh (a new profile), answered "no": nothing moves, and travel says so.
      const fresh = await open(t, { app: "momo" });
      fresh.answers.push(false);
      has(await thrown(() => travel(fresh, 1)), "travel: asked for 1 days, the page moved 0", "a refused time travel throws");
      eq(await fresh.page.evaluate(() => Kyoshi.dayOffset), 0, "and nothing moved");
    }
  }
];
