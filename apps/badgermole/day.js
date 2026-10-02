/* Badgermole · day.js — the day pop-up (#dayOverlay), opened by a filled day in the calendar, by Finish (on the session
 * just logged) and by Momo's "Open in Badgermole": each session that day (its routine, when, how long), its sets by
 * exercise — weight and reps to fix, ✕ to remove, "+ set", PR marks — and Delete session. Save keeps the changes (PRs
 * and bests are worked out afresh, so history rewrites itself); a weight left as it was keeps its own unit. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, fmtDate, todayStr } = K.util;
  const { MAX_REPS, MAX_WEIGHT, MAX_SESSION_SETS, plural, fieldText, wholeIn, weightIn, fmtMinutes, shownWeight, unit } = A;

  const overlay = () => $("dayOverlay");
  const clock = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  // A session as the pop-up holds it: its sets' fields as text (the weight in the unit shown); from: the stored set's
  // place (none for a set added here).
  const draftOf = s => ({ id: s.id, u: s.u, sets: s.sets.map((x, i) => ({ from: i, exerciseId: x.exerciseId, name: x.name, bodyweight: x.bodyweight, w: String(shownWeight(x.weight, x.unit)), r: String(x.reps), at: x.at })) });
  const fieldsOf = d => JSON.stringify(d.sets.map(x => [x.from, x.w, x.r]));
  // Whether anything was changed since the pop-up opened (a session deleted here is already gone).
  const pending = () => !!S.day && (readFields(), S.day.sessions.some(d => fieldsOf(d) !== d.snapshot));

  function openDay(date, focusId = "") {
    const list = A.sessionsOn(date);
    if (!list.length) return;
    // Already open with changes (left open while in another app, say): ask before they go.
    if (S.day && K.modal.isOpen(overlay()) && pending() && !confirm("Discard your changes to this day's sets?")) return;
    S.day = { date, focus: focusId, sessions: list.map(s => Object.assign(draftOf(s), { snapshot: fieldsOf(draftOf(s)) })) };
    $("dayTitle").textContent = fmtDate(date, { weekday: "short", month: "short", day: "numeric", ...(date.slice(0, 4) === todayStr().slice(0, 4) ? {} : { year: "numeric" }) });
    renderDay();
    K.modal.open(overlay());
    const box = focusId && $("daySessions").querySelector(`.day-session[data-id="${CSS.escape(focusId)}"]`);
    if (box && list.length > 1) A.reveal(box);
  }

  // A set's row: its number, weight and reps (a bodyweight one: reps, then the added weight), PR, ✕.
  function setRow(d, x, i, n) {
    const field = (f, value, label, mode) => `<input type="number" class="day-${f}" data-s="${esc(d.id)}" data-i="${i}" data-f="${f}" value="${esc(value)}" min="0" step="any" inputmode="${mode}" aria-label="${esc(label)}">`;
    const w = field("w", x.w, `${x.bodyweight ? "Added weight" : "Weight"}, set ${n} (${unit()})`, "decimal"), r = field("r", x.r, `Reps, set ${n}`, "numeric");
    const pr = x.from !== undefined && A.isStoredPR(d.id, x.from) ? `<span class="badge pr">PR</span>` : "";
    return `<div class="day-set"><span class="day-n">${n}</span>` +
      (x.bodyweight ? `${r}<span class="day-x">reps +</span>${w}<span class="day-unit">${unit()}</span>` : `${w}<span class="day-unit">${unit()}</span><span class="day-x">&times;</span>${r}`) +
      `${pr}<button type="button" class="icon-btn day-remove" data-day="remove" data-s="${esc(d.id)}" data-i="${i}" aria-label="Remove set ${n}">&times;</button></div>`;
  }

  function renderDay() {
    $("daySessions").innerHTML = S.day.sessions.map(d => {
      const s = A.sessionById(d.id);
      if (!s) return "";
      const m = A.sessionMinutes(s), when = s.started ? `${clock(s.started)}–${clock(s.finished)}${m ? ` · ${fmtMinutes(m)}` : ""}` : "";
      // Its sets by exercise, in the order each was first done.
      const groups = new Map();
      d.sets.forEach((x, i) => (groups.get(x.exerciseId) || groups.set(x.exerciseId, []).get(x.exerciseId)).push({ x, i }));
      const body = [...groups].map(([exerciseId, rows]) => {
        const e = A.exerciseById(exerciseId);
        return `<div class="day-ex"><div class="day-ex-name">${esc(e ? e.name : rows[0].x.name)}</div>` + rows.map(({ x, i }, k) => setRow(d, x, i, k + 1)).join("") +
          `<button type="button" class="more-link day-add" data-day="add" data-s="${esc(d.id)}" data-e="${esc(exerciseId)}">+ set</button></div>`;
      }).join("") || `<div class="empty-msg">No sets left: Save deletes this session.</div>`;
      return `<div class="day-session${d.id === S.day.focus ? " focus" : ""}" data-id="${esc(d.id)}">` +
        `<div class="day-head"><span class="day-name">${esc(s.name || "Workout")}</span><span class="day-meta">${esc([when, plural(d.sets.length, "set")].filter(Boolean).join(" · "))}</span></div>` +
        body + `<div class="day-actions"><button type="button" class="danger" data-day="delete" data-s="${esc(d.id)}">Delete session</button></div></div>`;
    }).join("");
  }

  // What's in the fields, into the drafts.
  function readFields() {
    $("daySessions").querySelectorAll("input[data-f]").forEach(el => {
      const d = S.day.sessions.find(x => x.id === el.dataset.s), x = d && d.sets[+el.dataset.i];
      if (x) x[el.dataset.f] = fieldText(el);
    });
  }

  // + set: a copy of the exercise's last set in that session, right after it. ✕: out (kept until Save).
  function addSet(d, exerciseId) {
    let at = -1;
    d.sets.forEach((x, i) => { if (x.exerciseId === exerciseId) at = i; });
    if (at < 0 || d.sets.length >= MAX_SESSION_SETS) return;
    const last = d.sets[at];
    d.sets.splice(at + 1, 0, { exerciseId, name: last.name, bodyweight: last.bodyweight, w: last.w, r: last.r, at: last.at });
  }

  // Delete session: gone at once (after asking), leaving a marker so sync can't bring it back.
  function deleteSession(id) {
    const s = A.sessionById(id);
    if (s && !confirm(`Delete this session (${s.name || "Workout"}, ${plural(s.sets.length, "set")})? This can't be undone.`)) return;
    if (s) {
      S.sessions = S.sessions.map(x => (x === s ? { id: s.id, deleted: true, started: s.started, u: Date.now() } : x));
      A.save();
      A.renderAll();
    }
    S.day.sessions = S.day.sessions.filter(d => d.id !== id);
    if (!S.day.sessions.length) return close();
    renderDay();
  }

  function save() {
    if (!S.day) return;
    readFields();
    const changes = [];
    for (const d of S.day.sessions) {
      const s = A.sessionById(d.id);
      if (!s || fieldsOf(d) === d.snapshot) continue;
      if (s.u !== d.u) return alert(`${s.name || "That session"} was changed on another device meanwhile, so nothing was saved. Close this and open the day again.`);
      const sets = [];
      for (const x of d.sets) {
        const weight = weightIn(x.w), reps = wholeIn(x.r, 0, MAX_REPS), name = A.exerciseById(x.exerciseId) ? A.exerciseById(x.exerciseId).name : x.name;
        if (weight === null) return alert(`${name}: the weight goes from 0 to ${MAX_WEIGHT}.`);
        if (reps === null) return alert(`${name}: reps are a whole number from 0 to ${MAX_REPS}.`);
        // A set whose weight was left as it was keeps its own weight and unit; otherwise it's in the unit shown.
        const was = x.from !== undefined ? s.sets[x.from] : null, same = was && x.w === String(shownWeight(was.weight, was.unit));
        sets.push({ ...(was || { exerciseId: x.exerciseId, name: x.name, bodyweight: x.bodyweight, at: x.at }), reps, weight: same ? was.weight : weight, unit: same ? was.unit : unit() });
      }
      changes.push({ s, sets });
    }
    const empty = changes.filter(c => !c.sets.length);
    if (empty.length && !confirm(`${empty.length === 1 ? "A session has" : `${empty.length} sessions have`} no sets left, so ${empty.length === 1 ? "it" : "they"}'ll be deleted. Go ahead?`)) return;
    if (changes.length) {
      const t = Date.now(), next = new Map(changes.map(c => [c.s.id, c.sets.length ? A.cleanSessions([{ ...c.s, sets: c.sets, u: t }])[0] : { id: c.s.id, deleted: true, started: c.s.started, u: t }]));
      S.sessions = S.sessions.map(x => next.get(x.id) || x);
      A.save();
      A.renderAll();
    }
    close();
  }

  function close() {
    K.modal.close(overlay());
    S.day = null;
  }

  function wireDay() {
    // Esc, × and a click beside it ask first if something was changed (core/modal.js); Cancel doesn't.
    K.modal.define(overlay(), { dismiss: close, pending, ask: "Discard your changes to this day's sets?" });
    // Enter in a field saves, as Save does.
    $("dayForm").addEventListener("submit", e => { e.preventDefault(); save(); });
    $("dayCancelBtn").addEventListener("click", close);
    $("daySessions").addEventListener("click", e => {
      const b = e.target.closest("button[data-day]"), d = b && S.day && S.day.sessions.find(x => x.id === b.dataset.s);
      if (!d) return;
      readFields(); // so redrawing keeps what's typed
      if (b.dataset.day === "delete") return deleteSession(d.id);
      if (b.dataset.day === "add") addSet(d, b.dataset.e);
      else d.sets.splice(+b.dataset.i, 1);
      renderDay();
    });
  }

  Object.assign(A, { openDay, wireDay });
})(Kyoshi, Kyoshi.apps.badgermole);
