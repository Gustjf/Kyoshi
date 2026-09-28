/* Wan Shi Tong · events.js — loads last: wires the page (A.init), moves recommendations between
 * the backlog, Up next, In progress and Finished (with the pop-up asking what makes room when
 * In progress is full), and the hooks Kyoshi calls: onTick (a new day), onKeydown (Enter in the
 * pop-up), onReload (another tab saved) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr } = K.util;
  const { setSlot } = A;

  const touch = (i, fields) => Object.assign(i, fields, { u: Date.now() });
  const kept = () => { A.save(); A.renderAll(); };
  const startable = i => !!i && !i.done && !A.spotOf(i);

  // Start: in progress from today, in a free spot. With none free, asks which one makes room.
  function start(id) {
    const i = A.itemById(id), spot = A.freeSpot();
    if (!startable(i)) return;
    if (spot) startIn(spot, i); else openSwap(i);
  }
  function startIn(spot, i) {
    touch(i, { started: todayStr() });
    setSlot(spot, i.id);
    if (S.slots.next.id === i.id) setSlot("next", "");
    kept();
  }

  // --- In progress is full: pick one to go back to the backlog; the new one takes its spot ---
  const swapOverlay = () => $("swapOverlay");
  function openSwap(i) {
    S.swapping = i.id;
    $("swapText").textContent = `Which one goes back to the backlog to make room for “${i.name}”?`;
    $("swapList").innerHTML = A.nowItems().map(x => `<button type="button" class="secondary swap-choice" data-act="swap" data-id="${esc(x.id)}">` +
      `<span class="spot-cat">${esc(A.catOf(x.cat).label)}</span><span class="swap-name">${esc(x.name)}</span></button>`).join("");
    K.modal.open(swapOverlay());
  }
  const closeSwap = () => K.modal.dismiss(swapOverlay());
  function swap(outId) {
    const i = A.itemById(S.swapping), out = A.itemById(outId), spot = out && A.spotOf(out);
    closeSwap();
    if (!startable(i) || !spot) return A.renderAll(); // changed meanwhile, in another tab or on another device
    A.unslot(out.id);
    startIn(spot, i);
  }

  // Up next: what was there goes back to the backlog.
  function upNext(id) {
    const i = A.itemById(id);
    if (!startable(i) || i === A.nextItem()) return;
    setSlot("next", i.id);
    kept();
  }

  // Done: on to the Finished list, and Up next takes its spot.
  function done(id) {
    const i = A.itemById(id), spot = i && A.spotOf(i), next = A.nextItem();
    if (!spot) return;
    if (!confirm(`Finished “${i.name}”? It goes to your Finished list${next ? `, and “${next.name}” moves up from Up next` : ""}.`)) return;
    const today = todayStr();
    touch(i, { done: today });
    A.unslot(i.id);
    if (next) {
      touch(next, { started: today });
      setSlot(spot, next.id);
      setSlot("next", "");
    }
    kept();
  }

  // Back to backlog: out of In progress or Up next.
  function unload(id) {
    if (!A.itemById(id)) return;
    A.unslot(id);
    kept();
  }

  // Put back: a finished one goes back in the backlog (not into a spot another device left it in).
  function putBack(id) {
    const i = A.itemById(id);
    if (!i || !i.done) return;
    touch(i, { done: "" });
    A.unslot(i.id);
    kept();
  }

  // Buttons drawn into the page carry data-act and data-id.
  const ACTS = {
    edit: btn => A.openEditor(btn.dataset.id),
    start: btn => start(btn.dataset.id),
    swap: btn => swap(btn.dataset.id),
    next: btn => upNext(btn.dataset.id),
    done: btn => done(btn.dataset.id),
    unload: btn => unload(btn.dataset.id),
    putback: btn => putBack(btn.dataset.id)
  };

  A.init = () => {
    A.buildGroups();
    A.wireEditor();
    K.modal.define(swapOverlay(), { dismiss: () => { K.modal.close(swapOverlay()); S.swapping = null; } });
    $("swapCancelBtn").addEventListener("click", closeSwap);
    $("addBtn").addEventListener("click", () => A.openEditor(null));
    A.root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
    });
    // Folding a backlog group away is remembered on this device ("toggle" doesn't bubble, so it's caught on the way down).
    $("backlogGroups").addEventListener("toggle", e => {
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
      `- Recommendations: ${live.length} (${A.backlog().length} in the backlog, ${A.finished().length} finished; +${S.items.length - live.length} deleted)`,
      `- By category: ${A.CATS.concat(A.OTHER).map(c => `${c.id} ${count(c.id)}`).join(", ")}`,
      `- In progress / Up next: ${A.nowItems().length} of ${A.NOW_SPOTS.length} / ${A.nextItem() ? "set" : "empty"}`,
      `- Folded groups: ${S.folded.join(", ") || "none"}`,
      `- Pop-up: ${S.editing ? (S.editing.id ? "editing" : "adding") : S.swapping ? "In progress is full" : "closed"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.wanshitong);
