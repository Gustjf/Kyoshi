/* Hawky · lists.js — the shopping lists' model: lookups, each list's state and the changes to them (the Shopping view,
 * lists-view.js, draws them), and a ready list's errand (keepErrands). A store (vendor) and a topic make a list: one
 * list per store and topic, whatever their case, among those not done yet. Its state, worked out, never stored (stateOf):
 *   open    no lock yet: items are added, changed and taken off; then it's locked for 30 or 7 days (LOCK_DAYS), or
 *           Bought without the wait (kept as a BOUGHT_LOCK_DAYS lock unlocked early that day: done like any other);
 *   locked  until the lock runs out (the day locked + its days) unless unlocked early: items can only be taken off,
 *           and one added for its store and topic is refused;
 *   ready   items are ticked as bought (Tick all ticks the rest), and can still be added, changed or taken off;
 *   done    every item bought: the day is kept and the list folds into Done; un-ticking one there makes it ready again.
 * A list with no items left goes. Deleted lists and items stay as markers. Every change stamps the list's `u`: sync takes
 * a list whole, the later change winning (data.js). A list goes to Momo only through its errand, an errand like any other.
 * A list: { id, vendor ≤ 40, topic ≤ 40, items, lock: null | { at: "YYYY-MM-DD" (the day locked), days }, unlocked: "" or
 * the day unlocked early, done: "" or the day done, deleted, at, u }; an item: { id, text ≤ 100, note ≤ 300 (a note or
 * a web link), at (when added: its order and how long it has waited), bought: "" or the day, deleted }. Cleaning:
 * data.js. Each change returns false (changing nothing) when the list's state doesn't allow it. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { newId, addDays, daysBetween, todayStr } = K.util;
  const { LOCK_DAYS, BOUGHT_LOCK_DAYS, LIST_ERRAND, LIST_ERRAND_MINUTES, MAX_TEXT, sundayOf } = A;

  // --- Lookups ---
  const liveLists = () => S.lists.filter(l => !l.deleted);
  const listById = id => (id && S.lists.find(l => l.id === id && !l.deleted)) || null;
  // A list's items, in the order they were added.
  const liveItemsOf = l => l.items.filter(i => !i.deleted).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const itemOf = (l, id) => (l && id && l.items.find(i => i.id === id && !i.deleted)) || null;
  const keyOf = (vendor, topic) => `${vendor.toLowerCase()}\n${topic.toLowerCase()}`;

  // --- Its state ---
  const unlockDay = l => addDays(l.lock.at, l.lock.days);
  function stateOf(l, today = todayStr()) {
    if (l.done) return "done";
    if (!l.lock) return "open";
    return !l.unlocked && today < unlockDay(l) ? "locked" : "ready";
  }
  const daysLeft = (l, today = todayStr()) => daysBetween(today, unlockDay(l)); // while it's locked: 1 or more
  const canEdit = (l, today) => ["open", "ready"].includes(stateOf(l, today));

  // The lists not done yet, and the done ones, newest first.
  const activeLists = () => liveLists().filter(l => !l.done);
  const doneLists = () => liveLists().filter(l => l.done).sort((a, b) => b.done.localeCompare(a.done) || b.u - a.u || (a.id < b.id ? -1 : 1));
  // The list for a store and topic (not done), whatever their case: one that isn't locked first, should two devices
  // have each started one before they synced.
  function listFor(vendor, topic, today = todayStr()) {
    const key = keyOf(vendor, topic), same = activeLists().filter(l => keyOf(l.vendor, l.topic) === key);
    return same.find(l => stateOf(l, today) !== "locked") || same[0] || null;
  }
  // Another list (not done) a list can't be renamed to: the same store and topic, whatever their case. A done list is
  // history, so it may share them.
  const clashOf = (l, vendor, topic) => (l.done ? null : activeLists().find(o => o !== l && keyOf(o.vendor, o.topic) === keyOf(vendor, topic)) || null);

  // The stores used so far (done lists' too), A to Z, each once, as last spelled; a store's topics, the same way.
  function namesOf(lists, field) {
    const byKey = new Map();
    lists.slice().sort((a, b) => a.u - b.u).forEach(l => byKey.set(l[field].toLowerCase(), l[field]));
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
  const vendorNames = () => namesOf(liveLists(), "vendor");
  const topicNames = vendor => namesOf(liveLists().filter(l => l.vendor.toLowerCase() === vendor.toLowerCase()), "topic");

  // --- Changes: each stamps the list, keeps the errands in step and saves; the view redraws ---
  const touch = l => { l.u = Date.now(); keepErrands(); A.save(); return true; };
  const gone = l => Object.assign(l, { vendor: "", topic: "", items: [], lock: null, unlocked: "", done: "", deleted: true });
  // After an item is taken off or ticked: a list with no items left goes; a ready one is done once every item is bought
  // (that day), and a done one is ready again when one isn't.
  function settle(l, today) {
    const live = liveItemsOf(l);
    if (!live.length) return gone(l);
    if (l.done || stateOf(l, today) === "ready") l.done = live.every(i => i.bought) ? l.done || today : "";
  }

  // Adds an item (words already cleaned: vendor, topic and text not empty) to its store and topic's list, or starts that
  // list: { list, item }; or { locked: list }, adding nothing, while that list cools off.
  function addItem(vendor, topic, text, note) {
    const today = todayStr(), now = Date.now();
    let list = listFor(vendor, topic, today);
    if (list && stateOf(list, today) === "locked") return { locked: list };
    if (!list) {
      // A store already used keeps its spelling: "acme" starts a list under "Acme".
      const store = vendorNames().find(v => v.toLowerCase() === vendor.toLowerCase()) || vendor;
      list = { id: newId(), vendor: store, topic, items: [], lock: null, unlocked: "", done: "", deleted: false, at: now, u: now };
      S.lists.push(list);
    }
    const item = { id: newId(), text, note, at: now, bought: "", deleted: false };
    list.items.push(item);
    touch(list);
    return { list, item };
  }

  // Changes an item's words or note (open or ready lists).
  function editItem(l, item, text, note) {
    if (!canEdit(l)) return false;
    if (item.text === text && item.note === note) return true;
    Object.assign(item, { text, note });
    return touch(l);
  }

  // Takes an item off (open, locked or ready lists).
  function removeItem(l, item) {
    if (stateOf(l) === "done") return false;
    Object.assign(item, { text: "", note: "", bought: "", deleted: true });
    settle(l, todayStr());
    return touch(l);
  }

  // Locks an open list for days (one of LOCK_DAYS), from today.
  function lockList(l, days) {
    if (stateOf(l) !== "open" || !LOCK_DAYS.includes(days)) return false;
    Object.assign(l, { lock: { at: todayStr(), days }, unlocked: "" });
    return touch(l);
  }

  // Unlocks a locked list before its time: it's ready from today.
  function unlockEarly(l) {
    if (stateOf(l) !== "locked") return false;
    l.unlocked = todayStr();
    return touch(l);
  }

  // ✓: bought today, or not bought after all (ready or done lists).
  function tickItem(l, item, bought) {
    const today = todayStr();
    if (!["ready", "done"].includes(stateOf(l, today)) || !!item.bought === bought) return false;
    item.bought = bought ? today : "";
    settle(l, today);
    return touch(l);
  }

  // Every item not bought yet is bought on day, and the list is done that day.
  function buy(l, day) {
    liveItemsOf(l).forEach(i => { if (!i.bought) i.bought = day; });
    l.done = day;
    return touch(l);
  }

  // Tick all, or its errand's ✓: every item not bought yet is bought today, and the list is done (ready lists).
  function tickAll(l) {
    const today = todayStr();
    return stateOf(l, today) === "ready" && buy(l, today);
  }

  // Bought, without the cooling-off wait (open lists): every item bought today, the list kept as a BOUGHT_LOCK_DAYS lock
  // (one no button offers) unlocked early the same day, so it's done like any other and un-ticking an item there makes it
  // ready. It never waited, so it makes no errand (keepErrands: neverWaited).
  function buyNow(l) {
    const today = todayStr();
    if (stateOf(l, today) !== "open") return false;
    Object.assign(l, { lock: { at: today, days: BOUGHT_LOCK_DAYS }, unlocked: today });
    return buy(l, today);
  }
  const neverWaited = l => !!l.lock && l.lock.days === BOUGHT_LOCK_DAYS && l.unlocked === l.lock.at;

  // Its errand's ✓ taken back (done lists): the items bought that day aren't any more (or, should none be, those bought
  // last: the list was done by taking its last item off), and the list is ready again.
  function unbuy(l, day) {
    if (stateOf(l) !== "done") return false;
    const items = liveItemsOf(l), last = items.some(i => i.bought === day) ? day : items.reduce((d, i) => (i.bought > d ? i.bought : d), "");
    items.forEach(i => { if (i.bought === last) i.bought = ""; });
    l.done = "";
    return touch(l);
  }

  // A new store or topic (cleaned, not empty, no clash: clashOf); its items and lock stay.
  function renameList(l, vendor, topic) {
    if (clashOf(l, vendor, topic)) return false;
    if (l.vendor === vendor && l.topic === topic) return true;
    Object.assign(l, { vendor, topic });
    return touch(l);
  }

  // Deletes a list, items and all (and its errand: keepErrands).
  function deleteList(l) {
    gone(l);
    return touch(l);
  }

  // --- A ready list's errand: once a list's wait is over (its lock ran out, or Unlock early), an errand to buy it, its
  // id LIST_ERRAND + the list's id: the link, the same on every device, so two devices make one errand, not two. It
  // mirrors its list: open while the list is ready (due this Sunday again if its day has passed), done on the list's
  // done day, a marker once the list goes (one whose list is open or locked, a sync oddity, is left be); its ✓ buys the
  // list (events.js). Deleted, its marker keeps the id, so no other is made. A Bought list never waited and makes none; a
  // done list makes one only once it's ready again. Made, it's stamped u 0, "never changed": a device that hadn't synced
  // yet makes it too, and that copy mustn't outrank what was done to it elsewhere (deleted, edited, ticked); two such
  // copies settle the same way everywhere (K.util.newer). Run wherever a list can change state: each change (touch), the
  // first draw, a new day, another tab's save, sync and import; true when it changed anything (the caller saves). ---
  const listOfErrand = i => (i.id.startsWith(LIST_ERRAND) && listById(i.id.slice(LIST_ERRAND.length))) || null;
  // "Buy Running shoes at REI", cut at a word's end, with "…", past MAX_TEXT.
  function errandText(l) {
    const chars = [...`Buy ${l.topic} at ${l.vendor}`];
    if (chars.length <= MAX_TEXT) return chars.join("");
    let cut = chars.slice(0, MAX_TEXT - 1).join("");
    if (chars[MAX_TEXT - 1] !== " " && cut.lastIndexOf(" ") > 3) cut = cut.slice(0, cut.lastIndexOf(" ")); // a word cut short goes
    return `${cut.replace(/ at$/, "").trim()}…`;
  }
  function keepErrands(today = todayStr()) {
    const now = Date.now(), ids = new Set(S.items.map(i => i.id));
    let changed = false;
    activeLists().forEach(l => {
      const id = LIST_ERRAND + l.id; // ids are kept to 40 characters (data.js): a longer one, from a file, couldn't link
      if (stateOf(l, today) !== "ready" || neverWaited(l) || ids.has(id) || id.length > 40) return;
      S.items.push({ id, text: errandText(l), note: "", due: sundayOf(today), minutes: LIST_ERRAND_MINUTES, done: "", postponed: 0, deleted: false, at: now, u: 0 });
      changed = true;
    });
    S.items.forEach(i => {
      if (i.deleted || !i.id.startsWith(LIST_ERRAND)) return;
      const l = listOfErrand(i), state = l ? stateOf(l, today) : "gone";
      if (state === "gone") Object.assign(i, { text: "", note: "", due: "", done: "", postponed: 0, deleted: true });
      else if (state === "done" && i.done !== l.done) i.done = l.done;
      else if (state === "ready" && i.done) Object.assign(i, { done: "", due: i.due && i.due < today ? sundayOf(today) : i.due }); // not overdue for coming back
      else return;
      i.u = now;
      changed = true;
    });
    return changed;
  }

  Object.assign(A, {
    liveLists, listById, liveItemsOf, itemOf, unlockDay, stateOf, daysLeft, canEdit, activeLists, doneLists, clashOf,
    vendorNames, topicNames, addItem, editItem, removeItem, lockList, unlockEarly, tickItem, tickAll, buyNow, unbuy,
    renameList, deleteList, listOfErrand, keepErrands
  });
})(Kyoshi, Kyoshi.apps.hawky);
