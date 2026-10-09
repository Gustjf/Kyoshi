/* Pabu · events.js — loads last: wires the page (A.init): quick add (Enter or Add adds the person, with one call, text or
 * visit, or none for birthday only; it clears the field and keeps its focus; tapping a chip leaves the phone's keyboard
 * up), This week's ✓ and its undo, the group chips, and the names that open the pop-up; and the hooks Kyoshi calls:
 * onTick (a new day), onReload (another tab saved), attention (calls, texts and visits overdue; DOT_WHEN_OVERDUE turns
 * it off), renderDev (Developer Mode's Set up…) and bugState. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { newId, now, addDays, todayStr } = K.util;
  const { MAX_NAME, MAX_TALKS, HOW, SOON_DAYS, DEFAULT_EVERY, DEFAULT_HOW, DOT_WHEN_OVERDUE } = A;

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

  // Quick add: the person, with one call, text or visit as the chips say (how's usual minutes), or none for birthday
  // only. Then the field clears and keeps its focus for the next one, and the chips go back to every month and a call.
  // Never talked, it's due the day added.
  function add() {
    const name = A.cleanLine($("addName").value, MAX_NAME), { every, how } = S.add;
    if (!name) {
      setStatus("Type a name first.", true);
      return $("addName").focus();
    }
    const at = now(), what = HOW[how].label.toLowerCase(); // when they were added, time travel too: due that day
    const cadences = every === "none" ? [] : [{ id: newId(), every, how, minutes: HOW[how].minutes, talks: [], at }];
    S.people.push({ id: newId(), name, group: "", note: "", birthday: "", partner: false, anniversary: "", cadences, deleted: false, at, u: Date.now() });
    A.save();
    S.add = { every: DEFAULT_EVERY, how: DEFAULT_HOW };
    $("addName").value = "";
    A.renderAll();
    setStatus(every === "none" ? `Added ${name}, birthday only: tap the name to add the birthday.` : `Added ${name}: a ${what} ${A.everyWords({ every })}.`);
    $("addName").focus();
  }

  // This week's ✓: talked today (that call, text or visit is due again from today; ✓ on its card in Momo). ✓ again takes
  // off the day that ticked it, the last this week. The person's other calls, texts and visits stay as they are.
  function tick(id, cid, on) {
    const p = A.personById(id), c = A.cadenceById(p, cid), today = todayStr();
    if (!c) return;
    const monday = A.mondayOf(today), done = c.talks.find(d => d >= monday && d <= today);
    if (on ? c.talks.includes(today) : !done) return;
    c.talks = on ? [today].concat(c.talks).sort().reverse().slice(0, MAX_TALKS) : c.talks.filter(d => d !== done);
    p.u = Date.now();
    A.save();
    A.renderAll();
  }

  // Buttons drawn into the page carry data-act and data-id (and This week's, data-cid; a group chip, data-group: none
  // for All, "" for No group).
  const ACTS = {
    tick: btn => tick(btn.dataset.id, btn.dataset.cid, true),
    untick: btn => tick(btn.dataset.id, btn.dataset.cid, false),
    edit: btn => A.openEditor(btn.dataset.id),
    filter: btn => { S.filter = "group" in btn.dataset ? btn.dataset.group : null; A.renderAll(); }
  };

  A.init = () => {
    A.wireEditor();
    A.wireSetup();
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

  // Every minute, and whenever the page is back in view: at a new day, who's due changes (and on a Monday, This week).
  A.onTick = () => { if (todayStr() !== S.knownToday) A.renderAll(); };

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // A dot on Pabu's icon while any call, text or visit is overdue: "1 call and 2 texts overdue" (DOT_WHEN_OVERDUE in
  // app.js turns it off).
  A.attention = () => {
    const today = todayStr(), late = DOT_WHEN_OVERDUE ? A.allDue(today).filter(r => r.due < today) : [];
    const words = Object.keys(HOW).map(h => [h, late.filter(r => A.howOf(r.c) === h).length]).filter(([, n]) => n)
      .map(([h, n]) => A.plural(n, HOW[h].label.toLowerCase()));
    return words.length ? `${words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0]} overdue` : "";
  };

  // Developer Mode's tools: Set up… (setup.js), Developer Mode closing first, as Bosco's start-up info does.
  A.renderDev = box => {
    box.innerHTML = `<div class="dev-block"><button class="secondary small" id="pabuSetupBtn">Set up…</button>
      <div class="dev-hint">Who you're in a relationship with, and your anniversary: a heart by their name, in the strip when it's near, on Momo's board.</div></div>`;
    box.querySelector("#pabuSetupBtn").addEventListener("click", () => {
      K.dev.toggle();
      A.openSetup();
    });
  };

  // Bug reports: counts and settings only — never names, groups, notes, birthdays or the anniversary.
  A.bugState = () => {
    const today = todayStr(), people = A.live(), all = A.allDue(today), week = A.thisWeek(today), soon = addDays(today, SOON_DAYS);
    const count = test => all.filter(r => test(r.due)).length;
    return [
      `- People: ${people.length} (birthday only ${people.filter(p => !p.cadences.length).length}, in a group ${people.filter(p => p.group).length}; groups ${A.groupsInUse().length}); +${S.people.length - people.length} deleted`,
      `- Calls, texts, visits: ${all.length} (overdue ${count(d => d < today)}, due today ${count(d => d === today)}, within ${SOON_DAYS} days ${count(d => d > today && d <= soon)}); this week ${week.length}, done ${week.filter(r => r.done).length}`,
      `- With a birthday: ${people.filter(p => p.birthday).length}; with notes: ${people.filter(p => p.note).length}; talks kept: ${all.reduce((n, r) => n + r.c.talks.length, 0)}`,
      `- Partner: ${people.some(p => p.partner) ? "set" : "none"}; anniversary: ${people.some(p => A.anniversaryOf(p)) ? "yes" : "no"}`,
      `- Quick add: every ${S.add.every}, how ${S.add.how}; chips: ${S.filter === null ? "all" : S.filter ? "a group" : "no group"}; pop-up: ${S.editing ? "open" : "closed"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.pabu);
