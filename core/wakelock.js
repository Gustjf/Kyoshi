/* Kyoshi · core/wakelock.js — keeps the screen on while the app on screen asks for it, as K.wakeLock. An app defines
 * A.awake() (true while its timer runs, a workout is in progress…) and calls K.wakeLock.check() when that changes;
 * core holds one lock for the page while the page is in view and the app on screen says so, and lets go otherwise.
 * Screen Wake Lock where the browser has it: a refusal is quiet (the screen just follows its own settings) and isn't
 * asked again until the page comes back into view or the lock stops being wanted. Also checked when an app comes on
 * screen, keeps a change (A.changed) or reloads another tab's, every minute (core/shell.js), and when the page comes
 * back into view (the browser lets go of the lock while it's hidden). A request still on its way when the lock stops
 * being wanted is let go as soon as it comes; one that never comes is given up after ASK_MS. */
(function (K) {
  "use strict";
  const ASK_MS = 10000;  // a request left unanswered this long is given up on
  let lock = null;       // the browser's lock, while held
  let asking = 0;        // when the request on its way was made (performance.now()), 0 when there's none
  let refused = false;   // the browser said no: not asked again until the page is back or it isn't wanted

  // Whether the screen should stay on now: the page in view, and the app on screen says so (a failing A.awake()
  // is logged, as other hooks are, and counts as no).
  function wanted() {
    const A = K.active && K.active();
    if (!A || !A.started || typeof A.awake !== "function" || document.hidden) return false;
    try { return !!A.awake(); } catch (err) { console.error(`${A.meta.name}'s awake failed.`, err); return false; }
  }

  // Takes or lets go of the lock, to match what's wanted now.
  async function check() {
    try {
      if (!wanted()) {
        refused = false;
        const old = lock;
        lock = null;
        if (old) await old.release();
        return;
      }
      if (lock || refused || (asking && performance.now() - asking < ASK_MS) || !navigator.wakeLock) return;
      const mine = asking = performance.now();
      let got;
      try {
        got = await navigator.wakeLock.request("screen");
      } catch (err) {
        if (asking === mine) refused = true; // not allowed here or now: the screen follows its own settings
        return;
      } finally {
        if (asking === mine) asking = 0;
      }
      // Not wanted any more, or another request got there first: let this one go.
      if (lock || !wanted()) return void got.release().catch(() => {});
      lock = got;
      got.addEventListener("release", () => { if (lock === got) lock = null; }); // the browser let go (the page was hidden)
    } catch (err) {
      /* letting go failed: the browser lets go by itself once the page is hidden */
    }
  }

  // Back in view: the browser may say yes now, and it let go of the lock while the page was hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    refused = false;
    check();
  });

  K.wakeLock = { check, held: () => !!lock };
})(Kyoshi);
