/* Appa · record.js — the record pop-up (#recOverlay) and the reading pop-up (#readingOverlay).
 * A record is one visit's work: the jobs done (and/or other work in words), the day, how long it took
 * (a visit's time is shared between its jobs by their usual lengths), the reading, and optional details:
 * who did it, cost, notes and proof (proof.js). Modes (S.rec.mode):
 *   done — after the timer's Finish: one tap (the time and today filled in; details tucked away)
 *   log  — "Already done? Log it": the same, with the usual time filled in to correct
 *   full — adding past or unscheduled work, or opening a record: every field
 * New photos and PDFs are saved first (A.files), then the record, then A.changed(). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr, isDate, newId, readNumber, fmtNum } = K.util;
  const { DEFAULT_MINUTES, meterOf, fmtMinutes, fmtReading, parseMinutes, parseMoney, cleanLine, cleanText, MAX_TITLE, MAX_BY, MAX_RECORD_NOTES } = A;
  const overlay = () => $("recOverlay"), readingOverlay = () => $("readingOverlay");
  const FIELDS = ["rcThing", "rcWhat", "rcDate", "rcTook", "rcReading", "rcBy", "rcCost", "rcNotes"];
  const formState = () => JSON.stringify([FIELDS.map(id => $(id).value), [...S.rec.jobIds], S.rec.files.map(f => [f.key || f.id, !!f.removed]), S.rec.links]);

  function define() {
    K.modal.define(overlay(), {
      dismiss: closeRecord,
      pending: () => !!S.rec && formState() !== S.rec.snapshot,
      ask: "Discard what you've entered?"
    });
    K.modal.define(readingOverlay(), { dismiss: () => { K.modal.close(readingOverlay()); S.reading = null; } });
  }
  function closeRecord() {
    K.modal.close(overlay());
    S.rec = null;
    A.releaseProof();
  }

  // Opens the pop-up. { mode: "done", jobId, minutes, timed } | { mode: "log", jobId } |
  // { mode: "full", thingId? } for new work | { mode: "full", id } to open a record.
  function openRecord(o) {
    const r = o.id ? A.recordById(o.id) : null, job = o.jobId ? A.jobById(o.jobId) : null;
    const thingId = r ? r.thingId : job ? job.thingId : o.thingId || "";
    if ((o.id && !r) || (o.jobId && !job)) return A.renderAll();
    const e = S.rec = {
      mode: o.mode, id: r ? r.id : null, thingId, mainJobId: job ? job.id : "", timed: !!o.timed,
      jobIds: new Set(r ? r.jobs.map(x => x.jobId).filter(id => A.jobById(id)) : job ? [job.id] : []),
      gone: r ? r.jobs.filter(x => !A.jobById(x.jobId)) : [], // jobs deleted since: kept in the record as they were
      files: r ? r.files.map(id => A.fileById(id)).filter(Boolean).map(f => ({ ...f, isNew: false })) : [],
      links: r ? r.links.map(l => ({ ...l })) : []
    };
    const full = e.mode === "full";
    $("rcTitle").textContent = r ? "Record" : e.mode === "done" ? `Done: ${job.name}` : e.mode === "log" ? `Log: ${job.name}` : "Add a record";
    $("rcThing").innerHTML = A.activeThings().map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
    $("rcThingField").hidden = !full || !!r || !!o.thingId;
    if (!thingId && A.activeThings().length) e.thingId = A.activeThings()[0].id;
    $("rcThing").value = e.thingId;
    $("rcWhatField").hidden = !full;
    $("rcWhat").value = r ? r.title : "";
    $("rcDate").value = r ? r.date : todayStr();
    const took = r ? r.jobs.reduce((n, x) => n + (x.minutes || 0), 0) || r.minutes || 0 : o.minutes || (job ? A.minutesOf(job) : 0);
    $("rcTook").value = took ? fmtMinutes(took) : "";
    $("rcReading").value = r && r.reading !== null ? fmtNum(r.reading, 1) : "";
    $("rcBy").value = r ? r.by : "";
    $("rcCost").value = r && r.cost !== null ? (r.cost / 100).toFixed(2) : "";
    $("rcNotes").value = r ? r.notes : "";
    $("rcShops").innerHTML = [...new Set(A.live(S.records).map(x => x.by).filter(Boolean))].map(b => `<option value="${esc(b)}"></option>`).join("");
    $("rcMore").hidden = !full;
    $("rcMoreBtn").hidden = full;
    $("rcLinkEntry").hidden = true;
    $("rcDeleteBtn").hidden = !r;
    $("rcSaveBtn").textContent = full ? "Save" : "Done";
    $("rcStatus").textContent = "";
    $("rcProofNote").textContent = "";
    K.files.ready().then(ok => {
      $("rcProofActions").hidden = !ok;
      if (!ok) $("rcProofNote").textContent = "This browser can't keep photos or PDFs, so proof can't be added here.";
    });
    renderThingParts();
    A.renderProof();
    e.snapshot = formState();
    K.modal.open(overlay());
    if (e.mode === "done") $("rcSaveBtn").focus();
  }

  // What depends on the thing: its meter, and its jobs as pills — all of them for a full record; for
  // done and log, the others that are due too ("Also done this visit").
  function renderThingParts() {
    const e = S.rec, t = A.thingById(e.thingId), m = meterOf(t);
    $("rcReadingField").hidden = !m;
    if (m) {
      const guess = A.estimate(t, $("rcDate").value || todayStr());
      $("rcReadingLabel").textContent = `${m.reading} (${m.unit})`;
      $("rcReading").placeholder = guess !== null ? `≈ ${Math.round(guess)}` : "";
    }
    const all = t ? A.jobsOf(t.id) : [];
    const pills = e.mode === "full" ? all : all.filter(j => j.id !== e.mainJobId && ["overdue", "soon", "near"].includes(A.statusOf(j)));
    $("rcJobsField").hidden = !pills.length;
    $("rcJobsLabel").textContent = e.mode === "full" ? "Jobs done" : "Also done this visit";
    $("rcJobs").innerHTML = pills.map(j => `<button type="button" class="pill${e.jobIds.has(j.id) ? " active" : ""}" data-job="${esc(j.id)}" aria-pressed="${e.jobIds.has(j.id)}">${esc(j.name)}</button>`).join("");
    $("rcWhatLabel").textContent = pills.length ? "Other work (optional)" : "What was done";
  }

  function toggleJob(id) {
    const e = S.rec;
    if (!e) return;
    if (e.jobIds.has(id)) e.jobIds.delete(id); else e.jobIds.add(id);
    renderThingParts();
  }
  function changeThing() {
    const e = S.rec;
    if (!e) return;
    e.thingId = $("rcThing").value;
    e.jobIds = new Set();
    renderThingParts();
  }

  // A visit's minutes shared between its jobs by their usual lengths (whole minutes adding up to it); none for no jobs.
  function share(total, jobs) {
    if (!total || !jobs.length) return jobs.map(() => null);
    const weights = jobs.map(j => A.minutesOf(j) || DEFAULT_MINUTES), sum = weights.reduce((a, b) => a + b, 0);
    const parts = weights.map(w => Math.floor(total * w / sum));
    parts[0] += total - parts.reduce((a, b) => a + b, 0);
    return parts.map(p => p || null);
  }

  async function saveRecord() {
    const e = S.rec;
    if (!e || e.busy) return;
    const t = A.thingById(e.thingId), existing = e.id ? A.recordById(e.id) : null;
    if (!t || (e.id && !existing)) {
      closeRecord();
      A.renderAll();
      return alert("That was deleted on another device, so nothing was saved.");
    }
    const jobs = [...e.jobIds].map(A.jobById).filter(Boolean); // jobs deleted meanwhile drop out
    const title = cleanLine($("rcWhat").value, MAX_TITLE), date = $("rcDate").value, today = todayStr();
    if (!jobs.length && !title && !e.gone.length) return alert(e.mode === "full" ? "Pick the jobs that were done, or say what was done." : "That job was deleted meanwhile, so there's nothing to log.");
    if (!isDate(date)) { $("rcDate").focus(); return alert("Enter the day it was done."); }
    if (date > today) { $("rcDate").focus(); return alert("That day hasn't come yet."); }
    const took = parseMinutes($("rcTook").value);
    if (Number.isNaN(took) || took > A.MAX_MINUTES) { $("rcTook").focus(); return alert("Enter how long it took, like 45 min or 1:30."); }
    let reading = null;
    if (meterOf(t)) {
      reading = readNumber($("rcReading"));
      if (Number.isNaN(reading) || reading < 0) { $("rcReading").focus(); return alert("Enter the reading as a number."); }
      if (reading !== null && !lowReadingOk(t, reading, date, e.id)) return;
    }
    const cost = parseMoney($("rcCost").value);
    if (Number.isNaN(cost)) { $("rcCost").focus(); return alert("Enter the cost as an amount, like 62.40."); }

    // Photos and PDFs first: a record never points at a file that wasn't kept.
    e.busy = true;
    $("rcStatus").textContent = "Saving…";
    try {
      for (const f of e.files.filter(x => x.isNew && !x.removed && !x.id)) f.id = await A.files.put(f.blob);
    } catch (err) {
      e.busy = false;
      $("rcStatus").textContent = "";
      console.warn("Appa couldn't keep a photo or PDF on this device.");
      return alert("Couldn't keep the photos and PDFs on this device (it may be out of room), so nothing was saved yet.");
    }
    if (S.rec !== e) return;
    const now = Date.now(), minutes = share(took, jobs);
    e.files.filter(f => f.isNew && !f.removed).forEach(f => S.files.push({ id: f.id, kind: f.kind, name: f.name, type: f.type, size: f.size, pages: f.pages || 0, w: f.w || 0, h: f.h || 0, deleted: false, at: now, u: now }));
    e.files.filter(f => !f.isNew && f.removed).forEach(f => {
      const meta = S.files.find(x => x.id === f.id);
      if (meta) Object.assign(meta, { name: "", deleted: true, u: now });
      A.files.remove(f.id).catch(() => {});
    });
    const done = jobs.map((j, i) => ({ jobId: j.id, name: j.name, minutes: minutes[i], timed: e.timed && jobs.length === 1 })).concat(e.gone);
    const fields = {
      thingId: t.id, date, reading, title,
      jobs: done, minutes: done.length ? null : took || null, // other work alone keeps its time itself
      by: cleanLine($("rcBy").value, MAX_BY).replace(/^(you|me)$/i, ""),
      cost, notes: cleanText($("rcNotes").value, MAX_RECORD_NOTES),
      files: e.files.filter(f => !f.removed && f.id).map(f => f.id), links: e.links
    };
    if (existing) Object.assign(existing, fields, { u: now });
    else S.records.push({ id: newId(), ...fields, deleted: false, at: now, u: now });
    if (e.mode === "done") A.stopTimer();
    A.save();
    closeRecord();
    A.renderAll();
  }

  // A reading out of step with the others is questioned (a replaced meter, or a typo): lower than one
  // logged before its day, or higher than one logged after it. The record being edited doesn't count.
  function lowReadingOk(t, value, date, skipRecordId) {
    const own = skipRecordId && A.recordById(skipRecordId), pts = A.points(t.id).filter(p => !(own && p.date === own.date && p.value === own.reading));
    const higher = pts.filter(p => p.date <= date && p.value > value).pop(), lower = pts.find(p => p.date > date && p.value < value);
    if (higher) return confirm(`That's lower than the ${fmtReading(higher.value, t)} logged ${A.fmtDay(higher.date)}. Keep it anyway?`);
    if (lower) return confirm(`That's higher than the ${fmtReading(lower.value, t)} logged later, on ${A.fmtDay(lower.date)}. Keep it anyway?`);
    return true;
  }

  function deleteRecord() {
    const e = S.rec, r = e && A.recordById(e.id);
    if (!r || !confirm("Delete this record and its photos and PDFs? This can't be undone.")) return;
    const now = Date.now();
    r.files.forEach(id => {
      const meta = S.files.find(x => x.id === id);
      if (meta) Object.assign(meta, { name: "", deleted: true, u: now });
      A.files.remove(id).catch(() => {});
    });
    Object.assign(r, { title: "", jobs: [], notes: "", files: [], links: [], deleted: true, u: now });
    A.save();
    closeRecord();
    A.renderAll();
  }

  // ==========================================================================
  // The reading pop-up
  // ==========================================================================
  function openReading(thingId) {
    const t = A.thingById(thingId), m = meterOf(t);
    if (!m) return;
    const last = A.lastReading(t.id), guess = A.estimate(t);
    S.reading = { thingId: t.id };
    $("rdTitle").textContent = `${t.name}: ${m.reading.toLowerCase()}`;
    $("rdHint").textContent = last ? `Last: ${fmtReading(last.value, t)} on ${A.fmtDay(last.date)}.${guess !== null && guess !== last.value ? ` Probably about ${fmtReading(Math.round(guess), t)} by now.` : ""}` : "What does it read today?";
    $("rdLabel").textContent = `${m.reading} (${m.unit})`;
    $("rdValue").value = "";
    $("rdDate").value = todayStr();
    K.modal.open(readingOverlay());
    $("rdValue").focus();
  }
  // Keeps a reading (from the pop-up, or Coming up's quick entry); false if it wasn't one.
  function saveReading(thingId, value, date = todayStr()) {
    const t = A.thingById(thingId);
    if (!t || !meterOf(t)) return false;
    if (value === null || Number.isNaN(value) || value < 0) { alert("Enter the reading as a number."); return false; }
    if (!isDate(date) || date > todayStr()) { alert("Enter a day that has come."); return false; }
    if (!lowReadingOk(t, value, date, null)) return false;
    const now = Date.now();
    S.readings.push({ id: newId(), thingId, date, value, deleted: false, at: now, u: now });
    A.save();
    A.renderAll();
    return true;
  }
  function saveReadingPopup() {
    if (!S.reading) return;
    if (saveReading(S.reading.thingId, readNumber($("rdValue")), $("rdDate").value)) K.modal.dismiss(readingOverlay());
  }

  function wireRecord() {
    define();
    $("rcSaveBtn").addEventListener("click", saveRecord);
    $("rcCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
    $("rcDeleteBtn").addEventListener("click", deleteRecord);
    $("rcMoreBtn").addEventListener("click", () => { $("rcMore").hidden = false; $("rcMoreBtn").hidden = true; });
    $("rcThing").addEventListener("change", changeThing);
    $("rcDate").addEventListener("change", () => { if (S.rec) renderThingParts(); });
    $("rcJobs").addEventListener("click", ev => { const b = ev.target.closest("[data-job]"); if (b) toggleJob(b.dataset.job); });
    $("rcAddPhoto").addEventListener("click", () => $("rcPhotoFile").click());
    $("rcAddPdf").addEventListener("click", () => $("rcPdfFile").click());
    $("rcAddLink").addEventListener("click", () => { $("rcLinkEntry").hidden = false; $("rcLinkUrl").focus(); });
    $("rcLinkAdd").addEventListener("click", A.addLink);
    $("rcPhotoFile").addEventListener("change", ev => { const f = [...ev.target.files]; ev.target.value = ""; A.addPhotos(f); });
    $("rcPdfFile").addEventListener("change", ev => { const f = [...ev.target.files]; ev.target.value = ""; A.addPdfs(f); });
    $("rcProof").addEventListener("click", ev => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "proof-open") A.openProof(b.dataset.key);
      else if (b.dataset.act === "proof-remove") A.removeProof(b.dataset.key);
      else if (b.dataset.act === "link-remove") A.removeLink(+b.dataset.index);
    });
    $("rdSaveBtn").addEventListener("click", saveReadingPopup);
    $("rdCancelBtn").addEventListener("click", () => K.modal.dismiss(readingOverlay()));
  }

  // Enter in a one-line field saves the pop-up it's in (the link entry adds its link).
  function recordKey(ev) {
    if (ev.key !== "Enter" || ev.target.tagName !== "INPUT") return false;
    if (ev.target.id === "rcLinkUrl" || ev.target.id === "rcLinkLabel") { ev.preventDefault(); A.addLink(); return true; }
    if (K.modal.isOpen(overlay()) && overlay().contains(ev.target)) { ev.preventDefault(); saveRecord(); return true; }
    if (K.modal.isOpen(readingOverlay()) && readingOverlay().contains(ev.target)) { ev.preventDefault(); saveReadingPopup(); return true; }
    return false;
  }

  Object.assign(A, { wireRecord, openRecord, openReading, saveReading, recordKey });
})(Kyoshi, Kyoshi.apps.appa);
