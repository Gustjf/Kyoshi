/* Pabu · share.js — what Pabu shares with other apps. Momo reads inbox() (core/inbox.js; read-only copies): everyone on
 * a schedule who's due by `to`, soonest due first, each filling Momo's cards titled "Keep in touch" whole, from 6 days
 * before they're due (any day once overdue); what doesn't fit is one Keep in touch task in Momo's Tasks. Then the days
 * you talked to them between from and to, done (✓ on that day's card). Birthday-only people send nothing there. Momo's
 * board reads agenda() (core/agenda.js): birthdays, at any time on their day, ✓ once you talked that day. Momo's "Open
 * in Pabu" calls open(id), which brings the person into view and flashes them. The ids: "p:<id>" (who's due),
 * "p:<id>:<day>" (a talk), "bday:<id>:<year>" (a birthday): change open() along with them (apps/pabu/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { addDays, todayStr } = K.util;
  const { HOW, BLOCK, WINDOW_DAYS } = A;

  // "Call Mom", "Text Sam", "Visit Gran": at most 6 + 40 characters, within Momo's 60.
  const needTitle = p => `${HOW[A.howOf(p)].label} ${p.name}`;
  // A need's details: how often and the last talk ("Every month · last talked 5 weeks ago", "Every 2 weeks · never
  // talked · added Sep 27"), then the note's first line.
  function details(p, today) {
    const last = A.lastTalk(p, today), added = A.dayOf(p.at);
    return [
      `${A.cap(A.everyWords(p))} · ${A.talkedWords(last, today)}${!last && added ? ` · added ${A.fmtDay(added, today)}` : ""}`,
      A.cleanLine(p.note.split("\n")[0], 100)
    ].filter(Boolean);
  }

  // [{ id, title, block: "Keep in touch", minutes, due, from, overdue, details }, then { id, …, date, done: true }]: made
  // afresh on every call, so Momo can't change Pabu's data through them.
  function inbox(from, to) {
    const today = todayStr(), people = A.live().filter(p => A.everyOf(p) !== "none");
    const base = p => ({ title: needTitle(p), block: BLOCK, minutes: p.minutes, details: details(p, today) });
    const due = A.withDue(people, today).filter(([, d]) => d <= to)
      .map(([p, d]) => ({ id: `p:${p.id}`, ...base(p), due: d, from: d < today ? null : addDays(d, -WINDOW_DAYS), overdue: d < today }));
    const talked = people.flatMap(p => p.talks.filter(d => d >= from && d <= to && d <= today).map(d => ({ id: `p:${p.id}:${d}`, ...base(p), date: d, done: true })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));
    return due.concat(talked);
  }

  // Birthdays on days from `from` to `to`, as events at any time that day for 15 minutes: [{ id, title: "Mom's birthday",
  // date, time: null, minutes, note: "Turns 60 · Call", done: talked that day }], read-only copies.
  function agenda(from, to) {
    const out = [];
    A.live().filter(p => p.birthday).forEach(p => {
      for (let year = +from.slice(0, 4); year <= +to.slice(0, 4); year++) {
        const date = A.birthdayIn(p, year), age = A.ageOn(p, date);
        if (date < from || date > to) continue;
        out.push({
          id: `bday:${p.id}:${year}`, title: `${p.name}'s birthday`, date, time: null, minutes: 15,
          note: [age ? `Turns ${age}` : "", HOW[A.howOf(p)].label].filter(Boolean).join(" · "), done: p.talks.includes(date)
        });
      }
    });
    return out;
  }

  // From Momo's "Open in Pabu" (core/inbox.js puts Pabu on screen first): the person comes into view on the list and
  // flashes; nothing once they're deleted.
  function open(id) {
    const s = String(id), m = /^p:(.+?)(?::\d{4}-\d{2}-\d{2})?$/.exec(s) || /^bday:(.+):\d{4}$/.exec(s), p = m && A.personById(m[1]);
    const row = p && A.root.querySelector(`.person[data-id="${CSS.escape(p.id)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("flash");
    void row.offsetWidth; // so the flash starts again
    row.classList.add("flash");
  }

  Object.assign(A, { inbox, agenda, open });
})(Kyoshi, Kyoshi.apps.pabu);
