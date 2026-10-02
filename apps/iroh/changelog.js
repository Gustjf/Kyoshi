/* Iroh · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: the areas of your life, each with its picture in 10 years and milestones 5 years out; three to five goals for the year; and this season's goals, each with the year goal it serves, its hours, a next step and a monthly reconcile.",
      "Momo makes time for each season goal with hours: your cards titled like the goal fill with its hours each week, and what doesn't fit waits in Momo's Tasks.",
      "Meetings: reconcile the goals every month, a season review in each new season's first week (Carry over brings an open goal along), and the vision once a year."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.iroh);
