/* Hawky · events.js — loads last: wires the page (A.init): the nav, quick add (Enter or Add adds the errand,
 * clears the field and keeps its focus; tapping a chip or + Note leaves the phone's keyboard up), ✓ and its undo,
 * and the Done fold's Show more (the Shopping view wires itself: lists-view.js); and the hooks Kyoshi calls: onTick
 * (a new day), onReload (another tab saved), attention (overdue errands) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { newId, isDate, todayStr } = K.util;
  const { MAX_TEXT, MAX_NOTE, MIN_MINUTES, MAX_MINUTES, DEFAULT_MINUTES, DONE_PAGE, DOT_WHEN_OVERDUE, fmtMinutes, dayWords } = A;

  const kept = () => { A.save(); A.renderAll(); };

  function setStatus(text, bad = false) {
    $("addStatus").textContent = text;
    $("addStatus").classList.toggle("bad", bad);
  }

  // Pick a day's date field, with the browser's calendar open where it can be.
  function openPicker() {
    const el = $("addDate");
    try {
      if (typeof el.showPicker === "function") return el.showPicker();
    } catch (err) { /* not allowed here: the field is still there to tap */ }
    el.focus();
  }

  function pickDay(day) {
    S.add.day = day;
    A.renderAdd();
    setStatus("");
    if (day === "pick") openPicker();
  }
  function pickMinutes(m) {
    S.add.minutes = m === "other" ? m : +m;
    A.renderAdd();
    setStatus("");
    if (m === "other") $("addOther").focus();
  }

  // The day the chips give: "YYYY-MM-DD", "" for no day, or null while Pick a day has none.
  function chipDay() {
    const picked = $("addDate").value;
    if (S.add.day === "today") return todayStr();
    if (S.add.day === "pick") return isDate(picked) ? picked : null;
    return "";
  }

  // + Note: the note line, for a word more than the errand's text.
  function showNote() {
    S.add.note = true;
    A.renderAdd();
    $("addNote").focus();
  }

  // Quick add: the errand, with the chips' day and estimate, and the note if one was typed. Then the field clears
  // and keeps its focus for the next one, and the chips go back to no day, 15 minutes and no note.
  function add() {
    const text = A.cleanLine($("addText").value, MAX_TEXT), due = chipDay(), note = S.add.note ? A.cleanText($("addNote").value, MAX_NOTE) : "";
    const minutes = S.add.minutes === "other" ? A.readMinutes($("addOther")) : S.add.minutes;
    if (!text) return $("addText").focus();
    if (due === null) {
      setStatus("Pick the day first.", true);
      return openPicker();
    }
    if (!minutes) {
      setStatus(`How long? From ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`, true);
      return $("addOther").focus();
    }
    const now = Date.now();
    S.items.push({ id: newId(), text, note, due, minutes, done: "", deleted: false, at: now, u: now });
    A.save();
    S.add = { day: "none", minutes: DEFAULT_MINUTES, note: false };
    ["addText", "addDate", "addOther", "addNote"].forEach(id => { $(id).value = ""; });
    A.renderAll();
    setStatus(`Added “${text}”${due ? ` for ${dayWords(due)}` : ""}, ${fmtMinutes(minutes)}.`);
    $("addText").focus();
  }

  // ✓: done today (into the Done fold, and ✓ on its card in Momo); ✓ again undoes it.
  function tick(id, done) {
    const i = A.itemById(id);
    if (!i || !!i.done === done) return;
    Object.assign(i, { done: done ? todayStr() : "", u: Date.now() });
    kept();
  }

  // Buttons drawn into the list carry data-act and data-id.
  const ACTS = {
    tick: btn => tick(btn.dataset.id, true),
    undo: btn => tick(btn.dataset.id, false),
    edit: btn => A.openEditor(btn.dataset.id)
  };

  A.init = () => {
    A.wireEditor();
    A.wireLists();
    $("nav").addEventListener("click", e => { const b = e.target.closest("button[data-view]"); if (b && b.dataset.view !== S.view) A.showView(b.dataset.view); });
    $("addForm").addEventListener("submit", e => { e.preventDefault(); add(); });
    // Tapping a chip, + Note or Add doesn't take the focus, so the phone's keyboard stays up while typing.
    $("addForm").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    $("addDays").addEventListener("click", e => { const b = e.target.closest("button[data-day]"); if (b) pickDay(b.dataset.day); });
    $("addMinutes").addEventListener("click", e => { const b = e.target.closest("button[data-minutes]"); if (b) pickMinutes(b.dataset.minutes); });
    $("addNoteBtn").addEventListener("click", showNote);
    $("addText").addEventListener("input", () => setStatus(""));
    A.root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
    });
    $("doneMore").addEventListener("click", () => {
      S.doneShown += DONE_PAGE;
      A.renderAll();
    });
    A.renderAll();
  };

  // Every minute, and whenever the page is back in view: at a new day, errands move between the groups, waits grow
  // and locks run out.
  A.onTick = () => { if (todayStr() !== S.knownToday) A.renderAll(); };

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // A dot on Hawky's icon while any errand is overdue (DOT_WHEN_OVERDUE in app.js turns it off).
  A.attention = () => {
    const n = DOT_WHEN_OVERDUE ? A.overdueItems().length : 0;
    return n ? `${n} errand${n === 1 ? "" : "s"} overdue` : "";
  };

  // Bug reports: counts and settings only — never the errands' or the lists' words.
  A.bugState = () => {
    const open = A.openItems(), groups = A.GROUPS.map(([key]) => `${key} ${open.filter(i => A.groupOf(i) === key).length}`);
    const lists = A.liveLists(), states = ["open", "locked", "ready", "done"].map(s => `${s} ${lists.filter(l => A.stateOf(l) === s).length}`);
    const items = lists.flatMap(A.liveItemsOf), popup = S.editing ? "errand" : S.listEditing ? "list" : S.itemEditing ? "item" : "none";
    return [
      `- Errands: ${open.length} open (${groups.join(", ")}), ${A.doneItems().length} done, ${A.live().filter(i => i.note).length} with a note; +${S.items.length - A.live().length} deleted`,
      `- Lists: ${lists.length} (${states.join(", ")}), ${items.length} items (${items.filter(i => i.bought).length} bought, ${items.filter(i => i.note).length} with a note); +${S.lists.length - lists.length} deleted`,
      `- Quick add: day ${S.add.day}, minutes ${S.add.minutes}, note ${S.add.note ? "shown" : "hidden"}`,
      `- View: ${S.view}; pop-up: ${popup}; done shown: ${S.doneShown} errands, ${S.listsDoneShown} lists`
    ];
  };
})(Kyoshi, Kyoshi.apps.hawky);
