/* Pabu · editor.js — the person pop-up (#personOverlay), opened by tapping a name: the name, how often and how, how many
 * minutes (a new how brings its usual length, unless they were changed), the birthday (month, day and an optional
 * year), a note, and the days you talked (each with ✕, and Add a day: Enter in its field adds, not saves); Save (or
 * Enter), Cancel and Delete. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isDate, pad2, readNumber, daysInMonth, todayStr } = K.util;
  const { MAX_NAME, MAX_NOTE, MIN_MINUTES, MAX_MINUTES, MAX_TALKS, HOW, MONTH_NAMES } = A;

  const overlay = () => $("personOverlay");
  const BDAY = ["personBdayMonth", "personBdayDay", "personBdayYear"];
  const FIELDS = ["personName", "personEvery", "personHow", "personMinutes", ...BDAY, "personNote", "personTalkDate"];
  // What the pop-up holds (its fields and the days you talked), to tell whether closing it would lose something.
  const formState = () => JSON.stringify([FIELDS.map(id => $(id).value), S.editing ? S.editing.talks : []]);

  // Esc, × and a click beside the pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
  function defineEditor() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard your changes to this person?"
    });
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  // The line under the days you talked: what went wrong adding one, or nothing.
  function hint(text = "") {
    $("personHint").textContent = text;
    $("personHint").hidden = !text;
  }

  // The days you talked, newest first, each with ✕; a day after today can't be picked.
  function renderTalks() {
    const today = todayStr(), talks = S.editing.talks;
    $("personTalks").innerHTML = talks.length ? talks.map(d => `<li><span>${esc(A.fmtDay(d, today))}</span>` +
      `<button type="button" class="talk-x" data-act="talk-remove" data-day="${esc(d)}" title="Remove" aria-label="Remove ${esc(A.fmtDay(d, today))}">✕</button></li>`).join("")
      : `<li class="talks-none">None yet.</li>`;
    $("personTalkDate").max = today;
  }

  function openEditor(id) {
    const p = A.personById(id);
    if (!p) return;
    const b = A.parseBirthday(p.birthday);
    S.editing = { id: p.id, talks: p.talks.slice(), how: A.howOf(p) };
    $("personName").value = p.name;
    $("personEvery").value = A.everyOf(p);
    $("personHow").value = A.howOf(p);
    $("personMinutes").value = p.minutes;
    $("personBdayMonth").value = b ? String(b.month) : "";
    $("personBdayDay").value = b ? b.day : "";
    $("personBdayYear").value = b && b.year ? b.year : "";
    $("personNote").value = p.note;
    $("personTalkDate").value = "";
    hint();
    renderTalks();
    // As opened, so Save writes only what was changed here.
    Object.assign(S.editing, { start: Object.fromEntries(FIELDS.map(f => [f, $(f).value])), startTalks: p.talks.slice(), snapshot: formState() });
    K.modal.open(overlay());
  }

  // A different how: the minutes follow its usual length, unless they'd been changed from the last one's.
  function changeHow() {
    const e = S.editing, how = $("personHow").value;
    if (!e || !HOW[how]) return;
    if (A.readMinutes($("personMinutes")) === HOW[e.how].minutes) $("personMinutes").value = HOW[how].minutes;
    e.how = how;
  }

  // Add a day: a real one, not after today, not there yet (on Save, a day already there is simply let be). False, with
  // the reason under the list, when it can't be added.
  function addTalk(saving = false) {
    const e = S.editing, el = $("personTalkDate"), day = el.value, today = todayStr();
    if (!e) return false;
    const why = el.validity.badInput ? "Finish the day, or clear it." : !isDate(day) ? "Pick the day first."
      : day > today ? "That day hasn't come yet: pick today or a day before."
      : e.talks.includes(day) && !saving ? `${A.fmtDay(day, today)} is already there.` : "";
    if (why) {
      hint(why);
      el.focus();
      return false;
    }
    if (!e.talks.includes(day)) e.talks = e.talks.concat(day).sort().reverse().slice(0, MAX_TALKS);
    el.value = "";
    hint();
    renderTalks();
    return true;
  }

  function removeTalk(day) {
    const e = S.editing;
    if (!e) return;
    e.talks = e.talks.filter(d => d !== day);
    hint();
    renderTalks();
  }

  // The birthday from its three fields: "" for none, "MM-DD", or "YYYY-MM-DD" with the year; null (after saying why)
  // when it can't be: the month and day go together, the day must be in that month (Feb 29 only in a leap year when the
  // year is given), and the year is from 1900 to this one.
  function readBirthday() {
    const monthEl = $("personBdayMonth"), dayEl = $("personBdayDay"), yearEl = $("personBdayYear");
    const month = +monthEl.value || 0, day = readNumber(dayEl), year = readNumber(yearEl), thisYear = +todayStr().slice(0, 4);
    const fail = (el, text) => { el.focus(); alert(text); return null; };
    if (!month && day === null) return year === null ? "" : fail(monthEl, "Pick the month and day of the birthday too, or clear the year.");
    if (!month) return fail(monthEl, "Pick the month of the birthday too.");
    if (day === null) return fail(dayEl, "Type the day of the birthday too.");
    if (year !== null && !(Number.isInteger(year) && year >= 1900 && year <= thisYear)) return fail(yearEl, `The year born should be from 1900 to ${thisYear}, or left empty.`);
    const max = daysInMonth(year || 2000, month); // 2000: a leap year, so Feb 29 is fine without a year
    if (!Number.isInteger(day) || day < 1 || day > max) return fail(dayEl, `${MONTH_NAMES[month - 1]}${year ? ` ${year}` : ""} has ${max} days: pick a day from 1 to ${max}.`);
    return `${year ? `${year}-` : ""}${pad2(month)}-${pad2(day)}`;
  }

  function saveEditor() {
    const e = S.editing;
    if (!e) return;
    const p = A.personById(e.id);
    if (!p) {
      closeEditor();
      A.renderAll();
      return alert("That person was deleted on another device, so nothing was saved.");
    }
    const day = $("personTalkDate");
    if ((day.value || day.validity.badInput) && !addTalk(true)) return; // a day picked but not added yet goes in too
    const name = A.cleanLine($("personName").value, MAX_NAME), minutes = A.readMinutes($("personMinutes"));
    if (!name) { $("personName").focus(); return alert("Type their name."); }
    if (!minutes) { $("personMinutes").focus(); return alert(`How long does it take? From ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`); }
    const touched = ids => ids.some(f => $(f).value !== e.start[f]);
    const birthday = touched(BDAY) ? readBirthday() : p.birthday; // one kept as it came (a backup's) stands unless changed
    if (birthday === null) return;
    // Only what was changed here, over the person as kept now (another tab or device may have changed the rest
    // meanwhile): the fields as typed (how often and how stay as kept unless changed, a newer version's own too), and
    // the days you talked as added and taken off.
    const next = {};
    if (touched(["personName"])) next.name = name;
    if (touched(["personEvery"])) next.every = $("personEvery").value;
    if (touched(["personHow"])) next.how = $("personHow").value;
    if (touched(["personMinutes"])) next.minutes = minutes;
    if (touched(BDAY)) next.birthday = birthday;
    if (touched(["personNote"])) next.note = A.cleanText($("personNote").value, MAX_NOTE);
    const added = e.talks.filter(d => !e.startTalks.includes(d)), removed = e.startTalks.filter(d => !e.talks.includes(d));
    if (added.length || removed.length) {
      next.talks = p.talks.filter(d => !removed.includes(d)).concat(added.filter(d => !p.talks.includes(d))).sort().reverse().slice(0, MAX_TALKS);
    }
    if (Object.keys(next).some(k => JSON.stringify(next[k]) !== JSON.stringify(p[k]))) {
      Object.assign(p, next, { u: Date.now() });
      A.save();
    }
    closeEditor();
    A.renderAll();
  }

  // A deleted person stays as a marker, so another device's older copy can't bring them back.
  function deletePerson() {
    const e = S.editing;
    if (!e) return;
    const p = A.personById(e.id);
    if (!p) {
      closeEditor();
      A.renderAll();
      return alert("That person was already deleted on another device.");
    }
    if (!confirm(`Delete ${p.name}, and the days you talked? This can't be undone.`)) return;
    Object.assign(p, { name: "", talks: [], note: "", birthday: "", deleted: true, u: Date.now() });
    closeEditor();
    A.save();
    A.renderAll();
  }

  function wireEditor() {
    defineEditor();
    // Enter in a field saves, as Save does; but Enter in the day field adds that day.
    $("personForm").addEventListener("submit", e => { e.preventDefault(); saveEditor(); });
    $("personTalkDate").addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addTalk();
    });
    $("personTalkDate").addEventListener("input", () => hint());
    $("personTalkAdd").addEventListener("click", () => addTalk());
    $("personTalks").addEventListener("click", e => { const b = e.target.closest('[data-act="talk-remove"]'); if (b) removeTalk(b.dataset.day); });
    $("personHow").addEventListener("change", changeHow);
    // "—" for the month takes the birthday off: its day and year go with it.
    $("personBdayMonth").addEventListener("change", () => { if (!$("personBdayMonth").value) BDAY.forEach(f => { $(f).value = ""; }); });
    $("personCancelBtn").addEventListener("click", closeEditor);
    $("personDeleteBtn").addEventListener("click", deletePerson);
  }

  Object.assign(A, { wireEditor, openEditor });
})(Kyoshi, Kyoshi.apps.pabu);
