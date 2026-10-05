/* Momo · sides.js — a card's before & after (a commute, by default): time inside it at its start and its end, the
 * same both ways or not. Nothing new is stored: they're ordinary cards inside it (model.js parentId, pos "top" and
 * "bottom"), titled as you say, each with its own minutes, so the budget counts them (blockHours), the block draws as
 * one, moving the card moves them, and each still opens in the editor on its own. A pinned card's time is when its
 * whole block starts. Here: a card's as the editor shows them (sidesOf), setting them (setSides: the editor's Save,
 * and the sleep routine's), and the card editor's Before & after fields (#cardSidesField): shown for a card that can
 * hold cards (not one set in its app, nor one going inside another), the − / + by 15 minutes, Same both ways. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, newId } = K.util;
  const { SIDE_TITLE, SIDE_MAX, cleanText } = A;
  const SIDE_STEP = 15; // minutes: the board's grid

  // A card's before & after: the title found at both its top and its bottom (else that of its first card at the top,
  // else at the bottom, else "Commute"), and the minutes of the cards inside it with that title (any case) at its top
  // (before) and at its bottom (after).
  function sidesOf(list, card) {
    const inner = card ? A.innerCards(list, card) : [], at = pos => inner.filter(c => c.pos === pos);
    const titled = t => c => c.title.toLowerCase() === t.toLowerCase();
    const first = at("top").find(c => at("bottom").some(titled(c.title))) || at("top")[0] || at("bottom")[0];
    const title = first ? first.title : SIDE_TITLE, minutes = pos => Math.round(sum(at(pos).filter(titled(title)).map(c => c.hours)) * 60);
    return { title, before: minutes("top"), after: minutes("bottom") };
  }

  // Sets a card's before & after: at its top and at its bottom, one card inside it titled `title`, that many minutes
  // long, or none at 0. Those are the cards there titled `was` (any case: what the editor opened with): the first at
  // each end renamed and resized, any others with that title there taken out; one is made where there's none (before
  // the others at the top, after them at the bottom). The cards in its middle, or titled otherwise, stay as they are.
  // Not on a card inside another, nor one set in its app: neither holds cards (model.js canHold). It only changes
  // list: saving and drawing are the caller's.
  function setSides(list, card, title, beforeMin, afterMin, was = title) {
    if (!card || card.parentId || A.isFixed(card) || !list.cards.includes(card)) return;
    const mine = (c, pos) => c.parentId === card.id && c.pos === pos;
    [["top", beforeMin], ["bottom", afterMin]].forEach(([pos, minutes]) => {
      const there = list.cards.filter(c => mine(c, pos) && c.title.toLowerCase() === was.toLowerCase()), hours = A.snap(minutes / 60);
      const keep = hours > 0 ? there[0] : null;
      list.cards = list.cards.filter(c => c === keep || !there.includes(c));
      if (keep) return Object.assign(keep, { title, hours });
      if (hours <= 0) return;
      const ahead = pos === "top" ? list.cards.find(c => mine(c, pos)) : null;
      A.insertCard(list, { id: newId(), title, hours, day: card.day, goalId: null, base: card.base, parentId: card.id, pos, pin: null, need: null, app: null, auto: false, slot: null, fixed: false }, ahead ? ahead.id : null);
    });
    A.tidyNesting(list);
  }

  // ==========================================================================
  // THE CARD EDITOR'S FIELDS
  // ==========================================================================
  // Shown for a card that can hold cards: not one set in its app, nor one going inside another (Inside picked).
  function renderSidesField() {
    $("cardSidesField").hidden = !S.editing || S.editing.readonly || (!$("cardInField").hidden && !!$("cardIn").value);
  }

  // Filled in as the card has them (a new one: Commute, none either way); Same both ways while they match.
  function openSides(list, card) {
    const s = sidesOf(list, card);
    S.editing.sides = s.title; // what they're titled, so Save renames them
    $("cardSideTitle").value = s.title;
    $("cardBefore").value = s.before;
    $("cardAfter").value = s.after;
    $("cardSidesSame").checked = s.before === s.after;
    syncSame();
    renderSidesField();
  }

  // Same both ways: After follows Before, and can't be changed itself.
  function syncSame() {
    const same = $("cardSidesSame").checked, after = $("cardAfter");
    if (same) after.value = $("cardBefore").value;
    after.disabled = same;
    after.parentElement.querySelectorAll(".step-btn").forEach(b => { b.disabled = same; });
  }

  // Minutes typed in Before or After: on the 15-minute grid, 0 to SIDE_MAX (empty is 0); NaN when it isn't a number.
  function readMinutes(id) {
    const v = A.readNumber(id);
    if (v === null) return 0;
    return Number.isNaN(v) ? NaN : Math.min(SIDE_MAX, Math.max(0, Math.round(v / SIDE_STEP) * SIDE_STEP));
  }

  // What Save does with them: null while they're hidden (nothing changes), else { title, was, before, after }.
  function readSides() {
    if ($("cardSidesField").hidden) return null;
    const before = readMinutes("cardBefore"), after = $("cardSidesSame").checked ? before : readMinutes("cardAfter");
    return { title: cleanText($("cardSideTitle").value) || SIDE_TITLE, was: S.editing.sides || SIDE_TITLE, before, after };
  }

  // The cards inside the card being edited as Save would leave them (the note under its hours): its before & after as
  // the fields say, with the others inside it between them.
  function innerAfter() {
    const ed = S.editing, s = ed && readSides();
    if (!s) return ed ? ed.inner : [];
    const side = c => c.pos !== "middle" && c.title.toLowerCase() === s.was.toLowerCase();
    const part = minutes => (minutes > 0 ? [{ title: s.title, hours: minutes / 60 }] : []);
    return part(s.before).concat(ed.inner.filter(c => !side(c)), part(s.after));
  }

  // − / + beside Before or After (events.js onStepper): 15 minutes, within 0 and SIDE_MAX.
  function stepMinutes(input, dir) {
    const v = readMinutes(input.id);
    input.value = Math.min(SIDE_MAX, Math.max(0, (isNum(v) ? v : 0) + SIDE_STEP * dir));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function initSides() {
    $("cardBefore").addEventListener("input", () => { if ($("cardSidesSame").checked) $("cardAfter").value = $("cardBefore").value; A.renderInnerNote(); });
    ["cardAfter", "cardSideTitle"].forEach(id => $(id).addEventListener("input", A.renderInnerNote));
    // Leaving a minutes field shows what it will be saved as.
    ["cardBefore", "cardAfter"].forEach(id => $(id).addEventListener("change", e => {
      const v = readMinutes(id);
      if (isNum(v)) e.target.value = v;
      syncSame();
    }));
    $("cardSidesSame").addEventListener("change", () => { syncSame(); A.renderInnerNote(); });
    $("cardIn").addEventListener("change", () => { renderSidesField(); A.renderInnerNote(); });
  }

  Object.assign(A, { sidesOf, setSides, renderSidesField, openSides, readSides, innerAfter, stepMinutes, initSides });
})(Kyoshi, Kyoshi.apps.momo);
