/* Kyoshi · core/base.js — loads first.
 * Owns: the global Kyoshi namespace (K) and console capture for bug reports,
 * so problems while the rest loads are caught too.
 * Every other file adds to K; apps live in K.apps (see core/shell.js). */
(function () {
  "use strict";

  const K = window.Kyoshi = {
    apps: Object.create(null), // id -> app namespace (A), see K.register in shell.js; no built-ins, so "#constructor" names no app
    order: [],       // app ids in the order index.html loads them (the switcher's order)
    ready: false,    // true once every app has started (shell.js K.start): until then, one reading the others sees only those before it
    testMode: false, // on after time travel (dev.js): nothing is saved or synced until a reload
    dayOffset: 0,    // time travel, in days (util.js todayStr/now read it)
    debugLog: []     // recent console errors and warnings, for bug reports
  };

  const DEBUG_LOG_MAX = 40;
  K.logDebug = (level, message) => {
    K.debugLog.push({ time: new Date().toISOString(), level, message: String(message) });
    if (K.debugLog.length > DEBUG_LOG_MAX) K.debugLog.shift();
  };
  // An error as its name, message and stack (Safari's and Firefox's stacks leave the message out); anything else as it is.
  const describe = a => {
    if (!a || typeof a !== "object" || !a.message) return (a && a.stack) || a;
    const head = `${a.name || "Error"}: ${a.message}`;
    return !a.stack ? head : String(a.stack).includes(a.message) ? a.stack : `${head}\n${a.stack}`;
  };
  ["error", "warn"].forEach(level => {
    const native = console[level].bind(console);
    console[level] = (...args) => {
      K.logDebug(level, args.map(describe).join(" "));
      native(...args);
    };
  });
  window.addEventListener("error", e => K.logDebug("error", `${e.message} (${e.filename}:${e.lineno})${e.error && e.error.stack ? `\n${e.error.stack}` : ""}`));
  window.addEventListener("unhandledrejection", e => K.logDebug("error", `Unhandled rejection: ${describe(e.reason)}`));
})();
