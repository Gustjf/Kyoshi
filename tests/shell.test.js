/* Kyoshi · tests/shell.test.js — the whole of Kyoshi, every app: each opens through the switcher with a clean console
 * at phone and desktop width (and after a week of time travel), the switcher lists every app in order, a new device
 * opens on the first, Export all / Import all (Developer Mode) carry every app's data, the tab always reads "Kyoshi",
 * a checkup done today shows a green ✓, and Bugs & requests (the pop-up's list, Developer Mode's exports and Clear). */
"use strict";
const fs = require("fs");
const { TODAY, PHONE, DESKTOP, eq, ok, has, open, switchTo, importBackup, travel, text } = require("./lib");
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
      for (const id of ["hawky", "badgermole", "turtleduck", "pabu"]) {
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
  },
  {
    name: "shell: a feature request stays listed with its app; the tab stays Kyoshi; a checkup done today shows a green ✓",
    async run(t) {
      const tab = await open(t, { app: "hawky" }), p = tab.page, icon = await p.getAttribute("#kFavicon", "href");
      eq(await p.title(), "Kyoshi", "the tab reads Kyoshi");
      ok(icon.startsWith("data:image/svg+xml,") && icon.includes("%2314532d"), "with the dark-green icon");
      eq(await text(tab, "#kReportBug"), "Bugs & requests", "the footer link, nothing logged");
      await p.click("#kReportBug");
      eq(await p.getAttribute('#kBugKind [data-kind="bug"]', "aria-pressed"), "true", "Bug is picked the first time");
      await p.click('#kBugKind [data-kind="request"]');
      eq(await p.getAttribute("#kBugText", "placeholder"), "What should Kyoshi do, and where?", "the box asks for a request");
      await p.fill("#kBugText", "A five-minute chip on quick add\nand a second line");
      await p.click("#kBugSubmit");
      await p.locator("#kBugStatus", { hasText: "Saved request" }).waitFor({ timeout: 5000 }); // once the copy is done, the status line says what was saved
      eq(await p.inputValue("#kBugText"), "", "the box is emptied");
      const rows = () => p.$$eval("#kBugList .bug-row", els => els.map(r => [r.querySelector(".bug-kind").textContent, r.querySelector(".bug-body").textContent]));
      eq(await rows(), [["R", `Hawky · ${TODAY} A five-minute chip on quick add`]], "one R row: the app, the day, the first line");
      eq(await p.textContent("#kBugListHead"), "Submitted · 1", "under its heading");
      eq(await p.locator("#kBugList button").count(), 0, "nothing to tick off one by one");
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 1", "the footer link counts it");
      const [stored] = await p.evaluate(() => Kyoshi.store.json("bugReports"));
      eq(stored.kind, "request", "kept as a request");
      ok(stored.markdown.split("\n")[0].endsWith(" · feature request"), "the report's first line ends with what it is");
      eq(await p.evaluate(() => { const m = document.querySelector("#kBugOverlay .modal"); return m.scrollWidth - m.clientWidth; }), 0, "no sideways scrolling on a phone");
      await p.click("#kBugOverlay .modal-close");
      await p.click("#kReportBug");
      eq(await rows(), [["R", `Hawky · ${TODAY} A five-minute chip on quick add`]], "still listed next time");
      eq(await p.getAttribute('#kBugKind [data-kind="request"]', "aria-pressed"), "true", "and Feature request is picked again");
      await p.click("#kBugOverlay .modal-close");

      // Another app: the tab doesn't change; its checkup, done today, shows a green ✓.
      await switchTo(tab, "momo");
      eq([await p.title(), await p.getAttribute("#kFavicon", "href")], ["Kyoshi", icon], "the tab still reads Kyoshi, with the same icon");
      await p.click("#kMeeting [data-done]");
      has(await text(tab, "#kMeeting"), "Last checkup: today ✓", "done today");
      const [met, good] = await p.evaluate(() => {
        const mark = document.querySelector("#kMeeting .met"), probe = document.body.appendChild(document.createElement("span"));
        probe.style.color = "var(--good)";
        const colors = [mark && getComputedStyle(mark).color, getComputedStyle(probe).color];
        probe.remove();
        return colors;
      });
      eq(met, good, "its ✓ in the theme's green");
    }
  },
  {
    name: "shell: Developer Mode exports every bug and request, requests first, then Clear empties the list; older reports are bugs",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page;
      // Kept before Kyoshi 3.760: one from before 3.750 (no kind: a bug), one marked done in 3.750 (listed like any other now).
      await p.evaluate(() => {
        Kyoshi.store.set("bugReports", JSON.stringify([
          { id: 1, timestamp: "2026-09-01T12:00:00.000Z", app: "momo", description: "Old one", markdown: "Kyoshi 3.650 · Momo 10.064\nOld one" },
          { id: 2, timestamp: "2026-10-05T12:00:00.000Z", app: "hawky", description: "Marked done", markdown: "Kyoshi 3.750 · Hawky 2.110 · feature request\nMarked done", kind: "request", done: "2026-10-05T13:00:00.000Z" }
        ]));
        Kyoshi.bugs.load();
      });
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 2", "both count");
      for (const [kind, words] of [["request", "Request one"], ["bug", "Bug two"]]) {
        await p.click("#kReportBug");
        await p.click(`#kBugKind [data-kind="${kind}"]`);
        await p.fill("#kBugText", words);
        await p.click("#kBugSubmit");
        await p.locator("#kBugStatus", { hasText: "Saved" }).waitFor({ timeout: 5000 });
        await p.click("#kBugOverlay .modal-close");
      }
      const head = () => text(tab, ".dev-block-head:has(#kDevBugCount)");
      const download = async () => {
        const [file] = await Promise.all([p.waitForEvent("download"), p.click("#kDevDownloadBugs")]);
        eq(file.suggestedFilename(), `kyoshi-bug-reports-${TODAY}.md`, "the file's name");
        return fs.readFileSync(await file.path(), "utf8");
      };
      await p.click("#kDevBadge");
      eq(await head(), "Bugs & requests: 4", "Developer Mode counts them");
      const md = await download();
      ok(md.startsWith("FEATURE REQUESTS (2)\n\nKyoshi "), "requests first");
      const at = ["Marked done", "Request one", "BUGS (2)", "Old one", "Bug two"].map(w => md.indexOf(w));
      ok(at.every((n, i) => n > (i ? at[i - 1] : 0)), `then the bugs, each group in the order they were logged (${at})`);
      has(md, "\n\n---\n\n", "each report apart");

      // Clear asks first: No keeps them all; Yes empties the list.
      tab.answers.push(false);
      await p.click("#kDevClearBugs");
      has(tab.dialogs.map(d => d[1]).join(" | "), "Export them first", "Clear reminds to export");
      eq(await head(), "Bugs & requests: 4", "No keeps them");
      await p.click("#kDevClearBugs");
      eq(await head(), "Bugs & requests: 0", "Yes clears them");
      eq(await p.evaluate(() => Kyoshi.store.json("bugReports")), [], "the log is empty");
      tab.dialogs.length = 0;
      await p.click("#kDevDownloadBugs");
      has(tab.dialogs.map(d => d[1]).join(" | "), "No bugs or requests logged", "nothing left to download");
      await p.click("#kDevBadge");
      eq(await text(tab, "#kReportBug"), "Bugs & requests", "the footer count goes");
      await p.click("#kReportBug");
      eq([await p.locator("#kBugList .bug-row").count(), await p.locator("#kBugListHead").isHidden()], [0, true], "and the pop-up's list");
    }
  }
];
