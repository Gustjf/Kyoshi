/* Momo · changelog.js — Momo's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "5.864", date: "2026-10-02", changes: [
      "Iroh's goals fill your cards titled like them: a goal's hours for the week spread over those cards in turn, the ones on earlier days this week count as done, and what's still missing is a task on that week's board."
    ] },
    { version: "5.764", date: "2026-10-02", changes: [
      "A \"Last checkup\" line under the name: tap Done ✓ after a deeper look at Momo."
    ] },
    { version: "5.754", date: "2026-10-02", changes: [
      "Momo no longer has a weekly meeting with you, as you check it daily; the weekly close-out stays as it was."
    ] },
    { version: "5.744", date: "2026-10-02", changes: [
      "Fixed today's column on the board spreading over the next day's when a card in it has a long line, like a Meeting card filled with meetings you've had today.",
      "Fixed Today's \"Now\" running out of its box during free time, and an event there lines up like the rest."
    ] },
    { version: "5.743", date: "2026-10-02", changes: [
      "Momo has a weekly meeting with you to close out last week and plan the next two, after the other apps' meetings.",
      "A card titled \"Meeting\" fills with the apps' meetings coming due, each in the week before it's due; what doesn't fit goes to Tasks."
    ] },
    { version: "5.643", date: "2026-10-02", changes: [
      "Today: a big, phone-first view of what's on now with the time left, what's next, the rest of today and tomorrow, free time and other apps' events included.",
      "Tap a card on Today for its times, goal and what fills it, with \"Open in…\" and a way to edit it; tap an event for its own pop-up.",
      "Momo opens on Today on a phone and on the board on a computer; the Today and Week buttons switch at any time."
    ] },
    { version: "5.543", date: "2026-10-02", changes: [
      "Blocks: a card fills with what other apps need under its title (Appa's jobs, what's in progress in Wan Shi Tong), showing their icon, a ✓ once done, and the details with \"Open in…\" in its pop-up.",
      "Tasks shows what no block covers, from any app that lists needs, so new apps need no changes in Momo.",
      "A card drawn from a task that doesn't say how long now starts at 1 hour, not 1.5."
    ] },
    { version: "5.443", date: "2026-10-01", changes: [
      "Undo keeps fewer steps once years of weeks make each one big, so a long session can't use up the browser's memory.",
      "Removed a helper nothing used."
    ] },
    { version: "5.442", date: "2026-09-29", changes: [
      "Maintenance from Appa shows up in Tasks two weeks before it's due, one task per thing, sized to how long its jobs take; it leaves once cards on your days cover that time.",
      "A card or task for Appa's maintenance links to it: Open in Appa shows the job."
    ] },
    { version: "5.342", date: "2026-09-29", changes: [
      "Shortened Momo's notes for the coding assistant."
    ] },
    { version: "5.332", date: "2026-09-29", changes: [
      "An event's quick fix is now the one clear time closest to its own, within 3 hours of it so doses stay on schedule; a conflict shows just that, and times picked by hand stay within those 3 hours too."
    ] },
    { version: "5.322", date: "2026-09-29", changes: [
      "Events now count toward their day's 24 hours: they take free time, or Free time lends them the hours, and no card ever moves for one.",
      "An event on any other card or event is a conflict: its quick fix is the nearest clear time that same day, and with none, the red warning stays.",
      "Events look like cards, the full width of the day with their app's icon, and a logged dose gets a small ✓."
    ] },
    { version: "5.222", date: "2026-09-29", changes: [
      "Events from your other apps show on the board at their day and time, starting with your GLP-1 doses from Bosco; they take no hours from the day.",
      "An event that overlaps another event or a pinned card turns red: click it for a one-click quick fix (the nearest clear time, or the day before or after), pick another day and time that week, or keep it."
    ] },
    { version: "5.122", date: "2026-09-29", changes: [
      "The parking lot is now Tasks: every long-term goal and everything in progress in Wan Shi Tong waits there, ready to drag onto a day as often as you like (1.5h each time).",
      "Click a task to put it on several days at once; Tasks shows on the baseline too, and a card's Parked option is now No day."
    ] },
    { version: "5.022", date: "2026-09-28", changes: [
      "Momo now lives in Kyoshi with your other apps: switch between them from the button beside Theme.",
      "One sync folder now keeps every app's autosaves, and Developer Mode, bug reports and the theme are shared across apps.",
      "Two open tabs no longer save over each other's changes, and your data from the standalone Momo comes over on first open."
    ] },
    { version: "4.022", date: "2026-09-26", changes: [
      "Added a peach tab icon (from Lucide; Momo is named after a peach) so Momo is easy to spot among browser tabs."
    ] },
    { version: "4.012", date: "2026-09-26", changes: [
      "Cards at the same time line up across every day: where a short card needs room for its text, that stretch of time is a little taller on all days instead of just its own.",
      "A pinned card that the cards above run into is drawn at its own time, set in over them, instead of below them."
    ] },
    { version: "4.011", date: "2026-09-26", changes: [
      "Free time is the one place on a day to add a card: a day whose last card runs to midnight has no + under it any more, and every free block says how much time it has, short ones too."
    ] },
    { version: "4.010", date: "2026-09-26", changes: [
      "Colours pick themselves: every card with the same title is the same colour everywhere, and no two titles or goals share one.",
      "Card and goal editors offer eight highlight colours; picking one that another title or goal has swaps their colours.",
      "A title off the boards keeps its colour for eight weeks, so it's the same when it's back; existing titles keep the colour most of their cards had."
    ] },
    { version: "3.010", date: "2026-09-26", changes: [
      "Cards are easier to read: the title gets the whole top line, with the start time, pin and hours on the line below, and short cards are a little taller to fit both.",
      "A parked card dragged over a day shows its whole title beside the time it would start at."
    ] },
    { version: "3.009", date: "2026-09-26", changes: [
      "Alt+click a card (Option+click on a Mac) to delete it straight away: while Alt is held, the card under the mouse is shaded red, and Ctrl+Z brings it back."
    ] },
    { version: "2.999", date: "2026-09-26", changes: [
      "Cards show when they start on a 24-hour clock: each day starts at 0000 and every card begins where the one above it ends, so dragging a card is what sets its time.",
      "The pin by a card's time holds it there; on the baseline a card's editor can also pin it at a time, which it keeps in every week the baseline goes into.",
      "The free time before a pinned card shows as a gap you can click to add a card, and times turn red where cards run into a pinned one or past midnight.",
      "Matching cards only join up when they're next to each other, so a day can have Sleep at both ends."
    ] },
    { version: "1.999", date: "2026-09-26", changes: [
      "A copied card stays ready for 5 more seconds after each paste, so it can go onto several days in a row; a cut card moves on the first paste and later pastes are copies of it."
    ] },
    { version: "1.998", date: "2026-09-26", changes: [
      "Copy (Ctrl+C) or cut (Ctrl+X) the card under the mouse and paste it (Ctrl+V) right after the card the mouse is on, even on another week: it's shaded blue for a copy or amber for a cut until it's pasted, Esc is pressed, or 5 seconds pass."
    ] },
    { version: "1.898", date: "2026-09-26", changes: [
      "A goal's finish-by date has Spring, Summer, Fall and Winter buttons: each picks the day before that season starts (its true first day in North America), and clicking it again moves on a year."
    ] },
    { version: "1.798", date: "2026-09-26", changes: [
      "Goals can be set in hours a week instead of total hours: their bar shows the week's hours, green once there, yellow while short with enough hours left to budget, red when not."
    ] },
    { version: "1.698", date: "2026-09-26", changes: [
      "No more pop-up at the bottom describing each change: undo with Ctrl+Z, or on a phone with Undo in Developer Mode."
    ] },
    { version: "1.688", date: "2026-09-26", changes: [
      "Picking other days in a card's editor makes that card on those days match it — the same hours and colour — even when you haven't changed them, and even where it sits somewhere else that day."
    ] },
    { version: "1.687", date: "2026-09-26", changes: [
      "A Ctrl-drag puts the card right after the same card on every day (drop Commute under Sleep and it goes under Sleep everywhere), and brings it along even where it sits inside another card."
    ] },
    { version: "1.686", date: "2026-09-26", changes: [
      "Hold Ctrl while dragging a card (or keep holding it a moment longer on a phone) to move the same card on every day at once: each stays on its day and goes to the same spot there."
    ] },
    { version: "1.586", date: "2026-09-26", changes: [
      "Changing a card's hours with other days picked gives that card the same hours on those days too."
    ] },
    { version: "1.585", date: "2026-09-26", changes: [
      "A day's “over” block is just a label now: clicking it no longer opens a new card."
    ] },
    { version: "1.584", date: "2026-09-26", changes: [
      "A card inside another goes at its top, middle or bottom: drop it on that part of the card, or pick it under Where. Any number can share a position."
    ] },
    { version: "1.484", date: "2026-09-26", changes: [
      "Goals have a most-hours-a-week limit (10h unless changed), and turn red when finishing on time would take more than that."
    ] },
    { version: "1.384", date: "2026-09-26", changes: [
      "Changing a card's colour with other days picked recolours that card on those days too."
    ] },
    { version: "1.383", date: "2026-09-26", changes: [
      "A card can go inside another (drop Lunch onto Work, or pick Work under Inside): each keeps its own hours, and Work's block grows to fit both."
    ] },
    { version: "1.283", date: "2026-09-26", changes: [
      "Esc closes Developer Mode too, and closing a window that has unsaved changes asks before discarding them."
    ] },
    { version: "1.273", date: "2026-09-26", changes: [
      "The baseline shows how much of the week is fixed as a percentage instead of hours."
    ] },
    { version: "1.263", date: "2026-09-26", changes: [
      "A day's total turns green or red the moment a resize or drag brings it to or past 24 hours, not only on release."
    ] },
    { version: "1.262", date: "2026-09-26", changes: [
      "The Dev button moved to the bottom-right corner beside the version number, with room below the footer."
    ] },
    { version: "1.252", date: "2026-09-26", changes: [
      "A Dev button next to Theme turns developer mode on and off without a keyboard (for phones)."
    ] },
    { version: "1.242", date: "2026-09-25", changes: [
      "Close-out starts each goal at its planned hours; lower any that fell short."
    ] },
    { version: "1.232", date: "2026-09-25", changes: [
      "Weeks can copy the previous week's plan, and any week can be saved as the new baseline."
    ] },
    { version: "1.132", date: "2026-09-25", changes: [
      "The baseline has a + New card button, so a card can be added without clicking a day first."
    ] },
    { version: "1.131", date: "2026-09-25", changes: [
      "Momo now opens on This week instead of Next week."
    ] },
    { version: "1.121", date: "2026-09-25", changes: [
      "Daily and Weekdays no longer toggle; a Clear button next to them unpicks every day instead."
    ] },
    { version: "1.111", date: "2026-09-25", changes: [
      "Clicking Daily or Weekdays again takes those days back off, and each button stays highlighted while its days are picked."
    ] },
    { version: "1.101", date: "2026-09-25", changes: [
      "Editing a card can now add it to more days too, and the day picker has Daily and Weekdays buttons."
    ] },
    { version: "1.001", date: "2026-09-25", changes: [
      "New cards keep their starting colour while you type — one the board isn't using yet.",
      "Goal finish-by dates are typed as month, day and year; a missing day becomes today's, and one the month doesn't have becomes its nearest end.",
      "Hours and dates typed outside their range snap to the nearest allowed value, and names lose stray spaces."
    ] },
    { version: "1.000", date: "2026-09-25", changes: [
      "Initial release: a YNAB-style weekly time budget — 168 hours to give a job, seven 24-hour day columns, and drag-and-drop cards sized by duration.",
      "A baseline week that loads in one click, long-term goals with optional finish-by dates, and a weekly close-out that logs goal hours.",
      "Local storage, JSON export/import, autosave & sync to a folder, undo, bug reports, and Developer Mode with time travel for testing."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.momo);
