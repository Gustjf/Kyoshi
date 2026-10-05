/* Kyoshi · core/bugs.js — bug reports, as K.bugs.
 * "Report a bug" (footer) opens #kBugOverlay for the app on screen; Submit saves a report to a local
 * log (K.store "bugReports", kept until cleared in Developer Mode) and copies it.
 * A report is dense plain text for an AI to read, one fact per line: versions and build, the
 * description, the browser and device, the app's own state lines (A.bugState()), recent console
 * errors and warnings, and the latest version numbers — never personal data (no names, weights, card titles…). */
(function (K) {
  "use strict";
  const { copyText, downloadBlob, todayStr } = K.util;
  const $ = id => document.getElementById(id);
  const BUG_REPORTS_MAX = 200;
  const STACK_FRAMES = 3, CONSOLE_LINE_MAX = 600;
  // The page's build stamp (index.html's "?v=…" on every file): which deploy this is.
  const BUILD = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w-]+)/)) || [])[1] || "none";
  let reports = []; // { id, timestamp, app, description, markdown (the report's text: Markdown before Kyoshi 3.440, plain since) }
  let systemVersion = ""; // the system's real version where the browser tells it (Chromium, asked at init): its user agent's is frozen

  function load() {
    const r = K.store.json("bugReports");
    reports = Array.isArray(r) ? r.filter(x => x && typeof x.markdown === "string") : [];
  }
  const store = () => K.store.set("bugReports", JSON.stringify(reports));

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
  function build(A, description) {
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
        `${K.dayOffset ? ` · travel ${K.dayOffset > 0 ? "+" : ""}${K.dayOffset} days` : ""}${K.testMode ? " · test mode" : ""}`,
      (description || "(none)").replace(/\n\s*\n/g, "\n"),
      `env: ${browser(ua)} ${system(ua)} · ${window.innerWidth}x${window.innerHeight} · ${document.documentElement.dataset.theme} · ${navigator.language}` +
        `${navigator.onLine ? "" : " · offline"} · ${location.protocol === "file:" ? "file://" : location.host} · store ${K.storage.backend()}` +
        ` · sync ${K.sync.supported ? K.sync.state() : "unsupported"} · dev ${K.dev.isOn() ? "on" : "off"} · unsaved ${K.backup.isUnsaved(A) ? "yes" : "no"}`,
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

  function open() {
    $("kBugText").value = "";
    setStatus("", "");
    K.modal.open($("kBugOverlay"));
    $("kBugText").focus();
  }
  const isOpen = () => K.modal.isOpen($("kBugOverlay"));

  // Saves the report to the local log and copies it to the clipboard as a convenience.
  async function submit() {
    const A = K.active(), description = $("kBugText").value.trim();
    const markdown = build(A, description);
    reports = reports.concat({ id: Date.now(), timestamp: new Date().toISOString(), app: A.id, description, markdown }).slice(-BUG_REPORTS_MAX);
    store();
    K.dev.refresh();
    const logged = `${reports.length} report${reports.length === 1 ? "" : "s"} logged`;
    const copied = await copyText(markdown);
    setStatus(copied
      ? `Saved and copied to clipboard (${logged} — manage them from Developer Mode).`
      : `Saved (${logged}), but couldn't copy automatically — export it from Developer Mode instead.`, copied ? "good" : "bad");
    $("kBugText").value = "";
  }

  // Developer Mode's bug report block.
  const combined = () => reports.map(r => r.markdown).join("\n\n---\n\n");
  async function copyAll() {
    if (!reports.length) return alert("No bug reports logged yet.");
    if (!(await copyText(combined()))) alert("Couldn't copy automatically — try the Download button instead.");
  }
  function download() {
    if (!reports.length) return alert("No bug reports logged yet.");
    downloadBlob(new Blob([combined()], { type: "text/markdown" }), `kyoshi-bug-reports-${todayStr()}.md`);
  }
  function clear() {
    if (!reports.length || !confirm(`Clear all ${reports.length} logged bug report(s)? This can't be undone.`)) return;
    reports = [];
    store();
    K.dev.refresh();
  }

  function init() {
    load();
    const uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) uad.getHighEntropyValues(["platformVersion"]).then(v => { systemVersion = v.platformVersion || ""; }, () => {});
    K.modal.define($("kBugOverlay"), { pending: () => $("kBugText").value.trim() !== "", ask: "Discard this bug report? It hasn't been submitted." });
    $("kReportBug").addEventListener("click", e => { e.preventDefault(); open(); });
    $("kBugSubmit").addEventListener("click", submit);
  }

  K.bugs = { init, load, open, isOpen, count: () => reports.length, copyAll, download, clear, build };
})(Kyoshi);
