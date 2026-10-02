/* Appa · app.js — registers Appa with Kyoshi, plus its constants, state (A.S) and small helpers
 * (minutes, readings, money, dates, links). Loads first of Appa's files: the others destructure what's
 * here at the top, and call functions from each other as A.name(). File map and data model:
 * apps/appa/CLAUDE.md. */
(function (K) {
  "use strict";
  const { fmtDate, fmtShort, todayStr } = K.util;

  const A = K.register({
    id: "appa",
    name: "Appa",
    title: "Appa — Maintenance & Records",
    subtitle: "Maintenance that remembers itself, and the records to prove it.",
    width: 780,
    backupNote: "Your records live only in this browser. Export JSON saves them, but not the photos and PDFs: turn on Sync Folder to keep copies of those, and of your records, on your other devices.",
    // Its meeting with you (core/meetings.js): new things to add, and records to catch up on.
    meetings: [{ id: "review", title: "New things and records", every: "quarter", minutes: 15 }],
    // The "bull-head" icon from Lucide Lab (ISC license) — Appa is Aang's flying sky bison — in bison brown so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a26b3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10a5 5 0 0 1-4-8 4 4 0 0 0 4 4h10a4 4 0 0 0 4-4 5 5 0 0 1-4 8"/><path d="M6.4 15c-.3-.6-.4-1.3-.4-2 0-4 3-3 3-7"/><path d="M10 12.5v1.6"/><path d="M17.6 15c.3-.6.4-1.3.4-2 0-4-3-3-3-7"/><path d="M14 12.5v1.6"/><path d="M15 22a4 4 0 1 0-3-6.7A4 4 0 1 0 9 22Z"/><path d="M9 18h.01"/><path d="M15 18h.01"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // What a thing's meter counts. Ids are what backups store.
    METERS: {
      mi: { label: "Miles", unit: "mi", reading: "Odometer", check: "mileage", step: 1 },
      km: { label: "Kilometers", unit: "km", reading: "Odometer", check: "mileage", step: 1 },
      h: { label: "Hours", unit: "h", reading: "Hour meter", check: "hours", step: 0.1 }
    },
    // A time interval's units: [one, many]. Ids are what backups store.
    UNITS: { d: ["day", "days"], w: ["week", "weeks"], m: ["month", "months"], y: ["year", "years"] },
    LEAD_DAYS: 14,        // a job goes to Momo this many days before it's due (share.js)
    SOON_DAYS: 28,        // Coming up shows jobs due within this many days
    READING_AHEAD: 28,    // a meter job this close asks for a fresh reading, once
    READING_STALE: 60,    // …as does a reading this old
    ESTIMATE_RUNS: 5,     // the estimate is the average of this many latest times
    DEFAULT_MINUTES: 30,  // a job's time before anything's known
    READING_MINUTES: 5,   // checking a meter, for Momo
    PAGE_SIZE: 8,         // History's rows per page
    RECENT: 5,            // records on the home page
    MAX_THING: 28,        // a thing's name: short, so "<name> maintenance" fits Momo's 40-character cards
    MAX_TITLE: 60, MAX_ABOUT: 100, MAX_SERIAL: 40, MAX_NOTES: 4000, MAX_RECORD_NOTES: 2000, MAX_BY: 40,
    MAX_SOURCE: 60, MAX_WHERE: 60, MAX_LINK: 800, MAX_LABEL: 60, MAX_MINUTES: 7 * 24 * 60,
    PHOTO_MAX_PX: 2000, PHOTO_QUALITY: 0.82,
    PDF_MAX_BYTES: 20 * 1024 * 1024, PDF_WARN_BYTES: 5 * 1024 * 1024,
    // Small icons from Lucide (ISC license): proof in History, a PDF, a link, the timer.
    ICONS: Object.fromEntries(Object.entries({
      clip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
      file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>'
    }).map(([k, d]) => [k, `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`])),
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  Object.assign(A.S, {
    // Saved and synced (model.js has their shapes): each item keeps { deleted, at, u } for sync.
    things: [], jobs: [], records: [], readings: [], files: [], settings: { name: "", u: 0 },
    timer: null,        // this device's running timer: { jobId, start (ms) } — never synced
    version: 0,         // counts every change, so worked-out schedules are redone (schedule.js)
    // On screen
    view: "home",       // "home" | "thing" | "job"
    thingId: "", jobId: "",
    page: 1,            // History's page
    allRecords: false,  // the home page's Records shows all, not the latest few
    editing: null,      // the thing or job editor's state
    rec: null,          // the record pop-up's state (record.js)
    reading: null,      // the reading pop-up's state
    report: null,       // the report pop-up's state
    knownToday: ""      // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // Text as it's kept: trimmed and cut to max characters without splitting an emoji; a line also
  // turns runs of spaces and line breaks into one space.
  const cleanText = (v, max) => (typeof v === "string" ? [...v.trim()].slice(0, max).join("").trim() : "");
  const cleanLine = (v, max) => cleanText(typeof v === "string" ? v.replace(/\s+/g, " ") : "", max);

  // Minutes, rounded to what suits their size: 5-minute steps under an hour, quarter hours to 2
  // hours, half hours to 4, then whole hours.
  function niceMinutes(m) {
    if (!(m > 0)) return 0;
    const step = m < 60 ? 5 : m < 120 ? 15 : m < 240 ? 30 : 60;
    return Math.max(5, Math.round(m / step) * step);
  }
  // "45m", "1h 15m", "3h".
  function fmtMinutes(m) {
    if (!(m > 0)) return "";
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
  }
  // What someone types for a time: "45", "45m", "1:30", "1h30", "1.5h", "2 hours", "90 min" → minutes (NaN if not).
  function parseMinutes(text) {
    const t = String(text).trim().toLowerCase().replace(/\s+/g, "");
    if (!t) return null;
    let m = /^(\d+):(\d{1,2})$/.exec(t);
    if (m) return +m[1] * 60 + +m[2];
    m = /^(?:(\d+(?:\.\d+)?)(?:h|hr|hrs|hour|hours))?(?:(\d+(?:\.\d+)?)(?:m|min|mins|minute|minutes)?)?$/.exec(t);
    if (!m || (!m[1] && !m[2])) return NaN;
    return Math.round((m[1] ? +m[1] * 60 : 0) + (m[2] ? +m[2] : 0));
  }

  const meterOf = thing => (thing && A.METERS[thing.meter]) || null;
  // "48,210 mi", "312.5 h".
  const fmtReading = (v, thing) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}${meterOf(thing) ? ` ${meterOf(thing).unit}` : ""}`;
  // Money is kept in cents: "$62.40".
  const money = typeof Intl === "object" ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }) : null;
  const fmtMoney = cents => (money ? money.format(cents / 100) : `$${(cents / 100).toFixed(2)}`);
  function parseMoney(text) {
    const t = String(text).replace(/[$,\s]/g, "");
    if (!t) return null;
    const v = parseFloat(t);
    return /^\d*\.?\d*$/.test(t) && isFinite(v) && v >= 0 ? Math.round(v * 100) : NaN;
  }
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // Only web links are kept and opened.
  const safeLink = u => (typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : "");
  // A page number in "p. 214", "page 214", "pp. 12-14" (for the manual's link, #page=N).
  const pageNumber = where => { const m = /(?:^|\b)(?:p{1,2}\.?|pages?)\s*(\d{1,4})/i.exec(where || "") || /^\s*(\d{1,4})\s*$/.exec(where || ""); return m ? +m[1] : 0; };
  // A link to a source, at its page when there is one.
  function sourceLink(doc, where) {
    const link = doc && safeLink(doc.link);
    if (!link) return "";
    const page = pageNumber(where);
    return page && /\.pdf($|[?#])/i.test(link) && !link.includes("#") ? `${link}#page=${page}` : link;
  }
  // "Robot vacuum maintenance": what Momo calls a thing's jobs (fits its 40-character cards).
  const momoTitle = thing => `${[...thing.name].slice(0, A.MAX_THING).join("")} maintenance`;

  Object.assign(A, {
    cleanText, cleanLine, niceMinutes, fmtMinutes, parseMinutes, meterOf, fmtReading, fmtMoney, parseMoney,
    fmtDay, safeLink, pageNumber, sourceLink, momoTitle
  });
})(Kyoshi);
