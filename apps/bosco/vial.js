/* Bosco · vial.js — each medication's vial card, beside its next dose (the owner's request, 2026-11-25: for planning when
 * to mix the next one, say before a trip): the active vial's strength, mg and BAC water, the day it was mixed (the day it
 * was saved: nothing new is stored), what's left (whole doses and the mg over), the last dose it covers and the dose a new
 * vial is needed by, and when it expires (MEDICATIONS' vialDays from mixing; a dose on that day still counts). Every dose
 * of its medication dated on or after the day mixed comes out of it. Past its expiry, the dates stop there and a warning
 * says how much goes unused. Amber with a dose or none left. A vial saved as "Known mg/mL" has no total: no count, no
 * dates but its expiry. Mixed a new one saves the same recipe again, dated today; Change vial opens start-up info's
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

  // The card, beside the next dose: amber with one dose or none left (or past its expiry).
  function vialCard(med) {
    const v = vialStatus(med);
    if (!v) return "";
    const { vial } = v, line = (label, d) => (d ? `<div class="lbl">${label} <span>${day(d)}</span></div>` : "");
    const expired = !!v.expires && v.expires < todayStr();
    const low = expired || (v.doses !== undefined && (v.usable ?? v.doses) <= 1);
    const left = v.doses === undefined ? (v.leftMg !== undefined ? `<strong>${fmtNum(v.leftMg, 2)} mg left</strong>` : "")
      : v.doses ? `<strong>${v.doses} dose${v.doses === 1 ? "" : "s"} left</strong>${v.overMg ? ` + ${fmtNum(v.overMg, 2)} mg` : ""}`
      : `<strong>Vial used up</strong>${v.leftMg ? `${SEP}${fmtNum(v.leftMg, 2)} mg left` : ""}`;
    const weeks = MEDICATIONS[med].vialDays / 7;
    const warn = expired ? `Expired ${day(v.expires)}, ${weeks} weeks after mixing.`
      : v.wasted ? `Expires ${day(v.expires)}, ${weeks} weeks after mixing: ${fmtNum(v.wasted, 2)} mg will go unused.` : "";
    return `<div class="stat vial-stat${low ? " due" : ""}">
      <div class="val">${fmtConc(vial.mgPerMl)}</div>
      <div class="lbl"><span>${vial.vialMg ? `${fmtNum(vial.vialMg, 2)} mg + ${fmtNum(vial.bacMl, 2)} mL` : "Active vial"}</span></div>
      ${line("Mixed", v.mixed)}
      ${left ? `<div class="dose">${left}</div>` : ""}
      ${line("Last dose", v.last)}${line("New vial by", v.newBy)}${warn ? "" : line("Expires", v.expires)}
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

  // Change vial: start-up info's calculator for this medication (it asks first, over a saved vial).
  function changeVial(med) {
    A.renderOneTimeInfo(true);
    A.showDosingFor(med);
    A.openVialEditor();
    $("dosingBox").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  Object.assign(A, { vialStatus, vialCard, mixAgain, changeVial });
})(Kyoshi, Kyoshi.apps.bosco);
