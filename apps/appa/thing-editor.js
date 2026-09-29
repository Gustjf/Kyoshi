/* Appa · thing-editor.js — the thing pop-up (#thingOverlay): add or edit a thing. Its short name (for
 * lists and Momo), what it is, VIN or serial, what its meter counts (fixed once it has readings or meter
 * jobs), its reading now and usual pace (new things), and its sources: manuals and the like, each a
 * title with a link or where the paper copy is kept. Archive (sold or retired: out of Coming up and
 * Momo, records kept) and Delete (with its jobs, records, readings, photos and PDFs). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, todayStr, readNumber, fmtNum } = K.util;
  const { METERS, MAX_THING, MAX_ABOUT, MAX_SERIAL, MAX_SOURCE, MAX_LINK, cleanLine } = A;
  const overlay = () => $("thingOverlay");
  const CHOICES = [["", "Time only"], ...Object.entries(METERS).map(([id, m]) => [id, m.label])];
  const formState = () => JSON.stringify([["tmName", "tmAbout", "tmSerial", "tmReading", "tmPace"].map(id => $(id).value), S.editing.meter, S.editing.docs]);

  function define() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard what you've entered?"
    });
  }
  const close = () => K.modal.dismiss(overlay());

  // A thing's meter can't change once readings or meter jobs count in it.
  const meterLocked = t => !!t && (A.points(t.id).length > 0 || A.jobsOf(t.id).some(j => j.meterEvery));

  function openThing(id) {
    const t = id ? A.thingById(id) : null;
    if (id && !t) return;
    S.editing = { kind: "thing", id: t ? t.id : null, meter: t ? t.meter : "", docs: t ? t.docs.map(d => ({ ...d })) : [], locked: meterLocked(t) };
    $("tmTitle").textContent = t ? `Edit ${t.name}` : "Add a thing";
    $("tmName").value = t ? t.name : "";
    $("tmAbout").value = t ? t.about : "";
    $("tmSerial").value = t ? t.serial : "";
    $("tmReading").value = "";
    $("tmPace").value = t && t.pace ? fmtNum(t.pace, 1) : "";
    $("tmSaveBtn").textContent = t ? "Save" : "Add";
    $("tmArchiveBtn").hidden = !t;
    $("tmArchiveBtn").textContent = t && t.archived ? "Restore" : "Archive";
    $("tmDeleteBtn").hidden = !t;
    renderMeter();
    renderDocs();
    S.editing.snapshot = formState();
    K.modal.open(overlay());
    if (!t) $("tmName").focus();
  }

  function renderMeter() {
    const e = S.editing, m = METERS[e.meter], isNew = !e.id;
    $("tmMeter").innerHTML = CHOICES.map(([id, label]) => `<button type="button" class="pill${id === e.meter ? " active" : ""}" data-meter="${id}"${e.locked && id !== e.meter ? " disabled" : ""}>${esc(label)}</button>`).join("");
    $("tmMeterNote").textContent = e.locked ? "Fixed now that it has readings or meter jobs." : e.meter ? "" : "For things whose schedule is only about time, like a filter every 3 months.";
    $("tmMeterFields").hidden = !m;
    if (!m) return;
    $("tmReading").closest(".field").hidden = !isNew; // a thing that exists logs readings from its page
    $("tmReadingLabel").textContent = `${m.reading} now (${m.unit}, optional)`;
    $("tmPaceLabel").textContent = `About how many ${m.unit === "h" ? "hours" : m.unit === "km" ? "km" : "miles"} a year?`;
    $("tmPace").placeholder = m.unit === "h" ? "e.g. 50" : m.unit === "km" ? "e.g. 20000" : "e.g. 12000";
  }

  function renderDocs() {
    $("tmDocs").innerHTML = S.editing.docs.map((d, i) => `<div class="doc-row" data-index="${i}">` +
      `<input type="text" class="doc-title" maxlength="${MAX_SOURCE}" value="${esc(d.title)}" placeholder="e.g. Owner's manual" aria-label="Source">` +
      `<input type="text" class="doc-link" maxlength="${MAX_LINK}" value="${esc(d.link)}" placeholder="Link, or where it's kept" aria-label="Link or where it's kept">` +
      `<button type="button" class="icon-btn doc-remove" aria-label="Remove this source">&times;</button></div>`).join("");
  }

  function onDocs(e) {
    const row = e.target.closest(".doc-row");
    if (!row || !S.editing) return;
    const d = S.editing.docs[+row.dataset.index];
    if (e.type === "input") {
      if (e.target.classList.contains("doc-title")) d.title = e.target.value;
      if (e.target.classList.contains("doc-link")) d.link = e.target.value;
    } else if (e.target.closest(".doc-remove")) {
      const using = S.editing.id ? A.jobsOf(S.editing.id).filter(j => j.source.docId === d.id).length : 0;
      if (using && !confirm(`${using} job${using === 1 ? " names" : "s name"} this source. Remove it anyway?`)) return;
      S.editing.docs.splice(+row.dataset.index, 1);
      renderDocs();
    }
  }

  function save() {
    const e = S.editing;
    if (!e) return;
    const name = cleanLine($("tmName").value, MAX_THING);
    if (!name) { $("tmName").focus(); return alert("Give it a short name, like Civic."); }
    if (A.live(S.things).some(t => t.id !== e.id && t.name.toLowerCase() === name.toLowerCase())) { $("tmName").focus(); return alert(`You already have a thing called ${name}.`); }
    const t = e.id ? A.thingById(e.id) : null;
    if (e.id && !t) { K.modal.close(overlay()); S.editing = null; A.renderAll(); return alert("That thing was deleted on another device, so nothing was saved."); }
    const pace = e.meter ? readNumber($("tmPace")) : null, reading = e.meter && !t ? readNumber($("tmReading")) : null;
    if (Number.isNaN(pace) || pace < 0) { $("tmPace").focus(); return alert("Enter about how much a year as a number."); }
    if (Number.isNaN(reading) || reading < 0) { $("tmReading").focus(); return alert("Enter the reading as a number."); }
    const docs = e.docs.map(d => ({ id: d.id, title: cleanLine(d.title, MAX_SOURCE), link: cleanLine(d.link, MAX_LINK) })).filter(d => d.title);
    const now = Date.now(), fields = { name, about: cleanLine($("tmAbout").value, MAX_ABOUT), serial: cleanLine($("tmSerial").value, MAX_SERIAL), meter: e.meter, pace: pace || 0, docs };
    let id = e.id;
    if (t) Object.assign(t, fields, { u: now });
    else {
      id = newId();
      S.things.push({ id, ...fields, archived: false, deleted: false, at: now, u: now });
      if (reading !== null) S.readings.push({ id: newId(), thingId: id, date: todayStr(), value: reading, deleted: false, at: now, u: now });
    }
    A.save();
    K.modal.close(overlay());
    S.editing = null;
    if (!t) A.showView("thing", id); else A.renderAll();
  }

  function archive() {
    const t = S.editing && A.thingById(S.editing.id);
    if (!t) return;
    if (!t.archived && !confirm(`Archive ${t.name}? It leaves Coming up and Momo; its records stay, and reports can still include it.`)) return;
    Object.assign(t, { archived: !t.archived, u: Date.now() });
    A.save();
    K.modal.close(overlay());
    S.editing = null;
    A.renderAll();
  }

  // Deletes a thing and everything of it; each stays as a marker, so another device's older copy can't bring it back.
  function remove() {
    const t = S.editing && A.thingById(S.editing.id);
    if (!t) return;
    const jobs = A.jobsOf(t.id), records = A.recordsOf(t.id);
    if (!confirm(`Delete ${t.name} with its ${jobs.length} job${jobs.length === 1 ? "" : "s"} and ${records.length} record${records.length === 1 ? "" : "s"}, photos and PDFs? This can't be undone. (To keep its records, archive it instead.)`)) return;
    const now = Date.now(), gone = item => Object.assign(item, { deleted: true, u: now });
    records.forEach(r => r.files.forEach(id => {
      const f = A.fileById(id);
      if (f) gone(Object.assign(f, { name: "" }));
      A.files.remove(id).catch(() => {});
    }));
    [...jobs, ...records, ...A.live(S.readings).filter(r => r.thingId === t.id)].forEach(gone);
    Object.assign(t, { name: "", about: "", serial: "", docs: [] });
    gone(t);
    A.save();
    K.modal.close(overlay());
    S.editing = null;
    A.showView("home");
  }

  function wireThingEditor() {
    define();
    $("tmMeter").addEventListener("click", e => {
      const b = e.target.closest("[data-meter]");
      if (!b || !S.editing || S.editing.locked) return;
      S.editing.meter = b.dataset.meter;
      renderMeter();
    });
    $("tmDocs").addEventListener("input", onDocs);
    $("tmDocs").addEventListener("click", onDocs);
    $("tmAddDoc").addEventListener("click", () => {
      if (!S.editing) return;
      S.editing.docs.push({ id: newId(), title: "", link: "" });
      renderDocs();
      $("tmDocs").querySelector(".doc-row:last-child .doc-title").focus();
    });
    $("tmSaveBtn").addEventListener("click", save);
    $("tmCancelBtn").addEventListener("click", close);
    $("tmArchiveBtn").addEventListener("click", archive);
    $("tmDeleteBtn").addEventListener("click", remove);
  }
  // Enter in one of its one-line fields saves it.
  const thingKey = e => {
    if (e.key !== "Enter" || !S.editing || S.editing.kind !== "thing" || e.target.tagName !== "INPUT" || !overlay().contains(e.target)) return false;
    e.preventDefault();
    save();
    return true;
  };

  Object.assign(A, { wireThingEditor, openThingEditor: openThing, thingKey });
})(Kyoshi, Kyoshi.apps.appa);
