/* Kyoshi · core/bugs.js — bug reports and feature requests, as K.bugs.
 * "Bugs & requests" (footer, with how many are logged) opens #kBugOverlay for the app on screen: Bug or Feature request
 * (the pick remembered on this device, localStorage "kyoshi.bugKind"), Submit, and everything logged listed under it,
 * newest first. Submit saves a report to the log and copies it. A tap on one opens it in the same pop-up, its whole
 * description, to change its words and kind (Save, or Cancel); what it captured stays as it was. Nothing is ticked off
 * one by one: they wait until the owner sits down to plan, exports them all from Developer Mode (Copy all or Download
 * .md: feature requests first, then bugs), then empties the log there (Clear, on every device).
 * The log is core's own record (core/record.js: the hidden Kyoshi app), so it syncs and is backed up as an app's data.
 * A report is dense plain text for an AI to read, one fact per line: versions and build, bug or feature request, the
 * description, the browser and device, the app's own state lines (A.bugState()), recent console
 * errors and warnings, and the latest version numbers — never personal data (no names, weights, card titles…). */
(function (K) {
  "use strict";
  const { copyText, downloadBlob, todayStr, esc } = K.util;
  const $ = id => document.getElementById(id);
  const STACK_FRAMES = 3, CONSOLE_LINE_MAX = 600;
  const SUMMARY_MAX = 100;            // the list shows each description's first line, cut to this many characters
  const KIND_KEY = "kyoshi.bugKind";  // the last pick (localStorage: this device only, not synced or backed up)
  const KINDS = {
    bug: { word: "bug", tag: "B", hint: "What went wrong? What did you expect?" },
    request: { word: "feature request", tag: "R", hint: "What should Kyoshi do, and where?" }
  };
  const KIND_WORD = / · (?:bug|feature request)(?= · |$)/; // in a report's first line
  // The page's build stamp (index.html's "?v=…" on every file): which deploy this is.
  const BUILD = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w-]+)/)) || [])[1] || "none";
  let kind = "bug";       // the pop-up's pick
  let editing = null;     // the report open in the pop-up: { id, kind, text } as it was opened
  let systemVersion = ""; // the system's real version where the browser tells it (Chromium, asked at init): its user agent's is frozen

  const reports = () => K.record.live(); // core/record.js: in the order they were logged
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
  const body = description => (description || "(none)").replace(/\n\s*\n/g, "\n"); // its description: the lines after the first
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
      body(description),
      `env: ${browser(ua)} ${system(ua)} · ${window.innerWidth}x${window.innerHeight} · ${document.documentElement.dataset.theme} · ${navigator.language}` +
        `${navigator.onLine ? "" : " · offline"} · ${location.protocol === "file:" ? "file://" : location.host} · store ${K.storage.backend()}` +
        ` · sync ${K.sync.state()} · cloud waiting ${K.cloud.status().waiting}${K.cloud.status().lost ? " (lost)" : ""}` +
        ` · dev ${K.dev.isOn() ? "on" : "off"} · unsaved ${K.backup.isUnsaved(A) ? "yes" : "no"}`,
      ...(failed.length ? [`failed to start: ${failed.join(", ")}`] : []),
      `state: ${state}`,
      `console (${K.debugLog.length})${lines.length ? ":" : ""}`, ...lines,
      `versions: ${recent(A.meta.name, A.CHANGELOG || [])} · ${recent("Kyoshi", K.CHANGELOG)}`
    ].join("\n");
  }
  // A report's text after an edit: its first line saying what it is now, then the new description; from its env: line on
  // (the last one: a description can hold one), as it was captured.
  function rewrite(markdown, k, description) {
    const first = markdown.split("\n")[0], word = ` · ${kindOf(k).word}`, at = markdown.lastIndexOf("\nenv: ");
    return `${KIND_WORD.test(first) ? first.replace(KIND_WORD, word) : first + word}\n${body(description)}${at > 0 ? markdown.slice(at) : ""}`;
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
    leave();
    setStatus("", "");
    K.modal.open($("kBugOverlay"));
    $("kBugText").focus();
  }
  const isOpen = () => K.modal.isOpen($("kBugOverlay"));
  // Closing the pop-up (×, Esc or the backdrop, once it asked when something would be lost) leaves edit mode too.
  function close() {
    if (editing) leave();
    K.modal.close($("kBugOverlay"));
  }

  // Saves the report to the log and copies it to the clipboard as a convenience.
  async function submit() {
    const A = K.active(), description = $("kBugText").value.trim(), what = kind;
    const markdown = build(A, description, what);
    K.record.add({ app: A.id, description, markdown, kind: what });
    $("kBugText").value = ""; // saved: emptied now, not after the copy (closing meanwhile has nothing to discard)
    const saved = `Saved ${what === "request" ? "request" : "bug"}`, logged = `${reports().length} logged`;
    const copied = await copyText(markdown);
    setStatus(copied
      ? `${saved} and copied it to the clipboard (${logged}, listed below).`
      : `${saved} (${logged}), but couldn't copy it automatically: Developer Mode's Copy all has it.`, copied ? "good" : "bad");
  }

  // --- Editing one: a row tapped opens its report in the box, whole; Save keeps the new words and kind ---
  // The pop-up as it is for submitting a new one (editing null) or editing one.
  function setMode() {
    $("kBugTitle").textContent = editing ? "Bugs & requests · editing" : "Bugs & requests";
    $("kBugSubmit").textContent = editing ? "Save" : "Submit";
    $("kBugCancel").hidden = !editing;
  }
  // What closing the pop-up, or opening another report, would lose: the question to ask first ("" when nothing).
  function unsaved() {
    const text = $("kBugText").value.trim();
    if (editing) return text !== editing.text || kind !== editing.kind ? "Discard your changes to this report?" : "";
    return text ? "Discard what you typed? It hasn't been submitted." : "";
  }
  function edit(id) {
    const r = reports().find(x => String(x.id) === id), ask = unsaved();
    if (!r || (editing && editing.id === r.id) || (ask && !confirm(ask))) return;
    editing = { id: r.id, kind: r.kind, text: r.description };
    setMode();
    setKind(r.kind);
    $("kBugText").value = r.description;
    setStatus(`Editing the ${appName(r.app)} ${isRequest(r) ? "request" : "bug"} from ${dayOf(r.timestamp)}. What it captured (versions, state, console) stays as it was.`, "");
    render();
    $("kBugText").focus();
    $("kBugText").setSelectionRange(0, 0); // read from the top
    $("kBugText").scrollTop = 0;
  }
  // Back to submitting a new one (Cancel, after Save, or closing): the box emptied, the kind last picked for a new one.
  function leave() {
    editing = null;
    setMode();
    $("kBugText").value = "";
    setKind(K.storage.get(KIND_KEY));
    render();
  }
  // The new words and kind, in its text too (its first line and description); what it captured stays, and it says it
  // was edited. One cleared meanwhile (on another device, say) isn't brought back: the words stay in the box, for Submit.
  function saveEdit() {
    const r = reports().find(x => x.id === editing.id), description = $("kBugText").value.trim();
    if (!r) {
      editing = null;
      setMode();
      render();
      return setStatus("That report was cleared meanwhile, so the change can't go in it: Submit adds what you wrote as a new one.", "bad");
    }
    const change = description !== r.description || kind !== r.kind;
    if (change) K.record.edit(r.id, { description, kind, markdown: rewrite(r.markdown, kind, description) });
    leave();
    setStatus(change ? "Saved the change." : "Nothing changed.", change ? "good" : "");
  }

  // --- The footer link's count and the list (newest first), redrawn whenever the log changes ---
  const dayOf = iso => { const d = new Date(iso); return isNaN(d) ? "" : minute(d).slice(0, 10); };
  const appName = id => (K.apps[id] ? K.apps[id].meta.name : id);
  function render() {
    const list = reports().reverse();
    $("kReportBug").textContent = `Bugs & requests${list.length ? ` · ${list.length}` : ""}`;
    $("kBugListHead").hidden = !list.length;
    $("kBugListHead").textContent = `Submitted · ${list.length}`;
    $("kBugList").innerHTML = list.map(r => {
      const k = kindOf(r.kind), line = (r.description || "").split("\n")[0].trim() || "(no description)", on = !!editing && editing.id === r.id;
      return `<li><button type="button" class="bug-row${on ? " editing" : ""}" data-id="${esc(r.id)}"${on ? ' aria-current="true"' : ""} title="${esc(r.description || "")}">` +
        `<span class="bug-kind${isRequest(r) ? " request" : ""}" title="${esc(k.word)}">${k.tag}</span>` +
        `<span class="bug-body"><span class="bug-where">${esc(appName(r.app))} · ${esc(dayOf(r.timestamp))}${r.edited ? " · edited" : ""}</span> ` +
        `${esc(line.length > SUMMARY_MAX ? `${line.slice(0, SUMMARY_MAX - 1)}…` : line)}</span></button></li>`;
    }).join("");
  }
  // After a change to the log (core/record.js calls it): the link, the list and Developer Mode's count.
  function redraw() {
    render();
    K.dev.refresh();
  }

  // --- Developer Mode's block: all of them for pasting into Claude Code, requests first, then bugs (each in the
  // order they were logged), every report separated by "---" ---
  function combined() {
    const list = reports();
    return [["FEATURE REQUESTS", list.filter(isRequest)], ["BUGS", list.filter(r => !isRequest(r))]].filter(([, l]) => l.length)
      .map(([head, l]) => `${head} (${l.length})\n\n${l.map(r => r.markdown).join("\n\n---\n\n")}`).join("\n\n---\n\n");
  }
  async function copyAll() {
    if (!reports().length) return alert("No bugs or requests logged.");
    if (!(await copyText(combined()))) alert("Couldn't copy automatically — try the Download button instead.");
  }
  function download() {
    if (!reports().length) return alert("No bugs or requests logged.");
    downloadBlob(new Blob([combined()], { type: "text/markdown" }), `kyoshi-bug-reports-${todayStr()}.md`);
  }
  // Once they're exported and planned: the log starts empty again, on every device.
  function clear() {
    const n = reports().length;
    if (!n || !confirm(`Clear all ${n} logged bug(s) and request(s)? Export them first (Copy all or Download .md) if you haven't: this can't be undone.`)) return;
    K.record.clear();
  }

  function init() {
    const uad = navigator.userAgentData;
    if (uad && uad.getHighEntropyValues) uad.getHighEntropyValues(["platformVersion"]).then(v => { systemVersion = v.platformVersion || ""; }, () => {});
    K.modal.define($("kBugOverlay"), { pending: () => !!unsaved(), ask: unsaved, dismiss: close });
    $("kReportBug").addEventListener("click", e => { e.preventDefault(); open(); });
    $("kBugSubmit").addEventListener("click", () => (editing ? saveEdit() : submit()));
    $("kBugCancel").addEventListener("click", () => { leave(); setStatus("", ""); $("kBugText").focus(); });
    $("kBugList").addEventListener("click", e => {
      const row = e.target.closest(".bug-row");
      if (row) edit(row.dataset.id);
    });
    $("kBugKind").addEventListener("click", e => {
      const btn = e.target.closest("[data-kind]");
      if (!btn) return;
      setKind(btn.dataset.kind, !editing); // a report's own kind, while editing: not the pick for a new one
      $("kBugText").focus();
    });
  }

  K.bugs = { init, open, isOpen, count: () => reports().length, copyAll, download, clear, build, redraw };
})(Kyoshi);
