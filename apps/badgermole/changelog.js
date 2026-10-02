/* Badgermole · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: workouts as routines in a rotation, each set logged with one thumb between sets (prefilled from last time, a step heavier once every set hit its reps), PRs the moment they happen, the week's count, a streak and a month calendar whose days open to fix what was logged.",
      "Momo fills your \"Workout\" cards with the week's sessions in program order, and ticks them off once they're logged; what doesn't fit waits in its Tasks."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.badgermole);
