/* Appa · job-editor.js — the job pop-up (#jobOverlay): add or edit a thing's job, as the manual has it.
 * How often: every N days/weeks/months/years or each chosen season, and/or every N on the thing's meter
 * (whichever comes first); when it was last done, for a job with no records yet (else it counts from
 * today); about how long it takes (a guess, until timed jobs say better); its source (one of the
 * thing's manuals, or a new one, and the page or section); and notes: what you need and how, shown while
 * you do it. Delete keeps the job's past records. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, todayStr, isDate, readNumber, fmtNum } = K.util;
  const { MAX_TITLE, MAX_WHERE, MAX_SOURCE, MAX_LINK, MAX_NOTES, meterOf, cleanLine, cleanText, parseMinutes, fmtMinutes } = A;
  const overlay = () => $("jobOverlay");
  const NEW_DOC = "+new";
  const FIELDS = ["jmName", "jmMode", "jmEveryN", "jmEveryUnit", "jmMeterEvery", "jmFromDate", "jmFromReading", "jmEst", "jmSource", "jmWhere", "jmDocTitle", "jmDocLink", "jmNotes"];
  const formState = () => JSON.stringify([FIELDS.map(id => $(id).value), [...S.editing.seasons]]);

  function define() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard what you've entered?"
    });
  }

  // Opens the pop-up for a new job on a thing (id null), or for a job.
  function openJobEditor(id, thingId) {
    const j = id ? A.jobById(id) : null, t = A.thingById(j ? j.thingId : thingId), m = meterOf(t);
    if (!t || (id && !j)) return;
    S.editing = { kind: "job", id: j ? j.id : null, thingId: t.id, seasons: new Set(j ? j.seasons : []) };
    $("jmTitle").textContent = j ? "Edit job" : `Add a job to ${t.name}`;
    $("jmName").value = j ? j.name : "";
    $("jmMode").innerHTML = `<option value="every">Every</option><option value="season">Each season</option>${m ? `<option value="none">Only by the ${esc(m.reading.toLowerCase())}</option>` : ""}`;
    $("jmMode").value = !j || j.every ? "every" : j.seasons.length ? "season" : m ? "none" : "every";
    $("jmEveryN").value = j && j.every ? j.every.n : "";
    $("jmEveryUnit").value = j && j.every ? j.every.unit : "m";
    $("jmMeterEvery").value = j && j.meterEvery ? fmtNum(j.meterEvery, 1) : "";
    $("jmMeterUnit").textContent = m ? m.unit : "";
    $("jmSeasons").innerHTML = K.seasons.NAMES.map((n, s) => `<button type="button" class="pill" data-season="${s}">${n}</button>`).join("");
    // "Last done" only matters before the job has a record.
    const counted = j && A.lastDone(j);
    $("jmFromRow").hidden = !!counted;
    $("jmFromNote").textContent = counted ? "" : "Not sure? Leave it blank: it counts from today.";
    $("jmFromDate").value = j ? j.from.date : "";
    $("jmFromDate").max = todayStr();
    $("jmFromReadingField").hidden = !m;
    $("jmFromReadingLabel").textContent = m ? `At (${m.unit})` : "";
    $("jmFromReading").value = j && j.from.reading !== null ? fmtNum(j.from.reading, 1) : "";
    $("jmEst").value = j && j.est ? fmtMinutes(j.est) : "";
    $("jmSource").innerHTML = `<option value="">(none)</option>` + t.docs.map(d => `<option value="${esc(d.id)}">${esc(d.title)}</option>`).join("") + `<option value="${NEW_DOC}">+ New source…</option>`;
    $("jmSource").value = j && A.docOf(t, j.source.docId) ? j.source.docId : !j && t.docs.length === 1 ? t.docs[0].id : "";
    $("jmWhere").value = j ? j.source.where : "";
    $("jmDocTitle").value = "";
    $("jmDocLink").value = "";
    $("jmNotes").value = j ? j.notes : "";
    $("jmSaveBtn").textContent = j ? "Save" : "Add";
    $("jmDeleteBtn").hidden = !j;
    renderSchedule();
    S.editing.snapshot = formState();
    K.modal.open(overlay());
    if (!j) $("jmName").focus();
  }

  function renderSchedule() {
    const e = S.editing, t = A.thingById(e.thingId), m = meterOf(t), mode = $("jmMode").value;
    $("jmEveryN").hidden = mode !== "every";
    $("jmEveryUnit").hidden = mode !== "every";
    $("jmSeasons").hidden = mode !== "season";
    $("jmSeasons").querySelectorAll("[data-season]").forEach(b => b.classList.toggle("active", e.seasons.has(+b.dataset.season)));
    $("jmMeterRow").hidden = !m;
    $("jmOrEvery").textContent = mode === "none" ? "Every" : "or every";
    $("jmSchedNote").textContent = m && mode !== "none" ? "Whichever comes first. Leave the second one blank if the manual only gives one." : mode === "season" ? "Due as each chosen season starts." : "";
    $("jmNewDoc").hidden = $("jmSource").value !== NEW_DOC;
  }

  function save() {
    const e = S.editing;
    if (!e) return;
    const t = A.thingById(e.thingId), m = meterOf(t), j = e.id ? A.jobById(e.id) : null;
    if (!t || (e.id && !j)) { K.modal.close(overlay()); S.editing = null; A.renderAll(); return alert("That was deleted on another device, so nothing was saved."); }
    const name = cleanLine($("jmName").value, MAX_TITLE);
    if (!name) { $("jmName").focus(); return alert("Name the job, like Oil & filter."); }
    const mode = $("jmMode").value, n = readNumber($("jmEveryN")), meterEvery = m ? readNumber($("jmMeterEvery")) : null;
    if (mode === "every" && !(Number.isInteger(n) && n >= 1 && n <= 999)) { $("jmEveryN").focus(); return alert("Enter how often, as a whole number (like 6 months)."); }
    if (mode === "season" && !e.seasons.size) return alert("Pick the season(s) it's due in.");
    if (Number.isNaN(meterEvery) || (meterEvery !== null && meterEvery <= 0)) { $("jmMeterEvery").focus(); return alert("Enter the meter interval as a number, or leave it blank."); }
    if (mode === "none" && !meterEvery) { $("jmMeterEvery").focus(); return alert(`Enter how often by the ${m.reading.toLowerCase()}.`); }
    const est = parseMinutes($("jmEst").value);
    if (Number.isNaN(est) || est > A.MAX_MINUTES) { $("jmEst").focus(); return alert("Enter about how long it takes, like 30 min or 1:30."); }
    const fromDate = $("jmFromDate").value, fromReading = m ? readNumber($("jmFromReading")) : null;
    if (fromDate && (!isDate(fromDate) || fromDate > todayStr())) { $("jmFromDate").focus(); return alert("Enter a day that has come for when it was last done."); }
    if (Number.isNaN(fromReading) || fromReading < 0) { $("jmFromReading").focus(); return alert("Enter the reading it was last done at as a number, or leave it blank."); }
    let docId = $("jmSource").value;
    const now = Date.now();
    if (docId === NEW_DOC) {
      const title = cleanLine($("jmDocTitle").value, MAX_SOURCE);
      if (!title) { $("jmDocTitle").focus(); return alert("Name the new source, like Owner's manual."); }
      docId = newId();
      t.docs.push({ id: docId, title, link: cleanLine($("jmDocLink").value, MAX_LINK) });
      t.u = now;
    }
    const fields = {
      name, every: mode === "every" ? { n, unit: $("jmEveryUnit").value } : null,
      seasons: mode === "season" ? [...e.seasons].sort() : [],
      meterEvery: meterEvery || null,
      est: est || null,
      source: { docId, where: cleanLine($("jmWhere").value, MAX_WHERE) },
      notes: cleanText($("jmNotes").value, MAX_NOTES)
    };
    // Before any record, it counts from the day and reading given (else from today; a reading left out
    // is estimated for that day, never stored as if it were read).
    if (!j || !A.lastDone(j)) fields.from = { date: fromDate || (j && j.from.date) || todayStr(), reading: fromReading };
    if (j) Object.assign(j, fields, { u: now });
    else S.jobs.push({ id: newId(), thingId: t.id, ...fields, deleted: false, at: now, u: now });
    A.save();
    K.modal.close(overlay());
    S.editing = null;
    A.renderAll();
  }

  function remove() {
    const j = S.editing && A.jobById(S.editing.id);
    if (!j || !confirm(`Delete the job "${j.name}"? Its past records stay in History.`)) return;
    Object.assign(j, { name: "", notes: "", deleted: true, u: Date.now() });
    A.save();
    K.modal.close(overlay());
    S.editing = null;
    if (S.view === "job" && S.jobId === j.id) A.showView("thing", j.thingId); else A.renderAll();
  }

  function wireJobEditor() {
    define();
    $("jmMode").addEventListener("change", renderSchedule);
    $("jmSource").addEventListener("change", () => { renderSchedule(); if ($("jmSource").value === NEW_DOC) $("jmDocTitle").focus(); });
    $("jmSeasons").addEventListener("click", ev => {
      const b = ev.target.closest("[data-season]");
      if (!b || !S.editing) return;
      const s = +b.dataset.season;
      if (S.editing.seasons.has(s)) S.editing.seasons.delete(s); else S.editing.seasons.add(s);
      renderSchedule();
    });
    $("jmSaveBtn").addEventListener("click", save);
    $("jmCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
    $("jmDeleteBtn").addEventListener("click", remove);
  }
  // Enter in one of its one-line fields saves it (the notes take Enter as a new line).
  const jobKey = e => {
    if (e.key !== "Enter" || !S.editing || S.editing.kind !== "job" || e.target.tagName !== "INPUT" || !overlay().contains(e.target)) return false;
    e.preventDefault();
    save();
    return true;
  };

  Object.assign(A, { wireJobEditor, openJobEditor, jobKey });
})(Kyoshi, Kyoshi.apps.appa);
