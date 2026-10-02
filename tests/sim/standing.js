/* Kyoshi · tests/sim/standing.js — B, "where I stand, per app" (testplan.md): each step, for each app, its own truth (is it
 * behind, and why), its dot on the switcher, its header line (core's meetings and checkups), and what Momo shows of it (on a
 * card, or in Tasks with the overdue edge); classified as silent-behind (behind, and nothing outside the app says so),
 * inside-only (behind, and Momo doesn't show it at all), stale (the drawn dot disagrees with the app now) or contradictory.
 * Noisy dots are counted per month in report.js from the days recorded here. */
"use strict";

const CHECKUP_DAYS = 60; // a checkup older than this is behind (testplan.md B)
const DOTTING = { hawky: true, appa: true, bosco: true, iroh: true, momo: true }; // apps that can dot (pabu, badgermole, turtleduck never)

// Why an app is behind today, from its own data (s.truth) and core's meetings line: a list of short reasons.
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
function reasons(app, t, s) {
  const out = [];
  if (!t || t.error) return out;
  if (app === "hawky" && t.overdue.length) out.push(`${n(t.overdue.length, "errand", "errands")} overdue`);
  if (app === "pabu" && t.overdue.length) out.push(`${n(t.overdue.length, "person", "people")} overdue`);
  if (app === "appa" && t.overdue.length) out.push(`${n(t.overdue.length, "job", "jobs")} overdue`);
  if (app === "appa" && t.reading.length) out.push("a meter reading is asked for");
  if (app === "badgermole" && t.behind) out.push(`${n(t.target - t.done, "workout", "workouts")} to go, ${n(t.left, "day", "days")} left`);
  if (app === "turtleduck" && t.unplanned) out.push(`${n(t.unplanned, "dinner", "dinners")} unplanned this week`);
  if (app === "iroh" && t.behind.length) out.push(`${n(t.behind.length, "goal", "goals")} more than a week behind (${t.behind.join(", ")})`);
  if (app === "bosco" && t.late.length) out.push("a dose unlogged past its day");
  if (app === "momo" && t.pending.length) out.push(`${t.pending.length} close-outs pending`);
  const line = s.meetings[app] || "";
  const over = /overdue by (\d+) days/.exec(line);
  if (over) out.push(`a meeting overdue by ${over[1]} days`);
  const met = /checkup whenever, met (\d+) days ago/.exec(line);
  if (met && +met[1] > CHECKUP_DAYS) out.push(`checkup ${met[1]} days old`);
  return out;
}

// What Momo shows of an app's behind items: "late" (in Tasks with the overdue edge), "shown" (on a card or in Tasks, with
// nothing saying late), or "" (not at all).
function inMomo(app, t, s) {
  const f = s.drawn;
  if (!f || !t) return "";
  const ids = new Set((app === "hawky" ? t.overdue : app === "pabu" ? t.overdue : app === "appa" ? t.overdue.concat(t.reading) : []).map(id => `${app}:${id}`));
  if (app === "badgermole" && t.behind) f.needs.filter(n => n.app === app && !n.done && n.id.startsWith(`next:${s.thisKey}`)).forEach(n => ids.add(n.key));
  if (/overdue by/.test(s.meetings[app] || "")) f.needs.filter(n => n.app === app && n.id.startsWith("meeting:") && n.overdue).forEach(n => ids.add(n.key));
  if (!ids.size) return "";
  const tasks = f.tasks.this.concat(f.tasks.next);
  if (tasks.some(x => x.overdue && x.needs.some(k => ids.has(k)))) return "late";
  return f.blocks.some(b => b.needs.some(k => ids.has(k))) || tasks.some(x => x.needs.some(k => ids.has(k))) ? "shown" : "";
}

// One step's standing for every app: recorded (L.days) and classified (L.count, L.find).
function standing(L, s) {
  Object.keys(s.truth).forEach(app => {
    const t = s.truth[app], why = reasons(app, t, s), dot = s.signals[app] || "", momo = inMomo(app, t, s);
    const row = { date: s.today, app, behind: why.length > 0, why, dot: !!dot, momo, used: L.uses(app) };
    L.record(row);
    if (!row.behind || !row.used) return; // an app this person doesn't use isn't theirs to be behind in (its dot still counts as noise)
    const checkupOnly = why.every(w => /^checkup/.test(w));
    if (!dot && momo !== "late") {
      L.count(`silent:${app}`);
      L.find(`silent-behind:${app}${checkupOnly ? ":checkup" : ""}`, {
        kind: "signal", sev: checkupOnly ? "occasional" : "daily rub",
        title: checkupOnly ? `${L.appName(app)}'s checkup gets months old with nothing saying so` : `${L.appName(app)} falls behind with nothing outside it saying so`,
        where: checkupOnly ? "core/meetings.js:9-11 (a checkup is never due)" : DOTTING[app] ? `apps/${app} (its attention doesn't cover this)` : `apps/${app} (never dots${app === "pabu" ? ": DOT_WHEN_OVERDUE = false in app.js" : ""})`,
        suspect: 11
      }, `${why.join("; ")}${momo === "shown" ? " — Momo shows the items but not that they're late" : momo ? "" : " — and Momo shows none of it"}`);
    }
    if (!dot && !momo) L.count(`inside:${app}`);
  });
  // The dot as drawn (the switch button's tooltip, for the apps other than the one on screen) against each app's attention now.
  Object.keys(s.signals).forEach(app => {
    if (app === s.active) return;
    const drawn = s.tooltip.includes(`${L.appName(app)}: `), now = !!s.signals[app];
    if (drawn !== now) L.find("stale-dot", { kind: "signal", sev: "occasional", title: "A dot on the switcher lags its app" }, `${L.appName(app)}: the switcher ${drawn ? "shows" : "doesn't show"} a dot, its app says ${now ? `“${s.signals[app]}”` : "nothing"}`);
  });
}

module.exports = { standing, reasons, inMomo, CHECKUP_DAYS };
