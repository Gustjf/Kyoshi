/* Wan Shi Tong · app.js — registers Wan Shi Tong with Kyoshi, plus its constants (categories,
 * "Available to me now" values, Active media's spots, limits), state (A.S) and small helpers (formatting,
 * Google links, and which recommendation is where: Active media, the backlog or Finished).
 * Loads first of the app's files: the others destructure what's here at the top, and call
 * functions from each other as A.name(). File map and data model: apps/wanshitong/CLAUDE.md. */
(function (K) {
  "use strict";
  const { fmtDate, fmtShort, todayStr } = K.util;

  const A = K.register({
    id: "wanshitong",
    name: "Wan Shi Tong",
    title: "Wan Shi Tong — Media Tracker",
    subtitle: "Recommended books, movies, TV/anime and games, in one place.",
    width: 780,
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 30 }],
    // The "owl" icon from Lucide Lab (ISC license) — Wan Shi Tong is the owl spirit who keeps the library of all knowledge — in violet so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="8" ry="7"/><path d="M12 9a4 4 0 1 1 8 0v12h-4C9.4 21 4 15.6 4 9a4 4 0 1 1 8 0v1"/><path d="M8 9h.01"/><path d="M16 9h.01"/><path d="M20 21a3.9 3.9 0 1 1 0-7.8"/><path d="M10 19.4V22"/><path d="M14 20.85V22"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  // What a recommendation can be, in the order they're listed. Ids are what backups store; add
  // more here and they show up everywhere. info: what the second field asks for (just enough to
  // find it again); search: added to its Google search, so "Dune" finds the right Dune.
  // Old ids: see OLD_CATS in data.js.
  const CATS = [
    { id: "book", label: "Book", group: "Books", info: "Author or edition", nameEg: "Piranesi", infoEg: "Susanna Clarke", search: "book" },
    { id: "movie", label: "Movie", group: "Movies", info: "Year or director", nameEg: "Spirited Away", infoEg: "Miyazaki, 2001", search: "movie" },
    { id: "tv", label: "TV/Anime", group: "TV/Anime", info: "Year or where to watch", nameEg: "Frieren", infoEg: "2023, Crunchyroll", search: "series" },
    { id: "game", label: "Game", group: "Games", info: "Platform", nameEg: "Outer Wilds", infoEg: "Switch or PC", search: "video game" },
  ];
  // A category from a newer version (kept as it is) shows as Other.
  const OTHER = { id: "other", label: "Other", group: "Other", info: "Details", nameEg: "", infoEg: "", search: "" };
  // Active media's spots, in order: this many things can be going at once, of any kind. Ids are what
  // backups store; "now" was the only one before 2.000, so older data and backups fill the first.
  const NOW_SPOTS = ["now", "now2", "now3"];
  // Every spot: Active media's, and "next" (Up next's until 2.362: unused, but kept in storage, backups and sync).
  const SLOTS = NOW_SPOTS.concat("next");
  Object.assign(A, {
    CATS, OTHER, NOW_SPOTS, SLOTS,
    // "Available to me now": at hand, so it can be started right away. "yes", or "" (not yet); older
    // versions said how (downloaded, borrowed, owned), kept as they are and shown as yes.
    HAVE: { yes: "Available now", downloaded: "Available now", borrowed: "Available now", owned: "Available now" },
    MAX_NAME: 120,
    MAX_INFO: 120,
    MAX_WHY: 500,
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Every recommendation: { id, cat, name, info, have, why, added, started, done, deleted, at, u }
    // (CLAUDE.md has the details). Deleted ones stay as markers so sync can't bring them back.
    items: [],
    // Active media's spots (now, now2, now3) and next (the old Up next's, unused): the item each holds
    // ("" when empty), u = when that was set.
    slots: Object.fromEntries(SLOTS.map(k => [k, { id: "", u: 0 }])),
    folded: [],     // backlog groups folded away on this device (category ids)
    editing: null,  // the add / edit pop-up: { id (null when adding), cat, have, snapshot }
    swapping: null, // the "Active media is full" pop-up: the id of the one to start
    lastCat: "",    // the category last added, where the next add starts
    knownToday: ""  // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const catOf = id => CATS.find(c => c.id === id) || OTHER;
  // The backlog group an item goes in: its category, or Other.
  const groupOf = id => catOf(id).id;
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // A Google search for it: its name and info, plus what it is.
  const searchUrl = i => `https://www.google.com/search?q=${encodeURIComponent([i.name, i.info, catOf(i.cat).search].filter(Boolean).join(" "))}`;
  // Newest first (the day it was added, then the moment).
  const byNewest = (a, b) => b.added.localeCompare(a.added) || b.at - a.at;

  // --- Where each recommendation is ---
  const live = () => S.items.filter(i => !i.deleted);
  const itemById = id => (id && S.items.find(i => i.id === id && !i.deleted)) || null;
  // Active media's spots, in order, and the item each holds while it's there and not finished (null:
  // the spot is free). Two devices can leave one item in two spots; the first has it.
  function nowSpots() {
    const seen = new Set();
    return NOW_SPOTS.map(spot => {
      const i = itemById(S.slots[spot].id), ok = !!i && !i.done && !seen.has(i.id);
      if (ok) seen.add(i.id);
      return { spot, item: ok ? i : null, u: S.slots[spot].u };
    });
  }
  // What's active, in the order it went in.
  const nowItems = () => nowSpots().filter(s => s.item).sort((a, b) => a.u - b.u).map(s => s.item);
  const spotOf = i => (nowSpots().find(s => s.item === i) || { spot: "" }).spot; // "" when it isn't active
  const freeSpot = () => (nowSpots().find(s => !s.item) || { spot: "" }).spot;   // "" when all are taken
  // The backlog: everything not finished or active (one the old Up next still holds included).
  const backlog = () => { const busy = nowItems(); return live().filter(i => !i.done && !busy.includes(i)); };
  const finished = () => live().filter(i => i.done).sort((a, b) => b.done.localeCompare(a.done) || b.at - a.at);
  // Puts an item's id in a spot (one of Active media's, or "next"), or "" to empty it.
  const setSlot = (slot, id) => { S.slots[slot] = { id, u: Date.now() }; };
  // Empties every spot holding it: back in the backlog (or finished, or deleted).
  const unslot = id => SLOTS.forEach(k => { if (S.slots[k].id === id) setSlot(k, ""); });

  // --- Shared with other apps, read-only (Momo, through K.inbox: core/inbox.js): what's active, in
  // the order it went in, as copies, each ongoing (never used up: Momo's Tasks keep it to draw from, and
  // its cards show it); "Open in Wan Shi Tong" calls open(id), which shows it in its pop-up. ---
  const inbox = () => nowItems().map(i => ({ id: i.id, title: i.name, fill: "ongoing", details: [`Active · ${catOf(i.cat).label}`] }));
  const open = id => { if (itemById(id)) A.openEditor(id); };

  Object.assign(A, {
    catOf, groupOf, fmtDay, searchUrl, byNewest,
    live, itemById, nowSpots, nowItems, spotOf, freeSpot, backlog, finished, setSlot, unslot, inbox, open
  });
})(Kyoshi);
