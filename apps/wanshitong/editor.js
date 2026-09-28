/* Wan Shi Tong · editor.js — the add / edit pop-up (#itemOverlay): category, name, info, Have it?,
 * cost (courses only), why it's here and, when editing, its dates. Add, Add another (keeps the
 * pop-up open for the next one), Save and Delete. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isDate, todayStr, newId, readNumber } = K.util;
  const { CATS, MAX_NAME, MAX_INFO, MAX_WHY, MAX_COST, catOf, haveChoices, fmtDay } = A;

  const overlay = () => $("itemOverlay");
  const FIELDS = ["itemName", "itemInfo", "itemCost", "itemWhy", "itemAdded", "itemDone"];
  // What the pop-up holds, to tell whether closing it would lose something.
  const formState = () => JSON.stringify(FIELDS.map(id => $(id).value).concat(S.editing.cat, S.editing.have));

  // Esc, × and a click beside the pop-up ask first if something was typed (core/modal.js); Cancel doesn't.
  function defineEditor() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard what you've entered?"
    });
  }
  const closeEditor = () => K.modal.dismiss(overlay());

  function setStatus(text) {
    $("itemStatus").textContent = text;
    $("itemStatus").className = `modal-status${text ? " good" : ""}`;
  }

  // The "Have it?" choice, if the category offers it (switching categories keeps the pick for when it's back).
  const offered = e => (haveChoices(e.cat).some(([h]) => h === e.have) ? e.have : "");

  // Everything that depends on the category: its pill, what the info field asks for, the
  // "Have it?" choices, and the cost field (courses).
  function renderCatFields() {
    const e = S.editing, c = catOf(e.cat);
    $("itemCats").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.cat === e.cat));
    $("itemInfoLabel").textContent = c.info;
    $("itemName").placeholder = c.nameEg ? `e.g. ${c.nameEg}` : "";
    $("itemInfo").placeholder = c.infoEg ? `e.g. ${c.infoEg}` : "";
    $("itemHave").innerHTML = [["", "Not yet"]].concat(haveChoices(e.cat))
      .map(([h, label]) => `<button type="button" class="pill" data-have="${h}">${esc(label)}</button>`).join("");
    renderHave();
    $("itemCostField").hidden = !c.cost;
  }
  const renderHave = () => {
    const have = offered(S.editing);
    $("itemHave").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.have === have));
  };

  // Opens the pop-up to add a recommendation (id null), or to edit one.
  function openEditor(id) {
    const i = id ? A.itemById(id) : null;
    if (id && !i) return;
    S.editing = { id: i ? i.id : null, cat: i ? i.cat : S.lastCat || CATS[0].id, have: i ? i.have : "" };
    $("itemModalTitle").textContent = i ? "Edit recommendation" : "Add a recommendation";
    $("itemName").value = i ? i.name : "";
    $("itemInfo").value = i ? i.info : "";
    $("itemCost").value = i && i.cost !== null ? i.cost : "";
    $("itemWhy").value = i ? i.why : "";
    $("itemAdded").value = i ? i.added : "";
    $("itemDone").value = i ? i.done : "";
    $("itemDates").hidden = !i;
    $("itemDoneField").hidden = !(i && i.done);
    $("itemSaveBtn").textContent = i ? "Save" : "Add";
    $("itemAnotherBtn").hidden = !!i;
    $("itemDeleteBtn").hidden = !i;
    setStatus("");
    renderCatFields();
    S.editing.snapshot = formState();
    K.modal.open(overlay());
    if (!i) $("itemName").focus(); // editing is often just a tap on "Have it?", so no keyboard popping up
  }

  // Where a recommendation already on the list is, for the "already there" question.
  function whereIs(i) {
    if (i === A.nowItem()) return "in progress";
    if (i === A.nextItem()) return "up next";
    if (i.done) return `finished ${fmtDay(i.done)}`;
    return `in the magazine${i.added ? `, added ${fmtDay(i.added)}` : ""}`;
  }

  // Adds or saves what's in the pop-up. close false (Add another) clears it for the next one instead.
  function saveItem(close = true) {
    const e = S.editing;
    if (!e) return;
    const c = catOf(e.cat);
    const name = A.cleanLine($("itemName").value, MAX_NAME);
    if (!name) { $("itemName").focus(); return alert("Give it a name."); }
    const cost = c.cost ? readNumber($("itemCost")) : null;
    if (Number.isNaN(cost) || (cost !== null && (cost < 0 || cost > MAX_COST))) {
      $("itemCost").focus();
      return alert("Enter the cost as a number (0 if it's free), or leave it empty.");
    }
    const added = $("itemAdded").value, done = $("itemDone").value;
    let i = e.id ? A.itemById(e.id) : null;
    if (e.id && !i) {
      closeEditor();
      A.renderAll();
      return alert("That recommendation was deleted on another device, so nothing was saved.");
    }
    if (i && !isDate(added)) { $("itemAdded").focus(); return alert("Enter the day it was added."); }
    if (i && i.done && !isDate(done)) { $("itemDone").focus(); return alert("Enter the day you finished it."); }
    const fields = { cat: e.cat, name, info: A.cleanLine($("itemInfo").value, MAX_INFO), have: offered(e), cost: A.cleanCost(cost), why: A.cleanText($("itemWhy").value, MAX_WHY) };
    if (i) {
      Object.assign(i, fields, { added, done: i.done ? done : "", u: Date.now() });
    } else {
      const same = A.live().find(x => x.cat === e.cat && x.name.toLowerCase() === name.toLowerCase());
      if (same && !confirm(`“${same.name}” is already on your list (${whereIs(same)}). Add it again?`)) return;
      const now = Date.now();
      S.items.push({ id: newId(), ...fields, added: todayStr(), started: "", done: "", deleted: false, at: now, u: now });
      S.lastCat = e.cat;
    }
    A.save();
    A.renderAll();
    if (close || i) return closeEditor();
    // Add another: the same category, a clean form.
    ["itemName", "itemInfo", "itemCost", "itemWhy"].forEach(id => { $(id).value = ""; });
    e.have = "";
    renderCatFields();
    setStatus(`Added “${name}” to ${c.group}.`);
    e.snapshot = formState();
    $("itemName").focus();
  }

  function deleteItem() {
    const i = S.editing && A.itemById(S.editing.id);
    if (!i || !confirm(`Delete “${i.name}”? This can't be undone.`)) return;
    // Kept as a marker, so another device's older copy can't bring it back.
    Object.assign(i, { name: "", info: "", have: "", cost: null, why: "", started: "", done: "", deleted: true, u: Date.now() });
    ["now", "next"].forEach(slot => { if (S.slots[slot].id === i.id) A.setSlot(slot, ""); });
    closeEditor();
    A.save();
    A.renderAll();
  }

  // Enter in a one-line field adds or saves; Ctrl+Enter (⌘+Enter) anywhere in the pop-up too, since
  // Enter in "Why it's here" starts a new line. Returns true when it handled the key.
  function editorKey(e) {
    if (e.key !== "Enter" || !S.editing || !K.modal.isOpen(overlay()) || !overlay().contains(e.target)) return false;
    if (!e.ctrlKey && !e.metaKey && e.target.tagName !== "INPUT") return false;
    e.preventDefault();
    saveItem(true);
    return true;
  }

  function wireEditor() {
    defineEditor();
    $("itemCats").innerHTML = CATS.map(c => `<button type="button" class="pill" data-cat="${c.id}">${esc(c.label)}</button>`).join("");
    $("itemCats").addEventListener("click", e => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn || !S.editing) return;
      S.editing.cat = btn.dataset.cat;
      renderCatFields();
    });
    $("itemHave").addEventListener("click", e => {
      const btn = e.target.closest("button[data-have]");
      if (!btn || !S.editing) return;
      S.editing.have = btn.dataset.have;
      renderHave();
    });
    $("itemSaveBtn").addEventListener("click", () => saveItem(true));
    $("itemAnotherBtn").addEventListener("click", () => saveItem(false));
    $("itemCancelBtn").addEventListener("click", closeEditor);
    $("itemDeleteBtn").addEventListener("click", deleteItem);
  }

  Object.assign(A, { wireEditor, openEditor, editorKey });
})(Kyoshi, Kyoshi.apps.wanshitong);
