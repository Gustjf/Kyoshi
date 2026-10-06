/* Kyoshi · tests/sim/check.js — the checks run every step (testplan.md, "The checks"): one snapshot of the page read at one moment
 * (every app's own truth, what each asks of Momo, what Momo drew from, the signals), then A: Momo as the source of truth
 * (complete, nothing dropped or doubled, minutes, due, done, events, the week change), with B (where I stand) in standing.js
 * and the close-out's in plan.js. A failed check is a finding (findings.js) with its evidence: life, seed, date, step. */
"use strict";

// --- The snapshot, in the page: what every app says and what Momo shows, read at one moment ---
function SNAP() {
  const K = Kyoshi, U = K.util, M = K.apps.momo, today = U.todayStr(), thisKey = M.thisWeekKey(), nextKey = M.nextWeekKey(), sunday = U.addDays(nextKey, 6);
  const key = n => `${n.app}:${n.id}`, out = { today, now: U.now(), active: K.active() ? K.active().id : "", thisKey, nextKey, truth: {}, signals: {}, meetings: {} };
  const need = n => ({ key: key(n), app: n.app, id: n.id, title: n.title, block: n.block, fill: n.fill, minutes: n.minutes, date: n.date, due: n.due, from: n.from, overdue: n.overdue, done: n.done });
  const fillOf = f => f && {
    key: f.key, needs: f.needs.map(need), short: f.short.map(n => ({ key: key(n), minutes: n.minutes })),
    blocks: f.blocks.map(b => ({ key: b.key, date: b.date, card: b.card.id, title: b.card.title, room: b.room, used: b.used, needs: b.needs.map(key) })),
    tasks: { this: M.tasks(f, thisKey).map(t => ({ key: t.key, title: t.title, hours: t.hours, overdue: !!t.overdue, ongoing: !!t.ongoing, needs: t.needs.map(key) })),
      next: M.tasks(f, nextKey).map(t => ({ key: t.key, title: t.title, hours: t.hours, overdue: !!t.overdue, ongoing: !!t.ongoing, needs: t.needs.map(key) })) }
  };
  out.inboxKey = JSON.stringify(K.inbox(thisKey, sunday)); // Momo asks from this Monday (its past days show what was done)
  out.fresh = fillOf(M.fill());
  out.drawn = fillOf(M.S.fill);
  out.stale = !M.S.fill || M.S.fill.key !== out.inboxKey;
  out.agenda = K.agenda(thisKey, sunday).map(e => ({ key: `${e.app}:${e.id}`, app: e.app, title: e.title, date: e.date, time: e.time, done: e.done }));
  const weeks = M.S.data.weeks;
  out.momo = {
    view: M.S.view, todayView: M.S.today, closing: M.S.closing ? M.S.closing.key : "", later: M.S.closeOutLater, review: M.reviewWeeks(),
    weeks: Object.keys(weeks).length, closed: Object.keys(weeks).filter(k => weeks[k].closed), baseline: M.S.data.baseline.cards.length,
    prev: (w => ({ stored: !!w, closed: !!w && w.closed, spent: !!w && !!w.spent, cards: w ? w.cards.length : 0 }))(weeks[U.addDays(thisKey, -7)]),
    cards: Object.fromEntries([thisKey, nextKey].map(k => [k, (weeks[k] || { cards: [] }).cards.map(c => ({ id: c.id, title: c.title, hours: c.hours, day: c.day, base: c.base }))]))
  };
  // Each app's own truth: is it behind, and why.
  const T = (id, fn) => { const A = K.apps[id]; if (A && A.started) try { out.truth[id] = fn(A); } catch (err) { out.truth[id] = { error: String(err && err.message || err) }; } };
  T("hawky", H => ({ open: H.openItems().length, overdue: H.overdueItems().map(i => i.id), today: H.openItems().filter(i => i.due === today).length, undated: H.openItems().filter(i => !i.due).length,
    later: H.openItems().filter(i => i.due && i.due > sunday).map(i => i.id), doneToday: H.live().filter(i => i.done === today).map(i => i.id) }));
  T("pabu", P => { const due = P.withDue(P.live().filter(p => P.everyOf(p) !== "none"), today); return { people: P.live().length, due: due.filter(([, d]) => d <= today).map(([p]) => `p:${p.id}`), overdue: due.filter(([, d]) => d < today).map(([p]) => `p:${p.id}`), birthdayOnly: P.live().filter(p => P.everyOf(p) === "none").length }; });
  T("appa", P => { const up = P.upcoming(); return { overdue: up.filter(x => x.status === "overdue").map(x => x.job.id), soon: up.filter(x => x.status === "soon").map(x => x.job.id), reading: P.activeThings().filter(P.readingAsk).map(t => `reading:${t.id}`), jobs: up.length }; });
  T("badgermole", B => { const done = B.weekCount(B.mondayOf(today)), target = B.S.settings.weeklyTarget, left = 7 - M.dayIndex(today); return { done, target, left, planned: B.nextIndex() >= 0, behind: B.nextIndex() >= 0 && target - done > left, todayDone: B.sessions().filter(s => s.date === today).map(s => `session:${s.id}`) }; });
  T("turtleduck", D => { const days = []; for (let d = today; d <= U.addDays(thisKey, 6); d = U.addDays(d, 1)) days.push(d); return { unplanned: days.filter(d => !D.entriesOn(d, "dinner").length).length, recipes: D.liveRecipes().length, trips: D.liveTrips().filter(t => t.date >= today).map(t => t.date) }; });
  T("iroh", I => {
    const goals = I.goalsIn(I.currentSeason()).filter(g => I.isOpen(g) && (g.hoursWeek || g.hoursTotal));
    const rows = goals.map(g => { const p = I.progressOf(g); return { id: g.id, title: g.title, hoursWeek: g.hoursWeek, hoursTotal: g.hoursTotal, spent: p ? p.spent : null, closed: p ? p.closed : null, behind: p ? I.behindBy(g, p) : 0, weekly: I.weeklyMinutes(g, p) }; });
    return { season: I.currentSeason(), goals: rows, behind: rows.filter(r => r.hoursWeek && r.behind > r.hoursWeek).map(r => r.title), stale: goals.filter(g => I.isStale(g)).length, all: I.liveGoals().length };
  });
  T("bosco", B => { const s = B.doseSchedule(); return { late: s.filter(d => d.due && d.date < today).map(d => d.date), due: s.filter(d => d.due).map(d => d.date), asking: !!B.S.doseAsking }; });
  T("wanshitong", W => ({ now: W.nowItems().length }));
  T("momo", () => ({ pending: M.reviewWeeks(), conflicts: M.conflicts().length }));
  // The signals: each app's dot (the switcher's), its meetings (as bug reports word them), and the switch button's tooltip.
  K.order.forEach(id => {
    const A = K.apps[id];
    if (!A.started || A.meta.hidden) return; // the hidden Kyoshi app (core's record) has no icon, no dot
    let why = "";
    try { why = (typeof A.attention === "function" ? A.attention() : "") || K.meetings.attention(A); } catch (err) { why = ""; }
    out.signals[id] = why;
    out.meetings[id] = K.meetings.bugLine(A);
  });
  out.tooltip = document.getElementById("kSwitchBtn").title;
  out.dot = !document.getElementById("kSwitchDot").hidden;
  return out;
}

// --- Checks on Momo, against what the apps ask of it (s: a snapshot; dom: the board on screen, from tests/momo.js) ---
// Each problem goes to L.find(key, kind, …, evidence). Counts go to L.count(name, n).
function momo(L, s, dom) {
  const f = s.drawn;
  if (!f) return;
  if (s.stale) L.find("stale-board", { kind: "signal", sev: "occasional", title: "Momo's board lags what the apps ask", where: "apps/momo/tasks.js:87 checkTasks" }, `the board was drawn from an older list of needs than the apps give now (${s.active} on screen)`);
  const today = s.today, placed = new Map(), short = new Set(f.short.map(x => x.key));
  f.blocks.forEach(b => b.needs.forEach(k => placed.set(k, (placed.get(k) || []).concat(b))));
  const byKey = new Map(f.needs.map(n => [n.key, n]));
  f.needs.forEach(n => {
    if (n.fill === "ongoing") return;
    const on = placed.get(n.key) || [], tasked = short.has(n.key);
    if (n.fill !== "hours") {
      if (n.done && !on.length) {
        L.count(`doneHidden:${n.app}`);
        L.find(`done-no-card:${n.app}`, { kind: "flow", sev: "daily rub", title: `A ${L.appName(n.app)} need done with no card for it shows nowhere in Momo`, where: "apps/momo/inbox.js:69 (a done need with no block is dropped)", suspect: 4 },
          `${n.title} (done ${n.date}) had no ${n.block} card that day, so Momo shows no ✓ anywhere`);
      }
      if (!n.done && !(n.date && n.date < today) && on.length + (tasked ? 1 : 0) === 0) L.find(`dropped:${n.app}`, { kind: "bug", sev: "blocks the flow", title: "A need is on no card and not in Tasks" }, `${n.app}:${n.title}`);
      if (on.length > 1 || (on.length && tasked)) L.find(`doubled:${n.app}`, { kind: "bug", sev: "blocks the flow", title: "A need shows twice" }, `${n.app}:${n.title} on ${on.length} cards${tasked ? " and in Tasks" : ""}`);
    }
    on.forEach(b => {
      if (n.fill === "hours") return;
      // An errand due weeks from now on this week's card (Hawky sends every open errand, whatever the window).
      if (n.due && n.due > L.addDays(s.nextKey, 6) && !n.done) {
        L.count(`farOnCard:${n.app}`);
        L.find(`far-due:${n.app}`, { kind: "flow", sev: "occasional", title: "A need due weeks from now fills this week's block", where: "apps/hawky/share.js:22 inbox (every open errand, whatever `to`)", suspect: 7 },
          `${L.appName(n.app)}'s “${n.title}”, due ${n.due}, took room on the ${b.title} card of ${b.date}`);
      }
      const why = n.date && b.date !== n.date ? `dated ${n.date}, on ${b.date}` : n.from && b.date < n.from ? `not before ${n.from}, on ${b.date}` : n.due && n.due >= today && b.date > n.due ? `due ${n.due}, on ${b.date}` : "";
      if (why) L.find(`due-broken:${n.app}`, { kind: "bug", sev: "daily rub", title: "A need landed outside its days" }, `${n.app}:${n.title}: ${why}`);
      if (!n.done && (n.overdue || (n.due && n.due < today))) L.count(`overdueOnCard:${n.app}`); // the board marks its card late (board below)
    });
    if (n.done && on.length) L.count(`doneShown:${n.app}`);
  });
  f.blocks.forEach(b => {
    if (b.used > b.room) L.find("over-room", { kind: "bug", sev: "daily rub", title: "A card holds more than its hours" }, `${b.title} on ${b.date}: ${b.used} of ${b.room} minutes`);
    const done = b.needs.map(k => byKey.get(k)).filter(n => n && n.done && n.fill === "time");
    const room = done.reduce((m, n) => m + (n.minutes || 60), 0);
    const pushed = done.length && f.short.some(x => { const n = byKey.get(x.key); return n && n.fill === "time" && n.block.toLowerCase() === b.title.toLowerCase() && (n.minutes || 60) <= b.room - b.used + room && (!n.date || n.date === b.date) && (!n.from || b.date >= n.from) && (!n.due || n.due < today || b.date <= n.due); });
    if (pushed) {
      L.count("doneHoldsRoom");
      L.find("done-holds-room", { kind: "flow", sev: "occasional", title: "Done needs keep their card's room, pushing an open one to Tasks", where: "apps/momo/inbox.js:66-74 (done needs still use room)", suspect: 4 },
        `${b.title} on ${b.date}: ${done.length} done (${room} min) kept the room an open one needed, which went to Tasks`);
    }
  });
  // Missing minutes become 60: which needs come without minutes.
  f.needs.filter(n => !n.minutes && n.fill !== "ongoing").forEach(n => L.count(`noMinutes:${n.app}:${n.fill}`));
  // Tasks: a timed or one-per-block shortfall shows on both weeks' boards whatever its days.
  [["this", s.thisKey], ["next", s.nextKey]].forEach(([w, k]) => f.tasks[w].forEach(t => {
    if (t.ongoing) return;
    const needs = t.needs.map(x => byKey.get(x)).filter(Boolean), sunday = L.addDays(k, 6);
    const elsewhere = needs.length && needs.every(n => n.fill !== "hours" && ((n.date && (n.date < k || n.date > sunday)) || (n.from && n.from > sunday) || (n.due && n.due >= today && n.due < k)));
    if (elsewhere) {
      L.count("taskWrongWeek");
      L.find("task-wrong-week", { kind: "flow", sev: "daily rub", title: "Tasks lists needs on a week they can't go on", where: "apps/momo/tasks.js:28-45 (time and block shortfalls show on both boards)", suspect: 6 },
        `${w === "this" ? "This" : "Next"} week's Tasks showed “${t.title}” (${needs.map(n => `${n.title}${n.date ? ` on ${n.date}` : n.due ? ` due ${n.due}` : ""}${n.from ? ` from ${n.from}` : ""}`).join(", ")}), none of which can go on that week`);
    }
  }));
  if (dom) board(L, s, dom, byKey, placed);
}

// The board on screen against the model: cards all done show ✓ and only then; "all assigned ✓" while Tasks has items.
function board(L, s, dom, byKey, placed) {
  const which = dom.view, key = which === "this" ? s.thisKey : which === "next" ? s.nextKey : "";
  if (!key) return;
  const blocks = new Map(s.drawn.blocks.filter(b => b.key === key).map(b => [b.card, b]));
  dom.days.forEach(d => d.cards.forEach(c => {
    const b = blocks.get(c.id);
    const needs = b ? b.needs.map(k => byKey.get(k)).filter(n => n && n.fill !== "ongoing") : [];
    const all = needs.length > 0 && needs.every(n => n.done), late = !all && needs.some(n => !n.done && (n.overdue || (n.due && n.due < s.today)));
    if (b && all !== c.done) L.find("card-tick-wrong", { kind: "bug", sev: "daily rub", title: "A card's ✓ disagrees with what fills it" }, `${c.title} on ${b.date}: ${c.done ? "✓ shown" : "no ✓"} with ${needs.filter(n => n.done).length} of ${needs.length} done`);
    if (b && late !== !!c.late) L.find("card-late-wrong", { kind: "bug", sev: "daily rub", title: "A card's late mark disagrees with what fills it" }, `${c.title} on ${b.date}: ${c.late ? "marked late" : "not marked late"} with ${needs.filter(n => !n.done && (n.overdue || (n.due && n.due < s.today))).length} late`);
  }));
  const status = (dom.tabs[which] || {}).status || "", tasks = dom.tasks.tasks.filter(t => !t.ongoing);
  if (/all assigned ✓/.test(status) && tasks.length) {
    L.count("allAssignedWithTasks");
    L.find("all-assigned-with-tasks", { kind: "signal", sev: "daily rub", title: "“All assigned ✓” while Tasks still has work for the week", where: "apps/momo/render.js:28-33 renderTabs (status ignores Tasks)", contradictory: true },
      `${which === "this" ? "This" : "Next"} week's tab said “all assigned ✓” and the bank “${dom.bank.msg}”, with ${tasks.length} task${tasks.length === 1 ? "" : "s"} in Tasks (${tasks.map(t => `${t.title} ${t.hours}h`).join(", ")})`);
  }
  // The board's events against what the apps say: on their day, ✓ once done.
  s.agenda.filter(e => e.date >= key && e.date <= L.addDays(key, 6)).forEach(e => {
    const d = dom.days.find(x => x.day === L.dayIndex(e.date)), list = d ? d.events.concat(d.marks) : [];
    const shown = list.find(x => (x.title || "").startsWith(e.title));
    if (!shown) L.find("event-missing", { kind: "bug", sev: "daily rub", title: "An app's event isn't on its day" }, `${e.app}: ${e.title} on ${e.date}`);
    else if (!!shown.done !== !!e.done) L.find("event-tick", { kind: "bug", sev: "occasional", title: "An event's ✓ disagrees with its app" }, `${e.app}: ${e.title} on ${e.date}`);
  });
}

// Today (the phone's) against the board: each of today's cards with what fills it and its ✓.
function today(L, s, t) {
  if (!t) return;
  const rows = t.sections.flatMap(x => x.rows), mine = s.drawn ? s.drawn.blocks.filter(b => b.date === s.today) : [];
  const byKey = new Map(s.drawn ? s.drawn.needs.map(n => [n.key, n]) : []);
  mine.forEach(b => {
    const r = rows.find(x => x.card === b.card);
    if (!r) return; // earlier today: Today leaves it out
    const needs = b.needs.map(k => byKey.get(k)).filter(n => n && n.fill !== "ongoing"), all = needs.length > 0 && needs.every(n => n.done);
    if (r.done !== all) L.find("today-tick", { kind: "bug", sev: "daily rub", title: "Today's ✓ disagrees with the board" }, `${b.title}: Today ${r.done ? "✓" : "no ✓"}, the board's needs ${all ? "all done" : "not all done"}`);
  });
}

module.exports = { SNAP, momo, board, today };
