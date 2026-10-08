/* Bosco · events.js — loads last: wires Bosco's buttons and fields (A.init), and the hooks
 * Kyoshi calls: onTick (a new day, doses coming due), onKeydown (Enter submits), onReload
 * (another tab saved), attention (a due dose), renderDev (its Developer Mode tools: start-up
 * info, skipping the next dose's site) and bugState (its lines in bug reports). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isDate, isPos, todayStr, fmtDate } = K.util;
  const { hasWeight, hasDose, byDate, medLabel, fmtDateBrief, siteLabel, readNumber } = A;

  // Adds a weigh-in. Doses aren't added here: they're logged by confirming them.
  function addEntry() {
    const date = $("dateInput").value, unit = S.unit;
    const weight = readNumber("weightInput");
    if (!isDate(date)) return alert("Please enter a date.");
    if (weight === null) return alert("Enter a weight.");
    if (!isPos(weight)) return alert("Please enter a valid positive weight.");
    if (date > todayStr()) return alert("Weigh-ins can't be dated in the future.");
    const existing = S.entries.find(e => e.date === date);
    // Re-adding a date is how a weigh-in gets corrected, but never silently.
    if (existing && hasWeight(existing) && existing.weight !== weight &&
        !confirm(`${fmtDate(date)} already has a weigh-in of ${existing.weight.toFixed(1)} ${unit}. Replace it with ${weight.toFixed(1)} ${unit}?`)) return;
    if (existing) {
      existing.weight = weight; // a dose logged that day stays
    } else {
      S.entries.push({ date, weight, doseMg: null, medication: null, site: null });
      S.entries.sort(byDate);
    }
    A.save();
    $("weightInput").value = "";
    S.currentPage = 1;
    A.renderAll();
  }

  function addGoal() {
    const goal = readNumber("goalInput");
    if (goal === null) return;
    if (!isPos(goal)) return alert("Please enter a valid positive goal weight.");
    if (!S.goals.includes(goal)) {
      S.goals = S.goals.concat(goal).sort((a, b) => b - a);
      A.save();
    }
    $("goalInput").value = "";
    A.renderAll();
  }

  // Button groups: marks the clicked button active and passes on its value.
  function onToggle(container, attr, pick) {
    container.addEventListener("click", e => {
      const btn = e.target.closest(`button[${attr}]`);
      if (!btn) return;
      btn.parentElement.querySelectorAll(`button[${attr}]`).forEach(b => b.classList.toggle("active", b === btn));
      pick(btn.getAttribute(attr), btn);
    });
  }

  // Delegated clicks on buttons rendered into a container.
  function onButton(container, selector, handler) {
    container.addEventListener("click", e => {
      const btn = e.target.closest(selector);
      if (btn) handler(btn);
    });
  }

  // The Date field starts on today. If the app is left open past midnight (a phone
  // tab, say), move it to the new day, unless the user picked a date themselves.
  function rollOverToday() {
    const today = todayStr();
    if (today === S.entryDateDefault) return;
    if ($("dateInput").value === S.entryDateDefault) $("dateInput").value = today;
    S.entryDateDefault = today;
    A.renderAll();
  }

  A.init = () => {
    $("addBtn").addEventListener("click", addEntry);
    $("addGoalBtn").addEventListener("click", addGoal);
    $("exportImageBtn").addEventListener("click", A.exportGoalsImage);
    $("prevPageBtn").addEventListener("click", () => { S.currentPage--; A.renderAll(); });
    $("nextPageBtn").addEventListener("click", () => { S.currentPage++; A.renderAll(); });
    $("customRate").addEventListener("input", A.renderAll);

    onToggle($("trendWindowWrap"), "data-window", value => { S.trendWindow = value; A.renderAll(); });
    onToggle($("avgWindowWrap"), "data-avg-window", value => { S.avgWindow = value; A.renderAll(); });
    onToggle($("rateModeToggle"), "data-rate-mode", value => {
      S.rateMode = value;
      $("customRateWrap").hidden = value !== "custom";
      A.renderAll();
    });
    onToggle($("oneTimeInfoFields"), "data-value", (value, btn) => {
      btn.parentElement.dataset.value = value;
      if (btn.parentElement.id === "oneTimeInput_medication") A.renderDosing(); // dosing is per medication
    });
    $("dosingBox").addEventListener("input", A.updateDosingNotes);
    onToggle($("paceDirToggle"), "data-pace-dir", A.updatePaceNote);
    $("paceBox").addEventListener("input", A.updatePaceNote);
    onButton($("vialModeToggle"), "button[data-vial-mode]", btn => A.setVialMode(btn.dataset.vialMode));
    // Injection sites: each button turns its site on or off (as many on as you like), kept on Save.
    onButton($("sitePills"), "button[data-site]", btn => {
      const on = !btn.classList.contains("active");
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on);
    });
    $("changeVialBtn").addEventListener("click", A.openVialEditor);
    $("setAnchorBtn").addEventListener("click", A.openAnchorEditor);
    $("cancelVialBtn").addEventListener("click", () => { S.vialEditing = false; A.renderVial(); });
    $("saveVialBtn").addEventListener("click", A.saveVial);

    onButton($("historyBody"), "button[data-date]", btn => {
      // Deleting always asks: a dose (only ever logged by confirming it) with that day's weigh-in, or the weigh-in.
      const day = S.entries.find(e => e.date === btn.dataset.date);
      if (!day) return;
      const what = hasDose(day) ? `the ${day.doseMg} mg ${medLabel(day.medication)} dose logged ${fmtDate(day.date)}${hasWeight(day) ? ", and that day's weigh-in" : ""}`
        : `the weigh-in of ${day.weight.toFixed(1)} ${S.unit} on ${fmtDateBrief(day.date)}`;
      if (!confirm(`Delete ${what}? This can't be undone.`)) return;
      S.entries = S.entries.filter(e => e.date !== btn.dataset.date);
      A.save();
      A.renderAll();
    });
    onButton($("upcomingDosesGrid"), "button[data-set-anchor]", () => {
      A.renderOneTimeInfo(true);
      A.openAnchorEditor();
      $("dosingBox").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    onButton($("upcomingDosesGrid"), "button[data-confirm-dose]", btn => {
      const dose = A.doseSchedule().find(d => d.date === btn.dataset.confirmDose);
      if (dose) A.openDoseModal(dose);
    });
    // Esc and a click beside the dose pop-up count as "Not yet".
    K.modal.define($("doseOverlay"), { dismiss: A.snoozeDose });
    $("doseLogBtn").addEventListener("click", () => A.confirmDose(false));
    $("doseTodayBtn").addEventListener("click", () => A.confirmDose(true));
    $("doseSnoozeBtn").addEventListener("click", A.snoozeDose);
    $("dosePostponeBtn").addEventListener("click", A.postponeDose);
    $("doseSiteSelect").addEventListener("change", e => A.pickDoseSite(e.target.value));
    onButton($("goalsBody"), "button[data-goal]", btn => {
      const goal = parseFloat(btn.dataset.goal);
      if (!confirm(`Remove the ${goal.toFixed(1)} ${S.unit} goal? This can't be undone.`)) return;
      S.goals = S.goals.filter(g => g !== goal);
      A.save();
      A.renderAll();
    });

    $("oneTimeInfoSaveBtn").addEventListener("click", A.saveOneTimeInfo);
    $("oneTimeInfoCancelBtn").addEventListener("click", () => A.renderOneTimeInfo());

    $("customRate").value = "0"; // some browsers restore the last position on reload
    $("dateInput").value = S.entryDateDefault = todayStr();
    A.renderOneTimeInfo();
    A.renderAll();
  };

  // Every minute, and whenever the page is back in view: a new day, or a dose coming due.
  A.onTick = () => {
    rollOverToday();
    A.renderUpcomingDoses();
  };

  // Enter in an input submits its form row.
  const ENTER_SUBMITS = { dateInput: addEntry, weightInput: addEntry, goalInput: addGoal };
  A.onKeydown = e => {
    if (e.key !== "Enter" || !ENTER_SUBMITS[e.target.id] || !A.root.contains(e.target)) return false;
    e.preventDefault();
    ENTER_SUBMITS[e.target.id]();
    return true;
  };

  // Another tab saved: its data is loaded (A.load); show it, so this tab never asks
  // about a dose already logged there, or saves over it.
  A.onReload = () => {
    if ($("oneTimeInfoCancelBtn").hidden) A.renderOneTimeInfo(); // not while start-up info is being edited
    A.renderAll();
  };

  A.attention = () => (S.doseAsking ? "a dose is waiting to be confirmed" : "");

  // Sites the next dose passes over (null: none), kept and shown at once (Developer Mode too: renderAll).
  function setSkips(list) {
    S.profile.skipSites = list;
    A.save();
    A.renderAll();
  }

  // Developer Mode: start-up info; the next dose's injection site, with a skip for a week it isn't a good
  // one (another press skips the new one too; never the last site left).
  A.renderDev = box => {
    const next = A.doseSchedule()[0], site = next && next.site, skips = S.profile.skipSites || [];
    const canSkip = !!site && A.activeSites().some(id => id !== site && !skips.includes(id));
    box.innerHTML = `<div class="dev-block"><button class="secondary small" id="boscoStartupBtn">Edit start-up info</button></div>
      <div class="dev-block">
        <div class="dev-block-head">Next dose: <strong>${!next ? "no dose scheduled" : site ? siteLabel(site) : "no site (every site is off)"}</strong></div>
        ${skips.length ? `<div class="dev-hint">Skipped: ${skips.map(siteLabel).join("; ")}.</div>` : ""}
        <div class="dev-actions">
          <button class="secondary small" id="boscoSkipBtn"${canSkip ? "" : " disabled"}>Skip this site</button>
          ${skips.length ? `<button class="secondary small" id="boscoUnskipBtn">Undo skips</button>` : ""}
        </div>
        <div class="dev-hint">For when a site isn't a good candidate this week: the next dose goes to that body part's next site. Forgotten once a dose is logged.</div>
      </div>`;
    box.querySelector("#boscoStartupBtn").addEventListener("click", () => {
      K.dev.toggle();
      A.renderOneTimeInfo(true);
      $("oneTimeInfoSection").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    box.querySelector("#boscoSkipBtn").addEventListener("click", () => setSkips(skips.concat(site)));
    if (skips.length) box.querySelector("#boscoUnskipBtn").addEventListener("click", () => setSkips(null));
  };

  // Bug reports leave out every weight, dose, and date.
  A.bugState = () => {
    const med = A.currentMedication(), schedule = A.doseSchedule();
    return [
      `- Unit: ${S.unit}`,
      `- GLP-1 medication: ${med}`,
      `- Start-up asked: medication ${S.profile.medicationAsked ? "yes" : "no"}, dosing v${A.askedVersion(S.profile.dosingAsked)}`,
      `- Dosing plan / active vial saved: ${A.planFor(med) ? "yes" : "no"} / ${A.activeVial() ? "yes" : "no"}`,
      `- Scheduled doses / due: ${schedule.length} / ${schedule.filter(d => d.due).length}`,
      `- Injection sites on: ${A.activeSites().length}${S.profile.sites ? "" : " (default)"}`,
      `- Sites skipped: ${(S.profile.skipSites || []).length}`,
      `- Entry count: ${S.entries.length}`,
      `- Goal count: ${S.goals.length}`,
      `- Rate mode: ${S.rateMode}`,
      `- Pace goal: ${A.fmtPaceGoal(A.paceGoal())} a week${S.profile.paceGoal ? "" : " (default)"}`,
      `- Trend window: ${S.trendWindow}`,
      `- Average window: ${S.avgWindow}`,
      `- History page: ${S.currentPage}`
    ];
  };
})(Kyoshi, Kyoshi.apps.bosco);
