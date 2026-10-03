/* Momo · app.js — registers Momo with Kyoshi, plus its constants, state (A.S) and small helpers
 * (hours, week keys, clock times). Loads first of Momo's files: the others destructure what's
 * here at the top, and call functions from each other as A.name() (all files are loaded by the
 * time anything runs). File map, data model and the app's philosophy: apps/momo/CLAUDE.md. */
(function (K) {
  "use strict";
  const { addDays, dateMs, fmtShort, todayStr, isDate, pad2, fmtNum } = K.util;

  const A = K.register({
    id: "momo",
    name: "Momo",
    title: "Momo — Weekly Time Budget",
    subtitle: "A weekly time budget. Give every hour a job.",
    width: 1180,
    backupNote: "Your plans live only in this browser. Export a backup now and then, or sync to a folder to keep them on other devices too.",
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 30, after: true }],
    // The "peach" icon from Lucide Lab (ISC license) — Aang named Momo after a peach ("momo" in Japanese) — in orange so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2a2 2 0 0 0-2 2v2"/><path d="M12 6.5A6 6 0 0 1 22 11c0 6.1-4.5 11-10 11S2 17.1 2 11a6 6 0 0 1 12 0"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Monday first
  Object.assign(A, {
    DAY_HOURS: 24,
    DAYS,
    WEEKDAYS: [0, 1, 2, 3, 4],
    DAY_NAMES: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    DAY_LONG: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    STEP: 0.25,        // time moves in 15-minute steps
    BUTTON_STEP: 0.5,  // what the − / + buttons move by
    MAX_TITLE: 40,
    MAX_GOAL_HOURS: 100000, // the old goals' limits, which data.js cleanGoal still keeps them within
    GOAL_MAX_WEEK: 10,
    DRAW_HOURS: 1,     // a card drawn from a task in Tasks that doesn't say how long (tasks.js)
    COST_WEEKS: 13,    // the true cost averages the apps' asks over the weeks kept among this many, this one too (truecost.js)
    EVENT_WINDOW: 3,   // hours another app's event can move from its own time, either way, so doses stay on schedule (agenda.js)
    YEAR_MIN: 2000, YEAR_MAX: 2999, // the old goals' finish-by years
    FREE_TIME: "Free time",
    // Where in a card the cards inside it go.
    POSITIONS: ["top", "middle", "bottom"],
    POSITION_TEXT: { top: "at the top of", middle: "in the middle of", bottom: "at the bottom of" },
    AUTO: Symbol("auto"), // a spot on a day left to autoSpot, in place of a card to go before
    // Colours by name (see colors.js). The first HIGHLIGHTS are the ones the
    // editors offer; the rest are only handed out automatically once those are
    // taken. Each is easy to tell from the others and from Free time's slate,
    // and reads on both themes.
    PALETTE: [
      ["blue", "#3b82f6"], ["violet", "#8b5cf6"], ["pink", "#ec4899"], ["red", "#ef4444"],
      ["orange", "#f97316"], ["yellow", "#eab308"], ["green", "#22c55e"], ["teal", "#14b8a6"],
      ["orchid", "#e879f9"], ["magenta", "#c026d3"], ["sky", "#38bdf8"], ["emerald", "#059669"], ["lavender", "#a78bfa"], ["coral", "#fb7185"],
      ["ocean", "#0891b2"], ["lime", "#65a30d"], ["clay", "#c1664a"], ["mustard", "#ca8a04"], ["aqua", "#2dd4bf"], ["chartreuse", "#84cc16"],
      ["indigo", "#6366f1"], ["peach", "#fb923c"], ["raspberry", "#db2777"], ["azure", "#0ea5e9"], ["bubblegum", "#f472b6"], ["gold", "#d4a017"]
    ],
    HIGHLIGHTS: 8,
    // The colour each app's cards try first (colors.js), near its icon's; another app's get one as any title does.
    APP_COLORS: { hawky: "teal", pabu: "coral", badgermole: "lime", turtleduck: "mustard", appa: "clay" },
    OLD_COLORS: ["blue", "violet", "pink", "orange", "yellow", "green", "teal"], // cards' colours 0–6 before titles had their own (7 was slate)
    COLOR_WEEKS: 8, // how long a title off the boards keeps its colour for when it's back
    UNDO_MAX: 40,
    UNDO_MAX_CHARS: 16e6, // …and no more of them than fit in this much, as years of weeks make each one bigger
    // Drag & drop: a mouse drag starts after a few pixels; on touch a card is held
    // for a moment first, so a plain swipe still scrolls.
    DRAG_START_PX: 4,
    TOUCH_HOLD_MS: 250,
    TOUCH_GROUP_MS: 400, // held still this much longer, a touch drag picks up the same card on every day
    TOUCH_SLOP_PX: 8,
    EDGE_PX: 48,         // the page and board scroll while dragging this close to an edge
    CLIP_MS: 5000,       // a copied or cut card waits this long for the next paste
    // Backup file format. Bump only when the shape changes in a way import has to migrate.
    // 2: colours moved from each card and goal to data.colors, by title and goal. (Closed
    // weeks' spent came later without a bump: older files simply don't have it.)
    DATA_SCHEMA_VERSION: 2,
    // "Start from a sample" in an empty baseline.
    SAMPLE_BASELINE: [
      { title: "Sleep", hours: 8, days: DAYS, color: "violet" },
      { title: "Work", hours: 8, days: [0, 1, 2, 3, 4], color: "blue" },
      { title: "Commute", hours: 1, days: [0, 1, 2, 3, 4], color: "teal" },
      { title: "Meals & chores", hours: 2, days: DAYS, color: "yellow" }
    ]
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  Object.assign(A.S, {
    data: null,            // everything saved and synced: { weeks, baseline, goals (old, kept), colors, asks } (model.js)
    view: "this",          // "this" | "next" | "base" — the board's tab; always opens on this week
    today: false,          // Today on screen in place of the board (today.js): at first on a phone only
    undoStack: [],         // earlier versions of data as JSON, newest last
    lastSavedJSON: "",     // data as of the last save, as JSON…
    lastSaved: null,       // …and parsed, to tell what the next change touched
    closing: null,         // the close-out on screen: { key, rows: [{ title, hours, days, asked, done }] } (Later: closeout.js laterToday)
    knownToday: "",        // today as of the last check, to notice midnight and new weeks
    editing: null,         // the card editor's state
    press: null,           // a pointer down on a card that isn't a drag yet
    stuck: null,           // a mouse down on a pinned card, which doesn't drag: { el, pointerId, x0, y0, moved }
    drag: null,            // the drag in progress
    resize: null,          // the resize in progress
    suppressClick: false,  // the click that ends a drag isn't a tap
    renderPending: false,  // a redraw held back until a drag ends
    clip: null,            // a card copied or cut for pasting: { key, id, cut, timer }
    mouse: null,           // where the mouse is, for the copy & paste shortcuts: { x, y }
    fill: null,            // what other apps need, in the blocks it fills, as last drawn (inbox.js)
    agenda: [],            // other apps' events on the board on screen, as last drawn (agenda.js)
    agendaKey: "",         // their events this week and next as last drawn, to notice them changing
    triage: null,          // an event's pop-up (triage.js): { key: its week, ev: its key, day, at: the spot picked }
    detail: null,          // a card's pop-up on Today (today.js): { key: its week, id }
    ruler: { t: [0], y: [0], hour: 0 } // the board's ruler as last drawn (times.js)
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // Hours sit on the 15-minute grid, and one card holds at most a day.
  const snap = h => Math.round(h / A.STEP) * A.STEP;
  const clampHours = h => Math.min(A.DAY_HOURS, Math.max(A.STEP, snap(h)));
  const fmtH = h => (h > 0 && h < 1 ? `${Math.round(h * 60)}m` : `${fmtNum(h)}h`);
  // A share of the 168-hour week, e.g. "56%"; only none or all of it shows as 0% or 100%.
  const fmtPct = h => { const p = Math.round(h / (7 * A.DAY_HOURS) * 100); return `${h > 0 && h < 7 * A.DAY_HOURS ? Math.min(99, Math.max(1, p)) : p}%`; };
  // Titles and names: runs of spaces become one, and a long one is cut without splitting an emoji.
  const cleanText = s => [...String(s).replace(/\s+/g, " ").trim()].slice(0, A.MAX_TITLE).join("").trim();
  // A time of day, in hours after midnight, on the 24-hour clock: 7.5 is
  // "0730". Past midnight it keeps counting ("2430").
  const fmtClock = h => `${pad2(Math.floor(h))}${pad2(Math.round(h % 1 * 60))}`;
  const isDueDate = d => isDate(d) && d >= `${A.YEAR_MIN}-01-01` && d <= `${A.YEAR_MAX}-12-31`;
  // Weeks run Monday to Sunday and are known by their Monday's date.
  const dayIndex = d => (new Date(dateMs(d)).getUTCDay() + 6) % 7; // 0 = Monday
  const weekKeyOf = d => addDays(d, -dayIndex(d));
  const isWeekKey = k => isDate(k) && dayIndex(k) === 0;
  const thisWeekKey = () => weekKeyOf(todayStr());
  const nextWeekKey = () => addDays(thisWeekKey(), 7);
  // The first day a board counts: today on this week (earlier hours are already spent), else Monday.
  const firstDay = key => (key === thisWeekKey() ? dayIndex(todayStr()) : 0);
  // "Sep 28 – Oct 4", or "Sep 21 – 27" within one month.
  function fmtWeek(key) {
    const end = addDays(key, 6);
    return `${fmtShort(key)} – ${key.slice(5, 7) === end.slice(5, 7) ? +end.slice(8) : fmtShort(end)}`;
  }
  // A number field in Momo by id: null when empty, NaN when it isn't a usable number.
  const readNumber = id => K.util.readNumber(A.$(id));

  Object.assign(A, {
    snap, clampHours, fmtH, fmtPct, cleanText, fmtClock, isDueDate, dayIndex, weekKeyOf, isWeekKey,
    thisWeekKey, nextWeekKey, firstDay, fmtWeek, readNumber
  });
})(Kyoshi);
