/* Momo · agenda.js — other apps' events (Bosco's doses, …) on the board, at their day and time.
 * They come from K.agenda (core/agenda.js) each time the board is drawn and aren't stored: Momo
 * keeps only the time you moved one to, on its own day (week.events, see model.js).
 * An event counts toward its day's 24 hours. Its place is free time: time no card has, which it
 * takes, or Free time, the buffer, which lends it the hours. Anywhere else it conflicts, with the
 * cards whose time it's in and with any event it overlaps. Cards never move for it.
 * It looks like a card, with its app's icon. Alone in time no card has, it's a piece of the day
 * like any other (the free time split around it). Anywhere else it's drawn over the day at its
 * time: across Free time (or once done) it fills the column, and while it conflicts it's set in and
 * red; the card under it keeps its lines clear of it. One at any time that day is just its app's
 * icon in the day's heading. Its pop-up is triage.js. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, isNum, sum, addDays, now, todayStr } = K.util;
  const { DAYS, DAY_HOURS, DAY_NAMES, DAY_LONG, STEP, FREE_TIME, EVENT_WINDOW, snap, fmtH, fmtClock, dayIndex, firstDay, thisWeekKey, nextWeekKey } = A;

  const PAD_PX = 6;    // .col-body's padding (momo.css): where 0000 is on a day
  const SET_IN = 0.25; // how far a conflicting event is set in, like a card the cards above run into (momo.css)

  const hoursOf = t => +t.slice(0, 2) + +t.slice(3) / 60; // "07:30" -> 7.5
  // The time now on this device, in hours after midnight (time-travel aware).
  const hoursNow = () => { const d = new Date(now()); return d.getHours() + d.getMinutes() / 60; };
  const timed = ev => ev.at !== null && !ev.done; // one done has happened: nothing conflicts with it
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  const within = (a, s, e) => Math.max(0, Math.min(a.end, e) - Math.max(a.start, s)); // a's hours between s and e
  const isSpare = c => c.title.toLowerCase() === FREE_TIME.toLowerCase();

  // A day's time, piece by piece (times.js dayPieces): time no card has ({ free }), and each card
  // or part of one, with its title ({ title, spare: it's Free time }); each from s to e.
  function dayParts(list, d) {
    const { rows, end } = A.daySchedule(list, d), byId = new Map(list.cards.map(c => [c.id, c]));
    return A.dayPieces(list, rows, A.startTimes(list, rows), end, false).map(p => {
      const m = /^(own|rest|gap):(.+)$/.exec(p.key), card = byId.get(m ? m[2] : p.key);
      if (p.key === "end" || (m && m[1] === "gap")) return { s: p.s, e: p.e, free: true };
      if (!card || (!m && A.innerCards(list, card).length)) return null; // a block's outline: its parts count
      return { s: p.s, e: p.e, title: card.title, spare: isSpare(card) };
    }).filter(Boolean);
  }

  // A week's events, each as K.agenda has it plus: key ("app:id"); day (0-6); home, the time its
  // app has, and at, where it is, moved or not (hours after midnight; null for any time that day);
  // start, end and dur, in hours; moved; extra, the hours it adds to its day (all but any Free time
  // lends it; none at any time of day, like a birthday, which takes no time of its own), and loose,
  // those in time no card has; clash, what it conflicts with ({ title, start, end }); and flag, a
  // conflict to show: on a day still to come, not done, the week not closed.
  function weekAgenda(key, list = A.readList(key)) {
    if (key === "base") return [];
    const placed = list.events || {}, first = firstDay(key), days = new Map();
    const partsOf = d => days.get(d) || days.set(d, dayParts(list, d)).get(d);
    const evs = K.agenda(key, addDays(key, 6)).map(e => {
      const k = `${e.app}:${e.id}`, p = placed[k] || {}, home = e.time ? hoursOf(e.time) : null;
      const at = isNum(p.at) ? p.at : home, dur = Math.max(STEP, snap(e.minutes / 60));
      return { ...e, key: k, day: dayIndex(e.date), home, at, start: at, end: at === null ? null : at + dur, dur, moved: at !== home, extra: at === null ? 0 : dur, loose: 0, clash: [], flag: false };
    });
    evs.filter(ev => ev.at !== null).forEach(ev => {
      const parts = partsOf(ev.day);
      ev.extra = ev.dur - sum(parts.filter(q => q.spare).map(q => within(ev, q.s, q.e)));
      ev.loose = sum(parts.filter(q => q.free).map(q => within(ev, q.s, q.e)));
      if (ev.done) return;
      ev.clash = obstacles(evs, parts, ev.day, ev.key).filter(o => overlaps(ev, o));
      ev.flag = ev.clash.length > 0 && ev.day >= first && !list.closed;
    });
    return evs;
  }

  // What an event on a day conflicts with where it overlaps them, besides the event skip (its key):
  // the cards there other than Free time (parts: dayParts), and the other events, as { title, start, end }.
  function obstacles(evs, parts, day, skip) {
    return parts.filter(q => !q.free && !q.spare).map(q => ({ title: q.title, start: q.s, end: q.e }))
      .concat(evs.filter(o => o.key !== skip && o.day === day && timed(o)).map(o => ({ title: o.title, start: o.start, end: o.end })));
  }

  // The hours a week's events add to each of its days (extra: model.js budgetOf), and how many of
  // those are in time no card has (loose: Fill gaps turns that into Free time, which lends it back).
  function agendaHours(key, list) {
    const evs = weekAgenda(key, list), each = f => DAYS.map(d => sum(evs.filter(ev => ev.day === d).map(f)));
    return { extra: each(ev => ev.extra), loose: each(ev => ev.loose) };
  }

  // The times an event can move to on its own day: within EVENT_WINDOW hours of its app's time either
  // way, on the 15-minute grid ([from, to]); any time that day for one its app gave no time.
  function reach(ev) {
    const last = DAY_HOURS - ev.dur, [lo, hi] = ev.home === null ? [0, last] : [Math.max(0, ev.home - EVENT_WINDOW), Math.min(last, ev.home + EVENT_WINDOW)];
    return [Math.ceil(lo / STEP - 1e-9) * STEP, Math.floor(hi / STEP + 1e-9) * STEP];
  }

  // An event's quick fix: the clear time within its reach closest to its app's time (the earlier of
  // two as close), and today not before now. null when there's none — it stays flagged.
  function quickFix(key, ev, list = A.readList(key)) {
    if (ev.home === null) return null;
    const blocks = obstacles(weekAgenda(key, list), dayParts(list, ev.day), ev.day, ev.key);
    const soonest = key === thisWeekKey() && ev.day === dayIndex(todayStr()) ? hoursNow() : 0, [from, to] = reach(ev);
    let best = null;
    for (let t = from; t <= to + 1e-9; t += STEP) {
      const clear = t >= soonest && !blocks.some(o => overlaps({ start: t, end: t + ev.dur }, o));
      if (clear && (best === null || Math.abs(t - ev.home) < Math.abs(best - ev.home) - 1e-9)) best = t;
    }
    return best;
  }

  // "Gym", "Gym and Vet", "Gym, Vet and Work" — each name once.
  function names(list) {
    const n = [...new Set(list.map(o => o.title))];
    return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] || "";
  }
  // "Wednesday at 0800", or "Wednesday, any time".
  const when = p => `${DAY_LONG[p.day]}${p.at === null ? ", any time" : ` at ${fmtClock(p.at)}`}`;

  // Every conflict to sort out, this week and next.
  const conflicts = () => [thisWeekKey(), nextWeekKey()].flatMap(k => weekAgenda(k).filter(ev => ev.flag));

  // The bank's line when events on the board conflict: what the one conflicts with and whether its
  // day has a quick fix, or where they all are.
  function conflictMsg(key, list) {
    if (list.length > 1) return `${list.length} events conflict: ${[...new Set(list.map(ev => `${DAY_NAMES[ev.day]} ${fmtClock(ev.at)}`))].join(", ")} — click one for a quick fix.`;
    const ev = list[0];
    return `${ev.title} on ${when(ev)} conflicts with ${names(ev.clash)} — ${quickFix(key, ev) !== null ? "click it for a quick fix." : `there's no free time within ${EVENT_WINDOW} hours to move it to.`}`;
  }

  // Lays a day's events (from S.agenda) into its plan (render.js dayPlan). One alone in time no card
  // has becomes a piece of the day: that free time's piece is split around it (regions, by the free
  // piece's key: its parts in order). Any other is drawn over the day (overlays), with room on the
  // ruler (extra) for it, and for the lines of the card it's on: above it, or, when it starts where
  // that card does, below it — the card's lines then move down (pushes: how far, in the pieces' styles).
  function layEvents(plan, list, d, locked) {
    const { GAP_PX, MIN_PX } = A;
    const evs = S.agenda.filter(ev => ev.day === d && ev.at !== null).sort((a, b) => a.start - b.start);
    // A closed week draws no free time after the last card of a day, unless an event sits there.
    const tail = locked && plan.end < DAY_HOURS ? [{ key: "end", s: plan.end, e: DAY_HOURS, min: MIN_PX.free, less: GAP_PX }] : [];
    const free = plan.pieces.concat(tail).filter(p => p.key === "end" || p.key.startsWith("gap:"));
    const inFree = new Map(), overlays = [];
    evs.forEach(ev => {
      const r = !evs.some(o => o !== ev && overlaps(ev, o)) && free.find(p => p.s <= ev.start && ev.end <= p.e);
      if (r) (inFree.get(r.key) || inFree.set(r.key, []).get(r.key)).push(ev);
      else overlays.push(ev);
    });
    const regions = new Map();
    inFree.forEach((inside, key) => {
      const p = free.find(q => q.key === key), parts = [];
      let t = p.s;
      const gap = to => { if (to > t) parts.push({ key: `${key}~${parts.length}`, s: t, e: to, min: p.min, less: GAP_PX }); };
      inside.forEach(ev => {
        gap(ev.start);
        parts.push({ key: `ev:${ev.key}`, s: ev.start, e: ev.end, min: MIN_PX.card, less: GAP_PX, ev });
        t = ev.end;
      });
      gap(p.e);
      regions.set(key, parts);
    });
    const pieces = plan.pieces.concat(tail.filter(p => regions.has(p.key))).flatMap(p => regions.get(p.key) || [p]);
    const inner = new Set(list.cards.filter(c => c.parentId).map(c => c.id));
    const lines = pieces.filter(p => p.min > 0 && !p.ev && !/^(gap:|rest:)|^end(~|$)/.test(p.key)); // the cards and parts with lines
    const extra = [], pushes = [];
    overlays.forEach(ev => {
      extra.push({ key: `ev:${ev.key}`, s: ev.start, e: Math.min(DAY_HOURS, ev.end), min: MIN_PX.card, less: GAP_PX });
      lines.forEach(p => {
        if (p.s < ev.start && ev.start < p.e) extra.push({ key: `above:${ev.key}`, s: p.s, e: ev.start, min: p.min, less: 0 });
        else if (ev.start <= p.s && p.s < ev.end && ev.end < p.e) {
          extra.push({ key: `below:${ev.key}`, s: ev.end, e: p.e, min: p.min, less: 0 });
          pushes.push({ key: p.key, s: p.s, e: ev.end, pad: inner.has(p.key) ? 2 : 4 }); // its own top padding (momo.css)
        }
      });
    });
    return { ...plan, pieces, regions, overlays: lanes(overlays), extra, pushes };
  }

  // Events drawn over a day that overlap share their room side by side: each takes the first lane
  // free when it starts, and each run of overlapping ones splits the width between its lanes — the
  // whole column, or set in while any of them conflicts.
  function lanes(evs) {
    const out = [];
    let run = [], ends = [];
    const close = () => {
      const setIn = run.some(o => o.ev.flag);
      run.forEach(o => Object.assign(o, { lanes: ends.length, setIn }));
      run = [];
      ends = [];
    };
    evs.forEach(ev => {
      if (run.length && ev.start >= Math.max(...ends)) close();
      const free = ends.findIndex(t => t <= ev.start), lane = free < 0 ? ends.length : free;
      ends[lane] = ev.end;
      run.push({ ev, lane });
      out.push(run[run.length - 1]);
    });
    close();
    return out;
  }

  // The pieces' styles with the cards' lines moved below the events drawn over their starts (pushes).
  function pushLines(styles, pushes) {
    const most = new Map();
    pushes.forEach(({ key, s, e, pad }) => most.set(key, Math.max(most.get(key) || 0, pad + A.rulerY(e) - A.rulerY(s))));
    most.forEach((px, key) => styles.set(key, `${styles.get(key)};padding-top:${Math.round(px)}px`));
    return styles;
  }

  // A day's events drawn over it (layEvents overlays), each at its time on the ruler.
  function overlaysHTML(plan, locked) {
    return plan.overlays.map(({ ev, lane, lanes: n, setIn }) => {
      const y = A.rulerY(ev.start), h = Math.max(0, A.rulerY(Math.min(DAY_HOURS, ev.end)) - y - A.GAP_PX);
      const from = setIn ? SET_IN : 0, w = (1 - from) / n, span = f => `(100% - ${2 * PAD_PX}px) * ${f}`;
      return eventHTML(ev, locked, `top:${PAD_PX + y}px;height:${h}px;left:calc(${PAD_PX}px + ${span(from + w * lane)});width:calc(${span(w)})`, " over");
    }).join("");
  }

  // An event, drawn like a card: its app's icon and its title, then its time (with a ✓ once done)
  // and how long it is. Clicking one opens its pop-up, except once it's done or on a closed week.
  function eventHTML(ev, locked, style, cls = "") {
    const app = K.apps[ev.app], label = describe(ev, app);
    const attrs = `class="event${cls}${ev.flag ? " clash" : ""}${ev.done ? " done" : ""}" style="${style};--c:${A.keyColor(A.titleKey(ev.title))}" title="${esc(label)}" aria-label="${esc(label)}"`;
    const body = `<span class="card-title"><span class="app-icon" aria-hidden="true">${app ? app.meta.icon : ""}</span>${esc(ev.title)}</span>` +
      `<span class="card-time${ev.flag ? " clash" : ""}"><span class="clock">${fmtClock(ev.at)}</span>${ev.done ? `<span class="ev-done" aria-hidden="true">✓</span>` : ""}</span>` +
      `<span class="card-hours">${fmtH(ev.dur)}</span>`;
    return locked || ev.done ? `<div role="img" ${attrs}>${body}</div>` : `<button type="button" ${attrs} data-ev="${esc(ev.key)}">${body}</button>`;
  }

  // A day's events at any time that day, in its heading: each just its app's icon (and ✓ once done).
  function headEventsHTML(d, locked) {
    const evs = S.agenda.filter(ev => ev.day === d && ev.at === null);
    return !evs.length ? "" : `<span class="col-evs">${evs.map(ev => {
      const app = K.apps[ev.app], label = describe(ev, app), attrs = `class="ev-mark${ev.done ? " done" : ""}" title="${esc(label)}" aria-label="${esc(label)}"`;
      const body = `<span class="app-icon" aria-hidden="true">${app ? app.meta.icon : ""}</span>${ev.done ? `<span class="ev-done" aria-hidden="true">✓</span>` : ""}`;
      return locked || ev.done ? `<span role="img" ${attrs}>${body}</span>` : `<button type="button" ${attrs} data-ev="${esc(ev.key)}">${body}</button>`;
    }).join("")}</span>`;
  }

  // What an event's tooltip says: what, when, where it's from, and whether it's done, conflicts or moved.
  function describe(ev, app) {
    const at = h => (h === null ? "any time" : fmtClock(h));
    return `${ev.title}${ev.note ? ` (${ev.note})` : ""}, ${DAY_NAMES[ev.day]} ${ev.at === null ? at(null) : `${at(ev.at)}–${fmtClock(ev.end)}`}, from ${app ? app.meta.name : ev.app}` +
      (ev.done ? " — done ✓" : ev.flag ? ` — conflicts with ${names(ev.clash)}` : "") + (ev.moved ? ` — moved from ${at(ev.home)}` : "");
  }

  // Other apps don't tell Momo when their events change (a dose logged, in another tab or on
  // another device), so every minute the board is drawn again if they did.
  const agendaKey = () => JSON.stringify(K.agenda(thisWeekKey(), addDays(nextWeekKey(), 6)));
  function checkAgenda() {
    if (A.isActive() && agendaKey() !== S.agendaKey) A.renderAll();
  }

  Object.assign(A, {
    hoursNow, overlaps, dayParts, weekAgenda, obstacles, agendaHours, reach, quickFix, names, when, conflicts, conflictMsg,
    layEvents, pushLines, overlaysHTML, eventHTML, headEventsHTML, agendaKey, checkAgenda
  });
})(Kyoshi, Kyoshi.apps.momo);
