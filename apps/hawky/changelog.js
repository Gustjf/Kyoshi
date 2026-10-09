/* Hawky · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "2.340", date: "2026-10-09", changes: [
      "A shopping list not locked yet can be marked Bought, without the 30- or 7-day waiting period (a question first): every item bought today, the list into Done.",
      "When a list's waiting period is over, Hawky adds an errand for it (“Buy Running shoes at REI”, due this Sunday, 30 minutes), a card of its own in Momo like any errand: checking it off completes the list (✓ again undoes that), and completing the list checks it off; “Open in Hawky” shows the list. Deleting the list deletes its errand; deleting the errand leaves the list."
    ] },
    { version: "2.240", date: "2026-10-08", changes: [
      "Sync combines what two devices changed with one shared rule (the later change wins; a tie the same on every device), the same code in every app instead of a copy each. Nothing changes in what you see."
    ] },
    { version: "2.230", date: "2026-10-06", changes: [
      "Each store's colour is one of twelve, given in the order stores were first used (so a store keeps its colour as new ones come), the most different shades first; no two stores share one until you have more than twelve.",
      "In the shopping add row, typing a different store after an add clears the topic kept from that add, so a new store starts with a fresh topic.",
      "Quick add starts on This week (due this Sunday) instead of No day, and goes back to it after each add."
    ] },
    { version: "2.220", date: "2026-10-06", changes: [
      "Backup & sync left the page: Export JSON, Import JSON and the sync folder are in Developer Mode now (Ctrl+9, or the DEV badge)."
    ] },
    { version: "2.210", date: "2026-10-05", changes: [
      "Each store's shopping lists carry the store's own colour (a dot by its name, a coloured edge on its lists), so they're told apart while scrolling.",
      "Overdue errands have a Tomorrow → button that moves them to tomorrow and counts how often; past three times a warning mark says so (in the errand's pop-up and on its card in Momo too). Reload Hawky on every device after updating: an older copy drops the count.",
      "Quick add offers 5 minutes, and This week / Next week, which make the errand due that Sunday."
    ] },
    { version: "2.110", date: "2026-10-03", changes: [
      "Shopping lists, on a tab of their own: items by store and topic, one list per topic (both suggested as you type), each item with a note or a web link and how long it has waited.",
      "Lock a list for 30 or 7 days to cool off: until then items can only come off (or unlock it early, after an amber warning); then tick each item as you buy it, or Tick all, and the done list folds away.",
      "Later and Someday are one Later: dated errands first, then the undated, oldest first, each showing how long it has waited.",
      "Quick add's days are Today, Pick a day or No day, and + Note adds a note (in the errand's pop-up too): its first line shows under the errand and on its card in Momo."
    ] },
    { version: "1.110", date: "2026-10-03", changes: [
      "Each errand is its own card in Momo, titled by it and as long as it takes: it waits in Momo's Tasks until you drag it onto a day, and shows ✓ once you tick it off here."
    ] },
    { version: "1.010", date: "2026-10-02", changes: [
      "Momo gets only the errands due by the end of next week (and those without a date), so one due in a month no longer takes this week's room.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: errands and pop-up tasks, added in seconds on the phone (a tap each for the day and how long), listed by when they're due, with the done ones folded away.",
      "Momo fits them into your \"Errands\" cards, soonest due first, and ticks them off there once they're done; what doesn't fit waits in its Tasks."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.hawky);
