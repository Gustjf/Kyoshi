/* Momo · holidays.js — your work's holidays and free days off (data.holidays, model.js): a whole day each, by its date,
 * with its name. One next to a weekend joins it (weekends.js: its span runs over it) and costs no PTO, a day off on it
 * included (timeoff.js); one on its own is a row among Upcoming weekends, which can hold a plan. Either way a violet sun
 * marks it where a day off's gold one would be (offHTML). Brought in from Developer Mode's Time off block (Holidays…):
 * a pop-up (#holidaysOverlay) to paste a list (a date, then its name, a line each; a run of days as "2026-12-24 to
 * 2026-12-26 Winter break" or "2026-12-24 for 3 days Winter break") or pick a calendar file (.ics: its all-day events;
 * .txt / .csv as pasted), showing what it read before Add keeps it; then the holidays from today on, a run of days with
 * the same name as one, each with ✕ (Undo brings it back). Removing one keeps it as "" with its time, so the removal wins
 * over an older copy's when two devices combine. Nothing goes over the network. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isObj, isPos, esc, isDate, addDays, daysBetween, todayStr, fmtShort } = K.util;
  const { PLAN_MAX, DAY_NAMES, cleanText, dayIndex } = A;

  const NAME_MAX = 40;       // a holiday's name
  const RUN_MAX = 14;        // days in one line's run (Dec 24 – Dec 26), or one calendar event
  const FOUND_MAX = 400;     // holidays read from one list or calendar file
  const NAMELESS = "Holiday";

  // ==========================================================================
  // THE RECORD
  // ==========================================================================
  // { "YYYY-MM-DD": { name, plan, u } } in date order: a name of at most NAME_MAX, a plan of at most PLAN_MAX; a removed
  // one "" and "" with its time (kept only with one). Older files have none.
  function cleanHolidays(raw) {
    const out = {};
    if (isObj(raw)) Object.keys(raw).sort().forEach(k => {
      const h = raw[k], name = isObj(h) && typeof h.name === "string" ? cleanText(h.name, NAME_MAX) : "";
      const plan = name && typeof h.plan === "string" ? cleanText(h.plan, PLAN_MAX) : "";
      if (isDate(k) && isObj(h) && (name || isPos(h.u))) out[k] = { name, plan, u: isPos(h.u) ? h.u : 0 };
    });
    return out;
  }
  const holiday = date => { const h = S.data.holidays[date]; return h && h.name ? h : null; };
  const holidayOn = date => { const h = holiday(date); return h ? h.name : ""; };
  const holidayPlan = date => { const h = holiday(date); return h ? h.plan : ""; };
  // The holidays from one day to another (both included), by date: [{ date, name, plan }].
  const holidaysIn = (from, to) => Object.keys(S.data.holidays).filter(d => d >= from && d <= to && holiday(d)).map(d => ({ date: d, ...holiday(d) }));

  // Each through save() (undo, sync, backups; it stamps what changed), then drawn again.
  function keep(change) {
    change();
    A.save();
    A.renderAll();
  }
  // A date already there takes the new name and keeps its plan.
  function addHolidays(list) {
    keep(() => list.forEach(({ date, name }) => {
      const had = S.data.holidays[date];
      S.data.holidays[date] = { name, plan: holidayPlan(date), u: had ? had.u : 0 };
    }));
  }
  // One or several (a run of days, ✕ once): one save, so one Undo brings them back.
  function removeHolidays(dates) {
    const live = dates.filter(holiday);
    if (live.length) keep(() => live.forEach(date => { S.data.holidays[date] = { name: "", plan: "", u: S.data.holidays[date].u }; }));
  }
  const removeHoliday = date => removeHolidays([date]);
  // Days in a row with the same name, as runs: [{ from, to, name, dates }] (a single day: from = to), from a list by date.
  function runsOf(list) {
    const out = [];
    list.forEach(h => {
      const r = out[out.length - 1];
      if (r && r.name === h.name && addDays(r.to, 1) === h.date) { r.to = h.date; r.dates.push(h.date); }
      else out.push({ from: h.date, to: h.date, name: h.name, dates: [h.date] });
    });
    return out;
  }
  function setHolidayPlan(date, plan) {
    const h = holiday(date);
    if (h && h.plan !== plan) keep(() => { S.data.holidays[date] = { ...h, plan }; });
  }

  // ==========================================================================
  // READING A LIST OR A CALENDAR FILE
  // ==========================================================================
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  // A month's number from its name or a short form of it ("Nov", "Sept"), else 0: "Marathon" isn't March.
  const monthOf = w => { const x = w.toLowerCase(); return x.length < 3 ? 0 : MONTHS.findIndex(n => n.startsWith(x)) + 1; };
  const two = n => String(n).padStart(2, "0");
  // A day's date with a year, or without one the next from today (today counts; Feb 29 in the next leap year); "" if
  // it can't be.
  function dayOf(y, m, d, today) {
    if (y) { const date = `${y < 100 ? 2000 + y : y}-${two(m)}-${two(d)}`; return isDate(date) ? date : ""; }
    for (let yy = +today.slice(0, 4); yy <= +today.slice(0, 4) + 4; yy++) {
      const date = `${yy}-${two(m)}-${two(d)}`;
      if (isDate(date) && date >= today) return date;
    }
    return "";
  }
  // A date at the start of text: { y, m, d, rest } (y 0 when not given), or null. 2026-11-26 (a time after it left
  // out) · 11/26/2026 · 11/26 (month first) · Nov 26, 2026 · November 26th · 26 Nov 2026 · 4th May, after a weekday if
  // any (Thu, Nov 26).
  function dateAt(text) {
    const s = text.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "");
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T[\d:.]+Z?)?/.exec(s);
    if (m) return { y: +m[1], m: +m[2], d: +m[3], rest: s.slice(m[0].length) };
    m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?/.exec(s);
    if (m) return { y: m[3] ? +m[3] : 0, m: +m[1], d: +m[2], rest: s.slice(m[0].length) };
    m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4})\b)?/i.exec(s);
    if (m && monthOf(m[1])) return { y: m[3] ? +m[3] : 0, m: monthOf(m[1]), d: +m[2], rest: s.slice(m[0].length) };
    m = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b\.?(?:,?\s+(\d{4})\b)?/i.exec(s);
    if (m && monthOf(m[2])) return { y: m[3] ? +m[3] : 0, m: monthOf(m[2]), d: +m[1], rest: s.slice(m[0].length) };
    return null;
  }
  // The days from one to another (both included), at most RUN_MAX; none when the end comes first.
  const run = (from, to) => (to < from || daysBetween(from, to) >= RUN_MAX ? [] : Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i)));
  // A line's name: what's left of it, its separators (a CSV's commas, quotes) between words gone.
  const nameOf = s => cleanText(s.split(/[,;|\t"]+/).map(x => x.replace(/^[\s\-–—:']+|[\s']+$/g, "")).filter(Boolean).join(" · "), NAME_MAX) || NAMELESS;

  // One line of a list: [{ date, name }] (a run of days gives each), or null when it has no date that can be.
  function readLine(line, today) {
    let at = dateAt(line.trim());
    if (!at) { // a CSV's date may come after its name: the first date anywhere
      const m = [...line.matchAll(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[a-z]{3,9}\.? \d{1,2}(?:, \d{4})?)/gi)].find(x => dateAt(x[1]));
      if (!m) return null;
      at = dateAt(m[1]);
      at.rest = line.slice(0, m.index) + "," + line.slice(m.index + m[1].length);
    }
    const first = dayOf(at.y, at.m, at.d, today);
    if (!first) return null;
    let last = first, rest = at.rest;
    // A run: "2026-12-24 to 2026-12-26", "Dec 24 – Dec 26", "Dec 24–26", "Nov 26 to 28th"; taken only when its end is a
    // later day (else the dash is the name's: "Dec 24 - 2 hours early"). Or "2026-12-24 for 3 days".
    const to = /^\s*(?:-|–|—|(?:to|through|thru|till|until)\b)\s*/i.exec(rest), days = /^\s*for\s+(\d{1,2})\s+days?\b/i.exec(rest);
    if (days) {
      if (+days[1] < 1 || +days[1] > RUN_MAX) return null; // a run is 1 to 14 days: the line is said not understood
      last = addDays(first, +days[1] - 1);
      rest = rest.slice(days[0].length);
    } else if (to) {
      const after = rest.slice(to[0].length), end = dateAt(after), day = /^(\d{1,2})(?:st|nd|rd|th)?\b/.exec(after);
      let upTo = "", left = "";
      if (end) {
        upTo = dayOf(end.y || +first.slice(0, 4), end.m, end.d, today);
        if (upTo && upTo < first && !end.y) upTo = dayOf(+first.slice(0, 4) + 1, end.m, end.d, today); // Dec 31 – Jan 2
        left = end.rest;
      } else if (day) {
        upTo = dayOf(+first.slice(0, 4), +first.slice(5, 7), +day[1], today);
        left = after.slice(day[0].length);
      }
      if (upTo && upTo > first && run(first, upTo).length) { last = upTo; rest = left; }
    }
    return run(first, last).map(date => ({ date, name: nameOf(rest) }));
  }

  // A calendar file's all-day events (timed ones are meetings, not holidays: counted, left out; cancelled ones too):
  // its lines unfolded, each VEVENT's DTSTART, DTEND (the end not included, as the file means it) and SUMMARY.
  function readCalendar(text) {
    const found = [], lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    let ev = null, bad = 0, timed = 0;
    const day = v => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || ""); return m && isDate(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
    lines.forEach(line => {
      const m = /^([A-Z-]+)((?:;(?:"[^"]*"|[^:;"])*)*):(.*)$/i.exec(line);
      if (!m) return;
      const key = m[1].toUpperCase(), params = m[2].toUpperCase(), value = m[3].trim();
      if (key === "BEGIN" && value.toUpperCase() === "VEVENT") ev = {};
      else if (key === "END" && value.toUpperCase() === "VEVENT" && ev) {
        const from = day(ev.start), end = day(ev.end);
        if (ev.cancelled) bad++;
        else if (from && !ev.allDay) timed++;
        else {
          const days = !from ? [] : end && end > from ? run(from, addDays(end, -1)) : [from];
          if (days.length) days.forEach(date => found.push({ date, name: cleanText(ev.summary || "", NAME_MAX) || NAMELESS }));
          else bad++;
        }
        ev = null;
      } else if (ev && key === "DTSTART") { ev.start = value; ev.allDay = /VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(value); }
      else if (ev && key === "DTEND") ev.end = value;
      else if (ev && key === "STATUS") ev.cancelled = value.toUpperCase() === "CANCELLED";
      else if (ev && key === "SUMMARY") ev.summary = value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
    });
    return { found, bad, timed };
  }

  // A pasted list or a file's text: { found: [{ date, name }] by date, a date once (the last line's name), at most
  // FOUND_MAX; lines: the lines not understood (their numbers; a calendar's: none); bad: how many lines or events weren't
  // (dates more than a year ago or three years ahead, and those past FOUND_MAX, included); timed: a calendar's timed
  // events, left out; past: how many found are before today (kept, not listed); events: whether it was a calendar }.
  function readHolidays(text) {
    const today = todayStr(), lo = addDays(today, -366), hi = addDays(today, 3 * 366), calendar = /BEGIN:VCALENDAR/i.test(text);
    const found = [], lines = [];
    let bad = 0, timed = 0;
    if (calendar) {
      const cal = readCalendar(text);
      found.push(...cal.found);
      bad = cal.bad;
      timed = cal.timed;
    } else text.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim() || line.trim().startsWith("#")) return;
      const days = readLine(line, today);
      if (days && days.length && days.every(h => h.date >= lo && h.date <= hi)) found.push(...days);
      else { lines.push(i + 1); bad++; }
    });
    const byDate = new Map();
    found.forEach(h => { if (h.date >= lo && h.date <= hi) byDate.set(h.date, h); else bad++; });
    const all = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)), kept = all.slice(0, FOUND_MAX);
    return { found: kept, lines, bad: bad + all.length - kept.length, timed, past: kept.filter(h => h.date < today).length, events: calendar };
  }

  Object.assign(A, { cleanHolidays, holidayOn, holidayPlan, holidaysIn, addHolidays, removeHoliday, setHolidayPlan, readHolidays,
    removeHolidays, runsOf, HOLIDAY_NAME_MAX: NAME_MAX });
})(Kyoshi, Kyoshi.apps.momo);
