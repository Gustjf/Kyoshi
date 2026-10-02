/* Badgermole · events.js — loads last: wires the page (A.init): the pop-ups (editors.js, day.js), the session's
 * controls (session.js), the buttons drawn into the page (data-act), the calendar's ‹ ›, the setup folds (open on a
 * wide window, folded on a phone but for the one to do first), and the session's minutes; and the hooks Kyoshi calls:
 * onShow / onHide (the screen stays awake during a session only while Badgermole is on screen), onTick (a new day; the
 * session's minutes), onReload (another tab saved) and bugState (counts only: never names). No dot on the icon. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { todayStr } = K.util;
  const FOLDS = ["exercises", "routines", "program", "settings"];

  // Buttons drawn into the page say what they do in data-act (and whose, in data-id, data-i or data-date).
  const ACTS = {
    start: el => A.startSession(el.dataset.id),
    home: () => A.showView("home"), // the session carries on (Resume)
    resume: () => A.resume(),
    discard: () => A.discard(),
    pick: () => A.openPick(),
    day: el => A.openDay(el.dataset.date),
    "edit-exercise": el => A.openExercise(el.dataset.id),
    "edit-routine": el => A.openRoutine(el.dataset.id),
    "prog-up": el => A.moveInProgram(+el.dataset.i, -1),
    "prog-down": el => A.moveInProgram(+el.dataset.i, 1),
    "prog-remove": el => A.removeFromProgram(+el.dataset.i),
    relog: el => A.relog(+el.dataset.i),
    jump: el => A.jumpTo(+el.dataset.i)
  };

  // The setup folds: open on a wide window; on a phone folded, so Next up and the calendar come first — but for the
  // one there is to do first (no exercises, no routine, an empty program).
  function openFolds() {
    const wide = window.innerWidth > 640;
    const todo = !A.liveExercises().length ? "exercises" : !A.liveRoutines().length ? "routines" : !A.liveOrder().length ? "program" : "";
    FOLDS.forEach(id => { $(`${id}Box`).open = wide || id === todo; });
  }

  A.init = () => {
    A.wireEditors();
    A.wireDay();
    A.wireSession();
    A.root.addEventListener("click", e => {
      const el = e.target.closest("[data-act]");
      if (el && ACTS[el.dataset.act]) ACTS[el.dataset.act](el);
    });
    $("calPrev").addEventListener("click", () => A.moveMonth(-1));
    $("calNext").addEventListener("click", () => A.moveMonth(1));
    // The session's minutes, and the screen kept awake again when the page comes back.
    setInterval(A.updateElapsed, 15000);
    A.listen(document, "visibilitychange", () => { if (!document.hidden) A.keepAwake(true); });
    openFolds();
    if (S.live) S.view = "session"; // a reload resumes the session in progress
    A.renderAll();
  };

  A.onShow = () => {
    A.renderAll();
    A.keepAwake(true);
  };
  A.onHide = () => A.keepAwake(false);

  // Every minute, and when the page is back in view: a new day moves the week, the streak and the calendar.
  A.onTick = () => {
    if (todayStr() !== S.knownToday) A.renderAll();
    else A.updateElapsed();
  };

  // Another tab saved (A.load has read it): show it (the session view stays while its session does).
  A.onReload = () => {
    A.renderAll();
    if (!S.live) A.keepAwake(false);
  };

  // Bug reports: counts and settings only — never the names of exercises or routines.
  A.bugState = () => {
    const l = S.live, deleted = ["exercises", "routines", "sessions"].map(k => S[k].filter(x => x.deleted).length).join("/");
    return [
      `- Exercises: ${A.liveExercises().length} (${A.liveExercises().filter(e => e.bodyweight).length} bodyweight); routines: ${A.liveRoutines().length}; program: ${A.liveOrder().length} (next ${A.nextIndex() + 1})`,
      `- Sessions: ${A.sessions().length}; this week ${A.thisWeek()} of ${S.settings.weeklyTarget}; streak ${A.streak()}; deleted markers ${deleted}`,
      `- Session in progress: ${l ? `yes, ${l.sets.length} sets, exercise ${l.pos.item + 1} of ${l.items.length}` : "no"}; view: ${S.view}; unit: ${S.settings.unit}`,
      `- Pop-ups: ${S.editing ? `${S.editing.kind} editor` : "none"}${S.day ? ", day" : ""}`
    ];
  };
})(Kyoshi, Kyoshi.apps.badgermole);
