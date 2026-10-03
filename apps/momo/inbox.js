/* Momo · inbox.js — what other apps need done this week and next (K.inbox, core/inbox.js): Momo decides when,
 * each app says what. Momo asks from this Monday, so this week's past days show what was done on them.
 * A need for a card of its own (fill "card": an errand, a call, a workout, a meal, a job) goes on the card made
 * for it (model.js need "<app>:<id>": drawn from its task, or placed by Momo for one with a day, place.js), or,
 * done, on the one it completes (its of); one card each, on any day this week and next, nothing else in it. One
 * without such a card waits in Tasks (tasks.js), unless it's done or on a day gone by; a card on a day gone by
 * holding an open one without a day of its own is missed (red-edged: drag it to a day ahead).
 * The other needs fill your blocks: a block is any card on a day this week and next (but another app's own); a
 * need fills the soonest one with the title it asks for (its block, any case): a need with a day first, on that
 * day (a past day too: done there); one due by a day, on or before it (once overdue, the soonest), and not before
 * its from day if it has one (a meeting goes in the week before it's due); any other in the order its app lists
 * them. Open needs without a day start today. "One per block" needs take an empty block each;
 * timed ones go in whole while the card's hours have room. Ongoing ones show on every block from today with
 * their title. Hours ones (Iroh's goals, a need a week) spread over the blocks with their title in turn, each
 * taking the room it has; the cards with that title on the days before today, from its from day on, count as
 * done (the plan is taken as done). What no block covers goes to Tasks (tasks.js), but never what's done or
 * on a day gone by. A need that's late (overdue, or past its due day, and not done) makes its card late:
 * red-edged, and its pop-ups say so. Nothing is stored: it's worked out afresh each time the board is drawn,
 * so when a block moves its work follows, and filling adds no hours and causes no conflict. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, addDays, todayStr } = K.util;
  const { DAYS, DRAW_HOURS, cleanText, thisWeekKey, nextWeekKey } = A;

  // From this Monday (its past days show what was done on them) to next Sunday.
  const readNeeds = () => K.inbox(thisWeekKey(), addDays(nextWeekKey(), 6));
  const inboxKey = () => JSON.stringify(readNeeds());
  // The title (any case) of the cards a need fills, as a card's title would be.
  const blockKey = n => cleanText(n.block).toLowerCase();
  // How long a timed need is: its own length, else a drawn card's.
  const needMinutes = n => n.minutes || DRAW_HOURS * 60;
  // Late: not done, and overdue, or past the day it was due.
  const isLate = (n, today = todayStr()) => !n.done && (n.overdue || (!!n.due && n.due < today));

  // The blocks: every card on a day this week and next, soonest first (by day, then when it starts), each { key: its
  // week, card, date, past: a day before today, title (any case), room and used (minutes), whole: a one-per-block need
  // has it, needs }.
  function blocks() {
    const today = todayStr(), out = [];
    [thisWeekKey(), nextWeekKey()].forEach(key => {
      const list = A.weekOf(key);
      DAYS.forEach(d => {
        const date = addDays(key, d), times = A.startTimes(list, A.daySchedule(list, d).rows);
        list.cards.filter(c => c.day === d && times.has(c.id)).sort((a, b) => times.get(a.id).at - times.get(b.id).at)
          .forEach(card => out.push({ key, card, date, past: date < today, title: card.title.toLowerCase(), room: Math.round(card.hours * 60), used: 0, whole: false, needs: [] }));
      });
    });
    return out;
  }

  // Which card each need for a card of its own goes on (fill "card"), dated ones first: the first not taken whose
  // need is its own ("<app>:<id>"), else the one it completes (of); of those, one on its day first, else the soonest
  // (all: the blocks, as blocks() gives them). A Map need -> block; one with none waits in Tasks, or with a day gets a
  // card (place.js).
  function assign(needs, all) {
    const out = new Map(), taken = new Set(), keyed = new Map(), mine = needs.filter(n => n.fill === "card");
    all.forEach(b => { if (b.card.need) (keyed.get(b.card.need) || keyed.set(b.card.need, []).get(b.card.need)).push(b); });
    mine.filter(n => n.date).concat(mine.filter(n => !n.date)).forEach(n => {
      for (const key of [`${n.app}:${n.id}`, n.of ? `${n.app}:${n.of}` : null]) {
        const free = (keyed.get(key) || []).filter(b => !taken.has(b)), b = free.find(x => x.date === n.date) || free[0];
        if (b) { taken.add(b); out.set(n, b); return; }
      }
    });
    return out;
  }

  // Fills the blocks: { key (the needs as read, to notice them changing), needs, blocks, short: the needs no block
  // covers (not done, not ongoing, not on a day gone by), shown: the board on screen's filled cards, id -> needs,
  // missed: its cards on a day gone by holding an open need without a day (ids) }.
  function fill() {
    const needs = readNeeds(), all = blocks(), today = todayStr(), short = [], mine = assign(needs, all);
    // Each need for a card of its own on its card, alone; what has none goes to Tasks.
    needs.filter(n => n.fill === "card").forEach(n => {
      const b = mine.get(n);
      if (b) return Object.assign(b, { needs: [n], whole: true, used: b.room });
      if (!n.done && !(n.date && n.date < today)) short.push(n); // a day gone by has nothing left to plan
    });
    // A need with a day goes on that day's block; any other on one from today on, not before its from day, and on or
    // before its due day while that's still to come. Never in another app's card.
    const fits = (n, b) => !b.card.need && b.title === blockKey(n) && (n.date ? b.date === n.date : !b.past && (!n.from || b.date >= n.from) && (!n.due || n.due < today || b.date <= n.due));
    const rest = needs.filter(n => n.fill !== "card");
    rest.filter(n => n.date).concat(rest.filter(n => !n.date)).forEach(n => {
      if (n.fill === "ongoing") return all.forEach(b => { if (!b.past && fits(n, b)) b.needs.push(n); });
      if (n.fill === "hours") {
        // Its cards on the days before today, from its from day, count as done; then each block with its title takes
        // what room it has, in turn, until it's used (each card counted once, whichever need it went to). What's left
        // is one shortfall, for its week.
        let left = needMinutes(n);
        const take = (b, ok) => {
          const m = ok && left > 0 ? Math.min(b.room - b.used, left) : 0;
          if (m > 0) { b.used += m; left -= m; }
          return m > 0;
        };
        all.forEach(b => {
          const ok = b.past ? !b.card.need && !!n.from && b.title === blockKey(n) && b.date >= n.from && (!n.due || b.date <= n.due) : !b.whole && fits(n, b);
          if (take(b, ok)) b.needs.push(n);
        });
        if (left > 0 && !n.done) short.push({ ...n, minutes: left });
        return;
      }
      const whole = n.fill === "block", m = needMinutes(n);
      const b = all.find(x => fits(n, x) && !x.whole && (whole ? !x.used : x.used + m <= x.room));
      if (!b) {
        if (!n.done && !(n.date && n.date < today)) short.push(n); // a day gone by has nothing left to plan
        return;
      }
      b.needs.push(n);
      if (whole) b.whole = true;
      else b.used += m;
    });
    const shownKey = A.shownKey(), onShow = all.filter(b => b.key === shownKey && b.needs.length);
    return {
      key: JSON.stringify(needs), needs, blocks: all, short, shown: new Map(onShow.map(b => [b.card.id, b.needs])),
      missed: new Set(onShow.filter(b => b.past && b.needs.some(n => n.fill === "card" && !n.done && !n.date)).map(b => b.card.id))
    };
  }

  // What fills a card on the board on screen (as last drawn); and whether it holds a need with a day of its own (a
  // meal, a trip, something done: its app sets that day, so it isn't deleted or put back in Tasks here).
  const cardNeeds = card => (S.fill && S.fill.shown.get(card.id)) || [];
  const isDated = card => !!card.need && cardNeeds(card).some(n => n.date);

  // The apps' icons, once each.
  const appsOf = needs => [...new Set(needs.map(n => n.app))].map(id => K.apps[id]).filter(Boolean);
  const iconsHTML = needs => appsOf(needs).map(P => `<span class="app-icon" aria-hidden="true">${P.meta.icon}</span>`).join("");
  // Done once every need in it that can be done is.
  const allDone = needs => { const real = needs.filter(n => n.fill !== "ongoing"); return real.length > 0 && real.every(n => n.done); };

  // What a filled card shows (render.js cardHTML): its apps' icons, what fills it (but a need named like the card, as
  // its title would be), whether it's all done or holds something late, and the words for its label (what: without
  // done or late).
  function fillParts(card, needs) {
    const names = needs.filter(n => cleanText(n.title).toLowerCase() !== card.title.toLowerCase()).map(n => n.title), done = allDone(needs);
    const late = !done && needs.some(n => isLate(n)), from = appsOf(needs).map(P => P.meta.name);
    const what = `${names.length ? `${A.names(names.map(title => ({ title })))} ` : ""}from ${A.names(from.map(title => ({ title })))}`;
    return { icons: iconsHTML(needs), names: names.join(", "), done, late, what, text: `${what}${done ? " — done ✓" : late ? " — late" : ""}` };
  }

  // The card pop-up's list of what fills it (or a task's, for a card drawn from it), by app: each need's
  // title (✓ once done, or late) and details, with a way there ("Open in Appa": card-editor.js).
  function fromHTML(needs) {
    const today = todayStr();
    return appsOf(needs).map(P => `<div class="from-app">${iconsHTML([{ app: P.id }])}From ${esc(P.meta.name)}</div><ul class="from-needs">` +
      needs.filter(n => n.app === P.id).map(n => `<li><strong>${esc(n.title)}</strong>${n.done ? ` <span class="from-done">✓ done</span>` : isLate(n, today) ? ` <span class="from-late">late</span>` : ""}` +
        ` · <a href="#${esc(P.id)}" data-app="${esc(P.id)}" data-id="${esc(n.id)}">Open in ${esc(P.meta.name)}</a>` +
        n.details.map(line => `<span class="from-detail">${esc(line)}</span>`).join("") + `</li>`).join("") + `</ul>`).join("");
  }

  Object.assign(A, { readNeeds, inboxKey, needMinutes, isLate, blocks, assign, fill, cardNeeds, isDated, iconsHTML, fillParts, fromHTML });
})(Kyoshi, Kyoshi.apps.momo);
