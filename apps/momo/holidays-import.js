/* Momo · holidays-import.js — the Holidays pop-up (#holidaysOverlay), opened from Developer Mode's Time off block
 * (timeoff.js): a box to paste a list (a date, then its name, a line each) and Choose a file… (a calendar's .ics, or a
 * .txt / .csv read as pasted), what it read shown under them before anything is kept ("3 holidays: Nov 26 Thanksgiving,
 * …; line 4 not understood"), Add (holidays.js addHolidays); then the holidays from today on, each with ✕ (removed at
 * once: Momo's Undo brings it back once the pop-up is closed). Esc or × with something pasted or picked asks first; Close doesn't. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr, addDays, fmtShort } = K.util;
  const { DAY_NAMES, dayIndex } = A;

  const SHOWN = 6;          // holidays named in what was read, then "and 4 more"
  const overlay = () => $("holidaysOverlay");
  let picked = null;        // a file's reading ({ name, read }) until the box is typed in or it's added
  const dayWords = date => `${DAY_NAMES[dayIndex(date)]} ${fmtShort(date)}`;
  const reading = () => (picked ? picked.read : A.readHolidays($("holidaysText").value));
  const pending = () => !!picked || !!$("holidaysText").value.trim();

  // What was read: "From work.ics: 3 holidays: Thu Nov 26 Thanksgiving, …; 1 event not understood".
  function renderRead() {
    const r = reading(), n = r.found.length, out = $("holidaysRead");
    const named = r.found.slice(0, SHOWN).map(h => `${dayWords(h.date)} ${h.name}`).join(", ") + (n > SHOWN ? `, and ${n - SHOWN} more` : "");
    const what = r.events ? "event" : "line", not = r.bad ? `${r.bad} ${what}${r.bad > 1 ? "s" : ""} not understood` +
      (r.lines.length ? ` (line${r.lines.length > 1 ? "s" : ""} ${r.lines.slice(0, 8).join(", ")}${r.lines.length > 8 ? "…" : ""})` : "") : "";
    const notes = [r.past ? `${r.past} already past (kept for your time off, not listed)` : "", not,
      r.timed ? `${r.timed} timed event${r.timed > 1 ? "s" : ""} left out (only all-day ones are holidays)` : ""].filter(Boolean);
    out.textContent = !pending() ? "" : `${picked ? `From ${picked.name}: ` : ""}${n ? `${n} holiday${n > 1 ? "s" : ""}: ${named}` : "No holidays found"}${notes.map(x => `; ${x}`).join("")}.`;
    out.classList.toggle("bad", pending() && !n);
    $("holidaysAddBtn").disabled = !n;
  }

  // The holidays from today on, each with ✕.
  function renderList() {
    const list = A.holidaysIn(todayStr(), addDays(todayStr(), 3 * 366));
    $("holidaysList").innerHTML = list.length ? list.map(h => `<div class="holiday-row"><span class="holiday-day">${esc(dayWords(h.date))}</span>` +
      `<span class="holiday-name">${esc(h.name)}</span><button type="button" class="icon-btn holiday-x" data-remove="${h.date}" aria-label="Remove ${esc(h.name)}" title="Remove">&times;</button></div>`).join("")
      : `<div class="note">None from today on.</div>`;
  }

  function openHolidays() {
    picked = null;
    $("holidaysText").value = "";
    $("holidaysFile").value = "";
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
    $("holidaysText").addEventListener("input", () => { picked = null; renderRead(); });
    $("holidaysFileBtn").addEventListener("click", () => $("holidaysFile").click());
    $("holidaysFile").addEventListener("change", e => pick(e.target.files[0]));
    $("holidaysAddBtn").addEventListener("click", add);
    $("holidaysCloseBtn").addEventListener("click", closeHolidays);
    $("holidaysList").addEventListener("click", e => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const next = btn.closest(".holiday-row").nextElementSibling;
      const at = next && next.querySelector("[data-remove]") ? next.querySelector("[data-remove]").dataset.remove : "";
      A.removeHoliday(btn.dataset.remove);
      renderList();
      (at ? $("holidaysList").querySelector(`[data-remove="${at}"]`) : $("holidaysCloseBtn")).focus(); // focus stays in the pop-up
    });
  }

  Object.assign(A, { openHolidays, initHolidays });
})(Kyoshi, Kyoshi.apps.momo);
