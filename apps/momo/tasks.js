/* Momo · tasks.js — Tasks, the strip under the To Be Budgeted bank: what each app still needs a place for, in a
 * chunk per app (its icon and name, how many and how long), so each app's part of the week is plain to see and goes
 * as it's planned. A week's board lists only what can go on that week (something that could go on either shows on
 * both), and the week is all assigned once its Tasks are empty too. What no block covers (inbox.js): timed needs one
 * task per app and block title, as long as all of them (rounded up to 15 minutes); hours needs (Iroh's goals) one per
 * week, on that week's board; a need for a whole block a task of its own, as long as it says (else DRAW_HOURS).
 * Either draws a card with the block's title, which the needs then fill, so the task goes. What's ongoing in other
 * apps (Wan Shi Tong's in progress) is never used up: dragging it onto a day adds a new card (drag.js, drop.js), as
 * often as you like, and clicking it opens that new card in the editor, to put on several days at once. Then the
 * week's cards without a day (parked). The baseline's Tasks are the true cost (truecost.js) and what's ongoing.
 * Tasks aren't stored: they're worked out afresh whenever they're drawn. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, sum, newId, todayStr, addDays, fmtShort } = K.util;
  const { DAY_HOURS, DRAW_HOURS, STEP, fmtH, cleanText, weekKeyOf, thisWeekKey } = A;

  // Minutes as hours on the 15-minute grid, rounded up so they fit, within a day.
  const upHours = m => Math.min(DAY_HOURS, Math.max(1, Math.ceil(m / (STEP * 60))) * STEP);
  // The soonest due date of some needs ("" if none), and whether any is late.
  const late = (needs, today) => ({
    due: needs.map(n => n.due).filter(Boolean).sort()[0] || "",
    overdue: needs.some(n => A.isLate(n, today))
  });

  // Whether a need can go on the week starting key (this week from today on): on its day; an hours need in its own
  // week; any other from its from day (today at the soonest) to its due day (any day once that's passed, or without one).
  function canGo(n, key) {
    const today = todayStr(), start = key === thisWeekKey() ? today : key, end = addDays(key, 6);
    if (n.date) return n.date >= start && n.date <= end;
    if (n.fill === "hours") return !n.from || weekKeyOf(n.from) === key;
    const lo = n.from && n.from > start ? n.from : start, hi = n.due && n.due >= today && n.due < end ? n.due : end;
    return lo <= hi;
  }

  // The tasks of the board on screen (key: its week, or "base"), in order: what no block covers that can go on that
  // week (in the order the apps list it), then ongoing needs; on the baseline the true cost's (truecost.js), then
  // ongoing needs. Each { key, app, title, hours, label?, needs, due?, overdue?, ongoing?, cost? }. An ongoing one with
  // the title of a task before it is left out, as it would draw the same card.
  function tasks(f = A.fill(), key = A.shownKey()) {
    const out = [], titles = new Set(), groups = new Map(), today = todayStr();
    const add = t => { titles.add(t.title.toLowerCase()); out.push(t); return t; };
    if (key === "base") A.costTasks().forEach(add);
    else f.short.filter(n => canGo(n, key)).forEach(n => {
      const title = cleanText(n.block), k = `${n.app}|${title.toLowerCase()}`;
      if (n.fill === "block") return add({ key: `n:${n.app}:${n.id}`, app: n.app, title, hours: n.minutes ? upHours(n.minutes) : DRAW_HOURS, label: n.title, needs: [n], ...late([n], today) });
      // Hours short (Iroh's goals) belong to their week: a task each week, on that week's board only.
      const group = n.fill === "hours" && n.from ? `${k}|${weekKeyOf(n.from)}` : k;
      (groups.get(group) || groups.set(group, add({ key: `b:${group}`, app: n.app, title, needs: [] })).get(group)).needs.push(n);
    });
    groups.forEach(t => Object.assign(t, { hours: upHours(sum(t.needs.map(A.needMinutes))) }, late(t.needs, today)));
    f.needs.filter(n => n.fill === "ongoing" && !n.done).forEach(n => {
      const title = cleanText(n.block);
      if (title && !titles.has(title.toLowerCase())) add({ key: `n:${n.app}:${n.id}`, app: n.app, title, hours: n.minutes ? upHours(n.minutes) : DRAW_HOURS, needs: [n], ongoing: true });
    });
    return out;
  }
  const taskBy = key => tasks().find(t => t.key === key) || null;
  // How many things a week still has to place: its tasks (not the ongoing) and its cards without a day.
  const toPlace = (list, key) => (key === "base" ? 0 : tasks(S.fill || A.fill(), key).filter(t => !t.ongoing && !t.cost).length + list.cards.filter(c => c.day === null && !c.parentId).length);

  // A new card drawn from a task: its title, as long as the task says (else DRAW_HOURS), not on a day yet.
  const drawCard = t => ({ id: newId(), title: t.title, hours: t.hours || DRAW_HOURS, day: null, goalId: null, base: false, parentId: null, pos: "bottom", pin: null });

  // A task is the outline of a card, in its title's colour (once a card has one): its title (and a whole block's
  // need's name), and what's short of a block its hours. Its chunk shows its app.
  function taskHTML(t) {
    if (t.cost) return A.costHTML(t);
    const needs = t.needs, from = A.fillParts({ title: t.label || t.title }, needs);
    const what = t.ongoing ? `${needs[0].details.length ? `${needs[0].details.join(", ")}, ` : ""}${from.what}`
      : `${from.what}${t.overdue ? ", overdue" : t.due ? `, due ${fmtShort(t.due)}` : ""}`;
    const label = `${t.title}${t.label ? ` · ${t.label}` : ""} (${what}) — drag onto a day to add ${fmtH(t.hours || DRAW_HOURS)}, or click to pick days`;
    return `<div class="card parked task${t.overdue ? " late" : ""}" data-task="${esc(t.key)}" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}" style="--c:${A.cardColor(t)}">` +
      `<span class="card-title">${esc(t.title)}${t.label && t.label.toLowerCase() !== t.title.toLowerCase() ? `<span class="card-fill"> · ${esc(t.label)}</span>` : ""}</span>` +
      (t.ongoing ? "" : `<span class="task-hours">${fmtH(t.hours)}</span>`) + `</div>`;
  }

  // A chunk of Tasks: an app's icon and name (P; none: the week's own cards) and what it adds up to (sum), then its own.
  const chunkHTML = (P, name, total, body) => `<div class="task-app"><div class="task-app-head">${P ? `<span class="app-icon" aria-hidden="true">${P.meta.icon}</span>` : ""}` +
    `<span class="task-app-name">${esc(name)}</span><span class="task-app-sum">${esc(total)}</span></div><div class="task-app-cards">${body}</div></div>`;
  // The apps that have some, in the switcher's order.
  const appsIn = list => K.order.filter(id => list.some(x => x.app === id));
  // "3 to place · 1.5h", or "in progress" for what's ongoing.
  function placeSum(list) {
    const sized = list.filter(t => !t.ongoing);
    return sized.length ? `${sized.length} to place · ${fmtH(sum(sized.map(t => t.hours)))}` : "in progress";
  }

  // Draws Tasks for the board on screen (none on a closed week): a chunk per app with its tasks, then the week's cards
  // without a day, whose hours aren't budgeted yet; the head says how many there are to place in all. The baseline's
  // are its true cost (truecost.js).
  function renderTasks(list, key, b) {
    const isBase = key === "base", locked = !isBase && list.closed;
    $("tasks").hidden = locked;
    if (locked) return;
    if (isBase) return A.renderCost(tasks(S.fill, key));
    const shown = tasks(S.fill, key), parked = list.cards.filter(c => c.day === null && !c.parentId);
    const html = appsIn(shown).map(id => { const mine = shown.filter(t => t.app === id), P = K.apps[id]; return chunkHTML(P, P ? P.meta.name : id, placeSum(mine), mine.map(taskHTML).join("")); }).join("") +
      (parked.length ? chunkHTML(null, "No day", `${fmtH(b.parked)}${b.parked > b.free ? ` · only ${fmtH(b.free)} free` : ""}`, parked.map(c => A.cardHTML(list, c)).join("")) : "");
    const left = shown.filter(t => !t.ongoing), asked = S.fill.blocks.some(x => x.key === key && x.needs.some(n => n.fill !== "ongoing"));
    $("taskCards").innerHTML = html || `<span class="tasks-empty">${asked ? "Nothing to place: everything the apps need this week has a card ✓"
      : "What other apps need this week and next shows up here to drag onto a day. Drop a card here to take it off its day."}</span>`;
    const n = left.length + parked.length, hours = sum(left.map(t => t.hours)) + b.parked;
    $("tasksTotal").textContent = n ? `${n} to place · ${fmtH(hours)}` : "";
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

  Object.assign(A, { upHours, canGo, tasks, taskBy, toPlace, drawCard, taskHTML, chunkHTML, appsIn, renderTasks, openTask, checkTasks });
})(Kyoshi, Kyoshi.apps.momo);
