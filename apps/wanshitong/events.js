/* Wan Shi Tong · events.js — loads last: wires the page (A.init), moves recommendations between
 * the magazine, Up next, In progress and Finished, and the hooks Kyoshi calls: onTick (a new
 * day), onKeydown (Enter in the pop-up), onReload (another tab saved) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { todayStr } = K.util;
  const { setSlot } = A;

  const touch = (i, fields) => Object.assign(i, fields, { u: Date.now() });
  const kept = () => { A.save(); A.renderAll(); };

  // Start: In progress from today. What was in progress goes back to the magazine (after asking).
  function start(id) {
    const i = A.itemById(id), cur = A.nowItem();
    if (!i || i.done || i === cur) return;
    if (cur && !confirm(`Start “${i.name}” now? “${cur.name}” goes back to the magazine.`)) return;
    touch(i, { started: todayStr() });
    setSlot("now", i.id);
    if (S.slots.next.id === i.id) setSlot("next", "");
    kept();
  }

  // Up next: what was there goes back to the magazine.
  function upNext(id) {
    const i = A.itemById(id);
    if (!i || i.done || i === A.nextItem()) return;
    setSlot("next", i.id);
    kept();
  }

  // Done: on to the Finished list, and Up next moves into In progress, like the next round loading.
  function done(id) {
    const i = A.nowItem(), next = A.nextItem();
    if (!i || i.id !== id) return;
    if (!confirm(`Finished “${i.name}”? It goes to your Finished list${next ? `, and “${next.name}” moves up from Up next` : ""}.`)) return;
    const today = todayStr();
    touch(i, { done: today });
    if (next) {
      touch(next, { started: today });
      setSlot("now", next.id);
      setSlot("next", "");
    } else {
      setSlot("now", "");
    }
    kept();
  }

  // Back to magazine: empties In progress or Up next.
  function unload(slot) {
    if (slot !== "now" && slot !== "next") return;
    setSlot(slot, "");
    kept();
  }

  // Put back: a finished one goes back in the magazine.
  function putBack(id) {
    const i = A.itemById(id);
    if (!i || !i.done) return;
    touch(i, { done: "" });
    kept();
  }

  // Buttons drawn into the page carry data-act (and data-id or data-slot).
  const ACTS = {
    edit: btn => A.openEditor(btn.dataset.id),
    start: btn => start(btn.dataset.id),
    next: btn => upNext(btn.dataset.id),
    done: btn => done(btn.dataset.id),
    unload: btn => unload(btn.dataset.slot),
    putback: btn => putBack(btn.dataset.id)
  };

  A.init = () => {
    A.buildGroups();
    A.wireEditor();
    $("addBtn").addEventListener("click", () => A.openEditor(null));
    A.root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
    });
    // Folding a magazine group away is remembered on this device ("toggle" doesn't bubble, so it's caught on the way down).
    $("magazineGroups").addEventListener("toggle", e => {
      const cat = e.target.dataset && e.target.dataset.cat;
      if (!cat || e.target.open === !S.folded.includes(cat)) return; // as it was
      S.folded = e.target.open ? S.folded.filter(c => c !== cat) : S.folded.concat(cat);
      A.storeFolded();
    }, true);
    A.renderAll();
  };

  // Every minute, and whenever the page is back in view: dates show their year once it's not this year.
  A.onTick = () => { if (todayStr() !== S.knownToday) A.renderAll(); };

  A.onKeydown = e => A.editorKey(e);

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // Bug reports: counts only — never names, info or notes.
  A.bugState = () => {
    const live = A.live(), count = cat => live.filter(i => A.groupOf(i.cat) === cat).length;
    return [
      `- Recommendations: ${live.length} (${A.magazine().length} in the magazine, ${A.finished().length} finished; +${S.items.length - live.length} deleted)`,
      `- By category: ${A.CATS.concat(A.OTHER).map(c => `${c.id} ${count(c.id)}`).join(", ")}`,
      `- In progress / Up next: ${A.nowItem() ? "set" : "empty"} / ${A.nextItem() ? "set" : "empty"}`,
      `- Folded groups: ${S.folded.join(", ") || "none"}`,
      `- Pop-up: ${S.editing ? (S.editing.id ? "editing" : "adding") : "closed"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.wanshitong);
