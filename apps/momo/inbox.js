/* Momo · inbox.js — what other apps need done this week and next (K.inbox, core/inbox.js), filling your
 * blocks: Momo decides when, each app says what. Momo asks from this Monday, so this week's past days show
 * what was done on them. A block is any card on a day this week and next; a need fills the soonest one with
 * the title it asks for (its block, any case): a need with a day first, on that day (a past day too: done
 * there, or taken as done, like a meal); one due by a day, on or before it (once overdue, the soonest), and
 * not before its from day if it has one (a meeting goes in the week before it's due); any other in the order
 * its app lists them. Open needs without a day start today. "One per block" needs take an empty block each;
 * timed ones go in whole while the card's hours have room. Ongoing ones show on every block from today with
 * their title. Hours ones (Iroh's goals, a need a week) spread over the blocks with their title in turn, each
 * taking the room it has; the cards with that title on the days before today, from its from day on, count as
 * done (the plan is taken as done). What no block covers goes to Tasks (tasks.js), but never what's done or
 * on a day gone by. A need that's late (overdue, or past its due day, and not done) makes its card late:
 * red-edged, and its pop-ups say so. Nothing is stored: it's worked out afresh each time the board is drawn,
 * so when a block moves its work follows, and filling adds no hours and causes no conflict. */
(function (K, A) {
  "use strict";
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

  // Fills the blocks: { key (the needs as read, to notice them changing), needs, blocks, short: the needs no block
  // covers (not done, not ongoing, not on a day gone by), shown: the board on screen's filled cards, id -> needs }.
  function fill() {
    const needs = readNeeds(), all = blocks(), today = todayStr(), short = [];
    // A need with a day goes on that day's block; any other on one from today on, not before its from day, and on or
    // before its due day while that's still to come.
    const fits = (n, b) => b.title === blockKey(n) && (n.date ? b.date === n.date : !b.past && (!n.from || b.date >= n.from) && (!n.due || n.due < today || b.date <= n.due));
    needs.filter(n => n.date).concat(needs.filter(n => !n.date)).forEach(n => {
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
          const ok = b.past ? !!n.from && b.title === blockKey(n) && b.date >= n.from && (!n.due || b.date <= n.due) : !b.whole && fits(n, b);
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
    const shownKey = A.shownKey();
    return { key: JSON.stringify(needs), needs, blocks: all, short, shown: new Map(all.filter(b => b.key === shownKey && b.needs.length).map(b => [b.card.id, b.needs])) };
  }

  // The apps' icons, once each.
  const appsOf = needs => [...new Set(needs.map(n => n.app))].map(id => K.apps[id]).filter(Boolean);
  const iconsHTML = needs => appsOf(needs).map(P => `<span class="app-icon" aria-hidden="true">${P.meta.icon}</span>`).join("");
  // Done once every need in it that can be done is.
  const allDone = needs => { const real = needs.filter(n => n.fill !== "ongoing"); return real.length > 0 && real.every(n => n.done); };

  // What a filled card shows (render.js cardHTML): its apps' icons, what fills it (but a need named like the card),
  // whether it's all done or holds something late, and the words for its label (what: without done or late).
  function fillParts(card, needs) {
    const names = needs.filter(n => n.title.toLowerCase() !== card.title.toLowerCase()).map(n => n.title), done = allDone(needs);
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

  Object.assign(A, { readNeeds, inboxKey, needMinutes, isLate, fill, iconsHTML, fillParts, fromHTML });
})(Kyoshi, Kyoshi.apps.momo);
