/* Kyoshi · tests/wanshitong.test.js — Wan Shi Tong's movies with a Director and a Year of their own (Phase 4 of
 * 2026-10-06_feedback_batch_plan.md): a row of their own in the pop-up, for movies only (Add another clears it, another
 * category hides it and saves neither, Esc asks before losing what was typed there), "Director, Year" under the name
 * before the info in the backlog and Active media, in the magnifier's search and in Export, kept through an edit; Momo's
 * details as they were; an older backup without them imports as it did (the info as typed, nothing split or moved), on a
 * phone, through time travel. */
"use strict";
const { DESKTOP, PHONE, eq, ok, open, lastDialog, importBackup, exportBackup, travel } = require("./lib");
const gen = require("./generate");
const ws = require("./wanshitong");

// Just those fields of an object.
const only = (o, ...keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

module.exports = [
  {
    name: "wanshitong: a movie's Director and Year — their own row in the pop-up (movies only), “Director, Year” under its name in the backlog and Active media, in its search and Export; an edit keeps them",
    async run(t) {
      const tab = await open(t, { app: "wanshitong", size: DESKTOP }), p = tab.page;

      // The pop-up starts on Book: no row. Movie shows it, and the info box asks what it always did.
      await ws.openEditor(tab);
      eq(only(await ws.editor(tab), "cat", "row", "infoLabel"), { cat: "book", row: false, infoLabel: "Author or edition" }, "a book: no row");
      await ws.fill(tab, { cat: "movie", name: "Spirited Away", director: "Miyazaki", year: "2001" });
      eq(only(await ws.editor(tab), "cat", "row", "infoLabel"), { cat: "movie", row: true, infoLabel: "Year or director" }, "a movie: the row, the info box unchanged");
      // Add another clears the row with the rest, for the next movie.
      await ws.press(tab, "another");
      eq(only(await ws.editor(tab), "cat", "row", "name", "director", "year", "info", "status"),
        { cat: "movie", row: true, name: "", director: "", year: "", info: "", status: "Added “Spirited Away” to Movies." }, "a clean form");
      await ws.fill(tab, { name: "Tampopo", year: "1985", info: "Criterion" });
      await ws.press(tab, "save");
      eq(await ws.line(tab, "backlog", "Spirited Away"), { name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki 2001 movie" }, "“Director, Year” under the name, and in the search");
      eq(await ws.line(tab, "backlog", "Tampopo"), { name: "Tampopo", info: "1985|Criterion", q: "Tampopo 1985 Criterion movie" }, "a year alone, then the info");

      // A director typed, then Book: the row goes, and the book keeps neither; its info line as before.
      await ws.openEditor(tab);
      await ws.fill(tab, { director: "Clarke" });
      await ws.fill(tab, { cat: "book" });
      eq(only(await ws.editor(tab), "cat", "row"), { cat: "book", row: false }, "Book hides the row");
      await ws.fill(tab, { name: "Piranesi", info: "Susanna Clarke" });
      await ws.press(tab, "save");
      eq(await ws.line(tab, "backlog", "Piranesi"), { name: "Piranesi", info: "Susanna Clarke", q: "Piranesi Susanna Clarke book" }, "a book as before");
      eq(only(await ws.item(tab, "Piranesi"), "director", "year"), { director: "", year: "" }, "saved without them");

      // Started: Active media shows the same line; Momo's details don't change.
      await ws.start(tab, "Spirited Away");
      eq(await ws.lines(tab, "now"), [{ name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki 2001 movie" }], "Active media's line");
      eq((await p.evaluate(() => Kyoshi.apps.wanshitong.inbox())).map(n => [n.title, n.details]), [["Spirited Away", ["Active · Movie"]]], "Momo's details");

      // Export holds both.
      const items = (await exportBackup(tab)).items.map(i => [i.name, i.director, i.year, i.info]).sort();
      eq(items, [["Piranesi", "", "", "Susanna Clarke"], ["Spirited Away", "Miyazaki", "2001", ""], ["Tampopo", "", "1985", "Criterion"]], "Export JSON");

      // Editing: the row holds them; a tap on Yes and Save keeps them.
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "cat", "row", "director", "year", "info"), { cat: "movie", row: true, director: "Miyazaki", year: "2001", info: "" }, "the pop-up holds them");
      await p.click(`${ws.POP} #itemHave [data-have="yes"]`);
      await ws.press(tab, "save");
      eq(only(await ws.item(tab, "Spirited Away"), "director", "year", "have"), { director: "Miyazaki", year: "2001", have: "yes" }, "kept through the edit");
      eq((await ws.line(tab, "now", "Spirited Away")).info, "Miyazaki, 2001", "the line too");

      // A year changed, then Esc: asked first (No keeps the pop-up); Cancel leaves it as it was.
      await ws.openEditor(tab, "Spirited Away");
      await ws.fill(tab, { year: "2003" });
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await ws.editor(tab)).open], ["Discard what you've entered?", true], "asked, and kept open");
      await ws.press(tab, "cancel");
      eq([(await ws.editor(tab)).open, (await ws.item(tab, "Spirited Away")).year], [false, "2001"], "Cancel: unchanged");

      // A movie turned into a book keeps neither.
      await ws.openEditor(tab, "Tampopo");
      await ws.fill(tab, { cat: "book" });
      await ws.press(tab, "save");
      eq([(await ws.line(tab, "backlog", "Tampopo")).info, only(await ws.item(tab, "Tampopo"), "cat", "year")],
        ["Criterion", { cat: "book", year: "" }], "a book now, its year gone");
    }
  },
  {
    name: "wanshitong: an older backup without a director or year imports as it was — the info as typed, nothing split or moved; on a phone, through time travel",
    async run(t) {
      const tab = await open(t, { app: "wanshitong", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.library([
        { name: "Spirited Away", cat: "movie", info: "Miyazaki, 2001", now: true }, { name: "Piranesi", info: "Susanna Clarke" },
        { name: "Outer Wilds", cat: "game", info: "Switch or PC" }
      ]));
      const as = async () => [await ws.lines(tab, "now"), await ws.lines(tab, "backlog")];
      const before = [
        [{ name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki, 2001 movie" }],
        [{ name: "Piranesi", info: "Susanna Clarke", q: "Piranesi Susanna Clarke book" }, { name: "Outer Wilds", info: "Switch or PC", q: "Outer Wilds Switch or PC video game" }]
      ];
      eq(await as(), before, "Active media and the backlog as before");
      eq(only(await ws.item(tab, "Spirited Away"), "director", "year", "info"), { director: "", year: "", info: "Miyazaki, 2001" }, "kept with neither");

      // Its pop-up: the row, empty; the info box as it was. On a phone the row's boxes stack, with no sideways scrolling.
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "row", "director", "year", "info"), { row: true, director: "", year: "", info: "Miyazaki, 2001" }, "nothing split or moved");
      const [director, year] = await p.$$eval(`${ws.POP} #itemDirector, ${ws.POP} #itemYear`, els => els.map(e => e.getBoundingClientRect()));
      ok(year.top >= director.bottom, "Year under Director");
      ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), "no sideways scrolling at 390px");
      await ws.press(tab, "cancel");

      // A day on, a week on: the same.
      await travel(tab, 1);
      eq(await as(), before, "a day on");
      await travel(tab, 7);
      eq(await as(), before, "a week on");
    }
  }
];
