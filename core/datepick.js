/* Kyoshi · core/datepick.js — K.datePick: Kyoshi's own calendar for every date box (input type=date) in every app, its
 * weeks Monday to Sunday (Saturday and Sunday on the right), in place of the browser's, whose first day follows the
 * browser's language (Sunday in US English) and can't be set by a page. A click on a date box opens it under the box
 * (above it near the bottom of the window); typing in the box works as before (and closes it). « ‹ › » change the year
 * and the month; a day sets the box, as do Today and Clear (Clear only when the box may be empty), with the `input` and
 * `change` events the browser's would send, so apps just read the box as before; min and max are kept. Esc, a tap
 * elsewhere, leaving the box or a form sent closes it. K.datePick.open(box) opens it from code (Hawky's Pick a day).
 * No storage. Its look: core/kyoshi.css (Date picker). */
(function (K) {
  "use strict";
  const { addDays, dateMs, msDate, todayStr, esc } = K.util;
  const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  let cal = null;   // the calendar (made once, kept in <body>)
  let input = null; // the date box it's open for, or null
  let month = "";   // the first of the month shown, "YYYY-MM-01"
  let setting = false; // our own input and change events, which mustn't close it

  const isDateBox = el => el instanceof HTMLInputElement && el.type === "date" && !el.disabled && !el.readOnly;
  const firstOf = d => `${d.slice(0, 8)}01`;
  // The first of the month n months on.
  function monthsOn(m, n) {
    const d = new Date(dateMs(m));
    d.setUTCMonth(d.getUTCMonth() + n);
    return msDate(d.getTime());
  }
  const inRange = d => (!input.min || d >= input.min) && (!input.max || d <= input.max);

  // --- Drawing: the month's weeks, Monday first, from the week its 1st is in to the week its last day is in ---
  function render() {
    const today = todayStr(), value = input.value, lead = (new Date(dateMs(month)).getUTCDay() + 6) % 7; // Monday: 0
    const last = addDays(monthsOn(month, 1), -1), weeks = Math.ceil((lead + +last.slice(8)) / 7), start = addDays(month, -lead);
    const title = new Date(dateMs(month)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    let days = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), cls = ["dp-day"];
      if (d.slice(0, 7) !== month.slice(0, 7)) cls.push("out");
      if (i % 7 >= 5) cls.push("weekend");
      if (d === today) cls.push("today");
      if (d === value) cls.push("picked");
      days += `<button type="button" class="${cls.join(" ")}" data-day="${d}"${inRange(d) ? "" : " disabled"}${d === value ? ' aria-pressed="true"' : ""} aria-label="${esc(new Date(dateMs(d)).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }))}">${+d.slice(8)}</button>`;
    }
    cal.innerHTML =
      `<div class="dp-head">` +
      `<button type="button" class="dp-nav" data-months="-12" aria-label="A year back" title="A year back">&laquo;</button>` +
      `<button type="button" class="dp-nav" data-months="-1" aria-label="A month back" title="A month back">&lsaquo;</button>` +
      `<span class="dp-title">${esc(title)}</span>` +
      `<button type="button" class="dp-nav" data-months="1" aria-label="A month on" title="A month on">&rsaquo;</button>` +
      `<button type="button" class="dp-nav" data-months="12" aria-label="A year on" title="A year on">&raquo;</button></div>` +
      `<div class="dp-grid">${WEEKDAYS.map((w, i) => `<span class="dp-wd${i >= 5 ? " weekend" : ""}">${w}</span>`).join("")}${days}</div>` +
      `<div class="dp-foot"><button type="button" class="secondary small" data-day="${today}"${inRange(today) ? "" : " disabled"}>Today</button>` +
      (input.required ? "" : `<button type="button" class="secondary small" data-day="">Clear</button>`) + `</div>`;
  }

  // Under the box, or above it when there's no room below; within the window.
  function place() {
    if (!input) return;
    if (!input.isConnected || !input.getClientRects().length) return close(); // its pop-up or app went away
    const r = input.getBoundingClientRect(), w = cal.offsetWidth, h = cal.offsetHeight;
    const top = r.bottom + 4 + h > innerHeight - 8 && r.top - 4 - h >= 8 ? r.top - 4 - h : r.bottom + 4;
    cal.style.top = `${Math.round(top)}px`;
    cal.style.left = `${Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 8)))}px`;
  }

  function open(el) {
    if (!isDateBox(el)) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    input = el;
    month = firstOf(el.value || todayStr());
    render();
    cal.hidden = false;
    place();
  }

  function close() {
    if (!input) return;
    input = null;
    cal.hidden = true;
  }

  // A day picked (or "" by Clear): into the box, as typing it would, then closed.
  function pick(d) {
    const el = input;
    close();
    if (el.value === d) return;
    el.value = d;
    setting = true;
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } finally { setting = false; }
  }

  function init() {
    cal = document.createElement("div");
    cal.className = "datepick";
    cal.hidden = true;
    cal.setAttribute("role", "dialog");
    cal.setAttribute("aria-label", "Pick a day");
    document.body.appendChild(cal);
    // Taps inside keep the focus in the box (so leaving the box still closes it) and go no further.
    cal.addEventListener("mousedown", e => e.preventDefault());
    cal.addEventListener("click", e => {
      e.stopPropagation();
      const btn = e.target.closest("button");
      if (!btn || btn.disabled || !input) return;
      if (btn.dataset.months) {
        month = monthsOn(month, +btn.dataset.months);
        render();
        place();
      } else if (btn.dataset.day !== undefined) pick(btn.dataset.day);
    });
    // A click on a date box opens ours, not the browser's (a cancelled click doesn't open it).
    document.addEventListener("click", e => {
      if (!isDateBox(e.target)) return;
      e.preventDefault();
      if (input !== e.target) open(e.target);
    }, true);
    document.addEventListener("pointerdown", e => { if (input && e.target !== input && !cal.contains(e.target)) close(); }, true);
    document.addEventListener("input", e => { if (input && e.target === input && !setting) close(); }, true); // typed
    document.addEventListener("focusout", e => { if (input && e.target === input) close(); }, true);
    document.addEventListener("submit", close, true);
    // Esc closes it, before anything else hears the key (a pop-up under it stays open).
    window.addEventListener("keydown", e => {
      if (!input || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", e => { if (!cal.contains(e.target)) place(); }, true);
  }

  K.datePick = { init, open, close, isOpen: () => !!input };
})(Kyoshi);
