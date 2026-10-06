/* Kyoshi · core/bugs.js — bug reports and feature requests, as K.bugs.
 * "Bugs & requests" (footer, with how many are logged) opens #kBugOverlay for the app on screen: Bug or Feature request
 * (the pick remembered on this device, localStorage "kyoshi.bugKind"), Submit, and everything logged listed under it,
 * newest first. Submit saves a report to a local log (K.store "bugReports") and copies it. Nothing is ticked off one by
 * one: they wait until the owner sits down to plan, exports them all from Developer Mode (Copy all or Download .md:
 * feature requests first, then bugs), then empties the log there (Clear).
 * A report is dense plain text for an AI to read, one fact per line: versions and build, bug or feature request, the
 * description, the browser and device, the app's own state lines (A.bugState()), recent console
 * errors and warnings, and the latest version numbers — never personal data (no names, weights, card titles…). */
(function (K) {
  "use strict";
  const { copyText, downloadBlob, todayStr, esc } = K.util;
  const $ = id => document.getElementById(id);
  const BUG_REPORTS_MAX = 200;
  const STACK_FRAMES = 3, CONSOLE_LINE_MAX = 600;
  const SUMMARY_MAX = 100;            // the list shows each description's first line, cut to this many characters
  const KIND_KEY = "kyoshi.bugKind";  // the last pick (localStorage: this device only, not synced or backed up)
  const KINDS = {
    bug: { word: "bug", tag: "B", hint: "What went wrong? What did you expect?" },
    request: { word: "feature request", tag: "R", hint: "What should Kyoshi do, and where?" }
  };
  // The page's build stamp (index.html's "?v=…" on every file): which deploy this is.
  const BUILD = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w-]+)/)) || [])[1] || "none";
  // { id, timestamp, app, description, markdown (the report's text: Markdown before Kyoshi 3.440, plain since),
  //   kind ("bug" | "request") } — Kyoshi 3.750 also kept done (a Done ✓ per report), no longer read: all are listed
  let reports = [];
  let kind = "bug";       // the pop-up's pick
  let systemVersion = ""; // the system's real version where the browser tells it (Chromium, asked at init): its user agent's is frozen

  // Reports from before Kyoshi 3.750 are bugs.
  function load() {
    const r = K.store.json("bugReports");
    reports = Array.isArray(r) ? r.filter(x => x && typeof x.markdown === "string").map(x => ({ ...x, kind: x.kind || "bug" })) : [];
    render();
  }
  const store = () => K.store.set("bugReports", JSON.stringify(reports));
  const isRequest = r => r.kind === "request";
  const kindOf = k => (k === "request" ? KINDS.request : KINDS.bug);

  // --- What a report says about the device ---
  const pad = n => String(n).padStart(2, "0");
  const clock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const minute = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // This device's time zone, which every date in Kyoshi follows: "UTC-6", "UTC+5:30".
  function zone(d) {
    const m = -d.getTimezoneOffset(), a = Math.abs(m);
    return `UTC${m < 0 ? "-" : "+"}${Math.floor(a / 60)}${a % 60 ? `:${pad(a % 60)}` : ""}`;
  }
  // The browser and its major version, from the user agent: "Chrome/130", "Safari/17.5".
  function browser(ua) {
    const known = [[/Edg(?:A|iOS)?\/(\d+)/, "Edge"], [/OPR\/(\d+)/, "Opera"], [/SamsungBrowser\/(\d+)/, "Samsung"], [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
      [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"], [/Version\/(\d+(?:\.\d+)?).*Safari\//, "Safari"]];
    for (const [re, name] of known) { const m = ua.match(re); if (m) return `${name}/${m[1]}`; }
    return "unknown browser";
  }
  // The system: "Android 14", "iOS 17.5", "Windows 11", "macOS 14.5" (an iPad asking for desktop sites says it's a Mac).
  function system(ua) {
    const v = systemVersion.split(".").map(Number);
    let m;
    if ((m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/))) return `iOS ${m[1]}.${m[2]}`;
    if ((m = ua.match(/Android (\d+)/))) return `Android ${v[0] || m[1]}`;
    if (/CrOS/.test(ua)) return "ChromeOS";
    if (/Windows/.test(ua)) return v[0] >= 13 ? "Windows 11" : v[0] ? "Windows 10" : "Windows";
    if (/Mac OS X/.test(ua)) return navigator.maxTouchPoints > 1 ? "iPadOS" : `macOS${v[0] ? ` ${v[0]}.${v[1] || 0}` : ""}`;
    return /Linux/.test(ua) ? "Linux" : navigator.platform || "unknown system";
  }

  // --- Console lines: each on one line, without the page's own address (shorter, and a file:// path can hold
  // the user's name) or build stamps, stacks cut to their first frames, repeats counted ---
  function tidy(message) {
    const folder = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
    const [head, ...rest] = String(message).split(folder).join("").replace(/\?v=[\w-]+/g, "").split("\n");
    const frames = rest.map(l => l.trim()).filter(l => /^at\s|@.*:\d+:\d+$/.test(l)).slice(0, STACK_FRAMES);
    const line = [head.trim()].concat(frames).join(" | ");
    return line.length > CONSOLE_LINE_MAX ? `${line.slice(0, CONSOLE_LINE_MAX)}…` : line;
  }
  function consoleLines() {
    const out = [];
    K.debugLog.forEach(l => {
      const text = `${l.level === "error" ? "E" : l.level === "warn" ? "W" : "I"} ${tidy(l.message)}`, last = out[out.length - 1];
      if (last && last.text === text) last.times++;
      else out.push({ time: clock(new Date(l.time)), text, times: 1 });
    });
    return out.map(o => `${o.time} ${o.text}${o.times > 1 ? ` ×${o.times}` : ""}`);
  }

  // The report, meant to be pasted into Claude Code: one fact per line, no prose.
  function build(A, description, what = "bug") {
    const now = new Date(), ua = navigator.userAgent || "";
    const recent = (name, log) => `${name} ${log.slice(0, 3).map((c, n) => (n ? c.version : `${c.version} (${c.date})`)).join(", ") || "?"}`;
    const failed = K.order.filter(id => !K.apps[id].started).map(id => K.apps[id].meta.name);
    let state;
    try {
      state = (A.bugState ? A.bugState() : []).map(l => String(l).replace(/^\s*-\s*/, "")).concat(`meetings: ${K.meetings.bugLine(A)}`).join(" | ");
    } catch (err) { state = `(couldn't read the app's state: ${err.message})`; }
    const lines = consoleLines();
    return [
      `Kyoshi ${K.VERSION} (build ${BUILD}) · ${A.meta.name} ${A.VERSION} · schema ${A.data ? A.data.schemaVersion : "n/a"} · ${minute(now)} ${zone(now)} · app day ${todayStr()}` +
        ` · ${kindOf(what).word}` +
        `${K.dayOffset ? ` · travel ${K.dayOffset > 0 ? "+" : ""}${K.dayOffset} days` : ""}${K.testMode ? " · test mode" : ""}`,
      (description || "(none)").replace(/\n\s*\n/g, "\n"),
      `env: ${browser(ua)} ${system(ua)} · ${window.innerWidth}x${window.innerHeight} · ${document.documentElement.dataset.theme} · ${navigator.language}` +
        `${navigator.onLine ? "" : " · offline"} · ${location.protocol === "file:" ? "file://" : location.host} · store ${K.storage.backend()}` +
        ` · sync ${K.sync.state()} · dev ${K.dev.isOn() ? "on" : "off"} · unsaved ${K.backup.isUnsaved(A) ? "yes" : "no"}`,
      ...(failed.length ? [`failed to start: ${failed.join(", ")}`] : []),
      `state: ${state}`,
      `console (${K.debugLog.length})${lines.length ? ":" : ""}`, ...lines,
      `versions: ${recent(A.meta.name, A.CHANGELOG || [])} · ${recent("Kyoshi", K.CHANGELOG)}`
    ].join("\n");
  }

  function setStatus(message, cls) {
    $("kBugStatus").textContent = message;
    $("kBugStatus").className = `modal-status ${cls}`;
  }

  // Bug or Feature request: the pill pressed and the box's hint; a tap is remembered for next time.
  function setKind(k, remember = false) {
    kind = k === "request" ? "request" : "bug";
    $("kBugKind").querySelectorAll("[data-kind]").forEach(b => {
      b.classList.toggle("active", b.dataset.kind === kind);
      b.setAttribute("aria-pressed", b.dataset.kind === kind);
    });
    $("kBugText").placeholder = kindOf(kind).hint;
    if (remember) K.storage.set(KIND_KEY, kind);
  }

  function open() {
    $("kBugText").value = "";
    setStatus("", "");
    setKind(K.storage.get(KIND_KEY));
    K.modal.open($("kBugOverlay"));
    $("kBugText").focus();
  }
  const isOpen = () => K.modal.isOpen($("kBugOverlay"));

  // Saves the report to the local log and copies it to the clipboard as a convenience.
  async function submit() {
    const A = K.active(), description = $("kBugText").value.trim(), what = kind;
    const markdown = build(A, description, what);
    reports = reports.concat({ id: Date.now(), timestamp: new Date().toISOString(), app: A.id, description, markdown, kind: what }).slice(-BUG_REPORTS_MAX);
    store();
    changed();
    $("kBugText").value = ""; // saved: emptied now, not after the copy (closing meanwhile has nothing to discard)
    const saved = `Saved ${what === "request" ? "request" : "bug"}`, logged = `${reports.length} logged`;
    const copied = await copyText(markdown);
    setStatus(copied
      ? `${saved} and copied it to the clipboard (${logged}, listed below).`
      : `${saved} (${logged}), but couldn't copy it automatically: Developer Mode's Copy all has it.`, copied ? "good" : "bad");
  }

  // --- The footer link's count and the list (newest first), redrawn whenever the log changes ---
  const dayOf = iso => { const d = new Date(iso); return isNaN(d) ? "" : minute(d).slice(0, 10); };
  function render() {
    const list = reports.slice().reverse();
    $("kReportBug").textContent = `Bugs & requests${list.length ? ` · ${list.length}` : ""}`;
    $("kBugListHead").hidden = !list.length;
    $("kBugListHead").textContent = `Submitted · ${list.length}`;
    $("kBugList").innerHTML = list.map(r => {
      const A = K.apps[r.app], k = kindOf(r.kind), line = (r.description || "").split("\n")[0].trim() || "(no description)";
      return `<li class="bug-row" title="${esc(r.description || "")}">` +
        `<span class="bug-kind${isRequest(r) ? " request" : ""}" title="${esc(k.word)}">${k.tag}</span>` +
        `<span class="bug-body"><span class="bug-where">${esc(A ? A.meta.name : r.app)} · ${esc(dayOf(r.timestamp))}</span> ` +
        `${esc(line.length > SUMMARY_MAX ? `${line.slice(0, SUMMARY_MAX - 1)}…` : line)}</span></li>`;
    }).join("");
  }
  // After a change to the log: the link, the list and Developer Mode's count.
  function changed() {
    render();
    K.dev.refresh();
  }

  // --- Developer Mode's block: all of them for pasting into Claude Code, requests first, then bugs (each in the
  // order they were logged), every report separated by "---" ---
  function combined() {
    return [["FEATURE REQUESTS", reports.filter(isRequest)], ["BUGS", reports.filter(r => !isRequest(r))]].filter(([, list]) => list.length)
      .map(([head, list]) => `${head} (${list.length})\n\n${list.map(r => r.markdown).join("\n\n---\n\n")}`).join("\n\n---\n\n");
  }
  async function copyAll() {
    if (!reports.length) return alert("No bugs or requests logged.");
    if (!(await copyText(combined()))) alert("Couldn't copy automatically — try the Download button instead.");
  }
  function download() {
    if (!reports.length) return alert("No bugs or requests logged.");
    downloadBlob(new Blob([combined()], { type: "text/markdown" }), `kyoshi-bug-reports-${todayStr()}.md`);
  }
  // Once they're exported and planned: the log starts empty again.
  function clear() {
    if (!reports.length || !confirm(`Clear all ${reports.length} logged bug(s) and request(s)? Export them first (Copy all or Download .md) if you haven't: this can't be undone.`)) return;
    reports = [];
    store();
    changed();
  }

  function init() {
    load();
    const uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) uad.getHighEntropyValues(["platformVersion"]).then(v => { systemVersion = v.platformVersion || ""; }, () => {});
    K.modal.define($("kBugOverlay"), { pending: () => $("kBugText").value.trim() !== "", ask: "Discard what you typed? It hasn't been submitted." });
    $("kReportBug").addEventListener("click", e => { e.preventDefault(); open(); });
    $("kBugSubmit").addEventListener("click", submit);
    $("kBugKind").addEventListener("click", e => {
      const btn = e.target.closest("[data-kind]");
      if (!btn) return;
      setKind(btn.dataset.kind, true);
      $("kBugText").focus();
    });
  }

  K.bugs = { init, load, open, isOpen, count: () => reports.length, copyAll, download, clear, build };
})(Kyoshi);
