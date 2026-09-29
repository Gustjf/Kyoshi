/* Appa · job-view.js — the job view: what you see while doing a job. The job and its thing, when it's
 * due, where its interval comes from, your notes (lines starting "-", "*" or "•" are bullets; links
 * work), and last time. Then Start → Finish: the timer is this device's own (A.store "timer", so it
 * survives a reload), and the screen is kept awake while it runs where the browser allows (Wake Lock).
 * Finish opens the one-tap Done (record.js); "Already done? Log it" skips the timer. No checklists. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, SEP } = K.util;
  const { ICONS, fmtMinutes, fmtReading, fmtDay, sourceLink } = A;
  let lock = null; // the screen's wake lock, while a timer runs

  // Notes as HTML: bullet lines become lists, other lines paragraphs; web addresses become links.
  const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  function notesHTML(text) {
    const out = [];
    let list = [];
    const flush = () => { if (list.length) out.push(`<ul>${list.map(li => `<li>${linkify(li)}</li>`).join("")}</ul>`); list = []; };
    String(text || "").split(/\r?\n/).forEach(line => {
      const m = /^\s*[-*•]\s*(.*)$/.exec(line);
      if (m && m[1].trim()) list.push(m[1].trim());
      else { flush(); if (line.trim()) out.push(`<p>${linkify(line.trim())}</p>`); }
    });
    flush();
    return out.join("");
  }

  // Minutes the timer has run (at least one when rounding for a record).
  const elapsedMinutes = (round = true) => (S.timer ? Math.max(round ? 1 : 0, Math.round((Date.now() - S.timer.start) / 60000)) : 0);

  function renderJob(job) {
    const t = A.thingById(job.thingId), status = A.statusOf(job), doc = A.docOf(t, job.source.docId), link = sourceLink(doc, job.source.where);
    $("jobBack").innerHTML = `&larr; ${esc(t.name)}`;
    $("jvThing").textContent = [t.name, t.about].filter(Boolean).join(" · ");
    $("jvTitle").textContent = job.name;
    $("jvDue").innerHTML = `${A.dot(status)}<span class="${status}">${esc(A.dueText(job))}</span><span class="job-every">${esc(A.everyText(job, t))}</span>`;
    $("jvSource").innerHTML = doc ? `Source: ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(doc.title)}</a>` : esc(doc.title)}${job.source.where ? `, ${esc(job.source.where)}` : ""}${!link && doc.link ? ` (${esc(doc.link)})` : ""}` : "";
    $("jvNotes").innerHTML = notesHTML(job.notes) || `<p class="muted">No notes yet. Edit the job to add what you need and how (parts, fluids, specs, steps): they show here while you do it.</p>`;
    const last = A.lastDone(job), r = last && last.record, took = r && (r.jobs.find(x => x.jobId === job.id) || {}).minutes;
    $("jvLast").innerHTML = r ? `Last time: ${esc(fmtDay(r.date))}${r.reading !== null ? `${SEP}${esc(fmtReading(r.reading, t))}` : ""}${took ? `${SEP}took ${esc(fmtMinutes(took))}` : ""}${r.by ? `${SEP}${esc(r.by)}` : ""}${r.notes ? `<div class="last-notes">${esc(r.notes)}</div>` : ""}` : "";
    renderActions(job);
    // Other jobs on this thing that are due too: one after another.
    const also = A.jobsOf(t.id).filter(j => j.id !== job.id && ["overdue", "soon"].includes(A.statusOf(j)));
    $("jvNext").hidden = !also.length || t.archived;
    $("jvNext").innerHTML = also.map(j => `<div class="next-item"><span>Also due on ${esc(t.name)}: <strong>${esc(j.name)}</strong>${SEP}${esc(A.dueText(j))}</span><button class="small secondary" data-act="open-job" data-id="${esc(j.id)}">Open</button></div>`).join("");
  }

  function renderActions(job) {
    const running = !!S.timer && S.timer.jobId === job.id, other = S.timer && !running && A.jobById(S.timer.jobId);
    const edit = `<button class="more-link" data-act="edit-job" data-id="${esc(job.id)}">Edit job</button>`;
    if (A.thingById(job.thingId).archived) { $("jvActions").innerHTML = edit; return; }
    $("jvActions").innerHTML = running
      ? `<div class="timer-run">${ICONS.timer}<span id="jvElapsed">${esc(elapsedText())}</span></div>` +
        `<button class="big" data-act="finish" data-id="${esc(job.id)}">Finish</button>` +
        `<div class="job-links"><button class="more-link" data-act="cancel-timer">Cancel the timer</button>${edit}</div>`
      : `<button class="big" data-act="start" data-id="${esc(job.id)}"${other ? " disabled" : ""}>Start</button>` +
        `<div class="job-links"><button class="more-link" data-act="log-it" data-id="${esc(job.id)}">Already done? Log it</button>${edit}</div>` +
        (other ? `<div class="field-note">The timer is running for ${esc(other.name)}: finish or cancel that one first.</div>` : "");
  }
  const elapsedText = () => { const m = elapsedMinutes(false); return m ? `${fmtMinutes(m)} so far` : "Started just now"; };

  // Every few seconds while a timer runs: its time on the job view and in the timer bar.
  function updateElapsed() {
    if (!S.timer || !A.isActive()) return;
    const el = $("jvElapsed");
    if (el) el.textContent = elapsedText();
    A.renderTimerBar();
  }

  // The screen stays on while a timer runs and Appa is on screen (the browser may say no: then it just
  // follows its own settings).
  async function keepAwake(on) {
    try {
      if (!on || !S.timer || !A.isActive()) {
        if (lock) await lock.release();
        lock = null;
        return;
      }
      if (lock || !navigator.wakeLock || document.hidden) return;
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { lock = null; });
    } catch (err) {
      lock = null;
    }
  }

  function start(id) {
    const job = A.jobById(id);
    if (!job || (S.timer && A.jobById(S.timer.jobId))) return; // one at a time (a deleted job's timer doesn't count)
    S.timer = { jobId: job.id, start: Date.now() };
    A.storeTimer();
    keepAwake(true);
    A.renderAll();
  }
  // Finish: the one-tap Done with the timer's minutes (the timer stops once it's logged).
  function finish(id) {
    const job = A.jobById(id);
    if (job && S.timer && S.timer.jobId === id) A.openRecord({ mode: "done", jobId: id, minutes: elapsedMinutes(), timed: true });
  }
  function stopTimer() {
    S.timer = null;
    A.storeTimer();
    keepAwake(false);
  }
  function cancelTimer() {
    if (!S.timer || !confirm("Stop the timer without logging anything?")) return;
    stopTimer();
    A.renderAll();
  }

  Object.assign(A, { renderJob, notesHTML, elapsedMinutes, updateElapsed, keepAwake, start, finish, stopTimer, cancelTimer });
})(Kyoshi, Kyoshi.apps.appa);
