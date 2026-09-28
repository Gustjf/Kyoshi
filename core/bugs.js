/* Kyoshi · core/bugs.js — bug reports, as K.bugs.
 * "Report a bug" (footer) opens #kBugOverlay for the app on screen; Submit saves a Markdown
 * report to a local log (K.store "bugReports", kept until cleared in Developer Mode) and copies it.
 * A report holds the environment, the app's own state lines (A.bugState()), recent console
 * activity and changelogs — never personal data (no names, weights, card titles…). */
(function (K) {
  "use strict";
  const { copyText, downloadBlob, todayStr } = K.util;
  const $ = id => document.getElementById(id);
  const BUG_REPORTS_MAX = 20;
  let reports = []; // { id, timestamp, app, description, markdown }

  function load() {
    const r = K.store.json("bugReports");
    reports = Array.isArray(r) ? r.filter(x => x && typeof x.markdown === "string") : [];
  }
  const store = () => K.store.set("bugReports", JSON.stringify(reports));

  // Markdown meant to be pasted into Claude Code: the description, then what's needed to diagnose it.
  function build(A, description) {
    const recent = log => log.slice(0, 3).map(c => `- v${c.version} (${c.date}): ${c.changes.join(" ")}`);
    let appLines;
    try { appLines = A.bugState ? A.bugState() : []; } catch (err) { appLines = [`- (couldn't read the app's state: ${err.message})`]; }
    return [
      `# Bug Report — ${A.meta.name} (Kyoshi)`, "",
      `**Reported:** ${new Date().toISOString()}`,
      `**App Version:** ${A.VERSION}`,
      `**Kyoshi Version:** ${K.VERSION}`,
      `**Data Schema Version:** ${A.data ? A.data.schemaVersion : "n/a"}`, "",
      "## Description", description || "_(no description provided)_", "",
      "## Environment",
      `- Platform: ${navigator.platform || "unknown"}`,
      `- User agent: ${navigator.userAgent}`,
      `- Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `- Theme: ${document.documentElement.dataset.theme}`,
      `- Language: ${navigator.language}`,
      `- Online: ${navigator.onLine}`,
      `- Apps: ${K.order.map(id => `${K.apps[id].meta.name} ${K.apps[id].VERSION}${K.apps[id].started ? "" : " (failed to start)"}`).join(", ")}`, "",
      "## App State",
      ...appLines,
      `- Unsaved changes since last export: ${K.backup.isUnsaved(A)}`,
      `- Folder sync: ${K.sync.supported ? K.sync.state() : "unsupported"}`,
      `- Storage: ${K.storage.backend()}`,
      `- App date: ${todayStr()}${K.testMode ? ` (time travel +${K.dayOffset} days, test mode)` : ""}`,
      `- Dev mode: ${K.dev.isOn()}`, "",
      "## Recent Console Activity",
      ...(K.debugLog.length ? ["```", ...K.debugLog.map(l => `[${l.time}] ${l.level.toUpperCase()}: ${l.message}`), "```"] : ["_(none captured this session)_"]), "",
      `## Recent Changelog — ${A.meta.name}`,
      ...recent(A.CHANGELOG || []), "",
      "## Recent Changelog — Kyoshi",
      ...recent(K.CHANGELOG)
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
    K.modal.define($("kBugOverlay"), { pending: () => $("kBugText").value.trim() !== "", ask: "Discard this bug report? It hasn't been submitted." });
    $("kReportBug").addEventListener("click", e => { e.preventDefault(); open(); });
    $("kBugSubmit").addEventListener("click", submit);
  }

  K.bugs = { init, load, open, isOpen, count: () => reports.length, copyAll, download, clear, build };
})(Kyoshi);
