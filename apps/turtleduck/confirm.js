/* Turtleduck · confirm.js — a week's meals go to Momo once it's confirmed here (S.confirmed, by its Monday): Confirm
 * says what goes (its meals, cooking sessions and trips) and what to look at first (days from today with no dinner,
 * meals with no trip before them), then confirms anyway; later changes follow by themselves (share.js inbox reads the
 * plan afresh), and Un-confirm (the ⋯ menu) takes the week off Momo again. Each week's line under its tab says where it
 * stands, Momo read back (share.js momoStatus): not on Momo until it's confirmed; on Momo; or on Momo but its week there
 * has no baseline yet, so its meals have no slots. The dot on the icon (events.js attention) follows it. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { todayStr } = K.util;
  const { MOMO_MEALS, plural, fmtWd, kept, isConfirmed } = A;

  const mondayFor = which => (which === "next" ? A.nextMonday() : A.thisMonday());
  const words = list => (list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

  // What a week sends Momo, from Monday on (as it'll be on its board): { meals, cooks, trips }, and from today on what to
  // look at first: noDinner (days, nothing in the slot, Skipped counting), uncovered (cooked meals with no trip before them).
  function weekSummary(monday) {
    const days = A.weekDates(monday), today = todayStr(), ahead = days.filter(d => d >= today);
    const meals = days.reduce((n, d) => n + MOMO_MEALS.filter(m => A.entriesOn(d, m).some(e => e.kind !== "skipped")).length, 0);
    const cooks = days.filter(d => A.entriesOn(d, "cook").length).length;
    const trips = A.liveTrips().filter(t => t.date >= days[0] && t.date <= days[6]).length;
    const noDinner = ahead.filter(d => !A.entriesOn(d, "dinner").length);
    const uncovered = A.liveEntries().filter(e => e.date >= today && e.date <= days[6] && A.isCooked(e) && (A.coverageOf(e) || {}).state === "none").length;
    return { meals, cooks, trips, noDinner, uncovered };
  }

  // Confirm this week's or next week's meals for Momo, after saying what goes and what's missing.
  function confirmWeek(which) {
    const monday = mondayFor(which), s = weekSummary(monday);
    if (isConfirmed(monday)) return;
    const gaps = (s.noDinner.length ? ` No dinner on ${words(s.noDinner.map(fmtWd))}.` : "") +
      (s.uncovered ? ` ${s.uncovered === 1 ? "1 meal has no trip before it" : `${s.uncovered} meals have no trip before them`}.` : "");
    if (!confirm(`Confirm ${which === "next" ? "next" : "this"} week's meals for Momo? ${plural(s.meals, "meal")}, ${plural(s.cooks, "cooking session")}, ${plural(s.trips, "trip")}.` +
      `${gaps} They'll be on Momo at their times; later changes follow by themselves.`)) return;
    const t = Date.now();
    S.confirmed[monday] = { at: t, u: t };
    kept();
  }

  // Takes a week's meals off Momo (its slots there stay, empty); Confirm puts them back.
  function unconfirmWeek(which) {
    const monday = mondayFor(which);
    if (!isConfirmed(monday)) return;
    S.confirmed[monday] = { at: 0, u: Date.now() };
    kept();
  }

  // The line under a week's tab: where it stands with Momo ("" while Momo can't be read).
  function statusLine(monday) {
    if (!isConfirmed(monday)) return "Not on Momo until you confirm the week";
    const m = A.momoStatus(monday);
    if (!m) return "";
    return m.planned ? "On Momo ✓" : "On Momo, but its week has no baseline yet: load it there so the meals have their slots";
  }

  // The week that needs confirming for the dot: this week while it isn't, else from Friday on next week while it isn't.
  function unconfirmed() {
    if (!isConfirmed(A.thisMonday())) return "this";
    return A.dayIndex(todayStr()) >= 4 && !isConfirmed(A.nextMonday()) ? "next" : "";
  }

  Object.assign(A, { weekSummary, confirmWeek, unconfirmWeek, statusLine, unconfirmed, mondayFor });
})(Kyoshi, Kyoshi.apps.turtleduck);
