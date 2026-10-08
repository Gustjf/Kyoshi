/* Kyoshi · tests/wakelock.test.js — the screen kept on (core/wakelock.js), with the browser's Wake Lock stood in for
 * (each request and release counted; a request can be slow or refused): on while a Badgermole workout or Appa's job
 * timer runs, or a recipe is open in Turtleduck's cook view, and that app is on screen; let go on switching apps, Finish,
 * Cancel, stopping the timer, deleting its job or leaving the cook view; asked for again when the page is back after the browser let go; a slow request that arrives after the end let
 * go at once; a refusal not asked again every minute, only once the page is back; and nothing else changes when the
 * browser says no or has no Wake Lock at all. */
"use strict";
const { eq, open, switchTo, importBackup } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");
const td = require("./turtleduck");

// Stands in for navigator.wakeLock, in each page before Kyoshi loads: window.__wake counts what was asked; delay (ms)
// slows the requests, refuse makes them fail (a browser saying no); __wakeDrop() lets go of every lock, as the
// browser does when the page is hidden.
function fakeWakeLock() {
  const w = window.__wake = { requests: 0, releases: 0, held: 0, delay: 0, refuse: false, locks: [] };
  const sentinel = () => {
    const fns = [], s = {
      type: "screen", released: false,
      addEventListener: (type, fn) => { if (type === "release") fns.push(fn); },
      release: async () => { if (s.released) return; s.released = true; w.releases++; w.held--; fns.forEach(fn => fn()); }
    };
    return s;
  };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => {
    w.requests++;
    if (w.delay) await new Promise(r => setTimeout(r, w.delay));
    if (w.refuse) throw new DOMException("Not allowed", "NotAllowedError");
    const s = sentinel();
    w.held++;
    w.locks.push(s);
    return s;
  } } });
  window.__wakeDrop = () => w.locks.forEach(s => s.release());
}
const wake = tab => tab.page.evaluate(() => ({ held: window.__wake.held, requests: window.__wake.requests }));
// Locks held once things settle (requests and releases take a moment).
async function held(tab, n, what) {
  await tab.page.waitForFunction(x => window.__wake.held === x, n, { timeout: 3000 }).catch(() => {});
  eq((await wake(tab)).held, n, what);
}

module.exports = [
  {
    name: "wake lock: Turtleduck's cook view keeps the screen on while it's on screen; Back, Esc and other apps let go",
    async run(t) {
      const tab = await open(t, { app: "turtleduck", init: fakeWakeLock }), p = tab.page;
      await importBackup(tab, gen.turtleduck());
      await td.view(tab, "recipes");
      await held(tab, 0, "nothing while browsing recipes");
      await p.click('#kMount #recipeGroups [data-act="cook"][data-id="rc-chili"]');
      await held(tab, 1, "on in the cook view");
      await switchTo(tab, "momo");
      await held(tab, 0, "let go in another app");
      await switchTo(tab, "turtleduck");
      await held(tab, 1, "on again, the recipe still open");
      await p.click('#kMount [data-act="cook-back"]');
      await held(tab, 0, "let go on Back");
      await p.click('#kMount #recipeGroups [data-act="cook"][data-id="rc-curry"]');
      await held(tab, 1, "on for another recipe");
      await p.keyboard.press("Escape");
      await held(tab, 0, "let go on Esc");
    }
  },
  {
    name: "wake lock: a workout keeps the screen on while Badgermole is on screen; other apps, Finish and Cancel let go",
    async run(t) {
      const tab = await open(t, { init: fakeWakeLock }), p = tab.page;
      await importBackup(tab, gen.setup());
      await held(tab, 0, "nothing before a workout");
      await bm.start(tab, "Push");
      await held(tab, 1, "on during the workout");
      await switchTo(tab, "momo");
      await held(tab, 0, "let go in another app");
      await switchTo(tab, "badgermole");
      await held(tab, 1, "on again back in Badgermole");
      await p.click('#sessionView [data-act="home"]');
      await held(tab, 1, "still on at Home while the workout runs");
      eq((await wake(tab)).requests, 2, "kept, not asked for again");
      // The browser lets go while the page is hidden; back in view, it's asked for again.
      await p.evaluate(() => { window.__wakeDrop(); document.dispatchEvent(new Event("visibilitychange")); });
      await held(tab, 1, "asked for again when the page is back");
      await p.click('#nextUp [data-act="resume"]');
      await p.click("#logBtn");
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      await held(tab, 0, "let go at Finish");
      await p.click("#dayCancelBtn");
      await bm.start(tab, "Pull");
      await held(tab, 1, "on for the next workout");
      await p.click("#cancelSessionBtn");
      await held(tab, 0, "let go on Cancel");
      eq((await wake(tab)).requests, 4, "one request each time it was wanted");
    }
  },
  {
    name: "wake lock: a slow request that arrives after the workout ended is let go at once",
    async run(t) {
      const tab = await open(t, { init: fakeWakeLock }), p = tab.page;
      await importBackup(tab, gen.setup());
      await p.evaluate(() => { window.__wake.delay = 400; });
      await bm.start(tab, "Push");
      await p.click("#cancelSessionBtn"); // before the browser answers
      await p.waitForFunction(() => window.__wake.locks.length === 1 && window.__wake.locks[0].released, null, { timeout: 3000 }).catch(() => {});
      eq(await wake(tab), { held: 0, requests: 1 }, "the late lock was let go");
    }
  },
  {
    name: "wake lock: Appa's job timer keeps the screen on; other apps and stopping it let go, even right after starting",
    async run(t) {
      const tab = await open(t, { app: "appa", init: fakeWakeLock }), p = tab.page;
      await importBackup(tab, gen.appa());
      await p.click('#kMount .row-item[data-act="open-job"][data-id="filter1"]');
      await p.click('#jvActions [data-act="start"]');
      await held(tab, 1, "on while the timer runs");
      await switchTo(tab, "hawky");
      await held(tab, 0, "let go in another app");
      await switchTo(tab, "appa");
      await held(tab, 1, "on again back in Appa");
      await p.click('#jvActions [data-act="cancel-timer"]');
      await held(tab, 0, "let go when the timer stops");
      // Stopped the moment it started: the lock that comes late is let go (Appa used to keep it).
      await p.evaluate(() => { window.__wake.delay = 400; });
      await p.click('#jvActions [data-act="start"]');
      await p.click('#jvActions [data-act="cancel-timer"]');
      await p.waitForFunction(() => window.__wake.requests === 3 && window.__wake.locks.length === 3 && window.__wake.locks.every(s => s.released), null, { timeout: 3000 }).catch(() => {});
      eq(await wake(tab), { held: 0, requests: 3 }, "a late lock after a quick stop is let go");
      // A running timer whose job is deleted no longer keeps the screen on.
      await p.evaluate(() => { window.__wake.delay = 0; });
      await p.click('#jvActions [data-act="start"]');
      await held(tab, 1, "on again");
      await p.click('#jvActions [data-act="edit-job"]');
      await p.click("#jmDeleteBtn");
      await held(tab, 0, "let go once its job is deleted");
    }
  },
  {
    name: "wake lock: a browser that says no, or has no Wake Lock, changes nothing else",
    async run(t) {
      const tab = await open(t, { init: fakeWakeLock }), p = tab.page;
      await importBackup(tab, gen.setup());
      await p.evaluate(() => { window.__wake.refuse = true; });
      await bm.start(tab, "Push");
      await p.click("#logBtn");
      await held(tab, 0, "no lock when the browser says no");
      eq((await wake(tab)).requests, 1, "it was asked");
      await tab.ctx.clock.fastForward(61000);
      eq((await wake(tab)).requests, 1, "and not asked again every minute");
      await p.evaluate(() => { window.__wake.refuse = false; document.dispatchEvent(new Event("visibilitychange")); });
      await held(tab, 1, "asked again when the page is back, and allowed now");
      await p.click("#finishBtn");
      await p.waitForSelector("#dayOverlay.open");
      await p.click("#dayCancelBtn");
      const bare = await open(t, { init: () => Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined }) });
      await importBackup(bare, gen.setup());
      await bm.start(bare, "Push");
      await bare.page.click("#logBtn");
      eq((await bm.screen(bare)).logged.length, 1, "a workout works without Wake Lock");
      await switchTo(bare, "momo");
      await switchTo(bare, "badgermole");
      eq(await bare.page.evaluate(() => Kyoshi.wakeLock.held()), false, "and holds nothing");
    }
  }
];
