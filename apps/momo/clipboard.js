/* Momo · clipboard.js — copy, cut & paste cards (keyboard only).
 * Ctrl/⌘+C copies the card under the mouse (or the one focused from the keyboard)
 * and Ctrl/⌘+X cuts it; it's shaded while Ctrl/⌘+V puts it where the mouse is — a
 * copy, or after a cut the card itself and then copies of it — on this board or
 * another. Each paste gives another CLIP_MS for the next, so a card can go onto
 * several days in a row. The shading clears on Esc or CLIP_MS after the last copy,
 * cut or paste, and then there's nothing left to paste. A card with others inside
 * it takes them along. A copy of another app's card keeps its app (its icon and
 * colour) but holds no need nor slot, and isn't set in that app (model.js); one cut
 * and pasted is that card, moved (yours from then on), and never goes into Tasks. A
 * card set in its app (fixed: a meal at its time) can't be cut: its pin wiggles. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { CLIP_MS } = A;

  // What a shortcut points at: the card focused from the keyboard, else
  // whatever is under the mouse.
  function pointedAt() {
    const f = document.activeElement;
    if (f && f.matches(".card, .card-own") && f.matches(":focus-visible")) return { el: f, keyboard: true };
    const el = S.mouse && document.elementFromPoint(S.mouse.x, S.mouse.y);
    return el ? { el, keyboard: false } : null;
  }

  // Ctrl+C or Ctrl+X: marks the card pointed at. False when it isn't at one.
  function clipCard(cut) {
    const at = pointedAt(), cardEl = at && at.el.closest("#board .card, #tasks .card");
    if (!cardEl || S.press || S.drag || S.resize || (cut && A.isLocked())) return false;
    const card = A.shownList().cards.find(c => c.id === cardEl.dataset.id);
    if (!card) return false;
    if (cut && A.isFixed(card)) { A.nudgePin(cardEl); return true; } // it stays: its app sets it
    holdClip(A.shownKey(), card.id, cut);
    paintClip();
    return true;
  }

  // Makes a card the one to paste, for the next CLIP_MS.
  function holdClip(key, id, cut) {
    if (S.clip) clearTimeout(S.clip.timer);
    S.clip = { key, id, cut, timer: setTimeout(clearClip, CLIP_MS) };
  }

  function clearClip() {
    if (!S.clip) return;
    clearTimeout(S.clip.timer);
    S.clip = null;
    paintClip();
  }

  // Shades the card copied or cut, when its board is on screen.
  function paintClip() {
    A.root.querySelectorAll(".card.clip").forEach(el => el.classList.remove("clip", "cut"));
    const clip = S.clip, el = clip && clip.key === A.shownKey() && [...A.root.querySelectorAll("#board .card, #tasks .card")].find(c => c.dataset.id === clip.id);
    if (!el) return;
    el.classList.add("clip");
    el.classList.toggle("cut", clip.cut);
  }

  // Where a paste lands on the board on screen: right after the card pointed
  // at, in the same place — inside the same card, if that one's inside a card
  // that can hold this one, else on its own. Over the rest of a day it goes
  // by height: at the top over its heading, at the end over its free time.
  // Over Tasks, last there, off any day (not on the baseline, whose cards are
  // all on days, nor another app's card cut: it holds its need on a day). A
  // card being moved on this board isn't one to go after,
  // and a pinned card keeps its time (moveCard and placeCard put it in time
  // order on that day). null when it points nowhere.
  function pasteSpot(list, from, card, moving, at, cut) {
    if (at.el.closest("#tasks")) return A.shownKey() === "base" || (cut && card.need) ? null : { day: null, parentId: null, pos: card.pos, beforeId: null };
    const col = at.el.closest("#board .col");
    if (!col) return null;
    const day = +col.dataset.day, over = at.el.closest(".card");
    if (A.pinned(card)) return { day, parentId: null, pos: card.pos, beforeId: null };
    // The card to go before: the first of these whose middle is below y.
    const next = (els, y) => {
      const el = els.find(c => { const r = c.getBoundingClientRect(); return c.dataset.id !== (moving && moving.id) && y < r.top + r.height / 2; });
      return el ? el.dataset.id : null;
    };
    const below = el => el.getBoundingClientRect().bottom;
    if (over && over.matches(".card.inner")) {
      const block = over.parentElement, parent = list.cards.find(c => c.id === block.dataset.id);
      if (A.canHold(from, parent, card)) {
        const pos = over.dataset.pos, group = [...block.children].filter(c => c.matches(".card.inner") && c.dataset.pos === pos);
        return { day, parentId: parent.id, pos, beforeId: next(group, below(over)) };
      }
    }
    const top = over && over.closest(".col-body > .card");
    return { day, parentId: null, pos: card.pos, beforeId: next([...col.querySelectorAll(".col-body > .card")], top ? below(top) : S.mouse.y) };
  }

  // Adds a card from elsewhere (a copy, or one cut from another board), with
  // the cards inside it, to a board at a spot, as a drop there would: into a
  // matching card in that place, if there is one. Returns that card, if so.
  // A pinned card goes in time order, and stops being pinned off a day or
  // inside a card.
  function placeCard(list, [card, ...inner], spot) {
    const parentId = inner.length ? null : spot.parentId;
    Object.assign(card, { day: spot.day, parentId, pos: parentId ? spot.pos : card.pos });
    if (parentId || spot.day === null) card.pin = null;
    inner.forEach(c => { c.day = spot.day; });
    list.cards.push(...inner);
    const beforeId = A.pinned(card) ? A.autoSpot(list, card.day, card) : spot.beforeId;
    const into = A.mergeTarget(list, card, card.day, parentId, card.pos, beforeId);
    if (into) A.absorb(list, into, card);
    else A.insertCard(list, card, beforeId);
    return into;
  }

  // Ctrl+V: pastes the card copied or cut where the shortcuts point. A cut
  // card from the board on screen moves the way a drag does; a copy, or one
  // cut from another board, is added (as your own card, which reloading the
  // baseline leaves alone). It stays ready for the next paste: a cut card,
  // having moved, as a copy of itself from then on — unless it folded into a
  // card there, which leaves nothing to copy. False when there's nothing to
  // paste, or nowhere to put it.
  function pasteCard() {
    const clip = S.clip, at = clip && !S.press && !S.drag && !S.resize && !A.isLocked() && pointedAt();
    if (!at) return false;
    const from = A.readList(clip.key), card = from.cards.find(c => c.id === clip.id);
    if (!card || (clip.cut && ((clip.key !== "base" && from.closed) || A.isFixed(card)))) {
      clearClip();
      return false;
    }
    const key = A.shownKey(), moving = clip.cut && clip.key === key ? card : null;
    const spot = pasteSpot(A.readList(key), from, card, moving, at, clip.cut);
    if (!spot) return false;
    const list = A.listFor(key), group = [card, ...A.innerCards(from, card)];
    let into = null;
    if (moving) {
      into = A.moveCard(list, card.id, spot.day, spot.beforeId, spot.parentId, spot.pos);
      card.auto = false;
    } else if (clip.cut) {
      from.cards = from.cards.filter(c => !group.includes(c));
      group.forEach(c => { c.base = false; });
      card.auto = false;
      into = placeCard(list, group, spot);
    } else {
      placeCard(list, A.copyCards(group, { base: false, need: null, auto: false, slot: null, fixed: false, sleep: false }), spot);
    }
    if (!clip.cut) holdClip(clip.key, clip.id, false);
    else if (into) clearClip();
    else holdClip(key, card.id, false);
    A.save();
    A.renderAll();
    return true;
  }

  Object.assign(A, { clipCard, clearClip, paintClip, pasteCard });
})(Kyoshi, Kyoshi.apps.momo);
