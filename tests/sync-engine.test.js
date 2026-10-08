/* Kyoshi · tests/sync-engine.test.js — the sync engine's decisions (core/sync.js), checked in Node with no browser: the
 * real core/util.js and core/sync.js run in a sandbox with a made-up app and store. A fresh app's identity (its data
 * counts as one change of its own, nothing as none); where a save's counters stand against ours (same, ahead, behind,
 * diverged; invalid counters ignored); which saves come in (one from behind loaded whole, one from ahead ignored, a
 * diverged one combined, a plain backup only into an empty app) and what they do to the counters (the same result takes
 * the save's time, a different one counts as a change here, so the folder and the cloud save it); a transport's saved()
 * marking only a version that didn't move on (here, or in another tab's stored counters); a change here counting up
 * this device and telling every transport, and nothing of that in test mode; the apps' shared merge rule (K.util newer,
 * mergeById, mergeKeys). The audit's Option B (2026-10-08). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ROOT, eq, ok } = require("./lib");

// The engine with one app, "t", loaded: { K, A, calls (what the app's combine was asked, and its afterSync), mem (the
// store, key -> text) }. hasData: whether the app holds anything; combine: what the app's combine returns ({ same,
// nothing: apply finds nothing new }, or null: nothing usable).
function engine({ hasData = true, device = "dev001", combine = {} } = {}) {
  const sandbox = { console, navigator: { userAgent: "Node" }, document: { addEventListener() {} } };
  sandbox.window = sandbox;
  const K = sandbox.Kyoshi = { dayOffset: 0, testMode: false, order: ["t"], apps: {}, refreshSwitcher() {} };
  vm.createContext(sandbox);
  for (const f of ["core/util.js", "core/sync.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
  const mem = new Map();
  const store = prefix => ({
    get: k => (mem.has(prefix + k) ? mem.get(prefix + k) : null),
    set: (k, v) => { mem.set(prefix + k, String(v)); },
    remove: k => { mem.delete(prefix + k); },
    json: k => (mem.has(prefix + k) ? JSON.parse(mem.get(prefix + k)) : null)
  });
  K.store = store("kyoshi.storage.");
  K.store.set("device", device);
  K.backup = { setUnsaved() {} };
  K.meetings = { merge: () => ({ same: true, apply: () => false }), build: () => ({}), render() {} };
  const calls = [];
  const A = {
    id: "t", meta: { name: "T" }, started: true, store: store("kyoshi.t."),
    data: {
      hasData: () => hasData,
      build: () => ({ items: [] }),
      afterSync() { calls.push("afterSync"); },
      combine(raw, how) {
        calls.push({ raw, how });
        return combine === null ? null : { same: !!combine.same, apply: () => !combine.nothing };
      }
    }
  };
  K.apps.t = A;
  K.sync.loadMeta(A);
  return { K, A, calls, mem };
}
const stored = (mem, key = "kyoshi.t.sync") => JSON.parse(mem.get(key));
const save = (clock, savedAt = "2026-09-30T10:00:00.000Z") => ({ items: [1], savedAt, sync: { device: "ph0001", clock } });

module.exports = [
  {
    name: "sync engine: a fresh app counts what it holds as one change of its own, an empty one as none, and keeps its identity",
    async run() {
      const { K, A, mem } = engine();
      eq(A._sync.meta.clock, { dev001: 1 }, "its data is a change this device made");
      eq([A._sync.meta.device, A._sync.meta.file, A._sync.meta.dirty, A._sync.meta.pushed], ["dev001", "t-autosave-desktop-dev001.json", true, 0], "its identity");
      eq(K.sync.version(A), 1, "its own counter");
      ok(!mem.has("kyoshi.t.sync"), "nothing stored until a change or a save comes in");
      K.sync.storeMeta(A);
      eq(stored(mem).clock, { dev001: 1 }, "stored as it is");
      const e = engine({ hasData: false });
      eq([e.A._sync.meta.clock, e.A._sync.meta.dirty, e.K.sync.version(e.A)], [{}, false, 0], "an empty app has made no change");
      // Stored counters are read back, invalid ones dropped; a damaged record starts afresh.
      e.A.store.set("sync", JSON.stringify({ device: "dev001", file: "f.json", clock: { dev001: 3, ph0001: 2, bad: -1, worse: "x" }, changedAt: "2026-09-29T08:00:00.000Z", dirty: false, pushed: 3 }));
      e.K.sync.loadMeta(e.A);
      eq(e.A._sync.meta, { device: "dev001", file: "f.json", clock: { dev001: 3, ph0001: 2 }, changedAt: "2026-09-29T08:00:00.000Z", dirty: false, pushed: 3 }, "read back, cleaned");
      e.A.store.set("sync", JSON.stringify({ clock: "nope" }));
      e.K.sync.loadMeta(e.A);
      eq(e.A._sync.meta.clock, {}, "a damaged record starts afresh");
    }
  },
  {
    name: "sync engine: where a save's counters stand against ours — same, ahead, behind, diverged; invalid ones are ignored",
    async run() {
      const { K, A } = engine();
      A._sync.meta.clock = { dev001: 2, ph0001: 1 };
      eq(K.sync.relation(A, { dev001: 2, ph0001: 1 }), "same", "the same");
      eq(K.sync.relation(A, { dev001: 2 }), "ahead", "we have a change it lacks");
      eq(K.sync.relation(A, {}), "ahead", "and against nothing at all");
      eq(K.sync.relation(A, { dev001: 2, ph0001: 3 }), "behind", "it has changes we lack");
      eq(K.sync.relation(A, { dev001: 2, ph0001: 1, tab001: 1 }), "behind", "a device we never saw counts too");
      eq(K.sync.relation(A, { dev001: 1, ph0001: 2 }), "diverged", "each has changes the other lacks");
      eq(K.sync.relation(A, { dev001: 2, ph0001: 1, bad: 0, worse: -4, odd: "7" }), "same", "counters that aren't positive numbers are ignored");
      eq(K.sync.relation(A, null), "ahead", "no counters at all: a plain backup");
    }
  },
  {
    name: "sync engine: a save from behind is loaded whole, one from ahead ignored, a diverged one combined; a plain backup fills only an empty app",
    async run() {
      let e = engine();
      // Behind: loaded whole (replace), and its counters join ours.
      let r = e.K.sync.incorporate(e.A, save({ dev001: 1, ph0001: 1 }));
      eq(r, { what: "Loaded", data: true }, "loaded");
      eq(e.calls.length, 1, "combine asked once");
      eq(e.calls[0].how, { replace: true, plain: false, mine: { savedAt: "", device: "dev001" }, theirs: { savedAt: "2026-09-30T10:00:00.000Z", device: "ph0001" } }, "asked to replace, with both sides' times");
      eq(e.A._sync.meta.clock, { dev001: 2, ph0001: 1 }, "its counters joined ours, and the new data counts as a change here (a different result)");
      // Ahead, and the same: nothing happens.
      eq(e.K.sync.incorporate(e.A, save({ dev001: 1 })), null, "a save we're ahead of is ignored");
      eq(e.K.sync.incorporate(e.A, save({ dev001: 2, ph0001: 1 })), null, "and one the same as ours");
      eq(e.K.sync.incorporate(e.A, save({ dev001: 0, ph0001: -1 })), null, "all-invalid counters: an empty clock, which we're ahead of");
      eq(e.calls.length, 1, "combine not asked for any of those");
      const empty = engine({ hasData: false });
      eq(empty.K.sync.incorporate(empty.A, save({ dev001: 0, ph0001: -1 })), null, "an empty clock is still a clock: an empty app ignores it too (unlike a plain backup, below)");
      // Diverged: combined (not replaced).
      r = e.K.sync.incorporate(e.A, save({ dev001: 1, ph0001: 2 }));
      eq(r, { what: "Combined changes with", data: true }, "combined");
      eq(e.calls[1].how.replace, false, "not replaced");
      eq(e.A._sync.meta.clock, { dev001: 3, ph0001: 2 }, "both sides' counters, and the combined result is a change here");
      // A plain backup (no counters): an app with data never takes it; an empty app does, whole.
      eq(e.K.sync.incorporate(e.A, { items: [1] }), null, "a plain backup is ignored by an app with data");
      eq(e.calls.length, 2, "combine not asked");
      e = engine({ hasData: false });
      r = e.K.sync.incorporate(e.A, { items: [1], savedAt: "2026-09-29T00:00:00.000Z" });
      eq(r, { what: "Loaded", data: true }, "an empty app takes a plain backup whole");
      eq([e.calls[0].how.replace, e.calls[0].how.plain], [true, true], "told it's plain");
      eq(e.A._sync.meta.clock, { dev001: 1 }, "and counts it as its own change (no counters came with it)");
      // An empty app takes a diverged save whole too (nothing of its own to keep).
      e = engine({ hasData: false });
      e.A._sync.meta.clock = { dev001: 1 };
      r = e.K.sync.incorporate(e.A, save({ ph0001: 1 }));
      eq(e.calls[0].how.replace, true, "diverged, but nothing here: taken whole");
      // The app finding nothing usable: nothing changes.
      e = engine({ combine: null });
      eq(e.K.sync.incorporate(e.A, save({ dev001: 1, ph0001: 1 })), null, "nothing usable in it");
      eq(e.A._sync.meta.clock, { dev001: 1 }, "counters untouched");
    }
  },
  {
    name: "sync engine: a save that leaves us the same takes its time without counting a change; nothing new here is nothing; saved() marks only a version that didn't move on",
    async run() {
      let e = engine({ combine: { same: true } });
      e.A._sync.meta.changedAt = "2026-09-28T00:00:00.000Z";
      let r = e.K.sync.incorporate(e.A, save({ dev001: 1, ph0001: 1 }, "2026-09-30T10:00:00.000Z"));
      eq(r, { what: "Loaded", data: true }, "loaded");
      eq(e.A._sync.meta.clock, { dev001: 1, ph0001: 1 }, "their counters joined, ours not counted up: the folder has this version already");
      eq(e.A._sync.meta.changedAt, "2026-09-30T10:00:00.000Z", "the save's time is ours now");
      eq(stored(e.mem).clock, { dev001: 1, ph0001: 1 }, "stored");
      // Loaded whole but nothing new in it (apply false): the counters still join, and nothing is reported.
      e = engine({ combine: { same: true, nothing: true } });
      eq(e.K.sync.incorporate(e.A, save({ dev001: 1, ph0001: 1 })), null, "nothing new here");
      eq(e.A._sync.meta.clock, { dev001: 1, ph0001: 1 }, "but its counters are ours now, so it isn't read again");
      // saved(): a transport saved version v; marked unless the app changed since, here or in another tab's stored counters.
      e = engine();
      e.K.sync.storeMeta(e.A);
      ok(e.K.sync.saved(e.A, 1, { dirty: false }), "version 1 saved");
      eq([e.A._sync.meta.dirty, stored(e.mem).dirty], [false, false], "marked, here and in the store");
      e.K.sync.changed(e.A);
      eq(e.K.sync.version(e.A), 2, "a change here counts up");
      ok(!e.K.sync.saved(e.A, 1, { dirty: false }), "a stale save marks nothing");
      ok(e.A._sync.meta.dirty && stored(e.mem).dirty, "still dirty");
      e.A.store.set("sync", JSON.stringify({ ...stored(e.mem), clock: { dev001: 3 } })); // another tab of this browser changed it
      ok(!e.K.sync.saved(e.A, 2, { dirty: false }), "another tab moved on: not marked");
      e.A.store.set("sync", JSON.stringify({ ...stored(e.mem), clock: { dev001: 2 }, pushed: 0 }));
      ok(e.K.sync.saved(e.A, 2, { pushed: 2 }), "the cloud's mark, once they agree");
      eq([e.A._sync.meta.pushed, stored(e.mem).pushed, stored(e.mem).dirty], [2, 2, true], "only that field written, the rest as stored");
    }
  },
  {
    name: "sync engine: a change here counts up this device and tells every transport; test mode counts nothing; a quiet change keeps the data's time",
    async run() {
      const { K, A, mem } = engine();
      const told = [];
      const transport = id => ({ id, init() {}, state: () => "on", message: () => "", changed: a => told.push(`${id}:${a.id}`), request() {}, flush() {}, stopTimers() {}, dirty: () => false });
      K.sync.use(transport("folder"));
      K.sync.use(transport("cloud"));
      eq(K.sync.apps().map(a => a.id), ["t"], "the apps that sync");
      eq(K.sync.state(), "folder on, cloud on", "both on");
      ok(K.sync.on(), "some way of syncing is on");
      A._sync.meta.changedAt = "2000-01-01T00:00:00.000Z";
      K.sync.changed(A, true, true); // quiet: the app's own bookkeeping
      eq([K.sync.version(A), A._sync.meta.changedAt], [2, "2000-01-01T00:00:00.000Z"], "counted, the data's time kept");
      K.sync.changed(A);
      eq(K.sync.version(A), 3, "counted again");
      ok(A._sync.meta.changedAt > "2000-01-01T00:00:00.000Z", "the data's time is now");
      eq(told, ["folder:t", "cloud:t", "folder:t", "cloud:t"], "every transport told, each time");
      eq(stored(mem).clock, { dev001: 3 }, "stored each time");
      eq(K.sync.saveOf(A).sync, { device: "dev001", clock: { dev001: 3 } }, "what a transport writes carries the counters");
      K.testMode = true;
      K.sync.changed(A);
      eq([K.sync.version(A), told.length], [3, 4], "test mode: nothing counted, no one told");
    }
  },
  {
    name: "sync engine: the apps' shared merge rule (K.util): the later u wins, a tie by the text; by id, ours in order then theirs' new ones; by key, sorted, a missing side the other's",
    async run() {
      const { newer, mergeById, mergeKeys } = engine().K.util;
      ok(newer({ u: 2 }, { u: 1 }) && !newer({ u: 1 }, { u: 2 }), "the later u wins");
      ok(newer({ u: 1, x: "b" }, { u: 1, x: "a" }) && !newer({ u: 1, x: "a" }, { u: 1, x: "b" }), "a tie goes by the text, so every device picks the same");
      ok(!newer({ u: 1, x: "a" }, { u: 1, x: "a" }), "never newer than itself");
      eq(mergeById([{ id: "a", u: 1 }, { id: "b", u: 5 }], [{ id: "c", u: 1 }, { id: "b", u: 3 }, { id: "a", u: 2 }]),
        [{ id: "a", u: 2 }, { id: "b", u: 5 }, { id: "c", u: 1 }], "each id's later change: ours in our order, then theirs' new ones");
      eq(mergeById([{ id: "a", u: 1 }], [{ id: "a", u: 3 }, { id: "a", u: 2 }]), [{ id: "a", u: 3 }], "an id theirs repeats: its latest");
      eq(mergeKeys({ b: { u: 1 }, a: { u: 5 } }, { c: { u: 2 }, a: { u: 3 }, b: null }), { a: { u: 5 }, b: { u: 1 }, c: { u: 2 } },
        "each key's later change, a side missing or empty taken from the other, the keys sorted");
      eq(mergeKeys({}, { constructor: { u: 1 } }), { constructor: { u: 1 } }, "own keys only: one named like an object's built-in still comes in");
    }
  }
];
