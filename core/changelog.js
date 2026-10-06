/* Kyoshi · core/changelog.js — Kyoshi's own version and changelog (the shared core).
 * Newest first; K.VERSION is the top entry. Version X.YYY, bump one tier per
 * change: +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Apps keep their own in apps/<id>/changelog.js. Keep entries brief: a sentence per change. */
(function (K) {
  "use strict";
  K.CHANGELOG = [
    { version: "4.860", date: "2026-10-06", changes: [
      "Cloud sync: every app's data stays current on your phone and computers through a private GitHub repository, each app's file encrypted (AES-256-GCM) with a key only your devices hold.",
      "One key per cloud: Developer Mode's Cloud block sets a new cloud up (making the key, and a KYOSHI.md saying what the repository is), takes the key on another device (remembered unless you untick it), shows it again, and takes a new token when GitHub's expires.",
      "While all is well nothing shows; when GitHub can't be reached, or the key is refused, a banner above the app says so in plain words (when it was last reached, how many changes are waiting) with Try now, and a cloud glyph shows in the header, both until it's fixed.",
      "Download decrypted copy (every app, in one file that Import all takes back) and Decrypt a file… (one file from the repository) give plain copies of the cloud's data.",
      "The cloud carries text only: photos and documents stay on the device they were added on (and in the sync folder, if you use one)."
    ] },
    { version: "3.860", date: "2026-10-06", changes: [
      "Backup & sync left the apps' pages: Developer Mode (Ctrl+9, or the DEV badge) holds Export JSON and Import JSON for the app on screen, Export all and Import all, and the sync folder.",
      "Inside: the sync engine (counters, combining) is one file and the folder transport another, so a second way to sync can share it."
    ] },
    { version: "3.760", date: "2026-10-05", changes: [
      "Bugs & requests are no longer ticked off one by one: everything submitted stays listed (and counted on the footer link) until you clear it in Developer Mode, whose Copy all and Download .md take them all, feature requests first, then bugs.",
      "Submit empties the box at once, so closing the pop-up right after never asks to discard a report that's already saved."
    ] },
    { version: "3.750", date: "2026-10-05", changes: [
      "The browser tab always reads “Kyoshi”, with one dark-green icon, instead of changing with the app on screen: Lucide's flame (dragons were the first firebenders), as a drawn dragon didn't read at tab size.",
      "A checkup or meeting done today shows its ✓ in green on the app's header line.",
      "The footer's “Bugs & requests” takes a bug or a feature request: pick one above the box (remembered for next time), and the report's first line says which.",
      "Its pop-up lists the open ones under the form, newest first, each with Done ✓, and the footer link says how many are open.",
      "Developer Mode's Copy all and Download .md take the open ones only, feature requests first, then bugs; Clear done removes the ones marked done."
    ] },
    { version: "3.650", date: "2026-10-05", changes: [
      "The bug report log keeps the latest 200 reports instead of 20."
    ] },
    { version: "3.640", date: "2026-10-03", changes: [
      "Apps can share a weekly routine (slots at set times, like Turtleduck's meals each day and its grocery trips) that Momo keeps in its baseline, and say a need fills one of those slots on its day, or is set by the app (its day, time and length): Momo pins it there and won't let it be moved."
    ] },
    { version: "3.540", date: "2026-10-03", changes: [
      "Apps can ask Momo for a card of their own per need (fill “card”), say which need a done one completes (of) and hint at a time of day (time)."
    ] },
    { version: "3.440", date: "2026-10-03", changes: [
      "Bug reports are denser: one fact per line, no prose, for an AI reader.",
      "They also tell the build, the time zone and whether Kyoshi was opened from a file, and keep each error's message on Safari and Firefox."
    ] },
    { version: "3.430", date: "2026-10-02", changes: [
      "Iroh's meetings only start counting once you've added a goal or an area, so an Iroh you haven't used asks Momo for nothing and puts no dot on its icon.",
      "Importing a backup (an app's Import JSON, or Import all) says when the backup was made and how much newer what's here is, before replacing anything; backups now carry their date."
    ] },
    { version: "3.330", date: "2026-10-02", changes: [
      "Added Pabu, for keeping in touch: the people you want to stay close to, each due a call, a text or a visit every week to every year; Momo fits them into your “Keep in touch” cards and puts birthdays on its board."
    ] },
    { version: "3.230", date: "2026-10-02", changes: [
      "Added Turtleduck, for meals: recipes typed or pasted in bulk, a two-week plan laid out by dragging them onto the days (portions of a batch kept to place later), shopping trips with a grocery list each, and a cook view; Momo fills your Breakfast, Lunch, Dinner and Cooking cards with the day's meals and a Groceries card on each trip's day."
    ] },
    { version: "3.130", date: "2026-10-02", changes: [
      "The header keeps one width in every app, so the app switcher and Theme stay put when you switch apps."
    ] },
    { version: "3.120", date: "2026-10-02", changes: [
      "Keeping the screen on (Appa's job timer, a Badgermole workout) is one shared piece now: it reliably lets the screen sleep again once the timer stops or the workout ends, even right after it started."
    ] },
    { version: "3.020", date: "2026-10-02", changes: [
      "Momo comes first in the switcher and opens first on a new device."
    ] },
    { version: "3.010", date: "2026-10-02", changes: [
      "Added Badgermole, for workouts: routines in a rotation, sets logged with one thumb between them, PRs and a streak; Momo fills your \"Workout\" cards with the week's sessions."
    ] },
    { version: "2.910", date: "2026-10-02", changes: [
      "Added Iroh, for goals: the vision for each area of your life, this year's goals and this season's, whose hours Momo makes time for.",
      "Meetings can come every season: due in the first week of each new season.",
      "Apps can ask Momo for hours that spread over several cards (Iroh's goals), with what's still missing in its Tasks.",
      "Developer Mode's time travel can jump to the next season."
    ] },
    { version: "2.810", date: "2026-10-02", changes: [
      "Added Hawky, for errands: jot one down in seconds on the phone, and Momo fits it into your \"Errands\" cards."
    ] },
    { version: "2.710", date: "2026-10-02", changes: [
      "Checkups: each app can show a quiet \"Last checkup: 12 days ago\" under its name, with Done ✓ for when you've looked it over in depth, and no schedule, reminders or dot.",
      "Picking a schedule in a checkup's settings turns it into a meeting, as before."
    ] },
    { version: "2.610", date: "2026-10-02", changes: [
      "Meetings: every app has a regular check-in with you, shown under its name with when you last met and a Done ✓ button; tap it to change how often, how long, or when you last met.",
      "A meeting coming due in the next two weeks goes to Momo and fills your \"Meeting\" card in the week before it's due; an overdue one puts a dot on its app's icon. Meetings travel with sync and backups.",
      "Developer Mode's time travel can jump a month."
    ] },
    { version: "2.510", date: "2026-10-02", changes: [
      "A shared inbox: any app can list what it needs done this week and next, and Momo fills your matching blocks with it, with a way back to the app."
    ] },
    { version: "2.410", date: "2026-10-01", changes: [
      "If an app ever can't start, its page now offers to download its data, so your data is never out of reach.",
      "An odd address ending (like #constructor) no longer leaves the page blank.",
      "PDF reports no longer fail on a link with a stray % in it, and a damaged or booby-trapped PDF can't freeze the page or use up its memory.",
      "New apps are checked for a usable id of their own as they're added."
    ] },
    { version: "2.310", date: "2026-09-29", changes: [
      "Added Appa, for preventive maintenance and records: switch to it from the button beside Theme.",
      "Apps can keep photos and PDFs: they stay in the browser's storage and travel through the sync folder as ordinary files (backups hold the data only).",
      "Apps can make PDF reports, with pages from other PDFs merged right in; Developer Mode counts the photos and documents kept."
    ] },
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
