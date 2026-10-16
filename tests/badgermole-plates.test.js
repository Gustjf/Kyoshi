/* Kyoshi · tests/badgermole-plates.test.js — Badgermole's plate calculator: from Home (with the bar) and from the session's
 * weight (with that weight, hidden for a bodyweight exercise); the plates per side, heaviest first; a weight the plates
 * can't make (the nearest below, and how short), below the bar; − / + by two of the smallest plate; plates turned off and
 * the bar changed, kept through a reload, per unit, and in Export; the diagram's plates; a backup from before it. */
"use strict";
const { eq, ok, has, open, lastDialog, importBackup, exportBackup } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");

const sides = tab => tab.page.locator("#plateSides").innerText();
const total = tab => tab.page.locator("#plateTotal").innerText();
const rects = tab => tab.page.locator("#plateSvg .pc-plate").count();
const typeWeight = async (tab, w) => { await tab.page.fill("#plateTarget", String(w)); };
const openHome = tab => tab.page.click('.home-tools [data-act="plates"]');
const chips = tab => tab.page.$$eval("#plateChips button", els => els.map(e => [e.innerText, e.getAttribute("aria-pressed")].join(":")));

module.exports = [
  {
    name: "plates: Home opens it with the bar; 225 lb is 45, 45; 45s off; closest, below the bar, − / +; kept through a reload",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.setup()); // from before the calculator: settings without bar or plates
      await openHome(tab);
      ok(await p.locator("#plateOverlay").evaluate(el => el.classList.contains("open")), "the pop-up opens");
      eq(await p.inputValue("#plateTarget"), "45", "it opens with the bar's weight");
      eq(await p.inputValue("#plateBar"), "45", "the bar is 45 lb until changed");
      eq(await sides(tab), "Just the bar", "just the bar");
      eq(await rects(tab), 0, "no plates drawn for the bar alone");
      eq(await chips(tab), ["45:true", "35:true", "25:true", "10:true", "5:true", "2.5:true"], "the lb plates, all on");

      await typeWeight(tab, 225);
      eq(await sides(tab), "Per side: 45, 45", "225 lb: two 45s a side");
      has(await total(tab), "225 lb", "the total");
      eq(await rects(tab), 4, "two plates each side of the bar in the diagram");
      await typeWeight(tab, 227);
      eq(await sides(tab), "Per side: 45, 45", "227 lb can't be made: 225 lb");
      has(await total(tab), "Closest: 225 lb — 2 lb short", "closest, and how short");
      await typeWeight(tab, 30);
      eq(await sides(tab), "Just the bar", "below the bar: just the bar");
      eq(await rects(tab), 0, "no plates below the bar");

      // 45s off: 225 lb is the next breakdown.
      await typeWeight(tab, 225);
      await p.click('#plateChips [data-p="45"]');
      eq((await chips(tab))[0], "45:false", "the 45 chip is off");
      eq(await sides(tab), "Per side: 35, 35, 10, 10", "225 lb without 45s");
      eq(await rects(tab), 8, "four plates each side");
      await typeWeight(tab, 226);
      has(await total(tab), "Closest: 225 lb — 1 lb short", "226 lb without 45s");
      // − / + step by two of the smallest plate on (5 lb), from the bar.
      await typeWeight(tab, 225);
      await p.click('.pc-step[data-dir="1"]');
      eq(await p.inputValue("#plateTarget"), "230", "+ adds 5 lb");
      await typeWeight(tab, 227);
      await p.click('.pc-step[data-dir="-1"]');
      eq(await p.inputValue("#plateTarget"), "225", "− goes to the weight below on the steps");
      await p.click('#plateChips [data-p="2.5"]');
      await p.click('#plateChips [data-p="5"]');
      await typeWeight(tab, 105);
      eq(await sides(tab), "Per side: 10, 10, 10", "105 lb without 45s, 5s and 2.5s");
      await p.click('.pc-step[data-dir="1"]');
      eq(await p.inputValue("#plateTarget"), "125", "with 10 the smallest plate, + adds 20 lb");

      // The bar changes with its field being left.
      await p.fill("#plateBar", "35");
      await p.dispatchEvent("#plateBar", "change");
      await typeWeight(tab, 105);
      eq(await sides(tab), "Per side: 35", "105 lb on a 35 lb bar");
      await p.fill("#plateBar", "-3");
      await p.dispatchEvent("#plateBar", "change");
      has(lastDialog(tab), "The bar weighs from 0 to", "a bar below 0 is refused");
      eq(await p.inputValue("#plateBar"), "35", "the bar field goes back to the kept one");

      await p.click("#plateDoneBtn");
      const saved = (await exportBackup(tab)).settings;
      eq([saved.bar, saved.plates.lb, saved.plates.kg.length], [{ lb: 35, kg: 20 }, [35, 25, 10], 7], "the bar and the plates ride in settings (kg untouched)");
      await p.reload();
      await p.waitForFunction(() => Kyoshi.apps.badgermole.started);
      await openHome(tab);
      eq(await p.inputValue("#plateBar"), "35", "the bar survives a reload");
      eq((await chips(tab)).join(), "45:false,35:true,25:true,10:true,5:false,2.5:false", "so do the plates turned off");
      eq(await p.inputValue("#plateTarget"), "35", "opens with the bar");
      await p.click("#plateDoneBtn");
      ok(await p.locator("#plateOverlay").evaluate(el => !el.classList.contains("open")), "Done closes it");
    }
  },
  {
    name: "plates: from the session's weight (not for a bodyweight exercise); kg has its own bar and plates",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.setup());
      await bm.start(tab, "Push");
      await p.click("#weightRow .plate-open");
      eq(await p.inputValue("#plateTarget"), "135", "it opens with the weight in the field");
      eq(await sides(tab), "Per side: 45", "135 lb: one 45 a side");
      await p.click("#plateDoneBtn");
      await p.fill("#weightInput", "187.5");
      await p.click("#weightRow .plate-open");
      eq(await sides(tab), "Per side: 45, 25", "187.5 lb");
      has(await total(tab), "Closest: 185 lb — 2.5 lb short", "187.5 lb needs 1.25s");
      await p.click("#plateDoneBtn");
      await p.click('#exList .ex-chip:has-text("Push-up")');
      ok(await p.locator("#weightRow .plate-open").isHidden(), "no calculator for a bodyweight exercise");
      await p.click('#exList .ex-chip:has-text("Bench press")');
      ok(await p.locator("#weightRow .plate-open").isVisible(), "it's back on a weighted one");

      // kg: its own bar and plates.
      await p.click('[data-act="home"]');
      await bm.openFold(tab, "settings");
      await p.click('#unitToggle [data-unit="kg"]');
      await openHome(tab);
      eq(await p.inputValue("#plateBar"), "20", "the bar is 20 kg in kg");
      eq((await chips(tab)).join(), "25:true,20:true,15:true,10:true,5:true,2.5:true,1.25:true", "the kg plates");
      await typeWeight(tab, 100);
      eq(await sides(tab), "Per side: 25, 15", "100 kg: 25 and 15 a side");
      await typeWeight(tab, 62.5);
      eq(await sides(tab), "Per side: 20, 1.25", "62.5 kg: 20 and 1.25 a side");
      eq(await rects(tab), 4, "the diagram follows");
      await p.click('.pc-step[data-dir="1"]');
      eq(await p.inputValue("#plateTarget"), "65", "kg steps by 2.5 (two 1.25s)");
    }
  },
  {
    name: "plates: damaged settings fall back to the defaults; the solver finds an exact weight where a greedy pass stalls",
    async run(t) {
      const tab = await open(t), p = tab.page;
      const data = gen.setup();
      data.settings = { ...data.settings, bar: { lb: -5, kg: "x" }, plates: { lb: [45, 45, 7, "x", 25], kg: "all" } };
      await importBackup(tab, data);
      const s = await p.evaluate(() => Kyoshi.apps.badgermole.S.settings);
      eq([s.bar, s.plates.lb, s.plates.kg.length], [{ lb: 45, kg: 20 }, [45, 25], 7], "a bad bar is the default, odd plates are dropped, a bad list is all on");
      const r = await p.evaluate(() => Kyoshi.apps.badgermole.solvePlates(150, 0, [45, 25]));
      eq(r, { plates: [25, 25, 25], total: 150, short: 0 }, "75 a side from 45s and 25s (greedy stalls at 45 + 25 + 5 short)");
      const none = await p.evaluate(() => Kyoshi.apps.badgermole.solvePlates(200, 45, []));
      eq(none, { plates: [], total: 45, short: 155 }, "no plates on: the bar");
    }
  }
];
