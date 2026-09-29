/* Momo · times.js — times of day and the board's ruler.
 * TIMES OF DAY: a day runs from 0000 at the top to 2400. Each card on its own starts
 * where the one above it ends, so moving a card is how it gets its time. A pinned
 * card starts at its own time instead: the time left before it is free (a gap),
 * and cards above that run past its time clash with it. Cards inside a card take
 * their times from its block.
 * THE RULER: every day on the board hangs from one ruler, 0000 at the top, so cards
 * at the same time line up across the week. An hour is --momo-hour tall, except
 * where a short card or bit of free time on some day needs more room for its text:
 * that stretch of time is taller on every day. Each piece of a day (a card, a part
 * of a card with others inside it, free time) is as tall as its time on the ruler,
 * less the space around it. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { sum } = K.util;
  const { DAY_HOURS, snap } = A;

  // ==========================================================================
  // TIMES OF DAY
  // ==========================================================================
  // A day's cards on their own, in order, each with when it starts and ends,
  // the free time before it (gap) and how far the cards above run into it
  // (clash); and when the last one ends. skip leaves a card out.
  function daySchedule(list, day, skip = null) {
    let t = 0;
    const rows = list.cards.filter(c => c.day === day && !c.parentId && c !== skip).map(card => {
      const start = A.pinned(card) ? card.pin : t, end = start + A.blockHours(list, card);
      const row = { card, start, end, gap: Math.max(0, start - t), clash: Math.max(0, t - start) };
      t = Math.max(t, end);
      return row;
    });
    return { rows, end: t };
  }

  // When each card of a day's schedule starts, with any clash: id -> { at, clash }.
  // In a block the cards at its top come first, then its own hours (split in
  // half around any in its middle), then those at its bottom.
  function startTimes(list, rows) {
    const times = new Map();
    rows.forEach(({ card, start, clash }) => {
      const inner = A.innerCards(list, card), mid = inner.some(c => c.pos === "middle"), half = snap(card.hours / 2);
      let t = start;
      const put = pos => inner.filter(c => c.pos === pos).forEach(c => { times.set(c.id, { at: t, clash: 0 }); t += c.hours; });
      put("top");
      times.set(card.id, { at: t, clash });
      t += mid ? half : card.hours;
      put("middle");
      if (mid) t += card.hours - half;
      put("bottom");
    });
    return times;
  }

  // Where a card goes on a day when no spot is picked for it: the card to go
  // before, or null for last. A pinned card goes in time order — before the
  // first card pinned later, or unpinned that would run past its time (which
  // then follows it). Another goes into the first free time before a pinned
  // card with room for it, else last.
  function autoSpot(list, day, card) {
    const { rows } = daySchedule(list, day, card), h = A.blockHours(list, card);
    const row = A.pinned(card) ? rows.find(r => (A.pinned(r.card) ? r.card.pin > card.pin : r.end > card.pin)) : rows.find(r => r.gap >= h);
    return row ? row.card.id : null;
  }

  // The days (of those given) whose cards don't fit around their pinned
  // times: some run into a pinned card, or past midnight on a day that isn't
  // overbooked.
  const timeTrouble = (list, days) => days.filter(d => {
    const { rows, end } = daySchedule(list, d);
    return rows.some(r => r.clash > 0) || (end > DAY_HOURS && A.dayTotal(list, d) <= DAY_HOURS);
  });

  // ==========================================================================
  // THE RULER
  // ==========================================================================
  const GAP_PX = 4;   // between a day's pieces (.col-body's gap)
  const INSET_PX = 3; // above a card inside another (its margin), and under the last one
  // The least height of a piece, in pixels, to fit its text: two lines for a
  // card (the title, then its time and hours), the label for free time, and
  // the resize edge for the part of a card below the cards in its middle.
  const MIN_PX = { card: 36, own: 36, inner: 34, rest: 8, free: 24 };

  // The height of an hour on the board, in pixels (momo.css: shorter on narrow screens).
  const hourPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--momo-hour")) || 22;

  // A day's pieces as the board draws them, each with a key (a card's id;
  // "own:" or "rest:" and the id of a card with cards inside it, for its own
  // hours above and below any in its middle; "gap:" and a pinned card's id,
  // for the free time before it; "end", for the free time after the last
  // card), when it starts and ends (s, e), the pixels of that taken by the
  // space around it (less) and the least the rest can be (min: none for a
  // card with cards inside, whose parts have theirs). A card on its own also
  // has where the cards above it end (from) and where the next piece starts
  // (to): not its own times when it runs into those cards.
  function dayPieces(list, rows, times, end, locked) {
    const pieces = [], add = (key, s, e, min, less, more) => pieces.push({ key, s, e, min, less, ...more });
    let t = 0;
    rows.forEach(({ card, start, end: e, gap }) => {
      if (gap) add(`gap:${card.id}`, t, start, MIN_PX.free, GAP_PX);
      const inner = A.innerCards(list, card);
      add(card.id, start, e, inner.length ? 0 : MIN_PX.card, GAP_PX, { from: Math.max(t, start), to: Math.max(t, e) });
      if (inner.length) {
        const at = times.get(card.id).at, mid = inner.filter(c => c.pos === "middle"), half = mid.length ? snap(card.hours / 2) : card.hours;
        const parts = [[`own:${card.id}`, at, half, MIN_PX.own, 0], ...inner.map(c => [c.id, times.get(c.id).at, c.hours, MIN_PX.inner, INSET_PX])];
        if (mid.length) parts.push([`rest:${card.id}`, at + half + sum(mid.map(c => c.hours)), card.hours - half, MIN_PX.rest, 0]);
        // The last part with any hours also takes the space under the block, and a card the room under it.
        parts.forEach(([key, s, h, min, inset]) => add(key, s, s + h, min, inset + (h && s + h === e ? GAP_PX + inset : 0)));
      }
      t = Math.max(t, e);
    });
    if (end < DAY_HOURS && !locked) add("end", end, DAY_HOURS, MIN_PX.free, GAP_PX);
    return pieces;
  }

  // The ruler for a board's pieces: ruler.t are the times where any of them
  // starts or ends, and ruler.y how far down the board each is, in whole
  // pixels. Each stretch between two is as tall as its hours at --momo-hour, or
  // taller where a piece needs it: shortest pieces first, each spreading what
  // it lacks evenly over its time, so the longer ones around them can use
  // the room those made.
  function makeRuler(pieces) {
    const hour = hourPx();
    const t = [...new Set([0, DAY_HOURS, ...pieces.flatMap(p => [p.s, p.e])])].sort((a, b) => a - b);
    const index = new Map(t.map((x, i) => [x, i])), h = t.slice(1).map((x, i) => (x - t[i]) * hour);
    pieces.filter(p => p.min && p.e > p.s).sort((a, b) => (a.e - a.s) - (b.e - b.s)).forEach(p => {
      const i = index.get(p.s), j = index.get(p.e), lack = p.min + p.less - sum(h.slice(i, j));
      if (lack > 0) for (let k = i; k < j; k++) h[k] += lack * (t[k + 1] - t[k]) / (p.e - p.s);
    });
    let down = 0;
    return { t, y: [0, ...h.map(x => Math.round(down += x))], hour };
  }

  // How far down the ruler a time is, in pixels (past its last time, an hour
  // is --momo-hour), and the time that far down.
  function rulerY(h) {
    const { t, y, hour } = S.ruler, n = t.length - 1;
    if (h >= t[n]) return y[n] + (h - t[n]) * hour;
    let i = 1;
    while (t[i] < h) i++;
    return y[i - 1] + (y[i] - y[i - 1]) * (h - t[i - 1]) / (t[i] - t[i - 1]);
  }
  function rulerTime(px) {
    const { t, y, hour } = S.ruler, n = t.length - 1;
    if (px >= y[n]) return t[n] + (px - y[n]) / hour;
    let i = 1;
    while (y[i] < px) i++;
    return t[i - 1] + (t[i] - t[i - 1]) * (px - y[i - 1]) / (y[i] - y[i - 1]);
  }

  // Each piece's style by key: its height on the ruler, and for a card that
  // runs into the cards above, the margins that draw it at its own time.
  function pieceStyles(pieces) {
    const px = v => Math.round(v * 100) / 100, styles = new Map();
    pieces.forEach(p => {
      let css = `height:${px(Math.max(0, rulerY(p.e) - rulerY(p.s) - p.less))}px`;
      if (p.from > p.s) css += `;--mt:${px(rulerY(p.s) - rulerY(p.from))}px;--mb:${px(rulerY(p.to) - rulerY(p.e))}px`;
      styles.set(p.key, css);
    });
    return styles;
  }

  Object.assign(A, { daySchedule, startTimes, autoSpot, timeTrouble, GAP_PX, MIN_PX, hourPx, dayPieces, makeRuler, rulerY, rulerTime, pieceStyles });
})(Kyoshi, Kyoshi.apps.momo);
