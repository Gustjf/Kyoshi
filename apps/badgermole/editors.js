/* Badgermole · editors.js — the setup: the exercise pop-up (#exerciseOverlay: name, bodyweight, its progression step;
 * Save, Cancel, Delete), the starter exercises, the routine pop-up (#routineOverlay: its name and a line per exercise —
 * which one, sets, reps, weight, "to failure" — with ↑ ↓ ✕, and a superset's link between two lines), the programs
 * (follow one with a tap; #programOverlay: New program, Rename, Delete), the rotation followed (add any routine, as
 * often as you like; ↑ ↓ ✕) and the settings (unit, weekly target). Weights show and save in the unit picked; a line
 * left as it was keeps its own. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, readNumber, now } = K.util;
  const { MAX_EXERCISE, MAX_ROUTINE, MAX_LINES, MAX_SETS, MAX_REPS, MAX_WEIGHT, MAX_TARGET, MAX_PROGRAM, MAX_PROGRAMS,
    MAX_PROGRAM_NAME, MAIN_PROGRAM, STEPS, DEFAULT_STEP, MAX_PAIR, STARTER,
    cleanLine, plural, fieldText, wholeIn, weightIn, inUnit, unit, pairClass } = A;
  const kept = () => { A.save(); A.renderAll(); };
  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

  // ==========================================================================
  // EXERCISES
  // ==========================================================================
  const exOverlay = () => $("exerciseOverlay");
  const exState = () => JSON.stringify([$("exerciseName").value, $("exerciseBodyweight").checked, S.editing.step]);
  const routinesWith = id => A.liveRoutines().filter(r => r.items.some(x => x.exerciseId === id));

  // Its progression step: +2.5 · +5 · +7.5 · +10 lb (in kg +1 · +2.5 · +3.5 · +4.5), the one picked marked; hidden
  // for a bodyweight exercise (it goes up a rep).
  function renderStep() {
    const pick = S.editing.step;
    $("exerciseStepLabel").textContent = `Progression step (${unit()})`;
    $("exerciseStep").innerHTML = STEPS.map(s => `<button type="button" class="mode-btn${s === pick ? " active" : ""}" data-lb="${s}" aria-pressed="${s === pick}">+${inUnit(s, "lb")}</button>`).join("");
    $("exerciseStepField").hidden = $("exerciseBodyweight").checked;
  }

  function openExercise(id) {
    const e = id ? A.exerciseById(id) : null;
    if (id && !e) return;
    S.editing = { kind: "exercise", id: e ? e.id : "", step: e ? e.step : DEFAULT_STEP };
    $("exerciseTitle").textContent = e ? "Exercise" : "New exercise";
    $("exerciseName").value = e ? e.name : "";
    $("exerciseBodyweight").checked = !!(e && e.bodyweight);
    renderStep();
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
    const name = cleanLine($("exerciseName").value, MAX_EXERCISE), bodyweight = $("exerciseBodyweight").checked, step = ed.step;
    if (!name) { $("exerciseName").focus(); return alert("Give the exercise a name."); }
    if (A.liveExercises().some(x => x !== e && sameName(x.name, name))) { $("exerciseName").focus(); return alert(`There's already an exercise called “${name}”.`); }
    const t = Date.now();
    if (!e) S.exercises.push(A.cleanExercises([{ id: newId(), name, bodyweight, step, at: t, u: t }])[0]);
    else if (e.name !== name || e.bodyweight !== bodyweight || e.step !== step) Object.assign(e, { name, bodyweight, step, u: t });
    else return K.modal.dismiss(exOverlay());
    K.modal.dismiss(exOverlay());
    kept();
  }

  // A deleted exercise stays as a marker (so sync can't bring it back) and leaves every routine (and a superset there);
  // logged sets keep its name.
  function deleteExercise() {
    const ed = S.editing, e = ed && A.exerciseById(ed.id);
    if (!e) { K.modal.dismiss(exOverlay()); return A.renderAll(); }
    const used = routinesWith(e.id);
    if (!confirm(`Delete “${e.name}”?${used.length ? ` It's in ${plural(used.length, "routine")}: it'll come out of ${used.length === 1 ? "it" : "them"}.` : ""} Your logged sets keep its name.`)) return;
    const t = Date.now();
    used.forEach(r => Object.assign(r, { items: A.fixPairs(r.items.filter(x => x.exerciseId !== e.id)), u: t }));
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
  // A line as the pop-up holds it: the exercise, the fields' text (the weight in the unit shown), to failure, its pair.
  const lineOf = x => ({ exerciseId: x.exerciseId, sets: String(x.sets), reps: String(x.reps), weight: String(inUnit(x.weight, x.unit)), toFailure: x.toFailure, pair: x.pair });

  function newLine() {
    const used = new Set(S.editing.lines.map(l => l.exerciseId)), e = A.liveExercises().find(x => !used.has(x.id)) || A.liveExercises()[0];
    return { exerciseId: e ? e.id : "", sets: "3", reps: e && e.bodyweight ? "10" : "8", weight: "", toFailure: false, pair: 0 };
  }

  // The "link" icon from Lucide (ISC license), on a superset's link between two lines.
  const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  // The lowest superset number no line has (0 once all are taken).
  const freePair = lines => { for (let n = 1; n <= MAX_PAIR; n++) if (!lines.some(l => l.pair === n)) return n; return 0; };

  function renderLines() {
    const lines = S.editing.lines, exercises = A.liveExercises();
    const num = (i, f, label, value, max, mode) => `<label class="line-field"><span>${label}</span><input type="number" data-i="${i}" data-f="${f}" value="${esc(value)}" min="0" max="${max}" step="any" inputmode="${mode}"></label>`;
    const btn = (i, act, label, text, ok = true) => `<button type="button" class="icon-btn" data-line="${act}" data-i="${i}" aria-label="${label}"${ok ? "" : " disabled"}>${text}</button>`;
    // Between two lines: Unlink when they're a superset, else Superset when neither is in one.
    const link = i => {
      const a = lines[i], b = lines[i + 1];
      if (!b || !A.exerciseById(a.exerciseId) || !A.exerciseById(b.exerciseId)) return "";
      if (a.pair && a.pair === b.pair) return `<div class="line-link${pairClass(a.pair)}"><button type="button" class="link-btn" data-line="unlink" data-i="${i}">Unlink</button></div>`;
      return a.pair || b.pair || !freePair(lines) ? "" : `<div class="line-link"><button type="button" class="link-btn" data-line="link" data-i="${i}">${LINK} Superset</button></div>`;
    };
    $("routineLines").innerHTML = lines.map((l, i) => {
      const e = A.exerciseById(l.exerciseId);
      const what = e ? `<select data-i="${i}" data-f="exerciseId" aria-label="Exercise ${i + 1}">${exercises.map(x => `<option value="${esc(x.id)}"${x.id === l.exerciseId ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`
        : `<span class="line-gone">(deleted exercise: it goes on Save)</span>`;
      return `<div class="line${pairClass(l.pair)}">${what}<div class="line-nums">` +
        (e ? num(i, "sets", "Sets", l.sets, MAX_SETS, "numeric") + num(i, "reps", l.toFailure ? "Min reps" : "Reps", l.reps, MAX_REPS, "numeric") +
          num(i, "weight", `${e.bodyweight ? "Added" : "Weight"} (${unit()})`, l.weight, MAX_WEIGHT, "decimal") +
          `<button type="button" class="pill${l.toFailure ? " active" : ""}" data-line="fail" data-i="${i}" aria-pressed="${!!l.toFailure}" title="The reps are the minimum: keep going to failure and log the good reps">to failure</button>` : "") +
        `<span class="line-btns">${btn(i, "up", "Move up", "&uarr;", i > 0)}${btn(i, "down", "Move down", "&darr;", i < lines.length - 1)}${btn(i, "remove", "Remove", "&times;")}</span></div></div>` + link(i);
    }).join("") || `<div class="empty-msg">No exercises in it yet.</div>`;
    $("routineHint").hidden = !lines.length;
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

  // ↑ ↓ ✕, Add, "to failure", and Superset / Unlink with the next line. Moving a linked line up or down unlinks it, and
  // a superset a move or a removal splits is unlinked too.
  function lineAction(act, i) {
    readLines();
    const lines = S.editing.lines, l = lines[i], j = act === "up" ? i - 1 : i + 1;
    if (act === "add") { if (lines.length < MAX_LINES) lines.push(newLine()); }
    else if (!l) return;
    else if (act === "remove") lines.splice(i, 1);
    else if (act === "fail") l.toFailure = !l.toFailure;
    else if (act === "link" || act === "unlink") { if (lines[j]) l.pair = lines[j].pair = act === "link" ? freePair(lines) : 0; }
    else if (j >= 0 && j < lines.length) {
      if (l.pair) lines.forEach(x => { if (x.pair === l.pair) x.pair = 0; });
      [lines[i], lines[j]] = [lines[j], lines[i]];
    } else return;
    A.fixPairs(lines);
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
      items.push({ exerciseId: e.id, sets, reps, weight: same ? was.weight : weight, unit: same ? was.unit : unit(), toFailure: l.toFailure === true, pair: l.pair || 0 });
    }
    const t = Date.now();
    if (r) Object.assign(r, A.cleanRoutines([{ ...r, name, items, u: t }])[0]);
    else S.routines.push(A.cleanRoutines([{ id: newId(), name, items, at: t, u: t }])[0]);
    K.modal.dismiss(rtOverlay());
    kept();
  }

  // A deleted routine stays as a marker and leaves every program; its sessions keep its name.
  function deleteRoutine() {
    const ed = S.editing, r = ed && A.routineById(ed.id);
    if (!r) { K.modal.dismiss(rtOverlay()); return A.renderAll(); }
    if (!confirm(`Delete “${r.name}”? It comes out of your programs too. Your sessions of it are kept.`)) return;
    const t = Date.now();
    S.routines = S.routines.map(x => (x === r ? { id: r.id, deleted: true, at: r.at, u: t } : x));
    S.programs.forEach(p => { if (!p.deleted && p.order.includes(r.id)) Object.assign(p, { order: p.order.filter(id => id !== r.id), u: t }); });
    if (S.program.order.includes(r.id)) S.program = { ...S.program, order: S.program.order.filter(id => id !== r.id), u: t };
    K.modal.dismiss(rtOverlay());
    kept();
  }

  // ==========================================================================
  // PROGRAMS: one followed (program.active); a new one starts empty. program.order mirrors the rotation followed, for
  // older copies.
  // ==========================================================================
  const pgOverlay = () => $("programOverlay");
  // Follows a program (null: none) from its first routine: only sessions from now on place its next one.
  const follow = (p, t) => { S.program = { order: p ? p.order.filter(id => A.routineById(id)) : [], active: p ? p.id : "", since: now(), u: t }; };

  // A tap on another program follows it instead.
  function pickProgram(id) {
    const p = A.programById(id);
    if (!p || p === A.activeProgram()) return;
    follow(p, Date.now());
    kept();
  }

  // New program, or Rename the one followed (with Delete).
  function openProgram(isNew) {
    const p = isNew ? null : A.activeProgram();
    if (!isNew && !p) return;
    if (!p && A.livePrograms().length >= MAX_PROGRAMS) return alert(`Badgermole keeps up to ${MAX_PROGRAMS} programs.`);
    S.editing = { kind: "program", id: p ? p.id : "" };
    $("programTitle").textContent = p ? "Program" : "New program";
    $("programName").value = p ? p.name : "";
    $("programHint").hidden = !!p;
    $("programDeleteBtn").hidden = !p;
    S.editing.snapshot = $("programName").value;
    K.modal.open(pgOverlay());
    $("programName").focus();
  }

  function saveProgram() {
    const ed = S.editing;
    if (!ed || ed.kind !== "program") return;
    const p = ed.id ? A.programById(ed.id) : null;
    if (ed.id && !p) { K.modal.dismiss(pgOverlay()); A.renderAll(); return alert("That program was deleted on another device, so nothing was saved."); }
    const name = cleanLine($("programName").value, MAX_PROGRAM_NAME);
    if (!name) { $("programName").focus(); return alert("Give the program a name, like “Upper/Lower”."); }
    if (A.livePrograms().some(x => x !== p && sameName(x.name, name))) { $("programName").focus(); return alert(`There's already a program called “${name}”.`); }
    if (p && p.name === name) return K.modal.dismiss(pgOverlay());
    const t = Date.now();
    if (p) Object.assign(p, { name, u: t });
    else { const n = A.cleanPrograms([{ id: newId(), name, order: [], at: t, u: t }])[0]; S.programs.push(n); follow(n, t); }
    K.modal.dismiss(pgOverlay());
    kept();
  }

  // A deleted program stays as a marker; when it's the one followed, the first one left is followed instead (from its
  // first routine). Routines and sessions stay.
  function deleteProgram() {
    const ed = S.editing, p = ed && A.programById(ed.id);
    if (!p) { K.modal.dismiss(pgOverlay()); return A.renderAll(); }
    const next = S.program.active === p.id ? A.livePrograms().find(x => x !== p) || null : undefined;
    if (!confirm(`Delete the program “${p.name}”?${next ? ` You'll follow “${next.name}” instead, from its first routine.` : ""} Your routines and workouts are kept.`)) return;
    const t = Date.now();
    S.programs = S.programs.map(x => (x === p ? { id: p.id, deleted: true, at: p.at, u: t } : x));
    if (next !== undefined) follow(next, t);
    K.modal.dismiss(pgOverlay());
    kept();
  }

  // An edit of the rotation followed, made on its live routines (any deleted one drops out with it). With no program
  // followed yet, it becomes one, "Program", followed.
  function editProgram(fn) {
    const order = A.liveOrder();
    if (fn(order) === false) return;
    const t = Date.now(), next = order.slice(0, MAX_PROGRAM);
    let p = A.activeProgram();
    if (!p) {
      let name = "Program";
      for (let n = 2; A.livePrograms().some(x => sameName(x.name, name)); n++) name = `Program ${n}`;
      p = A.cleanPrograms([{ id: S.programs.some(x => x.id === MAIN_PROGRAM) ? newId() : MAIN_PROGRAM, name, order: [], at: t, u: t }])[0];
      S.programs.push(p);
    }
    Object.assign(p, { order: next, u: t });
    S.program = { order: next, active: p.id, since: S.program.since, u: t };
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

  // ==========================================================================
  // SETTINGS
  // ==========================================================================
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
    K.modal.define(pgOverlay(), {
      dismiss: () => { K.modal.close(pgOverlay()); S.editing = null; },
      pending: () => !!S.editing && S.editing.kind === "program" && $("programName").value !== S.editing.snapshot,
      ask: "Discard your changes to this program?"
    });
    // Enter in a field saves, as Save does.
    $("exerciseForm").addEventListener("submit", e => { e.preventDefault(); saveExercise(); });
    $("exerciseCancelBtn").addEventListener("click", () => K.modal.dismiss(exOverlay()));
    $("exerciseDeleteBtn").addEventListener("click", deleteExercise);
    // The progression step: one of its buttons, or hidden while it's a bodyweight exercise.
    $("exerciseStep").addEventListener("click", e => { const b = e.target.closest("button[data-lb]"); if (b && S.editing) { S.editing.step = +b.dataset.lb; renderStep(); } });
    $("exerciseBodyweight").addEventListener("change", renderStep);
    $("programForm").addEventListener("submit", e => { e.preventDefault(); saveProgram(); });
    $("programCancelBtn").addEventListener("click", () => K.modal.dismiss(pgOverlay()));
    $("programDeleteBtn").addEventListener("click", deleteProgram);
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

  Object.assign(A, { wireEditors, openExercise, openRoutine, openProgram, pickProgram, moveInProgram, removeFromProgram });
})(Kyoshi, Kyoshi.apps.badgermole);
