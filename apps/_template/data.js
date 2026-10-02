/* Template · data.js — the app's saved data: loading, cleaning, saving, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use. Storage keys (A.store): items, sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isPos, newId } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_TEXT } = A;

  const persist = () => A.store.set("items", JSON.stringify(S.items));

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // Saved or imported items in the current shape; anything unusable is dropped, so a
  // damaged file can't break the app.
  function cleanItems(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(i => ({
      id: typeof i.id === "string" && i.id ? i.id.slice(0, 40) : newId(),
      text: typeof i.text === "string" ? i.text.trim().slice(0, MAX_TEXT) : "",
      deleted: i.deleted === true,
      at: isPos(i.at) ? i.at : 0, // when it was added: the list's order
      u: isPos(i.u) ? i.u : 0
    })).filter(i => (i.text || i.deleted) && !ids.has(i.id) && ids.add(i.id));
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    S.items = cleanItems(A.store.json("items"));
  }

  const looksLike = raw => Array.isArray(raw.items);

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, items: S.items };
  }

  // Replaces everything with the backup's items, asking first (unless ask is false:
  // Import all already did) if there's anything to lose. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) return alert("That file doesn't look like a Template backup.");
    const items = cleanItems(raw.items);
    if (ask && A.liveItems().length && !confirm("Replace everything in Template with this backup? This can't be undone.")) return;
    S.items = items;
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // A save from the sync folder (see core/sync.js): taken whole, or combined with ours item by
  // item, the later change winning, in the order they were added. The same on every device,
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
})(Kyoshi, Kyoshi.apps.template);
