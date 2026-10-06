/* Kyoshi · core/cloud.js — cloud sync through a private GitHub repository, as K.cloud: a transport of the sync engine
 * (core/sync.js), beside the sync folder (core/sync-folder.js). No UI: core/cloud-ui.js draws Developer Mode's Cloud
 * block, the banner and the header's glyph (K.cloudUI.render(), called on every change here). Entering a key, making
 * one, a new token, Disconnect and the decrypted copies are core/cloud-key.js's (added to K.cloud).
 * Each app's save (K.sync.saveOf: what the sync folder writes) is locked with the key's secret (core/cloud-crypto.js)
 * and kept as one file, data/<app id>.json, in the repository (core/github.js), one commit per save. A device with the
 * key checks every CLOUD_CHECK_MS while Kyoshi is in view, when it's back in view or online, and a few seconds after a
 * change: one listing of data/ tells which apps' files changed; each of those is read and brought in first
 * (K.sync.incorporate: the newer taken, both sides' changes combined), then an app with changes the cloud lacks is
 * saved, guarded by GitHub's own check (the file's sha): a clash reads again and tries again. One check at a time (and
 * one tab at a time, where the browser has locks). A check that doesn't get through is tried again after RETRY_MS,
 * then waiting longer; lost() (the banner and the glyph) once none got through since Kyoshi opened, for CLOUD_LOST_MS
 * after a failure, or while the browser says it's offline.
 * The key: localStorage "kyoshi.cloud" (a preference, never taken for data: core/storage.js) = { key, at, remember,
 * okAt } (at: this page's address; okAt: when a check last got through; core/cloud-upkeep.js adds the token's end and
 * the history's tidy), or sessionStorage (checked first; gone with the tab) when Remember on this device is unticked.
 * Per app (A._sync.cloud): sha and clock (version counters) of its file as this device last read or wrote it, note (the
 * last thing done), timer, savedAt; and in the engine's meta, pushed: this device's own counter at its last save there.
 * Safety rules:
 * - Only data/<app>.json and KYOSHI.md are ever written: no photo, PDF or other binary, and K.files is never read.
 * - Never push over a file this key can't read, or one saved by a newer Kyoshi: the cloud stops ("error") until then.
 * - Never delete a file (core/github.js has no call for it).
 * - A public repository is refused.
 * - Test mode (time travel) does nothing.
 * - A key saved for another page address (another copy of Kyoshi) stays unused.
 * - fetch goes to https://api.github.com only (core/github.js).
 * - No key, token, repository name or data in console lines, bug reports or tests.
 * - A device with data that connects combines with the cloud (the apps' combine, as with a new sync folder): it never
 *   replaces either side blindly. */
(function (K) {
  "use strict";
  const { isObj, isPos, clockTime } = K.util;
  const C = K.cloudCrypto;
  const CLOUD_CHECK_MS = 60000;     // how often the cloud is checked while Kyoshi is in view
  const CLOUD_PUSH_DELAY_MS = 4000; // changes made in a row go up as one save…
  const CLOUD_GAP_MS = 15000;       // …and an app is saved at most this often (GitHub allows 500 saves an hour)
  const CLOUD_LOST_MS = 90000;      // a check failing this long: lost
  const RETRY_MS = 30000, RETRY_MAX_MS = 600000; // after a failure: again in 30 s, then waiting longer, up to 10 minutes
  const TRIES = 3;                  // a save that clashes with another device's is read again and tried, at most this often
  const LOCK_TRIES = 15;            // another tab checking this many times in a row (a minute): check anyway
  const PREF = "kyoshi.cloud";
  const APP_FILE = /^data\/([a-z][a-z0-9]*)\.json$/; // an app's file in the repository (the only kind written but KYOSHI.md)
  const pathOf = A => `data/${A.id}.json`;
  // Why the token or repository was refused: the cloud waits for a new key.
  const NEEDS = {
    auth: "GitHub no longer accepts the token in your key (expired or revoked). Make a new token with the same settings and tap Update token…, then paste the new key on your other devices.",
    forbidden: "GitHub won't let the token in your key save to the repository: it needs Contents: Read and write. Make a new token with that and tap Update token…, then paste the new key on your other devices.",
    notfound: "That repository can't be found with this token: it may have been renamed or deleted, or the token no longer reaches it. Make a new token and tap Update token…, or set the cloud up again."
  };

  let rec = null;      // the key record in use: { key, at, remember, okAt }
  let key = null;      // its parts: { repo, token, secret }
  let client = null;   // core/github.js, for its repository
  let lock = null;     // the secret as a Web Crypto key (a promise)
  let state = "off";   // "off" | "on" | "needs-key" (the token or repository refused) | "error" (a file it mustn't save over)
  let why = "";        // the code that stopped it (auth, forbidden, notfound; key, format, newer)
  let message = "";    // why, in needs-key and error; when off, a word about a key saved here for another copy
  let busy = "";       // "Saving Momo…", while a check runs
  let okAt = 0, failedAt = 0, failure = "", until = 0; // a check last got through; the first failure since (and its code); a rate limit's end
  let reachedSinceOpen = false; // a check got through since the key was taken up here (Kyoshi opened, or a key entered)
  let checkedAt = 0, etag = "", listing = new Map(); // the last check: when, and data/'s files (path → sha)
  let queue = Promise.resolve(), queued = false, retryTimer = 0, retryDue = 0, lostTimer = 0, lockMisses = 0;
  let generation = 0;  // a new key or none: a check still running for the old one stops

  const ui = () => { if (K.cloudUI) K.cloudUI.render(); };
  const say = text => { busy = text; ui(); };
  const apps = () => K.sync.apps();
  const cl = A => A._sync.cloud || (A._sync.cloud = { sha: "", clock: null, note: "", timer: 0, savedAt: 0 });
  const live = () => state === "on" && !!client && !K.testMode;
  const waiting = A => K.sync.version(A) > (A._sync.meta.pushed || 0); // changes made here, not in the cloud yet
  const fail = code => Object.assign(new Error(`cloud: ${code}`), { code });
  const later = (a, b) => parseFloat(a) > parseFloat(b); // "10.380" after "10.374" (false when either isn't a version)
  const here = () => location.origin + location.pathname.replace(/index\.html$/i, ""); // with or without index.html
  // A moment for people: "3:04 PM" today, "Oct 4, 3:04 PM" before.
  function timeOf(ms) {
    const d = new Date(ms), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? t : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${t}`;
  }

  // --- The key kept here ---
  function readRecord() {
    for (const where of ["sessionStorage", "localStorage"]) {
      try {
        const r = JSON.parse(window[where].getItem(PREF));
        if (isObj(r) && typeof r.key === "string") return r;
      } catch (err) { /* blocked, or not a record */ }
    }
    return null;
  }
  // In localStorage, or sessionStorage when it isn't remembered, and only there.
  function writeRecord(r) {
    const [keep, drop] = r.remember ? ["localStorage", "sessionStorage"] : ["sessionStorage", "localStorage"];
    try { window[drop].removeItem(PREF); } catch (err) { /* nothing there */ }
    try { window[keep].setItem(PREF, JSON.stringify(r)); } catch (err) { console.warn("This browser won't keep the cloud's key: it works until the page closes."); }
  }
  const forgetRecord = () => ["sessionStorage", "localStorage"].forEach(where => { try { window[where].removeItem(PREF); } catch (err) { /* nothing there */ } });
  // Adds fields to the key's record (okAt, and core/cloud-upkeep.js's), unless another tab changed the key meanwhile.
  function keep(fields) {
    const r = readRecord();
    if (rec && r && r.key === rec.key) writeRecord(rec = { ...r, ...fields });
  }

  // Takes up the key kept here: on when it's whole and saved for this page (nothing goes to GitHub until the first
  // check), else off (with a word when it's another copy's).
  function load() {
    const r = readRecord(), k = r && C.supported ? C.parseKey(r.key) : null;
    if (!k) return;
    if (r.at !== here()) { message = "A cloud key saved here belongs to another copy of Kyoshi; enter it again to use it with this one."; return; }
    rec = r;
    key = k;
    client = K.github.client(k);
    lock = C.importKey(k.secret);
    okAt = Date.parse(r.okAt) || 0;
    state = "on";
  }

  // No key in use: off, everything forgotten but the data.
  function reset() {
    generation++;
    stopTimers();
    clearTimeout(lostTimer);
    rec = key = client = lock = null;
    state = "off"; why = message = busy = failure = etag = "";
    okAt = failedAt = until = checkedAt = 0;
    reachedSinceOpen = false;
    listing = new Map();
    apps().forEach(A => Object.assign(cl(A), { sha: "", clock: null, note: "" }));
  }

  // Another tab entered a key, made one or disconnected: this one follows.
  function adopt() {
    const r = readRecord();
    if (rec && r && r.key === rec.key) { rec = r; return; } // the same key (a newer okAt, say)
    reset();
    load();
    ui();
    request();
  }

  function setState(next, code = "", text = "") {
    if (next !== state && (next === "needs-key" || next === "error")) console.error(`Cloud sync stopped (${code}): ${text}`);
    state = next;
    why = code;
    message = text;
    busy = "";
    if (next !== "on") stopTimers();
    ui();
  }

  // --- Getting through, or not ---
  function lost() {
    if (state !== "on" || K.testMode) return false;
    if (navigator.onLine === false) return true;
    return !!failedAt && (!reachedSinceOpen || Date.now() - failedAt >= CLOUD_LOST_MS);
  }
  // Redraws when lost() turns true.
  function armLost() {
    clearTimeout(lostTimer);
    lostTimer = failedAt && !lost() ? setTimeout(() => { lostTimer = 0; ui(); }, failedAt + CLOUD_LOST_MS - Date.now() + 50) : 0;
  }
  // Checks again in ms (the sooner, when asked twice).
  function retryIn(ms) {
    if (retryTimer && retryDue <= Date.now() + ms) return;
    clearTimeout(retryTimer);
    retryDue = Date.now() + ms;
    retryTimer = setTimeout(() => { retryTimer = 0; request(); }, ms);
  }
  // A whole check got through (every app read and saved): whatever was failing is over, and when goes in the key's
  // record, for "last reached" after a reload.
  function gotThrough() {
    okAt = checkedAt = Date.now();
    failedAt = until = 0;
    failure = "";
    reachedSinceOpen = true;
    clearTimeout(lostTimer);
    keep({ okAt: new Date(okAt).toISOString() });
  }
  // A check that didn't get through: a refused token or repository waits for a new key; anything else is tried again
  // later, with no console line (phones drop off all the time; the banner says so once it matters).
  function failed(err) {
    const code = err && err.code;
    if (NEEDS[code]) return setState("needs-key", code, NEEDS[code]);
    if (!["network", "server", "ratelimit", "busy"].includes(code)) console.error("Cloud sync failed.", err); // not GitHub's doing
    failure = code || "server";
    failedAt = failedAt || Date.now();
    if (code === "ratelimit") until = err.until > Date.now() ? err.until : Date.now() + 60000;
    retryIn(code === "ratelimit" ? until - Date.now() : Math.min(Math.max(Date.now() - failedAt, RETRY_MS), RETRY_MAX_MS));
    armLost();
    ui();
  }
  function lostText(changes) {
    const since = reachedSinceOpen ? `since ${timeOf(failedAt || Date.now())}` : "since you opened Kyoshi";
    const last = okAt ? `last reached at ${timeOf(okAt)}` : "never reached from this device";
    const also = navigator.onLine === false ? " This browser says it's offline." : failure === "ratelimit" && until > Date.now() ? ` GitHub asks us to wait until ${timeOf(until)}.` : "";
    const left = changes ? `, and ${changes} change${changes === 1 ? "" : "s"} made here ${changes === 1 ? "is" : "are"} waiting to go up` : "";
    return `Cloud sync can't reach GitHub (${since}; ${last}).${also} What you see may be behind your other devices${left}.`;
  }

  // --- Checking ---
  // Checks soon: one check covers every app (the listing tells which have news). Waits while GitHub asks us to.
  function request() {
    if (!live() || queued) return;
    if (Date.now() < until) return retryIn(until - Date.now());
    queued = true;
    queue = queue.then(() => { queued = false; return check(); }).catch(err => console.error("Cloud sync failed.", err));
  }
  // Checks now, holding the browser's lock where it has one: another tab checking means again in a moment, until that
  // has gone on for a minute (a tab stuck with it): then anyway (GitHub's sha check keeps two saves apart).
  async function check() {
    if (!live()) return;
    const gen = generation;
    if (navigator.locks && navigator.locks.request && lockMisses < LOCK_TRIES) {
      let ran = null;
      try {
        ran = await navigator.locks.request("kyoshi-cloud", { ifAvailable: true }, async held => {
          if (!held) return false;
          await checkNow(gen);
          return true;
        });
      } catch (err) { /* no locks here after all */ }
      if (ran === false) { lockMisses++; return retryIn(CLOUD_PUSH_DELAY_MS); }
      if (ran === true) { lockMisses = 0; return; }
    }
    lockMisses = 0;
    await checkNow(gen);
  }
  // data/'s listing (asked with its last ETag: when nothing changed, it costs nothing), then each app in turn, with this
  // check's own client and secret (a key changed meanwhile makes it stale: it stops). It gets through only when every
  // app does.
  async function checkNow(gen) {
    const run = { client, secret: await lock, stale: () => gen !== generation || !live() };
    if (run.stale()) return;
    let trouble = null;
    try {
      await list(run);
      for (const A of apps()) {
        if (run.stale()) return;
        trouble = (await pass(A, run)) || trouble;
      }
      if (run.stale()) return;
      if (trouble) throw trouble;
      gotThrough();
      if (K.cloud.afterCheck) K.cloud.afterCheck(run.client); // the token's expiry, the daily tidy (core/cloud-upkeep.js)
    } catch (err) {
      if (!run.stale()) failed(err);
    }
    if (!run.stale()) say("");
  }
  async function list(run, fresh = false) {
    const res = await run.client.listDir("data", fresh ? "" : etag);
    if (run.stale() || res.status === 304) return; // 304: nothing changed since the last listing
    etag = res.etag;
    listing = new Map(res.files.filter(f => APP_FILE.test(f.path)).map(f => [f.path, f.sha]));
  }

  // One app: its file, when it changed since this device last read or wrote it, comes in first; then what this device
  // has that the cloud lacks goes up (once its change's delay is over). A clash (another device saved meanwhile) reads
  // the listing again and tries again; still clashing, the check didn't get through (returned, the other apps go on).
  async function pass(A, run) {
    const c = cl(A);
    for (let n = 1; ; n++) {
      try {
        const sha = listing.get(pathOf(A)) || "";
        if (!sha) Object.assign(c, { sha: "", clock: null }); // nothing up there (yet, or any more)
        else if (sha !== c.sha) await pull(A, run);
        if (!run.stale() && !c.timer && unsent(A)) await push(A, run);
        return null;
      } catch (err) {
        if (run.stale()) return null;
        if (err.code === "key" || err.code === "format" || err.code === "newer") { setState("error", err.code, unreadable(A, err.code)); return null; }
        if (err.code !== "conflict" && err.code !== "invalid" && err.code !== "gone") throw err;
        if (n >= TRIES) { c.note = "The cloud was busy; trying again soon"; return fail("busy"); }
        await list(run, true);
        if (run.stale()) return null;
      }
    }
  }
  // Whether the cloud lacks something of an app's: changes made here since its last save there; data, and no file up
  // there; or other devices' changes the cloud doesn't have yet (the sync folder brought them).
  function unsent(A) {
    const c = cl(A);
    if (waiting(A)) return true;
    if (!c.sha) return A.data.hasData();
    return K.sync.relation(A, c.clock) === "ahead";
  }
  function unreadable(A, code) {
    const name = A.meta.name;
    if (code === "newer") return `The cloud's file for ${name} was saved by a newer Kyoshi: reload this page to get it. Until then nothing is saved to the cloud from here.`;
    if (code === "key") return `The cloud's file for ${name} can't be read with this key: it was locked with another one. Nothing is saved to the cloud until you enter the key made for this repository (Enter key…), or Disconnect.`;
    return `The cloud's file for ${name} isn't a ${name} save Kyoshi can read. Nothing is saved to the cloud until that's fixed: enter the key again, or Disconnect.`;
  }

  // A file's save, unlocked: this app's (else code "format"; "key": the wrong key; "newer": a later file format, or a
  // later version of the app, which this one might strip of what it doesn't know and send to every device).
  async function readSave(bytes, A, secret) {
    let env = null;
    try { env = JSON.parse(C.fromUtf8(bytes)); } catch (err) { /* not JSON, so not an envelope */ }
    if (isObj(env) && isPos(env.kyoshi) && env.kyoshi > 1) throw fail("newer");
    const raw = await C.open(env, secret);
    if (!isObj(raw) || env.app !== A.id || !A.data.looksLike(raw)) throw fail("format");
    if (later(raw.appVersion, A.VERSION) || later(raw.schemaVersion, A.data.schemaVersion)) throw fail("newer");
    return raw;
  }
  // Brings an app's file in, combined with what's here (the engine decides which is newer).
  async function pull(A, run) {
    const c = cl(A);
    say(`Loading ${A.meta.name}…`);
    let file;
    try { file = await run.client.getFile(pathOf(A)); } catch (err) { throw err.code === "notfound" ? fail("gone") : err; } // taken out meanwhile
    const raw = await readSave(file.bytes, A, run.secret);
    if (run.stale()) return;
    const before = JSON.stringify(A._sync.meta.clock), result = K.sync.incorporate(A, raw);
    Object.assign(c, { sha: file.sha, clock: (raw.sync && raw.sync.clock) || null });
    listing.set(pathOf(A), file.sha);
    // Other devices' changes go on to the sync folder too, if one is used (the engine's dirty is its marker).
    if (!A._sync.meta.dirty && JSON.stringify(A._sync.meta.clock) !== before) { A._sync.meta.dirty = true; K.sync.storeMeta(A); }
    if (!result) return;
    K.sync.settle(A, result.data); // the app stores and redraws what came in
    c.note = `${result.what === "Loaded" ? "Loaded from the cloud" : "Combined changes with the cloud's"} at ${clockTime()}`;
  }
  // Saves an app's file: this device's save, locked, over the file it last read (GitHub refuses it if that changed).
  async function push(A, run) {
    const c = cl(A), v = K.sync.version(A), save = K.sync.saveOf(A), clock = { ...save.sync.clock };
    say(`Saving ${A.meta.name}…`);
    const env = await C.seal(save, run.secret, A.id); // reads the save at once, before anything else can change it
    if (run.stale()) return;
    const kind = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) ? "phone" : "desktop";
    const text = `${JSON.stringify(env, null, 2)}\n`;
    const res = await run.client.putFile(pathOf(A), C.toBase64(C.utf8(text)), { sha: c.sha, message: `Kyoshi: ${A.id} from ${kind}-${A._sync.meta.device}` });
    if (run.stale()) return;
    Object.assign(c, { sha: res.sha, clock, savedAt: Date.now(), note: `Saved to the cloud at ${clockTime()}` });
    listing.set(pathOf(A), res.sha);
    if (v > (A._sync.meta.pushed || 0)) K.sync.saved(A, v, { pushed: v }); // unless it changed meanwhile, here or in another tab
    if (!waiting(A)) K.backup.setUnsaved(A, false);
  }

  // --- The engine's calls ---
  // A change: saved once changes stop coming for CLOUD_PUSH_DELAY_MS, and CLOUD_GAP_MS after the app's last save (the
  // banner counts it meanwhile).
  function changed(A) {
    if (!live()) return;
    const c = cl(A);
    clearTimeout(c.timer);
    c.timer = setTimeout(() => { c.timer = 0; request(); }, Math.max(CLOUD_PUSH_DELAY_MS, c.savedAt + CLOUD_GAP_MS - Date.now()));
    if (lost()) ui();
  }
  // The page is being hidden or closed: what's waiting goes now (a save cut off by a closing tab goes at the next start).
  function flush() {
    if (!live() || !apps().some(A => cl(A).timer || unsent(A))) return;
    stopAppTimers();
    request();
  }
  const stopAppTimers = () => apps().forEach(A => { clearTimeout(cl(A).timer); cl(A).timer = 0; });
  function stopTimers() {
    stopAppTimers();
    clearTimeout(retryTimer);
    retryTimer = 0;
  }

  // --- Taking a key up, and letting it go (for core/cloud-key.js) ---
  // Takes a key up here: kept (remembered or not), on, and a check straight away; returns the key. fresh (a key just
  // entered or made): every app is read from the cloud and sent again, combining as a new sync folder does.
  function take(k, remember, c, secret, fresh) {
    generation++;
    stopTimers();
    rec = { key: C.makeKey(k), at: here(), remember: !!remember, okAt: new Date().toISOString() };
    writeRecord(rec);
    key = k; client = c; lock = Promise.resolve(secret);
    okAt = Date.now(); failedAt = until = lockMisses = 0; failure = etag = ""; reachedSinceOpen = true; listing = new Map();
    if (fresh) apps().forEach(A => { Object.assign(cl(A), { sha: "", clock: null, note: "" }); A._sync.meta.pushed = 0; K.sync.storeMeta(A); });
    setState("on");
    request();
    return rec.key;
  }
  // This device forgets the key: off.
  function forget() {
    forgetRecord();
    reset();
    ui();
  }
  // The key in use { key, client, lock, remember }, or null (in needs-key and error too: its secret still opens files).
  const held = () => (key ? { key, client, lock, remember: !!(rec && rec.remember) } : null);
  // Sync now, and the banner's Try now: a check straight away, changes waiting for their delay included.
  function syncNow() {
    stopTimers();
    request();
  }

  // --- What the UI and bug reports read ---
  // { state, why, message (the banner's, or why it stopped), busy, waiting (apps with changes not in the cloud), changes
  // (how many), okAt, failedAt, checkedAt, lost, expiry (the token's end, once it's near: a line), attention (the banner
  // and the glyph show), repo }.
  function status() {
    const late = state === "off" ? [] : apps().filter(waiting), changes = late.reduce((n, A) => n + K.sync.version(A) - (A._sync.meta.pushed || 0), 0);
    const isLost = lost(), soon = state === "on" && K.cloud.expiry ? K.cloud.expiry() : null; // core/cloud-upkeep.js
    return {
      state, why, busy, waiting: late.length, changes, okAt, failedAt, checkedAt, lost: isLost, expiry: soon ? soon.text : "",
      attention: !K.testMode && (isLost || state === "needs-key" || state === "error" || !!(soon && soon.urgent)),
      message: !C.supported ? C.unsupported : state === "on" ? (isLost ? lostText(changes) : soon && soon.urgent ? soon.text : "") : message,
      repo: key ? key.repo : ""
    };
  }

  // Takes up the key kept here (on straight away) and checks; then every CLOUD_CHECK_MS while in view (the engine also
  // asks when the page is back in view), when the browser is back online, and follows other tabs' keys.
  function init() {
    window.addEventListener("online", () => { ui(); request(); });
    window.addEventListener("offline", () => { if (state === "on" && !failedAt) failedAt = Date.now(); ui(); });
    window.addEventListener("storage", e => { if (e.key === PREF || e.key === null) adopt(); });
    setInterval(() => { if (!document.hidden && !retryTimer) request(); }, CLOUD_CHECK_MS);
    load();
    ui();
    request();
  }

  // The transport (core/sync.js), what the UI reads, and for core/cloud-key.js (which adds connect, setup, updateToken,
  // disconnect, exportDecrypted and decryptFile here) take, forget, held, appOf and timeOf; for core/cloud-upkeep.js
  // (which adds tidied, history, expiry and afterCheck) record, keep and ui. settled: resolves once the checks
  // asked for so far are done (the tests wait on it).
  K.cloud = {
    id: "cloud", init, changed, request, flush, stopTimers,
    state: () => (C.supported ? state : "unsupported"), message: () => status().message, dirty: A => state !== "off" && !!A._sync && waiting(A),
    status, note: A => (A._sync && A._sync.cloud ? A._sync.cloud.note : ""), keyString: () => (rec ? rec.key : ""), syncNow, LOST_MS: CLOUD_LOST_MS,
    take, forget, held, appOf: path => (APP_FILE.exec(path) || [])[1] || "", timeOf, settled: () => queue,
    record: () => rec, keep, ui
  };
  K.sync.use(K.cloud);
})(Kyoshi);
