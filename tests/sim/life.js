/* Kyoshi · tests/sim/life.js — one life lived through the real page: its own browser profile and fake clock (tests/lib.js's way:
 * Playwright's clock; a day step sets the time, then runs a minute so the shell's tick fires), its devices (a phone-sized or a
 * computer-sized window, reloaded as the person closes the tab and comes back), the observer (a snapshot of every app and
 * Momo's board after each step, checked by check.js and standing.js), and what's counted: taps and drags, findings with
 * their evidence, the standing of every app every day, lead times, week by week stats. day.js says what the person does;
 * events.js the life's events; robust.js the timings and moves. run.js runs lives side by side and report.js reads them. */
"use strict";
const fs = require("fs");
const path = require("path");
const { PAGE } = require("../lib");
const mo = require("../momo");
const check = require("./check");
const { standing } = require("./standing");
const { buildWorld } = require("./world");
const { START, weekOf } = require("./lives");
const { random } = require("../generate");

const PHONE = { width: 390, height: 844 }, COMPUTER = { width: 1280, height: 1500 };
const DAY_MS = 864e5;
const dateMs = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const addDays = (d, n) => new Date(dateMs(d) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((dateMs(b) - dateMs(a)) / DAY_MS);
const dayIndex = d => (new Date(dateMs(d)).getUTCDay() + 6) % 7;
const mondayOf = d => addDays(d, -dayIndex(d));
const NAMES = { momo: "Momo", bosco: "Bosco", wanshitong: "Wan Shi Tong", appa: "Appa", hawky: "Hawky", iroh: "Iroh", badgermole: "Badgermole", turtleduck: "Turtleduck", pabu: "Pabu" };

// Each app's backup as kept (A.data.build(), its version left out; Momo's colours apart), as a hash of its content (keys in any
// order) and the sizes of its lists: compared across reloads.
const FINGERPRINT = () => {
  const out = {}, canon = v => (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v));
  const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
  Kyoshi.order.forEach(id => {
    const A = Kyoshi.apps[id];
    if (!A.started || !A.data) return;
    const b = A.data.build(), { colors, ...rest } = { ...b, appVersion: "" };
    out[id] = { hash: hash(canon(rest)), colors: hash(canon(colors || {})), sizes: Object.fromEntries(Object.entries(b).filter(([, v]) => Array.isArray(v) || (v && typeof v === "object")).map(([k, v]) => [k, Array.isArray(v) ? v.length : Object.keys(v).length])) };
  });
  return out;
};

// A local time on a day in a time zone, as ms (the clock is set in UTC).
function offsetAt(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000;
}
function zoned(date, hm, tz) {
  const guess = Date.parse(`${date}T${hm}:00Z`);
  if (tz === "UTC") return guess;
  let t = guess - offsetAt(guess, tz) * 60000;
  t = guess - offsetAt(t, tz) * 60000;
  return t;
}

class Life {
  constructor(def, browser, opts) {
    Object.assign(this, { def, browser, opts, habits: def.habits, rng: random(def.seed), stepNo: 0, taps: 0, drags: 0, device: "", mode: "screens", away: false });
    this.findings = new Map();
    this.counters = {};
    this.days = [];            // standing rows: { date, app, behind, why, dot, momo }
    this.weekStats = {};       // by Monday: { taps, drags, full, left, afterBaseline, closedOn }
    this.firstSeen = {};       // "app:id:due" -> { date, due, app, kind }
    this.memory = { did: {}, goalsByWeek: {}, laters: {}, confirmed: [], doneLog: [], recorded: [], shortWeeks: {}, lastSunday: null, people: 0, errands: 0 };
    this.simErrors = [];
    this.problems = [];        // console errors and warnings, page errors
    this.timings = [];
    this.out = path.join(opts.out, def.id);
    fs.mkdirSync(this.out, { recursive: true });
    this.contexts = 0;
  }

  // --- Small helpers for the other files ---
  addDays(d, n) { return addDays(d, n); }
  daysBetween(a, b) { return daysBetween(a, b); }
  dayIndex(d) { return dayIndex(d); }
  appName(id) { return NAMES[id] || id; }
  thisKey() { return mondayOf(this.today); }
  tap(n = 1) { this.taps += n; }
  drag(n = 1) { this.drags += n; }
  count(name, n = 1) { this.counters[name] = (this.counters[name] || 0) + n; }
  record(row) { this.days.push(row); }
  rel(app) { const r = this.habits.rel; return (app in r ? r[app] : r.default) * (this.lowFor ? 0.55 : 1); }
  uses(app) { const j = (this.habits.joins || {})[app]; return this.def.world ? this.def.world.apps.includes(app) && (!j || this.today >= j) : !!j && this.today >= j; }
  week_() { return weekOf(this.today); }
  eventIn(week) { return this.def.events.some(e => (e.on && weekOf(e.on) === week) || (e.from && weekOf(e.from) <= week && week <= weekOf(e.to))); }
  milestone(week, date) {
    const md = date.slice(5), years = this.def.years, last = weekOf(addDays(START, years * 365));
    return week <= 1 || md <= "01-07" || ["03-20", "06-21", "09-23", "12-21"].some(s => daysBetween(`${date.slice(0, 4)}-${s}`, date) >= 0 && daysBetween(`${date.slice(0, 4)}-${s}`, date) < 7) || week > last - 4;
  }
  stat(key = mondayOf(this.today)) { return this.weekStats[key] || (this.weekStats[key] = { taps: 0, drags: 0 }); }
  closed(key, on) { this.stat(key).closedOn = this.stat(key).closedOn || on; }

  // A finding: its key, what kind it is, and one piece of evidence (the first few kept); a screenshot of its first time.
  find(key, meta, evidence) {
    let f = this.findings.get(key);
    if (!f) {
      this.findings.set(key, f = { key, ...meta, life: this.def.id, seed: this.def.seed, count: 0, examples: [] });
      Object.defineProperty(f, "seen", { value: new Set(), enumerable: false });
    }
    if (f.seen.has(evidence)) return; // the same thing seen again: counted once
    if (f.seen.size < 5000) f.seen.add(evidence);
    f.count++;
    const ex = { date: this.today, step: this.stepNo, what: evidence };
    if (f.examples.length < 4 && !f.examples.some(e => e.what === evidence)) f.examples.push(ex);
    if (f.count === 1 && this.page) this.pendingShots.push(key);
  }

  // --- The browser: a profile, its clock, a tab ---
  async newContext() {
    this.contexts++;
    const ctx = await this.browser.newContext({ viewport: PHONE, locale: "en-US", timezoneId: this.def.tz });
    await ctx.clock.install({ time: zoned(this.today || START, "07:00", this.def.tz) });
    // The page's own random numbers (new ids) follow the life's seed too, a new run of them each page load (counted in the
    // profile's localStorage, so no two loads, or tabs, of a life ever repeat one: an id made twice would drop a record).
    await ctx.addInitScript(seed => {
      let n = 0;
      try { n = +(localStorage.getItem("sim.loads") || 0) + 1; localStorage.setItem("sim.loads", String(n)); } catch (err) { n = Math.floor(performance.now() * 1000); }
      let a = (seed + n * 2654435761) >>> 0;
      Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    }, this.def.seed * 7919 + this.contexts * 104729);
    return ctx;
  }
  async newPage(ctx) {
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000); // a step that can't happen fails fast (a sim error), rather than stalling the life
    page.on("console", m => { if (m.type() === "error" || m.type() === "warning") this.problem(`${m.type()}: ${m.text()}`); });
    page.on("pageerror", e => this.problem(`page error: ${e.message}`));
    page.on("dialog", d => {
      this.count(`dialog:${d.type()}`);
      this.dialogs.push([this.today, d.type(), d.message()]);
      const yes = d.type() !== "confirm" || !this.answers.length || this.answers.shift();
      (yes ? d.accept() : d.dismiss()).catch(() => {});
    });
    page.on("download", () => {});
    return page;
  }
  problem(text) {
    this.problems.push({ date: this.today, step: this.stepNo, text });
    this.find(`console:${text.replace(/\d+/g, "#").slice(0, 120)}`, { kind: "bug", sev: "blocks the flow", title: "Something in the console", console: true }, text.slice(0, 400));
  }
  async start() {
    this.today = START;
    this.dialogs = [];
    this.answers = [];
    this.pendingShots = [];
    this.ctx = await this.newContext();
    this.page = await this.newPage(this.ctx);
    this.tab = { page: this.page, ctx: this.ctx };
    await this.page.goto(`${PAGE}#momo`);
    await this.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
    if (this.def.world) {
      this.world = buildWorld(this.def.world, this.rng);
      await this.importAll(this.world.file);
      this.memory.goals = this.world.goals.map(g => g.title);
    } else {
      this.world = { goals: [], blocks: [] };
      this.memory.goals = [];
    }
    this.device = "phone";
  }
  async close() { if (this.ctx) await this.ctx.close().catch(() => {}); }

  // Developer Mode's Import all, from a file made of data (the file picker, as the user picks it).
  async importAll(data) {
    const p = this.page;
    if (!(await p.evaluate(() => document.body.classList.contains("dev-mode")))) await p.click("#kDevBadge");
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("#kDevImportAll")]);
    await chooser.setFiles({ name: "kyoshi-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
    await p.waitForTimeout(300);
    await p.click("#kDevBadge");
  }
  // Developer Mode's Export all: the file, read back.
  async exportAll() {
    const p = this.page;
    if (!(await p.evaluate(() => document.body.classList.contains("dev-mode")))) await p.click("#kDevBadge");
    const [download] = await Promise.all([p.waitForEvent("download"), p.click("#kDevExportAll")]);
    const text = fs.readFileSync(await download.path(), "utf8");
    await p.click("#kDevBadge");
    return text;
  }

  // --- Time and devices ---
  // The clock to a moment on a day (never back), then a minute so the shell's tick runs (Kyoshi.tick: new day, rollover, needs).
  async clockTo(date, hm) {
    this.today = date;
    this.hm = hm;
    const t = zoned(date, hm, this.def.tz), now = await this.page.evaluate(() => Date.now());
    if (t > now) await this.ctx.clock.setSystemTime(t);
    await this.ctx.clock.fastForward(61000);
    const seen = await this.page.evaluate(() => ({ today: Kyoshi.util.todayStr(), ticked: Kyoshi.apps.momo.S.knownToday }));
    if (seen.today !== date) this.find("clock-step", { kind: "sim", sev: "cosmetic", title: "The simulator's clock and Kyoshi's today disagree" }, `set ${date} ${hm}, Kyoshi says ${seen.today}`);
    if (seen.ticked !== seen.today) { // the minute tick didn't run: run it
      this.count("tickFallback");
      await this.page.evaluate(() => Kyoshi.tick());
    }
  }
  async tick() { await this.ctx.clock.fastForward(61000); }
  // The person opens Kyoshi (on Momo) on a device: the window's size, then the tab reloaded, waiting for every app to start.
  async open(device) {
    if (this.device !== device) { await this.page.setViewportSize(device === "phone" ? PHONE : COMPUTER); this.device = device; }
    const before = await this.page.evaluate(FINGERPRINT).catch(() => null);
    await this.page.evaluate(() => { try { history.replaceState(null, "", "#momo"); } catch (err) { /* file:// */ } });
    const t0 = Date.now();
    await this.page.reload();
    await this.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started && Kyoshi.order.every(id => Kyoshi.apps[id].started));
    this.count(`open:${device}`);
    this.lastOpenMs = Date.now() - t0;
    // Data loss across a reload: every app's backup, as kept, is the same before and after.
    const after = await this.page.evaluate(FINGERPRINT).catch(() => null);
    if (before && after) Object.keys(before).forEach(app => {
      if (!after[app]) return;
      if (before[app].hash !== after[app].hash) this.find(`reload-changed:${app}`, { kind: "bug", sev: "blocks the flow", title: "An app's data changed across a reload", dataLoss: true },
        `${this.appName(app)}: ${JSON.stringify(before[app].sizes)} before the reload, ${JSON.stringify(after[app].sizes)} after`);
      else if (before[app].colors !== after[app].colors) this.find("colors-churn", { kind: "bug", sev: "cosmetic", title: "Momo saves again on every start: the colour of other apps' event titles is dropped and given back", where: "apps/momo/data.js:189 load → colors.js:71 colorKeys (K.agenda leaves out apps not started yet)" },
          `${this.today}: Momo's colours changed across a reload (no change of the person's)`);
    });
    // The close-out, if it came up on opening: the person answers it before anything else (it covers the page).
    await require("./plan").closeOut(this, device === "phone" && this.hm === "07:00" ? "morning" : "open");
  }
  async active() { return this.page.evaluate(() => Kyoshi.active().id); }
  // Through the switcher, as the user does (the observer's own switches aren't the person's taps).
  // A pop-up on screen covers the switcher: the person answers it first (the close-out their way, any other closed).
  async switchTo(app, { observer = false } = {}) {
    if ((await this.active()) === app) return;
    if (observer) {
      await this.page.evaluate(x => Kyoshi.show(x), app);
    } else {
      const top = await this.page.evaluate(() => { const o = Kyoshi.modal.top(); return o ? o.id : ""; });
      if (top === "closeOutOverlay") await require("./plan").closeOut(this, "switch");
      else if (top) { await this.page.keyboard.press("Escape"); this.tap(1); }
      await this.page.click("#kSwitchBtn");
      await this.page.click(`#kSwitchMenu [data-app="${app}"]`);
      this.tap(2);
    }
    await this.page.waitForFunction(x => Kyoshi.active().id === x, app);
  }

  // --- The observer: Momo on screen, a snapshot, the checks ---
  async snapshot() { return this.page.evaluate(check.SNAP); }
  async observe(when) {
    this.stepNo++;
    await this.switchTo("momo", { observer: true });
    const s = this.last = await this.snapshot();
    const today = await mo.isToday(this.tab);
    let dom = null, t = null;
    if (today) t = await mo.today(this.tab);
    if (!today || this.mode === "screens") {
      // The observer looks at the board without the person's taps (a pop-up may be up): Today off, this week's tab, then back.
      const was = await this.page.evaluate(() => { const S = Kyoshi.apps.momo.S, w = { today: S.today, view: S.view }; if (S.today || S.view === "base") { S.today = false; if (S.view === "base") S.view = "this"; Kyoshi.apps.momo.renderAll(); } return w; });
      dom = await mo.board(this.tab);
      if (was.today || was.view === "base") await this.page.evaluate(w => { const S = Kyoshi.apps.momo.S; S.today = w.today; S.view = w.view; Kyoshi.apps.momo.renderAll(); }, was);
    }
    check.momo(this, s, dom);
    check.today(this, s, t);
    if (dom) this.boardProbes(s, dom, when);
    standing(this, s);
    this.leads(s);
    this.verifyDone(s, when);
    s.momo.closed.forEach(k => this.closed(k, s.today)); // quiet closes (no goals) and closes from elsewhere too
    if (when === "morning" && dayIndex(s.today) === 0) this.weekChange(s);
    if (dayIndex(s.today) === 6 && when === "evening") this.sundayNight(s);
    await this.shots();
    return s;
  }
  // Lead times: the day each need first showed in Momo, against its day.
  leads(s) {
    s.drawn.needs.forEach(n => {
      if (n.done || n.fill === "ongoing") return;
      const k = `${n.key}:${n.due || n.date || n.from || ""}`;
      if (!this.firstSeen[k]) this.firstSeen[k] = { date: s.today, due: n.due || n.date || "", from: n.from || "", app: n.app, kind: /^(\w+):/.test(n.id) ? n.id.split(":")[0] : "item", fill: n.fill };
    });
  }
  // The board on screen: the banner's count; late in the day, today still counted as 24 hours; an any-time event's minutes on its day.
  boardProbes(s, dom, when) {
    const banner = /^(\d+) past weeks/.exec(dom.banner || "") ? +RegExp.$1 : dom.banner ? 1 : 0;
    if (dom.banner !== undefined && banner !== s.truth.momo.pending.length && !s.momo.closing) this.find("banner-count", { kind: "bug", sev: "occasional", title: "The close-out banner's count is wrong" }, `banner says ${banner}, ${s.truth.momo.pending.length} weeks wait`);
    if (when === "evening" && dom.view === "this" && dom.bank.label === "To Be Budgeted" && dom.bank.num > 0) {
      this.find("today-24h", { kind: "design question", sev: "occasional", title: "Late in the day, To Be Budgeted still counts all of today's 24 hours", where: "apps/momo/model.js:52-66 budgetOf (firstDay: today counts whole)", suspect: 9 },
        `at ${this.hm} the bank said ${dom.bank.num}h ${dom.bank.of}: today's hours already gone count as free`);
    }
    dom.days.forEach(d => {
      const cards = d.cards.filter(c => !c.inner).reduce((h, c) => h + (c.hours || 0), 0) + d.cards.filter(c => c.inner).reduce((h, c) => h + (c.hours || 0), 0);
      if (d.marks.length && d.total - cards >= 0.25 - 1e-9 && !d.events.length) this.find("anytime-event-hours", { kind: "design question", sev: "cosmetic", title: "An event at any time that day (a birthday) adds its minutes to the day's total", where: "apps/momo/agenda.js:53 weekAgenda (extra: its length, whatever its time)", suspect: 9 },
        `${d.date || `day ${d.day}`}: ${d.marks.map(m => m.title.split(",")[0]).join(", ")} → the day's total is ${d.total}h with ${cards}h of cards`);
    });
  }
  // What became of the needs this person did: Appa's recorded jobs (the same day) and yesterday's ✓ (the next morning).
  verifyDone(s, when) {
    const keys = new Map(s.drawn.needs.map(n => [n.key, n]));
    this.memory.recorded.splice(0).forEach(r => {
      if (r.date !== s.today) return;
      const n = keys.get(`appa:${r.id}`);
      if (n && n.done) return;
      this.count("appaRecordedVanished");
      this.find("appa-no-done", { kind: "flow", sev: "daily rub", title: "A job recorded in Appa disappears from Momo instead of showing ✓", where: "apps/appa/share.js:12-22 (no done need; the roadmap's table says ✓ when recorded)", suspect: 2 },
        `${r.date}: “${r.title}” recorded as done; Momo's card ${n ? "still shows it as to do" : "no longer has it, and shows no ✓"}`);
    });
    if (when !== "morning") return;
    const yesterday = addDays(s.today, -1), gone = this.memory.doneLog.filter(d => d.date === yesterday && !(keys.get(`${d.app}:${d.id}`) || {}).done);
    if (gone.length) {
      this.count("yesterdayTicksGone", gone.length);
      this.find("yesterday-tick", { kind: "flow", sev: "daily rub", title: "What was done yesterday shows no ✓ in Momo today", where: "apps/momo/inbox.js:18 (K.inbox from today) and inbox.js:28-41 (no blocks before today)", suspect: 1 },
        `${yesterday}: ${gone.length} done (${gone.slice(0, 3).map(d => `${this.appName(d.app)} “${d.title}”`).join(", ")}); the next morning Momo shows none of it, done or not`);
    }
    this.memory.doneLog = this.memory.doneLog.filter(d => d.date >= yesterday);
  }
  // Sunday night: what's still in Tasks for next week (and this), and the shortfall titles, three weeks running.
  // Whether a task's needs can go on the week of key (one of them is enough; an hours task is its week's).
  canGoOn(s, t, key) {
    const byKey = new Map(s.drawn.needs.map(n => [n.key, n])), sunday = addDays(key, 6);
    return t.needs.map(k => byKey.get(k)).filter(Boolean).some(n => n.fill === "hours" || ((!n.date || (n.date >= key && n.date <= sunday)) && (!n.due || n.due >= key || n.overdue) && (!n.from || n.from <= sunday)));
  }
  sundayNight(s) {
    // What's left for next week: its tasks that can go on it (this week's, now past, aside).
    const left = s.drawn.tasks.next.filter(t => !t.ongoing && this.canGoOn(s, t, s.nextKey));
    this.stat(s.nextKey).left = left.map(t => `${t.title} ${t.hours}h`);
    this.memory.lastSunday = { key: s.thisKey, next: s.momo.cards[s.nextKey].map(c => c.id), hoursShort: s.drawn.tasks.this.filter(t => t.key.includes("|")).map(t => ({ title: t.title, hours: t.hours })) };
  }
  // Monday morning: last week's next-week cards are this week's; last week's hours shortfalls are gone, with no trace.
  weekChange(s) {
    const last = this.memory.lastSunday, prevKey = addDays(s.thisKey, -7);
    // A past week Momo never wrote to: never closed out, and not in hoursSpent (Iroh counts only closed weeks).
    if (!s.momo.prev.stored && prevKey >= mondayOf(START)) {
      this.count("weeksNeverStored");
      this.find("week-never-stored", { kind: "design question", sev: "occasional", title: "A week Momo never wrote to is never closed out, and Iroh never hears of it", where: "apps/momo/closeout.js:26 pendingCloseOuts (stored weeks only); hoursSpent:208", suspect: 10 },
        `${prevKey}: nothing was planned in Momo that week, so it has no close-out and isn't in hoursSpent: Iroh's goals ${(s.truth.iroh && s.truth.iroh.goals.length) ? `(${s.truth.iroh.goals.map(g => g.title).join(", ")}) neither count it nor show it as missed` : "would neither count it nor show it as missed"}`);
    }
    if (last && last.key === addDays(s.thisKey, -7)) {
      const now = new Set(s.momo.cards[s.thisKey].map(c => c.id)), lost = last.next.filter(id => !now.has(id));
      if (lost.length) this.find("week-change-lost", { kind: "bug", sev: "blocks the flow", title: "Cards planned for next week are gone on Monday" }, `${lost.length} of ${last.next.length} cards`);
      if (last.hoursShort.length) {
        this.count("hoursShortLost", last.hoursShort.reduce((h, t) => h + t.hours, 0));
        this.find("hours-short-vanish", { kind: "design question", sev: "occasional", title: "Last week's unplaced goal hours vanish at the week change", where: "apps/momo/tasks.js:34-36 (an hours task is only on its own week's board)", suspect: 5 },
          `${last.key}: ${last.hoursShort.map(t => `${t.title} ${t.hours}h`).join(", ")} never found a card and disappeared on Monday; nothing says so`);
      }
    }
  }
  // The same shortfall title in Tasks three weeks running, when the week is planned (titles: what the baseline left in Tasks).
  shortfalls(key, titles) {
    [...new Set(titles.map(t => t.replace(/ [\d.]+h$/, "")))].forEach(title => {
      const list = this.memory.shortWeeks[title] = (this.memory.shortWeeks[title] || []).concat(key), n = list.length;
      if (n >= 3 && list[n - 2] === addDays(key, -7) && list[n - 3] === addDays(key, -14)) {
        this.count("sameShortfall3");
        this.find(`same-shortfall:${title}`, { kind: "feature gap", sev: "daily rub", title: "The same block is short in Tasks week after week", where: "apps/momo/tasks.js (no memory of past weeks)" },
          `“${title}” was in Tasks when the week was planned, three weeks running (to the week of ${key}): ${this.habits.plan.baseline === "none" ? "there's no baseline to give it room" : "the baseline has no room for it"}, and nothing says so`);
      }
    });
  }
  async shots() {
    const keys = this.pendingShots.splice(0);
    if (!this.opts.shots) return;
    for (const k of keys) await this.page.screenshot({ path: path.join(this.out, `${k.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.png`), fullPage: false }).catch(() => {});
  }
  async milestoneShot(name) {
    if (this.opts.shots) await this.page.screenshot({ path: path.join(this.out, `${name}.png`), fullPage: true }).catch(() => {});
  }

  // --- What's written out for report.js ---
  result() {
    return {
      id: this.def.id, n: this.def.n, name: this.def.name, seed: this.def.seed, years: this.def.years, from: START, to: this.today,
      counters: this.counters, findings: [...this.findings.values()], weekStats: this.weekStats, days: this.days, firstSeen: this.firstSeen,
      problems: this.problems, simErrors: this.simErrors, timings: this.timings, dialogs: this.dialogs.slice(-200), memory: { confirmed: this.memory.confirmed.length, laters: this.memory.laters }
    };
  }
}

module.exports = { Life, zoned, addDays, daysBetween, dayIndex, mondayOf, PHONE, COMPUTER };
