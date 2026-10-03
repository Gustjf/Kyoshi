/* Momo · drag.js — picking cards up and working out where they'd land.
 * Pointer Events cover mouse, touch and pen alike. Cards can be reordered within a
 * day, moved between days, or dropped into Tasks, taking them off their day. A task
 * there is drawn from instead: dragging it brings a new card (tasks.js), and it stays.
 * While dragging, the day under the pointer previews its new total and turns red if
 * the card would push it past 24 hours (drop.js paints that and commits the drop).
 * Holding Ctrl (or ⌘) while dragging, or holding a touch still a little longer before
 * moving, makes it a group drag: the same card on every other day comes along, each
 * staying on its own day and going right after the same card there (see groupMoves). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { DAY_HOURS, POSITIONS, DRAG_START_PX, TOUCH_HOLD_MS, TOUCH_GROUP_MS, TOUCH_SLOP_PX, fmtClock } = A;

  function onBoardPointerDown(e) {
    if (S.press || S.drag || S.resize || e.button !== 0 || e.altKey || A.isLocked()) return; // Alt+click deletes (onBoardClick)
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    if (e.target.classList.contains("grip")) return A.startResize(e, cardEl);
    if (e.target.closest(".pin")) return;
    if (cardEl.classList.contains("pinned") || cardEl.classList.contains("set")) { // it stays put (set in its app, too): a click opens it, a drag wiggles its pin
      if (e.pointerType !== "mouse") return;
      e.preventDefault();
      S.stuck = { el: cardEl, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
      return;
    }
    if (e.pointerType === "mouse") e.preventDefault(); // no text selection or native drag
    S.press = { id: cardEl.dataset.id, task: cardEl.dataset.task || null, el: cardEl, pointerId: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, ctrl: e.ctrlKey || e.metaKey, timer: 0 };
    if (e.pointerType !== "mouse") S.press.timer = setTimeout(() => { if (S.press) startDrag(); }, TOUCH_HOLD_MS);
  }

  function onPointerMove(e) {
    const { press, drag, resize, stuck } = S;
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.ctrl = e.ctrlKey || e.metaKey;
      if (drag.holdTimer && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > TOUCH_SLOP_PX) { clearTimeout(drag.holdTimer); drag.holdTimer = 0; }
      setGroup();
      moveGhost();
      findTarget();
    } else if (resize) {
      if (e.pointerId !== resize.pointerId) return;
      resize.y = e.clientY;
      A.applyResize();
    } else if (press && e.pointerId === press.pointerId) {
      press.x = e.clientX;
      press.y = e.clientY;
      press.ctrl = e.ctrlKey || e.metaKey;
      const dist = Math.hypot(press.x - press.x0, press.y - press.y0);
      if (press.type === "mouse") { if (dist > DRAG_START_PX) startDrag(); }
      else if (dist > TOUCH_SLOP_PX) cancelPress(); // moved before the hold: it's a scroll
    } else if (stuck && e.pointerId === stuck.pointerId && !stuck.moved && Math.hypot(e.clientX - stuck.x0, e.clientY - stuck.y0) > DRAG_START_PX) {
      stuck.moved = true;
      nudgePin(stuck.el);
    }
  }

  function onPointerUp(e) {
    if (S.stuck) {
      if (S.stuck.moved) swallowClick(); // it was a drag, not a click to open it
      S.stuck = null;
    }
    if (S.drag && e.pointerId === S.drag.pointerId) A.endDrag(true);
    else if (S.resize && e.pointerId === S.resize.pointerId) A.endResize(true);
    else cancelPress();
  }

  // Wiggles a pinned card's pin when it's dragged (or cut, when it's set in its app): it stays where it's pinned.
  function nudgePin(cardEl) {
    const pin = cardEl.querySelector(".pin, .set-pin");
    if (!pin) return;
    pin.classList.remove("nudge");
    void pin.offsetWidth; // restarts the animation
    pin.classList.add("nudge");
    pin.addEventListener("animationend", () => pin.classList.remove("nudge"), { once: true });
  }

  function onPointerCancel(e) {
    S.stuck = null;
    if (S.drag && e.pointerId === S.drag.pointerId) A.endDrag(false);
    else if (S.resize && e.pointerId === S.resize.pointerId) A.endResize(false);
    else cancelPress();
  }

  function cancelPress() {
    if (!S.press) return;
    clearTimeout(S.press.timer);
    S.press = null;
    if (S.renderPending) setTimeout(A.renderAll, 0); // after the tap's click has opened its card
  }

  // The click that follows a drag or resize isn't a tap on the card.
  function swallowClick() {
    S.suppressClick = true;
    setTimeout(() => { S.suppressClick = false; }, 0);
  }

  function startDrag() {
    const p = S.press;
    S.press = null;
    clearTimeout(p.timer);
    // Drawn from a task: a new card, added where it's dropped; the task stays for next time.
    const list = A.shownList(), task = p.task && A.taskBy(p.task), draw = task ? A.drawCard(task) : null;
    const card = draw || list.cards.find(c => c.id === p.id);
    const rect = p.el.getBoundingClientRect();
    const ghost = draw ? htmlElement(A.cardHTML(list, draw)) : p.el.cloneNode(true), parked = !ghost.querySelector(".card-time");
    ghost.classList.add("ghost");
    ghost.removeAttribute("tabindex");
    if (!parked) ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    // A parked card has no time yet: the ghost gets one to show where it lands,
    // and widens to fit it rather than squeezing the title.
    if (parked) (ghost.querySelector(":scope > .card-own") || ghost).insertAdjacentHTML("afterbegin", `<span class="card-time" hidden><span class="clock"></span></span>`);
    A.root.appendChild(ghost); // inside Momo's root, so its styles apply
    const twins = twinsOf(list, card), twinIds = new Set(twins.map(c => c.id));
    const drag = S.drag = { id: card ? card.id : p.id, draw, key: A.shownKey(), el: p.el, home: p.el.closest("#board .col"), hours: card ? A.blockHours(list, card) : 0, ghost, pointerId: p.pointerId, offX: p.x0 - rect.left, offY: p.y0 - rect.top, x0: p.x, y0: p.y, x: p.x, y: p.y, target: null, raf: 0,
      twins: [...twinIds], twinEls: [...A.root.querySelectorAll("#board .card")].filter(el => twinIds.has(el.dataset.id)), ctrl: p.ctrl, held: false, group: false, holdTimer: 0 };
    if (!draw) p.el.classList.add("dragging");
    document.body.classList.add("is-dragging");
    try { p.el.setPointerCapture(p.pointerId); } catch (err) { /* the pointer is already gone */ }
    if (p.type !== "mouse" && navigator.vibrate) navigator.vibrate(8);
    if (p.type !== "mouse" && twins.length) drag.holdTimer = setTimeout(() => {
      drag.holdTimer = 0;
      drag.held = true;
      if (navigator.vibrate) navigator.vibrate(16);
      if (setGroup()) findTarget();
    }, TOUCH_GROUP_MS);
    setGroup();
    moveGhost();
    findTarget();
    drag.raf = requestAnimationFrame(A.autoScroll);
  }

  // An element made from HTML (the ghost of a card drawn from a task, which isn't on the page).
  function htmlElement(html) {
    const box = document.createElement("div");
    box.innerHTML = html;
    return box.firstElementChild;
  }

  // The same card on each of the board's other days (none for a parked card,
  // or another app's, which is one of a kind: model.js sameKind), leaving
  // pinned ones where they are. Where a day has more than one, it's the one in
  // the same kind of place: on its own, or inside a card like the one it's in,
  // at the same position.
  function twinsOf(list, card) {
    if (!card || card.day === null) return [];
    const holder = c => c.parentId && list.cards.find(p => p.id === c.parentId);
    const parent = holder(card);
    const fit = c => { const p = holder(c); return parent ? (p && A.sameKind(p, parent) ? 2 + (c.pos === card.pos) : 0) : p ? 0 : 2; };
    const best = new Map();
    list.cards.forEach(c => {
      if (c.day === null || c.day === card.day || !A.sameKind(c, card) || A.pinned(c)) return;
      if (!best.has(c.day) || fit(c) > fit(best.get(c.day))) best.set(c.day, c);
    });
    return [...best.values()];
  }

  // Turns a group drag on or off to match Ctrl and the touch hold; true if it changed.
  function setGroup() {
    const drag = S.drag, on = drag.twins.length > 0 && (drag.ctrl || drag.held);
    if (on === drag.group) return false;
    drag.group = on;
    drag.twinEls.forEach(el => el.classList.toggle("dragging", on));
    drag.ghost.classList.toggle("group", on);
    return true;
  }

  // Whether a card element is on the move: the dragged card, or one of its twins in a group drag.
  const isMoving = el => el === S.drag.el || (S.drag.group && S.drag.twinEls.includes(el));

  function moveGhost() {
    S.drag.ghost.style.transform = `translate(${S.drag.x - S.drag.offX}px, ${S.drag.y - S.drag.offY}px) rotate(1.5deg)`;
  }

  // Works out where the card would land: a spot in a day, a spot inside a card
  // (over the middle of it, or over a card already inside it), a card it
  // would merge into, or Tasks, taking it off its day (another app's card goes,
  // and its need waits there again). Neither a group drag nor a card drawn from
  // a task can go into Tasks, nor another app's card whose day its app sets (a
  // meal, something done, one set in its app), and nothing on the baseline can
  // (its cards are all on days). A group drag's cards don't merge on the way:
  // the spot is mirrored onto each one's day.
  function findTarget() {
    const drag = S.drag, list = A.readList(drag.key), card = drag.draw || list.cards.find(c => c.id === drag.id);
    const el = document.elementFromPoint(drag.x, drag.y);
    const col = el && el.closest("#board .col");
    const park = !col && !drag.group && !drag.draw && drag.key !== "base" && !(card && (A.isDated(card) || A.isFixed(card))) && el && el.closest("#tasks");
    let t = null;
    if (card && col) {
      const day = +col.dataset.day;
      const others = [...col.querySelectorAll(".col-body > .card")].filter(c => !isMoving(c));
      const spot = spotInside(list, card, el, others);
      const parent = spot ? spot.parent : null, parentId = parent ? parent.id : null, pos = spot ? spot.pos : card.pos;
      const before = spot ? spot.before : others.find(c => { const r = c.getBoundingClientRect(); return drag.y < r.top + r.height / 2; }) || null;
      const into = drag.group || (parentId && A.inPlace(card, day, parentId, pos)) ? null : A.mergeTarget(list, card, day, parentId, pos, before ? before.dataset.id : null);
      t = { day, col, before, parent, pos, into };
      if (drag.group) {
        t.spot = { day, parentId, pos, beforeId: before ? before.dataset.id : null };
        t.moves = groupMoves(list, [card.id, ...drag.twins], t.spot);
      }
    } else if (card && park) {
      t = { day: null, park: true };
    }
    A.paintTarget(t, card);
    drag.target = t;
    showGhostTimes(list, card, t);
  }

  // Shows on the ghost when the card would start where it's headed, worked
  // out by making the drop on a copy of the board (nothing, over Tasks or
  // nowhere). In a group drag, that's where it lands on its own day.
  function showGhostTimes(list, card, t) {
    const drag = S.drag;
    let times = null, top = drag.id;
    if (card && t && t.day !== null) {
      const sim = JSON.parse(JSON.stringify(list));
      if (drag.draw) sim.cards.push({ ...drag.draw });
      if (t.moves) A.dropGroup(sim, drag.id, drag.twins, t.spot);
      else top = (A.moveCard(sim, drag.id, t.day, t.before ? t.before.dataset.id : null, t.parent ? t.parent.id : null, t.pos) || { id: top }).id;
      times = A.startTimes(sim, A.daySchedule(sim, t.moves ? card.day : t.day).rows);
    }
    drag.ghost.querySelectorAll(".card-time").forEach(el => {
      const id = el.closest(".card").dataset.id, when = times && times.get(id === drag.id ? top : id);
      el.hidden = !when;
      if (!when) return;
      el.querySelector(".clock").textContent = fmtClock(when.at);
      el.classList.toggle("clash", when.clash > 0 || when.at >= DAY_HOURS);
    });
  }

  // Where inside another card the dragged one would go, or null if not inside.
  // Over a card already inside it: next to that one. Else over the middle of a
  // card (all but an hour's height at each end, or a third on short cards):
  // the top, middle or bottom third of that stretch picks the position; on
  // cards too short to aim at thirds, it's the middle.
  function spotInside(list, card, el, others) {
    const drag = S.drag, innerEl = el.closest(".card.inner");
    const blockEl = innerEl ? innerEl.parentElement : others.find(c => {
      const r = c.getBoundingClientRect(), edge = Math.min(r.height / 3, A.hourPx());
      return drag.y > r.top + edge && drag.y < r.bottom - edge;
    });
    const parent = blockEl && list.cards.find(c => c.id === blockEl.dataset.id);
    if (!A.canHold(list, parent, card)) return null;
    if (innerEl) {
      const pos = innerEl.dataset.pos, r = innerEl.getBoundingClientRect();
      const group = [...blockEl.children].filter(c => c.matches(".card.inner") && c.dataset.pos === pos);
      const i = group.indexOf(innerEl) + (!isMoving(innerEl) && drag.y < r.top + r.height / 2 ? 0 : 1);
      return { parent, pos, before: group.slice(i).find(c => !isMoving(c)) || null };
    }
    const r = blockEl.getBoundingClientRect(), edge = Math.min(r.height / 3, A.hourPx()), span = r.height - 2 * edge;
    const third = Math.floor((drag.y - r.top - edge) / span * 3);
    return { parent, pos: span < 24 ? "middle" : POSITIONS[Math.max(0, Math.min(2, third))], before: null };
  }

  // Where each card in a group drag goes: every one stays on its own day, at
  // the spot there that matches the one picked (spot, on spot.day). That's
  // inside that day's card like the one picked, if there is one, and right
  // after that day's card like the one just above the spot (Commute dropped
  // under Sleep goes under Sleep on every day). A day without that card goes
  // by the nearest one above it that the day has, else the card goes to the
  // top. A card with nothing there to go inside stays where it is.
  function groupMoves(list, ids, spot) {
    const skip = new Set(ids), byId = id => list.cards.find(c => c.id === id);
    const parent = spot.parentId ? byId(spot.parentId) : null;
    // The cards in a place, in order, besides the ones moving.
    const at = (day, p) => list.cards.filter(c => !skip.has(c.id) && (p ? c.parentId === p.id && c.pos === spot.pos : c.day === day && !c.parentId));
    const ref = at(spot.day, parent), i = ref.findIndex(c => c.id === spot.beforeId), k = i < 0 ? ref.length : i;
    return ids.map(byId).filter(c => c && c.day !== null).map(c => {
      const p = !parent ? null : c.day === spot.day ? parent : list.cards.find(x => x.day === c.day && !x.parentId && !skip.has(x.id) && A.sameKind(x, parent));
      if (parent && !A.canHold(list, p, c)) return { id: c.id, day: c.day, stay: true };
      let beforeId = spot.beforeId;
      if (c.day !== spot.day) {
        const mine = at(c.day, p);
        const after = ref.slice(0, k).reverse().map(r => mine.find(m => A.sameKind(m, r))).find(Boolean) || null;
        const before = after ? mine[mine.indexOf(after) + 1] : mine[0];
        beforeId = before ? before.id : null;
      }
      return { id: c.id, day: c.day, parentId: p ? p.id : null, pos: spot.pos, beforeId };
    });
  }

  Object.assign(A, {
    onBoardPointerDown, onPointerMove, onPointerUp, onPointerCancel, cancelPress, swallowClick, nudgePin,
    setGroup, isMoving, findTarget, groupMoves
  });
})(Kyoshi, Kyoshi.apps.momo);
