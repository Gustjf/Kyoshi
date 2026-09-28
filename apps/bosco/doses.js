/* Bosco · doses.js — the dose schedule and its confirmation pop-up (#doseOverlay).
 * Upcoming doses aren't stored: they're worked out from the current medication's
 * dosing plan whenever they're shown, so any change to the plan moves them. One
 * falls every intervalDays after the last dose taken, or from a day the next dose
 * was set to (by postponing it, or as an anchor dose in setup), each the weekly
 * dose spread over the days between doses. None is logged until it's confirmed in
 * the pop-up once due: on its day, or today for a late one taken late (the
 * schedule then counts on from today). A due dose waits to be confirmed until it's
 * three intervals old; after that it counts as missed. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { addDays, daysBetween, todayStr, now, fmtWeekday, fmtTime } = K.util;
  const { MAX_UPCOMING_DOSES, DOSE_SNOOZE_MS, hasDose, byDate, medLabel, planFor, eachDoseMg, fmtUnits, fmtDateBrief } = A;

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

  // The next three doses as { date, doseMg, weeklyMg, due, after }, `after` being
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
    return Array.from({ length: MAX_UPCOMING_DOSES }, (_, i) => {
      const date = addDays(next, (missed + i) * every);
      return { date, doseMg: eachDoseMg(plan.weeklyMg, every), weeklyMg: plan.weeklyMg, due: at >= dueAt(date, plan.doseTime), after };
    });
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
    S.doseAsking = dose;
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
    K.modal.open($("doseOverlay"));
    K.refreshSwitcher(); // a dot on Bosco's icon while you're in another app
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
  // which moves the schedule on from the day it's logged.
  function confirmDose(takenToday) {
    if (!S.doseAsking || !stillAsked()) return;
    const date = takenToday ? todayStr() : S.doseAsking.date, doseMg = S.doseAsking.doseMg, existing = S.entries.find(e => e.date === date);
    if (existing) {
      Object.assign(existing, { doseMg, medication: A.currentMedication() });
    } else {
      S.entries.push({ date, weight: null, doseMg, medication: A.currentMedication() });
      S.entries.sort(byDate);
    }
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

  Object.assign(A, { lastDoseDate, setNextDose, doseSchedule, promptDueDose, openDoseModal, closeDoseModal, confirmDose, postponeDose, snoozeDose });
})(Kyoshi, Kyoshi.apps.bosco);
