/* Hawky · app.js — registers Hawky with Kyoshi, plus its constants (limits, the Done fold's page, the locks), state
 * (A.S) and small helpers: text and minutes, days in words, how long something has waited, the errands' groups and
 * which errand is where. Loads first of the app's files: the others destructure what's here at the top, and call
 * functions from each other as A.name(). File map and data model: apps/hawky/CLAUDE.md. */
(function (K) {
  "use strict";
  const { isNum, readNumber, dateMs, daysBetween, addDays, localDate, fmtDate, fmtShort, fmtWeekday, todayStr } = K.util;

  const A = K.register({
    id: "hawky",
    name: "Hawky",
    title: "Hawky — Errands",
    subtitle: "Errands for Momo to fit into your week, and shopping lists that cool off before you buy.",
    width: 780,
    backupNote: "Your errands and shopping lists live only in this browser. Export a backup now and then, or sync to a folder to keep them on other devices too.",
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }],
    // The "bird" icon from Lucide (ISC license) — Hawky is Sokka's messenger hawk — in teal so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data. 2: shopping lists (`lists`); 1 had none.
    DATA_SCHEMA_VERSION: 2,
    MAX_TEXT: 60,          // an errand's text, which is its title in Momo
    MAX_NOTE: 200,         // an errand's note
    MIN_MINUTES: 5,
    MAX_MINUTES: 480,
    DEFAULT_MINUTES: 15,   // quick add's estimate until another chip is picked (one of its chips)
    DONE_PAGE: 50,         // done errands (and done shopping lists) shown at a time
    DOT_WHEN_OVERDUE: true, // a dot on Hawky's icon while an errand is overdue: false turns it off
    // Shopping lists: a store and a topic make a list; its items, each with a note or a web link.
    MAX_VENDOR: 40,
    MAX_TOPIC: 40,
    MAX_ITEM: 100,
    MAX_ITEM_NOTE: 300,
    LOCK_DAYS: [30, 7],    // the cooling-off locks a list can take, in days (its buttons, in this order)
    MAX_LOCK_DAYS: 365     // the longest lock kept from a file (a newer version may offer other lengths)
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Every errand: { id, text, note, due, minutes, done, deleted, at, u } (CLAUDE.md has the details).
    // Deleted ones stay as markers so sync can't bring them back.
    items: [],
    // Every shopping list: { id, vendor, topic, items, lock, unlocked, done, deleted, at, u } (lists.js has the details).
    lists: [],
    view: "errands",        // what's on screen: "errands" | "lists" (this device only; it opens on errands)
    // Quick add's chips: day "none" | "today" | "pick" (its date field); minutes 15, 30, 60 or "other" (its number
    // field); note: its note line shown. Back to no day, 15 minutes and no note after each add.
    add: { day: "none", minutes: A.DEFAULT_MINUTES, note: false },
    listNote: false,        // the shopping add row's note line shown
    editing: null,          // the errand pop-up: { id, snapshot }
    listEditing: null,      // a list's pop-up (Rename): { id, snapshot }
    itemEditing: null,      // an item's pop-up: { listId, id, snapshot }
    doneShown: A.DONE_PAGE, // how many done errands the Done fold shows
    listsDoneShown: A.DONE_PAGE, // how many done lists theirs shows
    knownToday: ""          // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // A line as it's kept: runs of spaces and line breaks become one space, cut to max characters
  // without splitting an emoji.
  const cleanLine = (v, max) => (typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");
  // Text that keeps its lines (a note): each line's spaces tidied, at most one empty line in a row, cut the same way.
  const cleanText = (v, max) => (typeof v === "string"
    ? [...v.replace(/\r\n?/g, "\n").split("\n").map(l => l.replace(/[^\S\n]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim()].slice(0, max).join("").trim() : "");
  const firstLine = s => (s || "").split("\n")[0];
  // Minutes as kept: a whole number from MIN_MINUTES to MAX_MINUTES (the default when it's no number).
  const cleanMinutes = m => (isNum(m) ? Math.min(A.MAX_MINUTES, Math.max(A.MIN_MINUTES, Math.round(m))) : A.DEFAULT_MINUTES);
  // A minutes field's value, or 0 when it's empty or out of range.
  const readMinutes = el => { const v = readNumber(el); return isNum(v) && v >= A.MIN_MINUTES && v <= A.MAX_MINUTES ? Math.round(v) : 0; };
  // "15m", "1h", "1h 30m" (as Appa writes them).
  function fmtMinutes(m) {
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
  }

  // --- Days: a week runs Monday to Sunday, as in Momo ---
  const sundayOf = d => addDays(d, (7 - new Date(dateMs(d)).getUTCDay()) % 7);
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // A day in words: "today", "tomorrow", "yesterday", its weekday later this week ("Friday"), else the day.
  function dayWords(d, today = todayStr()) {
    if (d === today) return "today";
    if (d === addDays(today, 1)) return "tomorrow";
    if (d === addDays(today, -1)) return "yesterday";
    return d > today && d <= sundayOf(today) ? fmtWeekday(d) : fmtDay(d);
  }
  // How long something has waited since it was added (its `at`, a moment): "waiting 12 days", "added today";
  // "" when that's unknown. Counted to today, so time travel moves it.
  function waited(at, today = todayStr()) {
    if (!at) return "";
    const n = daysBetween(localDate(new Date(at)), today);
    return n > 0 ? `waiting ${n} day${n === 1 ? "" : "s"}` : "added today";
  }

  // --- The list's groups, in order, and the one an open errand is in (by its due day): Overdue (before
  // today), Today, This week (by Sunday) and Later (dated beyond, or no date: openItems puts those last) ---
  const GROUPS = [["overdue", "Overdue"], ["today", "Today"], ["week", "This week"], ["later", "Later"]];
  function groupOf(i, today = todayStr()) {
    if (!i.due) return "later";
    if (i.due < today) return "overdue";
    if (i.due === today) return "today";
    return i.due <= sundayOf(today) ? "week" : "later";
  }

  // --- Which errand is where ---
  const live = () => S.items.filter(i => !i.deleted);
  const itemById = id => (id && S.items.find(i => i.id === id && !i.deleted)) || null;
  // Soonest due first (so overdue ones lead), the undated last; then in the order they were added.
  const bySoonest = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.at - b.at || (a.id < b.id ? -1 : 1);
  const openItems = () => live().filter(i => !i.done).sort(bySoonest);
  const overdueItems = (today = todayStr()) => live().filter(i => !i.done && i.due && i.due < today); // in no order
  // Done ones, newest first.
  const doneItems = () => live().filter(i => i.done).sort((a, b) => b.done.localeCompare(a.done) || b.u - a.u || (a.id < b.id ? -1 : 1));

  Object.assign(A, {
    cleanLine, cleanText, firstLine, cleanMinutes, readMinutes, fmtMinutes, sundayOf, fmtDay, dayWords, waited, GROUPS, groupOf,
    live, itemById, openItems, overdueItems, doneItems
  });
})(Kyoshi);
