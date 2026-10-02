/* Hawky · data.js — the app's saved data: loading, cleaning, saving, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use. Storage keys (A.store): items, sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_TEXT, cleanLine, cleanMinutes } = A;

  const MAX_MS = 8.64e15; // the last moment a date can hold
  const persist = () => A.store.set("items", JSON.stringify(S.items));

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
        due: !gone && isDate(i.due) ? i.due : "",     // the day it's due, "" for none
        minutes: cleanMinutes(i.minutes),
        done: !gone && isDate(i.done) ? i.done : "",  // the day it was ticked, "" while open
        deleted: gone,
        at: isPos(i.at) && i.at < MAX_MS ? i.at : 0, // when it was added: the order of the undated, and Momo's "added" day
        u: isPos(i.u) ? i.u : 0
      };
    }).filter(i => (i.text || i.deleted) && !ids.has(i.id) && ids.add(i.id));
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    S.items = cleanItems(A.store.json("items"));
  }

  // A Hawky backup or sync file: its items are errands, each with its text unless deleted. Another app's
  // list of items (Wan Shi Tong's recommendations have names) isn't one.
  const looksLike = raw => Array.isArray(raw.items) && raw.items.every(i => !isObj(i) || i.deleted === true || typeof i.text === "string");

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, items: S.items };
  }

  // Replaces everything with the backup's errands, after checking it has some (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anything
  // to lose. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) return alert("That file doesn't look like a Hawky backup.");
    const items = cleanItems(raw.items), count = n => `${n} errand${n === 1 ? "" : "s"}`;
    const mine = A.live().length, theirs = items.filter(i => !i.deleted).length;
    if (raw.items.length && !theirs) return alert("That backup has no errands in it, so nothing was changed.");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Hawky. Importing it anyway, but some data may not carry over.");
    }
    if (ask && mine && !K.backup.ask(A, raw, `Replace your ${count(mine)} with the ${count(theirs)} in this backup?`)) return;
    S.items = items;
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // A save from the sync folder (see core/sync.js): taken whole, or combined with ours errand by
  // errand, the later change winning, in the order they were added. The same on every device,
  // so two combining at once agree.
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  function combine(raw, { replace, plain }) {
    const their = cleanItems(raw.items);
    if (plain && !their.length) return null;
    const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
    const byId = new Map(S.items.map(i => [i.id, i]));
    if (!replace) their.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
    const next = replace ? their : inOrder([...byId.values()]);
    const key = list => JSON.stringify(inOrder(list));
    return {
      same: key(next) === key(their),
      apply() {
        if (key(next) === key(S.items)) return false; // nothing new here
        S.items = next;
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
  A.data = { schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike, hasData: () => S.items.length > 0, importBackup, combine, afterSync };
  Object.assign(A, { save });
})(Kyoshi, Kyoshi.apps.hawky);
