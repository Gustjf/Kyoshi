/* Appa · events.js — loads last: wires the page (A.init) and the hooks Kyoshi calls (the app contract,
 * root CLAUDE.md): onShow, awake (a running timer keeps the screen on while Appa is on screen:
 * core/wakelock.js), onTick (a new day; the timer's minutes), onKeydown (Enter saves a pop-up),
 * onReload (another tab saved), attention (a job overdue, a reading asked for), renderDev (photos &
 * documents) and bugState (counts only: never names, notes, readings, costs or files). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { todayStr, readNumber, fmtBytes } = K.util;

  // The page's buttons and rows say what they do in data-act (and whose, in data-id).
  const ACTS = {
    "open-job": el => A.openJob(el.dataset.id),
    "open-thing": el => A.openThing(el.dataset.id),
    "open-record": el => A.openRecord({ mode: "full", id: el.dataset.id }),
    "save-ask": el => A.saveReading(el.dataset.id, readNumber(A.root.querySelector(`input[data-ask="${CSS.escape(el.dataset.id)}"]`))),
    reading: el => A.openReading(el.dataset.id),
    start: el => A.start(el.dataset.id),
    finish: el => A.finish(el.dataset.id),
    "cancel-timer": () => A.cancelTimer(),
    "log-it": el => A.openRecord({ mode: "log", jobId: el.dataset.id }),
    "edit-job": el => A.openJobEditor(el.dataset.id),
    "all-records": () => { S.allRecords = true; S.page = 1; A.renderAll(); },
    "recent-records": () => { S.allRecords = false; A.renderAll(); },
    page: el => { S.page += +el.dataset.step; A.renderAll(); }
  };
  function act(e) {
    if (e.target.closest("a") || e.target.closest(".overlay") || e.target.closest("input")) return; // links, pop-ups and fields do their own thing
    const go = e.target.closest("[data-go]");
    if (go) return A.showView(go.dataset.go, go.dataset.id || "");
    const el = e.target.closest("[data-act]");
    if (el && ACTS[el.dataset.act]) ACTS[el.dataset.act](el);
  }

  A.init = () => {
    A.wireThingEditor();
    A.wireJobEditor();
    A.wireRecord();
    A.wireReport();
    A.root.addEventListener("click", act);
    // Rows that open something work from the keyboard too.
    A.root.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-act], tr[data-act]")) { e.preventDefault(); act(e); }
    });
    $("addThingBtn").addEventListener("click", () => A.openThingEditor(null));
    $("editThingBtn").addEventListener("click", () => A.openThingEditor(S.thingId));
    $("addJobBtn").addEventListener("click", () => A.openJobEditor(null, S.thingId));
    $("addRecordBtn").addEventListener("click", () => A.openRecord({ mode: "full", thingId: S.thingId }));
    $("logWorkBtn").addEventListener("click", () => A.openRecord({ mode: "full" }));
    $("reportBtn").addEventListener("click", () => A.openReport(""));
    $("thingReportBtn").addEventListener("click", () => A.openReport(S.thingId));
    $("jobBack").addEventListener("click", () => { const j = A.jobById(S.jobId); A.showView(j ? "thing" : "home", j ? j.thingId : ""); });
    // The running timer's minutes.
    setInterval(A.updateElapsed, 15000);
    A.renderAll();
  };

  A.onShow = () => A.renderAll();

  // The screen stays on while a timer runs and Appa is on screen (core/wakelock.js; start and stop tell it). A timer
  // whose job was deleted (here or on another device) doesn't count, as for Start.
  A.awake = () => !!S.timer && !!A.jobById(S.timer.jobId);

  // Every minute, and when the page is back in view: a new day moves what's due.
  A.onTick = () => {
    if (todayStr() !== S.knownToday) A.renderAll();
    else A.updateElapsed();
  };

  // Enter saves the pop-up it's typed in, or Coming up's quick reading.
  function askKey(e) {
    if (e.key !== "Enter" || !e.target.matches("input[data-ask]")) return false;
    e.preventDefault();
    A.saveReading(e.target.dataset.ask, readNumber(e.target));
    return true;
  }
  A.onKeydown = e => A.thingKey(e) || A.jobKey(e) || A.recordKey(e) || A.reportKey(e) || askKey(e);

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  A.attention = () => {
    const overdue = A.upcoming().filter(x => x.status === "overdue").length;
    if (overdue) return `${overdue} job${overdue === 1 ? " is" : "s are"} overdue`;
    return A.activeThings().some(A.readingAsk) ? "a meter reading is asked for" : "";
  };

  // Developer Mode: the photos and PDFs on this device, and removing any the data no longer uses.
  A.renderDev = box => {
    const live = A.live(S.files);
    box.innerHTML = `<div class="dev-block"><div class="dev-block-head">Photos &amp; PDFs: <strong>${live.length}</strong> (${fmtBytes(live.reduce((n, f) => n + f.size, 0))})</div>
      <div class="dev-hint" id="appaFilesNote">Checking this device…</div>
      <div class="dev-actions"><button class="secondary small" id="appaUnusedBtn" hidden>Remove unused files</button></div></div>`;
    Promise.all([A.files.ids(), K.files.unused(A)]).then(([ids, unused]) => {
      const note = box.querySelector("#appaFilesNote"), btn = box.querySelector("#appaUnusedBtn");
      if (!note) return;
      const here = new Set(ids), missing = live.filter(f => !here.has(f.id)).length;
      note.textContent = `${missing ? `${missing} not on this device (folder sync brings them; the cloud never carries photos or PDFs). ` : "All on this device. "}${unused.length ? `${unused.length} no longer used.` : ""}`;
      btn.hidden = !unused.length;
      btn.addEventListener("click", async () => {
        if (!confirm(`Remove ${unused.length} file${unused.length === 1 ? "" : "s"} that no record uses any more?`)) return;
        await Promise.all(unused.map(id => A.files.remove(id).catch(() => {})));
        A.refreshDev();
      });
    }).catch(() => {});
  };

  // Bug reports: counts and settings only.
  A.bugState = () => {
    const things = A.live(S.things), up = A.upcoming(), count = st => up.filter(x => x.status === st).length;
    return [
      `- View: ${S.view}${S.rec ? `, record pop-up (${S.rec.mode})` : ""}${S.editing ? `, ${S.editing.kind} editor` : ""}`,
      `- Things: ${things.length} (${things.filter(t => t.archived).length} archived; meters: ${Object.keys(A.METERS).map(m => `${m} ${things.filter(t => t.meter === m).length}`).join(", ")})`,
      `- Jobs: ${A.live(S.jobs).length} (${count("overdue")} overdue, ${count("soon")} soon, ${count("near")} near, ${count("unknown")} unknown)`,
      `- Records: ${A.live(S.records).length}, readings: ${A.live(S.readings).length}, photos & PDFs: ${A.live(S.files).length}`,
      `- Deleted markers: ${["things", "jobs", "records", "readings", "files"].map(k => S[k].filter(i => i.deleted).length).join("/")}`,
      `- Needs for Momo: ${A.inbox().length}; reading asks: ${things.filter(A.readingAsk).length}; timer: ${S.timer ? "running" : "off"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.appa);
