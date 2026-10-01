/* Wan Shi Tong · data.js — the saved data: loading, cleaning, saving, backups, and combining with
 * other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js
 * (folder sync) use. Storage keys (A.store): items, slots, folded (this device's own, never
 * synced or backed up), sync (core's). */
(function (K, A) {
  "use strict";
  // Categories that were merged or removed: novels and textbooks are books now; courses (removed) show as Other.
  const OLD_CATS = { novel: "book", textbook: "book", elearning: "other", inperson: "other" };
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { HAVE, SLOTS, MAX_NAME, MAX_INFO, MAX_WHY, DATA_SCHEMA_VERSION } = A;

  const persist = () => {
    A.store.set("items", JSON.stringify(S.items));
    A.store.set("slots", JSON.stringify(S.slots));
  };

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // Which backlog groups are folded away on this device.
  const storeFolded = () => A.store.set("folded", JSON.stringify(S.folded));

  // Text as it's kept: trimmed, and cut to max characters without splitting an emoji. A line
  // (a name or info) also turns runs of spaces and line breaks into one space.
  const cleanText = (v, max) => (typeof v === "string" ? [...v.trim()].slice(0, max).join("").trim() : "");
  const cleanLine = (v, max) => cleanText(typeof v === "string" ? v.replace(/\s+/g, " ") : "", max);

  // Saved or imported items in the current shape; anything unusable is dropped, so a damaged
  // file can't break the app. A category from a newer version is kept as it is (shown as Other).
  function cleanItems(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(i => {
      const gone = i.deleted === true; // a marker keeps only what sync needs
      return {
        id: typeof i.id === "string" && i.id ? i.id.slice(0, 40) : newId(),
        cat: typeof i.cat === "string" && /^[a-z0-9-]{1,20}$/.test(i.cat) ? (Object.hasOwn(OLD_CATS, i.cat) ? OLD_CATS[i.cat] : i.cat) : A.OTHER.id,
        name: gone ? "" : cleanLine(i.name, MAX_NAME),
        info: gone ? "" : cleanLine(i.info, MAX_INFO),
        have: !gone && Object.hasOwn(HAVE, i.have) ? i.have : "",
        why: gone ? "" : cleanText(i.why, MAX_WHY),
        added: isDate(i.added) ? i.added : "",
        started: !gone && isDate(i.started) ? i.started : "",
        done: !gone && isDate(i.done) ? i.done : "",
        deleted: gone,
        at: isPos(i.at) ? i.at : 0, // when it was added, to the moment
        u: isPos(i.u) ? i.u : 0     // when it last changed (the later change wins in sync)
      };
    }).filter(i => (i.name || i.deleted) && !ids.has(i.id) && ids.add(i.id));
  }

  // In progress's spots and Up next from storage or a backup: { id, u } each. Data from before
  // 2.000 has only now and next, so the other spots start out free.
  const cleanSlot = s => ({ id: isObj(s) && typeof s.id === "string" ? s.id.slice(0, 40) : "", u: isObj(s) && isPos(s.u) ? s.u : 0 });
  const cleanSlots = s => Object.fromEntries(SLOTS.map(k => [k, cleanSlot(isObj(s) && s[k])]));

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    S.items = cleanItems(A.store.json("items"));
    S.slots = cleanSlots(A.store.json("slots"));
    const folded = A.store.json("folded");
    S.folded = Array.isArray(folded) ? folded.filter(c => typeof c === "string") : [];
  }

  // ==========================================================================
  // BACKUPS (Export / Import JSON)
  // ==========================================================================
  const looksLike = raw => Array.isArray(raw.items);

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, items: S.items, slots: S.slots };
  }

  // Replaces everything with the backup's, after checking it can be read (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did).
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) return alert("That file doesn't look like a Wan Shi Tong backup.");
    const items = cleanItems(raw.items);
    if (raw.items.length && !items.length) return alert("That backup has no recommendations Wan Shi Tong can read.");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Wan Shi Tong. Importing it anyway, but some data may not carry over.");
    }
    const count = n => `${n} recommendation${n === 1 ? "" : "s"}`;
    const mine = A.live().length, theirs = items.filter(i => !i.deleted).length;
    if (ask && mine && !confirm(`Replace your ${count(mine)} with the ${count(theirs)} in this backup? This can't be undone.`)) return;
    S.items = items;
    S.slots = cleanSlots(raw.slots);
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // A save from the sync folder: taken whole, or combined with ours item by item and spot by
  // spot, the later change winning. The same on every device, so two combining at once agree.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const dataKey = d => JSON.stringify([inOrder(d.items), SLOTS.map(k => d.slots[k])]);
  function combine(raw, { replace, plain }) {
    const their = { items: cleanItems(raw.items), slots: cleanSlots(raw.slots) };
    if (plain && !their.items.length) return null;
    let next = their;
    if (!replace) {
      const byId = new Map(S.items.map(i => [i.id, i]));
      their.items.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
      const slot = k => (newer(their.slots[k], S.slots[k]) ? their.slots[k] : S.slots[k]);
      next = { items: inOrder([...byId.values()]), slots: Object.fromEntries(SLOTS.map(k => [k, slot(k)])) };
    }
    return {
      same: dataKey(next) === dataKey(their),
      apply() {
        if (dataKey(next) === dataKey(S)) return false; // nothing new here
        S.items = next.items;
        S.slots = next.slots;
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
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION,
    build: buildBackup,
    looksLike,
    hasData: () => S.items.length > 0,
    importBackup, combine, afterSync
  };
  Object.assign(A, { save, storeFolded, cleanText, cleanLine });
})(Kyoshi, Kyoshi.apps.wanshitong);
