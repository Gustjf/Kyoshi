/* Bosco · doses.js — the dose schedule and its confirmation pop-up (#doseOverlay).
 * Upcoming doses aren't stored: they're worked out from each medication's dosing plan whenever they're shown, so any
 * change to a plan moves them. Each medication's fall every intervalDays after its last dose taken (one never logged,
 * the only one taken: any dose's), or from a day its next dose was set to (by postponing it, or as an anchor dose in setup), each the weekly
 * dose spread over the days between doses. None is logged until it's confirmed in the pop-up once due: on its day, or
 * today for a late one taken late (the schedule then counts on from today); with doses of two medications due, the
 * pop-up asks about one, then the next. A due dose waits to be confirmed until it's three intervals old; after that it
 * counts as missed. Each goes to an injection site (also worked out from the log, never stored), every medication's
 * doses in one rotation, in the order they fall: the body parts with a site on take turns, and within a part the
 * doses go on through its sites in its own order (an X), every dose on the other side of the body from the last
 * one and from its part's last one (the governing rule); Developer Mode can skip the next dose's site until a dose is
 * logged, and the pop-up can log it at another. Momo's board shows the doses (agenda). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { addDays, daysBetween, todayStr, now, fmtWeekday, fmtTime } = K.util;
  const { MAX_UPCOMING_DOSES, DOSE_SNOOZE_MS, SITES, PARTS, hasDose, dosesOf, medLabel, planFor, vialFor, eachDoseMg, fmtUnits, fmtDateBrief,
    activeSites, siteLabel, standsFor, partOf, sitesIn } = A;

  // When a dose comes due: its day at the usual dose time (the start of the day
  // without one), on this device's clock.
  function dueAt(date, time) {
    const [h, m] = (time || "00:00").split(":");
    return new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +h, +m).getTime();
  }

  // The day of a medication's last dose taken, "" if none. One never logged, the only one taken (meds: start-up info's,
  // while it's being answered), counts from any dose's, as before there were several: a change of medication keeps the schedule.
  function lastDoseDate(med, meds = A.medications()) {
    const taken = S.entries.filter(e => e.date <= todayStr() && hasDose(e)), own = taken.filter(e => dosesOf(e).some(d => d.medication === med));
    return ((own.length || meds.length > 1 ? own : taken).pop() || { date: "" }).date;
  }
  // The day a plan's next dose was set to, "" once a dose has been logged since.
  const setNextDose = (plan, lastTaken) => (plan && plan.nextDose && lastTaken <= plan.nextDose.after ? plan.nextDose.date : "");
  // Momo's id for a dose: "dose:<date>" for the first medication's (as before there were several), "dose:<med>:<date>" for another's.
  const doseId = (med, date) => (med === A.medications()[0] ? `dose:${date}` : `dose:${med}:${date}`);

  // A site's side of the body, "l" or "r" (an old site's as the one it stands for; null for one from a newer version).
  const sideOf = id => {
    const m = /^[a-z]+-([lr])(-|$)/.exec(standsFor(id) || "");
    return m ? m[1] : null;
  };
  // Where the doses logged with a site went (every medication's, in the order logged): { part: the latest one's body part, side: its side, in: { part: the
  // latest site in each } } (an old site counts as the one it stands for; one from a newer version has no part).
  function lastSites() {
    const last = { part: null, side: null, in: {} };
    S.entries.filter(e => e.date <= todayStr()).flatMap(dosesOf).filter(d => d.site).forEach(d => {
      last.part = partOf(d.site);
      last.side = sideOf(d.site);
      if (last.part) last.in[last.part] = standsFor(d.site);
    });
    return last;
  }
  // How well a dose at a site after `last` keeps the rule governing the rotation (the owner's: never the same side
  // twice running, nor the same side as its body part's last dose): 2, the other side from both; 1, from its part's
  // last only; 0, the same side as its part's last. A site with no side (from a newer version) keeps it.
  const keeps = (last, id) => {
    const side = sideOf(id);
    return !side ? 2 : side === sideOf(last.in[partOf(id)]) ? 0 : side === last.side ? 1 : 2;
  };
  // The next site on in a body part after `after`, in the part's order (starting over after its last;
  // its first one on without `after`), passing over those in `skip` and those `fit` turns down; null while none is.
  function nextSiteIn(part, after, skip = [], fit = () => true) {
    const ids = sitesIn(part), on = activeSites(), from = ids.indexOf(after) + 1;
    return ids.map((_, i) => ids[(from + i) % ids.length]).find(id => on.includes(id) && !skip.includes(id) && fit(id)) || null;
  }
  // Where the dose after `last` (as lastSites says) goes: the next body part after the last dose's (PARTS' order,
  // starting over) with a site on that keeps the rule best (keeps), at that part's next such site. A skip passes over
  // its sites to the next such one (a part with none left gives its turn to the next), but never breaks the rule more:
  // with none left, it's ignored. null while every site is off.
  function nextSite(last, skip = []) {
    const parts = PARTS.map(p => p[0]), from = parts.indexOf(last.part) + 1;
    const find = (best, skip = []) => {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[(from + i) % parts.length], site = nextSiteIn(part, last.in[part], skip, id => keeps(last, id) >= best);
        if (site) return site;
      }
      return null;
    };
    for (const best of [2, 1, 0]) if (find(best)) return find(best, skip) || find(best);
    return null;
  }

  // A medication's schedule: { plan, every, first: its first dose still to take (missed ones passed over), after: its last
  // dose taken, "" if none }; null without days between doses and a weekly dose, or with nothing to count from: no dose
  // taken or set.
  function planned(med) {
    const plan = planFor(med);
    if (!plan || !plan.intervalDays || !plan.weeklyMg) return null;
    const every = plan.intervalDays, after = lastDoseDate(med), set = setNextDose(plan, after);
    if (!after && !set) return null;
    const next = set || addDays(after, every);
    const missed = Math.max(0, Math.floor(daysBetween(next, todayStr()) / every) - MAX_UPCOMING_DOSES + 1);
    return { plan, every, after, first: addDays(next, missed * every) };
  }

  // Each medication's next three doses as { medication, date, doseMg, weeklyMg, due, after, site }, `after` being its
  // last dose taken ("" if none), every medication's in the order they fall (by day, then dose time, then the order
  // the medications are listed in); only those of `med` when given. Their sites go on from one to the next, whichever
  // medication's (one rotation), so they're worked out over every medication's doses up to the last one shown.
  function doseSchedule(med) {
    const meds = A.medications(), runs = meds.map(m => ({ med: m, p: planned(m) })).filter(r => r.p), at = now();
    const end = runs.reduce((d, r) => (addDays(r.p.first, (MAX_UPCOMING_DOSES - 1) * r.p.every) > d ? addDays(r.p.first, (MAX_UPCOMING_DOSES - 1) * r.p.every) : d), "");
    const doses = runs.flatMap(({ med: m, p }) => {
      const out = [], doseMg = eachDoseMg(p.plan.weeklyMg, p.every);
      for (let i = 0, date = p.first; i < MAX_UPCOMING_DOSES || date <= end; i++, date = addDays(date, p.every)) {
        out.push({ medication: m, date, doseMg, weeklyMg: p.plan.weeklyMg, due: at >= dueAt(date, p.plan.doseTime), after: p.after, shown: i < MAX_UPCOMING_DOSES, at: dueAt(date, p.plan.doseTime) });
      }
      return out;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at || meds.indexOf(a.medication) - meds.indexOf(b.medication));
    // Each dose at the site after the one before it; the first passes over the sites skipped for it in
    // Developer Mode (as far as the rule allows).
    const last = lastSites(), skip = S.profile.skipSites || [];
    doses.forEach((d, i) => {
      d.site = nextSite(last, i ? [] : skip);
      if (d.site) {
        last.part = partOf(d.site);
        last.side = sideOf(d.site);
        last.in[last.part] = d.site;
      }
    });
    return doses.filter(d => d.shown && (!med || d.medication === med)).map(({ shown, at: _, ...d }) => d);
  }

  // --- Shared with other apps, read-only (Momo's board, through K.agenda): the doses on days from
  // `from` to `to` (both included) as copies — those logged (done), then every one still to take
  // by each medication's schedule, each at its usual dose time (any time that day without one) for 15 minutes.
  // A dose is known by its day (and medication, but the first's: doseId), so where Momo moved it sticks. ---
  function agenda(from, to) {
    const time = med => { const plan = planFor(med); return (plan && plan.doseTime) || null; };
    const item = (date, doseMg, med, done) => ({ id: doseId(med, date), title: `${medLabel(med)} dose`, date, time: time(med), minutes: 15, note: `${doseMg} mg`, done });
    const out = S.entries.filter(e => e.date >= from && e.date <= to).flatMap(e => dosesOf(e).map(d => item(e.date, d.doseMg, d.medication, true)));
    A.medications().forEach(med => {
      const plan = planFor(med), after = lastDoseDate(med), set = setNextDose(plan, after), every = plan && plan.weeklyMg ? plan.intervalDays : 0;
      if (!every || (!after && !set)) return;
      let date = set || addDays(after, every);
      if (date < from) date = addDays(date, Math.ceil(daysBetween(date, from) / every) * every);
      for (; date <= to; date = addDays(date, every)) {
        if (!out.some(d => d.id === doseId(med, date))) out.push(item(date, eachDoseMg(plan.weeklyMg, every), med, false));
      }
    });
    return out;
  }

  // The same scheduled dose: its medication, day, amount, and the last dose it follows.
  const sameDose = (a, b) => a.medication === b.medication && a.date === b.date && a.doseMg === b.doseMg && a.after === b.after;

  // This device's "Not yet"s: [{ medication, date, until }], one per medication (one { date, until } from before 10.137:
  // the first medication's).
  function snoozes() {
    const v = A.store.json("doseSnooze");
    return (Array.isArray(v) ? v : v && typeof v === "object" ? [{ ...v, medication: A.medications()[0] }] : []).filter(x => x && typeof x === "object");
  }
  const snoozed = dose => snoozes().some(x => x.medication === dose.medication && x.date === dose.date && now() < x.until);

  // Pops up for the first due dose (whichever medication's), unless "Not yet" put it off. An open pop-up
  // stays, kept up to date (a dose due last night is late after midnight), while
  // its dose is still due as shown (it may be a later one, opened from its card),
  // and closes if the schedule moves on meanwhile (say the dose was logged on
  // another device, or the plan changed its amount).
  function promptDueDose(due) {
    const asked = S.doseAsking && due.find(d => sameDose(d, S.doseAsking));
    if (asked) return openDoseModal(asked);
    if (S.doseAsking) closeDoseModal();
    const dose = due.find(d => !snoozed(d));
    if (!dose || K.bugs.isOpen()) return;
    openDoseModal(dose);
  }

  function openDoseModal(dose) {
    const med = dose.medication, time = planFor(med).doseTime, vial = vialFor(med);
    // A site picked for this dose stays picked while the pop-up is kept up to date.
    const picked = S.doseAsking && S.doseAsking.picked && sameDose(S.doseAsking, dose) ? S.doseAsking.site : null;
    S.doseAsking = { ...dose, planned: dose.site, ...(picked ? { site: picked, picked: true } : {}) };
    $("doseModalText").textContent = `Your ${medLabel(med)} dose was due ${fmtWeekday(dose.date)}, ${fmtDateBrief(dose.date)}${time ? ` at ${fmtTime(time)}` : ""}. It goes in your log once you confirm it.`;
    $("doseModalMg").textContent = `${dose.doseMg} mg`;
    $("doseModalUnits").innerHTML = vial ? `<strong>${fmtUnits(dose.doseMg, vial.mgPerMl)}</strong> on a U&#8209;100 syringe` : "";
    $("doseModalUnits").hidden = !vial;
    $("doseModalWeekly").textContent = `${dose.weeklyMg} mg a week`;
    A.showVialBadge("doseModalVial", vial);
    // A late dose (due before today) is logged on the day it was taken: its own
    // day, named (by weekday within the week), or today.
    const daysLate = daysBetween(dose.date, todayStr());
    $("doseLogBtn").textContent = daysLate > 0 ? `Took it ${daysLate < 7 ? fmtWeekday(dose.date) : fmtDateBrief(dose.date)}` : "Log dose";
    $("doseTodayBtn").hidden = !(daysLate > 0);
    renderDoseSite();
    K.modal.open($("doseOverlay"));
    K.refreshSwitcher(); // a dot on Bosco's icon while you're in another app
  }

  // Whether the pop-up can log its dose at a site: the planned one, or one keeping the rule at least as well (keeps).
  const canPick = id => id === S.doseAsking.planned || keeps(lastSites(), id) >= keeps(lastSites(), S.doseAsking.planned);

  // The pop-up's injection site: a menu of the sites that are on, by body part, then the others (those the rule
  // turns down greyed out); hidden while all are off. The menu is only refilled when that changes, so the minute's
  // update can't close it while open.
  let siteMenu = "";
  function renderDoseSite() {
    const site = S.doseAsking.site, on = activeSites(), others = SITES.map(s => s[0]).filter(id => !on.includes(id));
    const option = id => `<option value="${id}"${canPick(id) ? "" : " disabled"}>${siteLabel(id)}</option>`;
    const group = (label, ids) => (ids.length ? `<optgroup label="${label}">${ids.map(option).join("")}</optgroup>` : "");
    const menu = PARTS.map(([part, heading]) => group(heading, sitesIn(part).filter(id => on.includes(id)))).join("") + group("Other", others);
    if (menu !== siteMenu) $("doseSiteSelect").innerHTML = siteMenu = menu;
    $("doseSiteSelect").value = site || "";
    $("doseSiteField").hidden = !site;
  }

  // Another site picked in the pop-up: the dose is logged there, and the rotation goes on from it.
  function pickDoseSite(id) {
    if (S.doseAsking && canPick(id)) Object.assign(S.doseAsking, { site: id, picked: true });
  }

  function closeDoseModal() {
    S.doseAsking = null;
    K.modal.close($("doseOverlay"));
    K.refreshSwitcher();
  }

  // Whether the pop-up's dose is still due just as it shows it. If not (the plan
  // or log changed since it opened), it closes and asks from the schedule as it now stands.
  function stillAsked() {
    if (doseSchedule().some(d => d.due && sameDose(d, S.doseAsking))) return true;
    closeDoseModal();
    A.renderAll();
    return false;
  }

  // Logs the dose as scheduled, on its day or (a late one taken late) today,
  // which moves the schedule on from the day it's logged. Its sites skipped are forgotten.
  function confirmDose(takenToday) {
    if (!S.doseAsking || !stillAsked()) return;
    const date = takenToday ? todayStr() : S.doseAsking.date, doseMg = S.doseAsking.doseMg, site = S.doseAsking.site || null;
    A.setDay(date, { doseMg, medication: S.doseAsking.medication, site }); // that day's weigh-in, and other medications' doses, stay
    S.profile.skipSites = null;
    closeDoseModal();
    A.save();
    S.currentPage = 1;
    A.renderAll();
  }

  // Moves the dose to tomorrow, and the doses after it along with it; nothing is logged.
  function postponeDose() {
    if (!S.doseAsking || !stillAsked()) return;
    const nextDose = { after: S.doseAsking.after, date: addDays(todayStr(), 1) };
    A.setPlan({ ...planFor(S.doseAsking.medication), nextDose, savedAt: new Date().toISOString() });
    closeDoseModal();
    A.save();
    A.renderAll();
  }

  // "Not yet" asks again about this medication's dose in an hour (on this device); another medication's due dose is
  // asked about now. Also what Esc and a click beside the pop-up do.
  function snoozeDose() {
    if (!S.doseAsking) return;
    const { medication, date } = S.doseAsking;
    A.store.set("doseSnooze", JSON.stringify(snoozes().filter(x => x.medication !== medication && now() < x.until).concat({ medication, date, until: now() + DOSE_SNOOZE_MS })));
    closeDoseModal();
    A.renderUpcomingDoses();
  }

  Object.assign(A, {
    dueAt, lastDoseDate, setNextDose, doseId, sideOf, lastSites, keeps, nextSiteIn, nextSite, doseSchedule, agenda, promptDueDose, openDoseModal, pickDoseSite, closeDoseModal, confirmDose, postponeDose, snoozeDose
  });
})(Kyoshi, Kyoshi.apps.bosco);
