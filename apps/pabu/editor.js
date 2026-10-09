/* Pabu · editor.js — the person pop-up (#personOverlay), opened by tapping a name: the name, the group (typed, or one
 * already used: the same in any case takes that one's spelling), the birthday (month, day and an optional year), notes,
 * and their calls, texts and visits (#personCadences), each a box: how, how often and ✕ (taking it off); minutes (a new
 * how brings its usual length, unless they were changed), when you last talked and when it's due; the days you talked,
 * each with ✕; "Talked on" with Add (Enter there adds, not saves). "+ Add a call, text or visit" (up to 6). Save (or
 * Enter) writes the whole person at once and never stops without saying why, in #personHint above it (a name, birthday
 * or minutes it can't take; that field is marked). Cancel; Delete. Its reader of a day's three fields (readDayFields)
 * reads Set up's anniversary too. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isDate, pad2, newId, now, readNumber, daysInMonth, todayStr } = K.util;
  const { MAX_NAME, MAX_GROUP, MAX_NOTE, MAX_CADENCES, MIN_MINUTES, MAX_MINUTES, MAX_TALKS, HOW, OFTEN, DEFAULT_EVERY, DEFAULT_HOW, MONTH_NAMES } = A;

  const overlay = () => $("personOverlay");
  const BDAY = ["personBdayMonth", "personBdayDay", "personBdayYear"];
  const FIELDS = ["personName", "personGroup", ...BDAY, "personNote"];
  const bdayFields = () => BDAY.map(f => $(f).value).join("|");
  // The pickers' choices: how, and how often (every week to every year; birthday only is having none).
  const HOWS = Object.entries(HOW).map(([key, h]) => [key, h.label]);
  const EVERYS = A.EVERY.filter(([key]) => Object.hasOwn(OFTEN, key)).map(([key, words]) => [key, A.cap(words)]);
  const options = (list, value) => list.map(([key, label]) => `<option value="${key}"${key === value ? " selected" : ""}>${esc(label)}</option>`).join("");

  // A call, text or visit in the pop-up: something in its box, and its working copy from anything in there.
  const field = (c, sel) => $("personCadences").querySelector(`.cadence[data-cid="${CSS.escape(c.id)}"] ${sel}`);
  const cadenceIn = el => {
    const box = el.closest(".cadence");
    return (box && S.editing && S.editing.cadences.find(c => c.id === box.dataset.cid)) || null;
  };
  // What the pop-up holds (its fields, and each call, text or visit as shown: minutes and "Talked on" as typed), to tell
  // whether closing it would lose something.
  const formState = () => JSON.stringify([FIELDS.map(id => $(id).value), S.editing ? S.editing.cadences.map(c =>
    [c.id, c.every, c.how, c.talks, field(c, ".c-minutes").value, field(c, ".c-day").value]) : []]);

  // Esc, × and a click beside the pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
  function defineEditor() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard your changes to this person?"
    });
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  // The line above Save: what stopped it (red), or what was left out once saved; nothing when all is well.
  function hint(text = "", saved = false) {
    $("personHint").textContent = text;
    $("personHint").hidden = !text;
    $("personHint").classList.toggle("saved", saved);
  }
  // Save can't take a field: it's marked and takes the focus, and the line above Save says why. Null.
  function stop(el, text) {
    el.setAttribute("aria-invalid", "true");
    el.focus();
    hint(text);
    return null;
  }
  const unmark = () => $("personForm").querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
  // The line under a call, text or visit's "Talked on": what went wrong adding a day, or nothing.
  function talkHint(c, text = "") {
    field(c, ".talk-hint").textContent = text;
    field(c, ".talk-hint").hidden = !text;
  }

  // A call, text or visit's box: how, how often and ✕; minutes, then when you last talked and when it's due; the days
  // you talked; "Talked on" with Add.
  function cadenceHTML(c) {
    return `<div class="cadence" data-cid="${esc(c.id)}">` +
      `<div class="cadence-head"><select class="c-how" aria-label="How">${options(HOWS, A.howOf(c))}</select>` +
      `<select class="c-every" aria-label="How often">${options(EVERYS, A.everyOf(c))}</select>` +
      `<button type="button" class="cadence-x" data-act="cadence-remove" title="Take this one off" aria-label="Take this one off">✕</button></div>` +
      `<div class="cadence-sub"><input type="number" class="c-minutes" min="${MIN_MINUTES}" max="${MAX_MINUTES}" step="5" inputmode="numeric" value="${c.minutes}" aria-label="Minutes">` +
      `<span class="c-unit">min</span><span class="cadence-last"></span></div>` +
      `<ul class="talks"></ul>` +
      `<div class="talk-add"><span class="talk-label">Talked on</span><input type="date" class="c-day" aria-label="Talked on">` +
      `<button type="button" class="secondary" data-act="talk-add">Add</button></div><p class="talk-hint" role="status" hidden></p></div>`;
  }

  // Its days you talked, newest first, each with ✕ (no list without any), and the line "Last talked 5 weeks ago · due in
  // 3 days". A day after today can't be picked.
  function renderDays(c) {
    const today = todayStr(), list = field(c, ".talks");
    field(c, ".cadence-last").textContent = `${A.cap(A.talkedWords(A.lastTalk(c, today), today))} · ${A.dueWords(A.dueOf({ at: S.editing.at }, c, today), today)}`;
    list.hidden = !c.talks.length;
    list.innerHTML = c.talks.map(d => `<li><span>${esc(A.fmtDay(d, today))}</span>` +
      `<button type="button" class="talk-x" data-act="talk-remove" data-day="${esc(d)}" title="Remove" aria-label="Remove ${esc(A.fmtDay(d, today))}">✕</button></li>`).join("");
    field(c, ".c-day").max = today;
  }

  // "Birthday only" without any; "+ Add a call, text or visit" while there's room.
  function renderCount() {
    $("personNoCadence").hidden = S.editing.cadences.length > 0;
    $("personCadenceAdd").hidden = S.editing.cadences.length >= MAX_CADENCES;
  }

  function openEditor(id) {
    const p = A.personById(id);
    if (!p) return;
    const b = A.parseBirthday(p.birthday);
    // Working copies of their calls, texts and visits, each with the how last picked here (its minutes follow a new
    // how's usual length while they're still the last one's).
    S.editing = { id: p.id, at: p.at, birthday: p.birthday, cadences: p.cadences.map(c => ({ ...c, talks: c.talks.slice(), picked: A.howOf(c) })) };
    $("personName").value = p.name;
    $("personGroup").value = p.group;
    $("personGroupList").innerHTML = A.groupsInUse(p.id).map(g => `<option value="${esc(g)}"></option>`).join("");
    $("personBdayMonth").value = b ? String(b.month) : "";
    $("personBdayDay").value = b ? b.day : "";
    $("personBdayYear").value = b && b.year ? b.year : "";
    $("personNote").value = p.note;
    $("personCadences").innerHTML = S.editing.cadences.map(cadenceHTML).join("");
    S.editing.cadences.forEach(c => renderDays(c));
    renderCount();
    unmark();
    hint();
    // As opened: the birthday's fields (one kept as it came, a backup's, stands unless they're changed), and all of it.
    Object.assign(S.editing, { bday: bdayFields(), snapshot: formState() });
    K.modal.open(overlay());
  }

  // A different how: its minutes follow its usual length, unless they'd been changed from the last one's.
  function changeHow(c) {
    const how = field(c, ".c-how").value, minutes = field(c, ".c-minutes");
    if (!HOW[how]) return;
    if (A.readMinutes(minutes) === HOW[c.picked].minutes) minutes.value = HOW[how].minutes;
    c.how = c.picked = how;
  }
  function changeEvery(c) {
    c.every = field(c, ".c-every").value;
    renderDays(c);
  }

  // "+ Add a call, text or visit": a call every month, its usual length, due the day it's added until you talk.
  function addCadence() {
    const e = S.editing;
    if (!e || e.cadences.length >= MAX_CADENCES) return;
    let id = newId();
    while (e.cadences.some(c => c.id === id)) id = newId();
    const c = { id, every: DEFAULT_EVERY, how: DEFAULT_HOW, minutes: HOW[DEFAULT_HOW].minutes, talks: [], at: now(), picked: DEFAULT_HOW };
    e.cadences.push(c);
    $("personCadences").insertAdjacentHTML("beforeend", cadenceHTML(c));
    renderDays(c);
    renderCount();
    field(c, ".c-how").focus();
  }

  // ✕ on a box: that call, text or visit goes, with its days (Cancel brings it back).
  function removeCadence(c) {
    field(c, ".c-how").closest(".cadence").remove();
    S.editing.cadences = S.editing.cadences.filter(x => x !== c);
    renderCount();
    $("personCadenceAdd").focus();
  }

  // Add a day: a real one, not after today, not there yet. False, with the reason under it, when it can't be added.
  function addTalk(c) {
    const el = field(c, ".c-day"), day = el.value, today = todayStr();
    const why = el.validity.badInput ? "Finish the day, or clear it." : !isDate(day) ? "Pick the day first."
      : day > today ? "That day hasn't come yet: pick today or a day before."
      : c.talks.includes(day) ? `${A.fmtDay(day, today)} is already there.` : "";
    talkHint(c, why);
    if (why) {
      el.focus();
      return false;
    }
    c.talks = [day].concat(c.talks).sort().reverse().slice(0, MAX_TALKS);
    el.value = "";
    renderDays(c);
    return true;
  }

  function removeTalk(c, day) {
    c.talks = c.talks.filter(d => d !== day);
    talkHint(c);
    renderDays(c);
  }

  // A day from its three fields, the birthday's here and the anniversary's in Set up (setup.js): "" for none, "MM-DD",
  // or "YYYY-MM-DD" with the year; null (after saying why: say(field, text) marks that field) when it can't be: the month
  // and day go together, the day must be in that month (Feb 29 only in a leap year when the year is given), and the year
  // is from 1900 to this one. word: "birthday" or "anniversary", in what it says.
  function readDayFields(monthEl, dayEl, yearEl, word, say = stop) {
    const month = +monthEl.value || 0, day = readNumber(dayEl), year = readNumber(yearEl), thisYear = +todayStr().slice(0, 4);
    if (!month && day === null) return year === null ? "" : say(monthEl, `Pick the month and day of the ${word} too, or clear the year.`);
    if (!month) return say(monthEl, `Pick the month of the ${word} too.`);
    if (day === null) return say(dayEl, `Type the day of the ${word} too.`);
    if (year !== null && !(Number.isInteger(year) && year >= 1900 && year <= thisYear)) return say(yearEl, `The ${word === "birthday" ? "year born" : "year"} should be from 1900 to ${thisYear}, or left empty.`);
    const max = daysInMonth(year || 2000, month); // 2000: a leap year, so Feb 29 is fine without a year
    if (!Number.isInteger(day) || day < 1 || day > max) return say(dayEl, `${MONTH_NAMES[month - 1]}${year ? ` ${year}` : ""} has ${max} days: pick a day from 1 to ${max}.`);
    return `${year ? `${year}-` : ""}${pad2(month)}-${pad2(day)}`;
  }

  // Save: the whole person as the pop-up has them, at once, over the person as kept now. What it can't take stops it,
  // saying so above it: no name, a birthday that can't be, minutes outside 5–480. A "Talked on" day picked but not
  // added goes in too; one unfinished, or not come yet, is left out: everything else is saved, and the pop-up stays
  // open to say so, with that day marked. Nothing changed since it opened: it just closes, writing nothing (so a change
  // made to them meanwhile on another device stands).
  function saveEditor() {
    const e = S.editing;
    if (!e) return;
    const p = A.personById(e.id);
    if (!p) {
      closeEditor();
      A.renderAll();
      return alert("That person was deleted on another device, so nothing was saved.");
    }
    if (formState() === e.snapshot && !e.cadences.some(c => field(c, ".c-day").validity.badInput)) return closeEditor();
    unmark();
    hint();
    const name = A.cleanLine($("personName").value, MAX_NAME);
    if (!name) return stop($("personName"), "Type their name.");
    const birthday = bdayFields() === e.bday ? e.birthday : readDayFields(...BDAY.map(f => $(f)), "birthday");
    if (birthday === null) return;
    const minutes = [];
    for (const c of e.cadences) {
      const m = A.readMinutes(field(c, ".c-minutes"));
      if (!m) return stop(field(c, ".c-minutes"), `How long does the ${A.howLabel(c).toLowerCase()} take? From ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`);
      minutes.push(m);
    }
    const today = todayStr(), unfinished = [], ahead = [];
    e.cadences.forEach(c => {
      const el = field(c, ".c-day"), day = el.value;
      if (el.validity.badInput || (day && !isDate(day))) unfinished.push(c);
      else if (day > today) ahead.push(c);
      else if (day) {
        if (!c.talks.includes(day)) c.talks = [day].concat(c.talks).sort().reverse().slice(0, MAX_TALKS);
        el.value = "";
        talkHint(c);
        renderDays(c);
      }
    });
    const typed = A.cleanLine($("personGroup").value, MAX_GROUP);
    const next = {
      name,
      group: A.groupsInUse(p.id).find(g => g.toLowerCase() === typed.toLowerCase()) || typed,
      note: A.cleanText($("personNote").value, MAX_NOTE),
      birthday,
      cadences: e.cadences.map((c, i) => ({ id: c.id, every: c.every, how: c.how, minutes: minutes[i], talks: c.talks.slice(), at: c.at }))
    };
    if (Object.keys(next).some(k => JSON.stringify(next[k]) !== JSON.stringify(p[k]))) {
      Object.assign(p, next, { u: Date.now() });
      A.save();
    }
    A.renderAll();
    if (!unfinished.length && !ahead.length) return closeEditor();
    // Saved, but for a "Talked on" day: it stays marked, and the pop-up says so (closing it now asks nothing).
    const hows = list => [...new Set(list.map(A.howLabel))].join(", ");
    unfinished.concat(ahead).forEach(c => field(c, ".c-day").setAttribute("aria-invalid", "true"));
    hint(unfinished.length ? `Saved, without the unfinished “Talked on” day (${hows(unfinished)}).`
      : `Saved, without the “Talked on” day that hasn't come yet (${hows(ahead)}).`, true);
    Object.assign(e, { birthday, bday: bdayFields(), snapshot: formState() });
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
    Object.assign(p, { name: "", group: "", note: "", birthday: "", partner: false, anniversary: "", cadences: [], deleted: true, u: Date.now() });
    closeEditor();
    A.save();
    A.renderAll();
  }

  function wireEditor() {
    defineEditor();
    // Enter in a field saves, as Save does; but Enter in a "Talked on" day adds that day.
    $("personForm").addEventListener("submit", e => { e.preventDefault(); saveEditor(); });
    const box = $("personCadences");
    box.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]"), c = btn && cadenceIn(btn);
      if (!c) return;
      if (btn.dataset.act === "talk-add") addTalk(c);
      else if (btn.dataset.act === "talk-remove") removeTalk(c, btn.dataset.day);
      else if (btn.dataset.act === "cadence-remove") removeCadence(c);
    });
    box.addEventListener("change", e => {
      const c = cadenceIn(e.target);
      if (c && e.target.matches(".c-how")) changeHow(c);
      else if (c && e.target.matches(".c-every")) changeEvery(c);
    });
    box.addEventListener("keydown", e => {
      const c = e.key === "Enter" && e.target.matches(".c-day") && cadenceIn(e.target);
      if (!c) return;
      e.preventDefault();
      addTalk(c);
    });
    // Typing again where something was said: a "Talked on" day's line goes, and a field Save marked is let be.
    $("personForm").addEventListener("input", e => {
      const c = e.target.matches(".c-day") && cadenceIn(e.target);
      if (c) talkHint(c);
      if (e.target.hasAttribute("aria-invalid")) {
        e.target.removeAttribute("aria-invalid");
        hint();
      }
    });
    $("personCadenceAdd").addEventListener("click", addCadence);
    // "—" for the month takes the birthday off: its day and year go with it.
    $("personBdayMonth").addEventListener("change", () => { if (!$("personBdayMonth").value) BDAY.forEach(f => { $(f).value = ""; }); });
    $("personCancelBtn").addEventListener("click", closeEditor);
    $("personDeleteBtn").addEventListener("click", deletePerson);
  }

  Object.assign(A, { wireEditor, openEditor, readDayFields });
})(Kyoshi, Kyoshi.apps.pabu);
