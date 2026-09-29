/* Kyoshi · core/changelog.js — Kyoshi's own version and changelog (the shared core).
 * Newest first; K.VERSION is the top entry. Version X.YYY, bump one tier per
 * change: +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Apps keep their own in apps/<id>/changelog.js. Keep entries brief: a sentence per change. */
(function (K) {
  "use strict";
  K.CHANGELOG = [
    { version: "1.310", date: "2026-09-29", changes: [
      "Shortened the project notes the coding assistant reads each session, so building costs fewer tokens."
    ] },
    { version: "1.300", date: "2026-09-29", changes: [
      "Apps can now put events at set times on Momo's board, starting with Bosco's doses; future apps add theirs the same way."
    ] },
    { version: "1.200", date: "2026-09-28", changes: [
      "Added Wan Shi Tong, a media tracker for recommendations: switch to it from the button beside Theme."
    ] },
    { version: "1.100", date: "2026-09-28", changes: [
      "Your data now lives in the browser's large storage, with room for far more apps and years; what Kyoshi had saved moves over by itself.",
      "Developer Mode shows how much storage Kyoshi uses; Kyoshi asks the browser to protect it, and warns if it's out of reach or nearly full.",
      "Updates show up with a normal reload."
    ] },
    { version: "1.000", date: "2026-09-28", changes: [
      "Initial release: one home for Bosco and Momo, switched from the button beside Theme.",
      "Shared look, Developer Mode, bug reports, JSON backups and one sync folder for every app.",
      "Developer Mode can export or import every app at once, and time travel works across apps."
    ] }
  ];
  K.VERSION = K.CHANGELOG[0].version;
})(Kyoshi);
