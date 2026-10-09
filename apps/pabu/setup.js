/* Pabu · setup.js — Set up (#setupOverlay), opened from Pabu's Developer Mode tools (events.js renderDev): who you're in
 * a relationship with (one person, or no one) and your anniversary (month, day and an optional year, read as the
 * birthday's are: A.readDayFields; off while no one is picked). Picking someone shows their anniversary as kept (none for
 * anyone but the one you're with). Save makes that person the partner with that anniversary and clears both from
 * everyone else, stamping only those whose fields change; "— no one" clears them all; nothing changed just closes. What
 * Save can't take is said above it and the field marked. Esc, × and a click beside it ask first when something changed;
 * Cancel doesn't. Nothing asks for the owner's name. */
(function (K, A) {
  "use strict";
  const $ = A.$;
  const { esc } = K.util;

  const overlay = () => $("setupOverlay");
  const DAY = ["setupMonth", "setupDay", "setupYear"];
  const dayFields = () => DAY.map(f => $(f).value).join("|");
  const formState = () => `${$("setupPartner").value}|${dayFields()}`;
  // While it's open: the snapshot as it opened (to tell whether closing would lose something), and the anniversary the
  // fields were last filled with, with the fields as filled (left as they were, it's kept as it came).
  let opened = null;

  function hint(text = "") {
    $("setupHint").textContent = text;
    $("setupHint").hidden = !text;
  }
  // Save can't take a field: it's marked and takes the focus, and the line above Save says why. Null.
  function say(el, text) {
    el.setAttribute("aria-invalid", "true");
    el.focus();
    hint(text);
    return null;
  }
  const unmark = () => $("setupForm").querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));

  // The anniversary's fields show the one picked's, as kept, and are off while no one is picked.
  function showDay() {
    const p = A.personById($("setupPartner").value), b = p && A.parseBirthday(p.anniversary);
    $("setupMonth").value = b ? String(b.month) : "";
    $("setupDay").value = b ? b.day : "";
    $("setupYear").value = b && b.year ? b.year : "";
    DAY.forEach(f => { $(f).disabled = !p; });
    unmark();
    hint();
    Object.assign(opened, { day: p ? p.anniversary : "", fields: dayFields() });
  }

  // "— no one", then everyone, A to Z, the one you're with picked.
  function openSetup() {
    const people = A.live().sort(A.byName), partner = people.find(p => p.partner);
    $("setupPartner").innerHTML = `<option value="">— no one</option>` +
      people.map(p => `<option value="${esc(p.id)}"${p === partner ? " selected" : ""}>${esc(p.name)}</option>`).join("");
    opened = {};
    showDay();
    opened.snapshot = formState();
    K.modal.open(overlay());
  }
  const closeSetup = () => K.modal.dismiss(overlay());

  function saveSetup() {
    if (!opened) return;
    if (formState() === opened.snapshot) return closeSetup();
    unmark();
    hint();
    const id = $("setupPartner").value, who = id ? A.personById(id) : null;
    if (id && !who) {
      closeSetup();
      A.renderAll();
      return alert("That person was deleted on another device, so nothing was saved.");
    }
    const anniversary = !who ? "" : dayFields() === opened.fields ? opened.day : A.readDayFields(...DAY.map(f => $(f)), "anniversary", say);
    if (anniversary === null) return;
    let changed = false;
    A.live().forEach(p => {
      const partner = p === who, day = partner ? anniversary : "";
      if (p.partner === partner && p.anniversary === day) return;
      Object.assign(p, { partner, anniversary: day, u: Date.now() });
      changed = true;
    });
    if (changed) A.save();
    closeSetup();
    A.renderAll();
  }

  function wireSetup() {
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); opened = null; },
      pending: () => !!opened && formState() !== opened.snapshot,
      ask: "Discard your changes?"
    });
    $("setupForm").addEventListener("submit", e => { e.preventDefault(); saveSetup(); });
    $("setupPartner").addEventListener("change", showDay);
    // "—" for the month takes the anniversary off: its day and year go with it.
    $("setupMonth").addEventListener("change", () => { if (!$("setupMonth").value) DAY.forEach(f => { $(f).value = ""; }); });
    // Typing again in a field Save marked lets it be.
    $("setupForm").addEventListener("input", e => {
      if (!e.target.hasAttribute("aria-invalid")) return;
      e.target.removeAttribute("aria-invalid");
      hint();
    });
    $("setupCancelBtn").addEventListener("click", closeSetup);
  }

  Object.assign(A, { wireSetup, openSetup });
})(Kyoshi, Kyoshi.apps.pabu);
