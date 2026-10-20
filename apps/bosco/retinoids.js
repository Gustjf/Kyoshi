/* Bosco · retinoids.js — the retinoids (tazarotene, tretinoin, …): their data (cleaning, merging), their schedule
 * (worked out, never stored) and the rules of their pop-up (#retinoidOverlay, drawn by retinoids-ui.js); no drawing.
 * S.retinoids = { regimens, log } (store and backup key "retinoids"): each retinoid in use is a regimen { id, retinoid,
 * pct, where, time, start, steps, next, at, u, x? }, its schedule a ladder of steps ({ every: days, weeks }, the last
 * open-ended) run by calendar weeks from its start; each application confirmed is a log record { id: "<regimen>:<date>",
 * r, date, u, x? }. Nothing is deleted: a removed retinoid or an undone application is a marker (x: true, a later u), and
 * both lists merge record by record by the later change. An application comes due on its day at the usual time; the
 * interval after it is that of the step its day falls in. Like a dose, one is logged only once confirmed (on its day, or
 * today for a late one), "Not yet" asks again in an hour (this device), Postpone moves it to tomorrow, Skip passes it
 * over to the next one on the schedule (skin not up to it; Developer Mode's Skip this application too), and one not confirmed within three intervals counts as missed. One pop-up at a time: a due dose's first. On the section, one tap
 * each: Hold this step a week (a week more on the build-up step you're on) and Undo (today's application taken back, a
 * marker). Never sent to Momo. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isPos, isDate, isTime, addDays, daysBetween, todayStr, now, mergeById, fmtWeekday } = K.util;
  const { MAX_RETINOID_STEPS, MAX_UPCOMING_APPLICATIONS, DOSE_SNOOZE_MS, fmtDateBrief, fmtEvery } = A;

  // ==========================================================================
  // DATA: cleaning (storage, backups, sync saves) and merging
  // ==========================================================================
  const isWhole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const stamp = v => (Number.isFinite(v) && v >= 0 ? v : 0);
  const isId = v => typeof v === "string" && /^[a-z0-9]{1,40}$/i.test(v);
  // A stamp for a record changed here now: later than now and than the version it replaces (another device's clock may run ahead).
  const stampAbove = old => Math.max(Date.now(), old ? stamp(old.u) + 1 : 0);

  // A regimen's steps: whole numbers (1–14 days, 1–52 weeks), up to 6; the first open-ended one ends the ladder (none
  // after it would ever run), and the last is always open-ended. [] when none is usable.
  function cleanSteps(list) {
    const out = [];
    for (const s of Array.isArray(list) ? list : []) {
      if (!isObj(s) || !isWhole(s.every, 1, 14) || !(s.weeks === null || s.weeks === undefined || isWhole(s.weeks, 1, 52))) continue;
      out.push({ every: s.every, weeks: s.weeks ?? null });
      if (out[out.length - 1].weeks === null || out.length === MAX_RETINOID_STEPS) break;
    }
    if (out.length) out[out.length - 1].weeks = null;
    return out;
  }
  // A regimen from storage or a file, its fields in this order, or null if it's unusable. A retinoid this version
  // doesn't know (a newer version's) is kept as it is.
  function cleanRegimen(r) {
    if (!isObj(r) || !isId(r.id) || !isPos(r.pct) || r.pct > 5 || !isDate(r.start)) return null;
    const retinoid = typeof r.retinoid === "string" ? r.retinoid.trim().toLowerCase() : "", steps = cleanSteps(r.steps);
    if (!/^[a-z0-9 -]{1,40}$/.test(retinoid) || !steps.length) return null;
    const n = r.next;
    return {
      id: r.id, retinoid, pct: r.pct, where: typeof r.where === "string" ? r.where.trim().slice(0, 24) : "",
      time: isTime(r.time) ? r.time : null, start: r.start, steps,
      // The next application set to a day (Postpone), until one is applied after the last one when it was set.
      next: isObj(n) && (n.after === "" || isDate(n.after)) && isDate(n.date) ? { after: n.after, date: n.date } : null,
      at: stamp(r.at), u: stamp(r.u), ...(r.x === true ? { x: true } : {})
    };
  }
  // A log record, its id rebuilt from its regimen and day (never trusted), or null.
  function cleanRecord(l) {
    if (!isObj(l) || !isId(l.r) || !isDate(l.date)) return null;
    return { id: `${l.r}:${l.date}`, r: l.r, date: l.date, u: stamp(l.u), ...(l.x === true ? { x: true } : {}) };
  }
  // Both lists in the order they're kept (the same on every device): regimens by when they were added, the log by day.
  const sorted = d => ({
    regimens: d.regimens.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    log: d.log.slice().sort((a, b) => a.date.localeCompare(b.date) || a.r.localeCompare(b.r))
  });
  // The retinoids from storage or a file: undefined unless it has them (an older copy's, which leaves ours as they are);
  // else the usable records, a repeated id's later change.
  function cleanRetinoids(raw) {
    if (!isObj(raw)) return undefined;
    const list = (l, clean) => mergeById([], (Array.isArray(l) ? l : []).map(clean).filter(Boolean));
    return sorted({ regimens: list(raw.regimens, cleanRegimen), log: list(raw.log, cleanRecord) });
  }
  // Two versions record by record, each its later change (one undefined: the other's).
  const mergeRetinoids = (a, b) => (!a ? b : !b ? a : sorted({ regimens: mergeById(a.regimens, b.regimens), log: mergeById(a.log, b.log) }));
  // A change made here, kept in order (A.save() stores it).
  const keepRetinoids = d => { S.retinoids = sorted(d); };

  // ==========================================================================
  // THE SCHEDULE (worked out, never stored)
  // ==========================================================================
  const regimens = () => S.retinoids.regimens.filter(r => !r.x); // the live ones, by when they were added
  // The day of a regimen's last application, "" if none.
  const lastApplied = r => S.retinoids.log.filter(l => l.r === r.id && !l.x && l.date <= todayStr()).map(l => l.date).pop() || "";

  // The step a day falls in: { i, every, weeks, from, to } (to: null for the last, open-ended). Steps run by calendar
  // weeks from the start; a day before it is in the first.
  function stepAt(r, date) {
    let from = r.start;
    for (let i = 0; i < r.steps.length; i++) {
      const { every, weeks } = r.steps[i];
      if (weeks === null || i === r.steps.length - 1) return { i, every, weeks: null, from, to: null };
      const to = addDays(from, weeks * 7 - 1);
      if (date <= to) return { i, every, weeks, from, to };
      from = addDays(to, 1);
    }
  }

  // A regimen's next applications, as doseSchedule's doses: [{ r, date, due, after, step }], `after` its last
  // application ("" if none). From the day Postpone set, else one interval (its step's) after the last application, else
  // the start (never before it: a start moved later starts over); each next one an interval (its own day's step's) on.
  // At most three on or before today (older ones count as missed), and three in all.
  function walk(r) {
    const today = todayStr(), at = now(), after = lastApplied(r), list = [];
    let date = r.next && after <= r.next.after ? r.next.date : after ? addDays(after, stepAt(r, after).every) : r.start;
    if (date < r.start) date = r.start;
    for (let n = 0; n < 5000 && (date <= today || list.length < MAX_UPCOMING_APPLICATIONS); n++) {
      const step = stepAt(r, date);
      // In the last step the interval no longer changes: straight on to the last few before today.
      const skip = step.to === null && date < today ? Math.floor(daysBetween(date, today) / step.every) - MAX_UPCOMING_APPLICATIONS : 0;
      if (skip > 0) { date = addDays(date, skip * step.every); continue; }
      list.push({ r, date, due: at >= A.dueAt(date, r.time), after, step });
      if (list.length > MAX_UPCOMING_APPLICATIONS) list.shift();
      date = addDays(date, step.every);
    }
    return list;
  }
  const allUpcoming = () => regimens().map(r => ({ r, list: walk(r) }));

  // Words for the page.
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const day = d => `${fmtWeekday(d)}, ${fmtDateBrief(d)}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // A step's words on a card and in the pop-up: "Step 1 of 3 · every 3 days" ("Every other day" with one step).
  const stepWords = (r, step) => (r.steps.length > 1 ? `Step ${step.i + 1} of ${r.steps.length} · ${fmtEvery(step.every)}` : cap(fmtEvery(step.every)));
  // Where a regimen stands, for the Upcoming section's heading.
  function progressLine(r) {
    const today = todayStr(), n = r.steps.length;
    if (today < r.start) return `Starts ${day(r.start)} · ${n > 1 ? "step 1 of " + n + ": " : ""}${fmtEvery(r.steps[0].every)}`;
    const s = stepAt(r, today);
    if (n === 1) return cap(fmtEvery(s.every));
    if (s.to === null) return `Step ${n} of ${n} · ${fmtEvery(s.every)} from ${fmtDateBrief(s.from)} on`;
    const week = Math.floor(daysBetween(s.from, today) / 7) + 1;
    return `Step ${s.i + 1} of ${n} · ${fmtEvery(s.every)} · week ${week} of ${s.weeks} · ${fmtEvery(r.steps[s.i + 1].every)} from ${day(addDays(s.to, 1))}`;
  }
  // The editor's live note: each step with its dates ("Step 1: every 3 days, Oct 11 – Oct 24 · … · then every day from Nov 8").
  function stepsNote(start, steps) {
    if (steps.length === 1) return `${cap(fmtEvery(steps[0].every))} from ${fmtDateBrief(start)}`;
    let from = start;
    return steps.map((s, i) => {
      if (i === steps.length - 1) return `then ${fmtEvery(s.every)} from ${fmtDateBrief(from)}`;
      const to = addDays(from, s.weeks * 7 - 1), words = `Step ${i + 1}: ${fmtEvery(s.every)}, ${fmtDateBrief(from)} – ${fmtDateBrief(to)}`;
      from = addDays(to, 1);
      return words;
    }).join(" · ");
  }
  // The schedule in short, for start-up info's list: "every 3 days for 2 weeks, …, then every day · from Oct 11".
  const scheduleWords = r => r.steps.map((s, i) => (s.weeks === null ? `${i ? "then " : ""}${fmtEvery(s.every)}` : `${fmtEvery(s.every)} for ${plural(s.weeks, "week")}`)).join(", ") + ` · from ${fmtDateBrief(r.start)}`;

  // ==========================================================================
  // THE POP-UP'S RULES (as the dose's, doses.js)
  // ==========================================================================
  // The same scheduled application: its retinoid, its day, and the last application it follows.
  const sameApplication = (a, b) => a.r.id === b.r.id && a.date === b.date && a.after === b.after;
  const snoozeKey = a => `${a.r.id}:${a.date}`;
  // "Not yet"s on this device: [{ id: "<regimen>:<date>", until }], one per application put off.
  const snoozes = () => { const v = A.store.json("retinoidSnooze"); return Array.isArray(v) ? v.filter(s => isObj(s) && typeof s.id === "string" && Number.isFinite(s.until)) : []; };

  // Pops up for the first due application (each retinoid's earliest; `due`: every due one, earliest first) unless "Not
  // yet" put it off, and never over another pop-up (a due dose's comes first). An open one stays, kept up to date, while
  // its application is still due as shown, and closes if the schedule moves on meanwhile.
  function promptDueApplication(due) {
    const asked = S.applyAsking && due.find(a => sameApplication(a, S.applyAsking));
    if (asked) return A.openApplicationModal(asked);
    if (S.applyAsking) A.closeApplicationModal();
    if (S.doseAsking || K.modal.top(A.root) || K.bugs.isOpen()) return;
    const t = now(), off = snoozes().filter(s => t < s.until).map(s => s.id);
    const next = due.filter((a, i) => due.findIndex(b => b.r.id === a.r.id) === i).find(a => !off.includes(snoozeKey(a)));
    if (next) A.openApplicationModal(next);
  }

  // Whether the pop-up's application is still due just as it shows it; if not, it closes and asks afresh.
  function stillAsked() {
    if (allUpcoming().some(g => g.list.some(a => a.due && sameApplication(a, S.applyAsking)))) return true;
    A.closeApplicationModal();
    A.renderAll();
    return false;
  }

  // Logs the application on its day or (a late one applied late) today; the schedule counts on from there. Applying a
  // day undone (a marker) logs it again.
  function confirmApplication(today) {
    if (!S.applyAsking || !stillAsked()) return;
    const r = S.applyAsking.r.id, date = today ? todayStr() : S.applyAsking.date, id = `${r}:${date}`;
    const old = S.retinoids.log.find(l => l.id === id);
    keepRetinoids({ ...S.retinoids, log: S.retinoids.log.filter(l => l !== old).concat({ id, r, date, u: stampAbove(old) }) });
    A.closeApplicationModal();
    A.save();
    A.renderAll();
  }

  // Moves the application to tomorrow, and the ones after it along with it (how a night is skipped); nothing is logged.
  function postponeApplication() {
    if (!S.applyAsking || !stillAsked()) return;
    const { r: { id }, after } = S.applyAsking;
    A.closeApplicationModal();
    setNext(id, { after, date: addDays(todayStr(), 1) });
  }

  // The day Skip goes to: the next one on the schedule after the application's (each its own day's step's interval on),
  // never before today (any in between are past: missed with it).
  function skipTo(a) {
    const today = todayStr();
    let date = a.date;
    do date = addDays(date, stepAt(a.r, date).every); while (date < today);
    return date;
  }
  // Skips the application (the skin needs a rest): the next one is the schedule's next, its days kept as they were; nothing
  // is logged.
  function skipApplication() {
    if (!S.applyAsking || !stillAsked()) return;
    const a = S.applyAsking;
    A.closeApplicationModal();
    setNext(a.r.id, { after: a.after, date: skipTo(a) });
  }
  // A regimen's `next` set (Postpone's or Skip's day; null: back on its schedule), kept and shown at once.
  function setNext(id, next) {
    keepRetinoids({ ...S.retinoids, regimens: S.retinoids.regimens.map(r => (r.id === id ? { ...r, next, u: stampAbove(r) } : r)) });
    A.save();
    A.renderAll();
  }

  // An application put off for an hour, on this device.
  function putOff(a) {
    const id = snoozeKey(a), t = now();
    A.store.set("retinoidSnooze", JSON.stringify(snoozes().filter(s => t < s.until && s.id !== id).concat({ id, until: t + DOSE_SNOOZE_MS })));
  }
  // "Not yet" asks again in an hour (on this device); then the next retinoid waiting, if any. Also Esc and a click beside it.
  function snoozeApplication() {
    if (!S.applyAsking) return;
    putOff(S.applyAsking);
    A.closeApplicationModal();
    A.renderAll();
  }

  // ==========================================================================
  // ONE TAP ON THE SECTION: HOLD THIS STEP A WEEK, UNDO
  // ==========================================================================
  // The step today is in, if it can be held a week: a timed one (not the last), once started, under 52 weeks; else null.
  function holdable(r) {
    const today = todayStr();
    if (today < r.start) return null;
    const s = stepAt(r, today);
    return s.to !== null && s.weeks < 52 ? s : null;
  }
  // Hold this step a week: one more week on the build-up step you're on; the steps after it start a week later.
  function holdStep(id) {
    const r = regimens().find(x => x.id === id), s = r && holdable(r);
    if (!s) return;
    const steps = r.steps.map((x, i) => (i === s.i ? { ...x, weeks: x.weeks + 1 } : x));
    keepRetinoids({ ...S.retinoids, regimens: S.retinoids.regimens.map(x => (x === r ? { ...r, steps, u: stampAbove(r) } : x)) });
    A.save();
    A.renderAll();
    A.renderRetinoidsSetup(); // start-up info's list says the weeks
  }

  // Whether the latest application is today's (one confirmed by mistake can be taken back).
  const undoable = r => lastApplied(r) === todayStr();
  // Undo: today's application taken back, its record a marker (so it stays undone on every device). The application
  // due again is put off an hour, so the pop-up doesn't come straight back (its card's Applied ✓ is there).
  function undoApplication(id) {
    const r = regimens().find(x => x.id === id);
    if (!r || !undoable(r)) return;
    const rid = `${id}:${todayStr()}`;
    keepRetinoids({ ...S.retinoids, log: S.retinoids.log.map(l => (l.id === rid ? { ...l, x: true, u: stampAbove(l) } : l)) });
    const due = walk(r).find(a => a.due);
    if (due) putOff(due);
    A.save();
    A.renderAll();
  }

  Object.assign(A, {
    cleanRetinoids, mergeRetinoids, keepRetinoids, stampAbove, regimens, lastApplied, stepAt, walk, allUpcoming, stepWords, progressLine,
    stepsNote, scheduleWords, sameApplication, promptDueApplication, confirmApplication, postponeApplication, skipTo, skipApplication, setNext,
    snoozeApplication, holdable, holdStep,
    undoable, undoApplication
  });
})(Kyoshi, Kyoshi.apps.bosco);
