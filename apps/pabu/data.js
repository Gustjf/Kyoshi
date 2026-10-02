/* Pabu · data.js — the app's saved data: loading, cleaning, saving, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use. Storage keys (A.store): people, sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId, daysInMonth } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_NAME, MAX_NOTE, MAX_TALKS, DEFAULT_EVERY, DEFAULT_HOW, cleanLine, cleanText, cleanMinutes, plural } = A;

  const MAX_MS = 8.64e15; // the last moment a date can hold
  const persist = () => A.store.set("people", JSON.stringify(S.people));

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // How often and how as kept: any short id, so a newer version's own survives a round trip through this one (everyOf and
  // howOf read it as every month and a call), else the defaults.
  const isKey = v => typeof v === "string" && /^[a-z0-9]{1,12}$/.test(v);

  // The days you talked: real days only, each once, newest first, at most MAX_TALKS. Days after today are kept (another
  // device's clock may be ahead), but lastTalk never counts them.
  const cleanTalks = list => [...new Set((Array.isArray(list) ? list : []).filter(isDate))].sort().reverse().slice(0, MAX_TALKS);

  // A birthday as kept: "" for none, a whole date ("1966-10-12"), or a month and day ("10-12"; Feb 29 is fine).
  function cleanBirthday(b) {
    if (isDate(b)) return b;
    const m = typeof b === "string" ? /^(\d{2})-(\d{2})$/.exec(b) : null, month = m ? +m[1] : 0;
    return month >= 1 && month <= 12 && +m[2] >= 1 && +m[2] <= daysInMonth(2000, month) ? b : ""; // 2000: a leap year
  }

  // Saved or imported people in the current shape; anything unusable is dropped, so a damaged file
  // can't break the app. A deleted one keeps only what sync needs.
  function cleanPeople(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(p => {
      const gone = p.deleted === true, how = isKey(p.how) ? p.how : DEFAULT_HOW;
      return {
        id: typeof p.id === "string" && p.id ? p.id.slice(0, 40) : newId(),
        name: gone ? "" : cleanLine(p.name, MAX_NAME),
        every: isKey(p.every) ? p.every : DEFAULT_EVERY,
        how,
        minutes: cleanMinutes(p.minutes, how),
        talks: gone ? [] : cleanTalks(p.talks),
        note: gone ? "" : cleanText(p.note, MAX_NOTE),
        birthday: gone ? "" : cleanBirthday(p.birthday),
        deleted: gone,
        at: isPos(p.at) && p.at < MAX_MS ? p.at : 0, // when they were added: due that day until you first talk
        u: isPos(p.u) ? p.u : 0
      };
    }).filter(p => (p.name || p.deleted) && !ids.has(p.id) && ids.add(p.id));
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    S.people = cleanPeople(A.store.json("people"));
  }

  // A Pabu backup or sync file: its people each have a name, unless deleted.
  const looksLike = raw => Array.isArray(raw.people) && raw.people.every(p => !isObj(p) || p.deleted === true || typeof p.name === "string");

  function buildBackup() {
    return { schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, people: S.people };
  }

  // Replaces everyone with the backup's people, after checking it has some (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anyone
  // to lose. True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) {
      alert("That file doesn't look like a Pabu backup.");
      return false;
    }
    const people = cleanPeople(raw.people), count = n => plural(n, "person", "people");
    const mine = A.live().length, theirs = people.filter(p => !p.deleted).length;
    if (!theirs) {
      alert("That backup has no people in it, so nothing was changed.");
      return false;
    }
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Pabu. Importing it anyway, but some data may not carry over.");
    }
    if (ask && mine && !K.backup.ask(A, raw, `Replace your ${count(mine)} with the ${count(theirs)} in this backup?`)) return false;
    S.people = people;
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // A save from the sync folder (see core/sync.js): taken whole, or combined with ours person by
  // person, the later change winning, in the order they were added. The same on every device,
  // so two combining at once agree.
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  function combine(raw, { replace, plain }) {
    const their = cleanPeople(raw.people);
    if (plain && !their.length) return null;
    const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
    const byId = new Map(S.people.map(p => [p.id, p]));
    if (!replace) their.forEach(p => { const o = byId.get(p.id); if (!o || newer(p, o)) byId.set(p.id, p); });
    const next = replace ? their : inOrder([...byId.values()]);
    const key = list => JSON.stringify(inOrder(list));
    return {
      same: key(next) === key(their),
      apply() {
        if (key(next) === key(S.people)) return false; // nothing new here
        S.people = next;
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
  A.data = { schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike, hasData: () => S.people.length > 0, importBackup, combine, afterSync };
  Object.assign(A, { save });
})(Kyoshi, Kyoshi.apps.pabu);
