/* Pabu · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: the people you keep in touch with, each with how often and how (a call, a text, a visit), listed by who's due, Talked ✓ with the days kept, and birthdays coming up.",
      "Momo fits them into your “Keep in touch” cards, soonest due first, and shows ✓ once you've talked; birthdays are events on its board."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.pabu);
