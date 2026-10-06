/* Momo · weekends.js — Upcoming weekends, so they get spent on purpose: a folded line under the board and under Today
 * ("Upcoming weekends · 4 of 13 planned · next without a plan: Oct 18 · 1½ days off ahead"), closed at first, opening
 * into the next WEEKENDS weekends from this one (on a Saturday or Sunday, the one it's in; else the coming one): each its
 * days and its plan, cut short, in green, or "No plan" in red. The board's Saturday heading (this week's and next week's)
 * shows the plan too. Tapping a weekend, or that plan, opens its pop-up (#weekendOverlay) to type a brief one and take
 * days off around it, by halves (Before: Friday, then Thursday…, half a day being the afternoon; After: Monday, then
 * Tuesday…, half a day the morning): Save, Clear, Cancel. Its days then run over them, after a small gold sun, and each
 * day off carries the sun on the board's heading and on Today (faded for half a day: offOn, offHTML). A plan and days off
 * are just notes, kept by the Saturday (data.weekends, model.js): they take none of the week's hours. Days off come off
 * PTO, once it's set (timeoff.js): the fold's line ends with what's left, and the pop-up says it under Days off. */
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
  // The first and last day a weekend runs over, its days off included.
  const firstOff = sat => addDays(sat, -Math.ceil(offOf(sat).before));
  const lastOff = sat => addDays(sat, 1 + Math.ceil(offOf(sat).after));

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
  function offHTML(date) {
    const part = offOn(date);
    return part ? `<span class="off-sun${part === "whole" ? "" : " half"}" data-off="${part}" role="img" aria-label="${OFF_TIP[part]}" title="${OFF_TIP[part]}">${SUN}</span>` : "";
  }

  // How many days off are left from today on, over these weekends and the one before them (its days after it may be
  // today): half days count half, and a day two weekends reach counts once.
  function offAhead(sats) {
    const today = todayStr(), dates = new Set([addDays(sats[0], -7), ...sats].flatMap(sat => offDays(sat)).map(x => x.date));
    return sum([...dates].filter(d => d >= today).map(d => (offOn(d) === "whole" ? 1 : 0.5)));
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
  // Its tooltip's days: "Sat Oct 17 – Sun Oct 18", or with days off "Fri afternoon Oct 16 – Mon Oct 19 · 1½ days off".
  function spanText(sat) {
    const { before, after } = offOf(sat), end = (date, half, part) => `${DAY_NAMES[dayIndex(date)]}${half ? ` ${part}` : ""} ${fmtShort(date)}`;
    return `${end(firstOff(sat), before % 1, "afternoon")} – ${end(lastOff(sat), after % 1, "morning")}${before + after ? ` · ${fmtDays(before + after)} off` : ""}`;
  }
  const cut = s => ([...s].length > SHORT ? `${[...s].slice(0, SHORT - 1).join("").trimEnd()}…` : s);

  // A weekend's tile: its days (after the sun when it has days off), then its plan (cut short) or "No plan".
  function tileHTML(sat) {
    const plan = planOf(sat), sun = hasOff(sat) ? `<span class="off-sun" role="img" aria-label="Days off:">${SUN}</span>` : "";
    return `<button type="button" class="weekend" data-weekend="${sat}" title="${esc(`${spanText(sat)}: ${plan || "no plan yet"}`)}">` +
      `<span class="we-days">${sun}${esc(daysOf(sat))}</span><span class="we-plan${plan ? "" : " none"}">${esc(plan ? cut(plan) : "No plan")}</span></button>`;
  }

  // Both folds (render.js renderAll): how many of the weekends have a plan, the first without one and the days off ahead,
  // then the tiles. Each stays open or closed as it is.
  let drawn = "";
  function renderWeekends() {
    const sats = upcomingWeekends(), next = sats.find(sat => !planOf(sat)), ahead = offAhead(sats);
    const summary = `<span class="we-head">Upcoming weekends</span> · ${sats.filter(planOf).length} of ${sats.length} planned` +
      (next ? ` · next without a plan: ${esc(fmtShort(next))}` : "") + (ahead ? ` · ${fmtDays(ahead)} off ahead` : "") + A.timeOffWords();
    const tiles = sats.map(tileHTML).join(""), boxes = A.root.querySelectorAll("details.weekends");
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
    const { before, after } = typedOff();
    $("weekendBeforeNote").textContent = words(before, false);
    $("weekendAfterNote").textContent = words(after, true);
    A.renderPtoLine(S.weekend, { before, after }); // PTO now and with these (timeoff.js)
  }

  function openWeekend(sat) {
    const { before, after } = offOf(sat);
    S.weekend = sat;
    $("weekendTitle").textContent = longDays(sat);
    $("weekendPlan").value = planOf(sat);
    $("weekendBefore").value = before;
    $("weekendAfter").value = after;
    renderOffNotes();
    $("weekendClearBtn").hidden = !planOf(sat) && !hasOff(sat);
    K.modal.open(overlay());
    $("weekendPlan").focus();
  }
  function closeWeekend() {
    S.weekend = null;
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
    const sat = S.weekend, plan = typed(), off = typedOff();
    if (!sat) return;
    if (!isNum(off.before) || !isNum(off.after)) {
      $(isNum(off.before) ? "weekendAfter" : "weekendBefore").focus();
      return alert("Enter the days off as a number of days, by halves (1.5), or 0 for none.");
    }
    closeWeekend();
    setWeekend(sat, plan, off);
  }
  function clearWeekend() {
    const sat = S.weekend;
    closeWeekend();
    if (sat) setWeekend(sat, "", NO_OFF);
  }

  // − / + beside Before or After (events.js onStepper): half a day, within 0 and OFF_MAX.
  function stepOff(input, dir) {
    const v = readOff(input.id);
    input.value = Math.min(OFF_MAX, Math.max(0, (isNum(v) ? v : 0) + dir / 2));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Esc, × and a click beside it ask first if the plan or the days off were changed (core/modal.js); Cancel doesn't. A
  // weekend's tile, or its plan on the board, opens it (Alt+click, which deletes cards on the board, doesn't).
  function initWeekends() {
    K.modal.define(overlay(), {
      dismiss: closeWeekend,
      pending: () => !!S.weekend && (typed() !== planOf(S.weekend) || !sameOff(typedOff(), offOf(S.weekend))),
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
      const el = e.target.closest("[data-weekend]");
      if (el && !e.altKey && !S.suppressClick) openWeekend(el.dataset.weekend);
    });
  }

  Object.assign(A, { upcomingWeekends, planOf, offOf, hasOff, fmtDays, offDays, partOff, offOn, offHTML, renderWeekends, headPlanHTML, saveWeekend, stepOff, initWeekends });
})(Kyoshi, Kyoshi.apps.momo);
