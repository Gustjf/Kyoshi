/* Appa · render.js — draws what's on screen from A.S: one view at a time (showView) — home (Coming up,
 * Things, Records), a thing (its reading and sources, Schedule, History) or a job (job-view.js) — the
 * records tables with their paging, and the bar that shows a running timer anywhere else. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, fmtDate, SEP } = K.util;
  const { PAGE_SIZE, RECENT, ICONS, fmtMinutes, fmtReading, fmtMoney, fmtDay, meterOf, sourceLink } = A;
  const VIEWS = { home: "homeView", thing: "thingView", job: "jobView" };

  // Puts a view on screen: "home", or a thing's or a job's (id).
  function showView(view, id = "") {
    S.view = VIEWS[view] ? view : "home";
    if (S.view === "thing") S.thingId = id;
    if (S.view === "job") S.jobId = id;
    S.page = 1;
    A.renderAll();
    window.scrollTo(0, 0);
  }
  const openThing = id => showView("thing", id);
  const openJob = id => showView("job", id);

  function renderAll() {
    S.knownToday = K.util.todayStr();
    // A view whose thing or job is gone (deleted on another device, say) falls back to home.
    if (S.view === "thing" && !A.thingById(S.thingId)) S.view = "home";
    if (S.view === "job" && !(A.jobById(S.jobId) && A.thingById(A.jobById(S.jobId).thingId))) S.view = "home";
    Object.entries(VIEWS).forEach(([v, id]) => { $(id).hidden = v !== S.view; });
    if (S.view === "home") renderHome();
    else if (S.view === "thing") renderThing(A.thingById(S.thingId));
    else A.renderJob(A.jobById(S.jobId));
    renderTimerBar();
    K.refreshSwitcher();
    A.refreshDev();
  }

  const dot = status => `<span class="dot ${status}" aria-hidden="true"></span>`;
  const est = job => { const m = A.minutesOf(job); return m ? `~${fmtMinutes(m)}` : ""; };

  // ==========================================================================
  // Home
  // ==========================================================================
  function renderHome() {
    const things = A.activeThings(), archived = A.archivedThings();
    $("comingUp").innerHTML = comingUpHTML(things);
    $("logWorkBtn").hidden = !things.length;
    $("thingsEmpty").hidden = things.length > 0 || archived.length > 0;
    $("thingsList").innerHTML = things.map(thingRowHTML).join("");
    $("archivedBox").hidden = !archived.length;
    $("archivedCount").textContent = archived.length;
    $("archivedList").innerHTML = archived.map(thingRowHTML).join("");
    const records = A.recordsOf("");
    $("recordsSection").hidden = !records.length;
    $("homeRecords").innerHTML = records.length ? recordsHTML(records, { withThing: true, recent: !S.allRecords }) : "";
  }

  // Coming up: readings asked for, then jobs overdue or due within SOON_DAYS; else when the next one is.
  function comingUpHTML(things) {
    if (!things.length) return `<div class="empty-msg">Nothing to look after yet.</div>`;
    const asks = things.map(t => ({ t, ask: A.readingAsk(t) })).filter(x => x.ask);
    const all = A.upcoming(), close = all.filter(x => x.status !== "later" && x.status !== "unknown");
    let html = asks.map(({ t }) => {
      const last = A.lastReading(t.id), guess = A.estimate(t), m = meterOf(t);
      const sub = last ? `Last: ${fmtReading(last.value, t)} on ${fmtDay(last.date)}` : "No reading yet";
      return `<div class="row-item ask">${dot("ask")}<div class="row-main"><div class="row-title">${esc(t.name)}: what's the ${esc(m.reading.toLowerCase())} now?</div><div class="row-sub">${esc(sub)}</div></div>` +
        `<div class="ask-entry"><input type="number" min="0" step="any" data-ask="${esc(t.id)}" placeholder="${guess !== null ? `≈ ${Math.round(guess)}` : m.unit}" aria-label="${esc(t.name)} ${esc(m.reading.toLowerCase())} (${m.unit})"><span class="unit">${m.unit}</span>` +
        `<button class="small" data-act="save-ask" data-id="${esc(t.id)}">Save</button></div></div>`;
    }).join("");
    html += close.map(({ job, status }) => {
      const t = A.thingById(job.thingId), running = S.timer && S.timer.jobId === job.id;
      return `<div class="row-item job-row" data-act="open-job" data-id="${esc(job.id)}" role="button" tabindex="0">${dot(status)}<div class="row-main">` +
        `<div class="row-title">${esc(t.name)} <span class="sep-dash">&mdash;</span> ${esc(job.name)}</div>` +
        `<div class="row-sub"><span class="${status}">${esc(A.dueText(job))}</span>${est(job) ? `${SEP}${esc(est(job))}` : ""}${running ? `${SEP}timer running` : ""}</div></div>` +
        `<button class="small${status === "overdue" || status === "soon" ? "" : " secondary"}" data-act="open-job" data-id="${esc(job.id)}">Open</button></div>`;
    }).join("");
    if (!close.length) {
      const next = all.find(x => x.due.date);
      html += `<div class="caught-up"><strong>All caught up.</strong> ${next ? `Next: ${esc(A.thingById(next.job.thingId).name)} &mdash; ${esc(next.job.name)}, ${esc(next.due.by === "meter" ? `about ${fmtDay(next.due.date)}` : fmtDay(next.due.date))}.` : all.length ? "" : "Add jobs to your things to see what's coming."}</div>`;
    }
    return html;
  }

  function thingRowHTML(t) {
    const next = A.nextOf(t.id), last = A.lastReading(t.id);
    const bits = [t.about, meterOf(t) && last ? fmtReading(last.value, t) : ""].filter(Boolean).map(esc);
    const nextText = t.archived ? "Archived" : next ? `Next: ${esc(next.job.name)}, ${esc(A.dueText(next.job).replace(/^Due /, "").toLowerCase())}` : A.jobsOf(t.id).length ? "" : "No jobs yet";
    return `<div class="row-item thing-row" data-act="open-thing" data-id="${esc(t.id)}" role="button" tabindex="0">${t.archived ? "" : dot(next ? next.status : "none")}` +
      `<div class="row-main"><div class="row-title">${esc(t.name)}</div><div class="row-sub">${bits.join(SEP)}${bits.length && nextText ? SEP : ""}${nextText}</div></div></div>`;
  }

  // ==========================================================================
  // A thing
  // ==========================================================================
  function renderThing(t) {
    const m = meterOf(t), last = A.lastReading(t.id);
    $("thName").textContent = t.name + (t.archived ? " (archived)" : "");
    $("thAbout").innerHTML = [t.about, t.serial ? `VIN / serial ${t.serial}` : ""].filter(Boolean).map(esc).join(SEP);
    $("meterLine").hidden = !m;
    if (m) {
      const pace = A.paceText(t);
      $("meterLine").innerHTML = `<span>${esc(m.reading)} ${last ? `<strong>${esc(fmtReading(last.value, t))}</strong> on ${esc(fmtDay(last.date))}` : "not read yet"}${pace ? `${SEP}${esc(pace)}` : ""}</span>` +
        `<button class="secondary small" data-act="reading" data-id="${esc(t.id)}">Log reading</button>`;
    }
    $("thSources").innerHTML = t.docs.length ? `Sources: ${t.docs.map(d => {
      const link = sourceLink(d, "");
      return link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(d.title)}</a>` : `${esc(d.title)}${d.link ? ` (${esc(d.link)})` : ""}`;
    }).join(", ")}` : "";
    const jobs = A.jobsOf(t.id);
    $("jobsEmpty").hidden = jobs.length > 0;
    $("jobsList").innerHTML = jobs.map(job => jobRowHTML(t, job)).join("");
    $("addJobBtn").hidden = t.archived;
    $("thingRecords").innerHTML = recordsHTML(A.recordsOf(t.id), { withThing: false }) || `<div class="empty-msg">No records yet. They show up here as you do jobs, or add past ones with + Record.</div>`;
  }

  function jobRowHTML(t, job) {
    const status = A.statusOf(job), doc = A.docOf(t, job.source.docId), link = sourceLink(doc, job.source.where);
    const src = doc ? `${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(doc.title)}</a>` : esc(doc.title)}${job.source.where ? `, ${esc(job.source.where)}` : ""}` : "";
    return `<div class="row-item job-row" data-act="open-job" data-id="${esc(job.id)}" role="button" tabindex="0">${dot(status)}<div class="row-main">` +
      `<div class="row-title">${esc(job.name)}</div>` +
      `<div class="row-sub">${esc(A.everyText(job, t))}${src ? `${SEP}${src}` : ""}</div>` +
      `<div class="row-sub">Last: ${esc(A.lastText(job))}${SEP}<span class="${status}">${esc(A.dueText(job))}</span>${est(job) ? `${SEP}${esc(est(job))}` : ""}</div></div>` +
      `<button class="small secondary" data-act="open-job" data-id="${esc(job.id)}">Open</button></div>`;
  }

  // ==========================================================================
  // Records tables (a thing's History, the home page's Records)
  // ==========================================================================
  // Newest first; recent: just the latest few, with "All records"; otherwise paged.
  function recordsHTML(list, { withThing, recent = false }) {
    if (!list.length) return "";
    const pages = Math.ceil(list.length / PAGE_SIZE);
    S.page = Math.min(Math.max(S.page, 1), pages);
    const shown = recent ? list.slice(0, RECENT) : list.slice((S.page - 1) * PAGE_SIZE, S.page * PAGE_SIZE);
    const rows = shown.map(r => {
      const t = A.thingById(r.thingId), proof = r.files.filter(id => A.fileById(id)).length + r.links.length;
      return `<tr data-act="open-record" data-id="${esc(r.id)}" tabindex="0">` +
        `<td class="c-date">${esc(fmtDate(r.date))}</td>` + (withThing ? `<td class="c-thing">${esc(t ? t.name : "")}</td>` : "") +
        `<td class="c-work">${esc(A.workOf(r))}</td>` +
        `<td class="c-reading">${r.reading !== null ? esc(fmtReading(r.reading, t)) : ""}</td>` +
        `<td class="c-by">${esc(r.by || "You")}</td>` +
        `<td class="c-cost">${r.cost !== null ? esc(fmtMoney(r.cost)) : ""}</td>` +
        `<td class="c-proof">${proof ? `${ICONS.clip}${proof}` : ""}</td></tr>`;
    }).join("");
    const head = `<tr><th>Date</th>${withThing ? "<th>Thing</th>" : ""}<th>Work</th><th>Reading</th><th>By</th><th class="c-cost">Cost</th><th class="c-proof"><span class="sr">Proof</span></th></tr>`;
    const foot = recent
      ? (list.length > RECENT ? `<div class="table-foot"><button class="more-link" data-act="all-records">All ${list.length} records</button></div>` : "")
      : pages > 1 ? `<div class="pagination"><span>Page ${S.page} of ${pages} (${list.length} records)</span><div><button class="secondary small" data-act="page" data-step="-1"${S.page === 1 ? " disabled" : ""}>&larr; Newer</button> <button class="secondary small" data-act="page" data-step="1"${S.page === pages ? " disabled" : ""}>Older &rarr;</button></div></div>` : "";
    const back = !recent && withThing ? `<div class="table-foot"><button class="more-link" data-act="recent-records">Show just the latest</button></div>` : "";
    return `<table class="records">${head}${rows}</table>${foot}${back}`;
  }

  // ==========================================================================
  // The running timer, shown everywhere but its own job's view
  // ==========================================================================
  function renderTimerBar() {
    const job = S.timer && A.jobById(S.timer.jobId), bar = $("timerBar");
    bar.hidden = !job || (S.view === "job" && S.jobId === job.id);
    if (bar.hidden) return;
    const t = A.thingById(job.thingId), mins = A.elapsedMinutes(false);
    bar.innerHTML = `${ICONS.timer}<span><strong>${esc(job.name)}</strong> &middot; ${esc(t ? t.name : "")} &mdash; running ${esc(fmtMinutes(mins) || "under a minute")}</span>` +
      `<button class="small" data-act="open-job" data-id="${esc(job.id)}">Open</button>`;
  }

  Object.assign(A, { showView, openThing, openJob, renderAll, renderTimerBar, dot });
})(Kyoshi, Kyoshi.apps.appa);
