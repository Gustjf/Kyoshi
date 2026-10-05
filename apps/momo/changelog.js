/* Momo · changelog.js — Momo's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "10.164", date: "2026-10-05", changes: [
      "Cards show when they end as well as when they start, on the board and on Today, and so do other apps' events; a card too narrow for its end still shows its start and hours.",
      "A card can have time before and after it inside it (a commute, by default), the same both ways or not, set in its pop-up; none is the default."
    ] },
    { version: "10.064", date: "2026-10-03", changes: [
      "Your baseline keeps a card for each of Turtleduck's meal slots (breakfast, lunch and dinner every day) and each scheduled grocery trip, pinned at the times set in Turtleduck and as long as their usual length; they follow when those change, and your own cards stay where they are (one running into a slot is flagged, to arrange once).",
      "Loaded into a week, a slot takes its meal's name, length and time (a day's exception too), and goes back to the plain slot when the meal goes; a cooking session or a trip off the schedule gets a pinned card of its own, even in a week not planned yet. Nothing of Turtleduck's waits in Tasks any more.",
      "Cards set in Turtleduck can't be dragged, resized, pinned, cut or deleted in Momo: tapped, they show “Change it in Turtleduck” (or “Set in Turtleduck” on an empty slot) with Close; their colour still changes there. A copy (Ctrl+C) is yours. Clear and Save as baseline keep the slots.",
      "The true cost counts each meal slot's title (Dinner…) against the room its slots give it, so meals aren't charged twice against your free hours.",
      "Reload Momo on every device: an older copy would drop the slots' details when it syncs."
    ] },
    { version: "9.064", date: "2026-10-03", changes: [
      "Upcoming weekends: a folded line under the board and under Today shows how many of the next 13 weekends have a plan; open it to see each and type a brief plan, so weekends get spent on purpose. Reload Momo on every device.",
      "This week's and next week's Saturday on the board shows its weekend's plan too: tap it to change it."
    ] },
    { version: "8.964", date: "2026-10-03", changes: [
      "Each app's errand, call, workout, meal, cooking session, grocery trip and maintenance job is now a card of its own, titled by it, as long as it takes, with its app's icon and colour (one colour per app: change it in any of its cards' pop-up).",
      "Tasks list them one by one: drag one onto a day (or click it and pick the day); drag its card back into Tasks to take it off again.",
      "Meals, cooking sessions, trips and things already done (a logged workout, a call, an errand ticked off, a job recorded) land on their day by themselves, as near their time as your cards allow — once the week has cards of yours — and leave again if their app drops them, unless you moved them; their pop-up says “Change it in…” instead of Delete.",
      "A card's ✓ shows once its app says it's done; one left on a day gone by without being done is red-edged as missed, to drag to a day ahead.",
      "Generic blocks (Errands, Workout, Keep in touch, Breakfast, Lunch, Dinner, Cooking, Groceries, “… maintenance”) are no longer filled: take them out of your baseline to make room. Copy previous week and Save as baseline leave the apps' cards out: they belong to their week.",
      "The true cost shows what each app asks of an average week against the free hours your baseline leaves (Free time counts as free).",
      "Reload Momo on every device: an older copy would drop the new cards' details when it syncs."
    ] },
    { version: "7.964", date: "2026-10-02", changes: [
      "Tasks come in a chunk per app, with its icon, how many and how long, so each app's part of your week is plain to see; they go as you plan them, and the week is “all assigned ✓” only once its Tasks are empty too.",
      "Each week's Tasks list only what can go on that week; something that could go on either shows on both.",
      "This week's past days show what was done on them, and a card holding something late is red-edged and says “late”, on the board, in its pop-up and on Today.",
      "The true cost: Momo keeps what the apps ask of each week, and the Baseline tab shows, app by app, what an average week asks of each block against what your baseline gives it; drag a block it's short of onto a day.",
      "The close-out waits in its banner on a phone (on a computer it still pops up); Later puts it off until tomorrow; after a break, Close all as planned closes every week waiting; a goal's row says when some of its hours had no card; and a week never planned counts as no hours for your goals.",
      "“Open in…” from a card's pop-up asks before dropping your changes, a birthday or anything else at any time of day no longer adds to its day's hours, and starting Momo no longer saves anything when nothing changed.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "6.964", date: "2026-10-02", changes: [
      "The weekly close-out now lists only your goals from Iroh, each with the hours planned for it that week: lower or raise any that differed.",
      "A past week without goals closes on its own, with no pop-up.",
      "Errands, maintenance, meetings and the rest are marked done in their own apps, through a card's \"Open in…\"."
    ] },
    { version: "6.864", date: "2026-10-02", changes: [
      "Goals now live in Iroh: Momo's Long-term goals, the goal pop-up, the goal on cards and goal tasks are gone. Goals saved here stay in your data and backups, untouched.",
      "The weekly close-out reviews where the week's hours went: every card title on its days, with its planned hours. Lower what fell short; Close out week keeps the hours, and Iroh shows its goals' progress from them.",
      "Every past week with cards on its days comes up for a close-out, and Reopen takes its hours back off.",
      "Cards with the same title always fold together and share a colour, a goal's old cards included."
    ] },
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
