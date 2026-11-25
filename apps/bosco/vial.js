/* Bosco · vial.js — each medication's vial card, beside its next dose (the owner's request, 2026-11-25: for planning when
 * to mix the next one, say before a trip): the active vial's strength, mg and BAC water, the day it was mixed (the day it
 * was saved: nothing new is stored), what's left (whole doses and the mg over), the last dose it covers and the dose a new
 * vial is needed by, and when it expires (MEDICATIONS' vialDays from mixing; a dose on that day still counts). Every dose
 * of its medication dated on or after the day mixed comes out of it. Past its expiry, the dates stop there and a warning
 * says how much goes unused. Amber with a dose or none left. A vial saved as "Known mg/mL" has no total: no count, no
 * dates but its expiry. It's the lower (or right) part of its medication's card, render.js. Mixed a new one saves the same recipe again, dated today; Change vial opens start-up info's
 * calculator. Nothing here is stored or synced on its own. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { addDays, daysBetween, localDate, todayStr, fmtDate, fmtNum, SEP } = K.util;
  const { MEDICATIONS, dosesOf, medLabel, planFor, vialFor, eachDoseMg, fmtConc, fmtDateBrief } = A;

  const mg = x => Math.round(x * 1000) / 1000; // to the 3 decimals doses are stored at, so 0.1 + 0.2 never shows
  const day = d => `${fmtDate(d, { weekday: "short" })}, ${fmtDateBrief(d)}`;

  // A medication's active vial, as the card shows it: { vial, mixed (the day saved, "" if unknown), expires ("" without a
  // limit), leftMg, doses (whole doses left), overMg (the mg past them), last (the last dose it covers, "" if none),
  // newBy (the first dose it can't), wasted (mg left at its expiry) }; each part only when it can be worked out
  // (leftMg needs the vial's total; doses its plan's dose; last and newBy a dose to count from). null without a vial.
  function vialStatus(med) {
    const vial = vialFor(med);
    if (!vial) return null;
    const saved = new Date(vial.savedAt), mixed = vial.savedAt && !isNaN(saved) ? localDate(saved) : "";
    const out = { vial, mixed, expires: mixed && MEDICATIONS[med].vialDays ? addDays(mixed, MEDICATIONS[med].vialDays) : "" };
    if (!mixed || !vial.vialMg) return out;
    const used = S.entries.filter(e => e.date >= mixed).flatMap(dosesOf).filter(d => d.medication === med).reduce((s, d) => s + d.doseMg, 0);
    out.leftMg = Math.max(0, mg(vial.vialMg - used));
    const plan = planFor(med);
    if (!plan || !plan.intervalDays || !plan.weeklyMg) return out;
    const doseMg = eachDoseMg(plan.weeklyMg, plan.intervalDays), every = plan.intervalDays;
    out.doses = Math.floor(out.leftMg / doseMg + 1e-9);
    out.overMg = Math.max(0, mg(out.leftMg - out.doses * doseMg));
    const next = A.doseSchedule(med)[0];
    if (!next) return out;
    // The doses it can still give before it expires (from the next one, every `every` days).
    const fit = !out.expires ? Infinity : next.date > out.expires ? 0 : Math.floor(daysBetween(next.date, out.expires) / every) + 1;
    const usable = Math.min(out.doses, fit), at = k => addDays(next.date, k * every);
    out.last = usable ? at(usable - 1) : "";
    out.newBy = at(usable);
    out.usable = usable;
    out.wasted = usable < out.doses ? mg(out.leftMg - usable * doseMg) : 0;
    return out;
  }

  // The vial's part of its medication's card, under (or beside) the next dose: what's left in large type, the strength
  // and recipe, its dates in a grid (two to a row, four in a wide card), a red line when it expires before it's used up
  // (or has), and its buttons. Amber with one dose or none left (or past its expiry).
  function vialCard(med) {
    const v = vialStatus(med);
    if (!v) return "";
    const { vial } = v, expired = !!v.expires && v.expires < todayStr();
    const low = expired || (v.doses !== undefined && (v.usable ?? v.doses) <= 1);
    const recipe = vial.vialMg ? `${fmtNum(vial.vialMg, 2)} mg + ${fmtNum(vial.bacMl, 2)} mL` : "";
    // What's left: whole doses and the mg over; the mg without a plan; the strength for a vial with no total.
    const head = expired ? `Vial expired${v.doses ? ` <span class="over">${v.doses} dose${v.doses === 1 ? "" : "s"} unused</span>` : ""}`
      : v.doses === undefined ? (v.leftMg !== undefined ? `${fmtNum(v.leftMg, 2)} mg left` : fmtConc(vial.mgPerMl))
      : v.doses ? `${v.doses} dose${v.doses === 1 ? "" : "s"} left${v.overMg ? ` <span class="over">+ ${fmtNum(v.overMg, 2)} mg</span>` : ""}`
      : `Vial used up${v.leftMg ? ` <span class="over">${fmtNum(v.leftMg, 2)} mg left</span>` : ""}`;
    const sub = v.leftMg === undefined ? (recipe ? `${fmtConc(vial.mgPerMl)}${SEP}${recipe}` : "Known strength") : `${fmtConc(vial.mgPerMl)}${recipe ? `${SEP}${recipe}` : ""}`;
    const dates = [["Mixed", v.mixed], ["Last dose", v.last], ["New vial by", v.newBy], [expired ? "Expired" : "Expires", v.expires, expired || !!v.wasted]]
      .filter(([, d]) => d).map(([label, d, bad]) => `<div${bad ? ' class="bad"' : ""}><dt>${label}</dt><dd>${day(d)}</dd></div>`).join("");
    const weeks = MEDICATIONS[med].vialDays / 7;
    const warn = expired ? `Past its ${weeks} weeks: mix a new one.`
      : v.wasted ? `Expires ${weeks} weeks after mixing, before it's used up: ${fmtNum(v.wasted, 2)} mg will go unused.` : "";
    return `<div class="part vial-stat${low ? " due" : ""}">
      <div class="val">${head}</div>
      <div class="lbl">${sub}</div>
      ${dates ? `<dl class="vial-dates">${dates}</dl>` : ""}
      ${warn ? `<div class="vial-warn">${warn}</div>` : ""}
      <div class="vial-actions">
        <button class="secondary small" data-vial-again data-med="${med}">Mixed a new one</button>
        <button class="secondary small" data-change-vial data-med="${med}">Change vial</button>
      </div>
    </div>`;
  }

  // Mixed a new one: the same recipe saved again today, so its doses left count from today (asks first).
  function mixAgain(med) {
    const vial = vialFor(med);
    if (!vial) return;
    const recipe = vial.vialMg ? `${fmtNum(vial.vialMg, 2)} mg + ${fmtNum(vial.bacMl, 2)} mL` : fmtConc(vial.mgPerMl);
    if (!confirm(`Mixed a new ${recipe} ${medLabel(med)} vial today? Its doses left count again from today.`)) return;
    A.setVial({ ...vial, savedAt: new Date().toISOString() });
    A.save();
    A.renderAll();
  }

  // Change vial: asks first; then start-up info's calculator for this medication, its recipe filled in. Cancel leaves
  // the page as it was.
  function changeVial(med) {
    const old = vialFor(med);
    if (old && !confirm(A.changeVialQuestion(med, old))) return;
    A.renderOneTimeInfo(true);
    A.showDosingFor(med);
    A.openVialEditor(true);
    $("dosingBox").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  Object.assign(A, { vialStatus, vialCard, mixAgain, changeVial });
})(Kyoshi, Kyoshi.apps.bosco);
