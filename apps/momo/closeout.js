/* Momo · closeout.js — the weekly close-out (#closeOutOverlay), noticing a new day or week, and what Iroh
 * reads from it (hoursSpent). Time can't be saved, so nothing rolls over. Once a week is over, your goals'
 * hours are reviewed by exception: each title apps asked to spread as hours over that week's cards (Iroh's
 * goals, from K.inbox) is listed with the hours planned for it (none without a card), Momo assumes the plan
 * happened, you lower or raise any that differed, and Confirm keeps the result in the week (spent, see
 * model.js). Errands, jobs and the rest are marked done in their own apps. A week with no goals closes quietly. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, esc, addDays, todayStr, fmtNum } = K.util;
  const { DAY_HOURS, DAYS, DAY_NAMES, FREE_TIME, snap, fmtH, cleanText, fmtWeek, dayIndex, weekKeyOf, thisWeekKey } = A;
  const WEEK_HOURS = DAY_HOURS * DAYS.length; // a goal's hours can be raised up to the whole week

  const overlay = () => $("closeOutOverlay");
  // Esc asks first if hours were changed here, then puts it off until later (core/modal.js).
  // A click beside it does nothing: the close-out waits for an answer.
  function defineCloseOutOverlay() {
    K.modal.define(overlay(), {
      dismiss: closeOutLaterClick,
      pending: () => !!S.closing && S.closing.rows.some(r => r.done !== r.hours),
      ask: "Close out later? The hours you changed here won't be kept.",
      backdrop: false
    });
  }

  const pendingCloseOuts = () => Object.keys(S.data.weeks).filter(k => k < thisWeekKey() && !S.data.weeks[k].closed).sort();

  // Where a week's hours were planned to go: each title on its days (any case, the first spelling kept, Monday
  // first) with its hours and the days it's on, [{ title, hours, days }], most hours first. Each card counts its
  // own hours, so one inside another counts on its own. Free time isn't a job to review.
  function plannedHours(list) {
    const byTitle = new Map(), free = FREE_TIME.toLowerCase();
    DAYS.forEach(d => list.cards.forEach(c => {
      const t = c.title.toLowerCase();
      if (c.day !== d || t === free) return;
      const r = byTitle.get(t) || byTitle.set(t, { title: c.title, hours: 0, days: [] }).get(t);
      r.hours += c.hours;
      if (!r.days.includes(d)) r.days.push(d);
    }));
    return [...byTitle.values()].sort((a, b) => b.hours - a.hours); // ties stay in the board's order
  }

  // The titles whose hours the close-out logs: the ones apps ask Momo to spread as hours over the week's cards
  // (fill "hours"; Iroh's goals today), Monday to Sunday: title (any case) -> its first spelling, in the
  // inbox's order (Iroh lists its goals in the order added). Read afresh each time; nothing is stored.
  function trackedTitles(key) {
    const out = new Map();
    K.inbox(key, addDays(key, 6)).filter(n => n.fill === "hours").forEach(n => {
      const title = cleanText(n.block), t = title.toLowerCase();
      if (!out.has(t)) out.set(t, title);
    });
    return out;
  }

  // A week's rows to review: each tracked title with its planned hours and days (any case, as the board spells
  // it), or none when no card had it, [{ title, hours, days }]. This week's may not be stored yet (weekOf).
  function reviewRows(key) {
    const planned = new Map(plannedHours(A.weekOf(key)).map(r => [r.title.toLowerCase(), r]));
    return [...trackedTitles(key)].map(([t, title]) => planned.get(t) || { title, hours: 0, days: [] });
  }
  const reviewWeeks = () => pendingCloseOuts().filter(k => reviewRows(k).length);

  // Closes finished weeks with no goals to review quietly, then opens the oldest close-out due (unless it's been
  // put off, or something else is on screen). Just after data came in (an import, a sync, another tab's save:
  // settled false) it only drops a close-out closed elsewhere: apps' data comes in one app at a time, Momo's
  // before Iroh's, so nothing is closed or opened on goals that may not be in yet. The next show or day does it.
  function checkCloseOuts(settled = true) {
    const quiet = settled ? pendingCloseOuts().filter(k => !reviewRows(k).length) : [];
    if (quiet.length) {
      quiet.forEach(k => { S.data.weeks[k].closed = true; });
      A.save({ undo: false });
    }
    if (S.closing && (!S.data.weeks[S.closing.key] || S.data.weeks[S.closing.key].closed)) { // closed on another device
      S.closing = null;
      K.modal.close(overlay());
    }
    if (settled && !S.closing && !S.closeOutLater && !K.modal.top(A.root) && !S.drag && !S.resize) {
      const due = reviewWeeks();
      if (due.length) openCloseOut(due[0]);
    }
    renderCloseOutControls();
  }

  function renderCloseOutControls() {
    const due = reviewWeeks();
    $("closeOutBanner").hidden = !due.length || !!S.closing;
    $("closeOutBannerText").textContent = due.length > 1
      ? `${due.length} past weeks are ready to close out, starting with ${fmtWeek(due[0])}.`
      : due.length ? `The week of ${fmtWeek(due[0])} is ready to close out.` : "";
    // On Sundays this week can be closed out early, to review and plan in one sitting.
    const key = thisWeekKey();
    $("closeOutNowBtn").hidden = S.view === "base" || dayIndex(todayStr()) !== 6 || A.weekOf(key).closed || !reviewRows(key).length;
    K.refreshSwitcher(); // a dot on Momo's icon while a week waits, seen from another app
  }

  // "Mon, Wed, Fri", "Mon–Fri", "every day": the days a title is on, three or more in a row as one run.
  function dayList(days) {
    if (days.length === DAYS.length) return "every day";
    const runs = [];
    days.forEach(d => {
      const run = runs[runs.length - 1];
      if (run && run[1] === d - 1) run[1] = d;
      else runs.push([d, d]);
    });
    return runs.flatMap(([a, b]) => (b - a >= 2 ? [`${DAY_NAMES[a]}–${DAY_NAMES[b]}`] : DAYS.slice(a, b + 1).map(d => DAY_NAMES[d]))).join(", ");
  }

  function openCloseOut(key) {
    const week = S.data.weeks[key];
    if (!week || week.closed) return;
    S.closing = { key, rows: reviewRows(key).map(r => ({ ...r, done: r.hours })) };
    $("closeOutTitle").textContent = key === thisWeekKey() ? `Close out this week (${fmtWeek(key)})` : `Close out ${fmtWeek(key)}`;
    $("closeOutRows").innerHTML = S.closing.rows.map((r, i) => `<div class="co-row" style="--c:${A.cardColor(r)}">
      <div>
        <div class="co-name"><span class="co-dot"></span>${esc(r.title)}</div>
        <div class="co-detail">${r.hours ? `Planned ${fmtH(r.hours)} · ${dayList(r.days)}` : "Nothing planned this week"}</div>
      </div>
      <div class="co-done">
        <label for="coDone${i}">Done</label>
        <div class="stepper">
          <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
          <input type="number" id="coDone${i}" data-row="${i}" value="${fmtNum(r.hours)}" min="0" max="${WEEK_HOURS}" step="0.25">
          <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
        </div>
      </div>
    </div>`).join("");
    K.modal.open(overlay());
    renderCloseOutControls();
  }

  function onCloseOutInput(e) {
    const r = S.closing && S.closing.rows[+e.target.dataset.row];
    if (!r) return;
    const v = parseFloat(e.target.value);
    r.done = isNum(v) ? Math.min(WEEK_HOURS, Math.max(0, snap(v))) : 0;
  }

  function onCloseOutChange(e) {
    const r = S.closing && S.closing.rows[+e.target.dataset.row];
    if (r) e.target.value = fmtNum(r.done);
  }

  // The hours as reviewed go into the week (spent: each title above zero, as its first card spells it, else its goal), and it closes.
  function confirmCloseOut() {
    if (!S.closing) return;
    const { key, rows } = S.closing, week = S.data.weeks[key];
    S.closing = null;
    K.modal.close(overlay());
    if (week && !week.closed) {
      week.spent = {};
      rows.forEach(r => { if (r.done > 0) week.spent[r.title] = snap(r.done); });
      week.closed = true;
      A.save();
    }
    A.renderAll();
    checkCloseOuts();
  }

  function closeOutLaterClick() {
    S.closing = null;
    S.closeOutLater = true;
    K.modal.close(overlay());
    A.renderAll();
  }

  function closeOutEarly() {
    const key = thisWeekKey(), week = A.weekOf(key);
    if (week.closed) return;
    if (reviewRows(key).length) {
      A.ensureWeek(key); // a week with goals but no cards yet, so it can keep what's logged
      return openCloseOut(key);
    }
    A.ensureWeek(key).closed = true;
    A.save();
    A.renderAll();
  }

  // Opens a closed week again, the hours its close-out logged taken back off.
  function reopenWeek() {
    const key = A.viewKey(), week = key && S.data.weeks[key];
    if (!week || !week.closed) return;
    week.closed = false;
    delete week.spent;
    A.save();
    S.closeOutLater = false;
    A.renderAll();
    checkCloseOuts();
  }

  // The app can stay open past midnight or into a new week (a phone tab, say):
  // redraw for the new day and bring up any close-out that's now due.
  function checkRollover() {
    const today = todayStr();
    if (today === S.knownToday) return;
    if (weekKeyOf(today) !== weekKeyOf(S.knownToday || today)) S.closeOutLater = false;
    S.knownToday = today;
    A.renderAll();
    checkCloseOuts();
  }

  // ==========================================================================
  // SHARED WITH IROH (apps/momo/CLAUDE.md, "Shared with other apps")
  // ==========================================================================
  // The hours a title (any case) took in each closed week, as its close-out logged them: { "<Monday>": hours }
  // for every closed week, 0 where it had none. A week closed without that review (quietly, with no goals; before
  // Momo logged hours; or by an older copy of it) counts its plan, as the close-out would have. A fresh object each time, so
  // nothing outside Momo can change its data through it.
  function hoursSpent(title) {
    const out = {}, t = typeof title === "string" ? cleanText(title).toLowerCase() : "";
    if (!t || !S.data) return out;
    const planned = w => (t === FREE_TIME.toLowerCase() ? 0 : sum(w.cards.filter(c => c.day !== null && c.title.toLowerCase() === t).map(c => c.hours))); // as plannedHours has it
    Object.keys(S.data.weeks).sort().forEach(k => {
      const w = S.data.weeks[k];
      if (w.closed) out[k] = w.spent ? sum(Object.keys(w.spent).filter(s => s.toLowerCase() === t).map(s => w.spent[s])) : planned(w);
    });
    return out;
  }

  Object.assign(A, {
    defineCloseOutOverlay, plannedHours, reviewRows, reviewWeeks, checkCloseOuts, renderCloseOutControls, openCloseOut, onCloseOutInput, onCloseOutChange,
    confirmCloseOut, closeOutLaterClick, closeOutEarly, reopenWeek, checkRollover, hoursSpent
  });
})(Kyoshi, Kyoshi.apps.momo);
