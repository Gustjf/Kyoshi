/* Hawky · editor.js — the errand pop-up (#errandOverlay), opened by tapping an errand's text: what it
 * is, its note, the day it's due (or none), how many minutes; Save (or Enter outside the note), Cancel and Delete. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isDate } = K.util;
  const { MAX_TEXT, MAX_NOTE, MIN_MINUTES, MAX_MINUTES, fmtDay } = A;

  const overlay = () => $("errandOverlay");
  const FIELDS = ["errandText", "errandNote", "errandDue", "errandMinutes"];
  // What the pop-up holds, to tell whether closing it would lose something.
  const formState = () => JSON.stringify(FIELDS.map(id => $(id).value));

  // Esc, × and a click beside the pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
  function defineEditor() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard your changes to this errand?"
    });
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  function openEditor(id) {
    const i = A.itemById(id);
    if (!i) return;
    S.editing = { id: i.id };
    $("errandText").value = i.text;
    $("errandNote").value = i.note;
    $("errandDue").value = i.due;
    $("errandMinutes").value = i.minutes;
    $("errandDoneNote").textContent = i.done ? `Done ${fmtDay(i.done)}. To put it back on the list, tap its ✓.` : "";
    $("errandDoneNote").hidden = !i.done;
    S.editing.snapshot = formState();
    K.modal.open(overlay());
  }

  function saveEditor() {
    const e = S.editing;
    if (!e) return;
    const i = A.itemById(e.id);
    if (!i) {
      closeEditor();
      A.renderAll();
      return alert("That errand was deleted on another device, so nothing was saved.");
    }
    const text = A.cleanLine($("errandText").value, MAX_TEXT), note = A.cleanText($("errandNote").value, MAX_NOTE);
    const due = $("errandDue").value, minutes = A.readMinutes($("errandMinutes"));
    if (!text) { $("errandText").focus(); return alert("Say what the errand is."); }
    if ($("errandDue").validity.badInput || (due && !isDate(due))) { $("errandDue").focus(); return alert("Finish the date, or clear it for no date."); }
    if (!minutes) { $("errandMinutes").focus(); return alert(`How long does it take? From ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`); }
    if (text !== i.text || note !== i.note || due !== i.due || minutes !== i.minutes) {
      Object.assign(i, { text, note, due, minutes, u: Date.now() });
      A.save();
    }
    closeEditor();
    A.renderAll();
  }

  // A deleted errand stays as a marker, so another device's older copy can't bring it back.
  function deleteErrand() {
    const e = S.editing;
    if (!e) return;
    const i = A.itemById(e.id);
    if (!i) {
      closeEditor();
      A.renderAll();
      return alert("That errand was already deleted on another device.");
    }
    if (!confirm(`Delete “${i.text}”? This can't be undone.`)) return;
    Object.assign(i, { text: "", note: "", due: "", done: "", deleted: true, u: Date.now() });
    closeEditor();
    A.save();
    A.renderAll();
  }

  function wireEditor() {
    defineEditor();
    // Enter in a field saves, as Save does (in the note it starts a new line).
    $("errandForm").addEventListener("submit", e => { e.preventDefault(); saveEditor(); });
    $("errandCancelBtn").addEventListener("click", closeEditor);
    $("errandDeleteBtn").addEventListener("click", deleteErrand);
  }

  Object.assign(A, { wireEditor, openEditor });
})(Kyoshi, Kyoshi.apps.hawky);
