/* Kyoshi · tests/sim/report.js — the lives' results (<out>/<life>.json) → tests/sim/report.md, in plain words for the owner:
 * 1. the summary (one row per life, then the long haul's robustness numbers), 2. the findings ranked, each with what the person
 * saw and needed, the evidence (life, seed, date, step), where in the code, the options and a recommendation (the words are
 * notes.js's, by finding), then the suspects' verdicts, 3. what was fixed during the run, 4. what's out of scope, 5. the
 * discussion agenda. Everything is worked out from the results, so running it again rewrites the report. */
"use strict";
const fs = require("fs");
const path = require("path");
const notes = require("./notes");

const FILE = path.join(__dirname, "report.md");
const SEV = ["blocks the flow", "daily rub", "occasional", "cosmetic"];
const APPS = ["momo", "hawky", "pabu", "appa", "badgermole", "turtleduck", "iroh", "bosco", "wanshitong"];
const NAMES = { momo: "Momo", bosco: "Bosco", wanshitong: "Wan Shi Tong", appa: "Appa", hawky: "Hawky", iroh: "Iroh", badgermole: "Badgermole", turtleduck: "Turtleduck", pabu: "Pabu" };
const APP_RE = /:(hawky|pabu|appa|badgermole|turtleduck|iroh|bosco|momo|wanshitong)(?=:|$)/;
const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const r1 = x => Math.round(x * 10) / 10;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const dayMs = d => Date.parse(`${d}T00:00:00Z`);
const addDays = (d, n) => new Date(dayMs(d) + n * 864e5).toISOString().slice(0, 10);

function load(out) {
  return fs.existsSync(out) ? fs.readdirSync(out).filter(f => /^[a-z]+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"))).sort((a, b) => a.n - b.n) : [];
}

// --- One life's numbers ---
function lifeNumbers(r) {
  const weeks = Object.keys(r.weekStats).sort(), ended = weeks.filter(k => addDays(k, 6) < r.to), closes = { onTime: 0, late: 0, never: 0 };
  ended.forEach(k => {
    const on = r.weekStats[k].closedOn;
    if (!on) closes.never++;
    else if ((dayMs(on) - dayMs(addDays(k, 6))) / 864e5 <= 2) closes.onTime++;
    else closes.late++;
  });
  closes.never += r.counters.weeksNeverStored || 0;
  const planned = weeks.map(k => r.weekStats[k]).filter(s => s.left);
  const full = weeks.map(k => r.weekStats[k]).filter(s => s.full);
  // Standing, day by day: silent-behind (behind in an app in use, no dot, Momo not saying late) and dot days, per app.
  const silent = {}, inside = {}, dots = {}, months = {};
  const seen = new Set();
  r.days.forEach(d => {
    const key = `${d.app}|${d.date}`;
    if (d.behind && d.used !== false && !d.dot && d.momo !== "late" && !seen.has(`s${key}`)) { seen.add(`s${key}`); silent[d.app] = (silent[d.app] || 0) + 1; }
    if (d.behind && d.used !== false && !d.dot && !d.momo && !seen.has(`i${key}`)) { seen.add(`i${key}`); inside[d.app] = (inside[d.app] || 0) + 1; }
    const m = `${d.app}|${d.date.slice(0, 7)}`;
    const x = months[m] || (months[m] = { days: new Set(), dots: new Set() });
    x.days.add(d.date);
    if (d.dot) x.dots.add(d.date);
  });
  Object.entries(months).forEach(([m, x]) => { const app = m.split("|")[0]; dots[app] = dots[app] || { days: 0, noisy: 0 }; dots[app].days += x.dots.size; if (x.dots.size > x.days.size / 2) dots[app].noisy += x.dots.size; });
  const c = r.counters, sumOf = re => Object.keys(c).filter(k => re.test(k)).reduce((n, k) => n + c[k], 0);
  const f = key => r.findings.filter(x => x.key === key || x.key.startsWith(`${key}:`)).reduce((n, x) => n + x.count, 0);
  return {
    weeks: weeks.length, closes, left: r1(avg(planned.map(s => s.left.length))), taps: r1(avg(full.map(s => s.taps + s.drags))), fullShare: pct(full.length, weeks.filter(k => r.weekStats[k].msg !== undefined).length),
    covered: pct(weeks.filter(k => r.weekStats[k].afterBaseline && !r.weekStats[k].afterBaseline.length).length, weeks.filter(k => r.weekStats[k].afterBaseline).length),
    silent, inside, dots,
    dropped: { doneNoCard: sumOf(/^doneHidden:/), appa: c.appaRecordedVanished || 0, yesterday: c.yesterdayTicksGone || 0 },
    doubled: f("doubled"), contradictory: f("all-assigned-with-tasks") + f("card-tick-wrong") + f("today-tick"),
    console: r.problems.length, sim: r.simErrors.length, minutes: Math.round((r.seconds || 0) / 60)
  };
}

function summary(results) {
  const head = "| Life | Weeks | Closed out on time / late / never | Left in Tasks on Sunday night (avg) | Taps and drags to “Every hour has a job ✓” (avg) | Weeks the baseline covered | Silent-behind days, by app | Days with a dot (noisy*), by app | Done but no ✓ in Momo (no card · Appa · yesterday's) | Doubled | Contradictory | Console | Sim errors | Run |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
  return head + results.map(r => {
    const x = lifeNumbers(r), list = obj => APPS.filter(a => obj[a]).map(a => `${NAMES[a]} ${obj[a]}`).join(", ") || "–";
    const dots = APPS.filter(a => x.dots[a] && x.dots[a].days).map(a => `${NAMES[a]} ${x.dots[a].days}${x.dots[a].noisy ? ` (${x.dots[a].noisy}*)` : ""}`).join(", ") || "–";
    return `| ${r.n} · ${r.name} | ${x.weeks} | ${x.closes.onTime} / ${x.closes.late} / ${x.closes.never} | ${x.left} | ${x.taps || "–"} | ${x.covered} | ${list(x.silent)} | ${dots} | ${x.dropped.doneNoCard} · ${x.dropped.appa} · ${x.dropped.yesterday} | ${x.doubled} | ${x.contradictory} | ${x.console} | ${x.sim} | ${x.minutes} min |`;
  }).join("\n") + "\n\n*A dot is noisy in a month when it's up on more than half its days: those days are in brackets. Silent-behind: the app's own data says behind (overdue errands, people due, jobs overdue, workouts short with too few days left, dinners unplanned, a goal more than a week behind, a dose late, a meeting overdue, a checkup over 60 days old) and nothing outside the app says so: no dot, and Momo doesn't show it as late.";
}

// --- Where I stand, per app (the daily lives, 1–5): on the days it was behind, what showed it ---
function standingTable(results) {
  const by = {};
  results.filter(r => r.n <= 5).forEach(r => {
    const seen = new Set();
    r.days.forEach(d => {
      const k = `${d.app}|${d.date}`;
      if (!d.behind || d.used === false || seen.has(k)) return;
      seen.add(k);
      const x = by[d.app] || (by[d.app] = { days: 0, dot: 0, late: 0, shown: 0, none: 0, why: {} });
      x.days++;
      if (d.dot) x.dot++;
      else if (d.momo === "late") x.late++;
      else if (d.momo === "shown") x.shown++;
      else x.none++;
      (d.why || []).forEach(w => { const key = w.replace(/^\d+ /, "").replace(/ \(.*\)$/, "").replace(/\d+/g, "N"); x.why[key] = (x.why[key] || 0) + 1; });
    });
  });
  return "| App | Days behind | A dot on the switcher | No dot, Momo shows it late (Tasks' red edge) | No dot, Momo shows it but not as late | Nothing outside the app | Mostly because |\n|---|---|---|---|---|---|---|\n" +
    APPS.filter(a => by[a]).map(a => { const x = by[a]; return `| ${NAMES[a]} | ${x.days} | ${pct(x.dot, x.days)} | ${pct(x.late, x.days)} | ${pct(x.shown, x.days)} | ${pct(x.none, x.days)} | ${Object.entries(x.why).sort((p, q) => q[1] - p[1]).slice(0, 2).map(([w]) => w).join("; ")} |`; }).join("\n") +
    "\n\nA day counts once per app. Life 6 is left out: it steps once a week, so its days behind say more about the stepping than the app.";
}

// --- The true cost: right after the baseline was loaded for a week, what it left short, by block title (lives with a baseline) ---
function shortTable(results) {
  const rows = results.filter(r => Object.values(r.weekStats).some(s => s.afterBaseline)).map(r => {
    const weeks = Object.values(r.weekStats).filter(s => s.afterBaseline), by = {};
    weeks.forEach(s => s.afterBaseline.forEach(t => { const m = /^(.*) ([\d.]+)h$/.exec(t); if (!m) return; const x = by[m[1]] || (by[m[1]] = { weeks: 0, hours: 0 }); x.weeks++; x.hours += +m[2]; }));
    const top = Object.entries(by).sort((a, b) => b[1].weeks - a[1].weeks || b[1].hours - a[1].hours).slice(0, 6);
    return `| ${r.n} · ${r.name} | ${weeks.length} | ${pct(weeks.filter(s => !s.afterBaseline.length).length, weeks.length)} | ${top.map(([t, x]) => `${t} ${x.weeks}× (${r1(x.hours / x.weeks)}h)`).join(", ") || "–"} |`;
  });
  return "| Life | Weeks planned | Covered with nothing short | Short most often (weeks, average hours short) |\n|---|---|---|---|\n" + rows.join("\n") +
    "\n\nMeasured on planning day, just after Load or Reload baseline (or Copy previous week), before anything was dragged. Some of it is next week's meals for days with no Breakfast, Lunch or Dinner card, and goal hours with no card of their own.";
}

// --- Lead times: days between a need first showing in Momo and its day ---
function leads(results) {
  const by = new Map();
  results.forEach(r => Object.values(r.firstSeen).forEach(x => {
    if (!x.due) return;
    const kind = x.app === "iroh" ? (x.kind === "meeting" ? "Iroh meetings" : "Iroh goals") : x.app === "turtleduck" ? (x.kind === "groceries" ? "Turtleduck groceries" : "Turtleduck meals") : x.app === "badgermole" ? (x.kind === "next" ? "Badgermole workouts" : "Badgermole") : x.app === "pabu" ? "Pabu people" : NAMES[x.app];
    const d = (dayMs(x.due) - dayMs(x.date)) / 864e5, l = by.get(kind) || by.set(kind, []).get(kind);
    l.push(d);
  }));
  const expected = { Appa: "14", "Pabu people": "6", "Iroh meetings": "6", "Turtleduck groceries": "1 (the Now list)", Hawky: "0", "Iroh goals": "the week itself" };
  return "| Need | Seen | Days ahead of its day, average (fewest · most) | Planned lead |\n|---|---|---|---|\n" +
    [...by].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => `| ${k} | ${l.length} | ${r1(avg(l))} (${Math.min(...l)} · ${Math.max(...l)}) | ${expected[k] || "–"} |`).join("\n") +
    "\n\nA negative number: it first showed after its day (overdue on arrival, or added late).";
}

// --- Findings worked out from the days recorded, not from one check: noisy dots, and late things only Tasks shows ---
function derived(results) {
  const out = [];
  const add = (r, key, meta, app, what, date) => {
    let f = out.find(x => x.key === key && x.life === r.id);
    if (!f) out.push(f = { key, ...meta, life: r.id, n: r.n, seed: r.seed, count: 0, examples: [], apps: {} });
    f.count++;
    f.apps[app] = (f.apps[app] || 0) + 1;
    if (f.examples.length < 3) f.examples.push({ date, step: "–", what });
  };
  results.forEach(r => {
    // A dot up more than half a month's days, or one that never clears for weeks.
    const months = {}, runs = {};
    [...new Map(r.days.map(d => [`${d.app}|${d.date}`, d])).values()].sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
      const m = months[`${d.app}|${d.date.slice(0, 7)}`] || (months[`${d.app}|${d.date.slice(0, 7)}`] = { days: 0, dots: 0, used: d.used !== false });
      m.days++;
      if (d.dot) m.dots++;
      const x = runs[d.app] || (runs[d.app] = { cur: 0, best: 0, end: "" });
      x.cur = d.dot ? x.cur + 1 : 0;
      if (x.cur > x.best) { x.best = x.cur; x.end = d.date; }
    });
    if (r.n <= 5) Object.entries(months).forEach(([k, m]) => {
      const [app, month] = k.split("|");
      if (m.dots > m.days / 2) add(r, "noisy-dot", { kind: "signal", sev: "occasional", title: "A dot that's up most of the month" }, app, `${NAMES[app]}${m.used ? "" : " (an app this person doesn't use)"}: a dot on ${m.dots} of ${m.days} days in ${month}${runs[app] && runs[app].best >= 28 ? `; the longest run without clearing, ${runs[app].best} days to ${runs[app].end}` : ""}`, `${month}-01`);
    });
    // Late things that only Tasks' red edge showed: never on Today, the phone's view.
    if (r.n <= 5) {
      const seen = new Set();
      r.days.forEach(d => {
        if (d.momo !== "late" || d.used === false || seen.has(`${d.app}|${d.date}`)) return;
        seen.add(`${d.app}|${d.date}`);
        add(r, "late-only-in-tasks", { kind: "flow", sev: "daily rub", title: "Late things show only in Tasks, which Today (the phone) never shows" }, d.app, `${d.date}, ${NAMES[d.app]}: ${(d.why || []).join("; ")} — in Tasks with the red edge, on the board only`, d.date);
      });
    }
  });
  return out;
}

// --- Findings, merged across lives by key (an app's own key folds into one finding, its apps listed) ---
function merged(results) {
  const all = new Map();
  derived(results).forEach(f => {
    const g = all.get(f.key) || all.set(f.key, { ...f, lives: [], count: 0, examples: [], apps: {} }).get(f.key);
    g.count += f.count;
    if (!g.lives.includes(f.n)) g.lives.push(f.n);
    Object.entries(f.apps).forEach(([a, c]) => { g.apps[a] = (g.apps[a] || 0) + c; });
    f.examples.slice(0, 2).forEach(e => { if (g.examples.length < 5) g.examples.push({ ...e, life: f.n, seed: f.seed }); });
  });
  results.forEach(r => r.findings.filter(f => f.kind !== "sim").forEach(f => {
    // An app's own variant folds into one finding (its apps counted); so do the titles of the same shortfall.
    const title = /^same-shortfall:(.+)$/.exec(f.key), app = title ? title[1] : (APP_RE.exec(f.key) || [])[1], base = title ? "same-shortfall" : f.key.replace(APP_RE, "");
    const g = all.get(base) || all.set(base, { ...f, key: base, lives: [], count: 0, examples: [], apps: {} }).get(base);
    g.count += f.count;
    if (!g.lives.includes(r.n)) g.lives.push(r.n);
    if (app) g.apps[app] = (g.apps[app] || 0) + f.count;
    f.examples.slice(0, 2).forEach(e => { if (g.examples.length < 5) g.examples.push({ ...e, life: r.n, seed: r.seed }); });
  }));
  const rank = g => { const n = notes.finding(g.key); return [SEV.indexOf(n.sev || g.sev), -(n.weight || 0), -g.lives.length, -g.count]; };
  return [...all.values()].sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
}

function findingMD(g, i, shots) {
  const n = notes.finding(g.key), id = `F-${String(i + 1).padStart(2, "0")}`;
  const apps = Object.entries(g.apps).sort((a, b) => b[1] - a[1]).map(([a, c]) => `${NAMES[a] || `“${a}”`} ${c}`).join(", ");
  const shot = shots.find(s => s.key === g.key);
  return [
    `### ${id} · ${n.kind || g.kind} · ${n.sev || g.sev} — ${n.title || g.title}`,
    n.what ? `**What happened.** ${n.what}` : "",
    n.saw ? `**What the person saw:** ${n.saw}  \n**What they needed:** ${n.needed}` : "",
    `**Evidence.** ${g.count} time${g.count === 1 ? "" : "s"} in life ${g.lives.join(", ")}${apps ? ` (${apps})` : ""}. For example:`,
    g.examples.map(e => `- life ${e.life} (seed ${e.seed}), ${e.date}, step ${e.step}: ${e.what}`).join("\n"),
    shot ? `![${id}](${shot.file})` : "",
    `**Where.** ${n.where || (g.where ? `\`${g.where}\`` : "–")}`,
    n.options ? `**Options.**\n${n.options.map((o, k) => `${k + 1}. ${o}`).join("\n")}\n\n**Recommendation.** ${n.recommend}` : "",
    n.question ? `**Question for you.** ${n.question}` : ""
  ].filter(Boolean).join("\n\n");
}

// The suspects (testplan.md), each confirmed or refuted from the findings and counters, with its evidence.
function suspects(results, list) {
  return notes.SUSPECTS.map(s => {
    const hits = list.filter(g => s.keys.some(k => g.key === k || g.key.startsWith(k)));
    const count = hits.reduce((n, g) => n + g.count, 0);
    const verdict = s.verdict ? s.verdict(results, hits) : count ? "Confirmed" : "Not seen";
    const ex = hits.flatMap(g => g.examples).slice(0, 2).map(e => `life ${e.life}, ${e.date}: ${e.what}`).join("; ");
    return `${s.n}. **${verdict}** — ${s.text}${count ? ` Seen ${count} times (${hits.map(g => `F-${String(list.indexOf(g) + 1).padStart(2, "0")}`).join(", ")}).` : ""}${ex ? ` E.g. ${ex}.` : ""}${s.note ? ` ${s.note(results)}` : ""}`;
  }).join("\n");
}

function timings(results) {
  const rows = results.flatMap(r => r.timings.map(t => ({ life: r.n, ...t })));
  if (!rows.length) return "No timings were taken.";
  const ms = v => (v === undefined ? "" : `${r1(v)} ms`), kb = v => (v ? `${Math.round(v / 1024)} KB` : "");
  return "| Life | When | Weeks kept | K.inbox | hoursSpent (5 goals) | Momo's fill | Board redraw | Tab switch | Today | Reload | Data kept | Export all | Import all | Same answers after |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n" +
    rows.map(t => `| ${t.life} | ${t.label}, ${t.date} | ${t.weeks ?? ""} | ${ms(t.inbox)} | ${ms(t.hoursSpent)} | ${ms(t.fill)} | ${ms(t.render)} | ${ms(t.tabSwitch)} | ${ms(t.today)} | ${ms(t.reload)} | ${kb(t.storage)} | ${kb(t.exportBytes)} | ${ms(t.importMs)} | ${t.same === undefined ? "" : t.same ? "yes" : "**no**"} |`).join("\n");
}

function counts(results) {
  const rows = [
    ["Close-outs shown", "closeOutShown"], ["… popping up first thing on the phone", "closeOutFirstThing"], ["… put off with Later", "closeOutLater"],
    ["“Open in <App>” round trips from Today", "openInApp"], ["Today's card pop-up opened to see what a card holds", "todayCardOpened"],
    ["Tasks left in Tasks by this person's skill", "taskLeft"], ["Tasks with no day that could take them", "taskNoDay"], ["Days balanced by shrinking Free time", "balanced"],
    ["Tasks from an app the person doesn't use", "taskFromUnusedApp"], ["Weeks planned on the phone on Monday", "phonePlanned"], ["Hours of goal time that vanished at a week change", "hoursShortLost"],
    ["Errands added", "errandsAdded"], ["People added", "peopleAdded"], ["Checkups done", "checkupsDone"], ["Meetings skipped", "meetingSkipped"], ["Confirm dialogs", "dialog:confirm"], ["Alerts", "dialog:alert"]
  ];
  return `| | ${results.map(r => `Life ${r.n}`).join(" | ")} |\n|---|${results.map(() => "---").join("|")}|\n` + rows.map(([label, k]) => `| ${label} | ${results.map(r => r1(r.counters[k] || 0)).join(" | ")} |`).join("\n");
}

// The Export all files written at each life's year ends (robust.js), with their sizes.
function bundles() {
  const dir = path.join(__dirname, "bundles"), files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort() : [];
  return notes.BUNDLES + "\n\n" + (files.length ? files.map(f => `- \`tests/sim/bundles/${f}\` (${Math.round(fs.statSync(path.join(dir, f)).size / 1024)} KB)`).join("\n") : "None were written.");
}

function write(out) {
  const results = load(out), list = merged(results);
  // Each finding's first screenshot (life.js names them after the finding's key), copied next to the report.
  const safe = k => k.replace(/[^a-z0-9]+/gi, "-").slice(0, 60), dirOut = path.join(__dirname, "shots"), shots = [];
  list.forEach(g => {
    const want = safe(g.key);
    for (const r of results) {
      const dir = path.join(out, r.id), f = fs.existsSync(dir) && fs.readdirSync(dir).find(x => x === `${want}.png` || (x.startsWith(`${want}-`) && x.endsWith(".png")));
      if (!f) continue;
      fs.mkdirSync(dirOut, { recursive: true });
      fs.copyFileSync(path.join(dir, f), path.join(dirOut, `${r.id}-${f}`));
      shots.push({ key: g.key, file: `shots/${r.id}-${f}` });
      break;
    }
  });
  const md = [
    "# Kyoshi flow test: the report",
    notes.INTRO,
    "## 1. Summary",
    summary(results),
    "### Where I stand, per app: on the days an app was behind, what showed it",
    standingTable(results),
    "### Counts that matter for the flow",
    counts(results),
    "### The true cost: what the baseline left short, week after week",
    shortTable(results),
    "### Lead times: how early each kind of need first showed in Momo",
    leads(results),
    "### Robustness: the long haul and the year ends",
    timings(results),
    notes.ROBUST || "",
    "## 2. Findings, ranked",
    notes.RANKING || "",
    list.map((g, i) => findingMD(g, i, shots)).join("\n\n---\n\n"),
    "### The suspects (testplan.md): verdicts",
    suspects(results, list),
    "## 3. Fixed during the run",
    notes.FIXED,
    "## 4. Out of scope and not exercised",
    notes.SCOPE,
    "### Bundles for your own testing",
    bundles(),
    "## 5. Discussion agenda",
    notes.AGENDA(list),
    `<sub>${results.length} lives, ${list.length} findings, generated from tests/sim/out by tests/sim/report.js on ${new Date().toISOString().slice(0, 10)}. Rerun one life: \`node tests/sim/run.js <life> --weeks N\`; the same seed replays the same life.</sub>`
  ].filter(Boolean).join("\n\n");
  fs.writeFileSync(FILE, md + "\n");
  return { results, list };
}

module.exports = { write, load, lifeNumbers, merged, FILE };
