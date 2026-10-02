/* Momo · tasks.js — Tasks, the strip under the To Be Budgeted bank: what other apps need this week and
 * next that no block covers (inbox.js), and what's ongoing in other apps (Wan Shi Tong's in progress),
 * then the week's cards without a day (parked). Timed needs no block has room for make one task per block
 * title, as long as all of them (rounded up to 15 minutes), and hours needs (Iroh's goals) one per week,
 * shown on that week's board; a need for a whole block is a task of its own, as long as it says (else
 * DRAW_HOURS). Either draws a card with the block's title, which the needs then fill, so the task goes.
 * An ongoing need's task is never used up: dragging it onto a day adds a new card (drag.js, drop.js), as
 * often as you like, and clicking it opens that new card in the editor, to put on several days at once.
 * Tasks aren't stored: they're worked out afresh whenever they're drawn. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, todayStr, fmtShort } = K.util;
  const { DAY_HOURS, DRAW_HOURS, STEP, fmtH, cleanText, weekKeyOf } = A;

  // Minutes as hours on the 15-minute grid, rounded up so they fit, within a day.
  const upHours = m => Math.min(DAY_HOURS, Math.max(1, Math.ceil(m / (STEP * 60))) * STEP);
  // The soonest due date of some needs ("" if none), and whether any is overdue.
  const late = (needs, today) => ({
    due: needs.map(n => n.due).filter(Boolean).sort()[0] || "",
    overdue: needs.some(n => n.overdue || (n.due && n.due < today))
  });

  // The tasks of the board on screen (key: its week, or "base"), in order: what no block covers (in the
  // order the apps list it; hours short only that week's), then ongoing needs; each { key, title, hours,
  // label?, needs, due?, overdue?, ongoing? }. An ongoing one with the title of a task before it is left
  // out, as it would draw the same card.
  function tasks(f = A.fill(), key = A.shownKey()) {
    const out = [], titles = new Set(), groups = new Map(), today = todayStr();
    const add = t => { titles.add(t.title.toLowerCase()); out.push(t); return t; };
    f.short.forEach(n => {
      const title = cleanText(n.block), k = title.toLowerCase();
      if (n.fill === "block") return add({ key: `n:${n.app}:${n.id}`, title, hours: n.minutes ? upHours(n.minutes) : DRAW_HOURS, label: n.title, needs: [n], ...late([n], today) });
      // Hours short (Iroh's goals) belong to their week: a task each week, on that week's board only.
      const week = n.fill === "hours" && n.from ? weekKeyOf(n.from) : "", group = week ? `${k}|${week}` : k;
      if (week && week !== key) return;
      (groups.get(group) || groups.set(group, add({ key: `b:${group}`, title, needs: [] })).get(group)).needs.push(n);
    });
    groups.forEach(t => Object.assign(t, { hours: upHours(t.needs.reduce((m, n) => m + A.needMinutes(n), 0)) }, late(t.needs, today)));
    f.needs.filter(n => n.fill === "ongoing" && !n.done).forEach(n => {
      const title = cleanText(n.block);
      if (title && !titles.has(title.toLowerCase())) add({ key: `n:${n.app}:${n.id}`, title, hours: n.minutes ? upHours(n.minutes) : DRAW_HOURS, needs: [n], ongoing: true });
    });
    return out;
  }
  const taskBy = key => tasks().find(t => t.key === key) || null;

  // A new card drawn from a task: its title, as long as the task says (else DRAW_HOURS), not on a day yet.
  const drawCard = t => ({ id: newId(), title: t.title, hours: t.hours || DRAW_HOURS, day: null, goalId: null, base: false, parentId: null, pos: "bottom", pin: null });

  // A task is the outline of a card, in its title's colour (once a card has one), with its apps' icons,
  // and what's short of a block its hours (and a whole block's need its name).
  function taskHTML(t) {
    const needs = t.needs, sized = !t.ongoing, from = A.fillParts({ title: t.label || t.title }, needs);
    const what = t.ongoing ? `${needs[0].details.length ? `${needs[0].details.join(", ")}, ` : ""}${from.text}`
      : `${from.text}${t.overdue ? ", overdue" : t.due ? `, due ${fmtShort(t.due)}` : ""}`;
    const label = `${t.title}${t.label ? ` · ${t.label}` : ""} (${what}) — drag onto a day to add ${fmtH(t.hours || DRAW_HOURS)}, or click to pick days`;
    return `<div class="card parked task from-app${t.overdue ? " late" : ""}" data-task="${esc(t.key)}" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}" style="--c:${A.cardColor(t)}">` +
      from.icons + `<span class="card-title">${esc(t.title)}${t.label && t.label.toLowerCase() !== t.title.toLowerCase() ? `<span class="card-fill"> · ${esc(t.label)}</span>` : ""}</span>` +
      (sized ? `<span class="task-hours">${fmtH(t.hours)}</span>` : "") + `</div>`;
  }

  // Draws Tasks for the board on screen (none on a closed week): the tasks, then the week's cards
  // without a day, whose hours aren't budgeted yet, with their total. The baseline's cards are all on
  // days, and it shows only the tasks that are never used up (what's short is about this week and next).
  function renderTasks(list, key, b) {
    const isBase = key === "base", locked = !isBase && list.closed;
    $("tasks").hidden = locked;
    if (locked) return;
    const shown = tasks(S.fill, key).filter(t => !isBase || t.ongoing);
    const parked = isBase ? [] : list.cards.filter(c => c.day === null && !c.parentId);
    $("taskCards").innerHTML = shown.map(taskHTML).join("") + parked.map(c => A.cardHTML(list, c)).join("") ||
      `<span class="tasks-empty">${isBase ? "What's ongoing in other apps shows up here to drag onto a day."
        : "What other apps need this week and next shows up here to drag onto a day. Drop a card here to take it off its day."}</span>`;
    $("tasksTotal").textContent = !parked.length ? "" : `${fmtH(b.parked)}${b.parked > b.free ? ` · only ${fmtH(b.free)} free` : ""}`;
  }

  // A click on a task (or Enter) opens a new card like the ones it draws, to put on the days picked.
  function openTask(key) {
    const t = taskBy(key);
    if (t) A.openCardEditor(null, { noDay: true, from: t });
    else A.renderAll(); // gone meanwhile: finished in Wan Shi Tong, say
  }

  // Other apps don't tell Momo when what they need changes (in another tab, or from another device
  // through sync), so every minute the board is drawn again if it did.
  function checkTasks() {
    if (A.isActive() && (!S.fill || A.inboxKey() !== S.fill.key)) A.renderAll();
  }

  Object.assign(A, { tasks, taskBy, drawCard, renderTasks, openTask, checkTasks });
})(Kyoshi, Kyoshi.apps.momo);
