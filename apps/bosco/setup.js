/* Bosco · setup.js — the Get Started section (start-up info): the one-time questions,
 * the dosing plan with its anchor dose, the active vial calculator and the weekly pace
 * goal; saveOneTimeInfo checks and keeps them. Developer Mode reopens it to edit everything. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isPos, daysBetween, fmtDate, fmtWeekday, localDate, fmtNum, SEP } = K.util;
  const { ONE_TIME_FIELDS, MEDICATIONS, DOSING_QUESTIONS_VERSION, MAX_DOSE_INTERVAL_DAYS, MAX_PACE_PCT, DATA_SCHEMA_VERSION,
    medLabel, planFor, vialFor, isDoseInterval, eachDoseMg, fmtConc, fmtUnits, fmtDateBrief, readNumber } = A;

  // Shows the unanswered start-up questions — or all of them, prefilled, when
  // editing from Developer Mode.
  function renderOneTimeInfo(editAll) {
    const profile = S.profile;
    const fields = ONE_TIME_FIELDS.filter(f => editAll || (f.optional ? !profile[f.key + "Asked"] : !String(profile[f.key] || "").trim()));
    // The dosing plan and vial come after those: asked about once (when a
    // medication is taken or being picked), again when a dosing question is
    // added, and whenever start-up info is edited.
    S.dosingAsking = !!editAll || (profile.dosingAsked !== DOSING_QUESTIONS_VERSION && (A.medicationEnabled() || fields.some(f => f.key === "medication")));
    S.paceAsking = !!editAll || !profile.paceGoal; // asked once, and whenever start-up info is edited
    $("oneTimeInfoSection").hidden = !fields.length && !S.dosingAsking && !S.paceAsking;
    $("oneTimeInfoCancelBtn").hidden = !editAll;
    $("oneTimeInfoFields").innerHTML = fields.map(f => {
      const id = "oneTimeInput_" + f.key;
      if (f.type === "text") return `<div><label for="${id}">${f.label}</label><input type="text" id="${id}" placeholder="${f.placeholder}"></div>`;
      // Choices render as a button toggle; the pick is kept in data-value.
      const options = f.type === "boolean" ? [[true, "Yes"], [false, "No"]] : f.options.map(o => (Array.isArray(o) ? o : [o, o]));
      const current = options.some(([v]) => v === profile[f.key]) ? profile[f.key] : f.default;
      const many = options.length > 2; // too many to share a line with other questions
      return `<div${many ? ' class="full-row"' : ""}><label>${f.label}</label><div class="mode-toggle${many ? " many" : ""}" id="${id}" data-value="${current}">${
        options.map(([v, text]) => `<button type="button" class="mode-btn${v === current ? " active" : ""}" data-value="${v}">${text}</button>`).join("")
      }</div></div>`;
    }).join("");
    fields.filter(f => f.type === "text").forEach(f => { $("oneTimeInput_" + f.key).value = profile[f.key] || ""; });
    renderDosing();
    renderPaceGoal();
  }

  // The medication picked in start-up info, or the current one if it isn't being asked.
  function formMedication() {
    const el = $("oneTimeInput_medication");
    return el ? el.dataset.value : A.currentMedication();
  }

  // The dosing plan and vial in start-up info, for the medication picked there.
  function renderDosing() {
    const med = formMedication(), plan = planFor(med);
    $("dosingBox").hidden = !S.dosingAsking || med === "none";
    S.vialEditing = false;
    if (med === "none") return;
    $("dosingTitle").textContent = `${medLabel(med)} dosing`;
    $("weeklyDoseInput").placeholder = `e.g. ${MEDICATIONS[med].example}`;
    $("doseIntervalInput").value = (plan && plan.intervalDays) || "";
    $("weeklyDoseInput").value = (plan && plan.weeklyMg) || "";
    $("doseTimeInput").value = (plan && plan.doseTime) || "";
    S.anchorEditing = false;
    renderAnchor();
    renderVial();
  }

  // What the schedule counts from, with a button that shows the anchor dose date
  // (for starting or restarting doses; left blank, it changes nothing).
  function renderAnchor() {
    const last = A.lastDoseDate(), set = A.setNextDose(planFor(formMedication()), last);
    const day = d => `${fmtWeekday(d)}, ${fmtDateBrief(d)}`;
    $("anchorSummary").textContent = set ? `Next dose set for ${day(set)}.` : last ? `Counting from your last dose, ${day(last)}.` : "No dose to count from yet.";
    $("setAnchorBtn").hidden = S.anchorEditing;
    $("anchorEditor").hidden = !S.anchorEditing;
  }

  function openAnchorEditor() {
    S.anchorEditing = true;
    $("anchorDateInput").value = "";
    renderAnchor();
  }

  // The anchor dose as entered, as the plan's next dose: null if none, false
  // (after saying why) unless it comes after the last dose taken. One sooner
  // after it than the days between doses is likely a slip, so that asks first.
  function enteredAnchor(intervalDays) {
    if (!S.anchorEditing) return null;
    if ($("anchorDateInput").validity.badInput) { // only partly filled in
      alert("Please finish entering the anchor dose date, or leave it blank.");
      return false;
    }
    const date = $("anchorDateInput").value, last = A.lastDoseDate();
    if (!date) return null;
    if (date <= last) {
      alert(`An anchor dose has to come after your last dose (${fmtDate(last)}).`);
      return false;
    }
    const gap = last ? daysBetween(last, date) : Infinity;
    if (intervalDays && gap < intervalDays &&
        !confirm(`Your last dose was ${fmtDate(last)}, only ${gap} day${gap === 1 ? "" : "s"} before this anchor dose, and your doses are ${intervalDays} days apart. Set the anchor dose anyway?`)) return false;
    return { after: last, date };
  }

  // The active vial (or none) with a button to change it, or the calculator for a new one.
  function renderVial() {
    const med = formMedication(), vial = vialFor(med), other = vial ? null : S.profile.vial;
    const saved = vial && new Date(vial.savedAt);
    $("vialSummary").hidden = S.vialEditing;
    $("vialEditor").hidden = !S.vialEditing;
    $("vialSummaryText").innerHTML = vial
      ? `<strong>${fmtConc(vial.mgPerMl)}</strong><span class="muted">${vial.vialMg ? `${SEP}${fmtNum(vial.vialMg, 2)} mg + ${fmtNum(vial.bacMl, 2)} mL BAC water` : ""}${isNaN(saved) ? "" : `${SEP}saved ${fmtDateBrief(localDate(saved))}`}</span>`
      : other ? `Your active vial is for ${medLabel(other.medication)}.` : "No active vial yet.";
    $("changeVialBtn").textContent = vial ? "Change vial" : "Add vial";
    updateDosingNotes();
  }

  function setVialMode(mode) {
    S.vialMode = mode;
    $("vialModeToggle").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.vialMode === mode));
    $("vialMixWrap").hidden = mode !== "mix";
    $("vialKnownWrap").hidden = mode !== "known";
    updateDosingNotes();
  }

  const bacWaterMl = () => Math.round(parseFloat($("bacMlInput").value) * 10) / 10;

  // Live results as the dosing is entered: each dose from the weekly dose, the
  // vial's concentration, and each dose in syringe units.
  function updateDosingNotes() {
    const show = (id, html) => { $(id).innerHTML = html; $(id).hidden = !html; };
    const days = readNumber("doseIntervalInput"), weekly = readNumber("weeklyDoseInput");
    const dose = isDoseInterval(days) && isPos(weekly) ? eachDoseMg(weekly, days) : null;
    show("eachDoseNote", dose ? `Each dose: <strong>${dose} mg</strong>` : "");
    $("bacMlValue").textContent = `${bacWaterMl()} mL`;
    const vial = S.vialEditing ? enteredVial(true) : vialFor(formMedication());
    const notes = [];
    if (vial && S.vialEditing && S.vialMode === "mix") notes.push(`Concentration: <strong>${fmtConc(vial.mgPerMl)}</strong>`);
    if (vial && dose) notes.push(`${dose} mg = <strong>${fmtUnits(dose, vial.mgPerMl)}</strong> on a U&#8209;100 syringe`); // "U-100" never splits
    // Under the saved vial, or inside the calculator while it's open.
    show("vialUnitsNote", notes.join(SEP));
    show("vialCalcNote", notes.join(SEP));
  }

  // The dosing plan as entered, or false (after saying why) if it isn't valid.
  function enteredPlan() {
    const intervalDays = readNumber("doseIntervalInput"), weeklyMg = readNumber("weeklyDoseInput");
    if (intervalDays !== null && !isDoseInterval(intervalDays)) {
      alert(`Days between doses must be a whole number from 1 to ${MAX_DOSE_INTERVAL_DAYS}.`);
      return false;
    }
    if (weeklyMg !== null && !isPos(weeklyMg)) {
      alert("Please enter a valid positive weekly dose, or leave it blank.");
      return false;
    }
    if ($("doseTimeInput").validity.badInput) { // only partly filled in
      alert("Please finish entering your usual dose time, or leave it blank.");
      return false;
    }
    return { intervalDays, weeklyMg, doseTime: $("doseTimeInput").value || null };
  }

  // The vial in the calculator: null while nothing's entered, false if it isn't
  // valid (saying why, unless quiet).
  function enteredVial(quiet) {
    const invalid = message => { if (!quiet) alert(message); return false; };
    if (S.vialMode === "known") {
      const mgPerMl = readNumber("vialConcInput");
      if (mgPerMl === null) return null;
      // Positive, with no more than three decimal places (e.g. 16.667).
      return isPos(mgPerMl) && mgPerMl === +mgPerMl.toFixed(3) ? { mgPerMl, vialMg: null, bacMl: null }
        : invalid("Enter the concentration in mg per mL, with up to three decimal places.");
    }
    const vialMg = readNumber("vialMgInput"), bacMl = bacWaterMl();
    if (vialMg === null) return null;
    return isPos(vialMg) ? { mgPerMl: vialMg / bacMl, vialMg, bacMl } : invalid("Please enter the vial's total mg as a positive number.");
  }

  // Only one vial is active, and upcoming doses' syringe units come from it, so
  // opening the calculator over a saved vial warns first.
  function openVialEditor() {
    const med = formMedication(), old = S.profile.vial, same = !!vialFor(med);
    if (old && !confirm(same
      ? `Change your active ${medLabel(med)} vial (${fmtConc(old.mgPerMl)})? Upcoming doses work out their syringe units from it, so only change it when you start a new vial.`
      : `Only one vial can be active. Saving a ${medLabel(med)} vial will replace your ${medLabel(old.medication)} vial (${fmtConc(old.mgPerMl)}). Continue?`)) return;
    S.vialEditing = true;
    $("vialMgInput").value = same && old.vialMg ? old.vialMg : "";
    $("bacMlInput").value = same && old.bacMl ? old.bacMl : $("bacMlInput").defaultValue;
    $("vialConcInput").value = same && !old.vialMg ? old.mgPerMl : "";
    setVialMode(same && !old.vialMg ? "known" : "mix");
    renderVial();
  }

  function storeVial(vial, med) {
    S.profile.vial = { medication: med, ...vial, savedAt: new Date().toISOString() };
    S.vialEditing = false;
  }

  // Save as active vial (inside start-up info).
  function saveVial() {
    const vial = enteredVial();
    if (vial === false) return;
    if (!vial) return alert(S.vialMode === "known" ? "Enter the vial's concentration first." : "Enter the vial's total mg first.");
    storeVial(vial, formMedication());
    A.save();
    renderVial();
    A.renderAll();
  }

  // The weekly pace goal in start-up info, prefilled with the current one.
  function renderPaceGoal() {
    const g = A.paceGoal();
    $("paceBox").hidden = !S.paceAsking;
    $("paceDirToggle").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.paceDir === g.dir));
    $("pacePctInput").value = g.weeklyPct;
    $("paceRangeInput").value = g.rangePct;
    updatePaceNote();
  }

  // The pace goal as entered, or false (saying why, unless quiet) if it isn't valid.
  function enteredPaceGoal(quiet) {
    const g = A.cleanPaceGoal({
      dir: $("paceDirToggle").querySelector("button.active").dataset.paceDir,
      weeklyPct: readNumber("pacePctInput"),
      rangePct: readNumber("paceRangeInput")
    });
    if (!g && !quiet) alert(`Please enter a weekly target above 0 and up to ${MAX_PACE_PCT}%, and an on-pace range of 0 or more that's smaller than the target.`);
    return g || false;
  }

  // Live as the pace goal is entered: its green range (and the weight a week that
  // comes to at the latest weigh-in), then its yellow one.
  function updatePaceNote() {
    const g = enteredPaceGoal(true), w = A.weightEntries(), cur = w.length ? w[w.length - 1].weight : 0, unit = S.unit;
    const perWeek = pct => fmtNum(cur * pct / 100, 1);
    const weight = g && cur ? `, about ${g.rangePct ? `${perWeek(g.weeklyPct - g.rangePct)}–${perWeek(g.weeklyPct + g.rangePct)}` : perWeek(g.weeklyPct)} ${unit} at ${cur.toFixed(1)} ${unit}` : "";
    const yellow = g && g.rangePct ? ` Yellow: ${A.fmtPaceBand(g, 2)}.` : "";
    $("paceNote").innerHTML = g ? `Green: ${g.dir === "gain" ? "gaining" : "losing"} <strong>${A.fmtPaceBand(g)}</strong> a week${weight}.${yellow}` : "";
    $("paceNote").hidden = !g;
  }

  // Save in start-up info. The dosing plan, an open vial calculator and the pace
  // goal are checked first, so a bad entry there changes nothing.
  function saveOneTimeInfo() {
    const med = formMedication(), dosing = S.dosingAsking && med !== "none";
    const plan = dosing ? enteredPlan() : null;
    if (plan === false) return;
    const vial = dosing && S.vialEditing ? enteredVial() : null;
    if (vial === false) return;
    const anchor = dosing ? enteredAnchor(plan.intervalDays) : null;
    if (anchor === false) return;
    const pace = S.paceAsking ? enteredPaceGoal() : null;
    if (pace === false) return;
    const prevUnit = S.unit, profile = S.profile;
    ONE_TIME_FIELDS.forEach(f => {
      const el = $("oneTimeInput_" + f.key);
      if (!el) return;
      profile[f.key] = f.type === "text" ? el.value.trim() : f.type === "boolean" ? el.dataset.value === "true" : el.dataset.value;
      if (f.optional) profile[f.key + "Asked"] = true;
    });
    if (S.dosingAsking) profile.dosingAsked = DOSING_QUESTIONS_VERSION;
    if (pace) profile.paceGoal = pace;
    const oldPlan = planFor(med) || {};
    if (plan && (anchor || Object.keys(plan).some(k => plan[k] !== (oldPlan[k] ?? null)))) {
      profile.dosePlan = { medication: med, ...plan, nextDose: anchor || oldPlan.nextDose || null, savedAt: new Date().toISOString() };
    }
    if (vial) storeVial(vial, med); // its warning came when the calculator was opened
    S.unit = profile.unit || "lb";
    if (S.unit !== prevUnit) {
      // Changing units converts every stored weight, so nothing is ever mixed.
      const converted = A.normalizeBackup({ unit: prevUnit, schemaVersion: DATA_SCHEMA_VERSION, entries: S.entries, goals: S.goals }, S.unit);
      S.entries = converted.entries;
      S.goals = converted.goals;
    }
    A.save();
    S.currentPage = 1;
    renderOneTimeInfo();
    A.renderAll();
  }

  Object.assign(A, {
    renderOneTimeInfo, formMedication, renderDosing, renderAnchor, openAnchorEditor, renderVial, setVialMode,
    updateDosingNotes, openVialEditor, saveVial, renderPaceGoal, updatePaceNote, saveOneTimeInfo
  });
})(Kyoshi, Kyoshi.apps.bosco);
