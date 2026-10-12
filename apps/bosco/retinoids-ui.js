/* Bosco · retinoids-ui.js — the retinoids on the page: the "Upcoming <Retinoid> Doses" section (each retinoid's next
 * applications, where it stands in its build-up; Hold this step a week and Undo), its pop-up's words and buttons
 * (#retinoidOverlay: Applied, Not yet, Postpone, Skip; its rules are retinoids.js'), and start-up info's Retinoids block (the list, Add / Edit / Remove,
 * the editor with its steps and live note). Wired by initRetinoids, from A.init. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isPos, isDate, newId, todayStr, daysBetween, fmtWeekday, fmtTime, readNumber } = K.util;
  const { RETINOIDS, MAX_REGIMENS, MAX_RETINOID_STEPS, DEFAULT_RETINOID_TIME, DEFAULT_STEPS, fmtDateBrief, retinoidLabel, regimenName,
    regimenTitle, retinoidsTitle } = A;

  const day = d => `${fmtWeekday(d)}, ${fmtDateBrief(d)}`;

  // ==========================================================================
  // THE UPCOMING SECTION
  // ==========================================================================
  // Hidden while no retinoid is set up. Each retinoid: its name, its last application (Undo while it's today's) and where
  // it stands (Hold this step a week during a timed step), then its next applications (the weekday, the date and usual
  // time, the step); a due one waits to be confirmed.
  function renderUpcomingRetinoids() {
    const groups = A.allUpcoming();
    $("upcomingRetinoidsSection").hidden = !groups.length;
    $("upcomingRetinoidsTitle").textContent = groups.length ? `Upcoming ${retinoidsTitle(groups.map(g => g.r))} Doses` : "";
    $("upcomingRetinoidsBody").innerHTML = groups.map(({ r, list }) => {
      const last = A.lastApplied(r);
      return `<div class="retinoid-group">
        <div class="summary-line retinoid-head">
          <span><strong>${esc(regimenTitle(r))}</strong>${last ? `<span class="muted"> · last applied ${day(last)}</span>` : ""}${A.undoable(r) ? `<button type="button" class="secondary small" data-undo="${r.id}">Undo</button>` : ""}</span>
          <span><span class="muted retinoid-progress">${esc(A.progressLine(r))}</span>${A.holdable(r) ? `<button type="button" class="secondary small" data-hold="${r.id}">Hold this step a week</button>` : ""}</span>
        </div>
        <div class="stat-grid">${list.map(a => `<div class="stat${a.due ? " due" : ""}">
          <div class="val">${fmtWeekday(a.date)}</div><div class="lbl"><span>${fmtDateBrief(a.date)}${r.time ? ` · ${fmtTime(r.time)}` : ""}</span></div>
          <div class="dose">${A.stepWords(r, a.step)}</div>
          ${a.due ? `<button class="small" data-apply="${r.id}:${a.date}">Applied ✓</button>` : ""}
        </div>`).join("")}</div>
      </div>`;
    }).join("");
    const due = groups.flatMap(g => g.list.filter(a => a.due)).sort((a, b) => a.date.localeCompare(b.date) || a.r.at - b.r.at);
    A.promptDueApplication(due);
  }

  // ==========================================================================
  // THE POP-UP
  // ==========================================================================
  function openApplicationModal(a) {
    const r = a.r, late = daysBetween(a.date, todayStr());
    S.applyAsking = a;
    $("retinoidModalTitle").textContent = `Did you apply your ${retinoidLabel(r.retinoid)}?`;
    $("retinoidModalText").textContent = `${regimenName(r)}${r.where ? ` on your ${r.where}` : ""} was due ${day(a.date)}${r.time ? ` at ${fmtTime(r.time)}` : ""}. It goes in your log once you confirm it.`;
    $("retinoidModalWhat").textContent = regimenTitle(r);
    $("retinoidModalStep").textContent = A.stepWords(r, a.step);
    // A late one is logged on the day it was applied: its own day, named (by weekday within the week), or today.
    $("retinoidLogBtn").textContent = late > 0 ? `Applied it ${late < 7 ? fmtWeekday(a.date) : fmtDateBrief(a.date)}` : "Applied";
    $("retinoidTodayBtn").hidden = !(late > 0);
    // Skip names the day it goes to: today, tomorrow, a weekday within the week, else the date.
    const to = A.skipTo(a), ahead = daysBetween(todayStr(), to);
    $("retinoidSkipBtn").textContent = `Skip to ${ahead === 0 ? "today" : ahead === 1 ? "tomorrow" : ahead < 7 ? fmtWeekday(to) : fmtDateBrief(to)}`;
    K.modal.open($("retinoidOverlay"));
    K.refreshSwitcher(); // a dot on Bosco's icon while you're in another app
  }

  function closeApplicationModal() {
    S.applyAsking = null;
    K.modal.close($("retinoidOverlay"));
    K.refreshSwitcher();
  }

  // ==========================================================================
  // START-UP INFO: THE RETINOIDS BLOCK
  // ==========================================================================
  // The list (each live retinoid with its schedule in short, Edit and Remove), the add line and the editor; shown with
  // start-up info (setup.js).
  function renderRetinoidsSetup() {
    const list = A.regimens(), editing = !!S.retinoidEditing;
    $("retinoidList").innerHTML = list.map(r => `<div class="summary-line retinoid-item">
      <span><strong>${esc(regimenTitle(r))}</strong> <span class="muted">${esc(A.scheduleWords(r))}</span></span>
      <span><button type="button" class="secondary small" data-edit-regimen="${r.id}">Edit</button>
      <button type="button" class="secondary small" data-remove-regimen="${r.id}">Remove</button></span>
    </div>`).join("");
    $("retinoidNone").hidden = list.length > 0;
    $("addRetinoidBtn").hidden = editing || list.length >= MAX_REGIMENS;
    $("retinoidAddLine").hidden = list.length > 0 && $("addRetinoidBtn").hidden;
    $("retinoidEditor").hidden = !editing;
  }

  // Opens the editor: a new retinoid (id "") prefilled with Tazarotene, its lowest strength, 9 PM, today and the default
  // build-up; or one kept, as it is.
  function openRegimenEditor(id) {
    const r = id ? A.regimens().find(x => x.id === id) : null;
    if (id && !r) return;
    const v = r || { retinoid: "tazarotene", pct: RETINOIDS.tazarotene.strengths[0], where: "", time: DEFAULT_RETINOID_TIME, start: todayStr(), steps: DEFAULT_STEPS };
    S.retinoidEditing = { id: r ? r.id : "", steps: v.steps.map(s => ({ ...s })) };
    setKind(v.retinoid, v.pct);
    $("retinoidWhere").value = v.where;
    $("retinoidTime").value = v.time || "";
    $("retinoidStart").value = v.start;
    drawSteps();
    renderRetinoidsSetup();
  }

  // The retinoid picked: its button lit, the strength list its cream's (keeping the pick, pct, when the list has it; a
  // strength kept for it that's no longer on the list stays on it).
  function setKind(kind, pct) {
    $("retinoidKind").dataset.value = kind;
    $("retinoidKind").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === kind));
    const kept = S.retinoidEditing.id && A.regimens().find(r => r.id === S.retinoidEditing.id);
    const list = (Object.hasOwn(RETINOIDS, kind) ? RETINOIDS[kind].strengths : []).slice();
    if (kept && kept.retinoid === kind && !list.includes(kept.pct)) list.push(kept.pct);
    list.sort((a, b) => a - b);
    $("retinoidStrength").innerHTML = list.map(p => `<option value="${p}">${A.strengthLabel({ pct: p })}</option>`).join("");
    $("retinoidStrength").value = String(list.includes(pct) ? pct : list[0]);
  }

  // The steps as edited: a row each, "every [N] days for [W] weeks ✕", the last "then every [N] days from then on".
  function drawSteps() {
    const steps = S.retinoidEditing.steps, n = steps.length, val = v => (Number.isFinite(v) ? v : "");
    const days = (s, i) => `<input type="number" class="step-every" step="1" min="1" max="14" value="${val(s.every)}" aria-label="Days between applications, step ${i + 1}">`;
    $("retinoidSteps").innerHTML = steps.map((s, i) => (i < n - 1
      ? `<div class="step-row"><span>every</span>${days(s, i)}<span>days for</span><input type="number" class="step-weeks" step="1" min="1" max="52" value="${val(s.weeks)}" aria-label="Weeks, step ${i + 1}"><span>weeks</span><button type="button" class="secondary small" data-remove-step="${i}" aria-label="Remove step ${i + 1}">✕</button></div>`
      : `<div class="step-row"><span>${n > 1 ? "then every" : "every"}</span>${days(s, i)}<span>${n > 1 ? "days from then on" : "days"}</span></div>`)).join("");
    $("addStepBtn").hidden = n >= MAX_RETINOID_STEPS;
    updateStepsNote();
  }

  // The rows' numbers as entered (null when empty, NaN when unreadable), kept in S.retinoidEditing.steps.
  function readSteps() {
    const rows = [...$("retinoidSteps").querySelectorAll(".step-row")];
    S.retinoidEditing.steps = rows.map((row, i) => ({ every: readNumber(row.querySelector(".step-every")), weeks: i < rows.length - 1 ? readNumber(row.querySelector(".step-weeks")) : null }));
    return S.retinoidEditing.steps;
  }
  const isWhole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const stepsValid = steps => steps.every((s, i) => isWhole(s.every, 1, 14) && (i === steps.length - 1 || isWhole(s.weeks, 1, 52)));

  // The live note under the steps: each one with its dates (nothing until they're whole numbers and there's a start).
  function updateStepsNote() {
    const steps = readSteps(), start = $("retinoidStart").value;
    $("retinoidStepsNote").textContent = isDate(start) && stepsValid(steps) ? A.stepsNote(start, steps) : "";
  }

  // A step's ✕ takes its row out (never the last); Add a step puts one in before the last, a copy of the row above it.
  function removeStep(i) {
    const steps = readSteps();
    if (i < steps.length - 1) steps.splice(i, 1);
    drawSteps();
  }
  function addStep() {
    const steps = readSteps();
    if (steps.length >= MAX_RETINOID_STEPS) return;
    const above = steps.length > 1 ? steps[steps.length - 2] : { every: steps[0].every, weeks: 2 };
    steps.splice(steps.length - 1, 0, { ...above });
    drawSteps();
  }

  // The retinoid as entered, or false after saying why.
  function enteredRegimen() {
    const fail = message => { alert(message); return false; };
    const retinoid = $("retinoidKind").dataset.value, pct = parseFloat($("retinoidStrength").value), where = $("retinoidWhere").value.trim();
    if (!retinoid || !isPos(pct)) return fail("Please pick the retinoid and its strength.");
    if (where.length > 24) return fail("Please keep where it goes to 24 characters.");
    if ($("retinoidTime").validity.badInput) return fail("Please finish entering the usual time, or leave it blank.");
    const start = $("retinoidStart").value;
    if (!isDate(start)) return fail("Please enter the start date.");
    const steps = readSteps();
    if (!stepsValid(steps)) return fail("Each step needs whole numbers: 1 to 14 days between applications, 1 to 52 weeks.");
    return { retinoid, pct, where, time: $("retinoidTime").value || null, start, steps: steps.map((s, i) => ({ every: s.every, weeks: i < steps.length - 1 ? s.weeks : null })) };
  }

  // Saves the retinoid in the editor (a new one added at the end; one edited keeps its place and its postponed day).
  // True once it's in (or with no editor open), false after saying why.
  function saveRegimen() {
    if (!S.retinoidEditing) return true;
    const v = enteredRegimen();
    if (!v) return false;
    const old = S.retinoidEditing.id && S.retinoids.regimens.find(r => r.id === S.retinoidEditing.id), t = Date.now();
    const r = { id: old ? old.id : newId(), retinoid: v.retinoid, pct: v.pct, where: v.where, time: v.time, start: v.start, steps: v.steps,
      next: old ? old.next : null, at: old ? old.at : t, u: A.stampAbove(old) };
    A.keepRetinoids({ ...S.retinoids, regimens: S.retinoids.regimens.filter(x => x !== old).concat(r) });
    S.retinoidEditing = null;
    A.save();
    renderRetinoidsSetup();
    A.renderAll();
    return true;
  }

  // Removes a retinoid, after asking: kept as a marker (so it stays removed on every device), its log with it.
  function removeRegimen(id) {
    const r = A.regimens().find(x => x.id === id);
    if (!r || !confirm(`Remove ${regimenTitle(r)}? Its past applications stay in your data.`)) return;
    A.keepRetinoids({ ...S.retinoids, regimens: S.retinoids.regimens.map(x => (x === r ? { ...r, x: true, u: A.stampAbove(r) } : x)) });
    if (S.retinoidEditing && S.retinoidEditing.id === id) S.retinoidEditing = null;
    A.save();
    renderRetinoidsSetup();
    A.renderAll();
  }

  // ==========================================================================
  // WIRING (from A.init)
  // ==========================================================================
  function initRetinoids() {
    const onButton = (el, selector, fn) => el.addEventListener("click", e => { const b = e.target.closest(selector); if (b) fn(b); });
    // The section's due cards open their application's pop-up.
    onButton($("upcomingRetinoidsBody"), "button[data-apply]", btn => {
      const a = A.allUpcoming().flatMap(g => g.list).find(x => `${x.r.id}:${x.date}` === btn.dataset.apply);
      if (a && a.due) openApplicationModal(a);
    });
    onButton($("upcomingRetinoidsBody"), "button[data-hold]", btn => A.holdStep(btn.dataset.hold));
    onButton($("upcomingRetinoidsBody"), "button[data-undo]", btn => A.undoApplication(btn.dataset.undo));
    // Esc and a click beside the pop-up count as "Not yet".
    K.modal.define($("retinoidOverlay"), { dismiss: A.snoozeApplication });
    $("retinoidLogBtn").addEventListener("click", () => A.confirmApplication(false));
    $("retinoidTodayBtn").addEventListener("click", () => A.confirmApplication(true));
    $("retinoidSnoozeBtn").addEventListener("click", A.snoozeApplication);
    $("retinoidPostponeBtn").addEventListener("click", A.postponeApplication);
    $("retinoidSkipBtn").addEventListener("click", A.skipApplication);
    // Start-up info's block.
    $("retinoidKind").innerHTML = Object.entries(RETINOIDS).map(([id, x]) => `<button type="button" class="mode-btn" data-value="${id}">${x.label}</button>`).join("");
    onButton($("retinoidKind"), "button[data-value]", btn => setKind(btn.dataset.value, parseFloat($("retinoidStrength").value)));
    onButton($("retinoidList"), "button[data-edit-regimen]", btn => openRegimenEditor(btn.dataset.editRegimen));
    onButton($("retinoidList"), "button[data-remove-regimen]", btn => removeRegimen(btn.dataset.removeRegimen));
    $("addRetinoidBtn").addEventListener("click", () => openRegimenEditor(""));
    onButton($("retinoidSteps"), "button[data-remove-step]", btn => removeStep(+btn.dataset.removeStep));
    $("addStepBtn").addEventListener("click", addStep);
    $("retinoidEditor").addEventListener("input", updateStepsNote);
    $("saveRetinoidBtn").addEventListener("click", saveRegimen);
    $("cancelRetinoidBtn").addEventListener("click", () => { S.retinoidEditing = null; renderRetinoidsSetup(); });
  }

  Object.assign(A, { renderUpcomingRetinoids, openApplicationModal, closeApplicationModal, renderRetinoidsSetup, openRegimenEditor, saveRegimen, initRetinoids });
})(Kyoshi, Kyoshi.apps.bosco);
