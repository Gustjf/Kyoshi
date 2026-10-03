/* Momo · drop.js — the rest of working the board with a pointer: previewing where a dragged
 * card lands (drop lines, day totals), scrolling near the edges, committing the drop (a card
 * drawn from a task is added there; another app's card dropped in Tasks goes, its need back
 * there), resizing a card from its bottom edge, and clicks and keys on the board and Tasks
 * (open a card, a task or an event, pin a card, add one in free time, Alt+click to delete, but
 * not a card whose day its app sets). A card Momo placed (model.js auto) that's moved, resized
 * or pinned is yours from then on. drag.js picks cards up. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { sum, fmtNum } = K.util;
  const { DAY_HOURS, STEP, EDGE_PX, clampHours } = A;

  function paintTarget(t, card) {
    const drag = S.drag, prev = drag.target;
    if (prev && prev.col && (!t || t.col !== prev.col || t.moves)) resetColPreview(prev.col);
    // The card's own day shows its total without the card while it's headed
    // elsewhere (a group drag keeps every card on its day).
    if (drag.home && (!t || t.moves || t.col !== drag.home)) previewCol(drag.home, +drag.home.dataset.total - (t && !t.moves ? drag.hours : 0));
    A.root.querySelectorAll(".card.drop-into").forEach(el => el.classList.remove("drop-into"));
    $("tasks").classList.toggle("drop-target", !!(t && t.park));
    if (!t || !t.col) return hideDropLine();
    if (t.moves) return paintGroup(t.moves);
    const total = +t.col.dataset.total + (card.day === t.day ? 0 : drag.hours);
    t.col.classList.add("drop-target");
    previewCol(t.col, total);
    const ring = t.into || t.parent; // the card it merges into or goes inside
    if (ring) {
      const ringEl = [...t.col.querySelectorAll(".card")].find(el => el.dataset.id === ring.id);
      if (ringEl) ringEl.classList.add("drop-into");
      drawLines(ringEl && !t.into ? [innerLine(ringEl, t.pos, t.before)] : []);
    } else {
      drawLines([dropLine(t.col, t.before)]);
    }
  }

  // A group drag shows where each card lands on its own day: a line, ringing
  // the card it goes inside, if any.
  function paintGroup(moves) {
    const spots = moves.map(m => {
      const col = !m.stay && A.root.querySelector(`#board .col[data-day="${m.day}"]`);
      if (!col) return null;
      const find = id => (id && [...col.querySelectorAll(".card")].find(el => el.dataset.id === id)) || null;
      return { m, col, before: find(m.beforeId), block: find(m.parentId) };
    }).filter(s => s && (!s.m.parentId || s.block));
    // Every ring goes on before any line is measured, which would restart their fade-in.
    spots.forEach(s => { if (s.block) s.block.classList.add("drop-into"); });
    drawLines(spots.map(s => (s.block ? innerLine(s.block, s.m.pos, s.before) : dropLine(s.col, s.before))));
  }

  // The line inside a card showing where in it the dragged card would go.
  function innerLine(block, pos, before) {
    const r = block.getBoundingClientRect();
    const group = [...block.children].filter(c => c.matches(".card.inner") && c.dataset.pos === pos && !A.isMoving(c));
    const rest = block.querySelector(":scope > .card-rest"), own = block.querySelector(":scope > .card-own") || block;
    let y;
    if (before) y = before.getBoundingClientRect().top - 2.5;
    else if (group.length) y = group[group.length - 1].getBoundingClientRect().bottom;
    else if (pos === "top") y = r.top + 1;
    else if (pos === "bottom") y = r.bottom - 4;
    else if (rest) y = rest.getBoundingClientRect().top - 2.5;
    else { const o = own.getBoundingClientRect(); y = o.top + o.height / 2 - 1.5; }
    return { left: r.left + 8, width: r.width - 14, top: y };
  }

  function resetColPreview(col) {
    col.classList.remove("drop-target");
    previewCol(col, +col.dataset.total);
  }

  // A day's total as it would be after the drop or resize, coloured the way the
  // redraw will show it: red over 24 hours, green at exactly 24.
  function previewCol(col, total) {
    col.classList.toggle("over", total > DAY_HOURS);
    col.classList.toggle("full", total === DAY_HOURS);
    col.querySelector(".col-sum").textContent = fmtNum(total);
    col.querySelector(".col-bar span").style.width = `${Math.min(100, total / DAY_HOURS * 100)}%`;
  }

  // The line in a day showing where the dragged card would go: under the card
  // above that spot, where it would start (so over any free time before a
  // pinned card, not just above that card).
  function dropLine(col, before) {
    const body = col.querySelector(".col-body").getBoundingClientRect();
    const cards = [...col.querySelectorAll(".col-body > .card")].filter(c => !A.isMoving(c));
    const above = cards[(before ? cards.indexOf(before) : cards.length) - 1];
    return { left: body.left + 6, width: body.width - 12, top: above ? above.getBoundingClientRect().bottom + 0.5 : body.top + 3 };
  }

  // Shows those lines (one per day a group drag lands on), hiding any left over.
  function drawLines(lines) {
    const box = $("dropLines");
    while (box.children.length < lines.length) {
      const el = document.createElement("div");
      el.className = "drop-line";
      box.appendChild(el);
    }
    [...box.children].forEach((el, i) => {
      const l = lines[i];
      el.style.display = l ? "block" : "none";
      if (l) Object.assign(el.style, { left: `${l.left}px`, width: `${l.width}px`, top: `${l.top}px` });
    });
  }
  const hideDropLine = () => drawLines([]);

  // Scrolls the page (and the board, on narrow screens) while the pointer is
  // near an edge during a drag or resize.
  function autoScroll() {
    const p = S.drag || S.resize;
    if (!p) return;
    const wrap = $("boardWrap"), y0 = window.scrollY, x0 = wrap.scrollLeft;
    const vh = window.innerHeight;
    if (p.y < EDGE_PX) window.scrollBy(0, -Math.ceil((EDGE_PX - p.y) / 3));
    else if (p.y > vh - EDGE_PX) window.scrollBy(0, Math.ceil((p.y - vh + EDGE_PX) / 3));
    if (S.drag) {
      const r = wrap.getBoundingClientRect();
      if (p.y > r.top && p.y < r.bottom) {
        if (p.x < r.left + EDGE_PX) wrap.scrollLeft -= Math.ceil((r.left + EDGE_PX - p.x) / 3);
        else if (p.x > r.right - EDGE_PX) wrap.scrollLeft += Math.ceil((p.x - r.right + EDGE_PX) / 3);
      }
    }
    if (window.scrollY !== y0 || wrap.scrollLeft !== x0) {
      if (S.drag) A.findTarget();
      else applyResize();
    }
    p.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(commit) {
    const d = S.drag;
    S.drag = null;
    cancelAnimationFrame(d.raf);
    clearTimeout(d.holdTimer);
    d.ghost.remove();
    hideDropLine();
    [d.el, ...d.twinEls].forEach(el => el.classList.remove("dragging"));
    document.body.classList.remove("is-dragging");
    $("tasks").classList.remove("drop-target");
    A.swallowClick();
    if (commit && d.target && d.target.moves) {
      dropGroup(A.listFor(d.key), d.id, d.twins, d.target.spot);
      A.save();
    } else if (commit && d.target) {
      const t = d.target, list = A.listFor(d.key), card = list.cards.find(c => c.id === d.id);
      if (t.park && card && card.need) return A.removeCard(d.key, d.id); // another app's: its need waits in Tasks again
      if (d.draw) list.cards.push(d.draw); // drawn from a task: a new card, off any day until it moves onto this one
      A.moveCard(list, d.id, t.day, t.before ? t.before.dataset.id : null, t.parent ? t.parent.id : null, t.pos);
      touch(list, d.id);
      A.save();
    }
    A.renderAll();
  }

  // A card you moved, resized or pinned is yours: Momo no longer moves it, nor takes it back (place.js).
  function touch(list, id) {
    const card = list.cards.find(c => c.id === id);
    if (card) card.auto = false;
  }

  // Drops a group drag: each card goes to its spot on its own day.
  function dropGroup(list, id, twins, spot) {
    if (!list.cards.some(c => c.id === id)) return;
    A.groupMoves(list, [id, ...twins], spot).filter(m => !m.stay).forEach(m => A.moveCard(list, m.id, m.day, m.beforeId, m.parentId, m.pos));
  }

  // Resizing: dragging a card's bottom edge changes its hours in 15-minute steps.
  // In a block with cards inside, each part has its own edge, and the block grows with it.
  function startResize(e, cardEl) {
    e.preventDefault();
    const list = A.shownList(), card = list.cards.find(c => c.id === cardEl.dataset.id);
    if (!card) return;
    // When its edge is: where the card ends, or its own hours below any cards in its middle.
    const at = A.startTimes(list, A.daySchedule(list, card.day).rows).get(card.id).at;
    const edge = at + card.hours + sum(A.innerCards(list, card).filter(c => c.pos === "middle").map(c => c.hours));
    S.resize = { id: card.id, key: A.shownKey(), col: cardEl.closest(".col"), pointerId: e.pointerId, y0: e.clientY, scroll0: window.scrollY, edge, h0: card.hours, hours: card.hours, x: e.clientX, y: e.clientY, raf: 0 };
    cardEl.classList.add("resizing");
    document.body.classList.add("is-resizing");
    try { cardEl.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    S.resize.raf = requestAnimationFrame(autoScroll);
  }

  // The edge follows the pointer along the ruler, and the day is redrawn on
  // the ruler as it is, so the times and free time below it keep up.
  function applyResize() {
    const resize = S.resize;
    const moved = resize.y - resize.y0 + window.scrollY - resize.scroll0;
    const hours = clampHours(resize.h0 + A.rulerTime(A.rulerY(resize.edge) + moved) - resize.edge);
    if (hours === resize.hours) return;
    resize.hours = hours;
    const total = +resize.col.dataset.total - resize.h0 + hours;
    previewCol(resize.col, total);
    const d = +resize.col.dataset.day, list = A.readList(resize.key), sim = { cards: list.cards.map(c => (c.id === resize.id ? { ...c, hours } : c)) };
    resize.col.querySelector(".col-body").innerHTML = A.dayHTML(sim, d, A.dayPlan(sim, d, false), total, false);
    const el = [...resize.col.querySelectorAll(".card")].find(x => x.dataset.id === resize.id);
    el.classList.add("resizing");
    try { el.setPointerCapture(resize.pointerId); } catch (err) { /* the pointer is already gone */ }
    A.paintClip();
  }

  function endResize(commit) {
    const r = S.resize;
    S.resize = null;
    cancelAnimationFrame(r.raf);
    document.body.classList.remove("is-resizing");
    A.swallowClick();
    if (commit && r.hours !== r.h0) {
      const card = A.listFor(r.key).cards.find(c => c.id === r.id);
      if (card) {
        Object.assign(card, { hours: r.hours, auto: false });
        A.save();
      }
    }
    A.renderAll();
  }

  // A click on another app's event opens its pop-up (triage.js); on a pin it
  // pins or unpins its card; on free time it adds a card there (free time
  // before a pinned card: in it; at the end of a day: last); on a card it
  // opens it, and on a task a new card like the ones it draws. With Alt held
  // (Option on a Mac), a click anywhere on a card (its pin too) deletes it
  // instead, and one on free time, a task or an event does nothing; Ctrl+Z
  // brings the card back.
  function onBoardClick(e) {
    if (S.suppressClick || A.isLocked()) return;
    const ev = e.target.closest("[data-ev]");
    if (ev) return e.altKey ? undefined : A.openEvent(ev.dataset.ev);
    if (e.altKey) {
      const cardEl = e.target.closest(".card"), card = cardEl && A.shownList().cards.find(c => c.id === cardEl.dataset.id);
      if (card && !cardEl.dataset.task && !A.isDated(card)) A.removeCard(A.shownKey(), card.id); // a meal's, say: changed in its app
      return;
    }
    const pin = e.target.closest(".pin");
    if (pin) return togglePin(pin.closest(".card").dataset.id);
    const free = e.target.closest(".free");
    if (free) {
      if (free.dataset.addDay === undefined) return; // how far over the day is
      return A.openCardEditor(null, { day: +free.dataset.addDay, before: free.dataset.before || null, room: +free.dataset.h });
    }
    const cardEl = e.target.closest(".card");
    if (cardEl) openCard(cardEl);
  }

  // Opens a card in its editor, or for a task a new card like the ones it draws.
  const openCard = el => (el.dataset.task ? A.openTask(el.dataset.task) : A.openCardEditor(el.dataset.id));

  // A pin holds its card at the time it starts now; unpinned, it starts
  // where the card above it ends again.
  function togglePin(id) {
    const list = A.listFor(A.shownKey()), card = list.cards.find(c => c.id === id);
    if (!card || card.day === null || card.parentId) return;
    const row = A.daySchedule(list, card.day).rows.find(r => r.card === card);
    card.pin = A.pinned(card) ? null : Math.min(DAY_HOURS - STEP, row.start);
    card.auto = false;
    if (!A.pinned(card)) A.settle(list, card);
    A.save();
    A.renderAll();
  }

  function onCardKey(e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card, .card-own") && !A.isLocked()) {
      e.preventDefault();
      openCard(e.target.closest(".card"));
    }
  }

  Object.assign(A, { paintTarget, autoScroll, endDrag, dropGroup, startResize, applyResize, endResize, onBoardClick, onCardKey });
})(Kyoshi, Kyoshi.apps.momo);
