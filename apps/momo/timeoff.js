/* Momo · timeoff.js — PTO and sick time, lightly: the hours you had on a day, as saved in Developer Mode's "Time off" block
 * (data.timeOff, model.js), and what's left, worked out every time and never lowered in storage: PTO less every day off
 * entered on a weekend from that day on, those ahead too (a whole day DAY_OFF_HOURS, half a day half that; a day two
 * weekends reach counts once), so a weekend's days off changed or cleared give their hours back by themselves; sick time
 * as saved (it changes only there). Shown in 8-hour days by halves, a remainder in hours ("5½ days", "1 day 2h"; below 0
 * with "−", in red), once it's set: at the end of Upcoming weekends' line ("· PTO 5½ days · Sick 2 days") and live in a
 * weekend's pop-up under its days off ("PTO: 5½ days now, 4 days after this weekend"). The block itself: its fields hold
 * the hours as of today (before the days off from today on, which come off them), −½ day / −1 day beside each, Save as of
 * today, Clear (asked first). Days off still take no hours. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isNum, sum, esc, fmtNum, todayStr, readNumber } = K.util;
  const { DAY_OFF_HOURS, TIME_OFF_MIN, TIME_OFF_MAX, snap } = A;

  const isSet = () => !!S.data.timeOff && !!S.data.timeOff.asOf;

  // The hours of the days off on or after from (and before to, when given), over every weekend kept: a whole day
  // DAY_OFF_HOURS, half a day half that; typed ({ sat, off }) stands in for that weekend's days off (its pop-up's).
  function offHours(from, to = "", typed = null) {
    const offFor = sat => (typed && sat === typed.sat ? typed.off : A.offOf(sat));
    const sats = Object.keys(S.data.weekends).concat(typed ? [typed.sat] : []);
    const dates = new Set(sats.flatMap(sat => A.offDays(sat, offFor(sat))).map(x => x.date).filter(d => d >= from && (!to || d < to)));
    return sum([...dates].map(d => (A.partOff(d, offFor) === "whole" ? DAY_OFF_HOURS : DAY_OFF_HOURS / 2)));
  }
  // PTO left: as saved, less every day off from that day on; typed: a weekend's days off as its pop-up has them.
  const ptoLeft = (typed = null) => S.data.timeOff.pto - offHours(S.data.timeOff.asOf, "", typed);
  // PTO today, before the days off from today on: what the block's field holds, so saving it as it is changes nothing.
  const ptoToday = () => S.data.timeOff.pto - offHours(S.data.timeOff.asOf, todayStr());
  const sickLeft = () => S.data.timeOff.sick;

  // Hours in 8-hour days by halves, a remainder in hours: "5½ days", "1 day", "½ day", "1 day 2h", "2h", "2.25h", "0";
  // below 0 with "−". As HTML, that in red.
  function fmtTimeOff(h) {
    const half = DAY_OFF_HOURS / 2, a = Math.abs(h), halves = Math.floor(a / half), rest = a - halves * half;
    const words = [halves ? A.fmtDays(halves / 2) : "", rest ? `${fmtNum(rest)}h` : ""].filter(Boolean).join(" ");
    return words ? `${h < 0 ? "−" : ""}${words}` : "0";
  }
  const timeOffHTML = h => (h < 0 ? `<span class="neg">${esc(fmtTimeOff(h))}</span>` : esc(fmtTimeOff(h)));

  // The end of Upcoming weekends' line (weekends.js renderWeekends): " · PTO 5½ days · Sick 2 days", once it's set.
  const timeOffWords = () => (isSet() ? ` · PTO ${timeOffHTML(ptoLeft())} · Sick ${timeOffHTML(sickLeft())}` : "");

  // A weekend's pop-up, under its days off (weekends.js renderOffNotes): PTO now and with them as typed, once it's set;
  // just now while one of them isn't a number.
  function renderPtoLine(sat, off) {
    const line = $("weekendPto");
    line.hidden = !sat || !isSet();
    if (line.hidden) return;
    const now = `PTO: ${timeOffHTML(ptoLeft())} now`;
    line.innerHTML = isNum(off.before) && isNum(off.after) ? `${now}, ${timeOffHTML(ptoLeft({ sat, off }))} after this weekend` : now;
  }

  // ==========================================================================
  // DEVELOPER MODE'S BLOCK (events.js renderDev)
  // ==========================================================================
  // Its fields step by half a day from what they hold (no min: the arrow keys would count from it); Save keeps the hours
  // within TIME_OFF_MIN and TIME_OFF_MAX.
  const hours = v => Math.min(TIME_OFF_MAX, Math.max(TIME_OFF_MIN, snap(v)));
  function devHTML() {
    const set = isSet(), field = (id, label, h) => `<div class="momo-off-field"><label for="${id}">${label}</label>` +
      `<input type="number" id="${id}" step="${DAY_OFF_HOURS / 2}" value="${set ? fmtNum(h) : ""}">` +
      `<button type="button" class="secondary small" data-less="${DAY_OFF_HOURS / 2}">−½ day</button>` +
      `<button type="button" class="secondary small" data-less="${DAY_OFF_HOURS}">−1 day</button></div>`;
    return `<div class="dev-block momo-timeoff">
      <div class="dev-block-head">Time off: <strong>${set ? `PTO ${esc(fmtTimeOff(ptoLeft()))} · Sick ${esc(fmtTimeOff(sickLeft()))}` : "not set up"}</strong></div>
      ${field("momoPto", "PTO hours", set ? ptoToday() : 0)}${field("momoSick", "Sick hours", set ? sickLeft() : 0)}
      <div class="dev-actions"><button type="button" class="secondary small" id="momoTimeOffSave">Save as of today</button>${set ? `<button type="button" class="danger" id="momoTimeOffClear">Clear</button>` : ""}</div>
      <div class="dev-hint">Type the hours you have today. Days off entered on a weekend come off PTO from the day you save this, those ahead too; sick time only changes here.</div>
    </div>`;
  }

  // Save as of today: the hours typed are the truth today, and the days off from today on come off PTO.
  function saveTimeOff(box) {
    const pto = readNumber(box.querySelector("#momoPto")), sick = readNumber(box.querySelector("#momoSick")), had = S.data.timeOff;
    if (!isNum(pto) || !isNum(sick)) return alert("Enter your PTO and sick time in hours (0 for none).");
    S.data.timeOff = { pto: hours(pto), sick: hours(sick), asOf: todayStr(), u: had ? had.u : 0 };
    A.save();
    A.renderAll();
    A.refreshDev(); // the fields as saved
  }
  // Clear: kept as 0s with no day and its time (save() stamps it), so the clearing wins over an older copy's.
  function clearTimeOff() {
    if (!isSet() || !confirm("Clear your PTO and sick time? Upcoming weekends stops showing them.")) return;
    S.data.timeOff = { pto: 0, sick: 0, asOf: "", u: S.data.timeOff.u };
    A.save();
    A.renderAll();
    A.refreshDev();
  }

  function wireTimeOff(box) {
    const block = box.querySelector(".momo-timeoff");
    block.querySelectorAll("[data-less]").forEach(btn => btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input"), v = readNumber(input);
      input.value = fmtNum(Math.max(TIME_OFF_MIN, (isNum(v) ? v : 0) - +btn.dataset.less));
    }));
    block.querySelector("#momoTimeOffSave").addEventListener("click", () => saveTimeOff(box));
    if (isSet()) block.querySelector("#momoTimeOffClear").addEventListener("click", clearTimeOff);
    block.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); saveTimeOff(box); }
    });
  }

  Object.assign(A, { timeOffSet: isSet, ptoLeft, ptoToday, sickLeft, fmtTimeOff, timeOffWords, renderPtoLine, timeOffDevHTML: devHTML, wireTimeOff });
})(Kyoshi, Kyoshi.apps.momo);
