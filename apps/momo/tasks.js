/* Momo · tasks.js — Tasks, the strip under the To Be Budgeted bank: a task to draw from for each
 * thing with maintenance coming up in Appa, each long-term goal still to reach and each thing in
 * progress in Wan Shi Tong (read through their read-only momoTasks / inProgress), then the week's
 * cards without a day (parked). A goal's or Wan Shi Tong's task has no hours and is never used up:
 * dragging it onto a day adds a new card of DRAW_HOURS (drag.js, drop.js), as often as you like, and
 * clicking it opens that new card in the editor, to put on several days at once. Appa's is sized to the
 * jobs' time and shows until cards with its title on days from today, this week or next, hold that
 * much ("funded"); it draws a card of what's left, and its cards link back to Appa. Tasks aren't
 * stored: they're read afresh whenever they're drawn. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, addDays, todayStr } = K.util;
  const { DRAW_HOURS, STEP, fmtH, cleanText, snap, clampHours, thisWeekKey, nextWeekKey } = A;

  // What another app shares with Momo, read-only; none while it isn't there or hasn't started
  // (they start after Momo, so Momo's very first drawing has none).
  function readApp(id, fn, what) {
    const P = K.apps[id];
    try {
      return P && P.started && P[fn] ? P[fn]() : [];
    } catch (err) {
      console.warn(`Couldn't read ${what}.`, err);
      return [];
    }
  }
  // What's in progress in Wan Shi Tong: [{ id, name, kind }].
  const inProgress = () => readApp("wanshitong", "inProgress", "what's in progress in Wan Shi Tong");
  // Appa's maintenance coming up, one per thing: [{ id, title, items: [{ id, name, minutes, due, overdue }] }].
  const appaTasks = () => readApp("appa", "momoTasks", "Appa's maintenance");

  // Hours on cards with a title (any case), on days from today on, this week and next: what funds Appa's task.
  function scheduled(title) {
    const t = title.toLowerCase(), today = todayStr();
    return [thisWeekKey(), nextWeekKey()].reduce((n, key) => n + A.weekOf(key).cards
      .filter(c => c.day !== null && !c.base && c.title.toLowerCase() === t && addDays(key, c.day) >= today)
      .reduce((h, c) => h + c.hours, 0), 0);
  }

  // The tasks, in order: Appa's (what isn't funded yet), each goal still to reach (as the goals list
  // has them), then what's in progress in Wan Shi Tong; each { key, title, goalId, kind, hours?, app?,
  // items?, due?, overdue? }. One with the title of a task before it is left out, as it would draw the same card.
  function tasks() {
    const out = [], titles = new Set();
    const add = (key, title, goalId, kind, more = {}) => {
      const t = title.toLowerCase();
      if (!title || (!goalId && titles.has(t))) return;
      titles.add(t);
      out.push({ key, title, goalId, kind, ...more });
    };
    appaTasks().forEach(a => {
      const title = cleanText(String(a.title || "")), items = Array.isArray(a.items) ? a.items : [];
      const need = clampHours(items.reduce((n, i) => n + (Number(i.minutes) > 0 ? Number(i.minutes) : 0), 0) / 60), left = snap(need - scheduled(title));
      const due = items.map(i => i.due).filter(Boolean).sort()[0] || "";
      if (left >= STEP) add(`a:${a.id}`, title, null, "maintenance", { hours: left, app: "appa", appId: String(a.id), items: items.map(i => String(i.name || "")), due, overdue: items.some(i => i.overdue) });
    });
    A.liveGoals().filter(g => !A.isReached(g)).forEach(g => add(`g:${g.id}`, g.name, g.id, "goal"));
    inProgress().forEach(i => add(`w:${i.id}`, cleanText(String(i.name || "")), null, typeof i.kind === "string" ? i.kind : ""));
    return out;
  }
  const taskBy = key => tasks().find(t => t.key === key) || null;
  const tasksKey = list => JSON.stringify(list.map(t => [t.key, t.title, t.hours || 0, t.due || "", t.overdue || false]));

  // Appa's task for a card or task title (funded or not): what its "Open in Appa" line needs, or null.
  function appaFor(title) {
    const t = cleanText(String(title || "")).toLowerCase();
    const a = t && appaTasks().find(x => cleanText(String(x.title || "")).toLowerCase() === t);
    return a ? { id: String(a.id), items: (a.items || []).map(i => String(i.name || "")) } : null;
  }

  // A new card drawn from a task: its title and goal, as long as the task says (else DRAW_HOURS), not on a day yet.
  const drawCard = t => ({ id: newId(), title: t.title, hours: t.hours || DRAW_HOURS, day: null, goalId: t.goalId, base: false, parentId: null, pos: "bottom", pin: null });

  // A task is the outline of a card, with no hours, in its title's colour (once a card has one) or its
  // goal's. Appa's shows its icon and the time still to schedule.
  function taskHTML(t) {
    const hours = t.hours || DRAW_HOURS, appa = t.app && K.apps[t.app];
    const what = t.app ? `${t.items.join(", ")}, from Appa${t.overdue ? ", overdue" : t.due ? `, due ${K.util.fmtShort(t.due)}` : ""}` : t.goalId ? "goal" : `${t.kind ? `${t.kind.toLowerCase()} ` : ""}in progress in Wan Shi Tong`;
    const label = `${t.title} (${what}) — drag onto a day to add ${fmtH(hours)}, or click to pick days`;
    return `<div class="card parked task${t.goalId ? " is-goal" : ""}${t.app ? " from-app" : ""}${t.overdue ? " late" : ""}" data-task="${esc(t.key)}" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}" style="--c:${A.cardColor(t)}">` +
      (appa ? `<span class="app-icon" aria-hidden="true">${appa.meta.icon}</span>` : "") +
      `<span class="card-title">${esc(t.title)}</span>${t.app ? `<span class="task-hours">${fmtH(hours)}</span>` : ""}</div>`;
  }

  // Draws Tasks for the board on screen (none on a closed week): the tasks, then the week's cards
  // without a day, whose hours aren't budgeted yet, with their total. The baseline's cards are
  // all on days, and it has no Appa tasks (maintenance isn't a weekly habit).
  function renderTasks(list, key, b) {
    const isBase = key === "base", locked = !isBase && list.closed, all = tasks(), shown = isBase ? all.filter(t => !t.app) : all;
    S.tasksKey = tasksKey(all);
    $("tasks").hidden = locked;
    if (locked) return;
    const parked = isBase ? [] : list.cards.filter(c => c.day === null && !c.parentId);
    const sources = ["your long-term goals"].concat(K.apps.wanshitong ? "what's in progress in Wan Shi Tong" : [], K.apps.appa && !isBase ? "maintenance coming up in Appa" : []);
    const from = sources.length > 1 ? `${sources.slice(0, -1).join(", ")} and ${sources[sources.length - 1]}` : sources[0];
    $("taskCards").innerHTML = shown.map(taskHTML).join("") + parked.map(c => A.cardHTML(list, c)).join("") ||
      `<span class="tasks-empty">${from[0].toUpperCase()}${from.slice(1)} show up here to drag onto a day.${isBase ? "" : " Drop a card here to take it off its day."}</span>`;
    $("tasksTotal").textContent = !parked.length ? "" : `${fmtH(b.parked)}${b.parked > b.free ? ` · only ${fmtH(b.free)} free` : ""}`;
  }

  // A click on a task (or Enter) opens a new card like the ones it draws, to put on the days picked.
  function openTask(key) {
    const t = taskBy(key);
    if (t) A.openCardEditor(null, { noDay: true, from: t });
    else A.renderAll(); // gone meanwhile: finished in Wan Shi Tong, say
  }

  // Other apps don't tell Momo when what they share changes (in another tab, or from another device
  // through sync), so every minute Tasks is drawn again if it did.
  function checkTasks() {
    if (A.isActive() && tasksKey(tasks()) !== S.tasksKey) A.renderAll();
  }

  Object.assign(A, { tasks, taskBy, appaFor, drawCard, renderTasks, openTask, checkTasks });
})(Kyoshi, Kyoshi.apps.momo);
