/* Iroh · share.js — what Iroh shares with other apps. Momo reads inbox() (core/inbox.js; read-only copies):
 * for each week from from's to to's, every open goal with hours in that week's season (its Monday's) asks for
 * its share of the week (fill "hours"): Momo spreads it over your cards titled like the goal, and what doesn't
 * fit is one task for that week. Momo's "Open in Iroh" calls open(id), which brings the goal into view and
 * flashes it. The needs' ids are "goal:<goal id>:<Monday>": change open() along with them (apps/iroh/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { addDays } = K.util;
  const PREFIX = "goal:";

  // A goal's need for the week starting on monday.
  const need = (g, monday) => ({
    id: `${PREFIX}${g.id}:${monday}`, title: g.title, block: g.title, fill: "hours",
    minutes: A.weeklyMinutes(g), from: monday, due: addDays(monday, 6),
    details: [A.chainOf(g), g.next ? `Next: ${g.next}` : "", A.hoursText(g)].filter(Boolean)
  });

  // [{ id, title, block (its title), fill: "hours", minutes, from (Monday), due (Sunday), details }], a week at a
  // time, made afresh on every call, so Momo can't change Iroh's data through them.
  function inbox(from, to) {
    const out = [];
    for (let monday = A.mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
      A.goalsIn(A.seasonOf(monday)).filter(g => A.isOpen(g) && A.weeklyMinutes(g) > 0).forEach(g => out.push(need(g, monday)));
    }
    return out;
  }

  // From Momo's "Open in Iroh" (core/inbox.js puts Iroh on screen first): the goal comes into view and flashes
  // (Earlier opens if it's there); nothing once it's deleted.
  function open(id) {
    const s = String(id), g = s.startsWith(PREFIX) && A.goalById(s.slice(PREFIX.length, s.lastIndexOf(":")));
    if (g) A.reveal(g.id);
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.iroh);
