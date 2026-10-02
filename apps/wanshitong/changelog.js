/* Wan Shi Tong · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "2.131", date: "2026-10-02", changes: [
      "What's in progress goes to Momo through the shared inbox: its cards there show the owl and \"Open in Wan Shi Tong\"."
    ] },
    { version: "2.121", date: "2026-10-01", changes: [
      "A category with an unusual name, from a newer version or a synced save, is kept as it is instead of lost on the next save.",
      "Removed a leftover note from when items had a cost."
    ] },
    { version: "2.120", date: "2026-09-29", changes: [
      "What's in progress also waits in Momo's Tasks, ready to drag onto your week."
    ] },
    { version: "2.110", date: "2026-09-29", changes: [
      "Removed cost from recommendations and from saved data."
    ] },
    { version: "2.100", date: "2026-09-29", changes: [
      "Novels and textbooks are now one Books category; the course categories are gone (old ones show as Other)."
    ] },
    { version: "2.000", date: "2026-09-28", changes: [
      "Up to three things can be in progress at once, of any kind, and finishing one moves Up next into its spot.",
      "Starting a fourth asks which one goes back to make room.",
      "The magazine is now called the backlog.",
      "Added Games, with the platform as its details."
    ] },
    { version: "1.000", date: "2026-09-28", changes: [
      "Initial release: keep every recommendation (novels, textbooks, movies, TV/anime and courses) in one place, with what's in progress and up next on top and the rest waiting in the magazine.",
      "Finishing something moves Up next into In progress, and keeps it in a Finished list."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.wanshitong);
