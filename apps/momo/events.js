/* Momo · events.js — loads last: wires Momo's buttons, board and pop-ups (A.init), and the
 * hooks Kyoshi calls: onKeydown (Esc, undo, copy/cut/paste, Enter saves an editor), onShow /
 * onHide (place other apps' dated cards, redraw; drop any drag), onTick (other apps' dated cards; a new day or
 * week; what other apps need; their events; Today), onReload (another tab saved), attention (a week to close
 * out, an event's conflict), renderDev (Undo in Developer Mode) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, todayStr, fmtNum } = K.util;
  const { DAY_HOURS, DAYS, WEEKDAYS, BUTTON_STEP, snap, fmtH, thisWeekKey, nextWeekKey } = A;

  // − / + buttons next to a number field step it by half an hour, within its min and max;
  // next to a time of day (an event's), by 15 minutes.
  function onStepper(e) {
    const btn = e.target.closest(".step-btn");
    if (!btn) return;
    const input = btn.parentElement.querySelector("input");
    if (input.dataset.clock !== undefined) return A.stepEventTime(+btn.dataset.step);
    const min = parseFloat(input.min), max = parseFloat(input.max);
    const next = snap((parseFloat(input.value) || 0) + BUTTON_STEP * +btn.dataset.step);
    input.value = fmtNum(Math.min(isNum(max) ? max : DAY_HOURS, Math.max(isNum(min) ? min : 0, next)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // While Alt (Option on a Mac) is held, the card under the mouse is shaded
  // red: a click deletes it. Not mid-drag or resize, where a click doesn't.
  const holdAlt = on => A.root.classList.toggle("alt-held", on && !S.drag && !S.resize);

  A.init = () => {
    $("viewToggle").addEventListener("click", e => {
      const btn = e.target.closest("button[data-view]");
      if (!btn || btn.dataset.view === S.view) return;
      S.view = btn.dataset.view;
      A.renderAll();
    });
    $("closeOutNowBtn").addEventListener("click", A.closeOutEarly);
    // Review, in the banner: the close-out now, even if Later was picked today (and on a phone, where it waits there).
    $("closeOutBannerBtn").addEventListener("click", () => {
      A.clearLater();
      const due = A.reviewWeeks();
      if (due.length) A.openCloseOut(due[0]);
    });
    $("loadBaselineBtn").addEventListener("click", A.loadBaseline);
    $("copyPrevBtn").addEventListener("click", A.copyPrevWeek);
    $("saveAsBaseBtn").addEventListener("click", A.saveAsBaseline);
    $("gotoBaselineBtn").addEventListener("click", () => { S.view = "base"; A.renderAll(); });
    $("sampleBaselineBtn").addEventListener("click", A.startSampleBaseline);
    $("fillGapsBtn").addEventListener("click", A.fillGaps);
    $("reopenBtn").addEventListener("click", A.reopenWeek);
    $("clearBtn").addEventListener("click", A.clearBoard);
    // A new card waits in Tasks (No day), or on the baseline goes on the days picked.
    $("addTaskBtn").addEventListener("click", () => A.openCardEditor(null, S.view === "base" ? { noDay: true } : { day: null }));

    ["board", "tasks"].forEach(id => {
      $(id).addEventListener("pointerdown", A.onBoardPointerDown);
      $(id).addEventListener("click", A.onBoardClick);
      $(id).addEventListener("keydown", A.onCardKey);
      $(id).addEventListener("contextmenu", e => { if (S.press || S.drag) e.preventDefault(); }); // long-press menus
    });
    // Page-wide listeners run only while Momo is on screen (A.listen).
    A.listen(document, "pointermove", A.onPointerMove);
    A.listen(document, "pointerup", A.onPointerUp);
    A.listen(document, "pointercancel", A.onPointerCancel);
    // Copy, cut and paste go by where the mouse is (none once it's left the window).
    A.listen(document, "pointermove", e => { if (e.pointerType === "mouse") S.mouse = { x: e.clientX, y: e.clientY }; });
    A.listen(document, "mouseout", e => { if (!e.relatedTarget) S.mouse = null; });
    A.listen(document, "pointermove", e => holdAlt(e.altKey));
    A.listen(window, "blur", () => holdAlt(false));
    // Letting go of Alt clears the shading; letting go of Ctrl mid-drag goes back to moving just the one card.
    A.listen(document, "keyup", e => {
      if (e.key === "Alt") holdAlt(false);
      if (S.drag && (e.key === "Control" || e.key === "Meta")) {
        S.drag.ctrl = false;
        if (A.setGroup()) A.findTarget();
      }
    });
    // Once a touch drag has started, the page mustn't scroll under the finger.
    A.listen(document, "touchmove", e => { if (S.drag || S.resize) e.preventDefault(); }, { passive: false });
    // The ruler is in pixels: the board is redrawn when an hour's height changes (narrow screens have shorter hours).
    A.listen(window, "resize", () => { if (A.hourPx() !== S.ruler.hour) A.renderAll(); });

    // Pop-ups: Esc, their × and a click beside them are handled by core/modal.js.
    A.defineCardOverlay();
    A.defineEventOverlay();
    A.defineCloseOutOverlay();
    A.initToday(); // Today, its buttons and its card pop-up; on a phone Momo opens on it
    A.initWeekends(); // a weekend's pop-up, opened from Upcoming weekends or the board's Saturday

    $("cardSaveBtn").addEventListener("click", A.saveCard);
    $("cardDeleteBtn").addEventListener("click", A.deleteCard);
    $("cardCancelBtn").addEventListener("click", () => K.modal.dismiss($("cardOverlay")));
    $("cardDays").addEventListener("click", A.onDayPill);
    $("cardDailyBtn").addEventListener("click", () => A.applyPreset(DAYS));
    $("cardWeekdaysBtn").addEventListener("click", () => A.applyPreset(WEEKDAYS));
    $("cardClearDaysBtn").addEventListener("click", A.clearDays);
    $("cardColors").addEventListener("click", e => A.onColorClick(e, S.editing, () => A.cardOwn(A.typedKey()), A.renderCardColors));
    $("cardTitle").addEventListener("input", () => { if (S.editing) A.renderCardColors(); }); // a title typed shows its colour
    $("cardIn").addEventListener("change", () => { $("cardPosField").hidden = !$("cardIn").value; A.renderPinField(); });
    $("cardPin").addEventListener("change", () => { const t = A.readClock("cardPin"); if (isNum(t)) $("cardPin").value = A.fmtClock(t); });
    $("cardHours").addEventListener("input", A.renderInnerNote);
    Object.keys(A.HOUR_RANGES).forEach(id => $(id).addEventListener("change", A.tidyHours));

    $("eventFixes").addEventListener("click", A.onFixClick);
    $("eventTime").addEventListener("input", () => A.onEventTime(false));
    $("eventTime").addEventListener("change", () => A.onEventTime(true));
    $("eventMoveBtn").addEventListener("click", A.moveEvent);
    $("eventCancelBtn").addEventListener("click", () => K.modal.dismiss($("eventOverlay")));
    $("eventResetBtn").addEventListener("click", A.resetEvent);
    // Its app's name is a link there: the pop-up closes on the way.
    $("eventFrom").addEventListener("click", e => { if (e.target.closest("a")) A.closeEvent(); });

    $("closeOutConfirmBtn").addEventListener("click", A.confirmCloseOut);
    $("closeOutLaterBtn").addEventListener("click", A.closeOutLaterClick);
    $("closeOutAllBtn").addEventListener("click", A.closeAllAsPlanned);
    $("closeOutRows").addEventListener("input", A.onCloseOutInput);
    $("closeOutRows").addEventListener("change", A.onCloseOutChange);
    A.root.addEventListener("click", onStepper);

    S.knownToday = todayStr();
    A.renderAll();
    // No close-out check here: Momo starts before Iroh, and K.inbox leaves out apps not started yet, so every past
    // week would seem to have no goals to review and close quietly, for good. It runs once Momo is shown (onShow:
    // the shell shows an app only after every app has started), on a new day, and after Confirm and Reopen; after
    // a reload, a sync or an import only lightly (closeout.js checkCloseOuts).
  };

  // Esc cancels a drag, else drops a copied or cut card (a pop-up on top is Kyoshi's to
  // close); Ctrl/Cmd+Z undoes and Ctrl/Cmd+C, X and V copy, cut and paste cards (outside
  // text fields); Enter saves an editor. Kyoshi handles Ctrl+9 and the rest of Esc.
  A.onKeydown = e => {
    if (e.key === "Alt") holdAlt(true);
    if (S.drag && (e.key === "Control" || e.key === "Meta")) {
      S.drag.ctrl = true;
      if (A.setGroup()) A.findTarget();
      return true;
    }
    if (e.key === "Escape") {
      if (S.drag) A.endDrag(false);
      else if (S.resize) A.endResize(false);
      else if (!K.modal.top(A.root) && S.clip) A.clearClip();
      else return false;
      return true;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const shortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !typing && !K.modal.top(A.root) ? e.key.toLowerCase() : "";
    if (shortcut === "z") {
      e.preventDefault();
      A.undo();
      return true;
    }
    if (shortcut === "c" || shortcut === "x" || shortcut === "v") {
      // Only when it's about a card; otherwise the browser copies and pastes as usual.
      if (!(shortcut === "v" ? A.pasteCard() : A.clipCard(shortcut === "x"))) return false;
      e.preventDefault();
      return true;
    }
    if (e.key === "Enter" && typing && e.target.tagName !== "TEXTAREA") {
      const top = K.modal.top(A.root);
      if (top === $("cardOverlay")) { e.preventDefault(); A.saveCard(); return true; }
      if (top === $("eventOverlay")) { e.preventDefault(); A.onEventTime(true); A.moveEvent(); return true; }
      if (top === $("weekendOverlay")) { e.preventDefault(); A.saveWeekend(); return true; }
    }
    return false;
  };

  A.onShow = () => {
    A.placeCards(); // other apps' cards with a day of their own (place.js): never from A.init, as the other apps start after Momo
    A.renderAll(); // the ruler is measured on screen
    A.checkCloseOuts();
  };

  // Leaving for another app: nothing stays mid-drag.
  A.onHide = () => {
    if (S.drag) A.endDrag(false);
    if (S.resize) A.endResize(false);
    A.cancelPress();
    holdAlt(false);
  };

  // Every minute, and whenever the page is back in view: other apps' cards with a day of their own
  // (placed or taken back first), a new day or week, what other apps need (blocks and Tasks), other
  // apps' events, and Today's time left.
  A.onTick = () => {
    const placed = A.placeCards();
    A.checkRollover();
    A.checkTasks(placed);
    A.checkAgenda();
    A.tickToday();
  };

  // Another tab saved: its data is loaded (A.load); undo would step back over it, so it's cleared.
  A.onReload = () => {
    S.undoStack = [];
    A.placeCards();
    A.renderAll();
    A.checkCloseOuts(false); // Iroh's goals may reload just after
  };

  A.attention = () => (A.reviewWeeks().length ? "a week is ready to close out" : A.conflicts().length ? "an event conflicts with your plans" : "");

  A.renderDev = box => {
    const n = S.undoStack.length;
    box.innerHTML = `<div class="dev-block">
      <div class="dev-block-head">Undo steps: <strong>${n}</strong></div>
      <div class="dev-actions"><button class="secondary small"${n ? "" : " disabled"}>Undo</button></div>
      <div class="dev-hint">Takes back your last change, the same as Ctrl+Z.</div>
    </div>`;
    box.querySelector("button").addEventListener("click", A.undo);
  };

  // Bug reports leave out every card title and what events are.
  A.bugState = () => {
    const data = S.data, tk = thisWeekKey(), nk = nextWeekKey(), b = A.budgetOf(A.shownList(), A.shownKey()), f = A.fill(), tasks = A.tasks(f);
    const closed = Object.values(data.weeks).filter(w => w.closed);
    const placed = f.blocks.reduce((n, x) => n + x.needs.filter(nd => nd.fill !== "ongoing").length, 0);
    const evs = [tk, nk].map(k => A.weekAgenda(k)), all = evs.flat(), cost = A.trueCost();
    const apps = [tk, nk].map(k => A.weekOf(k).cards.filter(c => c.need)), cardNeeds = f.needs.filter(n => n.fill === "card");
    return [
      `- View: ${S.today ? `today (board on ${S.view})` : S.view}`,
      `- Weeks stored: ${Object.keys(data.weeks).length} (${closed.length} closed, ${closed.filter(w => w.spent).length} with hours logged); weeks' asks kept: ${Object.keys(data.asks).length}`,
      `- True cost: ${cost.rows.length} block titles over ${cost.weeks} week(s), ${cost.rows.filter(r => r.short > 7).length} short in the baseline; ${cost.apps.length} app(s) with cards of their own, ${Math.round(cost.total)} of ${Math.round(cost.free)} free min a week`,
      `- Cards this week / next week / baseline: ${A.weekOf(tk).cards.length} / ${A.weekOf(nk).cards.length} / ${data.baseline.cards.length}`,
      `- Apps' own cards this week / next week: ${apps.map(l => l.length).join(" / ")} (${apps.flat().filter(c => c.auto).length} placed by Momo, untouched); card needs: ${cardNeeds.length} (${cardNeeds.filter(n => n.date).length} dated, ${f.short.filter(n => n.fill === "card").length} in Tasks); missed on screen: ${f.missed.size}`,
      `- Pinned this week / next week / baseline: ${[A.weekOf(tk), A.weekOf(nk), data.baseline].map(l => l.cards.filter(A.pinned).length).join(" / ")}`,
      `- Old goals kept (from before Iroh): ${data.goals.length}`,
      `- Colours kept: ${Object.keys(data.colors).length} (${A.colorKeys(data).shown.length} titles on show)`,
      `- On screen: ${fmtH(b.free)} to be budgeted, ${b.over.length} overbooked day(s), ${fmtH(b.parked)} parked`,
      `- Needs from other apps: ${f.needs.length} (${[...new Set(f.needs.map(n => n.app))].join(", ") || "none"}): ${placed} in ${f.blocks.filter(x => x.needs.length).length} block(s), ${f.short.length} short, ${f.needs.filter(n => n.done).length} done, ${f.needs.filter(n => n.fill === "ongoing").length} ongoing`,
      `- Tasks to draw from: ${tasks.length} (${tasks.filter(t => !t.ongoing).length} short, ${tasks.filter(t => t.ongoing).length} ongoing; from ${A.appsIn(tasks).join(", ") || "no app"}); late needs: ${f.needs.filter(n => A.isLate(n)).length}`,
      `- Events this week / next week: ${evs.map(l => l.length).join(" / ")} (${all.filter(ev => ev.flag).length} conflicting, ${all.filter(ev => ev.moved).length} moved, ${all.filter(ev => ev.done).length} done)`,
      `- Weeks waiting for close-out: ${A.reviewWeeks().length}${A.laterToday() ? " (put off until tomorrow)" : ""}`,
      `- Weekends: ${A.upcomingWeekends().filter(A.planOf).length} of the next ${A.WEEKENDS} planned; plans kept: ${Object.values(data.weekends).filter(w => w.plan).length} (${Object.values(data.weekends).filter(w => !w.plan).length} cleared)`,
      `- Undo steps: ${S.undoStack.length}`
    ];
  };
})(Kyoshi, Kyoshi.apps.momo);
