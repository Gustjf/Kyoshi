/* Kyoshi · tests/shell.test.js — the whole of Kyoshi, every app: each opens through the switcher with a clean console
 * at phone and desktop width (and after a week of time travel), the switcher lists every app in order, a new device
 * opens on the first, and Export all / Import all (Developer Mode) carry every app's data. */
"use strict";
const fs = require("fs");
const { PHONE, DESKTOP, eq, ok, has, open, switchTo, importBackup, travel } = require("./lib");
const gen = require("./generate");

module.exports = [
  {
    name: "shell: every app opens with a clean console, on a phone and a computer, and after time travel",
    async run(t) {
      for (const size of [PHONE, DESKTOP]) {
        const tab = await open(t, { size }), p = tab.page, order = await p.evaluate(() => Kyoshi.order.slice());
        await importBackup(tab, gen.history({ weeks: 3, thisWeek: 1 }));
        for (const id of order) {
          await switchTo(tab, id);
          eq(await p.evaluate(() => Kyoshi.active().started), true, `${id} started`);
          ok((await p.locator("#kMount").innerText()).length > 20, `${id} drew its page`);
        }
        await travel(tab, 7);
        for (const id of order) await switchTo(tab, id);
        const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        ok(wide <= 1, `no sideways scrolling at ${size.width}px (${wide}px over)`);
      }
    }
  },
  {
    name: "shell: the switcher lists every app in order; a new device opens on the first",
    async run(t) {
      const tab = await open(t, { app: "" }), p = tab.page, order = await p.evaluate(() => Kyoshi.order.slice());
      eq(await p.evaluate(() => Kyoshi.active().id), order[0], "a new device opens on the first app");
      ok(order.includes("badgermole"), "Badgermole is one of them");
      await p.click("#kSwitchBtn");
      eq(await p.$$eval("#kSwitchMenu [data-app]", els => els.map(e => e.dataset.app)), order, "the switcher's order");
      await p.click("#kSwitchBtn");
    }
  },
  {
    name: "shell: the header keeps one width, so the switcher and Theme stay put between a wide app and a narrow one",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      // Where the app's name, the switcher and Theme start, in whole pixels.
      const where = () => p.evaluate(() => ["kAppName", "kSwitchBtn", "kThemeToggle"].map(id => Math.round(document.getElementById(id).getBoundingClientRect().left)));
      const momo = await where();
      for (const id of ["hawky", "badgermole", "turtleduck"]) {
        await switchTo(tab, id);
        eq(await where(), momo, `${id}'s header sits where Momo's does`);
      }
      await p.setViewportSize({ width: 1000, height: 800 });
      const narrower = await where();
      await switchTo(tab, "momo");
      eq(await where(), narrower, "and in a narrower window too");
    }
  },
  {
    name: "shell: Export all and Import all carry Badgermole with the other apps",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.history({ weeks: 5 }));
      await p.click("#kDevBadge");
      const [download] = await Promise.all([p.waitForEvent("download"), p.click("#kDevExportAll")]);
      const all = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
      eq(all.apps.badgermole.sessions.filter(s => !s.deleted).length, 15, "Export all holds Badgermole's sessions");
      ok(Array.isArray(all.apps.badgermole.meetings) || typeof all.apps.badgermole.meetings === "object", "and its checkup");
      const fresh = await open(t);
      await fresh.page.click("#kDevBadge");
      const [chooser] = await Promise.all([fresh.page.waitForEvent("filechooser"), fresh.page.click("#kDevImportAll")]);
      await chooser.setFiles({ name: "kyoshi-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(all)) });
      await fresh.page.waitForTimeout(300);
      has(fresh.dialogs.map(d => d[1]).join(" | "), "Badgermole", "Import all names Badgermole");
      eq(await fresh.page.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 15, "Import all brought the sessions in");
      // Badgermole's part of an Export all file also works in its own Import JSON.
      const third = await open(t);
      await importBackup(third, all);
      eq(await third.page.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 15, "Import JSON takes its part of an Export all file");
    }
  }
];
