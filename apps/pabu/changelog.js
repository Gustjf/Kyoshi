/* Pabu · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "2.241", date: "2026-10-09", changes: [
      "The Birthdays strip's heading says what it lists: “Birthdays & Anniversary”, “Anniversary” or “Birthdays”."
    ] },
    { version: "2.231", date: "2026-10-09", changes: [
      "Set up… in Pabu's Developer Mode tools: pick the one person you're in a relationship with, and your anniversary if you like (the year optional). A small heart shows beside their name, with the anniversary's date under it (and the years, when you give the year); the anniversary comes up in the Birthdays strip when it's within 30 days, and on Momo's board on the day, like a birthday. Reload Pabu on every device after updating: an older copy drops them."
    ] },
    { version: "2.131", date: "2026-10-08", changes: [
      "Sync combines what two devices changed with one shared rule (the later change wins; a tie the same on every device), the same code in every app instead of a copy each. Nothing changes in what you see."
    ] },
    { version: "2.121", date: "2026-10-06", changes: [
      "Backup & sync left the page: Export JSON, Import JSON and the sync folder are in Developer Mode now (Ctrl+9, or the DEV badge)."
    ] },
    { version: "2.111", date: "2026-10-04", changes: [
      "Saving someone's pop-up without changing anything no longer undoes a change made to them meanwhile on another device."
    ] },
    { version: "2.110", date: "2026-10-03", changes: [
      "One person, several calls, texts and visits: each on its own schedule, with its own minutes and days you talked (a ✓ counts for that one only), and each its own card in Momo (“Call Mom”, “Text Mom”).",
      "This week at the top: every call, text or visit due by Sunday or overdue, soonest first, with ✓; ticked ones stay until the week ends.",
      "A group for each person, with chips to show one group at a time, and notes up to 1,000 characters (likes, dislikes, what you talked about).",
      "The People list: one line per person, A to Z, with their calls, texts and visits, when the next is due, and their birthday.",
      "Renaming is one edit: Save keeps the whole person at once and says what's wrong right above it instead of stopping quietly; an unfinished “Talked on” day is left out, with a note.",
      "Older backups still import: each person's call, text or visit carries over, with its days."
    ] },
    { version: "1.110", date: "2026-10-03", changes: [
      "Each call, text or visit due is its own card in Momo (“Call Mom”), as long as it takes: it waits in Momo's Tasks until you drag it onto a day, and shows ✓ once you've talked."
    ] },
    { version: "1.010", date: "2026-10-02", changes: [
      "A dot on Pabu's icon while anyone is overdue.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: the people you keep in touch with, each with how often and how (a call, a text, a visit), listed by who's due, Talked ✓ with the days kept, and birthdays coming up.",
      "Momo fits them into your “Keep in touch” cards, soonest due first, and shows ✓ once you've talked; birthdays are events on its board."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.pabu);
