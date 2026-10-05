/* Kyoshi · tests/shell.test.js — the whole of Kyoshi, every app: each opens through the switcher with a clean console
 * at phone and desktop width (and after a week of time travel), the switcher lists every app in order, a new device
 * opens on the first, Export all / Import all (Developer Mode) carry every app's data, the tab always reads "Kyoshi",
 * a checkup done today shows a green ✓, and Bugs & requests (the pop-up's open list, Developer Mode's exports). */
"use strict";
const fs = require("fs");
const { TODAY, PHONE, DESKTOP, eq, ok, has, lacks, open, switchTo, importBackup, travel, text } = require("./lib");
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
    name: "shell: a feature request is listed until it's done; the tab stays Kyoshi; a checkup done today shows a green ✓",
    async run(t) {
      const tab = await open(t, { app: "hawky" }), p = tab.page, icon = await p.getAttribute("#kFavicon", "href");
      eq(await p.title(), "Kyoshi", "the tab reads Kyoshi");
      ok(icon.startsWith("data:image/svg+xml,") && icon.includes("%2314532d"), "with the dark-green icon");
      eq(await text(tab, "#kReportBug"), "Bugs & requests", "the footer link, nothing open");
      await p.click("#kReportBug");
      eq(await p.getAttribute('#kBugKind [data-kind="bug"]', "aria-pressed"), "true", "Bug is picked the first time");
      await p.click('#kBugKind [data-kind="request"]');
      eq(await p.getAttribute("#kBugText", "placeholder"), "What should Kyoshi do, and where?", "the box asks for a request");
      await p.fill("#kBugText", "A five-minute chip on quick add\nand a second line");
      await p.click("#kBugSubmit");
      has(await text(tab, "#kBugStatus"), "Saved request", "the status line says what was saved");
      const rows = () => p.$$eval("#kBugList .bug-row", els => els.map(r => [r.querySelector(".bug-kind").textContent, r.querySelector(".bug-body").textContent]));
      eq(await rows(), [["R", `Hawky · ${TODAY} A five-minute chip on quick add`]], "one R row: the app, the day, the first line");
      eq(await p.textContent("#kBugOpenHead"), "Open · 1", "under its heading");
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 1", "the footer link counts it");
      const [stored] = await p.evaluate(() => Kyoshi.store.json("bugReports"));
      eq([stored.kind, stored.done], ["request", ""], "kept as an open request");
      ok(stored.markdown.split("\n")[0].endsWith(" · feature request"), "the report's first line ends with what it is");
      // On a phone, Done stays at the row's right end and nothing scrolls sideways.
      const fit = await p.evaluate(() => {
        const row = document.querySelector("#kBugList .bug-row"), modal = document.querySelector("#kBugOverlay .modal");
        return [Math.round(row.getBoundingClientRect().right - row.querySelector("button").getBoundingClientRect().right), modal.scrollWidth - modal.clientWidth];
      });
      eq(fit, [0, 0], "Done at the row's right end, no sideways scrolling");
      await p.click("#kBugList [data-done]");
      eq(await rows(), [], "Done empties the list");
      ok(await p.locator("#kBugOpenHead").isHidden(), "and hides its heading");
      eq(await text(tab, "#kReportBug"), "Bugs & requests", "the footer count goes");
      ok((await p.evaluate(() => Kyoshi.store.json("bugReports")))[0].done, "the request is kept, marked done");
      await p.click("#kBugOverlay .modal-close");
      await p.click("#kReportBug");
      eq(await p.getAttribute('#kBugKind [data-kind="request"]', "aria-pressed"), "true", "Feature request is picked again next time");
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
    name: "shell: Developer Mode copies the open bugs and requests, requests first; Clear done; older reports are open bugs",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page;
      // A report kept before Kyoshi 3.750 (no kind, no done) is an open bug.
      await p.evaluate(() => {
        Kyoshi.store.set("bugReports", JSON.stringify([{ id: 1, timestamp: "2026-09-01T12:00:00.000Z", app: "momo", description: "Old one", markdown: "Kyoshi 3.650 · Momo 10.064\nOld one" }]));
        Kyoshi.bugs.load();
      });
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 1", "an older report counts as open");
      for (const [kind, words] of [["request", "Request one"], ["bug", "Bug two"]]) {
        await p.click("#kReportBug");
        await p.click(`#kBugKind [data-kind="${kind}"]`);
        await p.fill("#kBugText", words);
        await p.click("#kBugSubmit");
        await p.click("#kBugOverlay .modal-close");
      }
      const head = () => text(tab, ".dev-block-head:has(#kDevBugCount)");
      const download = async () => {
        const [file] = await Promise.all([p.waitForEvent("download"), p.click("#kDevDownloadBugs")]);
        eq(file.suggestedFilename(), `kyoshi-bug-reports-${TODAY}.md`, "the file's name");
        return fs.readFileSync(await file.path(), "utf8");
      };
      await p.click("#kDevBadge");
      eq(await head(), "Bugs & requests: 3 open · 0 done", "Developer Mode counts them");
      let md = await download();
      ok(md.startsWith("FEATURE REQUESTS (1)\n\nKyoshi "), "requests first");
      const at = ["Request one", "BUGS (2)", "Old one", "Bug two"].map(w => md.indexOf(w));
      ok(at.every((n, i) => n > (i ? at[i - 1] : 0)), `then the bugs, in the order they were logged (${at})`);
      has(md, "\n\n---\n\n", "each report apart");

      // Done on the old one and the request: only the bug is left to copy.
      await p.click("#kDevBadge");
      await p.click("#kReportBug");
      for (const words of ["Old one", "Request one"]) await p.click(`#kBugList .bug-row:has-text("${words}") [data-done]`);
      eq(await p.$$eval("#kBugList .bug-row .bug-kind", els => els.map(e => e.textContent)), ["B"], "one open bug left");
      await p.click("#kBugOverlay .modal-close");
      await p.click("#kDevBadge");
      eq(await head(), "Bugs & requests: 1 open · 2 done", "two done");
      md = await download();
      ok(md.startsWith("BUGS (1)\n\n") && md.includes("Bug two"), "the open bug alone");
      lacks(md, "FEATURE REQUESTS", "no requests group when none is open");
      lacks(md, "Old one", "nor the done ones");
      await p.click("#kDevClearDoneBugs");
      eq(await head(), "Bugs & requests: 1 open · 0 done", "Clear done removes the done ones");
      eq((await p.evaluate(() => Kyoshi.store.json("bugReports"))).map(r => r.description), ["Bug two"], "and keeps the open one");
    }
  }
];
