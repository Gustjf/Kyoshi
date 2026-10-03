/* Badgermole · render.js — draws what's on screen from A.S: one view at a time (showView) — Home or the session
 * (session.js) — and Home itself: Next up (or the session in progress), this week and the streak, the calendar (a
 * month a time, ‹ ›), and the setup folds: Exercises (each with its best set), Routines, Program (the programs, the
 * one followed ✓, and its rotation, the next one marked) and Settings. reveal(el) brings something into view with
 * core's flash. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, fmtDate, addDays, todayStr } = K.util;
  const { plural, fmtMinutes, fmtDay, unit } = A;
  const VIEWS = { home: "homeView", session: "sessionView" };

  // Puts a view on screen: "home", or "session" while one is in progress.
  function showView(view) {
    S.view = view === "session" && S.live ? "session" : "home";
    A.renderAll();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    S.knownToday = todayStr();
    if (S.view === "session" && !S.live) S.view = "home"; // finished or cancelled in another tab
    Object.entries(VIEWS).forEach(([v, id]) => { $(id).hidden = v !== S.view; });
    if (S.view === "session") A.renderSession();
    else renderHome();
  }

  // ==========================================================================
  // Next up: the next routine with Start, or the session in progress with Resume
  // ==========================================================================
  function nextUpHTML() {
    const head = text => `<div class="next-label">${text}</div>`;
    if (S.live) {
      return head("In progress") + `<div class="next-name">${esc(S.live.name)}</div>` +
        `<div class="next-meta"><span id="liveElapsed">${esc(A.elapsedText())}</span> · ${plural(S.live.sets.length, "set")} logged</div>` +
        `<button type="button" class="big" data-act="resume">Resume</button>` +
        `<div class="next-links"><button type="button" class="more-link" data-act="discard">Discard</button></div>`;
    }
    if (!A.liveRoutines().length) return head("Next up") + `<div class="next-empty">Add your exercises and a routine below.</div>`;
    const r = A.upNext();
    if (!r) {
      return head("Next up") + `<div class="next-empty">Add a routine to the program to see what's next.</div>` +
        `<button type="button" class="secondary" data-act="pick">Pick a routine&hellip;</button>`;
    }
    const last = A.lastOf(r.id);
    const meta = [last ? `Last: ${fmtDay(last.date)}` : "Not done yet", last ? `usually ${fmtMinutes(A.usualMinutes(r.id))}` : "", plural(A.routineItems(r).length, "exercise")];
    return head("Next up") + `<div class="next-name">${esc(r.name)}</div><div class="next-meta">${esc(meta.filter(Boolean).join(" · "))}</div>` +
      `<button type="button" class="big" data-act="start" data-id="${esc(r.id)}">Start</button>` +
      `<div class="next-links"><button type="button" class="more-link" data-act="pick">Pick another routine&hellip;</button></div>`;
  }

  // ==========================================================================
  // The calendar: Monday to Sunday, a filled day for each with workouts ("×2" for more), today outlined
  // ==========================================================================
  function renderCalendar(today) {
    const thisMonth = today.slice(0, 7), month = S.month && S.month < thisMonth ? S.month : thisMonth;
    S.month = month === thisMonth ? "" : month;
    $("calTitle").textContent = fmtDate(`${month}-01`, { month: "long", year: "numeric" });
    $("calNext").disabled = month === thisMonth;
    const cells = A.monthCells(month), monday = cells[0].date;
    const heads = Array.from({ length: 7 }, (_, i) => `<div class="cal-wd" aria-hidden="true">${esc(fmtDate(addDays(monday, i), { weekday: "short" }))}</div>`);
    $("calGrid").innerHTML = heads.concat(cells.map(c => {
      const n = c.sessions.length, cls = `cal-day${c.inMonth ? "" : " out"}${c.date === today ? " today" : ""}${n ? " filled" : ""}`;
      const day = `<span class="cal-n">${+c.date.slice(8)}</span>${n > 1 ? `<span class="cal-x">&times;${n}</span>` : ""}`;
      if (!n) return `<div class="${cls}">${day}</div>`;
      const label = `${fmtDate(c.date, { weekday: "long", month: "long", day: "numeric" })}: ${c.sessions.map(s => s.name || "Workout").join(", ")}`;
      return `<button type="button" class="${cls}" data-act="day" data-date="${c.date}" aria-label="${esc(label)}">${day}</button>`;
    })).join("");
  }
  // ‹ › a month back or on (never past this one).
  function moveMonth(by) {
    const thisMonth = todayStr().slice(0, 7), shown = S.month || thisMonth;
    const next = addDays(`${shown}-15`, by * 30).slice(0, 7); // the 15th, a month on, is always in the next month
    S.month = next >= thisMonth ? "" : next;
    renderCalendar(todayStr());
  }

  // ==========================================================================
  // The setup folds
  // ==========================================================================
  // A row that opens its pop-up: its name, and a line about it.
  const rowHTML = (act, id, name, meta) => `<button type="button" class="row-btn" data-act="${act}" data-id="${esc(id)}">` +
    `<span class="row-name">${esc(name)}</span>${meta ? `<span class="row-meta">${esc(meta)}</span>` : ""}</button>`;

  function renderExercises() {
    const list = A.liveExercises();
    $("exercisesCount").textContent = list.length ? `(${list.length})` : "";
    $("exercisesEmpty").hidden = list.length > 0;
    $("starterBtn").hidden = list.length > 0;
    $("exercisesList").innerHTML = list.map(e => {
      const b = A.bestOf(e);
      return rowHTML("edit-exercise", e.id, e.name, b ? `best ${A.bestText(e)} · ${fmtDay(b.date)}` : e.bodyweight ? "bodyweight" : "");
    }).join("");
  }

  function renderRoutines() {
    const list = A.liveRoutines(), none = !A.liveExercises().length;
    $("routinesCount").textContent = list.length ? `(${list.length})` : "";
    $("routinesEmpty").hidden = list.length > 0;
    $("routinesEmpty").textContent = none ? "Add exercises first, then a routine to do them in." : "No routines yet. A routine is a workout: its exercises, with sets, reps and weights.";
    $("addRoutineBtn").disabled = none;
    $("routinesList").innerHTML = list.map(r => {
      const meta = [plural(A.routineItems(r).length, "exercise"), A.lastOf(r.id) ? `usually ${fmtMinutes(A.usualMinutes(r.id))}` : ""];
      return rowHTML("edit-routine", r.id, r.name, meta.filter(Boolean).join(" · "));
    }).join("");
  }

  // The programs (the one followed ✓; tap another to follow it, from its first routine), Rename (the one followed) and
  // New program; then the rotation followed, each with ↑ ↓ ✕, the next workout marked; Add to program takes any
  // routine, as often as you like.
  function renderProgram() {
    const order = A.liveOrder(), next = A.nextIndex(), routines = A.liveRoutines(), active = A.activeProgram();
    const btn = (act, i, label, text, ok = true) => `<button type="button" class="icon-btn" data-act="${act}" data-i="${i}" aria-label="${esc(label)}"${ok ? "" : " disabled"}>${text}</button>`;
    $("programChips").innerHTML = A.livePrograms().map(p => `<button type="button" class="pill${p === active ? " active" : ""}" data-act="prog-pick" data-id="${esc(p.id)}" aria-pressed="${p === active}">` +
      `${p === active ? "&#10003; " : ""}${esc(p.name)}</button>`).join("") +
      (active ? `<button type="button" class="more-link" data-act="prog-rename">Rename</button>` : "") +
      `<button type="button" class="more-link" data-act="prog-new">+ New program</button>`;
    $("programEmpty").hidden = order.length > 0;
    $("programList").innerHTML = order.map((id, i) => {
      const name = A.routineById(id).name;
      return `<li class="prog-row${i === next ? " next" : ""}"><span class="prog-n">${i + 1}.</span><span class="prog-name">${esc(name)}</span>` +
        (i === next ? `<span class="badge next-badge">next</span>` : "") + `<span class="prog-btns">` +
        btn("prog-up", i, `Move ${name} up`, "&uarr;", i > 0) + btn("prog-down", i, `Move ${name} down`, "&darr;", i < order.length - 1) +
        btn("prog-remove", i, `Take ${name} out of the program`, "&times;") + `</span></li>`;
    }).join("");
    const picked = $("programSelect").value;
    $("programSelect").innerHTML = routines.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    if (routines.some(r => r.id === picked)) $("programSelect").value = picked;
    $("programSelect").disabled = $("programAddBtn").disabled = !routines.length;
    $("programNote").textContent = `${active ? `You follow “${active.name}”: its workouts` : "Workouts"} go in this order, round and round. Momo asks for ${plural(S.settings.weeklyTarget, "workout")} a week in it.`;
  }

  function renderSettings() {
    $("unitToggle").querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset.unit === unit());
      b.setAttribute("aria-pressed", String(b.dataset.unit === unit()));
    });
    if (document.activeElement !== $("targetInput")) $("targetInput").value = S.settings.weeklyTarget;
  }

  function renderHome() {
    const today = S.knownToday;
    $("nextUp").innerHTML = nextUpHTML();
    $("weekVal").textContent = `${A.thisWeek()} of ${S.settings.weeklyTarget}`;
    const streak = A.streak();
    $("streakVal").textContent = streak ? plural(streak, "week") : "No streak yet";
    renderCalendar(today);
    renderExercises();
    renderRoutines();
    renderProgram();
    renderSettings();
  }

  // Brings an element into view, with core's flash.
  function reveal(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash");
    void el.offsetWidth; // so the flash starts again
    el.classList.add("flash");
  }

  Object.assign(A, { showView, renderAll, renderHome, moveMonth, reveal });
})(Kyoshi, Kyoshi.apps.badgermole);
