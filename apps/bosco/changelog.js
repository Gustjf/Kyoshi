/* Bosco · changelog.js — Bosco's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "7.159", date: "2026-09-29", changes: [
      "Your doses now show on Momo's board as 15-minute events at their day and dose time, so each one has its place in your week."
    ] },
    { version: "7.059", date: "2026-09-28", changes: [
      "Bosco now lives in Kyoshi with your other apps: switch between them from the button beside Theme.",
      "Export, Import and folder sync moved to a Backup & sync section at the bottom, and one sync folder now keeps every app's autosaves.",
      "Developer Mode, bug reports and the theme are shared across apps, and your data from the standalone Bosco comes over on first open."
    ] },
    { version: "6.059", date: "2026-09-28", changes: [
      "Current Trend's goal ends with per week, e.g. Goal: lose 1% ± 0.25% per week."
    ] },
    { version: "6.049", date: "2026-09-28", changes: [
      "Current Trend's goal names its direction again, e.g. Goal: lose 1% ± 0.25%."
    ] },
    { version: "6.039", date: "2026-09-28", changes: [
      "Current Trend's goal now reads as your target ± range, e.g. Goal: 1% ± 0.125%, as precise as you entered it.",
      "The footer, goal projections and sync status use | between values instead of dots."
    ] },
    { version: "6.029", date: "2026-09-28", changes: [
      "The weekly rate is green on pace, yellow within twice your on-pace range, and red beyond that or going the wrong way.",
      "The weekly rate's lb or kg is now full size, and the averages line just reads weight to weight over the days between.",
      "Dose cards and vial lines use | between values instead of dots."
    ] },
    { version: "6.019", date: "2026-09-28", changes: [
      "Current Trend reads more concisely, with | between values instead of dots that could pass for decimal points.",
      "The weekly rate now turns red whenever it's outside your on-pace range.",
      "The rolling average's pills now match Current Trend's (7d to 90d); All is gone."
    ] },
    { version: "6.009", date: "2026-09-28", changes: [
      "Current Trend's weekly rate now compares your latest 7-day average with the one a week earlier (or 14–90 days, by its pills), allowing for missed weigh-ins.",
      "The weekly rate also shows the lb or kg a week it comes to.",
      "Setup has a weekly pace goal (lose or gain, % a week, on-pace range): the rate is green on pace, amber off pace, red going the wrong way.",
      "The pace goal's lose or gain now decides which way counts as progress."
    ] },
    { version: "5.909", date: "2026-09-27", changes: [
      "Upcoming doses and the dose pop-up now show each dose's weekly equivalent, as a last check before taking it."
    ] },
    { version: "5.809", date: "2026-09-26", changes: [
      "Upcoming doses and the dose pop-up now show your saved vial's concentration, to check against the vial in hand before drawing a dose.",
      "Each upcoming dose's mg and syringe units now sit on a larger line of their own that never splits, so they're easy to read on phones."
    ] },
    { version: "5.709", date: "2026-09-26", changes: [
      "A late dose's pop-up now has Took it today (beside Took it on the day it was due), which logs it today and counts your next dose from there."
    ] },
    { version: "5.609", date: "2026-09-26", changes: [
      "The dose pop-up no longer closes by itself when opened from a later dose's card, and never logs an amount your plan has since changed.",
      "A dose logged with Bosco open in two tabs is no longer lost when the other tab saves; each tab now picks up the other's changes.",
      "Deleting a History day that has a dose now asks first.",
      "Setup asks before setting an anchor dose sooner after your last dose than your days between doses, and no longer ignores a half-typed anchor date.",
      "Plans from before 5.608 with more than 7 days between doses no longer come out 0.001 mg off per dose."
    ] },
    { version: "5.608", date: "2026-09-26", changes: [
      "Setup now takes your weekly dose and works out each dose from it and the days between doses, so different dosing schedules compare like for like."
    ] },
    { version: "5.508", date: "2026-09-26", changes: [
      "Doses are now only logged by confirming them, so Add Entry is just for weigh-ins.",
      "Setup can set an anchor dose to start or restart your schedule from, for when there's no recent dose to count from."
    ] },
    { version: "5.408", date: "2026-09-26", changes: [
      "Fixed the dosing fields not lining up on phones: they now sit two per row there, and date and time boxes use the same font and height as the rest."
    ] },
    { version: "5.407", date: "2026-09-26", changes: [
      "The dose pop-up is now a simple confirmation with nothing to edit: it logs the scheduled day and your typical dose from setup, which scheduling now needs."
    ] },
    { version: "5.397", date: "2026-09-26", changes: [
      "The dose pop-up's Skip is now Postpone to tomorrow, which moves that dose to tomorrow and the doses after it along with it."
    ] },
    { version: "5.387", date: "2026-09-26", changes: [
      "Your next three doses are now scheduled automatically, counting from your last dose, and update whenever your dosing plan changes.",
      "Scheduled doses are only logged once confirmed: a pop-up asks after your usual dose time (new in setup), or log the dose yourself in Add Entry.",
      "Doses can't be added for future dates anymore; ones added that way before are cleared in favor of the schedule.",
      "Syringe units are rounded to the nearest half unit, with the exact amount in parentheses when it differs."
    ] },
    { version: "4.387", date: "2026-09-26", changes: [
      "A vial's known concentration can now be entered with up to three decimal places (e.g. 16.667 mg/mL), and concentrations show to that precision."
    ] },
    { version: "4.377", date: "2026-09-26", changes: [
      "Setup now asks for your days between doses and typical dose, and shows the weekly equivalent.",
      "Setup can hold one active vial (its mg/mL, or its mg and the BAC water it was mixed with), and upcoming doses show the units to draw on a U-100 syringe."
    ] },
    { version: "4.277", date: "2026-09-26", changes: [
      "On phones the Add Entry date shows its full year (the fields sit two per row there), and its calendar icon is now visible in dark mode."
    ] },
    { version: "4.276", date: "2026-09-26", changes: [
      "Added a bear-face tab icon (from Lucide) so Bosco is easy to spot among browser tabs."
    ] },
    { version: "4.266", date: "2026-09-26", changes: [
      "Upcoming doses now lead with the day of the week, with the date and amount below (the year only shows when it isn't this year)."
    ] },
    { version: "4.256", date: "2026-09-26", changes: [
      "The start-up medication question no longer spills out of its box: its choices get a line of their own, two per row on phones."
    ] },
    { version: "4.255", date: "2026-09-26", changes: [
      "Dose tracking now supports Semaglutide and Retatrutide as well as Tirzepatide: the start-up question asks which one you take, each dose remembers its medication (so switching keeps your history accurate), and older backups and settings carry over as Tirzepatide."
    ] },
    { version: "4.155", date: "2026-09-26", changes: [
      "Goal Weights project your weight at the start of each of the next three seasons (from the real equinoxes and solstices) instead of 3, 6 and 12 months out; a season drops off once it starts."
    ] },
    { version: "4.055", date: "2026-09-26", changes: [
      "A DEV button in the bottom-right corner, beside the version number, turns developer mode on and off without a keyboard (for phones)."
    ] },
    { version: "4.045", date: "2026-09-26", changes: [
      "The app is now called Bosco."
    ] },
    { version: "4.035", date: "2026-09-25", changes: [
      "Added autosave & sync to a folder you choose (e.g. a Syncthing folder): changes save there automatically, the newest save loads on start, and other devices' changes load in while the app is open.",
      "Changes made on two devices while out of sync are combined instead of one overwriting the other."
    ] },
    { version: "3.035", date: "2026-09-25", changes: [
      "The entry date now rolls over when the app is left open past midnight, and replacing a weigh-in or importing over existing data asks first, so nothing is overwritten silently.",
      "History hides dose-only days while Tirzepatide tracking is off, and a kg backup imported before choosing units stays in kg.",
      "Chart and exported image: goals show their exact value (e.g. 75.5), goal tags are no longer hidden by the weight line, and very little data no longer gives a made-up date, repeated axis labels, or an exaggerated slope.",
      "Bug reports no longer say they were copied when copying failed, and Reached badges are readable in dark mode."
    ] },
    { version: "3.034", date: "2026-09-24", changes: [
      "Renamed the app file to index.html so it opens at a clean link when hosted on GitHub Pages."
    ] },
    { version: "3.024", date: "2026-09-24", changes: [
      "The rolling weight average gained 30d, 60d, 90d, and All windows (still starting on 7d each load), and each Current Trend stat now has its own window pills."
    ] },
    { version: "2.924", date: "2026-09-24", changes: [
      "Removed calorie tracking and slimmed down the code, fixing dates shifting a day in some timezones, goals marked Reached too early, and flat weigh-ins or damaged data breaking the app."
    ] },
    { version: "1.924", date: "2026-09-14", changes: [
      "Fixed bug reports not actually being submitted: the 'Report a bug' form now saves each report locally (until exported or cleared) instead of only copying it once and forgetting it, and Developer Mode's export now works on that whole saved log — copy all, download as one .md file, or clear it — instead of just re-generating whatever was currently typed."
    ] },
    { version: "1.824", date: "2026-09-14", changes: [
      "Added bug reporting: a small 'Report a bug' link in the footer opens a form to describe what happened, then copies a Claude-ready Markdown report (environment, app state, recent console activity — no personal data) to the clipboard; Developer Mode adds a matching .md file export."
    ] },
    { version: "1.724", date: "2026-09-10", changes: [
      "Fixed the custom weekly % slider: it now reliably resets to 0 on load, shows tick marks at every 0.25% step, and displays its current value in a high-contrast badge instead of blending into the label text."
    ] },
    { version: "1.714", date: "2026-09-10", changes: [
      "Custom weekly % is now a single slider from -2% to +1% in 0.25% steps (0 = no change, negative = lose, positive = gain), replacing the rate input box, presets, and the separate Lose/Gain toggle."
    ] },
    { version: "1.614", date: "2026-09-09", changes: [
      "The Lose/Gain weight toggle is now a small inline -/+ control next to the custom rate presets, shown only when Custom weekly % is selected, instead of a full-width button pair always on screen."
    ] },
    { version: "1.613", date: "2026-09-09", changes: [
      "Projection settings gained a Lose weight / Gain weight toggle, defaulting to whichever direction your last 90 days of weigh-ins actually show. It flips the sign of the custom weekly rate, the direction goals are sorted in, and which way stat/history coloring reads as good vs. bad."
    ] },
    { version: "1.513", date: "2026-09-09", changes: [
      "Fixed the dev console changelog showing oldest entries first — it now lists newest at the top."
    ] },
    { version: "1.512", date: "2026-09-09", changes: [
      "The exported progress image's title is now 'Weight report', and its chart and goal table now share one centered, light-grey, white-bordered card instead of floating directly on the page."
    ] },
    { version: "1.502", date: "2026-09-09", changes: [
      "Importing a backup that contains Tirzepatide dose entries now skips the start-up 'Do you take Tirzepatide?' question and turns the dose UI on automatically."
    ] },
    { version: "1.501", date: "2026-09-09", changes: [
      "Added a 7d option to the Current Trend window slicer, alongside All/30d/60d/90d."
    ] },
    { version: "1.500", date: "2026-09-09", changes: [
      "kg support is back: a new start-up 'Units' question (lb or kg) picks the unit for the whole app — nothing is ever mixed. Changing it later means re-answering start-up info from Developer Mode, which converts every existing weight, goal, and imported backup into the new unit; the Est. TDEE calorie math now scales correctly for kg too."
    ] },
    { version: "1.410", date: "2026-09-09", changes: [
      "The start-up Tirzepatide question now actually hides all dose UI (Add Entry field, History column, Upcoming Doses) when answered 'No', the exported image's cumulative dosage line was fixed to actually appear, and its title is now centered."
    ] },
    { version: "1.400", date: "2026-09-09", changes: [
      "Upcoming Doses now falls back to your last dose taken when none shows up in the last 7 history entries, JSON exports gained a separate cumulative-dose total, the exported image dropped its redundant 'Generated' date, the start-up Tirzepatide question is now optional and re-openable from Developer Mode (replacing the removed header pencil icon), number-input spinner arrows are gone, the changelog is now one line per version, and a curve-smoothing bug that pinched the exported chart on small datasets is fixed."
    ] },
    { version: "1.300", date: "2026-09-09", changes: [
      "Added a one-time 'Get Started' name prompt, included the name in JSON backups and the exported progress image, and added a subtle version tag in the corner."
    ] },
    { version: "1.200", date: "2026-09-08", changes: [
      "Merged projection controls into Goal Weights with a 1/3/6/12-month preview row, scoped Avg Intake/TDEE to the Current Trend window, and simplified the chart to actual weigh-ins plus active goal lines only."
    ] },
    { version: "1.100", date: "2026-09-08", changes: [
      "Added optional Tirzepatide dose tracking with an Upcoming Doses panel and History column, and dropped kg support in favor of lb-only."
    ] },
    { version: "1.030", date: "2026-09-08", changes: [
      "Added versioned, validated JSON backups — malformed rows are dropped on import instead of crashing, and newer-version backups show a warning."
    ] },
    { version: "1.010", date: "2026-09-08", changes: [
      "Weight and calories can now be logged independently of each other, with trend/stats/goals/chart calculations using only days with a recorded weight."
    ] },
    { version: "1.000", date: "2026-09-08", changes: ["Initial versioned release."] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.bosco);
