/* Iroh · goal-editor.js — the goal pop-up (#goalOverlay): a new goal for this season or this year, or one tapped:
 * its title (a season goal's is the title of its cards in Momo), the year goal it serves and its area (a season
 * goal with a year goal takes that one's area), its hours (none, a week, or in total), the next step, done when,
 * why, and whether it's open, done or dropped; Save (Enter), Cancel, Delete. And the reconcile pop-up
 * (#recOverlay): the next step, then Reconciled ✓, Mark done or Drop, each of which stamps today. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isNum, newId, readNumber, fmtDate, fmtShort, todayStr } = K.util;
  const { MAX_TITLE, MAX_WHY, MAX_NEXT, HOURS_STEP, MAX_HOURS_WEEK, MAX_HOURS_TOTAL } = A;

  // ==========================================================================
  // THE GOAL POP-UP
  // ==========================================================================
  const overlay = () => $("goalOverlay");
  const FIELDS = ["goalTitle", "goalParent", "goalArea", "goalHours", "goalNext", "goalDoneWhen", "goalWhy"];
  // What the pop-up holds, to tell whether closing it would lose something.
  const formState = () => JSON.stringify(FIELDS.map(id => $(id).value).concat(S.editing ? [S.editing.mode, S.editing.status] : []));
  const closeGoal = () => K.modal.dismiss(overlay());
  const periodName = p => (A.isSeason(p) ? A.seasonLabel(p) : p);

  // Chips: the one picked looks pressed.
  function pressed(box, key, value) {
    box.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset[key] === value);
      b.setAttribute("aria-pressed", String(b.dataset[key] === value));
    });
  }

  // Shows the fields that apply: a season goal's year goal, hours and next step; the area unless a year goal
  // gives it; the hours box unless None; how it stands, once it exists.
  function showFields() {
    const e = S.editing, parent = e.season ? A.goalById($("goalParent").value) : null, area = parent && A.areaById(parent.areaId);
    ["goalParentField", "goalHoursField", "goalNextField"].forEach(id => { $(id).hidden = !e.season; });
    $("goalTitleHint").hidden = !e.season;
    $("goalAreaField").hidden = !!parent;
    $("goalParentNote").textContent = !parent ? "" : area ? `Its area: ${area.name}.` : "That goal has no area.";
    pressed($("goalHoursMode"), "mode", e.mode);
    $("goalHours").hidden = e.mode === "none";
    $("goalHours").max = e.mode === "week" ? MAX_HOURS_WEEK : MAX_HOURS_TOTAL;
    $("goalHours").placeholder = e.mode === "week" ? "Hours a week" : "Hours in all, for the season";
    $("goalStatusField").hidden = !e.id;
    pressed($("goalStatus"), "status", e.status);
    $("goalDeleteBtn").hidden = !e.id;
  }

  // Opens the pop-up on a goal (its id), or on a new one for this season or this year (kind "season" | "year").
  function openGoal(id, kind) {
    const g = id ? A.goalById(id) : null;
    if (id && !g) return A.renderAll(); // deleted meanwhile, on another device
    const period = g ? g.period : kind === "year" ? A.thisYear() : A.currentSeason(), season = A.isSeason(period);
    S.editing = { id: g ? g.id : "", period, season, mode: g && g.hoursWeek ? "week" : g && g.hoursTotal ? "total" : "none", status: g ? g.status : "open" };
    $("goalModalTitle").textContent = g ? (season ? "Season goal" : "Year goal") : season ? "A goal for this season" : "A goal for this year";
    $("goalPeriod").textContent = season ? `${A.seasonLabel(period)}: ${fmtShort(A.startOf(period))} – ${fmtShort(A.endOf(period))}.`
      : `${period}: ${fmtDate(A.startOf(`${period}-winter`))} – ${fmtDate(A.endOf(`${period}-fall`))}, winter to fall.`;
    $("goalTitle").value = g ? g.title : "";
    // The year goals it can serve: its year's open ones, and the one it has.
    const year = String(A.yearOf(period)), cur = g ? A.parentOf(g) : null;
    const parents = A.goalsIn(year).filter(p => A.isOpen(p) || p === cur);
    if (cur && !parents.includes(cur)) parents.push(cur);
    $("goalParent").innerHTML = `<option value="">None</option>` +
      parents.map(p => `<option value="${esc(p.id)}">${esc(p.title)}${p.period !== year ? ` (${esc(p.period)})` : ""}</option>`).join("");
    $("goalParent").value = cur ? cur.id : "";
    const area = g ? A.areaById(g.areaId) : null;
    $("goalArea").innerHTML = `<option value="">No area</option>` + A.liveAreas().map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    $("goalArea").value = area ? area.id : "";
    $("goalHours").value = g ? g.hoursWeek || g.hoursTotal || "" : "";
    $("goalNext").value = g ? g.next : "";
    $("goalDoneWhen").value = g ? g.doneWhen : "";
    $("goalWhy").value = g ? g.why : "";
    showFields();
    S.editing.snapshot = formState();
    K.modal.open(overlay());
    if (!g) $("goalTitle").focus();
  }

  function pickMode(mode) {
    S.editing.mode = mode;
    showFields();
    if (mode !== "none") $("goalHours").focus();
  }

  function saveGoal() {
    const e = S.editing;
    if (!e) return;
    const g = e.id ? A.goalById(e.id) : null;
    if (e.id && !g) {
      closeGoal();
      A.renderAll();
      return alert("That goal was deleted on another device, so nothing was saved.");
    }
    const title = A.cleanLine($("goalTitle").value, MAX_TITLE);
    if (!title) { $("goalTitle").focus(); return alert("Say what the goal is."); }
    const twin = A.goalsIn(e.period).find(x => x.id !== e.id && x.title.toLowerCase() === title.toLowerCase());
    if (twin) {
      $("goalTitle").focus();
      return alert(`${periodName(e.period)} already has a goal called “${twin.title}”. Give this one a title of its own${e.season ? ": it's the title of its cards in Momo" : ""}.`);
    }
    // A season goal's hours as picked; a year goal keeps what it has.
    let hoursWeek = g ? g.hoursWeek : 0, hoursTotal = g ? g.hoursTotal : 0;
    if (e.season) {
      hoursWeek = hoursTotal = 0;
      if (e.mode !== "none") {
        const max = e.mode === "week" ? MAX_HOURS_WEEK : MAX_HOURS_TOTAL, v = readNumber($("goalHours"));
        if (!isNum(v) || v < HOURS_STEP || v > max) {
          $("goalHours").focus();
          return alert(`How many hours ${e.mode === "week" ? "a week" : "in all"}? From ${HOURS_STEP} to ${max}, in quarters of an hour.`);
        }
        if (e.mode === "week") hoursWeek = A.cleanHours(v, max);
        else hoursTotal = A.cleanHours(v, max);
      }
    }
    const parent = e.season ? A.goalById($("goalParent").value) : null, areaId = parent ? parent.areaId : $("goalArea").value;
    const fields = {
      areaId: A.areaById(areaId) ? areaId : "",
      title,
      why: A.cleanText($("goalWhy").value, MAX_WHY),
      doneWhen: A.cleanText($("goalDoneWhen").value, MAX_WHY),
      parentId: parent ? parent.id : "",
      hoursWeek, hoursTotal,
      next: e.season ? A.cleanLine($("goalNext").value, MAX_NEXT) : g ? g.next : "",
      status: e.status
    };
    const now = Date.now();
    if (!g) {
      // New goals come reconciled today: you've just thought them through. Made through the cleaner, so every copy has the same shape.
      const fresh = A.cleanGoals([{ id: newId(), ...fields, period: e.period, reconciled: todayStr(), at: now, u: now }])[0];
      if (fresh) S.goals.push(fresh);
    } else if (Object.keys(fields).some(k => fields[k] !== g[k])) {
      Object.assign(g, fields, { u: now });
    } else {
      return closeGoal(); // nothing changed
    }
    A.save();
    closeGoal();
    A.renderAll();
  }

  // A deleted goal stays as a marker, so another device's older copy can't bring it back. Its season goals stay,
  // without a year goal, in its area (the one they showed).
  function deleteGoal() {
    const e = S.editing, g = e && A.goalById(e.id);
    if (!g) {
      closeGoal();
      A.renderAll();
      return;
    }
    const kids = A.childrenOf(g.id), now = Date.now(), areaId = A.areaById(g.areaId) ? g.areaId : "";
    if (!confirm(`Delete “${g.title}”?${kids.length ? ` ${kids.length === 1 ? "Its season goal stays" : `Its ${kids.length} season goals stay`}, without a year goal.` : ""} This can't be undone.`)) return;
    kids.forEach(k => Object.assign(k, { areaId, parentId: "", u: now }));
    Object.assign(g, { areaId: "", period: "", title: "", why: "", doneWhen: "", parentId: "", hoursWeek: 0, hoursTotal: 0, next: "", reconciled: "", status: "open", deleted: true, u: now });
    closeGoal();
    A.save();
    A.renderAll();
  }

  // ==========================================================================
  // THE RECONCILE POP-UP
  // ==========================================================================
  const recOverlay = () => $("recOverlay");
  const closeRec = () => K.modal.dismiss(recOverlay());

  // Where the goal stands: its chain, hours and last reconcile, and its next step to change.
  function openReconcile(id) {
    const g = A.goalById(id);
    if (!g) return A.renderAll();
    S.reconciling = { id: g.id };
    $("recTitle").textContent = `Reconcile: ${g.title}`;
    $("recHint").textContent = [A.chainOf(g), A.hoursText(g), g.reconciled ? `Last reconciled ${A.ago(g.reconciled)}.` : "Not reconciled yet."].filter(Boolean).join(" · ");
    $("recNext").value = g.next;
    S.reconciling.snapshot = $("recNext").value;
    K.modal.open(recOverlay());
  }

  // Reconciled ✓ (status "": as it is), Mark done or Drop: the next step as typed, and today.
  function reconcile(status) {
    const r = S.reconciling;
    if (!r) return;
    const g = A.goalById(r.id);
    if (!g) {
      closeRec();
      A.renderAll();
      return alert("That goal was deleted on another device, so nothing was saved.");
    }
    Object.assign(g, { next: A.cleanLine($("recNext").value, MAX_NEXT), reconciled: todayStr(), status: status || g.status, u: Date.now() });
    closeRec();
    A.save();
    A.renderAll();
  }

  function wireGoalEditor() {
    // Esc, × and a click beside a pop-up ask first if something was changed (core/modal.js); Cancel doesn't.
    K.modal.define(overlay(), {
      dismiss: () => { K.modal.close(overlay()); S.editing = null; },
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard your changes to this goal?"
    });
    $("goalForm").addEventListener("submit", e => { e.preventDefault(); saveGoal(); }); // Enter in a field saves
    $("goalCancelBtn").addEventListener("click", closeGoal);
    $("goalDeleteBtn").addEventListener("click", deleteGoal);
    $("goalParent").addEventListener("change", showFields);
    $("goalHoursMode").addEventListener("click", e => { const b = e.target.closest("button[data-mode]"); if (b && S.editing) pickMode(b.dataset.mode); });
    $("goalStatus").addEventListener("click", e => {
      const b = e.target.closest("button[data-status]");
      if (!b || !S.editing) return;
      S.editing.status = b.dataset.status;
      showFields();
    });
    K.modal.define(recOverlay(), {
      dismiss: () => { K.modal.close(recOverlay()); S.reconciling = null; },
      pending: () => !!S.reconciling && $("recNext").value !== S.reconciling.snapshot,
      ask: "Discard the next step you typed?"
    });
    $("recForm").addEventListener("submit", e => { e.preventDefault(); reconcile(""); });
    $("recDoneBtn").addEventListener("click", () => reconcile("done"));
    $("recDropBtn").addEventListener("click", () => reconcile("dropped"));
    $("recCancelBtn").addEventListener("click", closeRec);
  }

  Object.assign(A, { wireGoalEditor, openGoal, openReconcile });
})(Kyoshi, Kyoshi.apps.iroh);
