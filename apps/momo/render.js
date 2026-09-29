/* Momo · render.js — draws the board on screen from A.S: renderAll, then the week tabs,
 * the To Be Budgeted bank (with Tasks, see tasks.js), the board's days and cards (sized to the
 * ruler, see times.js; other apps' events over them, see agenda.js), and the long-term goals. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { sum, esc, addDays, todayStr, fmtDate, fmtShort, fmtNum } = K.util;
  const { DAY_HOURS, DAYS, DAY_NAMES, DAY_LONG, STEP, POSITION_TEXT, fmtH, fmtPct, fmtClock, fmtWeek, dayIndex, thisWeekKey, nextWeekKey } = A;

  function renderAll() {
    if (S.press || S.drag || S.resize) { S.renderPending = true; return; } // redrawn once the pointer lets go
    S.renderPending = false;
    if (A.ensureColors()) A.save({ undo: false }); // a new week on screen can bring titles without one
    const key = A.shownKey(), list = A.shownList();
    S.agenda = A.weekAgenda(key, list); // other apps' events on this board (agenda.js)
    S.agendaKey = A.agendaKey();
    renderTabs();
    renderBank(list, key);
    renderBoard(list, key);
    renderGoals(list, key);
    A.renderCloseOutControls();
    A.refreshDev(); // the undo count in Developer Mode
    A.paintClip();
  }

  function renderTabs() {
    [["this", thisWeekKey()], ["next", nextWeekKey()]].forEach(([v, k]) => {
      const w = A.weekOf(k), b = A.budgetOf(w, k), clashes = A.weekAgenda(k, w).filter(ev => ev.flag).length;
      const [text, cls] = w.closed ? ["closed out ✓", "good"]
        : clashes ? [`${clashes} conflict${clashes === 1 ? "" : "s"}`, "bad"]
        : b.over.length ? [`${fmtH(sum(b.over.map(o => o.by)))} over`, "bad"]
        : !w.cards.length ? ["not planned yet", ""]
        : b.free === 0 ? ["all assigned ✓", "good"]
        : [`${fmtH(b.free)} left`, ""];
      $(`tabDate_${v}`).textContent = fmtWeek(k);
      $(`tabStatus_${v}`).textContent = text;
      $(`tabStatus_${v}`).className = `vb-status ${cls}`;
    });
    const fixed = sum(S.data.baseline.cards.map(c => c.hours));
    $("tabDate_base").textContent = "your default week";
    $("tabStatus_base").textContent = fixed ? `${fmtPct(fixed)} fixed` : "not set up yet";
    $("tabStatus_base").className = "vb-status";
    A.root.querySelectorAll("#viewToggle .mode-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === S.view));
  }

  function renderBank(list, key) {
    const isBase = key === "base", locked = !isBase && list.closed;
    const b = A.budgetOf(list, key);
    const onDays = list.cards.some(c => c.day !== null);
    // Like YNAB's Ready to Assign: green while there are hours to give a job. An
    // overbooked day doesn't change the number; it gets its own red line below.
    $("bank").classList.toggle("pos", !locked && b.free > 0);
    $("bankLabel").textContent = isBase ? "Baseline" : locked ? "Closed out" : "To Be Budgeted";
    $("bankLine").hidden = locked;
    $("bankNum").textContent = fmtH(b.free);
    $("bankOf").textContent = isBase ? `left for everything else · ${fmtPct(sum(b.totals))} of the week fixed`
      : b.first ? `of ${b.pool}h left this week` : `of ${b.pool}h`;

    // An event's conflict comes first: it's often why a day is over, and its quick fix balances it.
    let msg, cls = "", late, clashes;
    if (locked) {
      msg = "This week is closed out ✓ — its goal hours are logged and the rest is let go.";
      cls = "good";
    } else if ((clashes = S.agenda.filter(ev => ev.flag)).length) {
      cls = "bad";
      msg = A.conflictMsg(key, clashes);
    } else if (b.over.length) {
      cls = "bad";
      msg = b.over.length === 1
        ? `${DAY_LONG[b.over[0].d]} is overbooked by ${fmtH(b.over[0].by)} — move or trim a card to balance it.`
        : `Overbooked: ${b.over.map(o => `${DAY_NAMES[o.d]} by ${fmtH(o.by)}`).join(", ")} — move or trim cards to balance them.`;
    } else if ((late = A.timeTrouble(list, b.days)).length) {
      cls = "bad";
      msg = late.length === 1
        ? `${DAY_LONG[late[0]]}'s cards don't fit around its pinned times — move one into free time or trim it.`
        : `The cards on ${late.map(d => DAY_NAMES[d]).join(", ")} don't fit around their pinned times — move some into free time or trim them.`;
    } else if (isBase) {
      msg = onDays ? "The hours that come around every week. Load them into any week with one click; what's left is yours to budget."
        : "Your default week: sleep, work, meals — the hours that come around every week. Build it once, then load it into any week with one click.";
    } else if (!list.cards.length) {
      msg = S.data.baseline.cards.length ? "Start with your baseline: one click funds the fixed hours, then give the rest a job."
        : "Start by setting up your baseline: the fixed hours of a typical week.";
    } else if (b.free === 0) {
      msg = "Every hour has a job ✓";
      cls = "good";
    } else {
      msg = "Give every remaining hour a job — even if the job is rest.";
    }
    $("bankMsg").textContent = msg;
    $("bankMsg").className = `bank-msg ${cls}`;

    const hasBaseline = S.data.baseline.cards.length > 0, baseLoaded = list.cards.some(c => c.base);
    $("loadBaselineBtn").hidden = isBase || locked || !hasBaseline;
    $("loadBaselineBtn").textContent = baseLoaded ? "Reload baseline" : "Load baseline";
    $("loadBaselineBtn").classList.toggle("secondary", baseLoaded);
    $("gotoBaselineBtn").hidden = isBase || locked || hasBaseline;
    $("sampleBaselineBtn").hidden = !isBase || list.cards.length > 0;
    $("fillGapsBtn").hidden = isBase || locked || !onDays || b.free === 0;
    $("reopenBtn").hidden = !locked;
    $("copyPrevBtn").hidden = isBase || locked || !A.weekOf(addDays(key, -7)).cards.length;
    $("saveAsBaseBtn").hidden = isBase || !onDays;
    $("clearBtn").hidden = locked || !list.cards.length;
    $("clearBtn").textContent = isBase ? "Clear baseline" : "Clear week";
    A.renderTasks(list, key, b);
  }

  // A card with cards inside it is one block, sized to all of their hours:
  // those at the top, its own part (which takes the clicks, so buttons aren't
  // nested), those in the middle with the rest of its own part below them, and
  // those at the bottom. Its own part is resized from its lower edge. On a
  // day each card shows when it starts (times, from startTimes), one on its
  // own has a pin, and each piece is sized to the ruler (styles, from
  // pieceStyles).
  function cardHTML(list, c, times = null, styles = null) {
    const g = A.goalById(c.goalId), inner = A.innerCards(list, c);
    const parent = c.parentId && list.cards.find(p => p.id === c.parentId);
    const when = times && times.get(c.id), pin = !!when && !parent && A.pinned(c);
    const label = `${c.title}, ${fmtH(c.hours)}${g ? `, goal: ${g.name}` : ""}` +
      (inner.length ? ` + ${inner.map(x => `${x.title} ${fmtH(x.hours)}`).join(" + ")} = ${fmtH(A.blockHours(list, c))}` : parent ? `, ${POSITION_TEXT[c.pos]} ${parent.title}` : "") +
      (!when ? "" : `, ${pin ? `pinned at ${fmtClock(c.pin)}` : `from ${fmtClock(when.at)}`}${when.clash ? ` — the cards above run ${fmtH(when.clash)} into it` : when.at >= DAY_HOURS ? " — past midnight" : ""}`);
    const button = `role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}"`;
    const own = `<span class="card-title">${esc(c.title)}</span>` + (when ? timeHTML(c, when, !parent) : "") + `<span class="card-hours">${fmtH(c.hours)}</span>`;
    const grip = c.day === null ? "" : `<span class="grip" aria-hidden="true"></span>`;
    const at = pos => inner.filter(x => x.pos === pos).map(x => cardHTML(list, x, times, styles)).join("");
    const mid = at("middle"), size = key => (styles ? `${styles.get(key)};` : "");
    return `<div class="card${g ? " is-goal" : ""}${inner.length ? " has-inner" : ""}${parent ? " inner" : ""}${pin ? " pinned" : ""}${when && when.clash ? " clashing" : ""}${c.day === null ? " parked" : ""}" data-id="${esc(c.id)}"${parent ? ` data-pos="${c.pos}"` : ""}${inner.length ? "" : ` ${button}`} style="${size(c.id)}--c:${A.cardColor(c)}">` +
      (inner.length ? `${at("top")}<div class="card-own" style="${size(`own:${c.id}`)}" ${button}>${own}${mid ? "" : grip}</div>` +
        (mid ? `${mid}<div class="card-own card-rest" style="${size(`rest:${c.id}`)}" aria-hidden="true">${grip}</div>` : "") + at("bottom") : own + grip) + `</div>`;
  }

  // When a card starts, then its pin if it's on its own: filled while
  // pinned, else there to pin it where it is.
  function timeHTML(c, when, canPin) {
    const tip = A.pinned(c) ? `Pinned at ${fmtClock(c.pin)} — unpin` : `Pin at ${fmtClock(Math.min(DAY_HOURS - STEP, when.at))}`;
    const pin = canPin ? `<span class="pin${A.pinned(c) ? " on" : ""}" title="${tip}" aria-hidden="true"><svg class="pin-icon" viewBox="0 0 24 24"><use href="#i-pin"/></svg></span>` : "";
    return `<span class="card-time${when.clash || when.at >= DAY_HOURS ? " clash" : ""}"><span class="clock">${fmtClock(when.at)}</span>${pin}</span>`;
  }

  // Free time on a day, sized to the ruler (style) and saying how much it is:
  // before the pinned card beforeId, else after the day's last card. Clicking
  // it adds a card there; it's the only place on a day that does. A plain
  // spacer on a closed week. The last free time on a day fills the rest of it
  // (last: not when an event splits it and this isn't its last part).
  function freeHTML(d, hours, beforeId, locked, style, last = true) {
    const attrs = `class="free ${beforeId || !last ? "gap" : "end"}"${beforeId ? ` data-before="${esc(beforeId)}"` : ""} style="${style}"`;
    return locked ? `<div ${attrs}></div>` : `<button type="button" ${attrs} data-add-day="${d}" data-h="${hours}" aria-label="Add a card in ${fmtH(hours)} free">+ ${fmtH(hours)} free</button>`;
  }

  // What comes after a day's last card: the free time left before midnight,
  // nothing when that card runs to midnight, or how far over the day is — its
  // hours past 24, else how far its cards run past midnight (just a label).
  function endHTML(d, room, total, style) {
    if (room > 0) return freeHTML(d, room, null, false, style);
    if (room === 0) return "";
    return `<div class="free over">${total > DAY_HOURS ? `${fmtH(total - DAY_HOURS)} over` : `${fmtH(-room)} past midnight`}</div>`;
  }

  function renderBoard(list, key) {
    const isBase = key === "base", locked = !isBase && list.closed;
    const today = key === thisWeekKey() ? dayIndex(todayStr()) : -1;
    const { totals } = A.budgetOf(list, key);
    const plans = DAYS.map(d => dayPlan(list, d, locked));
    S.ruler = A.makeRuler(plans.flatMap(p => p.pieces.concat(p.extra)));
    $("board").classList.toggle("locked", locked);
    $("board").innerHTML = DAYS.map(d => {
      const total = totals[d];
      const cls = ["col", total > DAY_HOURS ? "over" : total === DAY_HOURS ? "full" : "", d === today ? "today" : "", d < today ? "past" : ""].filter(Boolean).join(" ");
      const date = isBase ? "" : d === today ? "Today" : fmtShort(addDays(key, d));
      return `<div class="${cls}" data-day="${d}" data-total="${total}">
        <div class="col-head">
          <div class="col-day"><span>${DAY_NAMES[d]}</span>${A.headEventsHTML(d, locked)}<span class="col-date">${date}</span></div>
          <div class="col-total">Total: <span class="col-sum">${fmtNum(total)}</span>/24</div>
          <div class="col-bar"><span style="width:${Math.min(100, total / DAY_HOURS * 100)}%"></span></div>
        </div>
        <div class="col-body">${dayHTML(list, d, plans[d], total, locked)}</div>
      </div>`;
    }).join("");
  }

  // What the board needs to draw a day: its schedule, when each card starts,
  // its pieces for the ruler, and other apps' events there (agenda.js
  // layEvents: pieces of their own in free time, else drawn over the day).
  function dayPlan(list, d, locked) {
    const { rows, end } = A.daySchedule(list, d), times = A.startTimes(list, rows);
    return A.layEvents({ rows, end, times, pieces: A.dayPieces(list, rows, times, end, locked) }, list, d, locked);
  }

  // A day's cards and free time, sized to the ruler — free time with an event
  // in it drawn in parts around the event — then the events drawn over the day.
  function dayHTML(list, d, plan, total, locked) {
    const { rows, end, times, regions } = plan, styles = A.pushLines(A.pieceStyles(plan.pieces), plan.pushes);
    const free = (key, hours, beforeId) => (!regions.has(key) ? freeHTML(d, hours, beforeId, locked, styles.get(key))
      : regions.get(key).map((p, i, all) => (p.ev ? A.eventHTML(p.ev, locked, styles.get(p.key)) : freeHTML(d, p.e - p.s, beforeId, locked, styles.get(p.key), i === all.length - 1))).join(""));
    return rows.map(r => (r.gap ? free(`gap:${r.card.id}`, r.gap, r.card.id) : "") + cardHTML(list, r.card, times, styles)).join("") +
      (regions.has("end") ? free("end", DAY_HOURS - end, null) : locked ? "" : endHTML(d, DAY_HOURS - end, total, styles.get("end"))) + A.overlaysHTML(plan, locked);
  }

  function renderGoals(list, key) {
    const goals = A.liveGoals().sort((a, b) => A.isReached(a) - A.isReached(b)); // reached ones last
    $("goalsEmpty").hidden = goals.length > 0;
    const label = key === "base" ? "Baseline" : S.view === "this" ? "This week" : "Next week";
    const needKey = key === "base" ? nextWeekKey() : key; // the baseline is judged by next week's need
    const openWeeks = Object.values(S.data.weeks).filter(w => !w.closed);
    // A goal in hours a week counts what's on the board (what was logged, once
    // closed out), and can still get the hours left to budget (none once closed).
    const closed = key !== "base" && list.closed, room = closed ? 0 : A.budgetOf(list, key).free;
    $("goalsList").innerHTML = goals.map(g => {
      if (A.isWeekly(g)) return weeklyGoalHTML(g, closed ? g.log[key] || 0 : A.plannedFor(list, g.id), room, label, closed);
      const done = A.goalDone(g), planned = A.plannedFor(list, g.id);
      // The bar: solid for hours done, lighter for hours planned in weeks not closed out yet.
      const pending = sum(openWeeks.map(w => A.plannedFor(w, g.id)));
      const donePct = Math.min(100, done / g.target * 100);
      const planPct = Math.max(0, Math.min(100 - donePct, pending / g.target * 100));
      let meta, badge, overMax = false;
      if (A.isReached(g)) {
        meta = `${fmtH(done)} done`;
        badge = `<span class="badge reached">Reached</span>`;
      } else {
        meta = `${fmtH(g.target - done)} to go`;
        const need = A.weeklyNeed(g, needKey);
        if (need === null) {
          badge = `<span class="badge plain">${label}: ${fmtH(planned)}</span>`;
        } else {
          meta += A.weeksLeft(g, needKey) > 0 ? ` · needs ${fmtH(need)}/wk to finish by ${fmtDate(g.due)}` : ` · the finish-by date (${fmtDate(g.due)}) has passed`;
          // Red: staying on time takes more than its most hours a week, and this
          // week doesn't have the extra sessions scheduled yet.
          overMax = need > g.maxWeek && planned < need;
          if (overMax) meta += ` — more than your ${fmtH(g.maxWeek)}/wk`;
          badge = planned >= need
            ? `<span class="badge funded">${label}: ${fmtH(planned)} · Funded</span>`
            : `<span class="badge ${overMax ? "over" : "under"}">${label}: ${fmtH(planned)} · ${fmtH(need - planned)} short</span>`;
        }
      }
      return `<div class="goal${overMax ? " off-track" : ""}" data-goal-id="${esc(g.id)}" role="button" tabindex="0" style="--c:${A.keyColor(A.goalKey(g.id))}">
        <div class="goal-top"><span class="goal-dot"></span><span class="goal-name">${esc(g.name)}</span><span class="goal-nums">${fmtNum(done)} / ${fmtNum(g.target)}h</span></div>
        <div class="goal-bar"><span class="done" style="width:${donePct}%"></span><span class="planned" style="width:${planPct}%"></span></div>
        <div class="goal-bottom"><span class="goal-meta">${meta}</span>${badge}</div>
      </div>`;
    }).join("");
  }

  // A goal in hours a week, for the week on screen, which has `got` of them and
  // `room` hours left to budget: green (funded) once it has them all, yellow
  // (under) while the rest still fits in room, red (over) when it doesn't.
  function weeklyGoalHTML(g, got, room, label, closed) {
    const short = Math.max(0, g.perWeek - got);
    const status = !short ? "funded" : short <= room ? "under" : "over";
    let meta = `${fmtH(A.goalDone(g))} done so far`;
    if (status === "over" && !closed) meta += room ? ` — only ${fmtH(room)} left to budget` : " — no hours left to budget";
    return `<div class="goal${status === "over" ? " off-track" : ""}" data-goal-id="${esc(g.id)}" role="button" tabindex="0" style="--c:${A.keyColor(A.goalKey(g.id))}">
        <div class="goal-top"><span class="goal-dot"></span><span class="goal-name">${esc(g.name)}</span><span class="goal-nums">${fmtH(g.perWeek)} a week</span></div>
        <div class="goal-bar weekly ${status}"><span class="done" style="width:${Math.min(100, got / g.perWeek * 100)}%"></span></div>
        <div class="goal-bottom"><span class="goal-meta">${meta}</span><span class="badge ${status}">${label}: ${fmtH(got)} · ${short ? `${fmtH(short)} short` : "Funded"}</span></div>
      </div>`;
  }

  Object.assign(A, { renderAll, renderTabs, renderBank, cardHTML, renderBoard, dayPlan, dayHTML, renderGoals });
})(Kyoshi, Kyoshi.apps.momo);
