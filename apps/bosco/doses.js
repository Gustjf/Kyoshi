/* Bosco · doses.js — the dose schedule and its confirmation pop-up (#doseOverlay).
 * Upcoming doses aren't stored: they're worked out from the current medication's
 * dosing plan whenever they're shown, so any change to the plan moves them. One
 * falls every intervalDays after the last dose taken, or from a day the next dose
 * was set to (by postponing it, or as an anchor dose in setup), each the weekly
 * dose spread over the days between doses. None is logged until it's confirmed in
 * the pop-up once due: on its day, or today for a late one taken late (the
 * schedule then counts on from today). A due dose waits to be confirmed until it's
 * three intervals old; after that it counts as missed. Each goes to an injection site (also worked
 * out from the log, never stored): the body parts with a site on take turns, and within a part the
 * doses go on through its sites in its own order (an X), every dose on the other side of the body from the last
 * one and from its part's last one (the governing rule); Developer Mode can skip the next dose's
 * site until a dose is logged, and the pop-up can log it at another. Momo's board shows the doses (agenda). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { addDays, daysBetween, todayStr, now, fmtWeekday, fmtTime } = K.util;
  const { MAX_UPCOMING_DOSES, DOSE_SNOOZE_MS, SITES, PARTS, hasDose, medLabel, planFor, eachDoseMg, fmtUnits, fmtDateBrief,
    activeSites, siteLabel, standsFor, partOf, sitesIn } = A;

  // When a dose comes due: its day at the usual dose time (the start of the day
  // without one), on this device's clock.
  function dueAt(date, time) {
    const [h, m] = (time || "00:00").split(":");
    return new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +h, +m).getTime();
  }

  // The day of the last dose taken, "" if none.
  const lastDoseDate = () => S.entries.filter(e => hasDose(e) && e.date <= todayStr()).map(e => e.date).pop() || "";
  // The day a plan's next dose was set to, "" once a dose has been logged since.
  const setNextDose = (plan, lastTaken) => (plan && plan.nextDose && lastTaken <= plan.nextDose.after ? plan.nextDose.date : "");

  // A site's side of the body, "l" or "r" (an old site's as the one it stands for; null for one from a newer version).
  const sideOf = id => {
    const m = /^[a-z]+-([lr])(-|$)/.exec(standsFor(id) || "");
    return m ? m[1] : null;
  };
  // Where the doses logged with a site went: { part: the latest one's body part, side: its side, in: { part: the
  // latest site in each } } (an old site counts as the one it stands for; one from a newer version has no part).
  function lastSites() {
    const last = { part: null, side: null, in: {} };
    S.entries.filter(e => hasDose(e) && e.site && e.date <= todayStr()).forEach(e => {
      last.part = partOf(e.site);
      last.side = sideOf(e.site);
      if (last.part) last.in[last.part] = standsFor(e.site);
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

  // The next three doses as { date, doseMg, weeklyMg, due, after, site }, `after` being
  // the last dose taken ("" if none). None without days between doses and a
  // weekly dose, or with nothing to count from: no dose taken or set.
  function doseSchedule() {
    const plan = A.medicationEnabled() ? planFor(A.currentMedication()) : null;
    if (!plan || !plan.intervalDays || !plan.weeklyMg) return [];
    const today = todayStr(), every = plan.intervalDays, at = now();
    const after = lastDoseDate(), set = setNextDose(plan, after);
    if (!after && !set) return [];
    const next = set || addDays(after, every);
    const missed = Math.max(0, Math.floor(daysBetween(next, today) / every) - MAX_UPCOMING_DOSES + 1);
    // Each dose at the site after the one before it; the first passes over the sites skipped for it in
    // Developer Mode (as far as the rule allows).
    const last = lastSites(), skip = S.profile.skipSites || [];
    return Array.from({ length: MAX_UPCOMING_DOSES }, (_, i) => {
      const date = addDays(next, (missed + i) * every);
      const site = nextSite(last, i ? [] : skip);
      if (site) {
        last.part = partOf(site);
        last.side = sideOf(site);
        last.in[last.part] = site;
      }
      return { date, doseMg: eachDoseMg(plan.weeklyMg, every), weeklyMg: plan.weeklyMg, due: at >= dueAt(date, plan.doseTime), after, site };
    });
  }

  // --- Shared with other apps, read-only (Momo's board, through K.agenda): the doses on days from
  // `from` to `to` (both included) as copies — those logged (done), then every one still to take
  // by the schedule, each at the usual dose time (any time that day without one) for 15 minutes.
  // A dose is known by its day, so where Momo moved it sticks. ---
  function agenda(from, to) {
    const plan = A.medicationEnabled() ? planFor(A.currentMedication()) : null, time = (plan && plan.doseTime) || null;
    const item = (date, doseMg, med, done) => ({ id: `dose:${date}`, title: `${medLabel(med)} dose`, date, time, minutes: 15, note: `${doseMg} mg`, done });
    const out = S.entries.filter(e => hasDose(e) && e.date >= from && e.date <= to).map(e => item(e.date, e.doseMg, e.medication, true));
    const after = lastDoseDate(), set = setNextDose(plan, after), every = plan && plan.weeklyMg ? plan.intervalDays : 0;
    if (!every || (!after && !set)) return out;
    let date = set || addDays(after, every);
    if (date < from) date = addDays(date, Math.ceil(daysBetween(date, from) / every) * every);
    for (; date <= to; date = addDays(date, every)) {
      if (!out.some(d => d.date === date)) out.push(item(date, eachDoseMg(plan.weeklyMg, every), A.currentMedication(), false));
    }
    return out;
  }

  // The same scheduled dose: its day, amount, and the last dose it follows.
  const sameDose = (a, b) => a.date === b.date && a.doseMg === b.doseMg && a.after === b.after;

  // Pops up for the first due dose, unless "Not yet" put it off. An open pop-up
  // stays, kept up to date (a dose due last night is late after midnight), while
  // its dose is still due as shown (it may be a later one, opened from its card),
  // and closes if the schedule moves on meanwhile (say the dose was logged on
  // another device, or the plan changed its amount).
  function promptDueDose(due) {
    const asked = S.doseAsking && due.find(d => sameDose(d, S.doseAsking));
    if (asked) return openDoseModal(asked);
    if (S.doseAsking) closeDoseModal();
    const dose = due[0];
    if (!dose || K.bugs.isOpen()) return;
    const snooze = A.store.json("doseSnooze");
    if (snooze && snooze.date === dose.date && now() < snooze.until) return;
    openDoseModal(dose);
  }

  function openDoseModal(dose) {
    const med = A.currentMedication(), time = planFor(med).doseTime, vial = A.activeVial();
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
    A.setDay(date, { doseMg, medication: A.currentMedication(), site }); // that day's weigh-in stays
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
    S.profile.dosePlan = { ...planFor(A.currentMedication()), nextDose, savedAt: new Date().toISOString() };
    closeDoseModal();
    A.save();
    A.renderAll();
  }

  // "Not yet" asks again in an hour (on this device). Also what Esc and a click beside the pop-up do.
  function snoozeDose() {
    if (!S.doseAsking) return;
    A.store.set("doseSnooze", JSON.stringify({ date: S.doseAsking.date, until: now() + DOSE_SNOOZE_MS }));
    closeDoseModal();
  }

  Object.assign(A, {
    dueAt, lastDoseDate, setNextDose, sideOf, lastSites, keeps, nextSiteIn, nextSite, doseSchedule, agenda, promptDueDose, openDoseModal, pickDoseSite, closeDoseModal, confirmDose, postponeDose, snoozeDose
  });
})(Kyoshi, Kyoshi.apps.bosco);
