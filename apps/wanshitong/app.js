/* Wan Shi Tong · app.js — registers Wan Shi Tong with Kyoshi, plus its constants (categories,
 * "Have it?" choices, limits), state (A.S) and small helpers (formatting, Google links, and which
 * recommendation is where: In progress, Up next, the magazine or Finished). Loads first of the
 * app's files: the others destructure what's here at the top, and call functions from each
 * other as A.name(). File map and data model: apps/wanshitong/CLAUDE.md. */
(function (K) {
  "use strict";
  const { fmtDate, fmtShort, todayStr } = K.util;

  const A = K.register({
    id: "wanshitong",
    name: "Wan Shi Tong",
    title: "Wan Shi Tong — Media Tracker",
    subtitle: "Every recommendation in one place, and always something worthwhile up next.",
    width: 780,
    backupNote: "Your list lives only in this browser. Export a backup now and then, or sync to a folder to keep it on other devices too.",
    // The "owl" icon from Lucide Lab (ISC license) — Wan Shi Tong is the owl spirit who keeps the library of all knowledge — in violet so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="8" ry="7"/><path d="M12 9a4 4 0 1 1 8 0v12h-4C9.4 21 4 15.6 4 9a4 4 0 1 1 8 0v1"/><path d="M8 9h.01"/><path d="M16 9h.01"/><path d="M20 21a3.9 3.9 0 1 1 0-7.8"/><path d="M10 19.4V22"/><path d="M14 20.85V22"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  // What a recommendation can be, in the order they're listed. Ids are what backups store; add
  // more here and they show up everywhere. info: what the second field asks for (just enough to
  // find it again); search: added to its Google search, so "Dune" finds the right Dune;
  // cost: courses keep what they cost; have / haveLabels: the "Have it?" choices it offers
  // (default: all of HAVE) and any it names its own way.
  const CATS = [
    { id: "novel", label: "Novel", group: "Novels", info: "Author", nameEg: "Piranesi", infoEg: "Susanna Clarke", search: "novel" },
    { id: "textbook", label: "Textbook", group: "Textbooks", info: "Author or edition", nameEg: "Calculus", infoEg: "Spivak, 4th edition", search: "textbook" },
    { id: "movie", label: "Movie", group: "Movies", info: "Year or director", nameEg: "Spirited Away", infoEg: "Miyazaki, 2001", search: "movie" },
    { id: "tv", label: "TV/Anime", group: "TV/Anime", info: "Year or where to watch", nameEg: "Frieren", infoEg: "2023, Crunchyroll", search: "series" },
    { id: "elearning", label: "eLearning", group: "eLearning courses", info: "Platform or teacher", nameEg: "CS50", infoEg: "Harvard, on edX", search: "online course",
      cost: true, have: ["downloaded", "owned"], haveLabels: { owned: "Enrolled" } },
    { id: "inperson", label: "In person", group: "In-person courses", info: "Where, or who teaches it", nameEg: "Intro to pottery", infoEg: "Community center", search: "course",
      cost: true, have: ["owned"], haveLabels: { owned: "Enrolled" } }
  ];
  // A category from a newer version (kept as it is) shows as Other.
  const OTHER = { id: "other", label: "Other", group: "Other", info: "Details", nameEg: "", infoEg: "", search: "" };
  Object.assign(A, {
    CATS, OTHER,
    // "Have it?": already at hand, so it can be started right away. Not yet is "".
    HAVE: { downloaded: "Downloaded", borrowed: "Borrowed", owned: "Owned" },
    MAX_NAME: 120,
    MAX_INFO: 120,
    MAX_WHY: 500,
    MAX_COST: 1000000,
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Every recommendation: { id, cat, name, info, have, cost, why, added, started, done, deleted, at, u }
    // (CLAUDE.md has the details). Deleted ones stay as markers so sync can't bring them back.
    items: [],
    // In progress (now) and Up next (next): the item each holds ("" when empty), u = when that was set.
    slots: { now: { id: "", u: 0 }, next: { id: "", u: 0 } },
    folded: [],     // magazine groups folded away on this device (category ids)
    editing: null,  // the add / edit pop-up: { id (null when adding), cat, have, snapshot }
    lastCat: "",    // the category last added, where the next add starts
    knownToday: ""  // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const catOf = id => CATS.find(c => c.id === id) || OTHER;
  // The magazine group an item goes in: its category, or Other.
  const groupOf = id => catOf(id).id;
  // The "Have it?" choices a category offers, as [value, label].
  function haveChoices(id) {
    const c = catOf(id);
    return (c.have || Object.keys(A.HAVE)).map(h => [h, (c.haveLabels && c.haveLabels[h]) || A.HAVE[h]]);
  }
  const haveLabel = (catId, have) => (haveChoices(catId).find(([h]) => h === have) || [have, A.HAVE[have] || ""])[1];
  // "$49", "$1,250.50" or "Free"; "" when it isn't known.
  const fmtCost = c => (c === null ? "" : c === 0 ? "Free" : `$${c.toLocaleString(undefined, { minimumFractionDigits: c % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // A Google search for it: its name and info, plus what it is.
  const searchUrl = i => `https://www.google.com/search?q=${encodeURIComponent([i.name, i.info, catOf(i.cat).search].filter(Boolean).join(" "))}`;
  // Newest first (the day it was added, then the moment).
  const byNewest = (a, b) => b.added.localeCompare(a.added) || b.at - a.at;

  // --- Where each recommendation is ---
  const live = () => S.items.filter(i => !i.deleted);
  const itemById = id => (id && S.items.find(i => i.id === id && !i.deleted)) || null;
  // In progress and Up next: the item each holds, while it's there and not finished. (Two devices
  // can leave both pointing at one item; In progress then has it.)
  const nowItem = () => { const i = itemById(S.slots.now.id); return i && !i.done ? i : null; };
  const nextItem = () => { const i = itemById(S.slots.next.id); return i && !i.done && i !== nowItem() ? i : null; };
  // The magazine: everything not finished and in neither spot.
  const magazine = () => { const now = nowItem(), next = nextItem(); return live().filter(i => !i.done && i !== now && i !== next); };
  const finished = () => live().filter(i => i.done).sort((a, b) => b.done.localeCompare(a.done) || b.at - a.at);
  // Puts an item's id in a spot ("now" or "next"), or "" to empty it; what was there is back in the magazine.
  const setSlot = (slot, id) => { S.slots[slot] = { id, u: Date.now() }; };

  Object.assign(A, {
    catOf, groupOf, haveChoices, haveLabel, fmtCost, fmtDay, searchUrl, byNewest,
    live, itemById, nowItem, nextItem, magazine, finished, setSlot
  });
})(Kyoshi);
