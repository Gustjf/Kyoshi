/* Kyoshi · tests/bosco-sync.test.js — Bosco's days as two devices sync them (the real sync engine, core/sync.js, given
 * each device's save in turn): a day changed on one device wins over a later save from another that didn't change it;
 * a weigh-in from one and a dose from the other on the same day both stay; a deleted day stays deleted, and one deleted
 * then weighed in again doesn't get its old dose back; an older copy's save (no stamps, no markers) neither brings a
 * deleted day back nor needs saving back for; an older backup imports as it was. */
"use strict";
const { TODAY, DESKTOP, eq, ok, open, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);
// Bosco's days as kept: [date, weight, dose].
const days = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.S.entries.map(e => [e.date, e.weight, e.doseMg]));
const gone = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.S.gone.map(g => g.date));
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

module.exports = [
  {
    name: "bosco sync: a day changed offline wins over a later save; a weigh-in and a dose from two devices both stay; deleted days stay deleted",
    async run(t) {
      const a = await open(t, { app: "bosco", size: DESKTOP }), b = await open(t, { app: "bosco", size: DESKTOP });
      // A dose due today; doses a week and two weeks ago; three weigh-ins.
      await importBackup(a, gen.bosco({ lastDose: D(-7), doses: 2, weights: [{ date: D(-3), weight: 190 }, { date: D(-2), weight: 189.5 }, { date: D(-1), weight: 189 }] }));
      await a.page.keyboard.press("Escape"); // today's dose: Not yet, here
      eq(await send(a, b), "Loaded", "the second device takes the first's data");
      const start = await days(a);
      eq(await days(b), start, "the same days");

      // Device A, offline: a weigh-in corrected, today's added, a day deleted, a dose day deleted and weighed in again.
      await weighIn(a, D(-2), 188);
      await weighIn(a, TODAY, 188.4);
      await remove(a, D(-3));
      await remove(a, D(-14));
      await weighIn(a, D(-14), 192);
      // Device B, later: today's dose logged, a weigh-in on a day A never had. Its save is the newer one.
      await b.ctx.clock.fastForward(5 * 60000);
      await b.page.click(`${M} #doseLogBtn`);
      await weighIn(b, D(-4), 190.2);

      eq(await send(b, a), "Combined changes with", "A combines B's save");
      const want = [[D(-14), 192, null], [D(-7), null, 5], [D(-4), 190.2, null], [D(-2), 188, null], [D(-1), 189, null], [TODAY, 188.4, 5]];
      eq(await days(a), want, "A's correction kept over B's later save; today's weigh-in and dose together; the deleted days stay deleted, the dose deleted with D-14 too");
      eq(await gone(a), [D(-14), D(-3)], "the deleted days' markers kept");
      eq(await send(a, b), "Loaded", "B is behind: it takes A's");
      eq([await days(b), await gone(b)], [want, [D(-14), D(-3)]], "the same on B");
      eq(await send(b, a), null, "nothing more to bring in");
      const back = await exportBackup(a);
      eq([back.gone.map(g => g.date), back.entries.filter(e => e.u).map(e => e.date)], [[D(-14), D(-3)], [D(-14), D(-4), D(-2), TODAY]], "Export carries the markers and the changed days' stamps");

      // An older copy's save (no stamps, no markers): the same days need nothing saved back for it; one that still has a
      // deleted day doesn't bring it back here (and is told: not the same).
      const older = back3 => a.page.evaluate(([day]) => {
        const A = Kyoshi.apps.bosco, raw = JSON.parse(JSON.stringify(A.data.build()));
        delete raw.gone;
        raw.entries.forEach(e => delete e.u);
        if (day) raw.entries.push({ date: day, weight: 190, doseMg: null, medication: null });
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return [c.same, changed];
      }, [back3]);
      eq(await older(null), [true, false], "an older copy's save of the same days: nothing to save back, nothing changes");
      eq(await older(D(-3)), [false, false], "one that still has a deleted day: it stays deleted here");
      eq(await days(a), want, "unchanged");
    }
  },
  {
    name: "bosco sync: an older backup (no stamps, no markers) imports as it was, and exports with none",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(tab, gen.bosco({ weights: [{ date: D(-1), weight: 189 }] }));
      const back = await exportBackup(tab);
      eq(back.gone, [], "no markers");
      ok(back.entries.length === 5 && back.entries.every(e => !("u" in e)), "its days as they were, unstamped");
    }
  }
];
