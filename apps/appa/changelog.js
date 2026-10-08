/* Appa · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.362", date: "2026-10-08", changes: [
      "Sync combines what two devices changed with one shared rule (the later change wins; a tie the same on every device), the same code in every app instead of a copy each. Nothing changes in what you see."
    ] },
    { version: "1.352", date: "2026-10-06", changes: [
      "Says plainly that photos and PDFs never travel through cloud sync: only the sync folder copies them."
    ] },
    { version: "1.342", date: "2026-10-06", changes: [
      "Backup & sync left the page: Export JSON, Import JSON and the sync folder are in Developer Mode now (Ctrl+9, or the DEV badge)."
    ] },
    { version: "1.332", date: "2026-10-03", changes: [
      "Each maintenance job is its own card in Momo, titled with its thing (“Car: Oil change”) and as long as it takes: it waits in Momo's Tasks until you drag it onto a day, and shows ✓ once you record it."
    ] },
    { version: "1.232", date: "2026-10-02", changes: [
      "Momo gets only the jobs due by the end of next week, and a job recorded this week or next shows ✓ on that day's card there instead of vanishing (“Open in Appa” opens its record).",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.132", date: "2026-10-02", changes: [
      "The screen goes back to sleeping normally once the timer stops, even right after it started, or once its job is deleted (Kyoshi's shared screen-on piece)."
    ] },
    { version: "1.131", date: "2026-10-02", changes: [
      "A \"Last checkup\" line under the name: tap Done ✓ after a deeper look at Appa."
    ] },
    { version: "1.121", date: "2026-10-02", changes: [
      "Appa no longer has a regular meeting with you, as you check it daily."
    ] },
    { version: "1.111", date: "2026-10-02", changes: [
      "Appa has a quarterly meeting with you for new things and records: it shows under Appa's name, and goes to Momo's Meeting card when it's due."
    ] },
    { version: "1.011", date: "2026-10-02", changes: [
      "Jobs go to Momo through the shared inbox: each fills a \"… maintenance\" card whole, and \"Open in Appa\" opens that very job."
    ] },
    { version: "1.001", date: "2026-10-01", changes: [
      "Appa no longer stops working when a meter job would come due centuries away (a typo in its interval, or a meter that barely moves): it shows the reading it's due at.",
      "A job whose thing was deleted on another device no longer breaks the page: Appa goes back home.",
      "Links in a job's notes leave out the punctuation after them, like a sentence's full stop.",
      "Removed a helper nothing used."
    ] },
    { version: "1.000", date: "2026-09-29", changes: [
      "Initial release: preventive maintenance for your things, by time, season or meter reading, whichever comes first, each job noting where its interval comes from.",
      "Jobs go to Momo's Tasks two weeks before they're due, sized to how long they take; Appa learns that from your timed jobs.",
      "A clear job view with your notes, a Start/Finish timer and a one-tap Done, plus optional cost, notes, photos, PDFs and links as proof.",
      "A clean PDF report of what was done, with each job's proof right after it, ready for a buyer or an insurer."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.appa);
