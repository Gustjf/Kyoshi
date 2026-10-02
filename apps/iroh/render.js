/* Iroh · render.js — draws the page from A.S: This season (each open goal with its hours and its progress from
 * Momo's close-outs, its chain, the next step and when it was last reconciled, with Reconcile; then those done or
 * dropped), This year (each goal with its area, done-when, why and season goals), Vision (the areas, each with its
 * pictures and ↑ ↓) and Earlier (past seasons' goals, an open one with Carry over, then past years'). reveal(id)
 * brings a goal into view. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, fmtNum, fmtShort, fmtDate, todayStr } = K.util;
  const { seasonLabel, isOpen, fmtHours } = A;

  const STATUS = { done: "Done ✓", dropped: "Dropped" };
  const titleBtn = (act, id, text) => `<button type="button" class="goal-title" data-act="${act}" data-id="${esc(id)}">${esc(text)}</button>`;
  // A labelled block of text, its line breaks kept (CSS: pre-line).
  const textHTML = (label, text) => (text ? `<div class="goal-text"><span class="goal-label">${label}</span>${esc(text)}</div>` : "");

  // --- This season ---
  // A goal's progress from Momo's close-outs (p: A.progressOf): "22 of 60 h, on pace" or "6 h behind" for hours a
  // week; "22 of 60 h · 38 h to go, 5 h a week to finish" for a total. Nothing without Momo: the plan only.
  function progressHTML(g, p) {
    if (!p) return "";
    const of = `${fmtNum(p.spent)} of ${fmtHours(g.hoursWeek ? g.hoursWeek * p.weeks : g.hoursTotal)}`;
    if (g.hoursWeek) {
      const behind = A.behindBy(g, p);
      return `<div class="goal-progress${behind ? " behind" : ""}">${esc(behind ? `${of}, ${fmtHours(behind)} behind` : `${of}, on pace`)}</div>`;
    }
    const left = g.hoursTotal - p.spent;
    return left <= 0 ? `<div class="goal-progress reached">${esc(`${of} · reached ✓`)}</div>`
      : `<div class="goal-progress">${esc(`${of} · ${fmtHours(left)} to go${p.left ? `, ${fmtHours(A.weeklyMinutes(g, p) / 60)} a week to finish` : ""}`)}</div>`;
  }

  // An open goal: its title (its pop-up) and hours with its progress, where it leads, the next step, and when it
  // was last reconciled.
  function seasonGoalHTML(g, today) {
    const chain = A.chainOf(g), p = g.hoursWeek || g.hoursTotal ? A.progressOf(g) : null;
    const hours = p && g.hoursTotal ? `${fmtHours(g.hoursTotal)} in total` : A.hoursText(g); // the progress says what a week
    return `<li class="goal" data-id="${esc(g.id)}"><div class="goal-head">${titleBtn("edit", g.id, g.title)}` +
      (hours ? `<span class="goal-hours">${esc(hours)}</span>` : "") + `</div>` + progressHTML(g, p) +
      (chain ? `<div class="goal-chain">${esc(chain)}</div>` : "") +
      `<div class="goal-next${g.next ? "" : " none"}">${g.next ? `Next: ${esc(g.next)}` : "No next step yet"}</div>` +
      `<div class="goal-rec${A.isStale(g, today) ? " stale" : ""}"><span>${g.reconciled ? `Reconciled ${A.ago(g.reconciled, today)}` : "Not reconciled yet"}</span>` +
      `<button type="button" class="secondary small" data-act="reconcile" data-id="${esc(g.id)}">Reconcile</button></div></li>`;
  }
  // One done or dropped: its title (its pop-up, to reopen it) and how it ended.
  const closedHTML = g => `<li class="goal closed ${g.status}" data-id="${esc(g.id)}"><div class="goal-head">${titleBtn("edit", g.id, g.title)}` +
    `<span class="goal-status">${STATUS[g.status]}</span></div></li>`;

  function renderSeason(today) {
    const key = A.currentSeason(), goals = A.goalsIn(key), weeks = A.weeksOf(key), n = weeks.indexOf(A.mondayOf(today)) + 1;
    const titles = new Set(goals.map(g => g.title.toLowerCase()));
    const carry = A.liveGoals().some(g => A.isSeason(g.period) && A.isPast(g.period) && isOpen(g) && !titles.has(g.title.toLowerCase()));
    $("seasonName").textContent = seasonLabel(key);
    $("seasonMeta").textContent = `${fmtShort(A.startOf(key))} – ${fmtShort(A.endOf(key))} · ${n ? `week ${n} of ${weeks.length}` : `${weeks.length} weeks`}`;
    $("seasonEmpty").hidden = goals.length > 0;
    $("seasonEmpty").textContent = `Nothing for ${seasonLabel(key)} yet. Add what you'll work on this season${carry ? ", or carry a goal over from Earlier" : ""}.`;
    $("seasonGoals").innerHTML = goals.filter(isOpen).map(g => seasonGoalHTML(g, today)).join("") + goals.filter(g => !isOpen(g)).map(closedHTML).join("");
  }

  // --- This year ---
  // A goal: its title and area (or how it ended), done when, why, and its season goals.
  function yearGoalHTML(g) {
    const area = A.areaOf(g), kids = A.childrenOf(g.id), open = isOpen(g);
    return `<li class="goal${open ? "" : ` closed ${g.status}`}" data-id="${esc(g.id)}"><div class="goal-head">${titleBtn("edit", g.id, g.title)}` +
      (open ? (area ? `<span class="goal-area">${esc(area.name)}</span>` : "") : `<span class="goal-status">${STATUS[g.status]}</span>`) + `</div>` +
      textHTML("Done when", g.doneWhen) + textHTML("Why", g.why) +
      (kids.length ? `<ul class="goal-kids">${kids.map(k => `<li${isOpen(k) ? "" : ` class="${k.status}"`}><span class="kid-season">${esc(seasonLabel(k.period))}</span> ${esc(k.title)}` +
        `${isOpen(k) ? "" : ` · ${STATUS[k.status]}`}</li>`).join("")}</ul>` : open ? `<div class="goal-kids none">No season goals for it yet.</div>` : "") + `</li>`;
  }

  function renderYear() {
    const year = A.thisYear(), goals = A.goalsIn(year);
    $("yearName").textContent = year;
    $("yearMeta").textContent = `${fmtDate(A.startOf(`${year}-winter`))} – ${fmtDate(A.endOf(`${year}-fall`))} (winter to fall)`;
    $("yearEmpty").hidden = goals.length > 0;
    $("yearGoals").innerHTML = goals.filter(isOpen).concat(goals.filter(g => !isOpen(g))).map(yearGoalHTML).join("");
  }

  // --- Vision ---
  // An area: its name (its pop-up), ↑ ↓, and its pictures in 10 and 5 years.
  function areaHTML(a, i, n) {
    const move = (act, label, ok) => `<button type="button" class="secondary small" data-act="${act}" data-id="${esc(a.id)}" title="Move ${label}" aria-label="Move ${esc(a.name)} ${label}"${ok ? "" : " disabled"}>${label === "up" ? "↑" : "↓"}</button>`;
    return `<li class="area" data-id="${esc(a.id)}"><div class="goal-head">${titleBtn("area-edit", a.id, a.name)}` +
      `<span class="area-moves">${move("area-up", "up", i > 0)}${move("area-down", "down", i < n - 1)}</span></div>` +
      textHTML("In 10 years", a.vision) + textHTML("In 5 years", a.milestones) +
      (a.vision || a.milestones ? "" : `<div class="goal-text none">Tap its name to write where it's headed.</div>`) + `</li>`;
  }

  function renderVision() {
    const areas = A.liveAreas();
    $("visionEmpty").hidden = areas.length > 0;
    $("areaList").innerHTML = areas.map((a, i) => areaHTML(a, i, areas.length)).join("");
  }

  // --- Earlier ---
  // A past goal: its title, hours and how it ended; an open season goal can be carried over into this season,
  // until this season has a goal with its title.
  function pastHTML(g, titles) {
    const season = A.isSeason(g.period), open = isOpen(g);
    const end = !season || !open ? "" : titles.has(g.title.toLowerCase()) ? `<span class="carried">Carried over ✓</span>`
      : `<button type="button" class="secondary small" data-act="carry" data-id="${esc(g.id)}">Carry over</button>`;
    const meta = [season ? A.hoursText(g) : "", open ? "" : STATUS[g.status]].filter(Boolean).join(" · ");
    return `<li class="goal past${open ? "" : ` closed ${g.status}`}" data-id="${esc(g.id)}"><div class="goal-head">${titleBtn("edit", g.id, g.title)}` +
      (meta ? `<span class="goal-meta">${esc(meta)}</span>` : "") + (end ? `<span class="past-end">${end}</span>` : "") + `</div></li>`;
  }

  // Past seasons, newest first, then past years.
  function renderEarlier() {
    const goals = A.liveGoals().filter(g => A.isPast(g.period)), periods = [...new Set(goals.map(g => g.period))];
    const titles = new Set(A.goalsIn(A.currentSeason()).map(g => g.title.toLowerCase()));
    $("earlierSection").hidden = !goals.length;
    $("earlierCount").textContent = goals.length ? `(${goals.length})` : "";
    $("earlierList").innerHTML = periods.filter(A.isSeason).sort((a, b) => A.startOf(b).localeCompare(A.startOf(a)))
      .concat(periods.filter(A.isYear).sort((a, b) => b - a))
      .map(p => `<div class="period"><h3>${esc(A.isSeason(p) ? seasonLabel(p) : `${p} (year goals)`)}</h3><ul class="goals">${A.goalsIn(p).map(g => pastHTML(g, titles)).join("")}</ul></div>`).join("");
  }

  // Momo's hours for this season's open goals with hours (those that show progress), to notice a close-out
  // changing them (events.js).
  const progressKey = () => JSON.stringify(A.goalsIn(A.currentSeason()).filter(g => isOpen(g) && (g.hoursWeek || g.hoursTotal)).map(A.progressOf));

  function renderAll() {
    const today = S.knownToday = todayStr();
    S.progressKey = progressKey();
    renderSeason(today);
    renderYear();
    renderVision();
    renderEarlier();
  }

  // A goal comes into view and flashes (Earlier opens first if that's where it is).
  function reveal(id) {
    const row = A.root.querySelector(`.goal[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    const box = row.closest("details");
    if (box) box.open = true;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("flash");
    void row.offsetWidth; // so the flash starts again
    row.classList.add("flash");
  }

  Object.assign(A, { progressKey, renderAll, reveal });
})(Kyoshi, Kyoshi.apps.iroh);
