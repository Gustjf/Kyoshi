/* Badgermole · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "2.211", date: "2026-10-06", changes: [
      "Backup & sync left the page: Export JSON, Import JSON and the sync folder are in Developer Mode now (Ctrl+9, or the DEV badge)."
    ] },
    { version: "2.201", date: "2026-10-03", changes: [
      "Several programs, one followed at a time: tap one to switch to it (it starts from its first routine), make a new one (it starts empty), or rename or delete the one you follow; your rotation so far is now the program “Program”.",
      "Each exercise has its own progression step (+2.5, +5, +7.5 or +10 lb, shown in kg when you use kg): its weight goes up by that much, and − / + move by it during a workout.",
      "An exercise in a routine can go “to failure”: its reps become a minimum (“Set 2 of 3 · 8+ reps, to failure”), and you log the good reps.",
      "Supersets: link two exercises next to each other in a routine; they share a colour, and ✓ takes you back and forth between them during a workout."
    ] },
    { version: "1.201", date: "2026-10-03", changes: [
      "Each workout is its own card in Momo, titled by its routine: the week's planned ones wait in Momo's Tasks until you drag them onto a day, and a logged one ticks off the planned one it stands for, or lands on its day at the time you started, as long as it took."
    ] },
    { version: "1.101", date: "2026-10-02", changes: [
      "A dot on Badgermole's icon when today's workout is needed to keep the week's target; it clears once you've logged one today.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.001", date: "2026-10-02", changes: [
      "The screen stays on during a workout through Kyoshi's shared screen-on piece; nothing changes in use."
    ] },
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: workouts as routines in a rotation, each set logged with one thumb between sets (prefilled from last time, a step heavier once every set hit its reps), PRs the moment they happen, the week's count, a streak and a month calendar whose days open to fix what was logged.",
      "Momo fills your \"Workout\" cards with the week's sessions in program order, and ticks them off once they're logged; what doesn't fit waits in its Tasks."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.badgermole);
