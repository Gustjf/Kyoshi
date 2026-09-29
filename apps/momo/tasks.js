/* Momo · tasks.js — Tasks, the strip under the To Be Budgeted bank: a task to draw from for each
 * long-term goal still to reach and each thing in progress in Wan Shi Tong (read through its
 * read-only A.inProgress), then the week's cards without a day (parked). A task has no hours and
 * is never used up: dragging it onto a day adds a new card of DRAW_HOURS (drag.js, drop.js), as
 * often as you like, and clicking it opens that new card in the editor, to put on several days
 * at once. Tasks aren't stored: they're read afresh whenever they're drawn. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId } = K.util;
  const { DRAW_HOURS, fmtH, cleanText } = A;

  // What's in progress in Wan Shi Tong: [{ id, name, kind }], or none while it isn't there or
  // hasn't started (it starts after Momo, so Momo's very first drawing has none).
  function inProgress() {
    const W = K.apps.wanshitong;
    try {
      return W && W.started && W.inProgress ? W.inProgress() : [];
    } catch (err) {
      console.warn("Couldn't read what's in progress in Wan Shi Tong.", err);
      return [];
    }
  }

  // The tasks, in order: each goal still to reach (as the goals list has them), then what's in
  // progress in Wan Shi Tong; each { key, title, goalId, kind }. One from Wan Shi Tong with the
  // title of a task before it is left out, as it would draw the same card.
  function tasks() {
    const out = [], titles = new Set();
    const add = (key, title, goalId, kind) => {
      const t = title.toLowerCase();
      if (!title || (!goalId && titles.has(t))) return;
      titles.add(t);
      out.push({ key, title, goalId, kind });
    };
    A.liveGoals().filter(g => !A.isReached(g)).forEach(g => add(`g:${g.id}`, g.name, g.id, "goal"));
    inProgress().forEach(i => add(`w:${i.id}`, cleanText(String(i.name || "")), null, typeof i.kind === "string" ? i.kind : ""));
    return out;
  }
  const taskBy = key => tasks().find(t => t.key === key) || null;
  const tasksKey = list => JSON.stringify(list.map(t => [t.key, t.title]));

  // A new card drawn from a task: its title and goal, DRAW_HOURS long, not on a day yet.
  const drawCard = t => ({ id: newId(), title: t.title, hours: DRAW_HOURS, day: null, goalId: t.goalId, base: false, parentId: null, pos: "bottom", pin: null });

  // A task is the outline of a card, with no hours, in its title's colour (once a card has one) or its goal's.
  function taskHTML(t) {
    const what = t.goalId ? "goal" : `${t.kind ? `${t.kind.toLowerCase()} ` : ""}in progress in Wan Shi Tong`;
    const label = `${t.title} (${what}) — drag onto a day to add ${fmtH(DRAW_HOURS)}, or click to pick days`;
    return `<div class="card parked task${t.goalId ? " is-goal" : ""}" data-task="${esc(t.key)}" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}" style="--c:${A.cardColor(t)}">` +
      `<span class="card-title">${esc(t.title)}</span></div>`;
  }

  // Draws Tasks for the board on screen (none on a closed week): the tasks, then the week's cards
  // without a day, whose hours aren't budgeted yet, with their total. The baseline's cards are
  // all on days.
  function renderTasks(list, key, b) {
    const isBase = key === "base", locked = !isBase && list.closed, all = tasks();
    S.tasksKey = tasksKey(all);
    $("tasks").hidden = locked;
    if (locked) return;
    const parked = isBase ? [] : list.cards.filter(c => c.day === null && !c.parentId);
    const from = K.apps.wanshitong ? "Your long-term goals, and what's in progress in Wan Shi Tong," : "Your long-term goals";
    $("taskCards").innerHTML = all.map(taskHTML).join("") + parked.map(c => A.cardHTML(list, c)).join("") ||
      `<span class="tasks-empty">${from} show up here to drag onto a day.${isBase ? "" : " Drop a card here to take it off its day."}</span>`;
    $("tasksTotal").textContent = !parked.length ? "" : `${fmtH(b.parked)}${b.parked > b.free ? ` · only ${fmtH(b.free)} free` : ""}`;
  }

  // A click on a task (or Enter) opens a new card like the ones it draws, to put on the days picked.
  function openTask(key) {
    const t = taskBy(key);
    if (t) A.openCardEditor(null, { noDay: true, from: t });
    else A.renderAll(); // gone meanwhile: finished in Wan Shi Tong, say
  }

  // Wan Shi Tong doesn't tell Momo when what's in progress changes (in another tab, or from
  // another device through sync), so every minute Tasks is drawn again if it did.
  function checkTasks() {
    if (A.isActive() && tasksKey(tasks()) !== S.tasksKey) A.renderAll();
  }

  Object.assign(A, { tasks, taskBy, drawCard, renderTasks, openTask, checkTasks });
})(Kyoshi, Kyoshi.apps.momo);
