/* Iroh · area-editor.js — the area pop-up (#areaOverlay), opened from Vision: the area's name, the picture of it
 * in 10 years and the milestones 5 years out; Save (Enter in the name), Cancel, Delete (its goals stay, without an
 * area). And moving an area up or down the list (moveArea). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { newId } = K.util;
  const { MAX_NAME, MAX_VISION } = A;

  const overlay = () => $("areaOverlay");
  const FIELDS = ["areaName", "areaVision", "areaMilestones"];
  // What the pop-up holds, to tell whether closing it would lose something.
  const formState = () => JSON.stringify(FIELDS.map(id => $(id).value));
  const closeArea = () => K.modal.dismiss(overlay());

  // Opens the pop-up on an area (its id), or on a new one ("").
  function openArea(id) {
    const a = id ? A.areaById(id) : null;
    if (id && !a) return A.renderAll(); // deleted meanwhile, on another device
    S.areaEditing = { id: a ? a.id : "" };
    $("areaModalTitle").textContent = a ? "Area" : "A new area";
    $("areaName").value = a ? a.name : "";
    $("areaVision").value = a ? a.vision : "";
    $("areaMilestones").value = a ? a.milestones : "";
    $("areaDeleteBtn").hidden = !a;
    S.areaEditing.snapshot = formState();
    K.modal.open(overlay());
    if (!a) $("areaName").focus();
  }

  function saveArea() {
    const e = S.areaEditing;
    if (!e) return;
    const a = e.id ? A.areaById(e.id) : null;
    if (e.id && !a) {
      closeArea();
      A.renderAll();
      return alert("That area was deleted on another device, so nothing was saved.");
    }
    const name = A.cleanLine($("areaName").value, MAX_NAME);
    if (!name) { $("areaName").focus(); return alert("Name the area: Health, Work, Family…"); }
    if (A.liveAreas().some(x => x.id !== e.id && x.name.toLowerCase() === name.toLowerCase())) { $("areaName").focus(); return alert(`There's already an area called “${name}”.`); }
    const fields = { name, vision: A.cleanText($("areaVision").value, MAX_VISION), milestones: A.cleanText($("areaMilestones").value, MAX_VISION) };
    const now = Date.now();
    if (!a) {
      // Last in the list; made through the cleaner, so every copy has the same shape.
      const order = A.liveAreas().reduce((m, x) => Math.max(m, x.order + 1), 0);
      const fresh = A.cleanAreas([{ id: newId(), ...fields, order, at: now, u: now }])[0];
      if (fresh) S.areas.push(fresh);
    } else if (Object.keys(fields).some(k => fields[k] !== a[k])) {
      Object.assign(a, fields, { u: now });
    } else {
      return closeArea(); // nothing changed
    }
    A.save();
    closeArea();
    A.renderAll();
  }

  // A deleted area stays as a marker, so another device's older copy can't bring it back.
  function deleteArea() {
    const e = S.areaEditing, a = e && A.areaById(e.id);
    if (!a) {
      closeArea();
      A.renderAll();
      return;
    }
    if (!confirm(`Delete “${a.name}”? Its goals stay, without an area. This can't be undone.`)) return;
    Object.assign(a, { name: "", vision: "", milestones: "", deleted: true, u: Date.now() });
    closeArea();
    A.save();
    A.renderAll();
  }

  // Moves an area a place up (by -1) or down (1): each area takes its place in the list, and those whose place
  // changed are stamped, so sync carries the new order. The button keeps the focus while it can still move.
  function moveArea(id, by) {
    const list = A.liveAreas(), i = list.findIndex(a => a.id === id), j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const now = Date.now();
    list.forEach((a, k) => { if (a.order !== k) Object.assign(a, { order: k, u: now }); });
    A.save();
    A.renderAll();
    const again = A.root.querySelector(`[data-act="${by < 0 ? "area-up" : "area-down"}"][data-id="${CSS.escape(id)}"]`);
    if (again && !again.disabled) again.focus();
  }

  function wireAreaEditor() {
    // Esc, × and a click beside the pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.areaEditing = null; },
      pending: () => !!S.areaEditing && formState() !== S.areaEditing.snapshot,
      ask: "Discard your changes to this area?"
    });
    $("areaForm").addEventListener("submit", e => { e.preventDefault(); saveArea(); }); // Enter in the name saves
    $("areaCancelBtn").addEventListener("click", closeArea);
    $("areaDeleteBtn").addEventListener("click", deleteArea);
  }

  Object.assign(A, { wireAreaEditor, openArea, moveArea });
})(Kyoshi, Kyoshi.apps.iroh);
