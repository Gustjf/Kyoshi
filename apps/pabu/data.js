/* Pabu · data.js — the app's saved data: loading, cleaning, saving, backups, and combining
 * with other devices' saves. A.data is the adapter core/backup.js (Export/Import JSON) and
 * core/sync.js (folder sync) use. Storage keys (A.store): people, sync and meetings (core's). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId, daysInMonth, mergeById } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_NAME, MAX_GROUP, MAX_NOTE, MAX_CADENCES, MAX_TALKS, DEFAULT_EVERY, DEFAULT_HOW, cleanLine, cleanText, cleanMinutes, plural } = A;

  const MAX_MS = 8.64e15; // the last moment a date can hold
  const persist = () => A.store.set("people", JSON.stringify(S.people));

  // Keeps a change made on this device: stored locally, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // How often and how as kept: any short id, so a newer version's own survives a round trip through this one (everyOf and
  // howOf read it as every month and a call), else the defaults. A call, text or visit's own id is one too.
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

  const cleanAt = v => (isPos(v) && v < MAX_MS ? v : 0);

  // A person's calls, texts and visits: at most MAX_CADENCES, each with an id of its own (one missing, or already
  // used, gets the first free of c1, c2…: the same on every device). Before there were several (schemaVersion 1),
  // a person had one, its how often, how, minutes and days at the top: that one becomes their only one, "c1" (none
  // when it was birthday only).
  function cleanCadences(p, at) {
    const list = Array.isArray(p.cadences) ? p.cadences.filter(c => isObj(c) && c.every !== "none")
      : p.cadences !== undefined || p.every === "none" ? [] : [{ id: "c1", every: p.every, how: p.how, minutes: p.minutes, talks: p.talks }];
    const own = new Set(list.map(c => c.id).filter(isKey)), ids = new Set();
    return list.slice(0, MAX_CADENCES).map(c => {
      let id = isKey(c.id) && !ids.has(c.id) ? c.id : "";
      for (let n = 1; !id; n++) if (!own.has(`c${n}`) && !ids.has(`c${n}`)) id = `c${n}`;
      ids.add(id);
      const how = isKey(c.how) ? c.how : DEFAULT_HOW;
      return {
        id,
        every: isKey(c.every) ? c.every : DEFAULT_EVERY,
        how,
        minutes: cleanMinutes(c.minutes, how),
        talks: cleanTalks(c.talks),
        at: cleanAt(c.at) || at // when it was added: due that day until you first talk (the person's, carried over)
      };
    });
  }

  // Saved or imported people in the current shape; anything unusable is dropped, so a damaged file
  // can't break the app. A deleted one keeps only what sync needs.
  function cleanPeople(list) {
    const ids = new Set();
    return (Array.isArray(list) ? list : []).filter(isObj).map(p => {
      const gone = p.deleted === true, at = cleanAt(p.at);
      return {
        id: typeof p.id === "string" && p.id ? p.id.slice(0, 40) : newId(),
        name: gone ? "" : cleanLine(p.name, MAX_NAME),
        group: gone ? "" : cleanLine(p.group, MAX_GROUP),
        note: gone ? "" : cleanText(p.note, MAX_NOTE),
        birthday: gone ? "" : cleanBirthday(p.birthday),
        cadences: gone ? [] : cleanCadences(p, at),
        deleted: gone,
        at, // when they were added
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
    const next = replace ? their : inOrder(mergeById(S.people, their)); // each person's later change (K.util)
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
