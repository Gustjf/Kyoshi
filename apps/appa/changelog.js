/* Appa · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.000", date: "2026-09-29", changes: [
      "Initial release: preventive maintenance for your things, by time, season or meter reading, whichever comes first, each job noting where its interval comes from.",
      "Jobs go to Momo's Tasks two weeks before they're due, sized to how long they take; Appa learns that from your timed jobs.",
      "A clear job view with your notes, a Start/Finish timer and a one-tap Done, plus optional cost, notes, photos, PDFs and links as proof.",
      "A clean PDF report of what was done, with each job's proof right after it, ready for a buyer or an insurer."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.appa);
