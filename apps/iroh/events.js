/* Iroh · events.js — loads last: wires the page (A.init): the Add buttons, a goal's or an area's title (its
 * pop-up), Reconcile, Carry over and an area's ↑ ↓ (each button carries data-act and data-id); and the hooks
 * Kyoshi calls: onTick and onShow (a new day: reconciles age, and a new season can start; Momo's close-out logged
 * hours), onReload (another tab saved) and bugState. Iroh's dot is core's: an overdue meeting (core/meetings.js). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { newId, todayStr } = K.util;

  // Carry over: an open goal from an earlier season, copied into this one as a new goal (its year goal, area,
  // hours and next step too), reconciled today. Once this season has a goal with its title, it's been carried.
  function carryOver(id) {
    const g = A.goalById(id), season = A.currentSeason();
    if (!g || !A.isSeason(g.period) || !A.isPast(g.period) || !A.isOpen(g) ||
      A.goalsIn(season).some(x => x.title.toLowerCase() === g.title.toLowerCase())) return A.renderAll();
    const now = Date.now(), copy = A.cleanGoals([{ ...g, id: newId(), period: season, reconciled: todayStr(), at: now, u: now }])[0];
    if (!copy) return;
    S.goals.push(copy);
    A.save();
    A.renderAll();
  }

  // Buttons drawn into the page carry data-act (and data-id).
  const ACTS = {
    "add-season": () => A.openGoal("", "season"),
    "add-year": () => A.openGoal("", "year"),
    "add-area": () => A.openArea(""),
    edit: btn => A.openGoal(btn.dataset.id),
    reconcile: btn => A.openReconcile(btn.dataset.id),
    carry: btn => carryOver(btn.dataset.id),
    "area-edit": btn => A.openArea(btn.dataset.id),
    "area-up": btn => A.moveArea(btn.dataset.id, -1),
    "area-down": btn => A.moveArea(btn.dataset.id, 1)
  };

  A.init = () => {
    A.wireGoalEditor();
    A.wireAreaEditor();
    A.root.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn && ACTS[btn.dataset.act]) ACTS[btn.dataset.act](btn);
    });
    A.renderAll();
  };

  // Every minute, whenever the page is back in view, and when Iroh comes on screen: at a new day, reconciles age
  // and a new season can start; and a close-out in Momo (here, or in another tab) changes the goals' progress.
  A.onTick = () => { if (todayStr() !== S.knownToday || A.progressKey() !== S.progressKey) A.renderAll(); };
  A.onShow = A.onTick;

  // Another tab saved (A.load has read it): show it.
  A.onReload = () => A.renderAll();

  // Bug reports: counts only — never what the areas and goals say.
  A.bugState = () => {
    const areas = A.liveAreas().length, goals = A.liveGoals(), season = A.currentSeason(), year = A.thisYear();
    const now = A.goalsIn(season), open = now.filter(A.isOpen);
    const read = open.filter(g => g.hoursWeek || g.hoursTotal).map(g => [g, A.progressOf(g)]).filter(([, p]) => p);
    return [
      `- Areas: ${areas} (+${S.areas.length - areas} deleted)`,
      `- This season (${season}): ${open.length} open (${open.filter(g => A.weeklyMinutes(g) > 0).length} with hours, ${open.filter(g => A.isStale(g)).length} to reconcile), ${now.length - open.length} done or dropped`,
      `- This year (${year}): ${A.goalsIn(year).length} goals; earlier: ${goals.filter(g => A.isPast(g.period)).length}; +${S.goals.length - goals.length} deleted`,
      `- Progress from Momo: ${read.length} goals with hours (${read.filter(([g, p]) => A.behindBy(g, p)).length} behind, ${read.filter(([g, p]) => g.hoursTotal && p.spent >= g.hoursTotal).length} totals reached)`,
      `- Pop-ups: goal ${S.editing ? "open" : "closed"}, reconcile ${S.reconciling ? "open" : "closed"}, area ${S.areaEditing ? "open" : "closed"}`
    ];
  };
})(Kyoshi, Kyoshi.apps.iroh);
