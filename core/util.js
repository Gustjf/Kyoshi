/* Kyoshi · core/util.js — small helpers every app shares, as K.util.
 * Numbers & text, dates (with time travel), formatting, files & clipboard, and how two devices' copies of a thing
 * are combined (newer, mergeById, mergeKeys: the app side of core/sync.js).
 * In an app file: const { isNum, fmtDate, todayStr } = Kyoshi.util;
 * (An app's own $ is A.$ — it only looks inside that app, see core/shell.js.) */
(function (K) {
  "use strict";

  // --- Numbers & text ---
  const isNum = v => typeof v === "number" && isFinite(v);
  const isPos = v => isNum(v) && v > 0;
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const sum = arr => arr.reduce((s, v) => s + v, 0);
  const mean = arr => sum(arr) / arr.length;
  const extent = arr => [arr.reduce((a, b) => Math.min(a, b)), arr.reduce((a, b) => Math.max(a, b))];
  const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
  const pad2 = n => String(n).padStart(2, "0");
  // Rounded for display, without trailing zeros: fmtNum(5.8333) -> "5.83", fmtNum(20.0, 1) -> "20".
  const fmtNum = (v, places = 2) => String(+v.toFixed(places));
  // A change with its sign, none when it rounds to zero: -0.52, +1.0, 0.0.
  const fmtSigned = (v, places) => { const s = Math.abs(v).toFixed(places); return `${+s ? (v < 0 ? "-" : "+") : ""}${s}`; };
  const SEP = '<span class="sep">|</span>'; // between values on one line: a dot could pass for a decimal point
  // A size in bytes, for people: "640 bytes", "4.2 KB", "1.7 MB", "120 GB".
  function fmtBytes(n) {
    const units = ["bytes", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${i ? fmtNum(n, n < 10 ? 1 : 0) : Math.round(n)} ${units[i]}`;
  }

  // A number field's value: null when empty, NaN when the browser couldn't parse it.
  function readNumber(el) {
    if (el.validity.badInput) return NaN;
    if (el.value === "") return null;
    const v = parseFloat(el.value);
    return isFinite(v) ? v : NaN;
  }

  // --- Dates ---
  // Dates are "YYYY-MM-DD" calendar days. Date math runs in UTC so timezones and
  // daylight saving can't shift a day; only "today" reads the local clock.
  const DAY_MS = 86400000;
  const dateMs = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const msDate = ms => new Date(ms).toISOString().slice(0, 10);
  const isDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && msDate(dateMs(d)) === d;
  const daysBetween = (a, b) => Math.round((dateMs(b) - dateMs(a)) / DAY_MS);
  const addDays = (d, n) => msDate(dateMs(d) + n * DAY_MS);
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1–12
  // n months on (or back), stopping at the month's end: Jan 31 + 1 month is Feb 28 (or 29).
  function addMonths(d, n) {
    const i = +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1) + n, y = Math.floor(i / 12), m = i - y * 12 + 1;
    return `${y}-${pad2(m)}-${pad2(Math.min(+d.slice(8, 10), daysInMonth(y, m)))}`;
  }
  const localDate = t => msDate(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())); // a moment's day on this device
  // Today and now, moved by any developer time travel (K.dayOffset, see core/dev.js).
  const todayStr = () => addDays(localDate(new Date()), K.dayOffset);
  const now = () => Date.now() + K.dayOffset * DAY_MS;
  const fmtDate = (d, opts = { year: "numeric", month: "short", day: "numeric" }) =>
    new Date(dateMs(d)).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
  const fmtShort = d => fmtDate(d, { month: "short", day: "numeric" });
  const fmtWeekday = d => fmtDate(d, { weekday: "long" });
  // Times of day as "HH:MM", 24-hour.
  const isTime = t => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const fmtTime = t => new Date(2000, 0, 1, +t.slice(0, 2), +t.slice(3)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const clockTime = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); // now, e.g. "3:04 PM"

  // --- Sync merges (the app side of core/sync.js: every app's combine, core/record.js, core/meetings.js) ---
  // Two copies of one record stamped with u (Date.now() at its last change): whether a is the later change. A tie goes by
  // the text, so every device picks the same one and two combining at once agree.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  // Two lists of records with an id and a u, record by record: each id's later change, theirs added where new here. In no
  // order of its own: sort the result as the app keeps its list.
  function mergeById(mine, theirs) {
    const byId = new Map(mine.map(i => [i.id, i]));
    theirs.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
    return [...byId.values()];
  }
  // Two objects of records with a u, key by key: each key's later change (a key one side lacks comes from the other), the
  // keys sorted, so two devices' results read the same.
  function mergeKeys(mine, theirs) {
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k), out = {};
    [...new Set(Object.keys(mine).concat(Object.keys(theirs)))].sort().forEach(k => {
      const a = has(mine, k) ? mine[k] : null, b = has(theirs, k) ? theirs[k] : null;
      out[k] = !a ? b : !b ? a : newer(b, a) ? b : a;
    });
    return out;
  }

  // --- Files & clipboard ---
  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); // some browsers ignore clicks on detached links
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000); // revoking immediately can cancel the download
  }
  const downloadJSON = (obj, filename) => downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), filename);

  // A picked file's text, or null (after saying so) if it can't be read.
  function readFile(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => { alert("Couldn't read that file."); resolve(null); };
      reader.readAsText(file);
    });
  }

  // Falls back to a hidden textarea + execCommand where the Clipboard API is missing.
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const copied = document.execCommand("copy");
        ta.remove();
        return copied;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  K.util = {
    isNum, isPos, isObj, sum, mean, extent, newId, esc, pad2, fmtNum, fmtSigned, SEP, fmtBytes, readNumber,
    DAY_MS, dateMs, msDate, isDate, daysBetween, addDays, addMonths, daysInMonth, localDate, todayStr, now,
    fmtDate, fmtShort, fmtWeekday, isTime, fmtTime, clockTime,
    newer, mergeById, mergeKeys,
    downloadBlob, downloadJSON, readFile, copyText
  };
})(Kyoshi);
