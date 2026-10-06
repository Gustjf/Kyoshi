/* Hawky · lists-view.js — the Shopping view (lists.js has the model): the add row (store and topic, each suggesting
 * what's been used, the item, + Note or link; Add puts the item on that store and topic's list or starts one, and keeps
 * the store and topic for the next, until another store is typed, which clears that topic; a locked list's is refused),
 * then the lists by store (stores A to Z, topics A to Z; each store in its own colour, given by the order stores were
 * first used: a dot by its name, the left edge of its lists, done ones' too), each a card: its topic,
 * how many items and its state, Rename, its items (✓ once it's ready, ✕ to take one off, how long each has waited, its
 * note, a web link in it opening with a tap) and its state's buttons (Lock 30 days / Lock 7 days · Unlock early, in
 * amber, after a warning · Tick all); then the Done fold, newest first. The pop-ups: a list's (Rename: store and topic;
 * Delete list) and an item's (its words and note, while the list is open or ready; Remove). renderLists is called by
 * renderAll (render.js); wireLists by A.init (events.js). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr } = K.util;
  const { MAX_VENDOR, MAX_TOPIC, MAX_ITEM, MAX_ITEM_NOTE, LOCK_DAYS, DONE_PAGE, cleanLine, cleanText, fmtDay, dayWords, waited } = A;

  // The "check" icon from Lucide (ISC license), in the ✓ button's circle (as render.js's).
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

  // Each store's own colour (a dot by its name, an edge on its lists), worked out, never stored. Twelve, read on dark and
  // light, the most different first (blue, orange, green, pink, gold, violet, then teal, red, sky, lime, magenta, brown),
  // given in the order stores were first used (each store's oldest list, done ones too), so a store keeps its colour as
  // new ones come, every device agrees, and no two share one until there are more than twelve.
  const STORE_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#ec4899", "#d4a017", "#8b5cf6", "#14b8a6", "#ef4444", "#38bdf8", "#a3e635", "#c026d3", "#a16207"];
  // { store in lower case → its colour }, for every list there is.
  function storeColors() {
    const first = new Map();
    A.liveLists().forEach(l => { const k = l.vendor.toLowerCase(); if (!first.has(k) || l.at < first.get(k)) first.set(k, l.at); });
    return new Map([...first].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map(([k], i) => [k, STORE_COLORS[i % STORE_COLORS.length]]));
  }

  // A note as HTML: its web addresses (http and https only) as links showing the site's name, less the punctuation
  // after one (as in Appa's notes); the rest as text.
  const count = (s, ch) => s.split(ch).length - 1;
  function site(u) {
    try { return new URL(u).hostname.replace(/^www\./, "") || u; } catch (err) { return u; }
  }
  const noteHTML = s => s.split(/(https?:\/\/[^\s<]+)/).map((part, i) => {
    if (i % 2 === 0) return esc(part); // text between the addresses
    let u = part;
    while (/[.,;:!?'">\]]$/.test(u) || (u.endsWith(")") && count(u, ")") > count(u, "("))) u = u.slice(0, -1);
    return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(site(u))}</a>${esc(part.slice(u.length))}`;
  }).join("");

  // A list's state in words: "open", "locked · 18 days", "ready", "done Oct 3".
  function stateWords(l, state, today) {
    if (state === "locked") return `locked · ${plural(A.daysLeft(l, today), "day")}`;
    return state === "done" ? `done ${dayWords(l.done, today)}` : state;
  }

  // --- Drawing ---
  // One item: ✓ (ready and done lists: filled once bought, and tapping it again undoes), its words (open and ready
  // lists: they open its pop-up), how long it has waited (or the day it was bought), its note, and ✕ (all but done).
  function itemHTML(l, i, state, today) {
    const ids = `data-list="${esc(l.id)}" data-item="${esc(i.id)}"`, when = i.bought ? `Bought ${dayWords(i.bought, today)}` : cap(waited(i.at, today));
    const tick = i.bought ? "Not bought yet" : "Bought";
    return `<li class="sitem${i.bought ? " bought" : ""}">` +
      (state === "ready" || state === "done" ? `<button type="button" class="tick" data-act="item-tick" ${ids} title="${tick}" aria-label="${tick}: ${esc(i.text)}"><span class="box">${CHECK}</span></button>` : "") +
      `<div class="sitem-main">` +
      (state === "open" || state === "ready" ? `<button type="button" class="sitem-text" data-act="item-edit" ${ids}>${esc(i.text)}</button>` : `<span class="sitem-text">${esc(i.text)}</span>`) +
      (when ? `<span class="sitem-meta">${esc(when)}</span>` : "") +
      (i.note ? `<div class="sitem-note">${noteHTML(i.note)}</div>` : "") + `</div>` +
      (state !== "done" ? `<button type="button" class="sitem-x" data-act="item-remove" ${ids} title="Take it off" aria-label="Take off: ${esc(i.text)}">&times;</button>` : "") +
      `</li>`;
  }

  // One list as a card, edged in its store's colour (colors: storeColors()): "Gifts · 3 items · locked · 18 days" and
  // Rename, its items, then its state's buttons. In the Done fold it names its store too.
  function cardHTML(l, today, colors) {
    const state = A.stateOf(l, today), items = A.liveItemsOf(l), id = `data-list="${esc(l.id)}"`;
    let actions = "";
    if (state === "open") actions = LOCK_DAYS.map((d, k) => `<button type="button"${k ? ' class="secondary"' : ""} data-act="list-lock" ${id} data-days="${d}">Lock ${d} days</button>`).join("");
    if (state === "locked") actions = `<span class="slist-lock">Unlocks ${esc(dayWords(A.unlockDay(l), today))}</span><button type="button" class="warn-btn" data-act="list-unlock" ${id}>Unlock early</button>`;
    if (state === "ready") actions = `<button type="button" data-act="list-tickall" ${id}>Tick all</button>`;
    return `<div class="slist ${state}" data-id="${esc(l.id)}" style="--store:${colors.get(l.vendor.toLowerCase())}">` +
      `<div class="slist-head"><span class="slist-topic">${esc(l.topic)}${state === "done" ? `<span class="slist-vendor"> · ${esc(l.vendor)}</span>` : ""}</span>` +
      `<span class="slist-meta">${plural(items.length, "item")} · <span class="slist-state">${esc(stateWords(l, state, today))}</span></span>` +
      `<button type="button" class="secondary small" data-act="list-rename" ${id}>Rename</button></div>` +
      `<ul class="sitems">${items.map(i => itemHTML(l, i, state, today)).join("")}</ul>` +
      (actions ? `<div class="slist-actions">${actions}</div>` : "") + `</div>`;
  }

  // The add row: the stores used so far, that store's topics, and the note line once + Note or link is tapped.
  const options = names => names.map(n => `<option value="${esc(n)}"></option>`).join("");
  const renderTopics = () => { $("hawkyTopics").innerHTML = options(A.topicNames(cleanLine($("listVendor").value, MAX_VENDOR))); };
  function renderListAdd() {
    $("hawkyVendors").innerHTML = options(A.vendorNames());
    renderTopics();
    $("listNote").hidden = !S.listNote;
    $("listNoteBtn").hidden = S.listNote;
  }

  // The view: the add row, the lists not done by store (named as its last changed list spells it), and the Done fold
  // (DONE_PAGE at a time).
  function renderLists(today = todayStr()) {
    renderListAdd();
    const active = A.activeLists(), stores = new Map(), colors = storeColors();
    active.forEach(l => { const k = l.vendor.toLowerCase(); stores.set(k, (stores.get(k) || []).concat(l)); });
    const groups = [...stores.values()].map(ls => ({ name: ls.reduce((a, b) => (b.u > a.u ? b : a)).vendor, lists: ls.sort((a, b) => byName(a.topic, b.topic) || a.at - b.at) }))
      .sort((a, b) => byName(a.name, b.name));
    const items = active.reduce((n, l) => n + A.liveItemsOf(l).length, 0);
    $("listsEmpty").hidden = active.length > 0;
    $("listsCount").textContent = active.length ? `${active.length} · ${plural(items, "item")}` : "";
    $("vendors").innerHTML = groups.map(g => `<div class="vendor" style="--store:${colors.get(g.name.toLowerCase())}"><h3 class="vendor-name">${esc(g.name)}</h3>${g.lists.map(l => cardHTML(l, today, colors)).join("")}</div>`).join("");
    const done = A.doneLists(), shown = done.slice(0, S.listsDoneShown);
    $("listsDoneSection").hidden = !done.length;
    $("listsDoneCount").textContent = `(${done.length})`;
    $("listsDone").innerHTML = shown.map(l => cardHTML(l, today, colors)).join("");
    $("listsDoneMore").hidden = shown.length >= done.length;
    $("listsDoneMore").textContent = `Show ${Math.min(DONE_PAGE, done.length - shown.length)} more`;
  }

  // --- The add row ---
  function setStatus(text, bad = false) {
    $("listStatus").textContent = text;
    $("listStatus").classList.toggle("bad", bad);
  }

  // Add (or Enter): an empty box gets the focus first (so Enter moves on from the store to the topic to the item); then
  // the item goes on its list, the item and note clear, and the store and topic stay for the next one (S.listLast).
  function add() {
    const vendor = cleanLine($("listVendor").value, MAX_VENDOR), topic = cleanLine($("listTopic").value, MAX_TOPIC);
    const text = cleanLine($("listItem").value, MAX_ITEM), note = S.listNote ? cleanText($("listNote").value, MAX_ITEM_NOTE) : "";
    const empty = [["listVendor", vendor], ["listTopic", topic], ["listItem", text]].find(([, v]) => !v);
    if (empty) return $(empty[0]).focus();
    const r = A.addItem(vendor, topic, text, note);
    if (r.locked) return setStatus(`The ${r.locked.topic} list at ${r.locked.vendor} is locked until ${fmtDay(A.unlockDay(r.locked))}, so nothing was added.`, true);
    S.listLast = { vendor: r.list.vendor, topic: r.list.topic };
    S.listNote = false;
    ["listItem", "listNote"].forEach(id => { $(id).value = ""; });
    A.renderAll();
    setStatus(`Added “${text}” to ${r.list.topic} at ${r.list.vendor}.`);
    $("listItem").focus();
  }

  // Another store typed after an add: the topic kept from that add goes, so the new store starts with a fresh topic.
  // Once only: a topic typed since stays, and typing the same store back brings nothing back.
  function storeTyped() {
    const last = S.listLast, vendor = cleanLine($("listVendor").value, MAX_VENDOR).toLowerCase();
    if (!last.topic || vendor === last.vendor.toLowerCase() || cleanLine($("listTopic").value, MAX_TOPIC).toLowerCase() !== last.topic.toLowerCase()) return;
    $("listTopic").value = "";
    last.topic = "";
  }

  // --- A list's pop-up (Rename) ---
  const listOverlay = () => $("listOverlay");
  const listState = () => JSON.stringify(["listEditVendor", "listEditTopic"].map(id => $(id).value));
  const closeListEditor = () => K.modal.dismiss(listOverlay());

  function openListEditor(l) {
    const state = A.stateOf(l);
    S.listEditing = { id: l.id };
    $("listEditVendor").value = l.vendor;
    $("listEditTopic").value = l.topic;
    $("listEditHint").textContent = `${plural(A.liveItemsOf(l).length, "item")} · ${state === "locked" ? `locked until ${fmtDay(A.unlockDay(l))}` : stateWords(l, state, todayStr())}. Its items stay as they are.`;
    S.listEditing.snapshot = listState();
    K.modal.open(listOverlay());
  }

  // The list as S.listEditing names it, or null (after saying so) once it's gone.
  function editedList(what) {
    const l = S.listEditing && A.listById(S.listEditing.id);
    if (!l) {
      closeListEditor();
      A.renderAll();
      alert(`That list was deleted on another device, so ${what}.`);
    }
    return l;
  }

  function saveListEditor() {
    if (!S.listEditing) return;
    const l = editedList("nothing was saved");
    if (!l) return;
    const vendor = cleanLine($("listEditVendor").value, MAX_VENDOR), topic = cleanLine($("listEditTopic").value, MAX_TOPIC);
    if (!vendor) { $("listEditVendor").focus(); return alert("Which store is it?"); }
    if (!topic) { $("listEditTopic").focus(); return alert("What's its topic?"); }
    const clash = A.clashOf(l, vendor, topic);
    if (clash) { $("listEditTopic").focus(); return alert(`You already have a ${clash.topic} list at ${clash.vendor}.`); }
    A.renameList(l, vendor, topic);
    closeListEditor();
    A.renderAll();
  }

  function deleteFromEditor() {
    if (!S.listEditing) return;
    const l = editedList("there's nothing to delete");
    if (!l) return;
    const n = A.liveItemsOf(l).length;
    if (!confirm(`Delete the ${l.topic} list at ${l.vendor}${n ? `, with its ${plural(n, "item")}` : ""}? This can't be undone.`)) return;
    A.deleteList(l);
    closeListEditor();
    A.renderAll();
  }

  // --- An item's pop-up ---
  const itemOverlay = () => $("itemOverlay");
  const itemState = () => JSON.stringify(["itemText", "itemNote"].map(id => $(id).value));
  const closeItemEditor = () => K.modal.dismiss(itemOverlay());

  function openItemEditor(l, i) {
    if (!A.canEdit(l)) return;
    S.itemEditing = { listId: l.id, id: i.id };
    $("itemText").value = i.text;
    $("itemNote").value = i.note;
    S.itemEditing.snapshot = itemState();
    K.modal.open(itemOverlay());
  }

  // The list and item as S.itemEditing names them, or null (after saying so) once the item is gone.
  function editedItem(what) {
    const e = S.itemEditing, l = e && A.listById(e.listId), i = A.itemOf(l, e && e.id);
    if (!i) {
      closeItemEditor();
      A.renderAll();
      alert(`That item was taken off on another device, so ${what}.`);
      return null;
    }
    return { l, i };
  }

  function saveItemEditor() {
    if (!S.itemEditing) return;
    const got = editedItem("nothing was saved");
    if (!got) return;
    const text = cleanLine($("itemText").value, MAX_ITEM), note = cleanText($("itemNote").value, MAX_ITEM_NOTE);
    if (!text) { $("itemText").focus(); return alert("Say what the item is."); }
    const ok = A.editItem(got.l, got.i, text, note);
    closeItemEditor();
    A.renderAll();
    if (!ok) alert("That list is locked now, so nothing was changed.");
  }

  function removeFromEditor() {
    if (!S.itemEditing) return;
    const got = editedItem("there's nothing to take off");
    if (!got || !confirm(`Take “${got.i.text}” off this list?`)) return;
    A.removeItem(got.l, got.i);
    closeItemEditor();
    A.renderAll();
  }

  // --- Taps on the lists: buttons carry data-act, data-list and (an item's) data-item ---
  const ACTS = {
    "list-lock": (l, btn) => A.lockList(l, +btn.dataset.days),
    "list-unlock": l => confirm(`This list cools off until ${fmtDay(A.unlockDay(l))}. Unlock it anyway?`) && A.unlockEarly(l),
    "list-tickall": l => {
      const n = A.liveItemsOf(l).filter(i => !i.bought).length;
      return confirm(`Tick ${n === 1 ? "the last item" : `all ${n} items`} as bought? The list moves to Done.`) && A.tickAll(l);
    },
    "list-rename": l => openListEditor(l),
    "item-tick": (l, btn, i) => A.tickItem(l, i, !i.bought),
    "item-edit": (l, btn, i) => openItemEditor(l, i),
    "item-remove": (l, btn, i) => confirm(`Take “${i.text}” off this list?`) && A.removeItem(l, i)
  };
  function onTap(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn || !ACTS[btn.dataset.act]) return;
    const l = A.listById(btn.dataset.list), i = btn.dataset.item ? A.itemOf(l, btn.dataset.item) : null;
    if (l && (i || !btn.dataset.item)) ACTS[btn.dataset.act](l, btn, i);
    A.renderAll();
  }

  // Esc, × and a click beside a pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
  function wireLists() {
    K.modal.define(listOverlay(), {
      dismiss: () => { K.modal.close(listOverlay()); S.listEditing = null; },
      pending: () => !!S.listEditing && listState() !== S.listEditing.snapshot,
      ask: "Discard your changes to this list?"
    });
    K.modal.define(itemOverlay(), {
      dismiss: () => { K.modal.close(itemOverlay()); S.itemEditing = null; },
      pending: () => !!S.itemEditing && itemState() !== S.itemEditing.snapshot,
      ask: "Discard your changes to this item?"
    });
    $("listForm").addEventListener("submit", e => { e.preventDefault(); add(); });
    // Tapping + Note or link or Add doesn't take the focus, so the phone's keyboard stays up while typing.
    $("listForm").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    $("listForm").addEventListener("input", e => { setStatus(""); if (e.target.id === "listVendor") { storeTyped(); renderTopics(); } });
    $("listNoteBtn").addEventListener("click", () => { S.listNote = true; renderListAdd(); $("listNote").focus(); });
    $("listsView").addEventListener("click", onTap);
    $("listsDoneMore").addEventListener("click", () => { S.listsDoneShown += DONE_PAGE; A.renderAll(); });
    // Enter in a field saves, as Save does (in a note it starts a new line).
    $("listEditForm").addEventListener("submit", e => { e.preventDefault(); saveListEditor(); });
    $("listEditCancelBtn").addEventListener("click", closeListEditor);
    $("listDeleteBtn").addEventListener("click", deleteFromEditor);
    $("itemForm").addEventListener("submit", e => { e.preventDefault(); saveItemEditor(); });
    $("itemCancelBtn").addEventListener("click", closeItemEditor);
    $("itemRemoveBtn").addEventListener("click", removeFromEditor);
  }

  Object.assign(A, { renderLists, wireLists });
})(Kyoshi, Kyoshi.apps.hawky);
