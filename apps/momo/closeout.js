/* Momo · closeout.js — the weekly close-out (#closeOutOverlay) and noticing a new day or week.
 * Time can't be saved, so nothing rolls over — except goal hours. Once a week is over,
 * its goal cards are reviewed by exception: Momo assumes the planned work happened, you
 * lower any that fell short, and the rest of the week is let go. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, esc, todayStr, fmtNum } = K.util;
  const { DAY_NAMES, snap, fmtH, fmtWeek, dayIndex, weekKeyOf, thisWeekKey } = A;

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

  // The goal work scheduled in a week: [{ goalId, name, hours, days: [[day, hours]] }].
  function goalWork(list) {
    const byGoal = new Map();
    list.cards.forEach(c => {
      const g = c.day === null ? null : A.goalById(c.goalId);
      if (!g) return;
      const w = byGoal.get(g.id) || { goalId: g.id, name: g.name, hours: 0, byDay: {} };
      w.hours += c.hours;
      w.byDay[c.day] = (w.byDay[c.day] || 0) + c.hours;
      byGoal.set(g.id, w);
    });
    const order = id => S.data.goals.findIndex(g => g.id === id); // same order as the goals list
    return [...byGoal.values()].sort((a, b) => order(a.goalId) - order(b.goalId))
      .map(({ byDay, ...w }) => ({ ...w, days: Object.keys(byDay).sort().map(d => [+d, byDay[d]]) }));
  }
  const reviewWeeks = () => pendingCloseOuts().filter(k => goalWork(S.data.weeks[k]).length);

  // Closes finished weeks without goal work quietly, then opens the oldest
  // close-out due (unless it's been put off, or something else is on screen).
  function checkCloseOuts() {
    const quiet = pendingCloseOuts().filter(k => !goalWork(S.data.weeks[k]).length);
    if (quiet.length) {
      quiet.forEach(k => { S.data.weeks[k].closed = true; });
      A.save({ undo: false });
    }
    if (S.closing && (!S.data.weeks[S.closing.key] || S.data.weeks[S.closing.key].closed)) { // closed on another device
      S.closing = null;
      K.modal.close(overlay());
    }
    const due = reviewWeeks();
    if (!S.closing && due.length && !S.closeOutLater && !K.modal.top(A.root) && !S.drag && !S.resize) openCloseOut(due[0]);
    renderCloseOutControls();
  }

  function renderCloseOutControls() {
    const due = reviewWeeks();
    $("closeOutBanner").hidden = !due.length || !!S.closing;
    $("closeOutBannerText").textContent = due.length > 1
      ? `${due.length} past weeks are ready to close out, starting with ${fmtWeek(due[0])}.`
      : due.length ? `The week of ${fmtWeek(due[0])} is ready to close out.` : "";
    // On Sundays this week can be closed out early, to review and plan in one sitting.
    const week = A.weekOf(thisWeekKey());
    $("closeOutNowBtn").hidden = S.view === "base" || dayIndex(todayStr()) !== 6 || week.closed || !week.cards.length;
    K.refreshSwitcher(); // a dot on Momo's icon while a week waits, seen from another app
  }

  function openCloseOut(key) {
    const week = S.data.weeks[key];
    if (!week || week.closed) return;
    S.closing = { key, rows: goalWork(week).map(w => ({ ...w, done: w.hours })) };
    $("closeOutTitle").textContent = key === thisWeekKey() ? `Close out this week (${fmtWeek(key)})` : `Close out ${fmtWeek(key)}`;
    $("closeOutRows").innerHTML = S.closing.rows.map((r, i) => `<div class="co-row" style="--c:${A.keyColor(A.goalKey(r.goalId))}">
      <div>
        <div class="co-name"><span class="goal-dot"></span>${esc(r.name)}</div>
        <div class="co-detail">Planned ${fmtH(r.hours)} · ${r.days.map(([d, h]) => `${DAY_NAMES[d]} ${fmtH(h)}`).join(" · ")}</div>
      </div>
      <div class="co-done">
        <label for="coDone${i}">Done</label>
        <div class="stepper">
          <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
          <input type="number" id="coDone${i}" data-row="${i}" value="${fmtNum(r.hours)}" min="0" max="${r.hours}" step="0.25">
          <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
        </div>
      </div>
      <div class="co-result" id="coResult${i}"></div>
    </div>`).join("");
    S.closing.rows.forEach((r, i) => updateCloseOutResult(i));
    K.modal.open(overlay());
    renderCloseOutControls();
  }

  // "288h → 280h to go": the goal before and after this week's hours count.
  // One in hours a week has no total: "40h → 45h done", and how the week did.
  function updateCloseOutResult(i) {
    const closing = S.closing, r = closing.rows[i], g = A.goalById(r.goalId);
    if (!g) return;
    if (A.isWeekly(g)) {
      const before = Math.max(0, A.goalDone(g) - (g.log[closing.key] || 0));
      $(`coResult${i}`).innerHTML = `${fmtH(before)} → <strong>${fmtH(before + r.done)}</strong> done · ` +
        (r.done >= g.perWeek ? `${fmtH(g.perWeek)} a week met ✓` : `${fmtH(g.perWeek - r.done)} short of ${fmtH(g.perWeek)} a week`);
      return;
    }
    const before = Math.max(0, g.target - (A.goalDone(g) - (g.log[closing.key] || 0)));
    const after = Math.max(0, before - r.done);
    $(`coResult${i}`).innerHTML = after === 0 && before > 0
      ? `${fmtH(before)} to go → <strong>goal reached 🎉</strong>`
      : `${fmtH(before)} → <strong>${fmtH(after)}</strong> to go`;
  }

  function onCloseOutInput(e) {
    const i = +e.target.dataset.row, r = S.closing && S.closing.rows[i];
    if (!r) return;
    const v = parseFloat(e.target.value);
    r.done = isNum(v) ? Math.min(r.hours, Math.max(0, snap(v))) : 0;
    updateCloseOutResult(i);
  }

  function onCloseOutChange(e) {
    const r = S.closing && S.closing.rows[+e.target.dataset.row];
    if (r) e.target.value = fmtNum(r.done);
  }

  function confirmCloseOut() {
    if (!S.closing) return;
    const { key, rows } = S.closing, week = S.data.weeks[key];
    S.closing = null;
    K.modal.close(overlay());
    if (week && !week.closed) {
      rows.forEach(r => {
        const g = A.goalById(r.goalId);
        if (!g) return;
        const worked = snap(r.done);
        if (worked > 0) g.log[key] = worked;
        else delete g.log[key];
      });
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
    if (goalWork(week).length) return openCloseOut(key);
    A.ensureWeek(key).closed = true;
    A.save();
    A.renderAll();
  }

  // Takes a closed week's goal hours back off and opens it again.
  function reopenWeek() {
    const key = A.viewKey(), week = key && S.data.weeks[key];
    if (!week || !week.closed) return;
    week.closed = false;
    S.data.goals.forEach(g => { delete g.log[key]; });
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

  Object.assign(A, {
    defineCloseOutOverlay, goalWork, reviewWeeks, checkCloseOuts, renderCloseOutControls, openCloseOut, onCloseOutInput, onCloseOutChange,
    confirmCloseOut, closeOutLaterClick, closeOutEarly, reopenWeek, checkRollover
  });
})(Kyoshi, Kyoshi.apps.momo);
