/* Kyoshi · core/sync.js — the sync engine, as K.sync: what every way of syncing shares. No UI (that's core/backup.js),
 * and no folder of its own: each way of syncing is a transport (the sync folder: core/sync-folder.js).
 * Saves carry version counters (how many changes each device has made) that tell
 * whether another device's save is newer (load it), older (ignore it), or was made while
 * this device also had unsynced changes (combine the two, via the app's A.data.combine).
 * Each save also carries the app's meetings (core/meetings.js), combined meeting by meeting.
 * A transport is { id, init(), state() → "off" | "on" | …, message(), changed(A), request(A?), flush(A?), stopTimers(),
 * dirty(A) }, registered with K.sync.use(t): it brings other devices' saves in through incorporate, then settle, and
 * writes saveOf(A). The engine tells every transport about each change, asks them all to check when the page comes back
 * into view, and to save what's pending when it's hidden or closed.
 * Per app (A._sync): meta { device, file, clock, changedAt, dirty } kept in A.store "sync" (dirty: not in the sync folder
 * yet), plus one object per transport, made by it on first use (A._sync.folder). */
(function (K) {
  "use strict";
  const { isObj, isPos } = K.util;

  const transports = []; // the ways of syncing (use)
  const apps = () => K.order.map(id => K.apps[id]).filter(A => A.started && A._sync);

  // --- Version counters ---
  // A save's counters, { deviceId: changes made there }, minus anything invalid.
  function cleanClock(c) {
    if (!isObj(c)) return null;
    const out = {};
    Object.keys(c).forEach(k => { if (isPos(c[k])) out[k] = c[k]; });
    return out;
  }
  // Whether version a is the "same" as b, "ahead" (has all of b's changes and
  // more), "behind", or "diverged" (each has changes the other doesn't).
  function compareClocks(a, b) {
    let ahead = false, behind = false;
    Object.keys({ ...a, ...b }).forEach(k => {
      if ((a[k] || 0) > (b[k] || 0)) ahead = true;
      if ((a[k] || 0) < (b[k] || 0)) behind = true;
    });
    return ahead && behind ? "diverged" : ahead ? "ahead" : behind ? "behind" : "same";
  }
  const maxClocks = (a, b) => Object.keys(b).reduce((c, k) => ({ ...c, [k]: Math.max(c[k] || 0, b[k]) }), { ...a });

  // --- Each app's sync identity ---
  // This browser's id, shared by every app's save files.
  function deviceId() {
    let id = K.store.get("device");
    if (!/^[a-z0-9]{6}$/.test(id || "")) K.store.set("device", id = Math.random().toString(36).slice(2, 8).padEnd(6, "0"));
    return id;
  }

  // Reads (or makes) an app's sync identity; call after its data is loaded. A new one counts
  // data already here as a change, so a sync folder's data is combined with it rather than replacing it.
  function loadMeta(A) {
    const ch = A._sync || (A._sync = { meta: {} });
    const s = A.store.json("sync"), clock = s && cleanClock(s.clock);
    if (clock && typeof s.device === "string" && typeof s.file === "string") {
      ch.meta = { device: s.device, file: s.file, clock, changedAt: String(s.changedAt || ""), dirty: !!s.dirty };
    } else {
      const device = deviceId(), has = A.data.hasData();
      const kind = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) ? "phone" : "desktop";
      ch.meta = { device, file: `${A.id}-autosave-${kind}-${device}.json`, clock: has ? { [device]: 1 } : {}, changedAt: "", dirty: has };
    }
  }
  const storeMeta = A => A.store.set("sync", JSON.stringify(A._sync.meta));

  // Each change made here counts up this device's version, which is how other
  // devices tell its saves apart from ones they've already seen. changedAt is when the data
  // here last changed (an import's question names it, core/backup.js): not for quiet bookkeeping.
  function markLocalChange(A, quiet = false) {
    const m = A._sync.meta;
    m.clock[m.device] = (m.clock[m.device] || 0) + 1;
    if (!quiet) m.changedAt = new Date().toISOString();
    m.dirty = true; // not in the sync folder yet
    storeMeta(A);
  }

  // Whether some way of syncing is on (its autosave stands in for a backup).
  const on = () => transports.some(t => t.state() === "on");

  // An app kept a change (A.changed): counts it, highlights Export JSON while it's in no
  // backup (unless sync is on, whose autosave stands in for that), and each transport saves it soon.
  function changed(A, unsaved = true, quiet = false) {
    if (K.testMode || !A._sync) return;
    markLocalChange(A, quiet);
    K.backup.setUnsaved(A, unsaved && !on());
    transports.forEach(t => t.changed(A));
  }

  // --- Another device's save in, this device's out ---
  // Brings in another device's save (one a transport found), and its meetings; returns what happened ({ what, data:
  // whether the app's own data changed }), or null if nothing.
  function incorporate(A, raw) {
    const ch = A._sync, clock = raw.sync && cleanClock(raw.sync.clock);
    const rel = clock ? compareClocks(ch.meta.clock, clock) : "plain";
    // A device with no data yet (a new phone, say) takes a save as it is.
    // Plain backups (Export JSON files) are only ever used that way.
    const replace = rel === "behind" || (!A.data.hasData() && (rel === "diverged" || rel === "plain"));
    if (!replace && rel !== "diverged") return null;
    const result = A.data.combine(raw, {
      replace, plain: !clock,
      mine: { savedAt: ch.meta.changedAt, device: ch.meta.device },
      theirs: { savedAt: String(raw.savedAt || ""), device: String((raw.sync && raw.sync.device) || "") }
    });
    if (!result) return null;
    const meet = K.meetings.merge(A, raw.meetings);
    if (clock) ch.meta.clock = maxClocks(ch.meta.clock, clock);
    if (!clock || !result.same || !meet.same) {
      markLocalChange(A); // a version the folder doesn't have yet, so it gets saved there
    } else {
      ch.meta.changedAt = String(raw.savedAt || ch.meta.changedAt);
      storeMeta(A);
    }
    const data = result.apply(), met = meet.apply();
    if (!data && !met) return null; // nothing new here
    return { what: replace ? "Loaded" : "Combined changes with", data };
  }

  // Once a transport brought saves in: the app stores and redraws what came in, if its data changed (meetings are already
  // kept), and the header's meetings and the switcher catch up.
  function settle(A, data) {
    if (data) A.data.afterSync();
    K.meetings.render();
    K.refreshSwitcher();
  }

  // This device's save of an app, as a transport keeps it: its data, when it last changed here, its version counters and
  // its meetings (Import JSON takes one as it is).
  function saveOf(A) {
    const m = A._sync.meta;
    return { ...A.data.build(), savedAt: m.changedAt, sync: { device: m.device, clock: m.clock }, meetings: K.meetings.build(A) };
  }
  // How many changes this device has made to an app (its own counter).
  const version = A => A._sync.meta.clock[A._sync.meta.device] || 0;

  // --- The transports ---
  const use = t => { transports.push(t); };
  // Each one checks for an app (or every app) soon; saves what's pending now; stops its timers (time travel).
  const request = (A = null) => transports.forEach(t => t.request(A));
  const flush = (A = null) => transports.forEach(t => t.flush(A));
  const stopTimers = () => transports.forEach(t => t.stopTimers());
  // For bug reports: "off", or each way of syncing that isn't: "folder on", "folder unsupported".
  function state() {
    const live = transports.filter(t => t.state() !== "off").map(t => `${t.id} ${t.state()}`);
    return live.length ? live.join(", ") : "off";
  }
  // Whether an app has changes some way of syncing hasn't saved yet.
  const dirty = A => transports.some(t => t.dirty(A));

  // Every way of syncing checks again when the page is back in view (or the window gets focus), and a pending save is
  // made straight away when the page is hidden or closed. Then each one starts.
  function init() {
    window.addEventListener("focus", () => request());
    window.addEventListener("pagehide", () => flush());
    document.addEventListener("visibilitychange", () => (document.hidden ? flush() : request()));
    transports.forEach(t => t.init());
  }

  K.sync = { use, init, apps, loadMeta, storeMeta, changed, incorporate, settle, saveOf, version, request, flush, stopTimers, on, state, dirty };
})(Kyoshi);
