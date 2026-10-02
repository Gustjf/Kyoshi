/* Template · events.js — loads last: wires the page (A.init) and the hooks Kyoshi calls
 * (see "The app contract" in the root CLAUDE.md). Unused hooks can simply be left out. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { newId } = K.util;
  const { MAX_TEXT } = A;

  function addItem() {
    const text = $("itemInput").value.trim().slice(0, MAX_TEXT);
    if (!text) return;
    const now = Date.now();
    S.items.push({ id: newId(), text, deleted: false, at: now, u: now });
    A.save();
    $("itemInput").value = "";
    A.renderAll();
  }

  // A deleted item stays as a marker, so another device's older copy can't bring it back.
  function deleteItem(id) {
    const item = S.items.find(i => i.id === id);
    if (!item) return;
    Object.assign(item, { text: "", deleted: true, u: Date.now() });
    A.save();
    A.renderAll();
  }

  A.init = () => {
    $("addItemBtn").addEventListener("click", addItem);
    $("itemsList").addEventListener("click", e => {
      const btn = e.target.closest("button[data-delete]");
      if (btn) deleteItem(btn.dataset.delete);
    });
    A.renderAll();
  };

  // Enter in the field adds the item; returning true tells Kyoshi the key was handled.
  A.onKeydown = e => {
    if (e.key !== "Enter" || e.target.id !== "itemInput" || !A.root.contains(e.target)) return false;
    e.preventDefault();
    addItem();
    return true;
  };

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // Bug reports: counts and settings only — never the user's own text.
  A.bugState = () => [`- Items: ${A.liveItems().length} (+${S.items.length - A.liveItems().length} deleted)`];

  // Other hooks, when the app needs them: A.onShow, A.onHide, A.onTick (every minute),
  // A.attention (a dot on its icon), A.awake (the screen kept on while it's true: a timer;
  // core/wakelock.js), A.renderDev(box) (Developer Mode tools).
})(Kyoshi, Kyoshi.apps.template);
