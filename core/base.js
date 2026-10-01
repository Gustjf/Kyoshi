/* Kyoshi · core/base.js — loads first.
 * Owns: the global Kyoshi namespace (K) and console capture for bug reports,
 * so problems while the rest loads are caught too.
 * Every other file adds to K; apps live in K.apps (see core/shell.js). */
(function () {
  "use strict";

  const K = window.Kyoshi = {
    apps: Object.create(null), // id -> app namespace (A), see K.register in shell.js; no built-ins, so "#constructor" names no app
    order: [],       // app ids in the order index.html loads them (the switcher's order)
    testMode: false, // on after time travel (dev.js): nothing is saved or synced until a reload
    dayOffset: 0,    // time travel, in days (util.js todayStr/now read it)
    debugLog: []     // recent console errors and warnings, for bug reports
  };

  const DEBUG_LOG_MAX = 40;
  K.logDebug = (level, message) => {
    K.debugLog.push({ time: new Date().toISOString(), level, message: String(message) });
    if (K.debugLog.length > DEBUG_LOG_MAX) K.debugLog.shift();
  };
  ["error", "warn"].forEach(level => {
    const native = console[level].bind(console);
    console[level] = (...args) => {
      K.logDebug(level, args.map(a => (a && a.stack) || a).join(" "));
      native(...args);
    };
  });
  window.addEventListener("error", e => K.logDebug("error", `${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener("unhandledrejection", e => K.logDebug("error", `Unhandled rejection: ${(e.reason && e.reason.message) || e.reason}`));
})();
