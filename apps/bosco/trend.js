/* Bosco · trend.js — the numbers behind the views: Current Trend's weekly rate, the weekly
 * pace goal, the 7-day averages goals go by, goal status & ETAs, and dose totals. model()
 * derives what renders need, once per render. Pure math over A.S — nothing here draws or saves. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { mean, daysBetween, addDays, todayStr, fmtNum } = K.util;
  const { TREND_MIN_WEIGHINS, DEFAULT_PACE_GOAL, MAX_ETA_WEEKS, GOAL_AVG_DAYS, hasWeight, hasDose } = A;

  const weightEntries = () => S.entries.filter(hasWeight);
  const customRate = () => parseFloat(A.$("customRate").value) || 0;

  // Weigh-ins within `days` of the latest one.
  function lastDays(w, days) {
    if (!w.length) return w;
    const last = w[w.length - 1].date;
    return w.filter(e => daysBetween(e.date, last) <= days);
  }

  /**
   * Current Trend's weekly rate: your latest 7-day average weight (the 7 days
   * ending on the latest weigh-in) against the 7-day average `days` earlier.
   * The change between them is spread over the days actually between the two
   * (from the average date of each one's weigh-ins), so a missed weigh-in can't
   * make it look faster or slower, and compounded to a week as projections are.
   * Returns { rate: fraction a week (positive = losing), perWeek: weight a week,
   * now, then: the two averages, apart: days between them }, or null without
   * TREND_MIN_WEIGHINS weigh-ins in each.
   */
  function weeklyTrend(w, days) {
    if (!w.length) return null;
    const end = w[w.length - 1].date;
    const weekTo = last => w.filter(e => e.date <= last && daysBetween(e.date, last) < 7);
    const recent = weekTo(end), earlier = weekTo(addDays(end, -days));
    if (recent.length < TREND_MIN_WEIGHINS || earlier.length < TREND_MIN_WEIGHINS) return null;
    const avgWeight = ws => mean(ws.map(e => e.weight)), avgDay = ws => mean(ws.map(e => daysBetween(end, e.date)));
    const now = avgWeight(recent), then = avgWeight(earlier), apart = avgDay(recent) - avgDay(earlier);
    return { rate: 1 - Math.pow(now / then, 7 / apart), perWeek: (now - then) * 7 / apart, now, then, apart };
  }

  // The weekly pace goal: the one saved in start-up info, or the default until then.
  const paceGoal = () => S.profile.paceGoal || DEFAULT_PACE_GOAL;
  // Its %s as precise as they were entered (to 4 places): 1 -> "1%", 0.125 -> "0.125%".
  const fmtPacePct = v => `${fmtNum(v, 4)}%`;
  // The goal as entered: "lose 1% ± 0.125%", or "lose 1%" with no range.
  const fmtPaceGoal = g => `${g.dir} ${fmtPacePct(g.weeklyPct)}${g.rangePct ? ` ± ${fmtPacePct(g.rangePct)}` : ""}`;
  // Its on-pace range, or `times` that range (never below no change): "0.875–1.125%", or "1%" with no range.
  const fmtPaceBand = (g, times = 1) => {
    const r = g.rangePct * times;
    return r ? `${fmtNum(Math.max(0, g.weeklyPct - r), 4)}–${fmtPacePct(g.weeklyPct + r)}` : fmtPacePct(g.weeklyPct);
  };
  // Green within the pace goal's range, yellow within twice it, red beyond that or going the wrong way.
  const PACE_STATUS = {
    on: ["On pace", "good"], fast: ["Slightly fast", "warn"], slow: ["Slightly slow", "warn"],
    tooFast: ["Too fast", "bad"], tooSlow: ["Too slow", "bad"], wrong: ["Wrong direction", "bad"]
  };

  // Where a weekly rate (positive = losing) stands against the pace goal, by the
  // % as shown: "on" pace, a little off ("fast", "slow"), further off ("tooFast",
  // "tooSlow"), or going the "wrong" way.
  function paceStatus(rate) {
    const g = paceGoal(), pct = +((g.dir === "gain" ? -rate : rate) * 100).toFixed(2); // toward the goal
    const off = Math.abs(pct - g.weeklyPct) - 1e-9; // from the target, less a hair for rounding
    if (off <= g.rangePct) return "on";
    if (pct < 0) return "wrong";
    const fast = pct > g.weeklyPct;
    return off <= 2 * g.rangePct ? (fast ? "fast" : "slow") : fast ? "tooFast" : "tooSlow";
  }

  // The weigh-ins, each weight replaced by the mean of those in the GOAL_AVG_DAYS days ending on its
  // day (the first days average what there is), to 1 decimal as weights are kept: what goals are
  // reached by, and where their ETAs and the season projections start from.
  function averaged(w) {
    let from = 0;
    return w.map((e, i) => {
      while (daysBetween(w[from].date, e.date) >= GOAL_AVG_DAYS) from++;
      return { date: e.date, weight: Math.round(mean(w.slice(from, i + 1).map(x => x.weight)) * 10) / 10 };
    });
  }

  // Everything the views need, derived once per render: w, the weigh-ins; wa, their 7-day averages.
  function model() {
    const w = weightEntries();
    const trend = weeklyTrend(w, +S.trendWindow);
    const dir = paceGoal().dir; // which way counts as progress
    // The slider is signed like the display (negative = lose); rates are positive = lose.
    const rate = S.rateMode === "trend" ? (trend ? trend.rate : 0) : -customRate() / 100;
    const sorted = S.goals.slice().sort((a, b) => (dir === "gain" ? a - b : b - a)); // nearest goal first
    return { w, wa: averaged(w), trend, dir, rate, goals: sorted };
  }

  // A goal is reached once the latest 7-day average (wa: averaged) has moved from the
  // first one to (or past) it; returns the first day the average got there.
  function reachedDate(goal, wa) {
    const start = wa[0].weight, cur = wa[wa.length - 1].weight;
    if (goal < Math.min(start, cur) || goal > Math.max(start, cur)) return null;
    return wa.find(e => (goal <= start ? e.weight <= goal : e.weight >= goal)).date;
  }

  // A goal's status by the 7-day averages (wa), its ETA counted from the latest one.
  function goalStatus(goal, wa, rate) {
    const reached = reachedDate(goal, wa);
    if (reached) return { status: "reached", date: reached };
    if (!rate) return { status: "flat" };
    const last = wa[wa.length - 1];
    const weeks = Math.log(goal / last.weight) / Math.log1p(-rate);
    if (!(weeks > 0)) return { status: "unreachable" }; // moving away from it
    if (weeks > MAX_ETA_WEEKS) return { status: "flat" };
    return { status: "projected", weeks, date: addDays(last.date, Math.round(weeks * 7)) };
  }

  // Doses taken so far, totalled per medication: { medicationId: mg }.
  function cumulativeDoseMg() {
    const today = todayStr(), totals = {};
    S.entries.filter(e => hasDose(e) && e.date <= today).forEach(e => { totals[e.medication] = (totals[e.medication] || 0) + e.doseMg; });
    Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k] * 100) / 100; });
    return totals;
  }

  Object.assign(A, {
    weightEntries, customRate, lastDays, weeklyTrend, paceGoal, fmtPacePct, fmtPaceGoal, fmtPaceBand,
    PACE_STATUS, paceStatus, averaged, model, reachedDate, goalStatus, cumulativeDoseMg
  });
})(Kyoshi, Kyoshi.apps.bosco);
