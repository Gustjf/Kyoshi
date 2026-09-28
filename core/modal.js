/* Kyoshi · core/modal.js — pop-ups (overlays), as K.modal. Used by core and every app.
 * Markup: <div class="overlay"><div class="modal" role="dialog">… <button class="modal-close">×</button> …</div></div>
 * Define each overlay once — K.modal.define(el, { dismiss, pending, ask, backdrop }) — then
 * K.modal.open(el) / K.modal.close(el). Esc (core/shell.js), its × (.modal-close) and a click
 * on the dimmed backdrop all request a dismiss: when pending() says something would be lost,
 * confirm(ask) first; then dismiss() (default: just close). A Cancel button calls K.modal.dismiss. */
(function (K) {
  "use strict";
  const defs = new Map(); // overlay -> { dismiss, pending, ask }
  let stack = [];         // open overlays, oldest first

  function define(overlay, { dismiss = null, pending = null, ask = "", backdrop = true } = {}) {
    defs.set(overlay, { dismiss, pending, ask });
    overlay.querySelectorAll(".modal-close").forEach(btn => btn.addEventListener("click", () => requestDismiss(overlay)));
    if (backdrop) {
      // Only a click that started on the backdrop: selecting text in a field and letting go outside doesn't close it.
      let downOnBackdrop = false;
      overlay.addEventListener("pointerdown", e => { downOnBackdrop = e.target === overlay; });
      overlay.addEventListener("click", e => { if (downOnBackdrop && e.target === overlay) requestDismiss(overlay); });
    }
    return overlay;
  }

  function open(overlay) {
    overlay.classList.add("open");
    stack = stack.filter(o => o !== overlay).concat(overlay);
  }
  function close(overlay) {
    overlay.classList.remove("open");
    stack = stack.filter(o => o !== overlay);
  }
  const isOpen = overlay => overlay.classList.contains("open");

  // The open overlay on top: of those on screen, plus — given scope, an app's root — that
  // app's own while it's out of view (so an app in the background doesn't stack pop-ups).
  const top = (scope = null) => stack.filter(o => isOpen(o) && (o.isConnected || (scope && scope.contains(o)))).pop() || null;

  // Asks first when closing would lose something, then dismisses.
  function requestDismiss(overlay) {
    const d = defs.get(overlay) || {};
    if (d.pending && d.pending() && !confirm(d.ask)) return;
    dismiss(overlay);
  }
  function dismiss(overlay) {
    const d = defs.get(overlay) || {};
    if (d.dismiss) d.dismiss(); else close(overlay);
  }

  K.modal = { define, open, close, isOpen, top, requestDismiss, dismiss };
})(Kyoshi);
