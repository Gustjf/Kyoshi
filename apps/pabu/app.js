/* Pabu · app.js — registers Pabu with Kyoshi, plus its constants (limits, how often and how, Momo's window), state
 * (A.S) and small helpers: text and minutes, each person's calls, texts and visits (the days you talked, when each is
 * due, this week's), the groups in use, days in words, and birthdays. Loads first of the app's files: the others
 * destructure what's here at the top, and call functions from each other as A.name(). File map and data model:
 * apps/pabu/CLAUDE.md. */
(function (K) {
  "use strict";
  const { isNum, readNumber, pad2, addDays, addMonths, daysBetween, daysInMonth, dateMs, localDate, fmtDate, fmtShort, todayStr } = K.util;

  const A = K.register({
    id: "pabu",
    name: "Pabu",
    title: "Pabu — Keep in touch",
    subtitle: "The people you want to stay close to, and who's due a call, a text or a visit, for Momo to fit into your week.",
    width: 780,
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }],
    // The "heart-handshake" icon from Lucide (ISC license) — Pabu is Bolin's fire ferret — in rose so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data (2: each person's calls, texts and visits, a
    // list; 1 had one, at the top).
    DATA_SCHEMA_VERSION: 2,
    MAX_NAME: 40,           // a name: "Visit " and a name stay within Momo's 60 for a need's title
    MAX_GROUP: 30,
    MAX_NOTE: 1000,
    MAX_CADENCES: 6,        // the calls, texts and visits one person can have (none: birthday only)
    MIN_MINUTES: 5,
    MAX_MINUTES: 480,
    MAX_TALKS: 200,         // the days you talked kept for each call, text or visit, the newest
    // How often, in the chips' and the pop-up's order, with its words. "none" is birthday only (quick add's chip: no
    // call, text or visit at all).
    EVERY: [["week", "every week"], ["2weeks", "every 2 weeks"], ["month", "every month"], ["quarter", "every quarter"], ["year", "every year"], ["none", "birthday only"]],
    // How often as the People list says it: "Call monthly · Text every 2 weeks".
    OFTEN: { week: "weekly", "2weeks": "every 2 weeks", month: "monthly", quarter: "quarterly", year: "yearly" },
    // How, with its word and its minutes until changed.
    HOW: { call: { label: "Call", minutes: 30 }, text: { label: "Text", minutes: 10 }, visit: { label: "Visit", minutes: 120 } },
    DEFAULT_EVERY: "month",
    DEFAULT_HOW: "call",
    WINDOW_DAYS: 6,         // Momo may place someone up to this many days before they're due (as core's meetings)
    SOON_DAYS: 14,          // Coming up: due within this many days
    BIRTHDAY_DAYS: 30,      // the Birthdays strip: those in the next this many days
    DOT_WHEN_OVERDUE: true // a dot on Pabu's icon while someone is overdue: false turns it off
  });
  const EVERY_WORDS = Object.fromEntries(A.EVERY);
  const MONTHS = { month: 1, quarter: 3, year: 12 };
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Everyone: { id, name, group, note, birthday, cadences: [{ id, every, how, minutes, talks, at }], deleted, at, u }
    // (CLAUDE.md has the details). Deleted ones stay as markers so sync can't bring them back.
    people: [],
    // Quick add's chips: how often and how. Back to every month and a call after each add.
    add: { every: A.DEFAULT_EVERY, how: A.DEFAULT_HOW },
    filter: null,   // the People list's chip: null for All, "" for No group, else a group (any case)
    editing: null,  // the person pop-up: { id, at, birthday and bday (as opened), cadences (as shown there), snapshot }
    knownToday: ""  // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // --- Text and minutes ---
  // A line as it's kept: runs of spaces and line breaks become one space, cut to max characters
  // without splitting an emoji.
  const cleanLine = (v, max) => (typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");
  // Text that keeps its lines (a note): each line's spaces tidied, at most one empty line in a row, cut the same way.
  const cleanText = (v, max) => (typeof v === "string"
    ? [...v.replace(/\r\n?/g, "\n").split("\n").map(l => l.replace(/[^\S\n]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim()].slice(0, max).join("").trim() : "");
  // A call, text or visit's how often and how, read: one this version doesn't know (a newer version's, kept as it is)
  // counts as every month and a call.
  const everyOf = c => (Object.hasOwn(A.OFTEN, c.every) ? c.every : A.DEFAULT_EVERY);
  const howOf = c => (Object.hasOwn(A.HOW, c.how) ? c.how : A.DEFAULT_HOW);
  const everyWords = c => EVERY_WORDS[everyOf(c)];
  const howLabel = c => A.HOW[howOf(c)].label;
  // "Call monthly", "Text every 2 weeks".
  const cadenceWords = c => `${howLabel(c)} ${A.OFTEN[everyOf(c)]}`;
  // Minutes as kept: a whole number from MIN_MINUTES to MAX_MINUTES, else how's usual length.
  const cleanMinutes = (m, how) => (isNum(m) && m >= A.MIN_MINUTES && m <= A.MAX_MINUTES ? Math.round(m) : A.HOW[howOf({ how })].minutes);
  // A minutes field's value, or 0 when it's empty or out of range.
  const readMinutes = el => { const v = readNumber(el); return isNum(v) && v >= A.MIN_MINUTES && v <= A.MAX_MINUTES ? Math.round(v) : 0; };
  // "15m", "1h", "1h 30m" (as Hawky writes them).
  function fmtMinutes(m) {
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
  }
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // --- Days ---
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = (d, today = todayStr()) => (d.slice(0, 4) === today.slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // A day this week by its name: "Thu".
  const weekdayOf = d => fmtDate(d, { weekday: "short" });
  // The Monday of a day's week: weeks run Monday to Sunday, as Momo's.
  const mondayOf = d => addDays(d, -((new Date(dateMs(d)).getUTCDay() + 6) % 7));
  // The day a moment fell on, on this device ("" for none).
  const dayOf = ms => (ms ? localDate(new Date(ms)) : "");
  // Whole months from one day to a later one (Aug 26 to Sep 30 is 1).
  const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) - (b.slice(8) < a.slice(8) ? 1 : 0);
  // How long ago a day was: "today", "yesterday", "5 days ago", "3 weeks ago", "2 months ago", "a year ago", "3 years ago".
  function agoWords(day, today = todayStr()) {
    const n = daysBetween(day, today);
    if (n <= 0) return "today";
    if (n === 1) return "yesterday";
    if (n < 14) return `${n} days ago`;
    if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
    const months = monthsBetween(day, today), years = Math.floor(months / 12);
    return months < 12 ? `${Math.max(2, months)} months ago` : years === 1 ? "a year ago" : `${years} years ago`;
  }
  // The last talk in words: "talked today", "last talked 5 weeks ago", "never talked".
  const talkedWords = (last, today = todayStr()) => (!last ? "never talked" : last === today ? "talked today" : `last talked ${agoWords(last, today)}`);
  // When someone's due in words: "overdue 4 days", "due today", "due tomorrow", "due in 5 days", "due Nov 3".
  function dueWords(due, today = todayStr()) {
    const n = daysBetween(today, due);
    if (n < 0) return `overdue ${plural(-n, "day")}`;
    if (n === 0) return "due today";
    if (n === 1) return "due tomorrow";
    return n <= A.SOON_DAYS ? `due in ${n} days` : `due ${fmtDay(due, today)}`;
  }

  // --- Who's who ---
  const live = () => S.people.filter(p => !p.deleted);
  const personById = id => (id && S.people.find(p => p.id === id && !p.deleted)) || null;
  const cadenceById = (p, id) => (p && p.cadences.find(c => c.id === id)) || null;
  const byName = (p, q) => p.name.localeCompare(q.name) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0);
  // "Call Mom", "Text Sam", "Visit Gran": This week's lines and Momo's cards, at most 6 + 40 characters (Momo's 60).
  const needTitle = (p, c) => `${howLabel(c)} ${p.name}`;
  // The groups in use, A to Z, each once whatever its case (the first spelling met); but the one person's own (the
  // pop-up's, so their group's spelling can still be changed).
  function groupsInUse(except = "") {
    const seen = new Map();
    live().forEach(p => { if (p.group && p.id !== except && !seen.has(p.group.toLowerCase())) seen.set(p.group.toLowerCase(), p.group); });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  // --- When each call, text or visit is due ---
  // The last day you talked: the newest kept that isn't after today (a day ahead, from a device whose clock was wrong,
  // is kept but never counts), else "".
  const lastTalk = (c, today = todayStr()) => c.talks.find(d => d <= today) || "";
  // The day after a talk on `day` that the next one's due; months stop at the month's end.
  const nextDue = (day, every) => (every === "week" ? addDays(day, 7) : every === "2weeks" ? addDays(day, 14) : addMonths(day, MONTHS[every] || 1));
  // The day a call, text or visit was added ("" if unknown): the person's, for one carried over from before there were
  // several.
  const addedDay = (p, c) => dayOf(c.at || p.at);
  // When it's due: its last talk and how often; never talked, the day it was added (today without one).
  function dueOf(p, c, today = todayStr()) {
    const last = lastTalk(c, today);
    return last ? nextDue(last, everyOf(c)) : addedDay(p, c) || today;
  }
  const byDue = (a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  // Everyone's calls, texts and visits with when each is due, soonest first, then by title: [{ p, c, due, title, key }].
  // Due as the day before `upTo` began, when given: its talks before that day only.
  function allDue(today = todayStr(), upTo = "") {
    const asOf = upTo ? addDays(upTo, -1) : today;
    return live().flatMap(p => p.cadences.map(c => ({ p, c, due: dueOf(p, c, asOf), title: needTitle(p, c), key: `${p.id}:${c.id}` }))).sort(byDue);
  }
  // A person's next due: the soonest of their calls, texts and visits ("" for birthday only: never due).
  const nextDueOf = (p, today = todayStr()) => p.cadences.map(c => dueOf(p, c, today)).sort()[0] || "";
  // This week (Monday to Sunday): every call, text or visit due by Sunday, or overdue, as the week began (its talks
  // before Monday), soonest first; each with done: the last day you talked this week ("" for none yet). So one you
  // ticked stays, ✓, until the week ends.
  function thisWeek(today = todayStr()) {
    const monday = mondayOf(today), sunday = addDays(monday, 6);
    return allDue(today, monday).filter(r => r.due <= sunday).map(r => ({ ...r, done: r.c.talks.find(d => d >= monday && d <= today) || "" }));
  }

  // --- Birthdays: kept as "MM-DD", or "YYYY-MM-DD" with the year born ---
  function parseBirthday(b) {
    const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(typeof b === "string" ? b : "");
    return m ? { month: +m[2], day: +m[3], year: m[1] ? +m[1] : null } : null;
  }
  // The day someone's birthday falls on in a year ("" for none): Feb 29 is Feb 28 in a year without it.
  function birthdayIn(p, year) {
    const b = parseBirthday(p.birthday);
    return b ? `${year}-${pad2(b.month)}-${pad2(Math.min(b.day, daysInMonth(year, b.month)))}` : "";
  }
  // Their next birthday, today or later ("" for none).
  function nextBirthday(p, today = todayStr()) {
    const year = +today.slice(0, 4), d = birthdayIn(p, year);
    return !d || d >= today ? d : birthdayIn(p, year + 1);
  }
  // How old they are on a day: null without the year born (or before it).
  function ageOn(p, date) {
    const b = parseBirthday(p.birthday), year = +date.slice(0, 4);
    if (!b || !b.year) return null;
    const age = year - b.year - (date < birthdayIn(p, year) ? 1 : 0);
    return age >= 0 ? age : null;
  }
  // The 🎂 line: "🎂 Oct 12 · turns 60", "🎂 today · turns 60", "🎂 Oct 12"; "" without a birthday.
  function fmtBirthday(p, today = todayStr()) {
    const next = nextBirthday(p, today), age = next && ageOn(p, next);
    return next ? `🎂 ${next === today ? "today" : fmtShort(next)}${age ? ` · turns ${age}` : ""}` : "";
  }
  // Whether you talked on a day, by any call, text or visit.
  const talkedOn = (p, day) => p.cadences.some(c => c.talks.includes(day));

  Object.assign(A, {
    MONTH_NAMES, cleanLine, cleanText, everyOf, howOf, everyWords, howLabel, cadenceWords, cleanMinutes, readMinutes,
    fmtMinutes, plural, cap, fmtDay, weekdayOf, mondayOf, dayOf, agoWords, talkedWords, dueWords, live, personById,
    cadenceById, byName, needTitle, groupsInUse, lastTalk, nextDue, addedDay, dueOf, allDue, nextDueOf, thisWeek,
    parseBirthday, birthdayIn, nextBirthday, ageOn, fmtBirthday, talkedOn
  });
})(Kyoshi);
