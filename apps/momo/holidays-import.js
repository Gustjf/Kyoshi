/* Momo · holidays-import.js — the Holidays pop-up (#holidaysOverlay), opened from Developer Mode's Time off block
 * (timeoff.js): a box to paste a list (a date, then its name, a line each) and Choose a file… (a calendar's .ics, or a
 * .txt / .csv read as pasted), what it read shown under them before anything is kept ("3 holidays: Nov 26 Thanksgiving,
 * …; line 4 not understood"), Add (holidays.js addHolidays); Fill with a template (the next 12 months of common US
 * holidays on their dates, to edit; Thanksgiving and Christmas as runs of days) and Copy (the box, to keep your list
 * elsewhere); then the holidays from today on, a run of days with the same name as one row, each with ✕ (the whole run,
 * at once: Momo's Undo brings it back once the pop-up is closed). What was read names runs the same way. Esc or × with something pasted or picked asks first; Close doesn't. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr, addDays, fmtShort } = K.util;
  const { DAY_NAMES, dayIndex } = A;

  const SHOWN = 6;          // holidays named in what was read, then "and 4 more"
  const overlay = () => $("holidaysOverlay");
  let picked = null;        // a file's reading ({ name, read }) until the box is typed in or it's added
  const dayWords = date => `${DAY_NAMES[dayIndex(date)]} ${fmtShort(date)}`;
  // A run's days: "Thu Dec 24", or "Thu Dec 24 – Sat Dec 26".
  const runWords = r => (r.from === r.to ? dayWords(r.from) : `${dayWords(r.from)} – ${dayWords(r.to)}`);
  const reading = () => (picked ? picked.read : A.readHolidays($("holidaysText").value));
  const pending = () => !!picked || !!$("holidaysText").value.trim();

  // The template: common US holidays in the next 12 months from today (today counts), by date, each on its day that
  // year (Thanksgiving the 4th Thursday of November…), as lines to edit: "2026-11-26 Thanksgiving".
  const pad = n => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const nth = (y, m, wd, n) => 1 + ((wd - weekday(y, m, 1) + 7) % 7) + 7 * (n - 1); // the nth weekday of a month
  const last = (y, m, wd) => { const end = new Date(Date.UTC(y, m, 0)).getUTCDate(); return end - ((weekday(y, m, end) - wd + 7) % 7); };
  // Each [name, its first day, its last day (a run of days) or none]: Thanksgiving with the day after, and Christmas Eve
  // with Christmas Day, as runs, so the template shows how one is written.
  const US = [
    ["New Year's Day", y => ymd(y, 1, 1)], ["Martin Luther King Jr. Day", y => ymd(y, 1, nth(y, 1, 1, 3))],
    ["Presidents' Day", y => ymd(y, 2, nth(y, 2, 1, 3))], ["Memorial Day", y => ymd(y, 5, last(y, 5, 1))],
    ["Juneteenth", y => ymd(y, 6, 19)], ["Independence Day", y => ymd(y, 7, 4)], ["Labor Day", y => ymd(y, 9, nth(y, 9, 1, 1))],
    ["Columbus Day", y => ymd(y, 10, nth(y, 10, 1, 2))], ["Veterans Day", y => ymd(y, 11, 11)],
    ["Thanksgiving", y => ymd(y, 11, nth(y, 11, 4, 4)), y => ymd(y, 11, nth(y, 11, 4, 4) + 1)],
    ["Christmas", y => ymd(y, 12, 24), y => ymd(y, 12, 25)], ["New Year's Eve", y => ymd(y, 12, 31)]
  ];
  function template() {
    const today = todayStr(), y = +today.slice(0, 4);
    const lines = US.map(([name, first, last]) => {
      const yy = (last || first)(y) >= today ? y : y + 1; // a run still under way stays this year's
      return [first(yy), `${first(yy)}${last ? ` to ${last(yy)}` : ""} ${name}`];
    }).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return "# One a line: the date, then its name. Several days in a row: the first to the last, then the name.\n" +
      "# Edit the dates and names, delete the lines you don't get off, add your own; then Add.\n" + lines.map(x => x[1]).join("\n") + "\n";
  }
  function fillTemplate() {
    if ($("holidaysText").value.trim() && !confirm("Replace what's in the box with the template?")) return;
    picked = null;
    $("holidaysText").value = template();
    $("holidaysText").rows = 12; // the whole list in view, to edit
    renderRead();
    $("holidaysText").focus();
    $("holidaysText").setSelectionRange(0, 0);
    $("holidaysText").scrollTop = 0;
  }
  async function copyBox() {
    const text = $("holidaysText").value;
    $("holidaysCopied").textContent = !text.trim() ? "Nothing to copy." : (await K.util.copyText(text)) ? "Copied." : "Couldn't copy: select the text and copy it.";
  }

  // What was read: "From work.ics: 3 holidays: Thu Nov 26 Thanksgiving, …; 1 event not understood".
  function renderRead() {
    const r = reading(), n = r.found.length, out = $("holidaysRead"), runs = A.runsOf(r.found);
    const named = runs.slice(0, SHOWN).map(x => `${runWords(x)} ${x.name}`).join(", ") + (runs.length > SHOWN ? `, and ${runs.length - SHOWN} more` : "");
    const what = r.events ? "event" : "line", not = r.bad ? `${r.bad} ${what}${r.bad > 1 ? "s" : ""} not understood` +
      (r.lines.length ? ` (line${r.lines.length > 1 ? "s" : ""} ${r.lines.slice(0, 8).join(", ")}${r.lines.length > 8 ? "…" : ""})` : "") : "";
    const notes = [r.past ? `${r.past} already past (kept for your time off, not listed)` : "", not,
      r.timed ? `${r.timed} timed event${r.timed > 1 ? "s" : ""} left out (only all-day ones are holidays)` : ""].filter(Boolean);
    out.textContent = !pending() ? "" : `${picked ? `From ${picked.name}: ` : ""}${n ? `${n} holiday${n > 1 ? "s" : ""}: ${named}` : "No holidays found"}${notes.map(x => `; ${x}`).join("")}.`;
    out.classList.toggle("bad", pending() && !n);
    $("holidaysAddBtn").disabled = !n;
  }

  // The holidays from today on, a run of days with the same name as one row, each with ✕ (the whole run).
  function renderList() {
    const runs = A.runsOf(A.holidaysIn(todayStr(), addDays(todayStr(), 3 * 366)));
    $("holidaysList").innerHTML = runs.length ? runs.map(r => `<div class="holiday-row"><span class="holiday-day">${esc(runWords(r))}</span>` +
      `<span class="holiday-name">${esc(r.name)}</span><button type="button" class="icon-btn holiday-x" data-remove="${r.from}" data-to="${r.to}" aria-label="Remove ${esc(r.name)}" title="Remove">&times;</button></div>`).join("")
      : `<div class="note">None from today on.</div>`;
  }

  function openHolidays() {
    picked = null;
    $("holidaysText").value = "";
    $("holidaysFile").value = "";
    $("holidaysCopied").textContent = "";
    $("holidaysText").rows = 5;
    renderRead();
    renderList();
    K.modal.open(overlay());
    if (!A.isPhone()) $("holidaysText").focus(); // on a phone the keyboard would cover the list
  }
  function closeHolidays() {
    picked = null;
    K.modal.close(overlay());
  }

  function add() {
    const r = reading();
    if (!r.found.length) return;
    A.addHolidays(r.found);
    picked = null;
    $("holidaysText").value = "";
    $("holidaysFile").value = "";
    renderRead();
    renderList();
  }

  async function pick(file) {
    if (!file) return;
    const text = await K.util.readFile(file);
    if (text === null) return;
    picked = { name: file.name, read: A.readHolidays(text) };
    $("holidaysText").value = "";
    $("holidaysFile").value = ""; // the same file can be picked again
    renderRead();
  }

  function initHolidays() {
    K.modal.define(overlay(), { dismiss: closeHolidays, pending, ask: "Discard the holidays you've pasted or picked?" });
    $("holidaysText").addEventListener("input", () => { picked = null; $("holidaysCopied").textContent = ""; renderRead(); });
    $("holidaysTemplateBtn").addEventListener("click", fillTemplate);
    $("holidaysCopyBtn").addEventListener("click", copyBox);
    $("holidaysFileBtn").addEventListener("click", () => $("holidaysFile").click());
    $("holidaysFile").addEventListener("change", e => pick(e.target.files[0]));
    $("holidaysAddBtn").addEventListener("click", add);
    $("holidaysCloseBtn").addEventListener("click", closeHolidays);
    $("holidaysList").addEventListener("click", e => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const next = btn.closest(".holiday-row").nextElementSibling;
      const at = next && next.querySelector("[data-remove]") ? next.querySelector("[data-remove]").dataset.remove : "";
      const dates = [];
      for (let d = btn.dataset.remove; d <= btn.dataset.to; d = addDays(d, 1)) dates.push(d);
      A.removeHolidays(dates);
      renderList();
      (at ? $("holidaysList").querySelector(`[data-remove="${at}"]`) : $("holidaysCloseBtn")).focus(); // focus stays in the pop-up
    });
  }

  Object.assign(A, { openHolidays, initHolidays });
})(Kyoshi, Kyoshi.apps.momo);
