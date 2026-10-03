/* Hawky · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.110", date: "2026-10-03", changes: [
      "Each errand is its own card in Momo, titled by it and as long as it takes: it waits in Momo's Tasks until you drag it onto a day, and shows ✓ once you tick it off here."
    ] },
    { version: "1.010", date: "2026-10-02", changes: [
      "Momo gets only the errands due by the end of next week (and those without a date), so one due in a month no longer takes this week's room.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: errands and pop-up tasks, added in seconds on the phone (a tap each for the day and how long), listed by when they're due, with the done ones folded away.",
      "Momo fits them into your \"Errands\" cards, soonest due first, and ticks them off there once they're done; what doesn't fit waits in its Tasks."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.hawky);
