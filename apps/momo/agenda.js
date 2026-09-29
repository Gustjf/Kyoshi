/* Momo · agenda.js — other apps' events (Bosco's doses, …) on the board, at their day and time.
 * They come from K.agenda (core/agenda.js) each time the board is drawn and aren't stored: Momo
 * keeps only where you moved one within its week, and whether a conflict where it is is fine
 * (week.events, see model.js). An event takes no hours from its day — it happens during whatever
 * card is there — but it conflicts with anything else at a set time that it overlaps: another
 * event, or a pinned card. It's drawn over its day on the right (the card under it can still be
 * grabbed), as tall as its time on the ruler (times.js), side by side with any it overlaps; one
 * at any time that day is just its app's icon in the day's heading. Its pop-up is triage.js. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, isNum, addDays, now } = K.util;
  const { DAY_HOURS, DAY_NAMES, DAY_LONG, STEP, snap, fmtClock, dayIndex, firstDay, thisWeekKey, nextWeekKey } = A;

  const PAD_PX = 6;    // .col-body's padding (momo.css): where 0000 is on a day
  const EVENT_PX = 18; // the least height of an event, to fit its line
  const WIDE = 0.62;   // the share of a day's width events take, on the right (momo.css)

  const hoursOf = t => +t.slice(0, 2) + +t.slice(3) / 60; // "07:30" -> 7.5
  // The time now on this device, in hours after midnight (time-travel aware).
  const hoursNow = () => { const d = new Date(now()); return d.getHours() + d.getMinutes() / 60; };
  const timed = ev => ev.at !== null && !ev.done; // one done has happened: it can't conflict
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;

  // A week's events, each as K.agenda has it plus: key ("app:id"); home, the day (0-6) and time
  // its app has it at; day and at, where it is, moved or not (at: hours after midnight, null for
  // any time that day); start, end and dur, in hours; moved and keep; clash, what it overlaps
  // ({ title, start, end }); and flag, a conflict to show: on a day still to come, not kept.
  function weekAgenda(key, list = A.readList(key)) {
    if (key === "base") return [];
    const placed = list.events || {};
    const evs = K.agenda(key, addDays(key, 6)).map(e => {
      const k = `${e.app}:${e.id}`, p = placed[k] || {};
      const home = { day: dayIndex(e.date), at: e.time ? hoursOf(e.time) : null };
      const day = isNum(p.day) ? p.day : home.day, at = isNum(p.at) ? p.at : home.at, dur = Math.max(STEP, snap(e.minutes / 60));
      return { ...e, key: k, home, day, at, start: at, end: at === null ? null : at + dur, dur, moved: day !== home.day || at !== home.at, keep: p.keep === true, clash: [], flag: false };
    });
    const first = firstDay(key);
    evs.filter(timed).forEach(ev => {
      ev.clash = obstacles(evs, list, ev.day, ev.key).filter(o => overlaps(ev, o));
      ev.flag = ev.clash.length > 0 && !ev.keep && ev.day >= first && !list.closed;
    });
    return evs;
  }

  // What's at a set time on a day for an event to conflict with, besides the event skip (its
  // key): the other events there and the pinned cards, as { title, start, end }.
  function obstacles(evs, list, day, skip) {
    const cards = A.daySchedule(list, day).rows.filter(r => A.pinned(r.card)).map(r => ({ title: r.card.title, start: r.start, end: r.end }));
    return evs.filter(o => o.key !== skip && o.day === day && timed(o)).map(o => ({ title: o.title, start: o.start, end: o.end })).concat(cards);
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

  // The bank's line when events conflict: what the one conflicts with, or where they all are.
  function conflictMsg(list) {
    if (list.length > 1) return `${list.length} events conflict: ${[...new Set(list.map(ev => `${DAY_NAMES[ev.day]} ${fmtClock(ev.at)}`))].join(", ")} — click one to move it.`;
    const ev = list[0];
    return `${ev.title} on ${when(ev)} conflicts with ${names(ev.clash)} — click it to move it.`;
  }

  // Room on the board's ruler for each event at a time: enough for its line and, where it starts
  // partway down a card (or a part of one), for that card's lines above it, so it never covers
  // them. plans: each day's pieces (render.js dayPlan); free time and bare edges have no lines.
  const agendaPieces = (evs, plans) => evs.filter(ev => ev.at !== null).flatMap(ev => [{ key: `ev:${ev.key}`, s: ev.start, e: Math.min(DAY_HOURS, ev.end), min: EVENT_PX, less: 2 }]
    .concat(plans[ev.day].pieces.filter(p => p.min > 0 && !/^(gap:|rest:|end$)/.test(p.key) && p.s < ev.start && ev.start < p.e)
      .map(p => ({ key: `above:${ev.key}`, s: p.s, e: ev.start, min: p.min, less: 0 }))));

  // A day's events at a time (from S.agenda), over its cards at their times on the ruler.
  function dayEventsHTML(d, locked) {
    const evs = S.agenda.filter(ev => ev.day === d && ev.at !== null);
    lanes(evs);
    return evs.map(ev => {
      const y = A.rulerY(ev.start), h = Math.max(EVENT_PX, A.rulerY(Math.min(DAY_HOURS, ev.end)) - y - 2), w = WIDE / ev.lanes;
      const style = `top:${PAD_PX + y}px;height:${h}px` + (ev.lanes > 1 ? `;max-width:none;width:calc((100% - ${2 * PAD_PX}px) * ${w});right:calc(${PAD_PX}px + (100% - ${2 * PAD_PX}px) * ${w * ev.lane})` : "");
      return eventHTML(ev, locked, "event", style, `<span class="ev-time">${fmtClock(ev.at)}</span><span class="ev-title">${esc(ev.title)}</span>`);
    }).join("");
  }

  // Side by side where events overlap: each takes the first lane free when it starts, and each
  // run of overlapping ones shares the width between its lanes (lane 0 on the right).
  function lanes(evs) {
    let run = [], ends = [];
    const close = () => { run.forEach(ev => { ev.lanes = ends.length; }); run = []; ends = []; };
    evs.sort((a, b) => a.start - b.start).forEach(ev => {
      if (run.length && ev.start >= Math.max(...ends)) close();
      const free = ends.findIndex(t => t <= ev.start), i = free < 0 ? ends.length : free;
      ends[i] = ev.end;
      ev.lane = i;
      run.push(ev);
    });
    close();
  }

  // A day's events at any time that day, in its heading: each just its app's icon.
  function headEventsHTML(d, locked) {
    const evs = S.agenda.filter(ev => ev.day === d && ev.at === null);
    return evs.length ? `<span class="col-evs">${evs.map(ev => eventHTML(ev, locked, "ev-mark", "", "")).join("")}</span>` : "";
  }

  // An event: its app's icon, then inner. Clicking opens its pop-up, except once it's done or on
  // a closed week.
  function eventHTML(ev, locked, cls, style, inner) {
    const app = K.apps[ev.app], label = describe(ev, app);
    const attrs = `class="${cls}${ev.flag ? " clash" : ""}${ev.done ? " done" : ""}"${style ? ` style="${style}"` : ""} title="${esc(label)}" aria-label="${esc(label)}"`;
    const body = `<span class="app-icon" aria-hidden="true">${app ? app.meta.icon : ""}</span>${inner}`;
    return locked || ev.done ? `<div role="img" ${attrs}>${body}</div>` : `<button type="button" ${attrs} data-ev="${esc(ev.key)}">${body}</button>`;
  }

  // What an event's tooltip says: what, when, where it's from, and any conflict or move.
  function describe(ev, app) {
    const at = p => (p.at === null ? "any time" : fmtClock(p.at));
    return `${ev.title}${ev.note ? ` (${ev.note})` : ""}, ${DAY_NAMES[ev.day]} ${ev.at === null ? at(ev) : `${at(ev)}–${fmtClock(ev.end)}`}, from ${app ? app.meta.name : ev.app}` +
      (ev.done ? " — done" : ev.flag ? ` — conflicts with ${names(ev.clash)}` : "") +
      (ev.moved ? ` — moved from ${DAY_NAMES[ev.home.day]} ${at(ev.home)}` : "");
  }

  // Other apps don't tell Momo when their events change (a dose logged, in another tab or on
  // another device), so every minute the board is drawn again if they did.
  const agendaKey = () => JSON.stringify(K.agenda(thisWeekKey(), addDays(nextWeekKey(), 6)));
  function checkAgenda() {
    if (A.isActive() && agendaKey() !== S.agendaKey) A.renderAll();
  }

  Object.assign(A, {
    hoursNow, overlaps, weekAgenda, obstacles, names, when, conflicts, conflictMsg,
    agendaPieces, dayEventsHTML, headEventsHTML, agendaKey, checkAgenda
  });
})(Kyoshi, Kyoshi.apps.momo);
