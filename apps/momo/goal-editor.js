/* Momo · goal-editor.js — the goal editor pop-up (#goalOverlay): a total of hours (maybe by a
 * finish-by date, typed as month/day/year or picked from the season buttons, within a most
 * hours a week) or hours a week; its colour; saving and deleting. Season dates come from
 * core/seasons.js. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, addDays, todayStr, fmtDate, fmtShort, fmtNum, daysInMonth, newId, pad2 } = K.util;
  const { GOAL_MAX_WEEK, YEAR_MIN, YEAR_MAX, cleanText, readNumber } = A;

  const overlay = () => $("goalOverlay");
  // What the editor holds, to tell whether closing it would lose changes.
  const goalFormState = () => JSON.stringify(["goalName", "goalTarget", "goalPerWeek", "goalDone", "goalDueMonth", "goalDueDay", "goalDueYear", "goalMax"].map(id => $(id).value).concat(S.editingGoal.pick, S.editingGoal.kind));

  // Esc, × and a click beside the editor ask first if it has unsaved changes (core/modal.js); Cancel doesn't.
  function defineGoalOverlay() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editingGoal = null; },
      pending: () => !!S.editingGoal && goalFormState() !== S.editingGoal.snapshot,
      ask: "Discard your changes to this goal?"
    });
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  // The finish-by date is typed as month, day and year, so a half-filled one can
  // still be read. What's there, tidied: null where empty, NaN where the day or
  // year isn't a number. A two-digit year means 20xx, and a year or day past
  // either end of its range becomes that end (as far as what's entered tells).
  function dueParts() {
    const m = +$("goalDueMonth").value || null;
    let d = readNumber("goalDueDay"), y = readNumber("goalDueYear");
    if (isNum(y)) {
      y = Math.round(y);
      y = Math.min(YEAR_MAX, Math.max(YEAR_MIN, y >= 0 && y < 100 ? 2000 + y : y));
    }
    if (isNum(d)) d = Math.min(m ? daysInMonth(isNum(y) ? y : 2000, m) : 31, Math.max(1, Math.round(d))); // 2000 had a Feb 29
    return { m, d, y };
  }

  // The finish-by date as "YYYY-MM-DD": "" when left empty, null when the day or
  // year isn't a number. Parts left out come from today (so November 2028 means
  // the same day of the month as today); without a year it's the next time that
  // date comes round. A day the month doesn't have becomes its nearest end.
  function readDue() {
    const { m, d, y } = dueParts(), today = todayStr();
    if (m === null && d === null && y === null) return "";
    if (Number.isNaN(d) || Number.isNaN(y)) return null;
    const month = m || +today.slice(5, 7);
    const on = year => `${year}-${pad2(month)}-${pad2(Math.min(daysInMonth(year, month), d === null ? +today.slice(8) : d))}`;
    const due = on(y === null ? +today.slice(0, 4) : y);
    return y === null && due < today ? on(+today.slice(0, 4) + 1) : due;
  }

  // Under the fields: the date they add up to, and the season that starts the
  // next day, if one does.
  function renderDueNote() {
    const due = readDue(), season = seasonBefore(due);
    const after = !due ? "" : due < todayStr() ? " — already passed"
      : season ? ` · ${K.seasons.NAMES[season.s].toLowerCase()} starts ${fmtShort(addDays(due, 1))}` : "";
    $("goalDueNote").textContent = due === null ? "The day and year need to be numbers."
      : due ? `${fmtDate(due, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}${after}` : "";
    $("goalDueNote").classList.toggle("bad", due === null);
    $("goalDueFoot").hidden = due === "";
    renderSeasons(season);
  }

  // Leaving a finish-by field tidies what was typed: 28 becomes 2028, and a day
  // the month doesn't have becomes its nearest end.
  function tidyDue() {
    const { d, y } = dueParts();
    if (isNum(d)) $("goalDueDay").value = d;
    if (isNum(y)) $("goalDueYear").value = y;
    renderDueNote();
  }

  function setDue(due) {
    const [y, m, d] = due ? due.split("-").map(Number) : [];
    $("goalDueMonth").value = m || "";
    $("goalDueDay").value = d || "";
    $("goalDueYear").value = y || "";
    renderDueNote();
  }

  // The season a finish-by date is the day before the start of: { s, year }, or null.
  function seasonBefore(due) {
    if (!due) return null;
    const start = addDays(due, 1), year = +start.slice(0, 4);
    const s = K.seasons.NAMES.findIndex((_, i) => K.seasons.seasonStart(year, i) === start);
    return s < 0 ? null : { s, year };
  }

  // What a season button picks: the day before that season next starts after
  // today, or, with that season's date already picked (cur), the year after's.
  function seasonDue(s, cur) {
    const today = todayStr();
    let year = cur && cur.s === s ? cur.year + 1 : +today.slice(0, 4);
    while (K.seasons.seasonStart(year, s) <= today) year++;
    return year > YEAR_MAX ? null : addDays(K.seasons.seasonStart(year, s), -1);
  }

  // The season buttons: the picked date's season lights up, and each says
  // when the season it would pick starts.
  function renderSeasons(cur) {
    A.root.querySelectorAll("#goalSeasons button").forEach(btn => {
      const s = +btn.dataset.season, due = seasonDue(s, cur);
      btn.classList.toggle("active", !!cur && cur.s === s);
      btn.title = due ? `${btn.textContent} starts ${fmtDate(addDays(due, 1), { weekday: "short", year: "numeric", month: "short", day: "numeric" })} — finish the day before` : "";
    });
  }

  // A season button: its date, or the year after's when it's picked already.
  function pickSeason(s) {
    if (!S.editingGoal) return;
    const due = seasonDue(s, seasonBefore(readDue()));
    if (due) setDue(due);
  }

  // The goal being edited's colour without one picked here: its own, else a new one.
  const goalOwn = () => (S.data.colors[S.editingGoal.key] ? S.data.colors[S.editingGoal.key].c : A.freeColor(S.data, A.colorKeys(S.data).shown));
  function renderGoalColors() {
    const own = goalOwn(), eg = S.editingGoal;
    A.renderColors("goal", eg.key, own, eg.pick || own, !!S.data.colors[eg.key], [eg.key], "Every card for this goal is its colour.");
  }

  function openGoalEditor(id) {
    const g = id ? A.goalById(id) : null;
    if (id && !g) return;
    const weekly = !!g && A.isWeekly(g);
    S.editingGoal = { id: g ? g.id : null, key: g ? A.goalKey(g.id) : "g:", pick: null, kind: weekly ? "weekly" : "total" };
    $("goalModalTitle").textContent = g ? "Edit goal" : "New goal";
    $("goalName").value = g ? g.name : "";
    $("goalTarget").value = g && !weekly ? fmtNum(g.target) : "";
    $("goalPerWeek").value = weekly ? fmtNum(g.perWeek) : "";
    $("goalDone").value = g ? fmtNum(A.goalDone(g)) : "";
    setDue(g ? g.due : "");
    $("goalMax").value = fmtNum(g ? g.maxWeek : GOAL_MAX_WEEK);
    $("goalDeleteBtn").hidden = !g;
    renderGoalColors();
    renderGoalKind();
    S.editingGoal.snapshot = goalFormState();
    K.modal.open(overlay());
    $("goalName").focus();
  }

  // A goal is a total (maybe by a date, within its most hours a week) or hours
  // a week; the editor shows the fields of the one picked.
  function renderGoalKind() {
    const weekly = S.editingGoal.kind === "weekly";
    A.root.querySelectorAll("#goalKind .mode-btn").forEach(b => b.classList.toggle("active", b.dataset.kind === S.editingGoal.kind));
    ["goalTargetField", "goalDueField", "goalMaxField"].forEach(id => { $(id).hidden = weekly; });
    ["goalPerWeekField", "goalWeeklyNote"].forEach(id => { $(id).hidden = !weekly; });
  }

  function saveGoal() {
    const eg = S.editingGoal;
    if (!eg) return;
    const weekly = eg.kind === "weekly";
    const name = cleanText($("goalName").value);
    const target = A.readHours("goalTarget"), perWeek = A.readHours("goalPerWeek"), done = A.readHours("goalDone"), due = readDue(), maxWeek = A.readHours("goalMax");
    if (!name) { $("goalName").focus(); return alert("Give the goal a name."); }
    if (weekly && !isNum(perWeek)) { $("goalPerWeek").focus(); return alert("Enter the hours a week this goal needs, e.g. 5."); }
    if (!weekly && !isNum(target)) { $("goalTarget").focus(); return alert("Enter the total hours this goal needs, e.g. 500."); }
    if (Number.isNaN(done)) { $("goalDone").focus(); return alert("Enter the hours done so far as a number, or leave it empty."); }
    if (!weekly && Number.isNaN(maxWeek)) { $("goalMax").focus(); return alert(`Enter the most hours a week as a number, e.g. ${GOAL_MAX_WEEK}.`); }
    if (!weekly && due === null) {
      $(Number.isNaN(readNumber("goalDueDay")) ? "goalDueDay" : "goalDueYear").focus();
      return alert("The finish-by day and year need to be numbers — or leave them empty.");
    }
    let g = eg.id ? A.goalById(eg.id) : null;
    if (eg.id && !g) {
      closeEditor();
      A.renderAll();
      return alert("That goal was changed on another device, so nothing was saved.");
    }
    if (!g) {
      g = { id: newId(), name, target: 0, perWeek: 0, start: 0, due: "", maxWeek: GOAL_MAX_WEEK, log: {}, deleted: false, u: 0 };
      S.data.goals.push(g);
    }
    // "Done so far" sets the starting amount, on top of which close-outs add up.
    // Hours a week have no total or date (the most hours a week stays as it was).
    Object.assign(g, { name, start: (done || 0) - sum(Object.values(g.log)) },
      weekly ? { target: 0, perWeek, due: "" } : { target, perWeek: 0, due, maxWeek: maxWeek || GOAL_MAX_WEEK });
    if (eg.pick) A.pickColor(A.goalKey(g.id), eg.pick); // without one, a new goal gets one on saving
    closeEditor();
    A.save();
    A.renderAll();
  }

  function deleteGoal() {
    const g = S.editingGoal && A.goalById(S.editingGoal.id);
    if (!g || !confirm(`Delete the goal “${g.name}”? Its cards stay on the board as ordinary cards.`)) return;
    g.deleted = true; // kept as a marker, so sync can't bring it back
    closeEditor();
    A.save();
    A.renderAll();
  }

  Object.assign(A, {
    defineGoalOverlay, renderDueNote, tidyDue, setDue, pickSeason, goalOwn, renderGoalColors, openGoalEditor, renderGoalKind, saveGoal, deleteGoal
  });
})(Kyoshi, Kyoshi.apps.momo);
