/* Appa · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
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
