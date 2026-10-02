/* Kyoshi · tests/sim/notes.js — the report's words (report.js puts the numbers around them): for each finding, by its key, what
 * happened in plain words, what the person saw and needed, where in the code, the options with a recommendation and the question
 * for the owner, and which discussion theme it belongs to; then the suspects' list, what was fixed during the run, what's out of
 * scope, and the agenda. Written for the owner, a layman: the apps and screens by name, no jargon. */
"use strict";

const T = { STAND: "1. Where I stand", TRUTH: "2. Momo as the source of truth", CLOSE: "3. The close-out", PHONE: "4. The phone", FIX: "5. The obvious-fix list" };

const F = {
  "done-no-card": {
    theme: T.TRUTH, kind: "flow", sev: "daily rub", weight: 8,
    title: "Something done on a day with no card for it never shows in Momo",
    what: "You tick an errand in Hawky, a call in Pabu, or log a workout on a rest day, and that day has no Errands, Keep in touch or Workout card. Momo drops a done thing that has no card to sit on: it isn't on the board, in Tasks or on Today.",
    saw: "Nothing at all in Momo about it, so the week looks emptier than it was.",
    needed: "Momo as the record of the week: everything done shows somewhere, with its ✓.",
    where: "`apps/momo/inbox.js:66-71` (a done need with no card is dropped; only open ones go to Tasks).",
    options: ["Leave it: Momo only shows what fills your cards.", "Under each day (on the board and on Today), a small “Also done” line: the day's done things that had no card, with their apps' icons.", "Make a card for it automatically (no: it would change your plan behind your back)."],
    recommend: "Option 2. It keeps the plan as you made it and still shows the work.",
    question: "Should things you did with no card for them show as a small “Also done” line on their day?"
  },
  "yesterday-tick": {
    theme: T.TRUTH, kind: "flow", sev: "daily rub", weight: 9,
    title: "Yesterday's ✓ is gone: past days show nothing done",
    what: "Momo asks the apps only from today on, and only cards from today on are filled. So the morning after, yesterday's Errands or Keep in touch card shows just its title: no names, no ✓, whether you did them or not.",
    saw: "This week's past days look as if nothing happened.",
    needed: "The week as a record: what got done on each day (✓), and what didn't.",
    where: "`apps/momo/inbox.js:18` (asks from today) and `inbox.js:28-41` (no cards before today are filled).",
    options: ["Leave it: the past is for the close-out.", "Fill this week's past days with what was done on them (✓ only); what wasn't done stays where it is now (overdue, from today on).", "Show past days greyed with a count “3 of 4 done”."],
    recommend: "Option 2: Momo asks the apps from this Monday; done things fill their day's cards; open ones still start today.",
    question: "Should this week's past days show what you did on them, with ✓?"
  },
  "appa-no-done": {
    theme: T.FIX, kind: "bug", sev: "daily rub", weight: 7,
    title: "A job recorded in Appa vanishes from Momo instead of showing ✓",
    what: "Hawky, Pabu and Badgermole send a done thing back to Momo with its day, so its card shows ✓. Appa doesn't: once a job is recorded its next due date is months away, so it simply drops out of Momo. The roadmap's table says Appa's ✓ shows “when recorded”.",
    saw: "The House maintenance card loses the job, as if it had never been planned.",
    needed: "✓ on that day's card, like an errand.",
    where: "`apps/appa/share.js:12-22` (no done needs).",
    options: ["Appa sends each job recorded this week and next as done, on its record's day (as Hawky does).", "Leave it."],
    recommend: "Option 1: small, in Appa's share.js, and what the roadmap already says."
  },
  "overdue-hidden": {
    theme: T.STAND, kind: "signal", sev: "daily rub", weight: 8,
    title: "Overdue is invisible once a thing is on a card",
    what: "In Tasks, an overdue thing has a red edge. Once it's on a card (the next Errands or Keep in touch card), nothing says it's late: the card looks like any other.",
    saw: "“Errands · Pay the parking ticket”: no sign it was due three days ago.",
    needed: "To see at a glance what's late, wherever it sits.",
    where: "`apps/momo/render.js:79` cardHTML and `today.js:64` (no late mark); only `tasks.js:21` draws the red edge.",
    options: ["A red edge (as in Tasks) on a card holding something late, and “late” in its pop-up and on Today's row.", "A small count on the card (“2 late”).", "Leave it."],
    recommend: "Option 1: the same red edge everywhere means one thing to learn."
  },
  "done-holds-room": {
    theme: T.TRUTH, kind: "design question", sev: "occasional", weight: 3,
    title: "Done things keep using a card's room, so an open one can be pushed to Tasks",
    what: "A done errand still takes its minutes on its card (the time was spent). On a busy day that can push the next open errand out of the card and into Tasks, though the card's time may still be ahead.",
    saw: "An errand in Tasks next to an Errands card that's mostly ticked off.",
    needed: "To know why it's there, or for the card to take it.",
    where: "`apps/momo/inbox.js:66-74` (done needs use room like open ones).",
    options: ["Leave it: honest (the time was used), and rare.", "Done things stop taking room on cards still to come today, so an open one can take its place."],
    recommend: "Option 1, unless it bothers you in real use.",
    question: "Has a done errand ever pushed another into Tasks for you? If not, leave it."
  },
  "hours-short-vanish": {
    theme: T.TRUTH, kind: "design question", sev: "occasional", weight: 4,
    title: "Last week's unplaced goal hours vanish on Monday, without a trace",
    what: "Goal hours that found no card are one task, on their own week only. At the week change that task just disappears. Time can't be saved (by design), but nothing says the hours were missed.",
    saw: "Monday's Tasks no longer mention last week's 3 hours of “Read 6 books”.",
    needed: "To see what didn't happen, as the plan's “What didn't happen is visible” says.",
    where: "`apps/momo/tasks.js:34-36` (an hours task is shown only on its week's board).",
    options: ["Leave it: the close-out already asks about each goal's week (but only its planned hours, so hours never planned show as 0 with no remark).", "The close-out row says “3h had no card this week” under the goal.", "Iroh's progress line says “3 h short last week”."],
    recommend: "Option 2: the close-out is where a week is looked back on.",
    question: "When goal hours found no card in a week, should the close-out say so?"
  },
  "task-wrong-week": {
    theme: T.TRUTH, kind: "flow", sev: "daily rub", weight: 6,
    title: "Tasks lists things on a week they can't go on",
    what: "Errands, people, workouts and meals that fit no card show in Tasks on both This week and Next week, whatever their days. Next Monday's dinner shows in this week's Tasks; a call that can't be before Saturday week shows in this week's. A card drawn from it on the wrong week doesn't take it, and the task stays.",
    saw: "This week's Tasks crowded with next week's meals; a drag that seems to do nothing.",
    needed: "Each week's Tasks to hold only what can go on that week.",
    where: "`apps/momo/tasks.js:28-45` (time and one-per-card shortfalls show on both boards; only goal hours are per week).",
    options: ["Each task on the board of the week its things can go on (a thing that could go on either: both).", "Keep both, but grey out the ones that can't go on the week on screen.", "Leave it."],
    recommend: "Option 1. It also makes “all assigned ✓” honest (F: all assigned).",
    question: null
  },
  "far-due": {
    theme: T.TRUTH, kind: "flow", sev: "occasional", weight: 3,
    title: "Something due weeks from now takes this week's room",
    what: "Hawky sends every open errand, however far off its day, and Appa sends every job due in the next 14 days, which can be past next Sunday. They fill this week's Errands or maintenance cards before what's due sooner arrives.",
    saw: "This Saturday's Errands card holding an errand due in a month.",
    needed: "Momo is strictly this week and next (the roadmap's decision).",
    where: "`apps/hawky/share.js:22` (every open errand) and `apps/appa/share.js:12-22` (LEAD_DAYS, whatever Momo asks for).",
    options: ["Each app sends only what's due by the end of the window Momo asks for (undated errands still go: they have no day).", "Leave it: early is fine when there's room."],
    recommend: "Option 1: it's what the roadmap decided, and it keeps room for what's near."
  },
  "open-in-loses-edit": {
    theme: T.FIX, kind: "bug", sev: "occasional", weight: 5,
    title: "“Open in <App>” from the card editor throws away an unsaved change without asking",
    what: "In a card's editor, change its hours (or anything), then tap “Open in Hawky”: the editor closes and the change is gone. The × and Esc ask “Discard your changes?”; this link doesn't.",
    saw: "The card back at its old hours, with no warning.",
    needed: "The same question as × and Esc.",
    where: "`apps/momo/card-editor.js:27` (`K.modal.dismiss` where the others use `requestDismiss`).",
    options: ["Ask first, as × and Esc do (one word changes).", "Save the change, then open the app."],
    recommend: "Option 1."
  },
  "today-24h": {
    theme: T.PHONE, kind: "design question", sev: "occasional", weight: 2,
    title: "Late in the day, To Be Budgeted still counts all of today",
    what: "This week's bank counts today as a whole 24 hours however late it is, so at 8 pm hours already gone count as free.",
    saw: "“14h left this week” in the evening, some of it this morning's.",
    needed: "Hours left that you can still use.",
    where: "`apps/momo/model.js:52-66` budgetOf (today counts whole).",
    options: ["Leave it: a plan is about the whole day; the bank is for planning, not the clock.", "Count today from now on."],
    recommend: "Option 1: the bank balances days of 24 hours; counting from now would turn every day red by evening.",
    question: null
  },
  "anytime-event-hours": {
    theme: T.FIX, kind: "design question", sev: "cosmetic", weight: 1,
    title: "An event at any time that day (a birthday, a dose with no time) adds its 15 minutes to the day's total",
    what: "A birthday or a dose with no set time sits in the day's heading, not at a time, but its 15 minutes still count in the day's total: a day can read 24.25 hours.",
    saw: "A day over 24 by a quarter hour with nothing to move.",
    needed: "An any-time event not to count against a day's hours (it takes none of its own).",
    where: "`apps/momo/agenda.js:53` weekAgenda (extra is its length whatever its time).",
    options: ["Any-time events count 0 hours.", "Leave it."],
    recommend: "Option 1."
  },
  "week-never-stored": {
    theme: T.CLOSE, kind: "design question", sev: "occasional", weight: 3,
    title: "A week Momo never wrote to is never closed out, and Iroh never hears of it",
    what: "A week with nothing planned in Momo (on holiday, or a gap) isn't kept, so it has no close-out and isn't in the hours Iroh reads. Iroh's goals then neither count it nor show it as missed.",
    saw: "No close-out for the week away; Iroh's progress silent about it.",
    needed: "A clear choice: an empty week counts as a week of zero hours, or as a week off.",
    where: "`apps/momo/closeout.js:26` pendingCloseOuts (only weeks kept) and `hoursSpent` (`closeout.js:208`).",
    options: ["An empty week is closed quietly as zero hours (goals fall behind, honestly).", "An empty week is skipped on purpose and Iroh shows it as “a week off”.", "Leave it."],
    recommend: "Option 2: a holiday shouldn't count against goals, but it should say so.",
    question: "When you don't plan a week at all (a holiday), should your goals count it as a week off, or as zero hours?"
  },
  "silent-behind": {
    theme: T.STAND, kind: "signal", sev: "daily rub", weight: 9,
    title: "Falling behind with nothing outside the app saying so",
    what: "Several apps never put a dot on their icon (Badgermole, Turtleduck, Pabu by its own switch) and Iroh dots only for an overdue meeting. Behind in workouts, dinners unplanned, people overdue, a goal more than a week behind: none of it shows on the switcher, and Momo shows the items without saying they're late.",
    saw: "No dot anywhere while two workouts are left with one day to go, or the week's dinners aren't planned.",
    needed: "Where I stand, per app, at a glance (the first thing this test was for).",
    where: "Each app's `attention()` in its events.js (Badgermole and Turtleduck have none; Pabu's `DOT_WHEN_OVERDUE = false` in app.js; Iroh's is core's meeting check).",
    options: ["Turn the dots on: Pabu (one switch), Badgermole when the week's target can't be met any more, Turtleduck when a day this week has no dinner planned, Iroh when a goal is a week behind.", "A one-line standing per app in the switcher's list (“Hawky: 2 overdue · Badgermole: 1 of 3 · Pabu: 1 due”), no dots added.", "Both: dots for what's late, the line for where each stands."],
    recommend: "Option 3, the line first: it answers “where do I stand” without adding noise.",
    question: "Which apps should dot when you're behind, and would a one-line standing per app in the switcher help?"
  },
  "silent-behind:checkup": {
    theme: T.STAND, kind: "signal", sev: "occasional", weight: 4,
    title: "A checkup gets months old with nothing saying so",
    what: "A checkup (every app but Iroh has one) is never due by design: its line just says “Last checkup: 90 days ago”, inside the app.",
    saw: "Nothing, unless you open the app and read its header.",
    needed: "A nudge after a while, if checkups matter.",
    where: "`core/meetings.js:9-11` (a checkup is never due).",
    options: ["Leave it (a checkup is optional by design).", "After N days (60?), the checkup line turns amber and the app's switcher line says “checkup due”, without a dot.", "Make it a meeting (every month) in its settings: already possible."],
    recommend: "Option 2, if you want checkups to happen; else option 1.",
    question: "Do you want checkups to nag after a while? After how many days?"
  },
  "closeout-goals-now": {
    theme: T.CLOSE, kind: "design question", sev: "occasional", weight: 3,
    title: "The close-out lists the goals as they are now, not as they were that week",
    what: "A goal renamed, dropped or added since the week ended changes that week's close-out rows: a renamed goal shows under its new name with no hours planned (its cards have the old title).",
    saw: "A close-out row “Piano lessons: nothing planned this week” for a week that had Piano cards.",
    needed: "That week's goals, with that week's cards.",
    where: "`apps/momo/closeout.js:46` trackedTitles (asks Iroh now).",
    options: ["Leave it (close out promptly and it rarely matters).", "Iroh keeps a goal's old titles, and Momo matches cards by any of them."],
    recommend: "Option 1 for now; option 2 if renames turn out common.",
    question: null
  },
  "all-assigned-with-tasks": {
    theme: T.TRUTH, kind: "signal", sev: "daily rub", weight: 7,
    title: "“All assigned ✓” while Tasks still has work for the week",
    what: "Fill gaps with Free time makes every hour have a job, so the tab says “all assigned ✓” and the bank “Every hour has a job ✓”, even with errands, workouts or goal hours still waiting in Tasks (some of them next week's, see the Tasks finding).",
    saw: "Two green ✓ above a row of unplaced tasks.",
    needed: "✓ only when nothing for that week is left unplaced.",
    where: "`apps/momo/render.js:28-33` renderTabs and `render.js:56-61` (the status counts hours, not Tasks).",
    options: ["The ✓ waits until that week's Tasks are empty (“all assigned, 2 tasks left”).", "Leave it: Free time is a choice."],
    recommend: "Option 1, once Tasks holds only the week's own things."
  },
  "colors-churn": {
    theme: T.FIX, kind: "bug", sev: "cosmetic", weight: 2,
    title: "Momo saves itself again every time it starts",
    what: "When Momo starts, other apps haven't yet, so it drops the colour it gave their events (Bosco's dose, a birthday), then gives it back a moment later and saves. Every start counts as a change: with folder sync on, each device writes a new save every time it's opened, and Export JSON lights up with nothing changed.",
    saw: "Nothing on screen (the colour comes back the same).",
    needed: "No save without a change.",
    where: "`apps/momo/data.js` load → `colors.js:71` colorKeys (K.agenda leaves out apps not started yet).",
    options: ["Keep event titles' colours while their apps start (don't drop colours in load).", "Leave it."],
    recommend: "Option 1."
  },
  "closeout-first-thing": {
    theme: T.CLOSE, kind: "flow", sev: "occasional", weight: 4,
    title: "The close-out pops up first thing on the phone",
    what: "For anyone who doesn't close out on Sunday evening, Monday morning's phone opens on the close-out, on top of Today, before the day can be seen.",
    saw: "A review of last week's goals when they wanted today's plan.",
    needed: "Today first; the review when there's time.",
    where: "`apps/momo/events.js:132` onShow → `closeout.js` checkCloseOuts.",
    options: ["On a phone, don't pop up: show the banner (“Last week is ready to close out”) and let it be tapped.", "Pop up on the computer only.", "Leave it."],
    recommend: "Option 1.",
    question: "On the phone, should the close-out wait in its banner instead of popping up?"
  },
  "later-forgotten": {
    theme: T.CLOSE, kind: "flow", sev: "daily rub", weight: 5,
    title: "“Later” on the close-out only lasts until Momo is opened again",
    what: "Later is kept in memory: the next time Momo is opened (every morning on a phone), the close-out pops up again.",
    saw: "The same close-out every morning after saying Later.",
    needed: "Later to mean later: say, until the next day, or the evening.",
    where: "`apps/momo/closeout.js:159` (S.closeOutLater, not kept).",
    options: ["Keep Later on this device until tomorrow (or until the next planning day).", "Keep it until next week, as the code's comment says.", "Leave it."],
    recommend: "Option 1."
  },
  "closeout-old": {
    theme: T.CLOSE, kind: "flow", sev: "occasional", weight: 3,
    title: "The close-out asks about weeks more than a month old",
    what: "After a gap, the backlog comes oldest first, one pop-up per week, about weeks long gone.",
    saw: "Week after week of “Close out Jan 18 – 24” on return.",
    needed: "A quick way through: honest numbers are long forgotten.",
    where: "`apps/momo/closeout.js:61` reviewWeeks.",
    options: ["Weeks older than a month close quietly as planned (a note in the banner says so).", "A “Close all as planned” button when several are waiting.", "Leave it."],
    recommend: "Option 2.",
    question: "When several weeks wait, would “close all as planned” help?"
  },
  "same-shortfall": {
    theme: T.TRUTH, kind: "feature gap", sev: "daily rub", weight: 5,
    title: "The same block is short week after week, and nothing points it out",
    what: "When the baseline has no room for something every week (a goal with no card, a workout too many, Iroh's meetings with no Meeting card), the same task is in Tasks every week, to be dragged again.",
    saw: "“Read 6 books 2.75h” to drag every Sunday.",
    needed: "Momo to notice: “Read 6 books has needed a card 3 weeks running: add it to the baseline?”",
    where: "`apps/momo/tasks.js` (no memory of past weeks).",
    options: ["A hint on the task after 3 weeks, with “Add to baseline” (it opens the baseline's New card with the title and hours).", "A weekly “true cost” line per app (its average ask against the baseline's room).", "Leave it."],
    recommend: "Option 1, simplest; option 2 is the YNAB “true expenses” idea.",
    question: "Would a nudge to add a block to the baseline after three weeks help?"
  },
  "task-unused-app": {
    theme: T.TRUTH, kind: "flow", sev: "occasional", weight: 4,
    title: "An app you've never opened asks for time in Tasks",
    what: "Iroh's three meetings are due the day Kyoshi is first opened, so a new user who never touches Iroh sees 3.5 hours of “Meeting” in Tasks every week, and Iroh's dot from the second day on.",
    saw: "Meetings about goals they don't have, and a red dot on Iroh.",
    needed: "Nothing from Iroh until it's used.",
    where: "`core/meetings.js:62-66` (a meeting never had is due the day it's first seen).",
    options: ["A meeting starts counting only once its app has data (Iroh: a goal or an area).", "Leave it."],
    recommend: "Option 1."
  },
  "old-import-replaces": {
    theme: T.CLOSE, kind: "design question", sev: "occasional", weight: 2,
    title: "Importing an old backup replaces everything since, after one question",
    what: "Import all (and each app's Import JSON) replaces that app's data with the backup's, after one confirm (“This can't be undone”). An old backup brought in by mistake takes everything since with it. Folder sync's combining keeps both sides; import doesn't.",
    saw: "One question, then a year of weeks, errands and records gone.",
    needed: "Either a clear warning naming what will be lost, or a way to merge.",
    where: "`core/backup.js:72` importAllText; each app's `importBackup`.",
    options: ["Leave it (it says it can't be undone).", "The question names the backup's date and how much newer your data is (“This backup is from Sep 2027; your data has 2 years more”).", "A choice: Replace or Merge (merge as folder sync does)."],
    recommend: "Option 2 now; option 3 if you ever need to merge two copies.",
    question: null
  },
  "late-only-in-tasks": {
    theme: T.PHONE, kind: "flow", sev: "daily rub", weight: 6,
    title: "Late things show only in Tasks, and Today never shows Tasks",
    what: "When an overdue errand, call or job fits no card, Momo shows it as a task with a red edge. Tasks is on the board only: Today, the phone's view, lists today's and tomorrow's cards, never Tasks. On the phone, unless you tap Week, it's as if they weren't there.",
    saw: "A calm Today while three things were overdue.",
    needed: "Today to say what's late and waiting: “3 late, not on a card” with a tap to place them.",
    where: "`apps/momo/today.js:104-132` renderToday (no Tasks); `tasks.js` draws Tasks on the board only.",
    options: ["A short “Waiting” section on Today: what's late or due today with no card, each with a tap to put it on today (a new card, as tapping a task does on the board).", "Only a count on Today's header (“3 waiting”) that opens the board.", "Leave it."],
    recommend: "Option 1: the phone is where the day is run.",
    question: "Should Today show what's late or due today that has no card yet, with a tap to place it?"
  },
  "noisy-dot": {
    theme: T.STAND, kind: "signal", sev: "occasional", weight: 3,
    title: "A dot that's up most of the month stops meaning anything",
    what: "Some dots stay up for weeks: Hawky's while any errand is overdue (a busy life always has one), and Iroh's for meetings an unused Iroh never stops asking for.",
    saw: "A red dot every day, so the one that matters doesn't stand out.",
    needed: "Dots that mean “act now”, and that clear when acted on.",
    where: "Hawky: `apps/hawky/events.js` attention (any overdue errand); Iroh: core's overdue meeting (`core/meetings.js:120`).",
    options: ["Hawky dots only for errands overdue more than a day or two, or for 3 or more.", "Iroh's meetings start only once Iroh is used (see the unused-app finding).", "Leave them."],
    recommend: "Both 1 and 2.",
    question: "Hawky's dot is up most days for a busy person: should it wait until an errand is a few days late, or several are?"
  },
  "stale-board": { theme: T.FIX, kind: "signal", sev: "occasional", title: "Momo's board lagged what the apps asked" },
  "stale-dot": { theme: T.FIX, kind: "signal", sev: "occasional", title: "A dot on the switcher lagged its app" }
};

const DEFAULT = { theme: T.FIX };
const finding = key => F[key] || F[key.replace(/:[^:]+$/, "")] || DEFAULT;

// The suspects (testplan.md, "Already suspected from reading the code"), each with the findings that bear on it.
const SUSPECTS = [
  { n: 1, keys: ["yesterday-tick"], text: "A need done yesterday never shows ✓ in Momo (the window starts today); only today's ✓ is ever visible." },
  { n: 2, keys: ["appa-no-done"], text: "Appa sends no done, so a recorded job disappears instead of showing ✓." },
  { n: 3, keys: ["overdue-hidden"], text: "Overdue is invisible once a need is on a card; only Tasks shows it." },
  { n: 4, keys: ["done-holds-room"], text: "Done needs keep using a block's room, so a done errand can push the next one to Tasks." },
  { n: 5, keys: ["hours-short-vanish"], text: "An hours shortfall for last week vanishes at the week change with no trace." },
  { n: 6, keys: ["task-wrong-week"], text: "Time and block shortfalls show on both weeks' Tasks whatever their days; a card drawn on the wrong week leaves the task standing." },
  { n: 7, keys: ["far-due"], text: "Hawky sends every open errand whatever `to`, so an errand due weeks out can fill this week's block (Appa's 14 days can pass the window too)." },
  { n: 8, keys: ["open-in-loses-edit"], text: "“Open in <App>” from the card editor drops unsaved edits without asking." },
  { n: 9, keys: ["today-24h", "anytime-event-hours"], text: "Today counts as a full 24h in To Be Budgeted however late it is; an event with no time adds its full length to the day." },
  { n: 10, keys: ["week-never-stored"], text: "A past week Momo never wrote to is never closed out and is absent from hoursSpent.", note: rs => { const n = rs.reduce((a, r) => a + (r.counters.weeksNeverStored || 0), 0); return n ? `${n} such weeks across the lives; Iroh's “expected” counts only closed weeks, so they count neither for nor against a goal.` : ""; } },
  { n: 11, keys: ["silent-behind"], text: "Three feeders never dot and checkups never nag: being behind in Badgermole, Turtleduck, Pabu, or a months-old checkup, is visible only inside the app." },
  { n: 12, keys: ["closeout-goals-now"], text: "The close-out's rows are the goals as they are now, not as they were that week." },
  { n: 13, keys: [], text: "Block title limits disagree: core cuts a block's title at 60 characters, Momo's card titles at 40.", verdict: () => "Refuted (harmless)", note: () => "The numbers do disagree (`core/inbox.js:40` cuts at 60, `apps/momo/app.js` MAX_TITLE is 40), but Momo cuts a need's block title to its own 40 characters before matching it to a card and before drawing one from a task (`apps/momo/inbox.js:21` and `tasks.js:32`, both through cleanText), so a block title of 41–60 characters still fills its cards. No app sends one today anyway (Appa caps a thing's name at 28, so “<thing> maintenance” fits; Iroh's goal titles are ≤ 40). Worth one line in core/inbox.js's header saying Momo matches on the first 40." },
  { n: 14, keys: [], text: "K.inbox and K.agenda are called several times per Momo redraw; hoursSpent sums every closed week per call.", verdict: rs => (rs.some(r => r.timings.length) ? "Measured" : "Not measured"), note: rs => { const t = rs.flatMap(r => r.timings).filter(x => x.inbox !== undefined).sort((a, b) => (b.weeks || 0) - (a.weeks || 0))[0]; return t ? `At ${t.weeks} weeks kept: K.inbox ${Math.round(t.inbox * 10) / 10} ms, hoursSpent for 5 goals ${Math.round(t.hoursSpent * 10) / 10} ms, a board redraw ${Math.round(t.render * 10) / 10} ms, a reload ${t.reload} ms (see the robustness table).` : ""; } }
];

const INTRO = `Six made-up people lived with Kyoshi for a year or more, the real page driven day by day through time (tests/sim/: Playwright taps through every app on a “screens” week, the apps' own functions otherwise; Momo always through its screens). Every step checked Momo against what each app asks of it, and recorded where each person stood in every app against what the switcher, the app's header line and Momo showed. Everything here is made up: names from a list, numbers invented.

The two things this was for, in your words: **where I stand, per app, at a glance**, and **Momo as the source of truth** for this week and next.`;

const ROBUST = "The long haul (life 6) ran ten years in America/Chicago time, stepping each Monday morning and Sunday evening; lives 4 and 5 were measured at each year's end. “Same answers after”: Export all, a fresh browser profile, Import all, then Momo's needs and every goal's hours compared with before.";

const RANKING = "Ranked by how much each gets in the way (blocks the flow · daily rub · occasional · cosmetic), then by how many lives hit it. Each has its evidence: the life, its seed, the date and the step, so `node tests/sim/run.js <life> --weeks N` replays it.";

const FIXED = "Nothing qualified: no crash, no console error and no data loss came up in any life (each reload compared every app's data before and after; Export all → fresh profile → Import all gave the same answers). The simulator's own mistakes found on the way were the simulator's (an id made twice by its seeded random numbers, a form clicked in an app off screen) and were fixed in tests/sim/. One small save-on-every-start in Momo (F: Momo saves itself again) loses nothing and waits for the discussion.";

const SCOPE = "- **The sync folder:** the browser's folder access can't run headless; a month on two tabs (life 4) and folder sync's combining (an old copy merged into current data, life 4) stood in.\n- **Photos and PDFs** (Appa's proof, reports) beyond a few: not exercised.\n- **Visual design**, colours and layout, beyond what blocks a tap.\n- **Bosco's weights and trends, Wan Shi Tong's backlog:** only their part in the flow (the dose as an event, what's in progress as an ongoing task).\n- **Moving another app's event in Momo** (a dose to another time): not exercised.";

const BUNDLES = "Each life's Export all at the end of each of its years (made-up data; over 2 MB left out, so the long haul's later years aren't here). To try one: open Kyoshi in a browser profile that is **not** connected to your real sync folder (a new Chrome profile, or a guest window), Developer Mode (Ctrl+9 or the DEV badge) → Import all, and pick the file. Its dates are the life's own (2027 to 2036), so “today” in it is your real today: Momo shows whatever weeks fall around it, and the close-out asks about every week it ended with open.";

function AGENDA(list) {
  const themes = [T.STAND, T.TRUTH, T.CLOSE, T.PHONE, T.FIX];
  const id = g => `F-${String(list.indexOf(g) + 1).padStart(2, "0")}`;
  return "Open with the summary and the five findings that matter most (the first five above), then one theme at a time, at most five questions a batch, waiting for the answers before the next. Decisions go into roadmap.md as Phase 8 (“Flow fixes”) before anything is built.\n\n" +
    themes.map(t => {
      const items = list.filter(g => finding(g.key).theme === t);
      const qs = items.map(g => finding(g.key).question).filter(Boolean);
      return `**${t}.** ${items.length ? items.map(g => `${id(g)} ${finding(g.key).title || g.title}`).join(" · ") : "Nothing found."}${qs.length ? `\n${qs.slice(0, 5).map(q => `- ${q}`).join("\n")}` : ""}`;
    }).join("\n\n");
}

module.exports = { finding, SUSPECTS, INTRO, ROBUST, RANKING, FIXED, SCOPE, BUNDLES, AGENDA, T };
