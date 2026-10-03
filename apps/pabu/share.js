/* Pabu · share.js — what Pabu shares with other apps. Momo reads inbox() (core/inbox.js; read-only copies): every call,
 * text or visit due by `to`, soonest due first, each a card of its own in Momo (fill "card": "Call Mom", as long as it
 * takes), waiting in its Tasks from 6 days before it's due (any day once overdue) until you place it. Then the days you
 * talked by each between from and to, done, each completing its own (of "p:<id>:<cid>"): ✓ on that card, or one of its
 * own on that day. Birthday-only people send nothing there. Momo's board reads agenda() (core/agenda.js): birthdays, at
 * any time on their day, ✓ once you talked that day. Momo's "Open in Pabu" calls open(id), which brings the call, text or
 * visit (This week's line) or else the person into view and flashes it. The ids: "p:<id>:<cid>" (one due),
 * "p:<id>:<cid>:<day>" (a talk), "bday:<id>:<year>" (a birthday): change open() along with them (apps/pabu/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, todayStr } = K.util;
  const { WINDOW_DAYS } = A;

  // A need's details: how often and the last talk ("Every month · last talked 5 weeks ago", "Every 2 weeks · never
  // talked · added Sep 27"), then the note's first line.
  function details(p, c, today) {
    const last = A.lastTalk(c, today), added = A.addedDay(p, c);
    return [
      `${A.cap(A.everyWords(c))} · ${A.talkedWords(last, today)}${!last && added ? ` · added ${A.fmtDay(added, today)}` : ""}`,
      A.cleanLine(p.note.split("\n")[0], 100)
    ].filter(Boolean);
  }

  // [{ id, title, fill: "card", minutes, due, from, overdue, details }, then { id, …, date, done: true, of }]: made
  // afresh on every call, so Momo can't change Pabu's data through them.
  function inbox(from, to) {
    const today = todayStr(), all = A.allDue(today);
    const base = (p, c, title) => ({ title, fill: "card", minutes: c.minutes, details: details(p, c, today) });
    const due = all.filter(r => r.due <= to)
      .map(({ p, c, due: d, title }) => ({ id: `p:${p.id}:${c.id}`, ...base(p, c, title), due: d, from: d < today ? null : addDays(d, -WINDOW_DAYS), overdue: d < today }));
    const talked = all.flatMap(({ p, c, title }) => c.talks.filter(d => d >= from && d <= to && d <= today)
      .map(d => ({ id: `p:${p.id}:${c.id}:${d}`, ...base(p, c, title), date: d, done: true, of: `p:${p.id}:${c.id}` })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));
    return due.concat(talked);
  }

  // Birthdays on days from `from` to `to`, as events at any time that day for 15 minutes: [{ id, title: "Mom's birthday",
  // date, time: null, minutes, note: "Turns 60 · Call" (their first call, text or visit), done: talked that day }],
  // read-only copies.
  function agenda(from, to) {
    const out = [];
    A.live().filter(p => p.birthday).forEach(p => {
      for (let year = +from.slice(0, 4); year <= +to.slice(0, 4); year++) {
        const date = A.birthdayIn(p, year), age = A.ageOn(p, date);
        if (date < from || date > to) continue;
        out.push({
          id: `bday:${p.id}:${year}`, title: `${p.name}'s birthday`, date, time: null, minutes: 15,
          note: [age ? `Turns ${age}` : "", p.cadences.length ? A.howLabel(p.cadences[0]) : ""].filter(Boolean).join(" · "), done: A.talkedOn(p, date)
        });
      }
    });
    return out;
  }

  // From Momo's "Open in Pabu" (core/inbox.js puts Pabu on screen first): the person's id is the second part of any of
  // the ids. A call, text or visit on This week comes into view there; else the person on the People list (shown
  // whatever group the chips show). It flashes; nothing once they're deleted.
  function open(id) {
    const [kind, pid, cid] = String(id).split(":"), p = A.personById(pid);
    if (!p) return;
    const find = sel => A.root.querySelector(`${sel}[data-id="${CSS.escape(p.id)}"]${sel === ".due-row" ? `[data-cid="${CSS.escape(cid)}"]` : ""}`);
    let row = kind === "p" && cid && find(".due-row");
    if (!row && !find(".person")) {
      S.filter = null;
      A.renderAll();
    }
    row = row || find(".person");
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("flash");
    void row.offsetWidth; // so the flash starts again
    row.classList.add("flash");
  }

  Object.assign(A, { inbox, agenda, open });
})(Kyoshi, Kyoshi.apps.pabu);
