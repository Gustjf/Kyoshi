/* Momo · card-editor.js — the card editor pop-up (#cardOverlay): new and existing cards,
 * the days they're on, pin time, which card they sit inside, and colour; saving, deleting,
 * and the colour swatches (renderColors, onColorClick). Hours fields and clock times are read
 * here too. A card from before goals moved to Iroh keeps its goalId; nothing here sets one. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, esc, newId, fmtNum } = K.util;
  const { DAY_HOURS, DAYS, WEEKDAYS, DAY_NAMES, STEP, DRAW_HOURS, FREE_TIME, POSITIONS, AUTO, PALETTE, HIGHLIGHTS,
    snap, fmtH, cleanText, fmtClock, firstDay, thisWeekKey, nextWeekKey, readNumber } = A;

  const overlay = () => $("cardOverlay");
  // What the editor holds, to tell whether closing it would lose changes.
  const cardFormState = () => JSON.stringify([$("cardTitle").value, $("cardHours").value, $("cardIn").value, $("cardPos").value, $("cardPin").value, [...S.editing.days].sort(), S.editing.pick]);

  // Esc, × and a click beside the editor ask first if it has unsaved changes (core/modal.js); Cancel doesn't.
  function defineCardOverlay() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && cardFormState() !== S.editing.snapshot,
      ask: "Discard your changes to this card?"
    });
    // "Open in Appa" (or any app): the editor closes on the way, asking first if it has changes (as × and Esc do), and
    // the app shows what it needs (core/inbox.js). Kept open, nothing else happens.
    $("cardFrom").addEventListener("click", e => {
      const link = e.target.closest("a[data-app]");
      if (!link) return;
      e.preventDefault();
      K.modal.requestDismiss(overlay());
      if (!K.modal.isOpen(overlay())) K.inbox.open(link.dataset.app, link.dataset.id);
    });
  }

  // A card other apps' needs fill, or a new one from a task of theirs, says what with, with a way there.
  function renderFrom(needs) {
    $("cardFrom").hidden = !needs.length;
    $("cardFrom").innerHTML = A.fromHTML(needs);
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  // Titles used before, and the tasks' (what other apps need), for the title field's suggestions.
  function titleSuggestions() {
    const titles = new Map([[FREE_TIME.toLowerCase(), FREE_TIME]]);
    [S.data.baseline, A.weekOf(thisWeekKey()), A.weekOf(nextWeekKey())].forEach(list => list.cards.forEach(c => titles.set(c.title.toLowerCase(), c.title)));
    A.tasks().forEach(t => titles.set(t.title.toLowerCase(), t.title));
    return [...titles.values()].sort((a, b) => a.localeCompare(b));
  }

  // Opens the card editor for a card, or for a new card on a day (null =
  // parked, in Tasks): before the card before on that day (null for last,
  // AUTO for wherever it fits), in free time of room hours; or, with noDay,
  // with no day picked yet. A new card from a task (from) starts as the ones
  // it draws. Either one can be put on several days at once.
  function openCardEditor(id, { day = 0, noDay = false, before = AUTO, room = null, from = null } = {}) {
    if (A.isLocked()) return;
    const key = A.shownKey(), list = A.readList(key);
    const card = id ? list.cards.find(c => c.id === id) : null;
    if (id && !card) return;
    const free = day === null || noDay ? 0 : room !== null ? room : DAY_HOURS - A.dayTotal(list, day);
    const draft = card || from; // what the fields start from, if anything
    const editing = S.editing = { key, id: card ? card.id : null, days: new Set(noDay ? [] : [card ? card.day : day]), at: { day: noDay ? undefined : day, before }, pick: null, oldKey: card ? A.cardKey(card) : null, carry: null, inner: card ? A.innerCards(list, card) : [] };
    // Renamed to a new title, a card takes its colour along if no other card on show has its title.
    const oldKey = editing.oldKey;
    if (card && S.data.colors[oldKey] && !A.keyOnShow(oldKey, card)) editing.carry = S.data.colors[oldKey].c;
    $("cardModalTitle").textContent = card ? "Edit card" : "New card";
    $("cardTitle").value = draft ? draft.title : "";
    $("cardHours").value = fmtNum(card ? card.hours : from ? from.hours || DRAW_HOURS : free > 0 && free < 1 ? free : 1);
    renderFrom(card ? (S.fill && S.fill.shown.get(card.id)) || [] : (from && from.needs) || []);
    // Inside: the cards on their own it could go inside, by title (on each day
    // picked, that day's one). A card with cards inside it stays on its own.
    const parent = card && card.parentId && list.cards.find(c => c.id === card.parentId);
    const holders = new Map(), own = card ? card.title.toLowerCase() : "";
    if (!editing.inner.length) list.cards.forEach(c => {
      const t = c.title.toLowerCase();
      if (!c.parentId && t !== own && !holders.has(t)) holders.set(t, c.title);
    });
    $("cardIn").innerHTML = `<option value="">None</option>` + [...holders].map(([t, title]) => `<option value="${esc(t)}">${esc(title)}</option>`).join("");
    $("cardIn").value = parent ? parent.title.toLowerCase() : "";
    $("cardInField").hidden = !holders.size;
    $("cardPos").value = parent ? card.pos : "middle";
    $("cardPosField").hidden = !parent;
    // Pinned at (the baseline only): its time, or where it starts now as a hint.
    const row = card && card.day !== null && !parent && A.daySchedule(list, card.day).rows.find(r => r.card === card);
    $("cardPin").value = card && A.pinned(card) ? fmtClock(card.pin) : "";
    $("cardPin").placeholder = row ? `${fmtClock(row.start)} (where it starts now)` : "e.g. 2300";
    renderPinField();
    renderInnerNote();
    const noWeekdays = !presetDays(WEEKDAYS).length; // this week, on a weekend
    $("cardWeekdaysBtn").disabled = noWeekdays;
    $("cardWeekdaysBtn").title = noWeekdays ? "No weekdays left this week" : "";
    $("cardDeleteBtn").hidden = !card;
    $("titleSuggestions").innerHTML = titleSuggestions().map(t => `<option value="${esc(t)}"></option>`).join("");
    renderDayPills();
    renderCardColors();
    editing.snapshot = cardFormState();
    K.modal.open(overlay());
    $("cardTitle").focus();
  }

  function renderDayPills() {
    const pills = DAYS.map(d => [d, DAY_NAMES[d]]);
    if (S.editing.key !== "base") pills.push([null, "No day"]); // it waits in Tasks
    $("cardDays").innerHTML = pills.map(([d, name]) =>
      `<button type="button" class="day-pill${S.editing.days.has(d) ? " active" : ""}" data-day="${d === null ? "" : d}">${name}</button>`).join("");
  }

  function onDayPill(e) {
    const btn = e.target.closest(".day-pill"), editing = S.editing;
    if (!btn || !editing) return;
    const d = btn.dataset.day === "" ? null : +btn.dataset.day;
    if (editing.days.has(d)) {
      editing.days.delete(d); // saving asks for a day if none is left
    } else if (d === null) {
      editing.days = new Set([null]); // no day goes on its own
    } else {
      editing.days.delete(null);
      editing.days.add(d);
    }
    renderDayPills();
  }

  // Daily and Weekdays pick those days; on this week only from today on, and
  // days already gone keep what they had, so nothing is added to the past.
  const presetDays = days => days.filter(d => d >= firstDay(S.editing.key));
  function applyPreset(days) {
    if (!S.editing) return;
    const first = firstDay(S.editing.key);
    const picked = [...S.editing.days].filter(d => d !== null && d < first).concat(presetDays(days));
    if (!picked.length) return;
    S.editing.days = new Set(picked);
    renderDayPills();
  }
  // Clear unpicks every day, to start the choice over.
  function clearDays() {
    if (!S.editing) return;
    S.editing.days = new Set();
    renderDayPills();
  }

  // The editor's colours for a key with its own colour own, showing c
  // (own, or one picked): the highlights, after own if it's
  // another (and slate, for Free time), so it can be picked back. Each says
  // which key on show has it, other than those in mine; the note under them
  // says what picking c does — swap with the key that has it (or give that
  // one a new colour, if this key had none yet) — else says `about`.
  function renderColors(key, own, c, had, mine, about) {
    const opts = PALETTE.slice(0, HIGHLIGHTS).map(([name]) => name);
    if (key === A.FREE_KEY) opts.unshift("slate");
    if (!opts.includes(own)) opts.unshift(own);
    const lead = opts.length - HIGHLIGHTS - 1; // the last swatch before the highlights
    const owners = new Map(A.colorKeys(S.data).shown.filter(k => !mine.includes(k) && S.data.colors[k]).map(k => [S.data.colors[k].c, k]));
    $("cardColors").innerHTML = opts.map((o, i) => {
      const who = owners.get(o), tip = `${A.colorName(o)}${who ? ` — “${A.keyName(who)}” has it` : ""}`;
      return `<button type="button" class="swatch${o === c ? " active" : ""}${i === lead ? " own" : ""}" data-color="${o}" style="--c:${A.colorCss(o)}" title="${esc(tip)}" aria-label="${esc(tip)}"></button>`;
    }).join("");
    const other = owners.get(c);
    $("cardColorNote").textContent = !other ? about : had ? `Swaps colours with “${A.keyName(other)}”.` : `“${A.keyName(other)}” gets a new colour.`;
  }

  // The colour the card being edited has without one picked here: its
  // title's, else (renamed to a new title) the one it takes along, else a new one.
  const typedKey = () => A.titleKey(cleanText($("cardTitle").value));
  function cardOwn(key) {
    if (S.data.colors[key]) return S.data.colors[key].c;
    if (key === A.FREE_KEY) return "slate";
    return S.editing.carry || A.freeColor(S.data, A.colorKeys(S.data).shown);
  }
  function renderCardColors() {
    const editing = S.editing, title = cleanText($("cardTitle").value), key = A.titleKey(title), own = cardOwn(key);
    renderColors(key, own, editing.pick || own, !!(S.data.colors[key] || editing.carry), [key, editing.carry ? editing.oldKey : null],
      title ? `Every “${title}” card is this colour.` : "Cards with the same title share a colour.");
  }

  // A colour clicked in the editor is picked, unless it's the one it has anyway.
  function onColorClick(e, state, own, render) {
    const s = e.target.closest(".swatch");
    if (!s || !state) return;
    state.pick = s.dataset.color === own() ? null : s.dataset.color;
    render();
  }

  // Hours fields go on the 15-minute grid within their range, so a number past
  // either end becomes that end. null when empty; NaN when it isn't a number,
  // or isn't above zero where it has to be.
  const HOUR_RANGES = { cardHours: [STEP, DAY_HOURS] };
  function readHours(id) {
    const v = readNumber(id), [min, max] = HOUR_RANGES[id];
    if (v === null || Number.isNaN(v)) return v;
    if (min > 0 && v <= 0) return NaN;
    return Math.min(max, Math.max(min, snap(v)));
  }
  // Leaving an hours field shows the value it will be saved as.
  function tidyHours(e) {
    const v = readHours(e.target.id);
    if (isNum(v)) e.target.value = fmtNum(v);
  }

  // A time of day typed as 2300, 23:00, 7:30, 730 or 7, on the 15-minute
  // grid: null when empty, NaN when it isn't one.
  function readClock(id) {
    const s = $(id).value.trim(), m = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(s);
    if (!s) return null;
    if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return NaN;
    return Math.min(DAY_HOURS - STEP, snap(+m[1] + +(m[2] || 0) / 60));
  }

  // Pinned at is for the baseline's cards, while they aren't going inside another.
  function renderPinField() {
    $("cardPinField").hidden = !S.editing || S.editing.key !== "base" || (!$("cardInField").hidden && !!$("cardIn").value);
  }

  // Under the hours of a card with cards inside it: those, and the block's total.
  function renderInnerNote() {
    const inner = S.editing ? S.editing.inner : [], h = readHours("cardHours");
    $("cardInnerNote").hidden = !inner.length;
    $("cardInnerNote").textContent = `+ ${inner.map(c => `${c.title} ${fmtH(c.hours)}`).join(" + ")} inside${isNum(h) ? ` = ${fmtH(h + sum(inner.map(c => c.hours)))}` : ""}`;
  }

  function saveCard() {
    const editing = S.editing;
    if (!editing) return;
    const title = cleanText($("cardTitle").value);
    const hours = readHours("cardHours");
    const inTitle = $("cardInField").hidden ? "" : $("cardIn").value;
    const pos = POSITIONS.includes($("cardPos").value) ? $("cardPos").value : "middle";
    const setPin = !$("cardPinField").hidden, pinAt = setPin ? readClock("cardPin") : null;
    if (!title) { $("cardTitle").focus(); return alert("Give the card a name."); }
    if (!isNum(hours)) { $("cardHours").focus(); return alert("Enter how many hours, e.g. 1.5 (in 15-minute steps)."); }
    if (Number.isNaN(pinAt)) { $("cardPin").focus(); return alert("Enter the time it starts, like 2300 or 7:30 — or leave it empty."); }
    if (!editing.days.size) return alert(editing.key === "base" ? "Pick at least one day." : "Pick at least one day, or No day to keep it in Tasks.");
    const list = A.listFor(editing.key), days = [...editing.days].sort((a, b) => a - b);
    const card = editing.id ? list.cards.find(c => c.id === editing.id) : null;
    if (editing.id && !card) {
      closeEditor();
      A.renderAll();
      return alert("That card was changed on another device, so nothing was saved.");
    }
    // On each day it goes inside that day's card picked under Inside (the one
    // it's already inside, where it is), at the position picked under Where,
    // if there's one; else it's on its own.
    const cur = card && card.parentId && list.cards.find(c => c.id === card.parentId);
    const holderOn = d => {
      const p = !inTitle ? null : cur && cur.day === d && cur.title.toLowerCase() === inTitle ? cur
        : d === null ? null : list.cards.find(c => c.day === d && c !== card && !c.parentId && c.title.toLowerCase() === inTitle);
      return p && !A.sameKind(p, { title }) ? p : null;
    };
    const parentOn = d => (holderOn(d) || { id: null }).id;
    // The time it's pinned at: as typed on the baseline; in a week a card
    // keeps its own, and a new one has none. Only a card on its own on a day has one.
    const pin = setPin ? pinAt : card ? card.pin : null;
    const pinOn = d => (d === null || parentOn(d) ? null : pin);
    const newCard = day => ({ id: newId(), title, hours, day, goalId: null, base: false, parentId: parentOn(day), pos, pin: pinOn(day) });
    // Adds a new card before the card `before` (AUTO: wherever autoSpot puts
    // it; a pinned one always goes there), or into a matching card next to that spot.
    const add = (c, before) => {
      const spot = c.day === null || c.parentId ? null : A.pinned(c) || before === AUTO ? A.autoSpot(list, c.day, c) : before;
      const into = A.mergeTarget(list, c, c.day, c.parentId, c.pos, spot);
      if (into) into.hours += c.hours;
      else A.insertCard(list, c, spot);
    };
    if (card) {
      const wasPinned = A.pinned(card), orig = card.pin;
      Object.assign(card, { title, hours });
      // The card stays where it is if its day is still picked, else moves to the
      // first picked day that doesn't have it yet. Each other picked day gets a
      // copy, unless it has the card already (in the same place, else anywhere
      // on that day; pinned at the same time if this one was pinned, else
      // preferably not pinned): that one stays where it is and takes the hours
      // shown here (and on the baseline the time), so picking days makes them match this card.
      const twinOn = d => {
        const like = list.cards.filter(c => c !== card && d !== null && c.day === d && A.sameKind(c, card));
        for (const tier of wasPinned ? [like.filter(c => c.pin === orig)] : [like.filter(c => !A.pinned(c)), like]) {
          const c = tier.find(x => A.inPlace(x, d, parentOn(d), pos)) || tier[0];
          if (c) return c;
        }
        return null;
      };
      const open = days.filter(d => !twinOn(d));
      const home = editing.days.has(card.day) ? card.day : open.length ? open[0] : days[0];
      card.pin = pinOn(home);
      if (!A.inPlace(card, home, parentOn(home), pos) || (A.pinned(card) && card.pin !== orig)) A.moveCard(list, card.id, home, AUTO, parentOn(home), pos);
      else A.settle(list, card);
      days.filter(d => d !== home).forEach(d => {
        const twin = twinOn(d);
        if (!twin) return add(newCard(d), AUTO);
        twin.hours = hours;
        if (setPin && !twin.parentId && twin.pin !== pin) {
          twin.pin = pin;
          if (A.pinned(twin)) A.moveCard(list, twin.id, d, AUTO, null, twin.pos);
        }
      });
    } else {
      days.forEach(day => add(newCard(day), day === editing.at.day ? editing.at.before : AUTO));
    }
    // Its title's colour: the one it had, when it's renamed to a new title and
    // no card on show keeps the old one; and one picked here, which swaps with
    // the title that had it.
    const key = A.titleKey(title), { oldKey, carry, pick } = editing, colors = S.data.colors;
    if (carry && key !== oldKey && !colors[key] && colors[oldKey] && !A.keyOnShow(oldKey)) {
      colors[key] = colors[oldKey];
      delete colors[oldKey];
    }
    if (pick) A.pickColor(key, pick);
    closeEditor();
    A.save();
    A.renderAll();
  }

  function deleteCard() {
    if (!S.editing) return;
    const { key, id } = S.editing;
    closeEditor();
    removeCard(key, id);
  }

  // Deletes a card (from its editor, or Alt+click on it). Cards inside it
  // stay on the day, on their own.
  function removeCard(key, id) {
    const list = A.listFor(key), card = list.cards.find(c => c.id === id);
    if (card) {
      const inner = A.innerCards(list, card);
      list.cards = list.cards.filter(c => c !== card);
      inner.forEach(c => { c.parentId = null; A.settle(list, c); });
      A.save();
    }
    A.renderAll();
  }

  Object.assign(A, {
    defineCardOverlay, openCardEditor, onDayPill, applyPreset, clearDays, renderColors, typedKey, cardOwn, renderCardColors,
    onColorClick, HOUR_RANGES, readHours, tidyHours, readClock, renderPinField, renderInnerNote,
    saveCard, deleteCard, removeCard
  });
})(Kyoshi, Kyoshi.apps.momo);
