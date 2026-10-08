/* Kyoshi · tests/bosco-sync.test.js — Bosco's days as two devices sync them (the real sync engine, core/sync.js, given
 * each device's save in turn), part by part (the weigh-in; the dose): a part changed on one device wins over a later
 * save from another that didn't change it, so a corrected weigh-in stays when the other device logs that day's dose; a
 * deleted day stays deleted, and one deleted then weighed in again doesn't get its old dose back; deleting a day deletes
 * only what this device had of it (a dose logged meanwhile on the other device stays, and isn't asked for again); a
 * restored backup sticks on every device; an older copy's save (no stamps, no markers) neither brings a deleted day back
 * nor needs saving back for; an older backup imports as it was. */
"use strict";
const { TODAY, DESKTOP, eq, ok, open, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
// Bosco's days as kept: [date, weight, dose].
const days = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.S.entries.map(e => [e.date, e.weight, e.doseMg]));
// The deleted days' markers: [date, the parts they deleted].
const gone = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.S.gone.map(g => [g.date, ["wu", "du"].filter(k => k in g)]));
const due = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.doseSchedule().some(d => d.due));
// One device's save brought in on another, as a transport does; what happened ("Loaded", "Combined changes with", or null).
async function send(from, to) {
  const raw = await from.page.evaluate(() => Kyoshi.sync.saveOf(Kyoshi.apps.bosco));
  return to.page.evaluate(save => {
    const A = Kyoshi.apps.bosco, r = Kyoshi.sync.incorporate(A, save);
    if (r) Kyoshi.sync.settle(A, r.data);
    return r ? r.what : null;
  }, raw);
}
async function weighIn(tab, date, weight) {
  await tab.page.fill(`${M} #dateInput`, date);
  await tab.page.fill(`${M} #weightInput`, String(weight));
  await tab.page.click(`${M} #addBtn`);
}
const remove = (tab, date) => tab.page.click(`${M} #historyBody button[data-date="${date}"]`);
// Two devices with the same data: the first imports it, the second takes the first's save.
async function pair(t, backup) {
  const a = await open(t, { app: "bosco", size: DESKTOP }), b = await open(t, { app: "bosco", size: DESKTOP });
  await importBackup(a, backup);
  if (await a.page.locator(`${M} #doseOverlay.open`).count()) await a.page.keyboard.press("Escape"); // a dose due: Not yet, here
  eq(await send(a, b), "Loaded", "the second device takes the first's data");
  eq(await days(b), await days(a), "the same days");
  return [a, b];
}

module.exports = [
  {
    name: "bosco sync: a weigh-in corrected offline wins over a later save, the other device's dose that day kept; deleted days stay deleted",
    async run(t) {
      // A dose due today; doses a week and two weeks ago; four weigh-ins, today's too.
      const [a, b] = await pair(t, gen.bosco({ lastDose: D(-7), doses: 2, weights: [{ date: D(-3), weight: 190 }, { date: D(-2), weight: 189.5 }, { date: D(-1), weight: 189 }, { date: TODAY, weight: 190 }] }));
      // Device A, offline: two weigh-ins corrected, a day deleted, a dose day deleted and weighed in again.
      await weighIn(a, D(-2), 188);
      await weighIn(a, TODAY, 188.4);
      await remove(a, D(-3));
      await remove(a, D(-14));
      await weighIn(a, D(-14), 192);
      // Device B, later: today's dose logged (its copy of the day still says 190), a weigh-in on a day A never had.
      await b.ctx.clock.fastForward(5 * 60000);
      await b.page.click(`${M} #doseLogBtn`);
      await weighIn(b, D(-4), 190.2);

      eq(await send(b, a), "Combined changes with", "A combines B's save");
      const want = [[D(-14), 192, null], [D(-7), null, 5], [D(-4), 190.2, null], [D(-2), 188, null], [D(-1), 189, null], [TODAY, 188.4, 5]];
      eq(await days(a), want, "A's corrections kept over B's later save (today's with B's dose); the deleted days stay deleted, D-14's dose too");
      eq(await gone(a), [[D(-14), ["du"]], [D(-3), ["wu"]]], "each marker names what it deleted");
      eq(await send(a, b), "Loaded", "B is behind: it takes A's");
      eq([await days(b), await gone(b)], [want, [[D(-14), ["du"]], [D(-3), ["wu"]]]], "the same on B");
      eq(await send(b, a), null, "nothing more to bring in");
      const back = await exportBackup(a);
      eq(back.gone.map(g => g.date), [D(-14), D(-3)], "Export carries the markers");

      // An older copy's save (no stamps, no markers): the same days need nothing saved back for it; one that still has a
      // deleted day doesn't bring it back here (and is told: not the same).
      const older = extra => a.page.evaluate(([day]) => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
        delete raw.gone;
        raw.entries.forEach(e => { delete e.wu; delete e.du; });
        if (day) raw.entries.push({ date: day, weight: 190, doseMg: null, medication: null });
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return [c.same, changed];
      }, [extra]);
      eq(await older(null), [true, false], "an older copy's save of the same days: nothing to save back, nothing changes");
      eq(await older(D(-3)), [false, false], "one that still has a deleted day: it stays deleted here");
      eq(await days(a), want, "unchanged");
    }
  },
  {
    name: "bosco sync: deleting a day deletes only what this device had of it — a dose logged meanwhile elsewhere stays, and isn't asked for again",
    async run(t) {
      // Today's dose due; doses one, two and three weeks ago.
      const [a, b] = await pair(t, gen.bosco({ lastDose: D(-7), doses: 3 }));
      // A weighs in today; B, not synced, logs today's dose; then A deletes its weigh-in (it never saw the dose).
      await weighIn(a, TODAY, 188.4);
      await b.ctx.clock.fastForward(2 * 60000);
      await b.page.click(`${M} #doseLogBtn`);
      await a.ctx.clock.fastForward(5 * 60000);
      await remove(a, TODAY);
      // A deletes the dose of three weeks ago; B, not synced, weighs in that day.
      await remove(a, D(-21));
      await weighIn(b, D(-21), 191);

      eq(await send(b, a), "Combined changes with", "A combines B's save");
      const want = [[D(-21), 191, null], [D(-14), null, 5], [D(-7), null, 5], [TODAY, null, 5]];
      eq(await days(a), want, "today's dose from B stays (only A's weigh-in went); D-21's dose stays deleted, B's weigh-in there kept");
      eq(await send(a, b), "Loaded", "B takes A's");
      eq(await days(b), want, "the same on B");
      eq([await due(a), await due(b)], [false, false], "today's dose isn't asked for again on either");
    }
  },
  {
    name: "bosco sync: a restored backup sticks on every device, even one with a change of its own not synced yet",
    async run(t) {
      const [a, b] = await pair(t, gen.bosco({ doses: 2, weights: [{ date: D(-3), weight: 190 }, { date: D(-1), weight: 189 }] }));
      const backup = await exportBackup(a);
      await remove(a, D(-3));
      eq(await send(a, b), "Loaded", "B takes the deletion");
      eq(await gone(b), [[D(-3), ["wu"]]], "with its marker");
      await weighIn(b, D(-2), 189.5); // B's own change, not synced yet
      await a.ctx.clock.fastForward(60000);
      await importBackup(a, backup); // A restores the day
      eq(await send(a, b), "Combined changes with", "B combines A's restore with its own change");
      const want = [[D(-12), null, 5], [D(-5), null, 5], [D(-3), 190, null], [D(-2), 189.5, null], [D(-1), 189, null]];
      eq(await days(b), want, "the restored day is back on B, B's weigh-in kept");
      eq(await send(b, a), "Loaded", "A takes B's");
      eq(await days(a), want, "and stays on A");
      eq(await send(a, b), null, "nothing more to bring in");
    }
  },
  {
    name: "bosco sync: an older backup (no stamps, no markers) imports as it was, its days stamped as a change made here",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP });
      const old = gen.bosco({ weights: [{ date: D(-1), weight: 189 }] });
      await importBackup(tab, old);
      const back = await exportBackup(tab);
      eq(back.entries.map(e => [e.date, e.weight, e.doseMg]), old.entries.map(e => [e.date, e.weight, e.doseMg]), "its days as they were");
      ok(back.entries.every(e => (e.weight === null || e.wu > 0) && (e.doseMg === null || e.du > 0)), "each part stamped");
      eq(back.gone, [], "no markers");
    }
  }
];
