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
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 30 }],
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
  // Injection sites, part by part in the order body parts take turns (PARTS), each part's sites in the
  // order its doses take them: an X, the other side every time and another height (the thighs also
  // swap faces on each leg; front: facing the ceiling when sitting, side: between buttock and thigh).
  // [id, label, short label, part]; ids are what backups store, so never change one (a retired one
  // goes to LEGACY_SITES).
  const SITES = [
    ["abd-l-upper", "Abdomen · left, upper", "Abd L upper", "abd"], ["abd-r-lower", "Abdomen · right, lower", "Abd R lower", "abd"],
    ["abd-l-lower", "Abdomen · left, lower", "Abd L lower", "abd"], ["abd-r-upper", "Abdomen · right, upper", "Abd R upper", "abd"],
    ["thigh-l-front-upper", "Thigh · left front, upper", "Thigh L front upper", "thigh"], ["thigh-r-side-middle", "Thigh · right side, middle", "Thigh R side middle", "thigh"],
    ["thigh-l-side-lower", "Thigh · left side, lower", "Thigh L side lower", "thigh"], ["thigh-r-front-upper", "Thigh · right front, upper", "Thigh R front upper", "thigh"],
    ["thigh-l-front-middle", "Thigh · left front, middle", "Thigh L front middle", "thigh"], ["thigh-r-side-lower", "Thigh · right side, lower", "Thigh R side lower", "thigh"],
    ["thigh-l-side-upper", "Thigh · left side, upper", "Thigh L side upper", "thigh"], ["thigh-r-front-middle", "Thigh · right front, middle", "Thigh R front middle", "thigh"],
    ["thigh-l-front-lower", "Thigh · left front, lower", "Thigh L front lower", "thigh"], ["thigh-r-side-upper", "Thigh · right side, upper", "Thigh R side upper", "thigh"],
    ["thigh-l-side-middle", "Thigh · left side, middle", "Thigh L side middle", "thigh"], ["thigh-r-front-lower", "Thigh · right front, lower", "Thigh R front lower", "thigh"],
    ["glute-l-upper", "Buttock · left, upper", "Buttock L upper", "glute"], ["glute-r-lower", "Buttock · right, lower", "Buttock R lower", "glute"],
    ["glute-l-lower", "Buttock · left, lower", "Buttock L lower", "glute"], ["glute-r-upper", "Buttock · right, upper", "Buttock R upper", "glute"],
    ["arm-l", "Upper arm · left", "Upper arm L", "arm"], ["arm-r", "Upper arm · right", "Upper arm R", "arm"]
  ];
  // Body parts, in the order they take turns (one with no site on is left out):
  // [id, heading, the word its sites' short labels start with].
  const PARTS = [["abd", "Abdomen", "Abd"], ["thigh", "Thighs", "Thigh"], ["glute", "Buttocks", "Buttock"], ["arm", "Upper arms", "Upper arm"]];
  // Sites of versions before 7.500, kept forever in logged doses and backups: [id, label, short label,
  // the site it stands for in the rotation]. The abdomen and buttocks had a side each (now its upper),
  // the thighs a height each (now its front).
  const LEGACY_SITES = [
    ["abd-l", "Abdomen · left", "Abdomen L", "abd-l-upper"], ["abd-r", "Abdomen · right", "Abdomen R", "abd-r-upper"],
    ["thigh-l-upper", "Thigh · left, upper", "Thigh L upper", "thigh-l-front-upper"], ["thigh-r-upper", "Thigh · right, upper", "Thigh R upper", "thigh-r-front-upper"],
    ["thigh-l-middle", "Thigh · left, middle", "Thigh L middle", "thigh-l-front-middle"], ["thigh-r-middle", "Thigh · right, middle", "Thigh R middle", "thigh-r-front-middle"],
    ["thigh-l-lower", "Thigh · left, lower", "Thigh L lower", "thigh-l-front-lower"], ["thigh-r-lower", "Thigh · right, lower", "Thigh R lower", "thigh-r-front-lower"],
    ["glute-l", "Buttock · left", "Buttock L", "glute-l-upper"], ["glute-r", "Buttock · right", "Buttock R", "glute-r-upper"]
  ];
  Object.assign(A, {
    DEFAULT_GOALS: [200, 175, 160, 150], // lb
    LB_PER_KG: 2.20462,
    PAGE_SIZE: 7,
    MAX_UPCOMING_DOSES: 3,
    MAX_DOSE_INTERVAL_DAYS: 14, // days between doses: a whole number from 1
    DOSE_SNOOZE_MS: 3600000,    // "Not yet" asks about a due dose again an hour later
    // Bumped when a dosing question is added, so start-up info asks once more. 2: usual dose time. 3: injection sites.
    // 4: injection sites by body part.
    DOSING_QUESTIONS_VERSION: 4,
    SITES, PARTS, LEGACY_SITES,
    // The sites on until you pick yours in start-up info: the abdomen and the thighs.
    DEFAULT_SITES: SITES.map(s => s[0]).filter(id => /^(abd|thigh)-/.test(id)),
    // A goal counts as reached once the average of this many days' weigh-ins passes it. Fixed: the
    // Average window on the page starts at 7 on every load and isn't stored.
    GOAL_AVG_DAYS: 7,
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
    entries: [],          // { date: "YYYY-MM-DD", weight: number|null, doseMg: number|null, medication: id|null, site, wu, du (when its weigh-in, its dose last changed: once they have, 7.601 on) }, one per date, sorted
    gone: [],             // deleted days' markers { date, wu, du } (what was deleted, by its stamps): apart from the entries, so nothing else sees them
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
  // The injection sites on: the default ones until changed in start-up info (an empty list: sites off).
  // A site's labels: "Thigh · left front, upper", or "Thigh L front upper" (an old one's as it read
  // then; one from a newer version: its id).
  const activeSites = () => S.profile.sites || A.DEFAULT_SITES;
  const currentSite = id => SITES.find(s => s[0] === id), legacySite = id => LEGACY_SITES.find(s => s[0] === id);
  const siteOf = id => currentSite(id) || legacySite(id);
  const siteLabel = id => (siteOf(id) ? siteOf(id)[1] : id);
  const siteShort = id => (siteOf(id) ? siteOf(id)[2] : id);
  // The site an id stands for in the rotation: itself, an old one's stand-in, or null (one from a newer version).
  const standsFor = id => (currentSite(id) ? id : legacySite(id) ? legacySite(id)[3] : null);
  // A site's body part (null for one from a newer version), and a part's sites in the order its doses take them.
  const partOf = id => (standsFor(id) ? currentSite(standsFor(id))[3] : null);
  const sitesIn = part => SITES.filter(s => s[3] === part).map(s => s[0]);
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
    isDoseInterval, eachDoseMg, weeklyFor, activeSites, siteLabel, siteShort, standsFor, partOf, sitesIn, fmtConc, fmtUnits, readNumber
  });
})(Kyoshi);
