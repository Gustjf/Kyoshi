/* Badgermole · stats.js — the maths, worked out from the data and never stored: each session's length and a
 * routine's usual one, the week's count and the streak, the next routine in the rotation, bests and PRs (the
 * estimated one-rep max, or most reps for a bodyweight exercise), what a set's steppers start at, and the calendar's
 * month. Results from the stored data are remembered until it (S.version) or the day changes; the session in
 * progress is read afresh. "Today" is K.util.todayStr(), so time travel works. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, mean, todayStr } = K.util;
  const { DEFAULT_MINUTES, ESTIMATE_RUNS, MAX_SESSION_MINUTES, MAX_REPS, MAX_WEIGHT, niceMinutes, mondayOf, toKg, convert, inUnit, unit, round2, stepOf } = A;

  let memoKey = "", memo = new Map();
  function remember(key, fn) {
    const k = `${S.version}|${todayStr()}`;
    if (k !== memoKey) { memoKey = k; memo = new Map(); }
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  }

  // The stored sessions in the order they happened (never the one in progress), and by day.
  const sessions = () => remember("sessions", A.sortedSessions);
  const byDay = () => remember("byDay", () => {
    const out = new Map();
    sessions().forEach(s => (out.get(s.date) || out.set(s.date, []).get(s.date)).push(s));
    return out;
  });
  const sessionsOn = date => byDay().get(date) || [];
  // The latest session of a routine, and the latest with an exercise in it.
  const latest = (key, test) => remember(key, () => { const list = sessions(); for (let i = list.length - 1; i >= 0; i--) if (test(list[i])) return list[i]; return null; });
  const lastOf = routineId => latest(`last:${routineId}`, s => s.routineId === routineId);
  const lastWith = exerciseId => latest(`with:${exerciseId}`, s => s.sets.some(x => x.exerciseId === exerciseId));
  const exerciseCount = s => new Set(s.sets.map(x => x.exerciseId)).size;

  // --- How long ---
  // A session's minutes, from start to finish (1 to MAX_SESSION_MINUTES; 0 when its times aren't known).
  const sessionMinutes = s => (s.started && s.finished ? Math.min(MAX_SESSION_MINUTES, Math.max(1, Math.round((s.finished - s.started) / 60000))) : 0);
  // How long a routine usually takes: the average of its latest sessions, rounded to suit; 60 minutes before any.
  const usualMinutes = routineId => remember(`usual:${routineId}`, () => {
    const runs = sessions().filter(s => s.routineId === routineId).map(sessionMinutes).filter(m => m > 0).slice(-ESTIMATE_RUNS);
    return runs.length ? niceMinutes(mean(runs)) : DEFAULT_MINUTES;
  });

  // --- Weeks (Monday to Sunday) ---
  const weekCounts = () => remember("weeks", () => {
    const out = new Map();
    sessions().forEach(s => { const m = mondayOf(s.date); out.set(m, (out.get(m) || 0) + 1); });
    return out;
  });
  const weekCount = monday => weekCounts().get(monday) || 0;
  const thisWeek = () => weekCount(mondayOf(todayStr()));
  // Weeks in a row that hit the weekly target (as it is now): this week counts once it's hit, and never breaks the
  // streak while it's still open; rest days don't matter.
  const streak = () => remember("streak", () => {
    const target = S.settings.weeklyTarget, monday = mondayOf(todayStr());
    let n = weekCount(monday) >= target ? 1 : 0;
    for (let m = addDays(monday, -7); weekCount(m) >= target; m = addDays(m, -7)) n++;
    return n;
  });

  // --- The rotation ---
  // Where the next workout is in the program followed (-1 with none): the place whose run of routines, read backwards,
  // best matches the latest sessions since it was picked (ties: the first such place), plus one; its first routine
  // before any. Worked out, never stored, so it syncs by itself, copes with repeats (Upper, Lower, Upper, Lower) and
  // sets itself right after a routine out of order.
  const nextIndex = () => remember("next", () => {
    const order = A.liveOrder(), len = order.length, inProgram = new Set(order), since = S.program.since;
    if (!len) return -1;
    const recent = sessions().filter(s => s.started >= since).map(s => s.routineId).filter(id => inProgram.has(id)).reverse().slice(0, len);
    if (!recent.length) return 0;
    let best = 0, bestRun = 0;
    for (let p = 0; p < len; p++) {
      let k = 0;
      while (k < recent.length && order[(p - k + len * len) % len] === recent[k]) k++;
      if (k > bestRun) { best = p; bestRun = k; }
    }
    return (best + 1) % len;
  });
  // The routine i workouts after the next (0: the next), going round the program; null without one.
  function upNext(i = 0) {
    const order = A.liveOrder(), next = nextIndex();
    return next < 0 ? null : A.routineById(order[(next + i) % order.length]);
  }

  // --- Bests and PRs ---
  // What a set scores: a weighted one its estimated one-rep max in kg (Epley: weight × (1 + reps ÷ 30)); a bodyweight
  // one its reps, then its added weight. null for a set of no reps, which never counts.
  const scoreOf = s => (s.reps < 1 ? null : s.bodyweight ? [s.reps, toKg(s.weight, s.unit)] : [toKg(s.weight, s.unit) * (1 + s.reps / 30), 0]);
  const EPS = 1e-9;
  const beats = (a, b) => a[0] > b[0] + EPS || (Math.abs(a[0] - b[0]) <= EPS && a[1] > b[1] + EPS);
  // Sets are compared with the same exercise's sets of the same kind (a bodyweight set's weight is what was added).
  const kindKey = s => `${s.exerciseId}|${s.bodyweight ? 1 : 0}`;
  // One pass over the stored sessions in order: each exercise's best so far, and the sets that were a PR when
  // logged (an earlier set of it existed and this one beat them all). best: kind -> { score, set, date }; prs: "sessionId:index".
  const history = () => remember("history", () => {
    const best = new Map(), prs = new Set();
    sessions().forEach(s => s.sets.forEach((set, i) => {
      const score = scoreOf(set), b = score && best.get(kindKey(set));
      if (!score) return;
      if (b && beats(score, b.score)) prs.add(`${s.id}:${i}`);
      if (!b || beats(score, b.score)) best.set(kindKey(set), { score, set, date: s.date });
    }));
    return { best, prs };
  });
  // An exercise's best set ({ set, date }; ties go to the earliest), or null before any.
  const bestOf = e => history().best.get(kindKey({ exerciseId: e.id, bodyweight: e.bodyweight })) || null;
  const isStoredPR = (sessionId, i) => history().prs.has(`${sessionId}:${i}`);
  // The session in progress's PRs (indexes into its sets): its sets come after every stored one. Worked out on each
  // call (a few sets), as the session isn't part of S.version.
  function livePRs() {
    const out = new Set(), best = new Map();
    (S.live ? S.live.sets : []).forEach((set, i) => {
      const score = scoreOf(set);
      if (!score) return;
      const key = kindKey(set), b = best.has(key) ? best.get(key) : history().best.get(key);
      if (b && beats(score, b.score)) out.add(i);
      if (!b || beats(score, b.score)) best.set(key, { score });
    });
    return out;
  }
  // A best as words: "185 lb × 5 (est. 1RM 216)", or for a bodyweight exercise "12 reps +25 lb".
  function bestText(e) {
    const b = bestOf(e);
    if (!b) return "";
    if (e.bodyweight) return A.fmtSet(b.set);
    const oneRM = Math.round(convert(b.score[0], "kg", unit()));
    return `${A.fmtSet(b.set)} (est. 1RM ${oneRM})`;
  }

  // --- Prefill: what the steppers start at for set n of an exercise in the session (item: its line), in the unit
  // shown: { weight, reps, up }. (1) This session's latest set of it (a change you typed carries on); else (2) the
  // last session with it: its set n, else its last set of it, one step up (the exercise's progression step: +5 lb is
  // +2.5 kg; a bodyweight exercise one rep) when every planned set of it reached the routine's reps (its minimum, for
  // one to failure: "↑ +5 lb from last time"); else (3) the routine's line. Weights in another unit are converted and
  // rounded to the nearest 0.5. ---
  function prefill(item, n) {
    const mine = S.live ? S.live.sets.filter(s => s.exerciseId === item.exerciseId) : [];
    if (mine.length) { const s = mine[mine.length - 1]; return { weight: inUnit(s.weight, s.unit), reps: Math.max(1, s.reps), up: false }; }
    const last = lastWith(item.exerciseId);
    if (!last) return { weight: inUnit(item.weight, item.unit), reps: item.reps, up: false };
    const sets = last.sets.filter(s => s.exerciseId === item.exerciseId), s = sets.find(x => x.n === n) || sets[sets.length - 1];
    const up = sets.length >= item.sets && sets.slice(0, item.sets).every(x => x.reps >= item.reps);
    let weight = inUnit(s.weight, s.unit), reps = Math.max(1, s.reps);
    if (up && item.bodyweight) reps = Math.min(MAX_REPS, reps + 1);
    else if (up) weight = Math.min(MAX_WEIGHT, round2(weight + stepOf(item.exerciseId)));
    return { weight, reps, up };
  }

  // --- The calendar: 6 weeks from the Monday on or before the 1st, each day { date, inMonth, sessions } ---
  function monthCells(month) {
    const start = mondayOf(`${month}-01`);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(start, i);
      return { date, inMonth: date.slice(0, 7) === month, sessions: sessionsOn(date) };
    });
  }

  Object.assign(A, {
    sessions, sessionsOn, lastOf, lastWith, exerciseCount, sessionMinutes, usualMinutes, weekCount, thisWeek, streak,
    nextIndex, upNext, bestOf, bestText, isStoredPR, livePRs, prefill, monthCells
  });
})(Kyoshi, Kyoshi.apps.badgermole);
