/* Bosco · render.js — draws the page from A.S: renderAll, then History, Upcoming Doses,
 * Current Trend, Goal Weights (with season projections) and the Chart. The start-up
 * section is setup.js; the dose pop-up is doses.js. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isPos, mean, daysBetween, addDays, todayStr, fmtDate, fmtShort, fmtWeekday, fmtNum, fmtSigned, SEP } = K.util;
  const { PAGE_SIZE, MEDICATIONS, TREND_MIN_WEIGHINS, hasWeight, hasDose, otherMedNote, fmtDateBrief, fmtConc, fmtUnits, siteLabel, siteShort, weightRange, axisDates } = A;

  function renderAll() {
    const m = A.model();
    A.root.classList.toggle("no-med", !A.medicationEnabled());
    if (A.medicationEnabled()) {
      const med = MEDICATIONS[A.currentMedication()];
      $("upcomingDosesTitle").textContent = `Upcoming ${med.label} Doses`;
      $("doseColumnHead").textContent = `${med.label} Dose`;
    }
    A.setSubtitle(`${S.profile.name ? `${S.profile.name}'s weight tracker with projections.` : "A weight tracker with projections."} Runs 100% locally, private & offline.`);
    $("weightInputLabel").textContent = `Weight, ${S.unit}`;
    $("weightInput").placeholder = S.unit === "kg" ? "e.g. 84.1" : "e.g. 185.4";
    $("goalInput").placeholder = S.unit === "kg" ? "e.g. 68" : "e.g. 150";
    const custom = A.customRate();
    $("customRateValue").textContent = `${custom > 0 ? "+" : ""}${custom}%`;
    renderHistory(m);
    renderUpcomingDoses();
    renderStats(m);
    renderGoals(m);
    renderChart(m);
    A.refreshDev(); // the next dose's site in Developer Mode
  }

  function renderHistory({ w, dir }) {
    const today = todayStr(), unit = S.unit;
    // Dose-only days are listed only while dose tracking is on, and never ahead
    // of today (upcoming doses aren't logged until they're taken).
    const visible = S.entries.filter(e => hasWeight(e) || (A.medicationEnabled() && e.date <= today)).reverse();
    $("historyWrap").hidden = !visible.length;
    $("historyEmpty").hidden = visible.length > 0;
    $("trackedSpanNote").textContent = w.length < 2 ? "" :
      `Tracked span: ${(daysBetween(w[0].date, w[w.length - 1].date) / 30.44).toFixed(1)} mo (${fmtDate(w[0].date)} – ${fmtDate(w[w.length - 1].date)})`;
    if (!visible.length) return;

    const pages = Math.ceil(visible.length / PAGE_SIZE);
    S.currentPage = Math.min(Math.max(S.currentPage, 1), pages);
    const prevWeight = new Map(w.map((e, i) => [e.date, i ? w[i - 1].weight : null])); // change vs last weigh-in
    $("historyBody").innerHTML = visible.slice((S.currentPage - 1) * PAGE_SIZE, S.currentPage * PAGE_SIZE).map(e => {
      const prev = hasWeight(e) ? prevWeight.get(e.date) : null;
      const change = prev === null ? null : Math.round((e.weight - prev) * 10) / 10; // as displayed
      const cls = change ? ((dir === "gain") === (change > 0) ? "good" : "bad") : "";
      return `<tr>
        <td>${fmtDate(e.date)}</td>
        <td>${hasWeight(e) ? `${e.weight.toFixed(1)} ${unit}` : "&mdash;"}</td>
        <td class="${cls}">${change === null ? "&mdash;" : `${change > 0 ? "+" : ""}${change.toFixed(1)} ${unit}`}</td>
        <td class="med">${hasDose(e) ? `${e.doseMg} mg${otherMedNote(e)}${e.site ? `${SEP}${siteShort(e.site)}` : ""}` : "&mdash;"}</td>
        <td><button class="danger" data-date="${e.date}">Delete</button></td>
      </tr>`;
    }).join("");
    $("pageInfo").textContent = `Page ${S.currentPage} of ${pages} (${visible.length} entries)`;
    $("prevPageBtn").disabled = S.currentPage === 1;
    $("nextPageBtn").disabled = S.currentPage === pages;
  }

  // The saved vial's concentration (or nothing without one), shown beside the
  // doses whose syringe units come from it, to check against the vial in hand.
  function showVialBadge(id, vial) {
    $(id).innerHTML = vial ? `<span>Vial</span> ${fmtConc(vial.mgPerMl)}` : "";
    $(id).hidden = !vial;
  }

  function renderUpcomingDoses() {
    const today = todayStr(), schedule = A.doseSchedule();
    const past = S.entries.filter(e => e.date <= today);
    // History's first page only shows the latest entries; if none of those has
    // a dose, show the last one taken so it's never out of sight.
    const last = past.slice(-PAGE_SIZE).some(hasDose) ? null : past.filter(hasDose).pop();
    // Scheduled doses are all of the current medication, so drawn from its active vial.
    const vial = A.activeVial();
    const units = mg => (vial ? `${SEP}<strong>${fmtUnits(mg, vial.mgPerMl)}</strong>` : "");
    const site = s => (s ? `<div class="lbl site"><span>${siteLabel(s)}</span></div>` : ""); // where it goes, or went
    showVialBadge("upcomingVialBadge", schedule.length ? vial : null);
    // A plan with no dose taken or set has nothing to count from.
    const plan = A.medicationEnabled() && A.planFor(A.currentMedication());
    const waiting = !!(plan && plan.intervalDays && plan.weeklyMg) && !schedule.length;
    $("upcomingDosesSection").hidden = !schedule.length && !last && !waiting;
    $("upcomingDosesGrid").innerHTML =
      (last ? `<div class="stat"><div class="val">${last.doseMg} mg</div><div class="lbl">Last dose taken${otherMedNote(last)}${SEP}<span>${fmtDateBrief(last.date)}</span></div>${site(last.site)}</div>` : "") +
      // Upcoming doses lead with the weekday, the day you dose on, then the date,
      // the dose itself and its weekly equivalent, then where it goes. Due ones wait to be confirmed.
      schedule.map(d => `<div class="stat${d.due ? " due" : ""}">
        <div class="val">${fmtWeekday(d.date)}</div><div class="lbl"><span>${fmtDateBrief(d.date)}</span></div>
        <div class="dose">${d.doseMg} mg${units(d.doseMg)}</div><div class="lbl"><span>${d.weeklyMg} mg a week</span></div>${site(d.site)}
        ${d.due ? `<button class="small" data-confirm-dose="${d.date}">Confirm dose</button>` : ""}
      </div>`).join("") +
      (waiting ? `<div class="empty-msg">No dose to count from yet. <button class="secondary small" data-set-anchor>Set anchor dose</button></div>` : "");
    A.promptDueDose(schedule.filter(d => d.due));
  }

  function renderStats({ w, trend }) {
    const unit = S.unit;
    $("statsSection").hidden = w.length < 2;
    if (w.length < 2) return;
    const rateEl = $("statRate"), goal = `Goal: ${A.fmtPaceGoal(A.paceGoal())} per week`;
    if (!trend) {
      rateEl.textContent = "n/a";
      rateEl.className = "val";
      $("statRateNote").textContent = `Needs ${TREND_MIN_WEIGHINS}+ weigh-ins in each week compared`;
      $("statPace").textContent = goal;
    } else {
      // The % and the weight a week it comes to, colored by where it stands against the pace goal,
      // then the two 7-day averages it comes from.
      const [status, cls] = A.PACE_STATUS[A.paceStatus(trend.rate)];
      rateEl.innerHTML = `${fmtSigned(-trend.rate * 100, 2)}%/wk${SEP}<span class="rate-lb">${fmtSigned(trend.perWeek, 1)} ${unit}/wk</span>`;
      rateEl.className = `val ${cls}`;
      $("statRateNote").textContent = `${trend.then.toFixed(1)} → ${trend.now.toFixed(1)} ${unit} over ${fmtNum(trend.apart, 1)} days`;
      $("statPace").innerHTML = `<strong class="${cls}">${status}</strong>${SEP}${goal}`;
    }
    // An N-day average covers the latest weigh-in's day and the N-1 days before it.
    $("statAvg").textContent = `${mean(A.lastDays(w, +S.avgWindow - 1).map(e => e.weight)).toFixed(1)} ${unit}`;
    $("statAvgLabel").textContent = `${S.avgWindow}-day rolling avg`;
  }

  // Goals go by the 7-day averages (wa): reached once the average passes one, and the ETAs and the
  // projections start from the latest average.
  function renderGoals({ w, wa, trend, rate, goals: sorted }) {
    const unit = S.unit;
    $("goalsSection").hidden = !w.length;
    if (!w.length) return;
    const last = wa[wa.length - 1];
    $("goalsRateNote").textContent = S.rateMode === "custom" ? "Using the custom weekly rate above."
      : trend ? `Using the ${S.trendWindow}d weekly rate from Current Trend (set above).`
      : `Current Trend has no ${S.trendWindow}d weekly rate yet, so there's nothing to project from.`;

    // Projected weight at the selected rate a month (4 weeks) out, then at the
    // start of each of the next three seasons.
    const horizons = [{ label: "1 mo", date: addDays(last.date, 28) }, ...K.seasons.nextSeasons(3)];
    $("futureWeightGrid").innerHTML = horizons.map(({ label, date }) => {
      const v = last.weight * Math.pow(1 - rate, daysBetween(last.date, date) / 7);
      return `<div class="stat">
        <div class="val">${isPos(v) ? `${v.toFixed(1)} ${unit}` : "&mdash;"}</div>
        <div class="lbl">${label}${isPos(v) ? `${SEP}${fmtShort(date)}` : ""}</div>
      </div>`;
    }).join("");

    $("goalsBody").innerHTML = !sorted.length
      ? `<tr><td colspan="4" class="empty-msg">No goals added yet.</td></tr>`
      : sorted.map(g => {
        const s = A.goalStatus(g, wa, rate);
        const [label, eta] =
          s.status === "reached" ? ["Reached", fmtDate(s.date)] :
          s.status === "projected" ? ["In progress", `${s.weeks.toFixed(1)} wks (${fmtDate(s.date)})`] :
          s.status === "flat" ? ["Flat rate", "Requires active rate"] :
          ["Wrong direction", "Moving away"];
        return `<tr>
          <td>${g.toFixed(1)} ${unit}</td>
          <td><span class="badge ${s.status}">${label}</span></td>
          <td>${eta}</td>
          <td><button class="danger" data-goal="${g}">Remove</button></td>
        </tr>`;
      }).join("");
  }

  // Weigh-in history plus lines for goals not yet reached (by the 7-day averages, wa), as inline SVG.
  function renderChart({ w, wa }) {
    $("chartSection").hidden = !w.length;
    if (!w.length) return;
    const W = 640, H = 320, padL = 45, padR = 20, padT = 20, padB = 35;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const active = S.goals.filter(g => !A.reachedDate(g, wa));
    const [min, max] = weightRange(w.map(e => e.weight).concat(active), 0.1);
    const first = w[0].date, span = daysBetween(first, w[w.length - 1].date);
    const x = d => padL + (span ? daysBetween(first, d) / span : 0.5) * innerW; // a single day sits mid-chart
    const y = v => padT + (1 - (v - min) / (max - min)) * innerH;

    const parts = [];
    for (let i = 0; i <= 4; i++) {
      const v = min + i / 4 * (max - min), yy = y(v);
      parts.push(`<line class="grid" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/><text x="${padL - 6}" y="${yy + 3}" text-anchor="end">${v.toFixed(0)}</text>`);
    }
    const dates = axisDates(first, span);
    dates.forEach((d, i) => {
      const anchor = !span ? "middle" : i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle";
      parts.push(`<text x="${x(d)}" y="${H - 10}" text-anchor="${anchor}">${fmtDate(d)}</text>`);
    });
    active.forEach(g => parts.push(`<line class="goal" x1="${padL}" y1="${y(g).toFixed(1)}" x2="${W - padR}" y2="${y(g).toFixed(1)}"/>`));
    const pts = w.map(e => [x(e.date).toFixed(1), y(e.weight).toFixed(1)]);
    parts.push(`<path class="line" d="M${pts.map(p => p.join(",")).join(" L")}"/>`);
    pts.forEach(([cx, cy]) => parts.push(`<circle cx="${cx}" cy="${cy}" r="2.5"/>`));
    // Goal tags go on top, hanging off the side of their line away from the latest
    // 7-day average, where the recent data isn't.
    const right = W - padR - 4, current = wa[wa.length - 1].weight;
    active.forEach(g => {
      const label = `Goal: ${+g.toFixed(1)} ${S.unit}`, tagW = label.length * 5 + 4;
      const top = g < current ? y(g) + 2 : y(g) - 18;
      parts.push(`<rect class="goal-tag" x="${right - tagW}" y="${top.toFixed(1)}" width="${tagW}" height="16" rx="4"/>`,
        `<text class="goal-label" x="${right - tagW / 2}" y="${(top + 11).toFixed(1)}" text-anchor="middle">${label}</text>`);
    });
    $("chartSvg").innerHTML = parts.join("");
  }

  Object.assign(A, { renderAll, renderHistory, showVialBadge, renderUpcomingDoses, renderStats, renderGoals, renderChart });
})(Kyoshi, Kyoshi.apps.bosco);
