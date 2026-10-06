/* Momo · sleep.js — the sleep routine (the Baseline tab's "Sleep routine…", #sleepOverlay): your bedtime and when you
 * wake up, the nights it's for (each by the evening it starts), and if you like a wind-down before bed and a morning
 * routine after waking, in minutes, each with its title. Save makes pinned cards in the baseline, a night's part on each
 * day it touches (split at midnight): the evening's from bedtime to midnight and the morning's from midnight to waking
 * (one card, when bedtime is after midnight), the wind-down at the top of the first and the morning routine at the bottom
 * of the last (sides.js setSides: ordinary cards inside them); a wind-down that starts before midnight when bedtime is
 * after it begins on a card of its own that evening. Nothing else is stored: the cards are marked (model.js sleep), so
 * saving again replaces them (with the cards inside them), Remove takes them out, and the pop-up reads itself back from
 * them. Cards of yours they run into are flagged as any (times.js timeTrouble), for you to arrange once. Weeks already
 * loaded keep what they have: Load or Reload baseline brings the new cards in. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, newId } = K.util;
  const { DAY_HOURS, DAYS, DAY_NAMES, cleanText, fmtH, fmtClock } = A;

  // A new routine: bedtime and waking in hours after midnight, the wind-down and morning routine in minutes.
  const START = { bed: 23, wake: 7, wind: 0, rise: 0, title: "Sleep", windTitle: "Wind down", riseTitle: "Morning routine", nights: DAYS };
  const FIELDS = ["sleepBed", "sleepWake", "sleepWind", "sleepWindTitle", "sleepRise", "sleepRiseTitle", "sleepName"];
  const overlay = () => $("sleepOverlay");
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const hoursOf = cards => sum(cards.map(c => c.hours));

  // ==========================================================================
  // A NIGHT ON THE CLOCK
  // ==========================================================================
  // Its hours of sleep: bedtime to waking, across midnight or not.
  const sleepHours = r => (r.wake - r.bed + DAY_HOURS) % DAY_HOURS;

  // The night that starts on the evening of `night` (0 = Monday; asleep after midnight, its sleep is on the next day), as
  // the pieces of its wind-down, sleep and morning routine on each day it touches, in order: [{ day, at (when it starts
  // that day), wind, sleep, rise (its hours of each) }].
  function pieces(r, night) {
    const length = sleepHours(r), from = night * DAY_HOURS + r.bed + (r.bed > r.wake ? 0 : DAY_HOURS), out = [];
    [["wind", from - r.wind / 60, r.wind / 60], ["sleep", from, length], ["rise", from + length, r.rise / 60]].forEach(([part, start, hours]) => {
      for (let t = start; t < start + hours;) {
        const n = Math.floor(t / DAY_HOURS), cut = Math.min(start + hours, (n + 1) * DAY_HOURS);
        let p = out.find(x => x.n === n);
        if (!p) out.push(p = { n, day: (n % 7 + 7) % 7, at: t - n * DAY_HOURS, wind: 0, sleep: 0, rise: 0 });
        p[part] += cut - t;
        t = cut;
      }
    });
    return out;
  }

  // What stops a routine as typed from being saved: [the field to fix (null: none), why]; null when nothing does. No
  // sleep, a night longer than a day, a morning routine past midnight (it would start a card of its own), and a wind-down
  // or morning routine titled as the sleep cards (they're told apart by title).
  function problem(r) {
    if (!isNum(r.bed)) return ["sleepBed", "Enter your bedtime, like 2230 or 22:30."];
    if (!isNum(r.wake)) return ["sleepWake", "Enter when you wake up, like 0700 or 7:00."];
    if (!isNum(r.wind) || !isNum(r.rise)) return [isNum(r.wind) ? "sleepRise" : "sleepWind", "Enter the minutes, e.g. 30 (in 15-minute steps), or 0 for none."];
    if (!r.nights.length) return [null, "Pick at least one night."];
    if (r.bed === r.wake) return ["sleepWake", "Bedtime and wake up can't be the same time."];
    const night = sleepHours(r) + (r.wind + r.rise) / 60;
    if (night > DAY_HOURS) return ["sleepBed", `A night can't take more than 24 hours: this one takes ${fmtH(night)} with the time before and after.`];
    if (pieces(r, 0).some(p => p.rise && !p.sleep)) return ["sleepRise", "The morning routine can't run past midnight: wake up earlier or shorten it."];
    if (r.wind && same(r.windTitle, r.title)) return ["sleepWindTitle", `Give the wind-down a name of its own, e.g. ${START.windTitle}.`];
    if (r.rise && same(r.riseTitle, r.title)) return ["sleepRiseTitle", `Give the morning routine a name of its own, e.g. ${START.riseTitle}.`];
    return null;
  }

  // ==========================================================================
  // THE CARDS
  // ==========================================================================
  // Takes every sleep card out of a list, with the cards inside them.
  function dropSleep(list) {
    const ids = new Set(list.cards.filter(c => c.sleep).map(c => c.id));
    list.cards = list.cards.filter(c => !c.sleep && !ids.has(c.parentId));
  }

  // A piece of a night as a card pinned where it starts (in time order: times.js autoSpot), the wind-down at its top and
  // the morning routine at its bottom (in one go when they share a title). A piece with no sleep in it is the start of a
  // wind-down, the evening before: a card of its own, titled as the wind-down.
  function addPiece(list, p, r) {
    const card = { id: newId(), title: p.sleep ? r.title : r.windTitle, hours: p.sleep || p.wind, day: p.day, goalId: null, base: false, parentId: null, pos: "bottom",
      pin: p.at, need: null, app: null, auto: false, slot: null, fixed: false, sleep: true };
    A.insertCard(list, card, A.autoSpot(list, card.day, card));
    if (!p.sleep) return;
    if (p.wind && p.rise && same(r.windTitle, r.riseTitle)) return A.setSides(list, card, r.windTitle, p.wind * 60, p.rise * 60);
    if (p.wind) A.setSides(list, card, r.windTitle, p.wind * 60, 0);
    if (p.rise) A.setSides(list, card, r.riseTitle, 0, p.rise * 60);
  }

  // The days whose cards run into a pinned card or past midnight, or hold more than 24 hours.
  const trouble = list => DAYS.filter(d => A.dayTotal(list, d) > DAY_HOURS || A.timeTrouble(list, [d]).length > 0);

  // The routine as a list's sleep cards have it: the first night's times, minutes and titles, with every night found;
  // null when there are none. A night is a card holding sleep: after the wind-down's own card the evening before, if it
  // has one (ending at midnight with nothing inside, before a card at midnight that starts with the wind-down or is
  // titled otherwise), and before the morning's card, if it crosses midnight (at midnight, after the card holding sleep
  // that ends there with nothing at its bottom). Its bedtime is where its sleep starts, its waking where it ends.
  function readRoutine(list) {
    const ps = [];
    DAYS.forEach(day => A.daySchedule(list, day).rows.forEach(({ card, start, end }) => {
      if (!card.sleep) return;
      const inner = A.innerCards(list, card);
      ps.push({ card, day, start, end, bare: !inner.length, top: inner.filter(c => c.pos === "top"), bottom: inner.filter(c => c.pos === "bottom") });
    }));
    const after = x => (x.end === DAY_HOURS ? ps.find(y => y.day === (x.day + 1) % 7 && y.start === 0) : null);
    const before = y => (y.start === 0 ? ps.find(x => x.day === (y.day + 6) % 7 && x.end === DAY_HOURS) : null);
    const lead = x => { const y = x.bare && after(x); return !!y && (y.top.length > 0 || !same(x.card.title, y.card.title)); };
    const rest = y => { const x = !y.top.length && before(y); return !!x && !x.bottom.length && !lead(x); };
    const nights = ps.filter(p => !lead(p) && !rest(p)).map(y => {
      const x = before(y), w = x && lead(x) ? x : null, m = !y.bottom.length && after(y), last = m && rest(m) ? m : y;
      const wind = (w ? w.card.hours : 0) + hoursOf(y.top), rise = hoursOf(last.bottom);
      const bed = (y.start + hoursOf(y.top)) % DAY_HOURS, wake = (last.end - rise) % DAY_HOURS;
      return { night: bed > wake ? y.day : (y.day + 6) % 7, bed, wake, wind: Math.round(wind * 60), rise: Math.round(rise * 60), title: y.card.title,
        windTitle: w ? w.card.title : y.top.length ? y.top[0].title : START.windTitle, riseTitle: last.bottom.length ? last.bottom[0].title : START.riseTitle };
    }).sort((a, b) => a.night - b.night);
    return nights.length ? { ...nights[0], nights: [...new Set(nights.map(n => n.night))] } : null;
  }

  // ==========================================================================
  // THE POP-UP
  // ==========================================================================
  // The routine as typed: times in hours (null when empty, NaN when not a time), minutes, titles (the usual when empty).
  function typed() {
    const title = (id, none) => cleanText($(id).value) || none;
    return { bed: A.readClock("sleepBed"), wake: A.readClock("sleepWake"), wind: A.readMinutes("sleepWind"), rise: A.readMinutes("sleepRise"),
      title: title("sleepName", START.title), windTitle: title("sleepWindTitle", START.windTitle), riseTitle: title("sleepRiseTitle", START.riseTitle),
      nights: [...S.sleep.nights].sort((a, b) => a - b) };
  }
  // What's on the form, to tell whether closing it would lose changes.
  const formState = () => JSON.stringify([FIELDS.map(id => $(id).value), [...S.sleep.nights].sort()]);

  function say(text, cls = "bad") {
    $("sleepStatus").textContent = text;
    $("sleepStatus").className = `modal-status${text && cls ? ` ${cls}` : ""}`;
  }

  // The fields as a routine has them; Remove while the baseline has sleep cards.
  function fill(r) {
    S.sleep = { nights: new Set(r.nights), snapshot: "" };
    $("sleepBed").value = fmtClock(r.bed);
    $("sleepWake").value = fmtClock(r.wake);
    $("sleepWind").value = r.wind;
    $("sleepWindTitle").value = r.windTitle;
    $("sleepRise").value = r.rise;
    $("sleepRiseTitle").value = r.riseTitle;
    $("sleepName").value = r.title;
    $("sleepRemoveBtn").hidden = !S.data.baseline.cards.some(c => c.sleep);
    $("sleepCancelBtn").textContent = "Cancel";
    renderNights();
    renderNote();
    S.sleep.snapshot = formState();
  }
  function renderNights() {
    $("sleepNights").innerHTML = DAYS.map(d => `<button type="button" class="day-pill${S.sleep.nights.has(d) ? " active" : ""}" data-night="${d}">${DAY_NAMES[d]}</button>`).join("");
  }
  // Under the times: how long a night's sleep is, and with the time before and after.
  function renderNote() {
    const r = typed(), extra = (isNum(r.wind) ? r.wind : 0) + (isNum(r.rise) ? r.rise : 0);
    $("sleepNote").textContent = !isNum(r.bed) || !isNum(r.wake) || r.bed === r.wake ? ""
      : `${fmtH(sleepHours(r))} of sleep a night${extra ? `, ${fmtH(sleepHours(r) + extra / 60)} with the time before and after` : ""}.`;
  }

  // Opens with the routine as the baseline's sleep cards have it, else as a new one starts.
  function openSleep() {
    fill(readRoutine(S.data.baseline) || START);
    say("");
    K.modal.open(overlay());
    $("sleepBed").focus();
  }
  function closeSleep() {
    S.sleep = null;
    K.modal.close(overlay());
  }

  // Replaces the baseline's sleep cards (asking first) with the routine's: a card per piece of each night picked. If
  // cards of yours now run into them (red, as any), it stays open to say so; else it closes.
  function saveSleep() {
    if (!S.sleep) return;
    const r = typed(), why = problem(r), base = S.data.baseline;
    if (why) {
      say(why[1]);
      if (why[0]) $(why[0]).focus();
      return;
    }
    if (base.cards.some(c => c.sleep) && !confirm("Replace the baseline's sleep cards?")) return;
    dropSleep(base);
    const was = trouble(base);
    // Earlier in the day first, so each piece goes in among its day's cards as they'll be (times.js autoSpot).
    r.nights.flatMap(n => pieces(r, n)).sort((a, b) => a.at - b.at).forEach(p => addPiece(base, p, r));
    A.tidyNesting(base);
    A.save();
    A.renderAll();
    if (trouble(base).every(d => was.includes(d))) return closeSleep();
    fill(readRoutine(base) || START); // as saved
    $("sleepCancelBtn").textContent = "Close";
    const own = base.cards.some(c => !c.sleep && !c.parentId && same(c.title, r.title));
    say(`Saved. Cards running into them show in red: arrange them once.${own ? ` The “${r.title}” cards you made yourself are still there: delete them if these take their place.` : ""}`, "");
  }

  // Takes the sleep cards out of the baseline (asking first), with the cards inside them.
  function removeSleep() {
    const base = S.data.baseline, n = base.cards.filter(c => c.sleep).length;
    if (!n || !confirm(`Remove the baseline's ${n} sleep card${n === 1 ? "" : "s"}? Weeks already loaded keep theirs.`)) return;
    dropSleep(base);
    closeSleep();
    A.save();
    A.renderAll();
  }

  // Esc, × and a click beside it ask first if something was changed (core/modal.js); Cancel doesn't. Enter saves (events.js).
  function initSleep() {
    K.modal.define(overlay(), {
      dismiss: closeSleep,
      pending: () => !!S.sleep && formState() !== S.sleep.snapshot,
      ask: "Discard your changes to the sleep routine?"
    });
    $("sleepBtn").addEventListener("click", openSleep);
    $("sleepSaveBtn").addEventListener("click", saveSleep);
    $("sleepRemoveBtn").addEventListener("click", removeSleep);
    $("sleepCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
    $("sleepNights").addEventListener("click", e => {
      const pill = e.target.closest(".day-pill");
      if (!pill || !S.sleep) return;
      const d = +pill.dataset.night;
      if (!S.sleep.nights.delete(d)) S.sleep.nights.add(d);
      renderNights();
    });
    // A time or minutes left show what they'll be saved as (the − / + step minutes: events.js onStepper); the note follows.
    ["sleepBed", "sleepWake"].forEach(id => $(id).addEventListener("change", () => { const t = A.readClock(id); if (isNum(t)) $(id).value = fmtClock(t); }));
    ["sleepWind", "sleepRise"].forEach(id => $(id).addEventListener("change", () => { const v = A.readMinutes(id); if (isNum(v)) $(id).value = v; }));
    overlay().addEventListener("input", () => { if (S.sleep) renderNote(); });
  }

  Object.assign(A, { readRoutine, openSleep, saveSleep, initSleep });
})(Kyoshi, Kyoshi.apps.momo);
