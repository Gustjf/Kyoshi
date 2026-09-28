/* Wan Shi Tong · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.000", date: "2026-09-28", changes: [
      "Initial release: keep every recommendation (novels, textbooks, movies, TV/anime and courses) in one place, with what's in progress and up next on top and the rest waiting in the magazine.",
      "Finishing something moves Up next into In progress, and keeps it in a Finished list."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.wanshitong);
