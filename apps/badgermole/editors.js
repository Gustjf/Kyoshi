/* Badgermole · editors.js — the setup: the exercise pop-up (#exerciseOverlay: name, bodyweight; Save, Cancel,
 * Delete), the starter exercises, the routine pop-up (#routineOverlay: its name and a line per exercise — which one,
 * sets, reps, weight — with ↑ ↓ ✕), the program (add any routine, as often as you like; ↑ ↓ ✕) and the settings
 * (unit, weekly target). Weights show and save in the unit picked; a line left as it was keeps its own. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, readNumber } = K.util;
  const { MAX_EXERCISE, MAX_ROUTINE, MAX_LINES, MAX_SETS, MAX_REPS, MAX_WEIGHT, MAX_TARGET, MAX_PROGRAM, STARTER,
    cleanLine, plural, fieldText, wholeIn, weightIn, inUnit, unit } = A;
  const kept = () => { A.save(); A.renderAll(); };
  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

  // ==========================================================================
  // EXERCISES
  // ==========================================================================
  const exOverlay = () => $("exerciseOverlay");
  const exState = () => JSON.stringify([$("exerciseName").value, $("exerciseBodyweight").checked]);
  const routinesWith = id => A.liveRoutines().filter(r => r.items.some(x => x.exerciseId === id));

  function openExercise(id) {
    const e = id ? A.exerciseById(id) : null;
    if (id && !e) return;
    S.editing = { kind: "exercise", id: e ? e.id : "" };
    $("exerciseTitle").textContent = e ? "Exercise" : "New exercise";
    $("exerciseName").value = e ? e.name : "";
    $("exerciseBodyweight").checked = !!(e && e.bodyweight);
    const used = e ? routinesWith(e.id).length : 0;
    $("exerciseUse").textContent = used ? `In ${plural(used, "routine")}.` : "";
    $("exerciseUse").hidden = !used;
    $("exerciseDeleteBtn").hidden = !e;
    S.editing.snapshot = exState();
    K.modal.open(exOverlay());
    $("exerciseName").focus();
  }

  function saveExercise() {
    const ed = S.editing;
    if (!ed || ed.kind !== "exercise") return;
    const e = ed.id ? A.exerciseById(ed.id) : null;
    if (ed.id && !e) { K.modal.dismiss(exOverlay()); A.renderAll(); return alert("That exercise was deleted on another device, so nothing was saved."); }
    const name = cleanLine($("exerciseName").value, MAX_EXERCISE), bodyweight = $("exerciseBodyweight").checked;
    if (!name) { $("exerciseName").focus(); return alert("Give the exercise a name."); }
    if (A.liveExercises().some(x => x !== e && sameName(x.name, name))) { $("exerciseName").focus(); return alert(`There's already an exercise called “${name}”.`); }
    const t = Date.now();
    if (!e) S.exercises.push(A.cleanExercises([{ id: newId(), name, bodyweight, at: t, u: t }])[0]);
    else if (e.name !== name || e.bodyweight !== bodyweight) Object.assign(e, { name, bodyweight, u: t });
    else return K.modal.dismiss(exOverlay());
    K.modal.dismiss(exOverlay());
    kept();
  }

  // A deleted exercise stays as a marker (so sync can't bring it back) and leaves every routine; logged sets keep its name.
  function deleteExercise() {
    const ed = S.editing, e = ed && A.exerciseById(ed.id);
    if (!e) { K.modal.dismiss(exOverlay()); return A.renderAll(); }
    const used = routinesWith(e.id);
    if (!confirm(`Delete “${e.name}”?${used.length ? ` It's in ${plural(used.length, "routine")}: it'll come out of ${used.length === 1 ? "it" : "them"}.` : ""} Your logged sets keep its name.`)) return;
    const t = Date.now();
    used.forEach(r => Object.assign(r, { items: r.items.filter(x => x.exerciseId !== e.id), u: t }));
    S.exercises = S.exercises.map(x => (x === e ? { id: e.id, deleted: true, at: e.at, u: t } : x));
    K.modal.dismiss(exOverlay());
    kept();
  }

  // Squat, Bench press… offered while there are no exercises (never added by themselves: two devices would both).
  function addStarter() {
    if (A.liveExercises().length) return;
    const t = Date.now();
    S.exercises = S.exercises.concat(A.cleanExercises(STARTER.map(([name, bodyweight], i) => ({ id: newId(), name, bodyweight: !!bodyweight, at: t + i, u: t }))));
    kept();
  }

  // ==========================================================================
  // ROUTINES: lines are kept as typed while the pop-up is open (so ↑ ↓ ✕ and Add keep what's in the fields)
  // ==========================================================================
  const rtOverlay = () => $("routineOverlay");
  const rtState = () => { readLines(); return JSON.stringify([$("routineName").value, S.editing.lines]); };
  // A line as the pop-up holds it: the exercise, and the fields' text (the weight in the unit shown).
  const lineOf = x => ({ exerciseId: x.exerciseId, sets: String(x.sets), reps: String(x.reps), weight: String(inUnit(x.weight, x.unit)) });

  function newLine() {
    const used = new Set(S.editing.lines.map(l => l.exerciseId)), e = A.liveExercises().find(x => !used.has(x.id)) || A.liveExercises()[0];
    return { exerciseId: e ? e.id : "", sets: "3", reps: e && e.bodyweight ? "10" : "8", weight: "" };
  }

  function renderLines() {
    const lines = S.editing.lines, exercises = A.liveExercises();
    const num = (i, f, label, value, max, mode) => `<label class="line-field"><span>${label}</span><input type="number" data-i="${i}" data-f="${f}" value="${esc(value)}" min="0" max="${max}" step="any" inputmode="${mode}"></label>`;
    const btn = (i, act, label, text, ok = true) => `<button type="button" class="icon-btn" data-line="${act}" data-i="${i}" aria-label="${label}"${ok ? "" : " disabled"}>${text}</button>`;
    $("routineLines").innerHTML = lines.map((l, i) => {
      const e = A.exerciseById(l.exerciseId);
      const what = e ? `<select data-i="${i}" data-f="exerciseId" aria-label="Exercise ${i + 1}">${exercises.map(x => `<option value="${esc(x.id)}"${x.id === l.exerciseId ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`
        : `<span class="line-gone">(deleted exercise: it goes on Save)</span>`;
      return `<div class="line">${what}<div class="line-nums">` +
        (e ? num(i, "sets", "Sets", l.sets, MAX_SETS, "numeric") + num(i, "reps", "Reps", l.reps, MAX_REPS, "numeric") +
          num(i, "weight", `${e.bodyweight ? "Added" : "Weight"} (${unit()})`, l.weight, MAX_WEIGHT, "decimal") : "") +
        `<span class="line-btns">${btn(i, "up", "Move up", "&uarr;", i > 0)}${btn(i, "down", "Move down", "&darr;", i < lines.length - 1)}${btn(i, "remove", "Remove", "&times;")}</span></div></div>`;
    }).join("") || `<div class="empty-msg">No exercises in it yet.</div>`;
    $("routineAddLineBtn").disabled = lines.length >= MAX_LINES || !exercises.length;
  }
  // What's in the fields, into the lines.
  function readLines() {
    $("routineLines").querySelectorAll("[data-f]").forEach(el => { const l = S.editing.lines[+el.dataset.i]; if (l) l[el.dataset.f] = el.tagName === "SELECT" ? el.value : fieldText(el); });
  }

  function openRoutine(id) {
    const r = id ? A.routineById(id) : null;
    if (id && !r) return;
    S.editing = { kind: "routine", id: r ? r.id : "", lines: r ? r.items.map(lineOf) : [] };
    if (!r) S.editing.lines.push(newLine());
    S.editing.original = r ? r.items.slice() : [];
    $("routineTitle").textContent = r ? "Routine" : "New routine";
    $("routineName").value = r ? r.name : "";
    $("routineDeleteBtn").hidden = !r;
    renderLines();
    S.editing.snapshot = rtState();
    K.modal.open(rtOverlay());
    if (!r) $("routineName").focus();
  }

  function lineAction(act, i) {
    readLines();
    const lines = S.editing.lines;
    if (act === "remove") lines.splice(i, 1);
    else if (act === "add" && lines.length < MAX_LINES) lines.push(newLine());
    else {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= lines.length) return;
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    renderLines();
  }

  function saveRoutine() {
    const ed = S.editing;
    if (!ed || ed.kind !== "routine") return;
    readLines();
    const r = ed.id ? A.routineById(ed.id) : null;
    if (ed.id && !r) { K.modal.dismiss(rtOverlay()); A.renderAll(); return alert("That routine was deleted on another device, so nothing was saved."); }
    if (rtState() === ed.snapshot && r) return K.modal.dismiss(rtOverlay());
    const name = cleanLine($("routineName").value, MAX_ROUTINE);
    if (!name) { $("routineName").focus(); return alert("Give the routine a name, like “Pull A”."); }
    if (A.liveRoutines().some(x => x !== r && sameName(x.name, name))) { $("routineName").focus(); return alert(`There's already a routine called “${name}”.`); }
    const lines = ed.lines.filter(l => A.exerciseById(l.exerciseId)), items = [], seen = new Set();
    if (!lines.length) return alert("Add at least one exercise to the routine.");
    for (const l of lines) {
      const e = A.exerciseById(l.exerciseId), sets = wholeIn(l.sets, 1, MAX_SETS), reps = wholeIn(l.reps, 1, MAX_REPS), weight = weightIn(l.weight);
      if (seen.has(e.id)) return alert(`${e.name} is in this routine twice: keep one line for it.`);
      if (sets === null) return alert(`${e.name}: sets go from 1 to ${MAX_SETS}.`);
      if (reps === null) return alert(`${e.name}: reps go from 1 to ${MAX_REPS}.`);
      if (weight === null) return alert(`${e.name}: the weight goes from 0 to ${MAX_WEIGHT}.`);
      seen.add(e.id);
      // An exercise's weight left as it was keeps its own weight and unit (nothing converted for nothing); a changed
      // one is in the unit shown.
      const was = ed.original.find(x => x.exerciseId === e.id), same = was && l.weight === String(inUnit(was.weight, was.unit));
      items.push({ exerciseId: e.id, sets, reps, weight: same ? was.weight : weight, unit: same ? was.unit : unit() });
    }
    const t = Date.now();
    if (r) Object.assign(r, A.cleanRoutines([{ ...r, name, items, u: t }])[0]);
    else S.routines.push(A.cleanRoutines([{ id: newId(), name, items, at: t, u: t }])[0]);
    K.modal.dismiss(rtOverlay());
    kept();
  }

  // A deleted routine stays as a marker and leaves the program; its sessions keep its name.
  function deleteRoutine() {
    const ed = S.editing, r = ed && A.routineById(ed.id);
    if (!r) { K.modal.dismiss(rtOverlay()); return A.renderAll(); }
    if (!confirm(`Delete “${r.name}”? It comes out of the program too. Your sessions of it are kept.`)) return;
    const t = Date.now();
    S.routines = S.routines.map(x => (x === r ? { id: r.id, deleted: true, at: r.at, u: t } : x));
    if (S.program.order.includes(r.id)) S.program = { order: S.program.order.filter(id => id !== r.id), u: t };
    K.modal.dismiss(rtOverlay());
    kept();
  }

  // ==========================================================================
  // PROGRAM AND SETTINGS
  // ==========================================================================
  // An edit of the rotation, made on its live routines (any deleted one drops out with it).
  function editProgram(fn) {
    const order = A.liveOrder();
    if (fn(order) === false) return;
    S.program = { order: order.slice(0, MAX_PROGRAM), u: Date.now() };
    kept();
  }
  function addToProgram(id) {
    if (!A.routineById(id)) return;
    if (A.liveOrder().length >= MAX_PROGRAM) return alert(`The program holds up to ${MAX_PROGRAM} workouts.`);
    editProgram(order => { order.push(id); });
  }
  const moveInProgram = (i, by) => editProgram(order => {
    const j = i + by;
    if (i < 0 || j < 0 || i >= order.length || j >= order.length) return false;
    [order[i], order[j]] = [order[j], order[i]];
  });
  const removeFromProgram = i => editProgram(order => (i >= 0 && i < order.length ? void order.splice(i, 1) : false));

  function setUnit(u) {
    if ((u !== "lb" && u !== "kg") || u === unit()) return;
    S.settings = { ...S.settings, unit: u, u: Date.now() };
    kept();
  }
  function setTarget() {
    const v = readNumber($("targetInput"));
    if (!Number.isInteger(v) || v < 1 || v > MAX_TARGET) {
      $("targetInput").value = S.settings.weeklyTarget;
      return alert(`Workouts a week: from 1 to ${MAX_TARGET}.`);
    }
    if (v === S.settings.weeklyTarget) return;
    S.settings = { ...S.settings, weeklyTarget: v, u: Date.now() };
    kept();
  }

  function wireEditors() {
    // Esc, × and a click beside a pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
    K.modal.define(exOverlay(), {
      dismiss: () => { K.modal.close(exOverlay()); S.editing = null; },
      pending: () => !!S.editing && S.editing.kind === "exercise" && exState() !== S.editing.snapshot,
      ask: "Discard your changes to this exercise?"
    });
    K.modal.define(rtOverlay(), {
      dismiss: () => { K.modal.close(rtOverlay()); S.editing = null; },
      pending: () => !!S.editing && S.editing.kind === "routine" && rtState() !== S.editing.snapshot,
      ask: "Discard your changes to this routine?"
    });
    // Enter in a field saves, as Save does.
    $("exerciseForm").addEventListener("submit", e => { e.preventDefault(); saveExercise(); });
    $("exerciseCancelBtn").addEventListener("click", () => K.modal.dismiss(exOverlay()));
    $("exerciseDeleteBtn").addEventListener("click", deleteExercise);
    $("routineForm").addEventListener("submit", e => { e.preventDefault(); saveRoutine(); });
    $("routineCancelBtn").addEventListener("click", () => K.modal.dismiss(rtOverlay()));
    $("routineDeleteBtn").addEventListener("click", deleteRoutine);
    $("routineAddLineBtn").addEventListener("click", () => lineAction("add", -1));
    $("routineLines").addEventListener("click", e => { const b = e.target.closest("button[data-line]"); if (b) lineAction(b.dataset.line, +b.dataset.i); });
    // Another exercise picked: its weight's label follows (bodyweight or not).
    $("routineLines").addEventListener("change", e => { if (e.target.dataset.f === "exerciseId") { readLines(); renderLines(); } });
    $("addExerciseBtn").addEventListener("click", () => openExercise(""));
    $("starterBtn").addEventListener("click", addStarter);
    $("addRoutineBtn").addEventListener("click", () => openRoutine(""));
    $("programAddBtn").addEventListener("click", () => addToProgram($("programSelect").value));
    $("unitToggle").addEventListener("click", e => { const b = e.target.closest("button[data-unit]"); if (b) setUnit(b.dataset.unit); });
    $("targetInput").addEventListener("change", setTarget);
  }

  Object.assign(A, { wireEditors, openExercise, openRoutine, moveInProgram, removeFromProgram });
})(Kyoshi, Kyoshi.apps.badgermole);
