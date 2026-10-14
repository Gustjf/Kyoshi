/* Momo · weekends.js — Upcoming weekends, so they get spent on purpose: a line, open at first, under the board and under Today
 * ("Upcoming weekends · 4 of 13 planned · next without a plan: Oct 18 · 1½ days off ahead"), opening
 * into the next WEEKENDS weekends from this one (on a Saturday or Sunday, the one it's in; else the coming one): each its
 * days and its plan, cut short, in green, or "No plan" in red. The board's Saturday heading (this week's and next week's)
 * shows the plan too. Tapping a weekend, or that plan, opens its pop-up (#weekendOverlay) to type a brief one and take
 * days off around it, by halves (Before: Friday, then Thursday…, half a day being the afternoon; After: Monday, then
 * Tuesday…, half a day the morning): Save, Clear, Cancel. Its days then run over them, after a small gold sun, and each
 * day off carries the sun on the board's heading and on Today (faded for half a day: offOn, offHTML). A plan and days off
 * are just notes, kept by the Saturday (data.weekends, model.js): they take none of the week's hours. Days off come off
 * PTO, once it's set (timeoff.js): the fold's line ends with what's left, and the pop-up says it under Days off.
 * Holidays (holidays.js) touching a weekend or its days off join it: its days run over them, a violet sun marks them
 * (on its tile, the board and Today), and they cost no PTO; one no weekend reaches is a row of its own among the tiles,
 * by its date, whose pop-up (the same one, without days off) keeps its plan. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, esc, addDays, todayStr, fmtShort } = K.util;
  const { WEEKENDS, PLAN_MAX, OFF_MAX, DAY_NAMES, cleanText, dayIndex } = A;

  const SHORT = 40; // a plan's length on its weekend's tile, cut beyond it
  const NO_OFF = Object.freeze({ before: 0, after: 0 });

  // This weekend's Saturday (today's or yesterday's on a weekend, else the coming one), then the next ones.
  function upcomingWeekends() {
    const today = todayStr(), d = dayIndex(today), sat = addDays(today, d === 6 ? -1 : 5 - d);
    return Array.from({ length: WEEKENDS }, (_, i) => addDays(sat, 7 * i));
  }
  const planOf = sat => (S.data.weekends[sat] ? S.data.weekends[sat].plan : "");
  const offOf = sat => (S.data.weekends[sat] ? S.data.weekends[sat].off : NO_OFF);
  const hasOff = sat => { const o = offOf(sat); return o.before + o.after > 0; };

  // ==========================================================================
  // DAYS OFF
  // ==========================================================================
  // "½ day", "1 day", "1½ days", "2 days".
  const fmtDays = n => `${Math.floor(n) || ""}${n % 1 ? "½" : ""} day${n > 1 ? "s" : ""}`;

  // A weekend's days off, each { date, part }: "whole", "pm" (the first before it, with a half: its afternoon) or "am"
  // (the last after it, with a half: its morning); before it from Friday back, after it from Monday on. off: its days off
  // as kept, or as its pop-up has them (timeoff.js).
  function offDays(sat, off = offOf(sat)) {
    const { before, after } = off, out = [];
    const add = (n, dateOf, part) => { for (let k = 1; k <= Math.ceil(n); k++) out.push({ date: dateOf(k), part: k === Math.ceil(n) && n % 1 ? part : "whole" }); };
    add(before, k => addDays(sat, -k), "pm");
    add(after, k => addDays(sat, 1 + k), "am");
    return out;
  }
  // The first and last day a weekend runs over: its days off, and the holidays touching it or them, day by day from
  // Friday back and from Monday on (a half day off is the far end; a day that's neither ends it). off: its days off as
  // kept, or as its pop-up has them.
  function spanOf(sat, off = offOf(sat)) {
    const walk = (n, from, step) => {
      let end = from;
      for (let k = 1; k <= 5; k++) {
        const d = addDays(from, step * k);
        if (A.holidayOn(d)) { end = d; continue; }
        if (k > Math.ceil(n)) break;
        end = d;
        if (k === Math.ceil(n) && n % 1) break;
      }
      return end;
    };
    return { first: walk(off.before, sat, -1), last: walk(off.after, addDays(sat, 1), 1) };
  }
  const firstOff = sat => spanOf(sat).first;
  const lastOff = sat => spanOf(sat).last;
  const holidaysOf = sat => A.holidaysIn(firstOff(sat), lastOff(sat));

  // Whether a day is off: "" (no, and never on a Saturday or Sunday: they're the weekend), "whole", "pm" or "am". It looks
  // at the weekend after it (its days before) and the one before it (its days after); a day both reach is off for both.
  // offFor: each weekend's days off by its Saturday (offOf, or with a pop-up's as typed: timeoff.js).
  function partOff(date, offFor) {
    const d = dayIndex(date);
    if (d > 4) return "";
    const sat = addDays(date, 5 - d), parts = new Set([sat, addDays(sat, -7)].flatMap(s => offDays(s, offFor(s))).filter(x => x.date === date).map(x => x.part));
    return parts.has("whole") || parts.size > 1 ? "whole" : [...parts][0] || "";
  }
  const offOn = date => partOff(date, offOf);

  // A day off's mark on the board's heading and Today's (render.js, today.js): a small gold sun, faded for half a day,
  // its tooltip saying which; nothing on a day that isn't off.
  const SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-sun"/></svg>`;
  const OFF_TIP = { whole: "Day off", pm: "Afternoon off", am: "Morning off" };
  const HOLIDAY_SUN = `<span class="off-sun holiday" role="img" aria-label="Holiday:">${SUN}</span>`;
  // A holiday's is violet ("Holiday: Thanksgiving"), a day off on it too.
  function offHTML(date) {
    const name = A.holidayOn(date), tip = name && esc(`Holiday: ${name}`);
    if (name) return `<span class="off-sun holiday" data-off="holiday" role="img" aria-label="${tip}" title="${tip}">${SUN}</span>`;
    const part = offOn(date);
    return part ? `<span class="off-sun${part === "whole" ? "" : " half"}" data-off="${part}" role="img" aria-label="${OFF_TIP[part]}" title="${OFF_TIP[part]}">${SUN}</span>` : "";
  }

  // How many days off are left from today on, over these weekends and the one before them (its days after it may be
  // today): half days count half, a day two weekends reach counts once, and a holiday isn't one.
  function offAhead(sats) {
    const today = todayStr(), dates = new Set([addDays(sats[0], -7), ...sats].flatMap(sat => offDays(sat)).map(x => x.date));
    return sum([...dates].filter(d => d >= today && !A.holidayOn(d)).map(d => (offOn(d) === "whole" ? 1 : 0.5)));
  }

  // ==========================================================================
  // THE FOLDS AND THE BOARD'S SATURDAY
  // ==========================================================================
  // "Oct 11–12" (across a month: "Oct 31–Nov 1"), over its days off too: "Oct 16–19".
  function daysOf(sat) {
    const from = firstOff(sat), to = lastOff(sat);
    return `${fmtShort(from)}–${from.slice(5, 7) === to.slice(5, 7) ? +to.slice(8) : fmtShort(to)}`;
  }
  const longDays = sat => `${DAY_NAMES[5]} ${fmtShort(sat)} – ${DAY_NAMES[6]} ${fmtShort(addDays(sat, 1))}`;
  // Its tooltip's days: "Sat Oct 17 – Sun Oct 18", or with days off "Fri afternoon Oct 16 – Mon Oct 19 · 1½ days off",
  // then its holidays: " · Mon Cyber Monday".
  const dayName = date => DAY_NAMES[dayIndex(date)];
  function spanText(sat) {
    const { before, after } = offOf(sat), { first, last } = spanOf(sat), hols = holidaysOf(sat);
    const end = (date, half, part) => `${dayName(date)}${half ? ` ${part}` : ""} ${fmtShort(date)}`;
    const half = (date, n, k) => !!(n % 1) && date === addDays(sat, k) && !A.holidayOn(date); // the far end's half day
    return `${end(first, half(first, before, -Math.ceil(before)), "afternoon")} – ${end(last, half(last, after, 1 + Math.ceil(after)), "morning")}` +
      `${before + after ? ` · ${fmtDays(before + after)} off` : ""}${hols.length ? ` · ${hols.map(h => `${dayName(h.date)} ${h.name}`).join(", ")}` : ""}`;
  }
  const cut = s => ([...s].length > SHORT ? `${[...s].slice(0, SHORT - 1).join("").trimEnd()}…` : s);

  // A weekend's tile: its days (after the sun when it has days off, a violet one with a holiday), then its plan (cut
  // short) or "No plan".
  function tileHTML(sat) {
    const plan = planOf(sat), sun = holidaysOf(sat).length ? HOLIDAY_SUN : hasOff(sat) ? `<span class="off-sun" role="img" aria-label="Days off:">${SUN}</span>` : "";
    return `<button type="button" class="weekend" data-weekend="${sat}" title="${esc(`${spanText(sat)}: ${plan || "no plan yet"}`)}">` +
      `<span class="we-days">${sun}${esc(daysOf(sat))}</span><span class="we-plan${plan ? "" : " none"}">${esc(plan ? cut(plan) : "No plan")}</span></button>`;
  }

  // The holidays from today to the last of these weekends that none of their spans reaches (one only the weekend before
  // them reaches, today a Monday, is a row too: it has no tile): a weekday each, [{ date, name, plan }].
  function loneHolidays(sats) {
    const spans = sats.map(sat => spanOf(sat));
    return A.holidaysIn(todayStr(), addDays(sats[sats.length - 1], 1))
      .filter(h => dayIndex(h.date) < 5 && !spans.some(sp => h.date >= sp.first && h.date <= sp.last));
  }
  // A lone holiday's row: the violet sun, its day and name, then its plan or "No plan" (muted: it isn't a weekend).
  function holidayTileHTML(h) {
    const day = `${dayName(h.date)} ${fmtShort(h.date)}`;
    return `<button type="button" class="weekend holiday" data-holiday="${h.date}" title="${esc(`${day} · ${h.name}: ${h.plan || "no plan yet"}`)}">` +
      `<span class="we-days">${HOLIDAY_SUN}${esc(`${day} · ${cut(h.name)}`)}</span><span class="we-plan${h.plan ? "" : " none"}">${esc(h.plan ? cut(h.plan) : "No plan")}</span></button>`;
  }

  // Both folds (render.js renderAll): how many of the weekends have a plan, the first without one, the days off and
  // holidays ahead, then the tiles, a lone holiday's among them by its date. Both start open; each stays open or closed
  // as you leave it until the page reloads.
  let drawn = "";
  function renderWeekends() {
    const sats = upcomingWeekends(), next = sats.find(sat => !planOf(sat)), ahead = offAhead(sats);
    const hols = A.holidaysIn(todayStr(), lastOff(sats[sats.length - 1])).length;
    const summary = `<span class="we-head">Upcoming weekends</span> · ${sats.filter(planOf).length} of ${sats.length} planned` +
      (next ? ` · next without a plan: ${esc(fmtShort(next))}` : "") + (ahead ? ` · ${fmtDays(ahead)} off ahead` : "") +
      (hols ? ` · ${hols} holiday${hols > 1 ? "s" : ""} ahead` : "") + A.timeOffWords();
    const rows = sats.map(sat => [sat, tileHTML(sat)]).concat(loneHolidays(sats).map(h => [h.date, holidayTileHTML(h)]));
    const tiles = rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(x => x[1]).join(""), boxes = A.root.querySelectorAll("details.weekends");
    if (!boxes.length || summary + tiles === drawn) return; // unchanged: a tile keeps its focus
    drawn = summary + tiles;
    boxes.forEach(box => {
      box.querySelector("summary").innerHTML = summary;
      box.querySelector(".weekend-list").innerHTML = tiles;
    });
  }

  // The board's heading for a day of a week (render.js renderBoard): on Saturday its weekend's plan (tapping it opens
  // the pop-up), on the other days an empty line as tall, so every day's cards still start level. None without a plan.
  function headPlanHTML(key, d) {
    const sat = key === "base" ? "" : addDays(key, 5), plan = sat ? planOf(sat) : "";
    if (!plan) return "";
    return d !== 5 ? `<div class="col-plan" aria-hidden="true"></div>`
      : `<button type="button" class="col-plan" data-weekend="${sat}" title="${esc(`${spanText(sat)}: ${plan}`)}">${esc(plan)}</button>`;
  }

  // ==========================================================================
  // A WEEKEND'S POP-UP
  // ==========================================================================
  const overlay = () => $("weekendOverlay");
  const typed = () => cleanText($("weekendPlan").value, PLAN_MAX);
  // Days off typed in Before or After: by halves, 0 to OFF_MAX (empty is 0); NaN when it isn't a number.
  function readOff(id) {
    const v = A.readNumber(id);
    if (v === null) return 0;
    return Number.isNaN(v) ? NaN : Math.min(OFF_MAX, Math.max(0, Math.round(v * 2) / 2));
  }
  const typedOff = () => ({ before: readOff("weekendBefore"), after: readOff("weekendAfter") });
  const sameOff = (a, b) => a.before === b.before && a.after === b.after;

  // Under Before and After, the days they take: "1½ days: Thu afternoon – Fri", "½ day: Mon morning"; with none, which
  // way they go.
  function renderOffNotes() {
    const words = (n, after) => {
      if (!isNum(n)) return "In days, e.g. 1.5";
      if (!n) return after ? "Monday, Tuesday…" : "Friday, Thursday…";
      const k = Math.ceil(n), half = n % 1 ? (after ? " morning" : " afternoon") : "";
      const days = k === 1 ? `${DAY_NAMES[after ? 0 : 4]}${half}` : after ? `${DAY_NAMES[0]} – ${DAY_NAMES[k - 1]}${half}` : `${DAY_NAMES[5 - k]}${half} – ${DAY_NAMES[4]}`;
      return `${fmtDays(n)}: ${days}`;
    };
    const { before, after } = typedOff(), sat = S.weekend;
    // The holidays these days off reach on each side: " · Holiday: Fri Nov 27 Day after".
    const span = isNum(before) && isNum(after) ? spanOf(sat, { before, after }) : null;
    const hols = (from, to) => {
      const list = span ? A.holidaysIn(from, to).map(h => `${dayName(h.date)} ${fmtShort(h.date)} ${h.name}`) : [];
      return list.length ? ` · Holiday: ${list.join(", ")}` : "";
    };
    $("weekendBeforeNote").textContent = words(before, false) + (span ? hols(span.first, addDays(sat, -1)) : "");
    $("weekendAfterNote").textContent = words(after, true) + (span ? hols(addDays(sat, 2), span.last) : "");
    A.renderPtoLine(S.weekend, { before, after }); // PTO now and with these (timeoff.js)
  }

  function openWeekend(sat) {
    const { before, after } = offOf(sat);
    S.weekend = sat;
    S.holiday = null;
    $("weekendOffField").hidden = false;
    $("weekendTitle").textContent = longDays(sat);
    $("weekendPlan").value = planOf(sat);
    $("weekendBefore").value = before;
    $("weekendAfter").value = after;
    renderOffNotes();
    $("weekendClearBtn").hidden = !planOf(sat) && !hasOff(sat);
    K.modal.open(overlay());
    $("weekendPlan").focus();
  }
  // A lone holiday's: its plan only ("Wed Nov 11 · Veterans Day").
  function openHoliday(date) {
    const name = A.holidayOn(date);
    if (!name) return;
    S.weekend = null;
    S.holiday = date;
    $("weekendOffField").hidden = true;
    $("weekendTitle").textContent = `${dayName(date)} ${fmtShort(date)} · ${name}`;
    $("weekendPlan").value = A.holidayPlan(date);
    $("weekendClearBtn").hidden = !A.holidayPlan(date);
    K.modal.open(overlay());
    $("weekendPlan").focus();
  }
  function closeWeekend() {
    S.weekend = null;
    S.holiday = null;
    K.modal.close(overlay());
  }

  // Keeps a weekend's plan and days off, or "" and none once cleared: with its time (save() stamps it), so clearing it
  // wins over an older copy's on another device too. An empty Save clears it.
  function setWeekend(sat, plan, off) {
    const had = S.data.weekends[sat];
    if (planOf(sat) === plan && sameOff(offOf(sat), off)) return;
    S.data.weekends[sat] = { plan, off: { before: off.before, after: off.after }, u: had ? had.u : 0 };
    A.save();
    A.renderAll();
  }
  function saveWeekend() {
    const sat = S.weekend, plan = typed(), off = typedOff(), date = S.holiday;
    if (date) {
      closeWeekend();
      return A.setHolidayPlan(date, plan);
    }
    if (!sat) return;
    if (!isNum(off.before) || !isNum(off.after)) {
      $(isNum(off.before) ? "weekendAfter" : "weekendBefore").focus();
      return alert("Enter the days off as a number of days, by halves (1.5), or 0 for none.");
    }
    closeWeekend();
    setWeekend(sat, plan, off);
  }
  function clearWeekend() {
    const sat = S.weekend, date = S.holiday;
    closeWeekend();
    if (sat) setWeekend(sat, "", NO_OFF);
    if (date) A.setHolidayPlan(date, ""); // its plan: the holiday stays
  }

  // − / + beside Before or After (events.js onStepper): half a day, within 0 and OFF_MAX.
  function stepOff(input, dir) {
    const v = readOff(input.id);
    input.value = Math.min(OFF_MAX, Math.max(0, (isNum(v) ? v : 0) + dir / 2));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Esc, × and a click beside it ask first if the plan or the days off were changed (core/modal.js); Cancel doesn't. A
  // weekend's tile, or its plan on the board, opens it, a lone holiday's row its form (Alt+click, which deletes cards on
  // the board, doesn't).
  function initWeekends() {
    K.modal.define(overlay(), {
      dismiss: closeWeekend,
      pending: () => (S.holiday ? typed() !== A.holidayPlan(S.holiday)
        : !!S.weekend && (typed() !== planOf(S.weekend) || !sameOff(typedOff(), offOf(S.weekend)))),
      ask: "Discard your changes to this weekend?"
    });
    $("weekendSaveBtn").addEventListener("click", saveWeekend);
    $("weekendClearBtn").addEventListener("click", clearWeekend);
    $("weekendCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
    ["weekendBefore", "weekendAfter"].forEach(id => {
      $(id).addEventListener("input", renderOffNotes);
      // Leaving the field shows what it will be saved as.
      $(id).addEventListener("change", e => {
        const v = readOff(id);
        if (isNum(v)) e.target.value = v;
        renderOffNotes();
      });
    });
    A.root.addEventListener("click", e => {
      const el = e.target.closest("[data-weekend], [data-holiday]");
      if (!el || e.altKey || S.suppressClick) return;
      if (el.dataset.holiday) openHoliday(el.dataset.holiday); else openWeekend(el.dataset.weekend);
    });
  }

  Object.assign(A, { upcomingWeekends, planOf, offOf, hasOff, fmtDays, offDays, spanOf, partOff, offOn, offHTML, loneHolidays, renderWeekends, headPlanHTML, saveWeekend, stepOff, initWeekends });
})(Kyoshi, Kyoshi.apps.momo);
