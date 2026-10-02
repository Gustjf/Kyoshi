/* Appa · schedule.js — the maths, worked out from the data and never stored: each thing's readings and
 * pace, when each job is due next (by time, season or meter, whichever comes first), its status, how
 * long it takes, when to ask for a fresh reading, and the words for all that. Results are remembered
 * until the data (S.version) or the day changes. "Today" is K.util.todayStr(), so time travel works. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, addMonths, daysBetween, todayStr, localDate, mean } = K.util;
  const { LEAD_DAYS, SOON_DAYS, READING_AHEAD, READING_STALE, ESTIMATE_RUNS, UNITS, niceMinutes, fmtDay, fmtReading, meterOf } = A;

  let memoKey = "", memo = new Map();
  function remember(key, fn) {
    const k = `${S.version}|${todayStr()}`;
    if (k !== memoKey) { memoKey = k; memo = new Map(); }
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  }
  const dateOf = ms => (ms > 0 ? localDate(new Date(ms)) : todayStr());

  // ==========================================================================
  // Readings
  // ==========================================================================
  // A thing's readings, oldest first, the highest one per day: logged ones, records', and jobs' "counted from".
  const points = thingId => remember(`pts:${thingId}`, () => {
    const byDay = new Map();
    const add = (date, value) => { if (date && value !== null && value !== undefined && !(byDay.get(date) >= value)) byDay.set(date, value); };
    A.live(S.readings).forEach(r => { if (r.thingId === thingId) add(r.date, r.value); });
    A.live(S.records).forEach(r => { if (r.thingId === thingId) add(r.date, r.reading); });
    A.live(S.jobs).forEach(j => { if (j.thingId === thingId) add(j.from.date, j.from.reading); });
    return [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  });
  const lastReading = thingId => { const p = points(thingId); return p.length ? p[p.length - 1] : null; };

  // Units a day: measured from the readings once they span 30 days or more (the last year's), leaning
  // on the yearly guess until they cover about 6 months. null when there's nothing to go on.
  const pace = thing => remember(`pace:${thing.id}`, () => {
    const guess = thing.pace > 0 ? thing.pace / 365.25 : null, pts = points(thing.id);
    if (pts.length < 2) return guess;
    const last = pts[pts.length - 1], recent = pts.filter(p => p.date >= addDays(last.date, -365));
    const use = recent.length >= 2 ? recent : pts, span = daysBetween(use[0].date, last.date);
    if (span < 30) return guess;
    const measured = Math.max(0, (last.value - use[0].value) / span);
    if (guess === null) return measured;
    const trust = Math.min(1, span / 182);
    return trust * measured + (1 - trust) * guess;
  });

  // What a thing's meter is estimated to show on a day (today by default); null without any reading.
  function estimate(thing, date = todayStr()) {
    const last = lastReading(thing.id), p = pace(thing);
    if (!last) return null;
    return date > last.date && p ? last.value + p * daysBetween(last.date, date) : last.value;
  }

  // ==========================================================================
  // When a job is due
  // ==========================================================================
  const after = (date, { n, unit }) => (unit === "d" ? addDays(date, n) : unit === "w" ? addDays(date, 7 * n) : addMonths(date, unit === "y" ? 12 * n : n));
  // The first start of one of the chosen seasons after a day (K.seasons.seasonStart: the season under way counts too).
  function nextSeason(date, seasons) {
    for (let y = +date.slice(0, 4); y <= +date.slice(0, 4) + 2; y++) {
      const next = seasons.map(s => K.seasons.seasonStart(y, s)).filter(d => d > date).sort()[0];
      if (next) return next;
    }
    return null;
  }

  // The latest record with a job in it: { date, reading, record }, or null.
  const lastDone = job => remember(`last:${job.id}`, () => {
    const r = A.recordsOf(job.thingId).find(x => x.jobs.some(j => j.jobId === job.id));
    return r ? { date: r.date, reading: r.reading, record: r } : null;
  });
  // Where a job counts from: its latest record, else the day and reading it was set to count from
  // (else when it was added). A missing reading is estimated for that day.
  function baseOf(job) {
    const thing = A.thingById(job.thingId), last = lastDone(job);
    const date = last ? last.date : job.from.date || dateOf(job.at);
    let reading = last ? last.reading : job.from.reading;
    if (reading === null && thing && thing.meter) reading = estimate(thing, date);
    return { date, reading };
  }

  // When a job is next due: { date (by time, or projected from the meter), reading (the meter's due
  // reading), by ("time" | "meter"), overdue, days (from today, negative once past) }. date is null
  // when it can't be told (a meter job with nothing to project from, or projected over a century out).
  const FAR = 36525; // days: a century, past which a meter's pace says nothing (and dates run out)
  const dueOf = job => remember(`due:${job.id}`, () => {
    const thing = A.thingById(job.thingId), b = baseOf(job), today = todayStr();
    const timeDate = job.every ? after(b.date, job.every) : job.seasons.length ? nextSeason(b.date, job.seasons) : null;
    let reading = null, meterDate = null, reached = false;
    if (thing && thing.meter && job.meterEvery && b.reading !== null) {
      reading = b.reading + job.meterEvery;
      const last = lastReading(thing.id), p = pace(thing), days = last && p ? (reading - last.value) / p : null;
      if (last && last.value >= reading) {
        reached = true;
        meterDate = p ? addDays(last.date, Math.max(-FAR, Math.ceil(days))) : last.date;
      } else if (days !== null && days <= FAR) meterDate = addDays(last.date, Math.ceil(days));
    }
    const date = [timeDate, meterDate].filter(Boolean).sort()[0] || null;
    return {
      date, reading, timeDate, meterDate,
      by: date && date === meterDate && date !== timeDate ? "meter" : "time",
      overdue: reached || (!!date && date < today),
      days: date ? daysBetween(today, date) : null
    };
  });

  // "overdue"; "soon" (within LEAD_DAYS: it's in Momo); "near" (within SOON_DAYS); "later"; or "unknown".
  function statusOf(job) {
    const d = dueOf(job);
    if (d.overdue) return "overdue";
    if (d.date === null) return "unknown";
    return d.days <= LEAD_DAYS ? "soon" : d.days <= SOON_DAYS ? "near" : "later";
  }

  // How long a job takes: the average of its last few times, rounded to suit; your guess before any.
  const minutesOf = job => remember(`min:${job.id}`, () => {
    const times = A.recordsOf(job.thingId).map(r => r.jobs.find(x => x.jobId === job.id)).filter(x => x && x.minutes).slice(0, ESTIMATE_RUNS).map(x => x.minutes);
    return times.length ? niceMinutes(mean(times)) : job.est ? niceMinutes(job.est) : null;
  });

  // Whether a thing's meter needs a fresh reading: { since, why: "none" | "stale" | "due" }, or null.
  // Only things with meter jobs ask: with no reading yet, when the last is over READING_STALE days old,
  // or once per job when a meter job is projected within READING_AHEAD days.
  const readingAsk = thing => remember(`ask:${thing.id}`, () => {
    if (!thing.meter || thing.archived || thing.deleted) return null;
    const jobs = A.jobsOf(thing.id).filter(j => j.meterEvery);
    if (!jobs.length) return null;
    const last = lastReading(thing.id), today = todayStr();
    if (!last) return { since: dateOf(thing.at), why: "none" };
    if (daysBetween(last.date, today) > READING_STALE) return { since: addDays(last.date, READING_STALE + 1), why: "stale" };
    for (const j of jobs) {
      const d = dueOf(j);
      if (d.meterDate && !d.overdue && daysBetween(today, d.meterDate) <= READING_AHEAD) {
        const enter = addDays(d.meterDate, -READING_AHEAD);
        if (last.date < enter) return { since: enter, why: "due" };
      }
    }
    return null;
  });

  // Every job of the things in use with its due and status: overdue first, then soonest (unknown last).
  const upcoming = () => remember("upcoming", () => A.activeThings().flatMap(t => A.jobsOf(t.id))
    .map(job => ({ job, due: dueOf(job), status: statusOf(job) }))
    .sort((a, b) => b.due.overdue - a.due.overdue || (a.due.date || "9999").localeCompare(b.due.date || "9999") || a.job.name.localeCompare(b.job.name)));
  const nextOf = thingId => upcoming().find(x => x.job.thingId === thingId) || null;

  // ==========================================================================
  // Words
  // ==========================================================================
  // "Every 6 months or 5,000 mi", "Each fall", "Every 5,000 mi".
  function everyText(job, thing) {
    const parts = [];
    if (job.every) parts.push(job.every.n === 1 ? `Every ${UNITS[job.every.unit][0]}` : `Every ${job.every.n} ${UNITS[job.every.unit][1]}`);
    else if (job.seasons.length) parts.push(`Each ${job.seasons.map(s => K.seasons.NAMES[s].toLowerCase()).join(" and ")}`);
    if (job.meterEvery && meterOf(thing)) parts.push(`${parts.length ? "" : "Every "}${fmtReading(job.meterEvery, thing)}`);
    return parts.join(" or ") || "No schedule";
  }
  // "3 days overdue", "Due today", "Due in 9 days", "Due Oct 20", "About Nov 20 (53,210 mi)", "At 53,210 mi".
  function dueText(job) {
    const d = dueOf(job), thing = A.thingById(job.thingId), at = d.reading !== null && d.by === "meter" ? ` (${fmtReading(Math.round(d.reading), thing)})` : "";
    if (d.date === null) return d.reading !== null ? `At ${fmtReading(Math.round(d.reading), thing)}` : "Needs a reading";
    if (d.overdue) return d.days < 0 ? `${-d.days} day${d.days === -1 ? "" : "s"} overdue${at}` : `Due now${at}`;
    if (d.days === 0) return `Due today${at}`;
    if (d.days === 1) return `Due tomorrow${at}`;
    if (d.days <= LEAD_DAYS) return `Due in ${d.days} days${at}`;
    return `${d.by === "meter" ? "About " : "Due "}${fmtDay(d.date)}${at}`;
  }
  // "Sep 12 · 48,210 mi" for a job's last time, or "Not yet".
  function lastText(job) {
    const last = lastDone(job), thing = A.thingById(job.thingId);
    if (!last) return job.from.date ? `Counting from ${fmtDay(job.from.date)}` : "Not yet";
    return `${fmtDay(last.date)}${last.reading !== null ? ` · ${fmtReading(last.reading, thing)}` : ""}`;
  }
  // "about 1,000 mi a month" for a thing's pace.
  function paceText(thing) {
    const p = pace(thing);
    if (!p || !meterOf(thing)) return "";
    const month = p * 30.44;
    return month >= 1 ? `about ${fmtReading(Math.round(month), thing)} a month` : `about ${fmtReading(Math.round(p * 365.25), thing)} a year`;
  }

  Object.assign(A, {
    remember, dateOf, points, lastReading, pace, estimate, addMonths, nextSeason, lastDone, baseOf, dueOf, statusOf, minutesOf,
    readingAsk, upcoming, nextOf, everyText, dueText, lastText, paceText
  });
})(Kyoshi, Kyoshi.apps.appa);
