/* Kyoshi · tests/signals.test.js — where you stand, per app (roadmap Phase 8): the dots when you're behind (Badgermole when
 * today's workout is needed for the week's target, Turtleduck when today or tomorrow has no dinner, Pabu for anyone
 * overdue, Iroh for a goal more than a week behind or an overdue meeting), Iroh's meetings counting only once Iroh is
 * used, Appa's recorded job ✓ on its day's card (and a job due after the window kept out), and the small fixes: "Open in
 * <App>" from the card editor asks before dropping an edit, an event at any time of day adds no hours, and an import's
 * question names the backup's date and how much newer what's here is. */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, lacks, open, switchTo, importBackup, exportBackup, addDays, at, lastDialog } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");
const bm = require("./badgermole");
const td = require("./turtleduck");

const D = n => addDays(TODAY, n);
const inbox = tab => tab.page.evaluate(([from, to]) => Kyoshi.inbox(from, to).map(n => `${n.app}:${n.id}`), [D(-2), D(11)]);
const why = (tab, id) => tab.page.evaluate(x => { const A = Kyoshi.apps[x]; return (A.attention ? A.attention() : "") || Kyoshi.meetings.attention(A); }, id);

module.exports = [
  {
    name: "signals: Iroh's meetings count only once it's used; then its dot comes for an overdue meeting",
    async run(t) {
      const tab = await open(t, { app: "iroh", size: DESKTOP }), p = tab.page;
      eq((await inbox(tab)).filter(k => k.startsWith("iroh:")), [], "an Iroh never used asks Momo for nothing");
      eq(await why(tab, "iroh"), "", "and has no dot");
      // An older copy's start (seen before Iroh was used) is let go, so it can't be overdue from then.
      await p.evaluate(() => Kyoshi.apps.iroh.store.set("meetings", JSON.stringify({ reconcile: { every: "month", minutes: 20, last: "", since: "2026-08-01", u: 0 } })));
      await p.reload();
      await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
      eq(await p.evaluate(() => Kyoshi.apps.iroh._meet.reconcile.since), "", "no start while it isn't used");
      eq(await why(tab, "iroh"), "", "still no dot");

      // An area: Iroh is used, and its meetings start today.
      await importBackup(tab, gen.iroh({ areas: [{ id: "a1", name: "Health" }] }));
      eq((await inbox(tab)).filter(k => k.startsWith("iroh:")), ["iroh:meeting:reconcile:2026-09-30", "iroh:meeting:season:2026-09-30", "iroh:meeting:year:2026-09-30"], "its meetings, wanted from today");
      eq(await p.evaluate(() => Kyoshi.apps.iroh._meet.reconcile.since), TODAY, "they count from today");
      eq(await why(tab, "iroh"), "", "not overdue today");
      await p.evaluate(() => Kyoshi.dev.travel(1));
      eq(await why(tab, "iroh"), "its meeting is overdue", "overdue tomorrow: the dot");
    }
  },
  {
    name: "signals: Badgermole dots when today's workout is needed for the week's target, and clears once one is logged",
    async run(t) {
      // Saturday, one workout this week of three: two left, two days to go.
      const tab = await open(t, { size: DESKTOP, time: at(D(3)) }), p = tab.page;
      await importBackup(tab, gen.history({ weeks: 2, thisWeek: 1 }));
      eq(await why(tab, "badgermole"), "today's workout keeps this week's 3 (2 workouts left, 2 days to go)", "Saturday: today's is needed");
      await switchTo(tab, "momo");
      has((await mo.dots(tab)).badgermole, "today's workout keeps this week's 3", "the dot in the switcher");
      await switchTo(tab, "badgermole");
      await bm.doSession(tab, "Pull");
      eq(await why(tab, "badgermole"), "", "logged today: no dot");
      await p.evaluate(() => Kyoshi.dev.travel(1));
      eq(await why(tab, "badgermole"), "today's workout keeps this week's 3 (1 workout left, 1 day to go)", "Sunday, one to go: the dot again");
      await p.evaluate(() => Kyoshi.dev.travel(1));
      eq(await why(tab, "badgermole"), "", "a new week, with seven days for three");
    }
  },
  {
    name: "signals: Turtleduck dots while today or tomorrow has no dinner; Pabu for anyone overdue",
    async run(t) {
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      eq(await why(tab, "turtleduck"), "", "unused: no dot");
      await importBackup(tab, gen.turtleduck({ plan: [{ date: TODAY, meal: "dinner", recipeId: "rc-chili" }] }));
      eq(await why(tab, "turtleduck"), "no dinner planned tomorrow", "tomorrow has no dinner");
      await td.view(tab, "plan");
      await td.dragRecipe(tab, "rc-salad", D(1), "dinner");
      eq(await why(tab, "turtleduck"), "", "planned: no dot");
      await switchTo(tab, "pabu");
      await importBackup(tab, gen.pabu());
      eq(await why(tab, "pabu"), "3 people overdue", "Gran, Mom and Ana");
    }
  },
  {
    name: "signals: Appa's job recorded today shows ✓ on today's card; one due after the window stays out of Momo",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP }), p = tab.page;
      const world = gen.appaWorld({
        things: [{ id: "car1", name: "Car" }],
        jobs: [
          { id: "wash1", thingId: "car1", name: "Wash", every: [1, "m"], from: { date: D(-30) }, est: 20 },     // due today, recorded today
          { id: "oil1", thingId: "car1", name: "Oil change", every: [1, "m"], from: { date: D(-25) }, est: 30 }, // due Oct 5
          { id: "gut1", thingId: "car1", name: "Gutters", every: [1, "m"], from: { date: D(-17) }, est: 60 }     // due Oct 13: after next Sunday
        ]
      });
      world.records.push({ id: "rec1", thingId: "car1", date: TODAY, reading: null, title: "", jobs: [{ jobId: "wash1", name: "Wash", minutes: 20, timed: false }], by: "", cost: null, notes: "", files: [], links: [], deleted: false, at: at(TODAY), u: at(TODAY) });
      await importBackup(tab, world);
      eq(await inbox(tab), ["appa:oil1", "appa:done:rec1:wash1"], "the oil change due Monday, the wash done today; the gutters (Oct 13) wait");
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(0), title: "Car maintenance", hours: 0.5 }, { date: D(2), title: "Car maintenance", hours: 1 }]));
      const cards = await p.$$eval("#kMount #board .card[data-id^='card-']", els => els.map(e => e.getAttribute("aria-label").replace(/, [\d.]+[hm]\b.*$/, "")));
      eq(cards, ["Car maintenance (Wash from Appa — done ✓)", "Car maintenance (Oil change from Appa)"], "✓ on today's card, the oil change on Friday's");
      // Open in Appa on the done one: its record.
      await mo.openCard(tab, "card-0");
      await mo.openInApp(tab, "appa", "done:rec1:wash1");
      await p.waitForSelector("#kMount #recOverlay.open");
      eq(await p.locator("#kMount #rcTitle").innerText(), "Record", "the record pop-up");
    }
  },
  {
    name: "signals: Open in <App> from the card editor asks before dropping an edit; an any-time event adds no hours",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.pabu()); // Kai's birthday tomorrow: at any time of day
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(0), title: "Keep in touch", hours: 1 }]));
      eq((await mo.days(tab))[3].total, 0, "Thursday: Kai's birthday adds no hours");
      has(JSON.stringify((await mo.days(tab))[3].marks), "Kai's birthday", "but it's there, in the heading");

      await mo.openCard(tab, "card-0");
      await p.fill("#kMount #cardHours", "2");
      tab.answers.push(false); // "Discard your changes?" No.
      await p.click('#kMount #cardFrom a[data-app="pabu"] >> nth=0');
      eq(lastDialog(tab), "Discard your changes to this card?", "asked first");
      ok(await p.evaluate(() => Kyoshi.active().id === "momo" && document.querySelector("#kMount #cardOverlay").classList.contains("open")), "kept: still editing, in Momo");
      tab.answers.push(true);
      await p.click('#kMount #cardFrom a[data-app="pabu"] >> nth=0');
      await p.waitForFunction(() => Kyoshi.active().id === "pabu");
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.weeks["2026-09-28"].cards[0].hours), 1, "the edit was dropped, as asked");
    }
  },
  {
    name: "signals: an import's question names the backup's date and how much newer what's here is",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([{ text: "Buy stamps" }]));
      const back = await exportBackup(tab);
      ok(typeof back.savedAt === "string" && back.savedAt.startsWith("2026-09-30T07:"), "a backup says when it was made");
      // Two days on, an errand added here: the backup is now two days older than what's here.
      await tab.ctx.clock.fastForward(2 * 86400000);
      await p.fill("#kMount #addText", "Get a key cut");
      await p.press("#kMount #addText", "Enter");
      await importBackup(tab, back);
      const asked = lastDialog(tab);
      has(asked, "Replace your 2 errands with the 1 errand in this backup? This backup is from Sep 30, 2026, 7:00 AM. What's here is 2 days newer (last changed Oct 2, 2026, 7:", "the date, and how much newer");
      has(asked, "This can't be undone.", "and that it can't be undone");
      // Import all says it too.
      await p.click("#kDevBadge");
      const [download] = await Promise.all([p.waitForEvent("download"), p.click("#kDevExportAll")]);
      const all = JSON.parse(require("fs").readFileSync(await download.path(), "utf8"));
      ok(all.apps.hawky.savedAt, "each app's part is dated too");
      const fresh = await open(t, { app: "hawky", size: DESKTOP });
      await importBackup(fresh, gen.hawkyItems([{ text: "Old one" }]));
      await fresh.page.click("#kDevBadge");
      const [chooser] = await Promise.all([fresh.page.waitForEvent("filechooser"), fresh.page.click("#kDevImportAll")]);
      await chooser.setFiles({ name: "kyoshi-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(all)) });
      await fresh.page.waitForTimeout(200);
      has(fresh.dialogs.map(d => d[1]).join(" | "), "with this backup? This backup is from Oct 2, 2026", "Import all names the backup's date");
      lacks(fresh.dialogs.map(d => d[1]).join(" | "), "undefined", "and nothing odd");
    }
  }
];
