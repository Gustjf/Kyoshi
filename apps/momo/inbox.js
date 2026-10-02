/* Momo · inbox.js — what other apps need done this week and next (K.inbox, core/inbox.js), filling your
 * blocks: Momo decides when, each app says what. A block is any card on a day from today on, this week
 * and next; a need fills the soonest one with the title it asks for (its block, any case): a need with a
 * day first, on that day; one due by a day, on or before it (once overdue, the soonest), and not before its
 * from day if it has one (a meeting goes in the week before it's due); any other in the order its app lists them. "One per block" needs take an empty block each; timed ones go in whole while
 * the card's hours have room. Ongoing ones show on every block with their title. What no block covers
 * goes to Tasks (tasks.js). Nothing is stored: it's worked out afresh each time the board is drawn, so
 * when a block moves its work follows, and filling adds no hours and causes no conflict. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, addDays, todayStr } = K.util;
  const { DAYS, DRAW_HOURS, cleanText, thisWeekKey, nextWeekKey } = A;

  const readNeeds = () => K.inbox(todayStr(), addDays(nextWeekKey(), 6));
  const inboxKey = () => JSON.stringify(readNeeds());
  // The title (any case) of the cards a need fills, as a card's title would be.
  const blockKey = n => cleanText(n.block).toLowerCase();
  // How long a timed need is: its own length, else a drawn card's.
  const needMinutes = n => n.minutes || DRAW_HOURS * 60;

  // The blocks: every card on a day from today on, this week and next, soonest first (by day, then when
  // it starts), each { key: its week, card, date, title (any case), room and used (minutes), whole: a
  // one-per-block need has it, needs }.
  function blocks() {
    const today = todayStr(), out = [];
    [thisWeekKey(), nextWeekKey()].forEach(key => {
      const list = A.weekOf(key);
      DAYS.forEach(d => {
        const date = addDays(key, d);
        if (date < today) return;
        const times = A.startTimes(list, A.daySchedule(list, d).rows);
        list.cards.filter(c => c.day === d && times.has(c.id)).sort((a, b) => times.get(a.id).at - times.get(b.id).at)
          .forEach(card => out.push({ key, card, date, title: card.title.toLowerCase(), room: Math.round(card.hours * 60), used: 0, whole: false, needs: [] }));
      });
    });
    return out;
  }

  // Fills the blocks: { key (the needs as read, to notice them changing), needs, blocks, short: the
  // needs no block covers (not done, not ongoing), shown: the board on screen's filled cards, id -> needs }.
  function fill() {
    const needs = readNeeds(), all = blocks(), today = todayStr(), short = [];
    const fits = (n, b) => b.title === blockKey(n) && (n.date ? b.date === n.date : (!n.from || b.date >= n.from) && (!n.due || n.due < today || b.date <= n.due));
    needs.filter(n => n.date).concat(needs.filter(n => !n.date)).forEach(n => {
      if (n.fill === "ongoing") return all.forEach(b => { if (fits(n, b)) b.needs.push(n); });
      const whole = n.fill === "block", m = needMinutes(n);
      const b = all.find(x => fits(n, x) && !x.whole && (whole ? !x.used : x.used + m <= x.room));
      if (!b) {
        if (!n.done) short.push(n);
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

  // What a filled card shows (render.js cardHTML): its apps' icons, what fills it (but a need named like
  // the card), whether it's all done, and the words for its label.
  function fillParts(card, needs) {
    const names = needs.filter(n => n.title.toLowerCase() !== card.title.toLowerCase()).map(n => n.title), done = allDone(needs);
    const from = appsOf(needs).map(P => P.meta.name);
    return {
      icons: iconsHTML(needs), names: names.join(", "), done,
      text: `${names.length ? `${A.names(names.map(title => ({ title })))} ` : ""}from ${A.names(from.map(title => ({ title })))}${done ? " — done ✓" : ""}`
    };
  }

  // The card pop-up's list of what fills it (or a task's, for a card drawn from it), by app: each need's
  // title (✓ once done) and details, with a way there ("Open in Appa": card-editor.js).
  function fromHTML(needs) {
    return appsOf(needs).map(P => `<div class="from-app">${iconsHTML([{ app: P.id }])}From ${esc(P.meta.name)}</div><ul class="from-needs">` +
      needs.filter(n => n.app === P.id).map(n => `<li><strong>${esc(n.title)}</strong>${n.done ? ` <span class="from-done">✓ done</span>` : ""}` +
        ` · <a href="#${esc(P.id)}" data-app="${esc(P.id)}" data-id="${esc(n.id)}">Open in ${esc(P.meta.name)}</a>` +
        n.details.map(line => `<span class="from-detail">${esc(line)}</span>`).join("") + `</li>`).join("") + `</ul>`).join("");
  }

  Object.assign(A, { readNeeds, inboxKey, needMinutes, fill, iconsHTML, fillParts, fromHTML });
})(Kyoshi, Kyoshi.apps.momo);
