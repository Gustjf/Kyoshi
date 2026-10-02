/* Pabu · events.js — loads last: wires the page (A.init): quick add (Enter or Add adds the person, clears the field and
 * keeps its focus; tapping a chip leaves the phone's keyboard up), ✓ and its undo, and the names that open the pop-up;
 * and the hooks Kyoshi calls: onTick (a new day), onReload (another tab saved), attention (overdue people, when
 * DOT_WHEN_OVERDUE) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { newId, now, todayStr } = K.util;
  const { MAX_NAME, MAX_TALKS, HOW, DEFAULT_EVERY, DEFAULT_HOW, DOT_WHEN_OVERDUE } = A;

  function setStatus(text, bad = false) {
    $("addStatus").textContent = text;
    $("addStatus").classList.toggle("bad", bad);
  }

  function pickEvery(every) {
    S.add.every = every;
    A.renderAdd();
    setStatus("");
  }
  function pickHow(how) {
    S.add.how = how;
    A.renderAdd();
    setStatus("");
  }

  // Quick add: the person, with the chips' how often and how (and how's usual minutes). Then the field clears and keeps
  // its focus for the next one, and the chips go back to every month and a call. Never talked, they're due the day added.
  function add() {
    const name = A.cleanLine($("addName").value, MAX_NAME), { every, how } = S.add;
    if (!name) {
      setStatus("Type a name first.", true);
      return $("addName").focus();
    }
    const at = now(), what = HOW[how].label.toLowerCase(); // when they were added, time travel too: due that day
    S.people.push({ id: newId(), name, every, how, minutes: HOW[how].minutes, talks: [], note: "", birthday: "", deleted: false, at, u: Date.now() });
    A.save();
    S.add = { every: DEFAULT_EVERY, how: DEFAULT_HOW };
    $("addName").value = "";
    A.renderAll();
    setStatus(every === "none" ? `Added ${name}, birthday only: tap the name to add the birthday.` : `Added ${name}: a ${what} ${A.everyWords({ every })}.`);
    $("addName").focus();
  }

  // ✓: talked today (the next one's due from today; ✓ on today's Keep in touch card in Momo); ✓ again takes today off.
  function tick(id, on) {
    const p = A.personById(id), today = todayStr();
    if (!p || p.talks.includes(today) === on) return;
    p.talks = on ? [today].concat(p.talks).sort().reverse().slice(0, MAX_TALKS) : p.talks.filter(d => d !== today);
    p.u = Date.now();
    A.save();
    A.renderAll();
  }

  // Buttons drawn into the page carry data-act and data-id.
  const ACTS = {
    tick: btn => tick(btn.dataset.id, true),
    untick: btn => tick(btn.dataset.id, false),
    edit: btn => A.openEditor(btn.dataset.id)
  };

  A.init = () => {
    A.wireEditor();
    $("addForm").addEventListener("submit", e => { e.preventDefault(); add(); });
    // Tapping a chip or Add doesn't take the focus, so the phone's keyboard stays up while typing.
    $("addForm").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    $("addEvery").addEventListener("click", e => { const b = e.target.closest("button[data-every]"); if (b) pickEvery(b.dataset.every); });
    $("addHow").addEventListener("click", e => { const b = e.target.closest("button[data-how]"); if (b) pickHow(b.dataset.how); });
    $("addName").addEventListener("input", () => setStatus(""));
    A.root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
    });
    A.renderAll();
  };

  // Every minute, and whenever the page is back in view: at a new day, people move between the groups.
  A.onTick = () => { if (todayStr() !== S.knownToday) A.renderAll(); };

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // A dot on Pabu's icon while anyone's overdue, only with DOT_WHEN_OVERDUE (app.js): Momo carries who's due.
  A.attention = () => {
    const today = todayStr(), n = DOT_WHEN_OVERDUE ? A.live().filter(p => { const due = A.dueOf(p, today); return due && due < today; }).length : 0;
    return n ? `${A.plural(n, "person", "people")} overdue` : "";
  };

  // Bug reports: counts and settings only — never names, notes or birthdays.
  A.bugState = () => {
    const today = todayStr(), people = A.live(), count = g => people.filter(p => A.groupOf(p, today) === g).length;
    return [
      `- People: ${people.length} (due ${count("due")}, coming up ${count("soon")}, later ${count("later")}, birthday only ${count("none")}); +${S.people.length - people.length} deleted`,
      `- With a birthday: ${people.filter(p => p.birthday).length}; talks kept: ${people.reduce((n, p) => n + p.talks.length, 0)}`,
      `- Quick add: every ${S.add.every}, how ${S.add.how}; pop-up: ${S.editing ? "open" : "closed"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.pabu);
