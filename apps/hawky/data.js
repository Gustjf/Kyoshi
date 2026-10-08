/* Hawky · data.js — the app's saved data: loading, cleaning, saving, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use. Storage keys (A.store): items (errands), lists (shopping lists),
 * sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId, mergeById } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_TEXT, MAX_NOTE, MAX_VENDOR, MAX_TOPIC, MAX_ITEM, MAX_ITEM_NOTE, MAX_LOCK_DAYS,
    cleanLine, cleanText, cleanMinutes } = A;

  const MAX_MS = 8.64e15; // the last moment a date can hold
  function persist() {
    A.store.set("items", JSON.stringify(S.items));
    A.store.set("lists", JSON.stringify(S.lists));
  }

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // Saved or imported errands in the current shape; anything unusable is dropped, so a damaged
  // file can't break the app. A deleted one keeps only what sync needs.
  function cleanItems(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(i => {
      const gone = i.deleted === true;
      return {
        id: typeof i.id === "string" && i.id ? i.id.slice(0, 40) : newId(),
        text: gone ? "" : cleanLine(i.text, MAX_TEXT),
        note: gone ? "" : cleanText(i.note, MAX_NOTE), // "" for none (errands from before notes have none)
        due: !gone && isDate(i.due) ? i.due : "",     // the day it's due, "" for none
        minutes: cleanMinutes(i.minutes),
        done: !gone && isDate(i.done) ? i.done : "",  // the day it was ticked, "" while open
        postponed: !gone && isPos(i.postponed) ? Math.min(999, Math.round(i.postponed)) : 0, // Tomorrow → taps (0 before them)
        deleted: gone,
        at: isPos(i.at) && i.at < MAX_MS ? i.at : 0, // when it was added: the order of the undated, and Momo's "added" day
        u: isPos(i.u) ? i.u : 0
      };
    }).filter(i => (i.text || i.deleted) && !ids.has(i.id) && ids.add(i.id));
  }

  // Saved or imported shopping lists in the current shape, the same way (lists.js has their life: open, locked, ready,
  // done). A deleted list keeps only what sync needs, and so does a deleted item. A lock is kept with any whole number
  // of days up to MAX_LOCK_DAYS, so a newer version's other lengths survive a round trip through this one.
  function cleanListItems(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(i => {
      const gone = i.deleted === true;
      return {
        id: typeof i.id === "string" && i.id ? i.id.slice(0, 40) : newId(),
        text: gone ? "" : cleanLine(i.text, MAX_ITEM),
        note: gone ? "" : cleanText(i.note, MAX_ITEM_NOTE), // a note or a web link, "" for none
        at: isPos(i.at) && i.at < MAX_MS ? i.at : 0,         // when it was added: its order, and how long it has waited
        bought: !gone && isDate(i.bought) ? i.bought : "",   // the day it was ticked as bought, "" while not
        deleted: gone
      };
    }).filter(i => (i.text || i.deleted) && !ids.has(i.id) && ids.add(i.id));
  }
  const cleanLock = l => (isObj(l) && isDate(l.at) && isNum(l.days) && l.days >= 1 && l.days <= MAX_LOCK_DAYS ? { at: l.at, days: Math.round(l.days) } : null);
  function cleanLists(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(l => {
      const gone = l.deleted === true, lock = gone ? null : cleanLock(l.lock);
      return {
        id: typeof l.id === "string" && l.id ? l.id.slice(0, 40) : newId(),
        vendor: gone ? "" : cleanLine(l.vendor, MAX_VENDOR),
        topic: gone ? "" : cleanLine(l.topic, MAX_TOPIC),
        items: gone ? [] : cleanListItems(l.items),
        lock,                                                   // null while open, else { at: the day it was locked, days }
        unlocked: lock && isDate(l.unlocked) ? l.unlocked : "", // the day it was unlocked early, "" if it wasn't
        done: !gone && isDate(l.done) ? l.done : "",            // the day it was done (all bought), "" before
        deleted: gone,
        at: isPos(l.at) && l.at < MAX_MS ? l.at : 0,
        u: isPos(l.u) ? l.u : 0
      };
    }).filter(l => ((l.vendor && l.topic) || l.deleted) && !ids.has(l.id) && ids.add(l.id));
  }

  // Reads everything from storage (at start, and when another tab saved). Before shopping lists there's no `lists`.
  function load() {
    S.items = cleanItems(A.store.json("items"));
    S.lists = cleanLists(A.store.json("lists"));
  }

  // A Hawky backup or sync file: its items are errands, each with its text unless deleted. Another app's
  // list of items (Wan Shi Tong's recommendations have names) isn't one.
  const looksLike = raw => Array.isArray(raw.items) && raw.items.every(i => !isObj(i) || i.deleted === true || typeof i.text === "string");

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, items: S.items, lists: S.lists };
  }

  // Replaces everything with the backup's errands and shopping lists, after checking it has some (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anything to lose. A
  // backup from before shopping lists (schemaVersion 1: no `lists`) leaves the lists here as they are. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) return alert("That file doesn't look like a Hawky backup.");
    const withLists = Array.isArray(raw.lists), items = cleanItems(raw.items), lists = withLists ? cleanLists(raw.lists) : S.lists;
    const liveCount = list => list.filter(x => !x.deleted).length;
    const mine = A.live().length, theirs = liveCount(items);
    const mineLists = withLists ? liveCount(S.lists) : 0, theirLists = withLists ? liveCount(lists) : 0;
    if ((raw.items.length || (withLists && raw.lists.length)) && !theirs && !theirLists) {
      return alert("That backup has no errands or shopping lists in it, so nothing was changed.");
    }
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Hawky. Importing it anyway, but some data may not carry over.");
    }
    const count = (n, l) => `${n} errand${n === 1 ? "" : "s"}${mineLists || theirLists ? ` and ${l} shopping list${l === 1 ? "" : "s"}` : ""}`;
    const kept = !withLists && liveCount(S.lists) ? " Your shopping lists stay as they are: the backup is from before them." : "";
    if (ask && (mine || mineLists) && !K.backup.ask(A, raw, `Replace your ${count(mine, mineLists)} with the ${count(theirs, theirLists)} in this backup?${kept}`)) return;
    S.items = items;
    S.lists = lists;
    persist();
    A.changed(!!kept); // it's from a backup, so there's nothing new to export (but lists it didn't hold)
    A.renderAll();
    return true;
  }

  // A save from the sync folder (see core/sync.js): taken whole, or combined with ours errand by errand and list by
  // list (a list whole, items and all: like Pabu's people), the later change winning, in the order they were added. The
  // same on every device, so two combining at once agree. A save from before shopping lists (no `lists`) knows nothing
  // of them, so ours stay, even when it's taken whole (and the folder gets them back).
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const merged = (ours, theirs) => inOrder(mergeById(ours, theirs)); // each id's later change (K.util), in order
  function combine(raw, { replace, plain }) {
    const their = cleanItems(raw.items), theirLists = Array.isArray(raw.lists) ? cleanLists(raw.lists) : null;
    if (plain && !their.length && !(theirLists && theirLists.length)) return null;
    const next = replace ? their : merged(S.items, their);
    const nextLists = !theirLists ? S.lists : replace ? theirLists : merged(S.lists, theirLists);
    const key = (items, lists) => JSON.stringify([inOrder(items), inOrder(lists)]);
    return {
      same: key(next, nextLists) === key(their, theirLists || []),
      apply() {
        if (key(next, nextLists) === key(S.items, S.lists)) return false; // nothing new here
        S.items = next;
        S.lists = nextLists;
        return true;
      }
    };
  }

  // Other devices' data came in from the folder: keep it, and show it.
  function afterSync() {
    persist();
    A.renderAll();
  }

  A.load = load;
  A.data = { schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike, hasData: () => S.items.length > 0 || S.lists.length > 0, importBackup, combine, afterSync };
  Object.assign(A, { save });
})(Kyoshi, Kyoshi.apps.hawky);
