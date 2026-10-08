/* Kyoshi · tests/shell.test.js — the whole of Kyoshi, every app: each opens through the switcher with a clean console
 * at phone and desktop width (and after a week of time travel), the switcher lists every app in order (never the hidden
 * Kyoshi app: #kyoshi shows the first), a new device opens on the first, Export all / Import all (Developer Mode) carry
 * every app's data and the theme picked (the later pick winning), Backup & sync is Developer Mode's (no app's page has it)
 * and follows the app on screen, the tab always reads "Kyoshi", a checkup done today shows a green ✓, Bugs & requests (the
 * pop-up's list, a report edited in place or deleted, Developer Mode's exports and Clear; the log kept by the hidden Kyoshi
 * app, the old one carried over), and Developer Mode's changelog (the latest three entries, then how many older ones the
 * file holds). */
"use strict";
const fs = require("fs");
const { TODAY, PHONE, DESKTOP, eq, ok, has, open, lastDialog, switchTo, devPanel, importBackup, exportBackup, travel, text } = require("./lib");
const gen = require("./generate");
// The apps with a page, in order (the hidden Kyoshi app, core's own record, has none).
const shown = p => p.evaluate(() => Kyoshi.order.filter(id => !Kyoshi.apps[id].meta.hidden));
// The bug log as the hidden Kyoshi app keeps it.
const stored = p => p.evaluate(() => Kyoshi.apps.kyoshi.store.json("bugReports"));

module.exports = [
  {
    name: "shell: every app opens with a clean console, on a phone and a computer, and after time travel",
    async run(t) {
      for (const size of [PHONE, DESKTOP]) {
        const tab = await open(t, { size }), p = tab.page, order = await shown(p);
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
    name: "shell: the switcher lists every app in order, never the hidden Kyoshi app (#kyoshi shows the first); a new device opens on the first",
    async run(t) {
      const tab = await open(t, { app: "" }), p = tab.page, order = await shown(p);
      eq(await p.evaluate(() => Kyoshi.active().id), order[0], "a new device opens on the first app");
      ok(order.includes("badgermole"), "Badgermole is one of them");
      eq(await p.evaluate(() => [Kyoshi.order.includes("kyoshi"), Kyoshi.apps.kyoshi.started, Kyoshi.apps.kyoshi.meta.hidden]), [true, true, true], "the hidden Kyoshi app started too");
      await p.click("#kSwitchBtn");
      eq(await p.$$eval("#kSwitchMenu [data-app]", els => els.map(e => e.dataset.app)), order, "the switcher's order, without it");
      await p.click("#kSwitchBtn");
      // #kyoshi in the URL: the first app, whether the hash changes or the page opens with it (the last app was Hawky).
      const where = () => p.evaluate(() => [Kyoshi.active().id, location.hash]);
      await switchTo(tab, "hawky");
      await p.evaluate(() => { location.hash = "kyoshi"; });
      await p.waitForFunction(() => Kyoshi.active().id === "momo");
      eq(await where(), ["momo", "#momo"], "a change of hash to #kyoshi shows the first app");
      await switchTo(tab, "hawky");
      await p.evaluate(() => history.replaceState(null, "", "#kyoshi"));
      await p.reload();
      await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
      eq(await where(), ["momo", "#momo"], "and so does opening index.html#kyoshi");
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
      // Import all's confirm (answered yes, so the import runs right after it); the page is held until then.
      for (const end = Date.now() + 5000; fresh.dialogs.length < 1 && Date.now() < end;) await new Promise(r => setTimeout(r, 10));
      has(fresh.dialogs.map(d => d[1]).join(" | "), "Badgermole", "Import all names Badgermole");
      eq(await fresh.page.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 15, "Import all brought the sessions in");
      // Badgermole's part of an Export all file also works in its own Import JSON.
      const third = await open(t);
      await importBackup(third, all);
      eq(await third.page.evaluate(() => Kyoshi.apps.badgermole.sessions().length), 15, "Import JSON takes its part of an Export all file");
    }
  },
  {
    name: "shell: the theme picked goes in Export all; Import all takes it where none was picked, but a backup's older pick (or none) doesn't undo a later one, nor in test mode",
    async run(t) {
      const tab = await open(t, { app: "momo" }), p = tab.page;
      const theme = x => x.page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("kyoshi.theme")]);
      // Import all with a file made from data: its question answered yes, the import right after it.
      const importAll = async (x, all) => {
        const was = await devPanel(x, true), asked = x.dialogs.length;
        const [chooser] = await Promise.all([x.page.waitForEvent("filechooser"), x.page.click("#kDevImportAll")]);
        await chooser.setFiles({ name: "kyoshi-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(all)) });
        for (const end = Date.now() + 5000; x.dialogs.length === asked && Date.now() < end;) await new Promise(r => setTimeout(r, 10));
        await devPanel(x, was);
      };
      eq(await theme(tab), ["light", "light"], "light by the hour (07:00)");
      await p.click("#kThemeToggle");
      eq(await theme(tab), ["dark", "dark"], "a tap: dark, kept on this device");
      await devPanel(tab, true);
      const [download] = await Promise.all([p.waitForEvent("download"), p.click("#kDevExportAll")]);
      const all = JSON.parse(fs.readFileSync(await download.path(), "utf8")), kept = all.apps.kyoshi.prefs;
      eq([kept.theme, kept.u > 0], ["dark", true], "Export all holds the pick, under apps.kyoshi.prefs");

      // Another device that never picked one takes it from the file.
      const other = await open(t, { app: "momo" });
      eq(await theme(other), ["light", "light"], "the other device is light by the hour");
      await importAll(other, all);
      eq(await theme(other), ["dark", "dark"], "Import all takes the pick");
      // A pick there, later: the same file again, or one from before the theme was kept (no prefs), leaves it.
      await other.page.click("#kThemeToggle");
      await importAll(other, all);
      eq(await theme(other), ["light", "light"], "the backup's older pick doesn't undo the later one");
      await importAll(other, { ...all, apps: { ...all.apps, kyoshi: { ...all.apps.kyoshi, prefs: undefined } } });
      eq(await theme(other), ["light", "light"], "nor does a backup with none");
      // In test mode Import all leaves the record as it is, a later pick in the file too.
      await travel(other, 1);
      await importAll(other, { ...all, apps: { ...all.apps, kyoshi: { ...all.apps.kyoshi, prefs: { theme: "dark", u: kept.u + 864e5 } } } });
      eq(await theme(other), ["light", "light"], "test mode: the theme stays");
    }
  },
  {
    name: "shell: Backup & sync is in Developer Mode, for the app on screen: Export JSON there and Import JSON back carry Hawky's errands",
    async run(t) {
      const tab = await open(t, { app: "hawky" }), p = tab.page, order = await p.evaluate(() => Kyoshi.order.slice());
      eq(await p.evaluate(ids => ids.filter(id => Kyoshi.apps[id].root.querySelector('[data-kyoshi="backup"]')), order), [], "no app's page has a backup section");
      await importBackup(tab, gen.hawkyItems(gen.ERRANDS.slice(0, 4).map(([text, minutes]) => ({ text, minutes }))));
      const count = x => x.page.evaluate(() => Kyoshi.apps.hawky.S.items.filter(i => !i.deleted).length);
      eq(await count(tab), 4, "Import JSON in the panel brought the errands in");
      // A change lights up Export JSON and Export all until it's in a backup.
      await p.fill("#kMount #addText", "Buy stamps");
      await p.press("#kMount #addText", "Enter");
      const lit = id => p.evaluate(x => document.getElementById(x).classList.contains("unsaved"), id);
      eq([await lit("kDevExportApp"), await lit("kDevExportAll")], [true, true], "a change lights up Export JSON and Export all");
      await devPanel(tab, true);
      eq(await text(tab, "#kDevBackup .dev-block-head"), "Backup & sync: Hawky", "the panel's block is the app on screen's");
      has(await text(tab, "#kDevBackupNote"), "Your data lives in this browser:", "with where its data lives");
      const back = await exportBackup(tab);
      eq([back.items.filter(i => !i.deleted).length, await lit("kDevExportApp")], [5, false], "Export JSON holds every errand, and is lit no more");
      const fresh = await open(t, { app: "hawky" });
      await importBackup(fresh, back);
      eq(await count(fresh), 5, "Import JSON takes the export back, on another device");
      await switchTo(tab, "momo");
      eq(await text(tab, "#kDevBackup .dev-block-head"), "Backup & sync: Momo", "a switch of app redraws the block");
    }
  },
  {
    name: "shell: Developer Mode's changelog shows the latest three entries, and how many older ones the file holds",
    async run(t) {
      const tab = await open(t, { app: "momo" }), p = tab.page;
      await devPanel(tab, true);
      const shown = () => p.evaluate(() => [...document.querySelectorAll("#kDevChangelog > *")].map(e =>
        e.classList.contains("changelog-entry") ? e.querySelector(".changelog-version").textContent : e.textContent));
      const [momo, kyoshi] = await p.evaluate(() => [Kyoshi.apps.momo.CHANGELOG, Kyoshi.CHANGELOG].map(log => log.map(c => `v${c.version}`)));
      ok(momo.length > 3, "Momo's log holds more than three");
      eq(await shown(), [...momo.slice(0, 3), `… and ${momo.length - 3} older entries, in apps/momo/changelog.js`], "Momo's latest three, then the older count");
      await p.click('#kDevLogPills [data-log="kyoshi"]');
      eq(await shown(), [...kyoshi.slice(0, 3), `… and ${kyoshi.length - 3} older entries, in core/changelog.js`], "and Kyoshi's");
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
      eq(await p.locator("#kBugList button:not(.bug-row)").count(), 0, "nothing to tick off one by one (the row itself opens it)");
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 1", "the footer link counts it");
      const [kept] = await stored(p);
      eq(kept.kind, "request", "kept as a request, by the hidden Kyoshi app");
      ok(kept.markdown.split("\n")[0].endsWith(" · feature request"), "the report's first line ends with what it is");
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
    name: "shell: a report opens in the pop-up to edit — its whole description and its kind; Save keeps both and what it captured; Esc asks, Cancel leaves",
    async run(t) {
      const tab = await open(t, { app: "hawky" }), p = tab.page, ROW = "#kBugList .bug-row";
      const rows = () => p.$$eval(ROW, els => els.map(r => [r.querySelector(".bug-kind").textContent, r.querySelector(".bug-body").textContent]));
      const pressed = () => p.$$eval("#kBugKind [aria-pressed=true]", els => els.map(b => b.dataset.kind));
      await p.click("#kReportBug");
      await p.click('#kBugKind [data-kind="request"]');
      await p.fill("#kBugText", "Group the errands by place\nso one trip covers them");
      await p.click("#kBugSubmit");
      await p.locator("#kBugStatus", { hasText: "Saved request" }).waitFor({ timeout: 5000 });
      const [before] = await stored(p), was = before.markdown.split("\n");

      // A tap on its row: the pop-up edits it, its whole description in the box.
      await p.click(ROW);
      eq(await p.inputValue("#kBugText"), "Group the errands by place\nso one trip covers them", "the box holds its whole description");
      eq([await text(tab, "#kBugTitle"), await text(tab, "#kBugSubmit"), await p.isVisible("#kBugCancel"), await pressed()],
        ["Bugs & requests · editing", "Save", true, ["request"]], "edit mode: the title says so, Save and Cancel, its kind");
      eq(await text(tab, "#kBugStatus"), `Editing the Hawky request from ${TODAY}. What it captured (versions, state, console) stays as it was.`, "the status line says which");
      ok(await p.evaluate(() => document.querySelector("#kBugList .bug-row").classList.contains("editing")), "its row is marked");

      // New words, and a bug now: Save.
      await p.click('#kBugKind [data-kind="bug"]');
      await p.fill("#kBugText", "Errands at the same place go together\nnot apart");
      await p.click("#kBugSubmit");
      eq(await text(tab, "#kBugStatus"), "Saved the change.", "saved");
      eq(await rows(), [["B", `Hawky · ${TODAY} · edited Errands at the same place go together`]], "the row: B now, edited, its new first line");
      eq([await text(tab, "#kBugTitle"), await text(tab, "#kBugSubmit"), await p.isVisible("#kBugCancel"), await p.inputValue("#kBugText"), await pressed()],
        ["Bugs & requests", "Submit", false, "", ["request"]], "back to a new one, with the kind last picked for one");
      const [after] = await stored(p), now = after.markdown.split("\n");
      eq(now[0], was[0].replace(/ · feature request$/, " · bug"), "its first line says bug now, the rest of it as it was");
      eq(now.slice(1, 3), ["Errands at the same place go together", "not apart"], "its description is the new text");
      eq(now.slice(3), was.slice(3), "what it captured (env: on) is unchanged");
      ok(now[3].startsWith("env: "), "starting with its env: line");
      eq([after.id, after.kind, after.description, after.u > before.u, !!Date.parse(after.edited)], [before.id, "bug", "Errands at the same place go together\nnot apart", true, true], "kept: the same report, changed now");

      // A change, then Esc: asked first; No keeps editing, Cancel leaves it (unchanged).
      await p.click(ROW);
      await p.fill("#kBugText", "Errands at the same place go together\nnot far apart");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      has(lastDialog(tab), "Discard your changes to this report?", "Esc asks first");
      eq([await p.evaluate(() => Kyoshi.bugs.isOpen()), await text(tab, "#kBugSubmit"), await p.inputValue("#kBugText")],
        [true, "Save", "Errands at the same place go together\nnot far apart"], "No keeps it open, editing");
      await p.click("#kBugCancel");
      eq([await text(tab, "#kBugSubmit"), await p.inputValue("#kBugText"), await p.locator(`${ROW}.editing`).count()], ["Submit", "", 0], "Cancel leaves edit mode, the box emptied");
      eq((await stored(p))[0].description, "Errands at the same place go together\nnot apart", "nothing changed");
      // Unchanged, Esc closes without asking; open again: a new one.
      await p.click(ROW);
      await p.keyboard.press("Escape");
      eq([await p.evaluate(() => Kyoshi.bugs.isOpen()), tab.dialogs.length], [false, 0], "nothing changed: Esc closes without asking");
      await p.click("#kReportBug");
      eq([await text(tab, "#kBugTitle"), await text(tab, "#kBugSubmit"), await p.inputValue("#kBugText")], ["Bugs & requests", "Submit", ""], "opened again: a new one");
    }
  },
  {
    name: "shell: a report opened from the list can be deleted, after a question (No keeps it); it's kept as a marker with no words",
    async run(t) {
      const tab = await open(t, { app: "hawky" }), p = tab.page, ROW = "#kBugList .bug-row";
      const QUESTION = `Delete this Hawky request from ${TODAY}? It goes from every device once they sync, and can't be undone.`;
      await p.click("#kReportBug");
      eq(await p.isVisible("#kBugDelete"), false, "no Delete for a new one");
      await p.click('#kBugKind [data-kind="request"]');
      await p.fill("#kBugText", "Quick add could keep the last store");
      await p.click("#kBugSubmit");
      await p.locator("#kBugStatus", { hasText: "Saved request" }).waitFor({ timeout: 5000 });
      eq(await p.isVisible("#kBugDelete"), false, "nor after Submit");

      // Opened from its row: Delete beside Save and Cancel. No keeps it, still open.
      await p.click(ROW);
      eq([await text(tab, "#kBugSubmit"), await p.isVisible("#kBugCancel"), await p.isVisible("#kBugDelete")], ["Save", true, true], "Delete, while it's open");
      eq(await p.locator("#kBugList #kBugDelete").count(), 0, "in the pop-up's buttons, not the list");
      tab.answers.push(false);
      await p.click("#kBugDelete");
      eq(lastDialog(tab), QUESTION, "asked first");
      eq([await p.locator(ROW).count(), await text(tab, "#kBugSubmit"), (await stored(p)).map(r => r.deleted)], [1, "Save", [false]], "No keeps it");

      // Yes: gone from the list and the footer's count; the pop-up back to a new one.
      await p.click("#kBugDelete");
      eq(lastDialog(tab), QUESTION, "asked again");
      eq([await p.locator(ROW).count(), await p.locator("#kBugListHead").isHidden(), await text(tab, "#kReportBug"), await text(tab, "#kBugStatus")],
        [0, true, "Bugs & requests", "Deleted."], "gone");
      eq([await text(tab, "#kBugTitle"), await text(tab, "#kBugSubmit"), await p.isVisible("#kBugCancel"), await p.isVisible("#kBugDelete"), await p.inputValue("#kBugText")],
        ["Bugs & requests", "Submit", false, false, ""], "back to a new one, Delete hidden");
      eq((await stored(p)).map(r => [r.deleted, r.description, r.markdown, r.edited]), [[true, "", "", ""]],
        "kept as a marker with no words, so a device that still has it can't bring it back");
    }
  },
  {
    name: "shell: Developer Mode exports every bug and request, requests first, then Clear empties the list; older reports are bugs, the old log carried over",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page;
      // Kept before Kyoshi 3.760 (in core's own store, before 5.070): one from before 3.750 (no kind: a bug), one marked
      // done in 3.750 (listed like any other now).
      await p.evaluate(() => {
        Kyoshi.store.set("bugReports", JSON.stringify([
          { id: 1, timestamp: "2026-09-01T12:00:00.000Z", app: "momo", description: "Old one", markdown: "Kyoshi 3.650 · Momo 10.064\nOld one" },
          { id: 2, timestamp: "2026-10-05T12:00:00.000Z", app: "hawky", description: "Marked done", markdown: "Kyoshi 3.750 · Hawky 2.110 · feature request\nMarked done", kind: "request", done: "2026-10-05T13:00:00.000Z" }
        ]));
        Kyoshi.record.load();
      });
      eq(await text(tab, "#kReportBug"), "Bugs & requests · 2", "both count");
      eq((await stored(p)).map(r => [r.id, r.kind, r.u]), [[1, "bug", Date.parse("2026-09-01T12:00:00.000Z")], [2, "request", Date.parse("2026-10-05T12:00:00.000Z")]],
        "carried over to the hidden Kyoshi app's store, each changed when it was logged");
      eq(await p.evaluate(() => Kyoshi.store.get("bugReports")), null, "and gone from the old one");
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
      const markers = await stored(p);
      eq(markers.map(r => [r.deleted, r.description, r.markdown]), [[true, "", ""], [true, "", ""], [true, "", ""], [true, "", ""]],
        "each kept as a marker with no words, so a device that still has it can't bring it back");
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
