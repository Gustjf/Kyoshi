/* Bosco · app.js — registers Bosco with Kyoshi, plus its constants, state (A.S) and small helpers.
 * Loads first of Bosco's files: the others destructure what's here at the top, and call
 * functions from each other as A.name() (all files are loaded by the time anything runs).
 * File map and data model: apps/bosco/CLAUDE.md. */
(function (K) {
  "use strict";
  const { isNum, fmtNum, fmtDate, fmtShort, todayStr, addDays, extent } = K.util;

  const A = K.register({
    id: "bosco",
    name: "Bosco",
    title: "Bosco — Weight Tracker & Projections",
    subtitle: "A weight tracker with projections. Runs 100% locally, private & offline.",
    width: 780,
    // The "bear-face" icon from Lucide Lab (ISC license), in the accent blue so it shows on light and dark tabs.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 7 .5.5"/><path d="m18 7-.5.5"/><path d="M20.8 4.2c-1.6-1.6-4.1-1.6-5.7 0l-1 1a13.6 13.6 0 0 0-4.2 0l-1-1a4 4 0 0 0-5.8 5.55A7 7 0 0 0 2 13.5C2 18.2 6.5 22 12 22s10-3.8 10-8.5a7 7 0 0 0-1.1-3.8c1.5-1.6 1.5-4-.1-5.5"/><path d="M10 12v-.5"/><path d="M14 12v-.5"/><path d="M14 16h-4"/><path d="M12 16v2"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  // GLP-1 medications a dose can be for. Add more here; ids are what backups store.
  const MEDICATIONS = {
    tirzepatide: { label: "Tirzepatide", example: "5" },
    semaglutide: { label: "Semaglutide", example: "0.5" },
    retatrutide: { label: "Retatrutide", example: "4" }
  };
  Object.assign(A, {
    DEFAULT_GOALS: [200, 175, 160, 150], // lb
    LB_PER_KG: 2.20462,
    PAGE_SIZE: 7,
    MAX_UPCOMING_DOSES: 3,
    MAX_DOSE_INTERVAL_DAYS: 14, // days between doses: a whole number from 1
    DOSE_SNOOZE_MS: 3600000,    // "Not yet" asks about a due dose again an hour later
    // Bumped when a dosing question is added, so start-up info asks once more. 2: usual dose time.
    DOSING_QUESTIONS_VERSION: 2,
    BAC_ML_RANGE: [1, 3],       // BAC water a vial can be mixed with, as on its slider
    MAX_ETA_WEEKS: 5200,        // ~100 years; anything slower counts as a flat rate
    TREND_MIN_WEIGHINS: 3,      // in each of the two 7-day averages Current Trend's weekly rate compares
    // The weekly pace goal until one is saved in start-up info: lose 1% a week, give or take 0.25%.
    DEFAULT_PACE_GOAL: { dir: "lose", weeklyPct: 1, rangePct: 0.25 },
    MAX_PACE_PCT: 3,            // the highest weekly target, in % of body weight
    // Backup file format. Bump only when import has to migrate the data. v2:
    // entries gained doseMg. v3: entries gained medication (a dose without one is
    // Tirzepatide, the only medication older versions had). v4: doses are logged
    // only once taken (before, a dose dated ahead was an upcoming one).
    DATA_SCHEMA_VERSION: 4,
    MEDICATIONS,
    LEGACY_MEDICATION: "tirzepatide",
    // Start-up questions. Required ones show until answered; optional ones until
    // asked once. Add more here without touching the surrounding logic.
    ONE_TIME_FIELDS: [
      { key: "name", label: "Your name", type: "text", placeholder: "e.g. Jordan" },
      { key: "unit", label: "Units", type: "select", options: ["lb", "kg"], default: "lb" },
      { key: "medication", label: "Which GLP-1 medication do you take?", type: "select", optional: true, default: "tirzepatide",
        options: [...Object.entries(MEDICATIONS).map(([id, m]) => [id, m.label]), ["none", "None"]] }
    ]
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    entries: [],          // { date: "YYYY-MM-DD", weight: number|null, doseMg: number|null, medication: id|null }, one per date, sorted
    goals: [],            // goal weights, sorted high to low
    profile: {},          // start-up answers
    unit: "lb",           // the whole app uses one unit at a time: profile.unit, or lb until chosen
    rateMode: "trend",    // "trend" | "custom"
    trendWindow: "7",     // days back the weekly rate compares with: "7" | "14" | "30" | "60" | "90"
    avgWindow: "7",       // days in the rolling average, same options; starts at 7 on every load
    currentPage: 1,
    entryDateDefault: "", // the "today" the Date field was last set to
    dosingAsking: false,  // start-up info is showing the dosing plan & vial
    paceAsking: false,    // start-up info is showing the weekly pace goal
    vialEditing: false,   // the vial calculator is open
    anchorEditing: false, // the anchor dose date is showing in start-up info
    vialMode: "mix",      // "mix" (vial mg + BAC water) | "known" (mg/mL)
    doseAsking: null      // the scheduled dose the confirmation pop-up is open for
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const hasWeight = e => isNum(e.weight);
  const hasDose = e => isNum(e.doseMg);
  const byDate = (a, b) => a.date.localeCompare(b.date);
  // Exported image and dose cards: show the year only when it isn't this year.
  const fmtDateBrief = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  // First/middle/last dates for a chart's x-axis (fewer on very short spans).
  const axisDates = (first, totalDays) => [...new Set([0, 0.5, 1].map(f => addDays(first, Math.round(totalDays * f))))];
  // A chart's weight axis: the data padded by padFrac each side, but at least 4 units
  // tall so tiny changes don't fill the chart and whole-number labels never repeat.
  function weightRange(values, padFrac) {
    const [min, max] = extent(values);
    const pad = Math.max((max - min) * padFrac, (4 - (max - min)) / 2);
    return [min - pad, max + pad];
  }

  // Weights are kept at 1-decimal precision in whichever unit is active.
  function convertWeight(v, from, to) {
    if (!isNum(v) || from === to) return v;
    return Math.round((to === "kg" ? v / A.LB_PER_KG : v * A.LB_PER_KG) * 10) / 10;
  }

  // The medication new doses are for: the start-up answer, Tirzepatide until answered.
  const currentMedication = () => (S.profile.medication === "none" || Object.hasOwn(MEDICATIONS, S.profile.medication) ? S.profile.medication : A.LEGACY_MEDICATION);
  const medicationEnabled = () => currentMedication() !== "none";
  const medLabel = id => (Object.hasOwn(MEDICATIONS, id) ? MEDICATIONS[id].label : id);
  // Names a dose's medication only when it isn't the current one.
  const otherMedNote = e => (e.medication !== currentMedication() ? ` (${medLabel(e.medication)})` : "");

  // The dosing plan and vial are each kept for one medication at a time.
  const planFor = med => (S.profile.dosePlan && S.profile.dosePlan.medication === med ? S.profile.dosePlan : null);
  const vialFor = med => (S.profile.vial && S.profile.vial.medication === med ? S.profile.vial : null);
  const activeVial = () => vialFor(currentMedication());
  const isDoseInterval = d => Number.isInteger(d) && d >= 1 && d <= A.MAX_DOSE_INTERVAL_DAYS;
  // Each dose: a weekly dose spread over the days between doses, to 3 decimal
  // places (small daily doses need them), so any two plans compare by the week.
  const eachDoseMg = (weeklyMg, intervalDays) => +(weeklyMg * intervalDays / 7).toFixed(3);
  // The weekly dose that gives each dose of doseMg: to 3 decimal places, or more
  // when that's what it takes (2.5 mg every 8 days is 2.1875 mg a week).
  function weeklyFor(doseMg, intervalDays) {
    for (let places = 3; places < 10; places++) {
      const weekly = +(doseMg * 7 / intervalDays).toFixed(places);
      if (eachDoseMg(weekly, intervalDays) === +doseMg.toFixed(3)) return weekly;
    }
    return doseMg * 7 / intervalDays;
  }
  const fmtConc = mgPerMl => `${fmtNum(mgPerMl, 3)} mg/mL`; // as precise as it can be entered
  // A dose drawn from a vial, in U-100 insulin syringe units (100 units = 1 mL):
  // to the nearest half unit, then the exact amount when that differs, "12.5 units (12.36)".
  function fmtUnits(mg, mgPerMl) {
    const units = mg / mgPerMl * 100, rounded = fmtNum(Math.round(units * 2) / 2, 1), exact = fmtNum(units, 2);
    return `${rounded} units${exact === rounded ? "" : ` (${exact})`}`;
  }
  // A number field in Bosco by id: null when empty, NaN when the browser couldn't parse it.
  const readNumber = id => K.util.readNumber(A.$(id));

  Object.assign(A, {
    hasWeight, hasDose, byDate, fmtDateBrief, axisDates, weightRange, convertWeight,
    currentMedication, medicationEnabled, medLabel, otherMedNote, planFor, vialFor, activeVial,
    isDoseInterval, eachDoseMg, weeklyFor, fmtConc, fmtUnits, readNumber
  });
})(Kyoshi);
