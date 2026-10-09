/* Kyoshi · tests/wanshitong.test.js — Wan Shi Tong's movies with a Director and a Year of their own (Phase 4 of
 * 2026-10-06_feedback_batch_plan.md): a row of their own in the pop-up, for movies only (Add another clears it, another
 * category hides it and saves neither, Esc asks before losing what was typed there), "Director, Year" under the name
 * before the info in the backlog and Active media, in the magnifier's search and in Export, kept through an edit; Momo's
 * details as they were; an older backup without them imports as it did (the info as typed, nothing split or moved), on a
 * phone, through time travel. Since Phase 4 of 2026-10-08_feedback_batch_plan.md: no info box for a movie (an older
 * movie's info shows in its pop-up as “Note from before” until it's cleared), TV/Anime's box asks for the year, and no
 * box shows example text. */
"use strict";
const { DESKTOP, PHONE, eq, ok, open, lastDialog, importBackup, exportBackup, travel } = require("./lib");
const gen = require("./generate");
const ws = require("./wanshitong");

// Just those fields of an object.
const only = (o, ...keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

module.exports = [
  {
    name: "wanshitong: a movie's Director and Year — their own row in the pop-up (movies only), and no info box for a movie (TV/Anime's asks for the year; no box shows an example); “Director, Year” under its name in the backlog and Active media, in its search and Export; an edit keeps them",
    async run(t) {
      const tab = await open(t, { app: "wanshitong", size: DESKTOP }), p = tab.page;

      // The pop-up starts on Book: no row, the info box asks for the author. TV/Anime's asks for the year; Movie shows
      // the row and no info box. No box shows an example, whatever the category.
      const cats = async () => only(await ws.editor(tab), "cat", "row", "infoShown", "infoLabel", "placeholders");
      await ws.openEditor(tab);
      eq(await cats(), { cat: "book", row: false, infoShown: true, infoLabel: "Author or edition", placeholders: 0 }, "a book: no row");
      await ws.fill(tab, { cat: "tv" });
      eq(await cats(), { cat: "tv", row: false, infoShown: true, infoLabel: "Year", placeholders: 0 }, "TV/Anime: the year");
      await ws.fill(tab, { cat: "movie", name: "Spirited Away", director: "Miyazaki", year: "2001" });
      eq(await cats(), { cat: "movie", row: true, infoShown: false, infoLabel: "", placeholders: 0 }, "a movie: the row, no info box");
      // Add another clears the row with the rest, for the next movie.
      await ws.press(tab, "another");
      eq(only(await ws.editor(tab), "cat", "row", "infoShown", "name", "director", "year", "info", "status"),
        { cat: "movie", row: true, infoShown: false, name: "", director: "", year: "", info: "", status: "Added “Spirited Away” to Movies." }, "a clean form");
      await ws.fill(tab, { name: "Tampopo", year: "1985" });
      await ws.press(tab, "save");
      eq(await ws.line(tab, "backlog", "Spirited Away"), { name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki 2001 movie" }, "“Director, Year” under the name, and in the search");
      eq(await ws.line(tab, "backlog", "Tampopo"), { name: "Tampopo", info: "1985", q: "Tampopo 1985 movie" }, "a year alone");

      // A director typed, then Book: the row goes, and the book keeps neither; its info line as before.
      await ws.openEditor(tab);
      await ws.fill(tab, { director: "Clarke" });
      await ws.fill(tab, { cat: "book" });
      eq(only(await ws.editor(tab), "cat", "row"), { cat: "book", row: false }, "Book hides the row");
      await ws.fill(tab, { name: "Piranesi", info: "Susanna Clarke" });
      await ws.press(tab, "save");
      eq(await ws.line(tab, "backlog", "Piranesi"), { name: "Piranesi", info: "Susanna Clarke", q: "Piranesi Susanna Clarke book" }, "a book as before");
      eq(only(await ws.item(tab, "Piranesi"), "director", "year"), { director: "", year: "" }, "saved without them");

      // Info typed under Book, then Movie: the box goes, and the movie keeps none (as a book keeps no director).
      await ws.openEditor(tab);
      await ws.fill(tab, { info: "Second edition" });
      await ws.fill(tab, { cat: "movie", name: "Harbor Lights" });
      eq(only(await ws.editor(tab), "cat", "infoShown"), { cat: "movie", infoShown: false }, "Movie hides the box");
      await ws.press(tab, "save");
      eq([await ws.line(tab, "backlog", "Harbor Lights"), (await ws.item(tab, "Harbor Lights")).info],
        [{ name: "Harbor Lights", info: "", q: "Harbor Lights movie" }, ""], "saved without it");

      // Started: Active media shows the same line; Momo's details don't change.
      await ws.start(tab, "Spirited Away");
      eq(await ws.lines(tab, "now"), [{ name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki 2001 movie" }], "Active media's line");
      eq((await p.evaluate(() => Kyoshi.apps.wanshitong.inbox())).map(n => [n.title, n.details]), [["Spirited Away", ["Active · Movie"]]], "Momo's details");

      // Export holds both.
      const items = (await exportBackup(tab)).items.map(i => [i.name, i.director, i.year, i.info]).sort();
      eq(items, [["Harbor Lights", "", "", ""], ["Piranesi", "", "", "Susanna Clarke"], ["Spirited Away", "Miyazaki", "2001", ""], ["Tampopo", "", "1985", ""]], "Export JSON");

      // Editing: the row holds them, still with no info box or example; a tap on Yes and Save keeps them.
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "cat", "row", "director", "year", "info", "infoShown", "placeholders"),
        { cat: "movie", row: true, director: "Miyazaki", year: "2001", info: "", infoShown: false, placeholders: 0 }, "the pop-up holds them");
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

      // A movie turned into a book keeps neither, and the book's box is back.
      await ws.openEditor(tab, "Tampopo");
      await ws.fill(tab, { cat: "book" });
      eq(only(await ws.editor(tab), "infoShown", "infoLabel"), { infoShown: true, infoLabel: "Author or edition" }, "the book's box");
      await ws.fill(tab, { info: "Criterion" });
      await ws.press(tab, "save");
      eq([(await ws.line(tab, "backlog", "Tampopo")).info, only(await ws.item(tab, "Tampopo"), "cat", "year")],
        ["Criterion", { cat: "book", year: "" }], "a book now, its year gone");
    }
  },
  {
    name: "wanshitong: an older backup without a director or year imports as it was — the info as typed, nothing split or moved (a movie's in its pop-up as “Note from before”, a show's in its Year box); on a phone, through time travel",
    async run(t) {
      const tab = await open(t, { app: "wanshitong", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.library([
        { name: "Spirited Away", cat: "movie", info: "Miyazaki, 2001", now: true }, { name: "Piranesi", info: "Susanna Clarke" },
        { name: "Night Ferry", cat: "tv", info: "2023, StreamCo" }, { name: "Outer Wilds", cat: "game", info: "Switch or PC" }
      ]));
      const as = async () => [await ws.lines(tab, "now"), await ws.lines(tab, "backlog")];
      const before = [
        [{ name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki, 2001 movie" }],
        [{ name: "Piranesi", info: "Susanna Clarke", q: "Piranesi Susanna Clarke book" }, { name: "Night Ferry", info: "2023, StreamCo", q: "Night Ferry 2023, StreamCo series" },
          { name: "Outer Wilds", info: "Switch or PC", q: "Outer Wilds Switch or PC video game" }]
      ];
      eq(await as(), before, "Active media and the backlog as before");
      eq(only(await ws.item(tab, "Spirited Away"), "director", "year", "info"), { director: "", year: "", info: "Miyazaki, 2001" }, "kept with neither");

      // Its pop-up: the row, empty; the info as it was, in a box of its own, "Note from before". On a phone the row's
      // boxes stack, with no sideways scrolling.
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "row", "director", "year", "info", "infoShown", "infoLabel", "placeholders"),
        { row: true, director: "", year: "", info: "Miyazaki, 2001", infoShown: true, infoLabel: "Note from before", placeholders: 0 }, "nothing split or moved");
      const [director, year] = await p.$$eval(`${ws.POP} #itemDirector, ${ws.POP} #itemYear`, els => els.map(e => e.getBoundingClientRect()));
      ok(year.top >= director.bottom, "Year under Director");
      ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), "no sideways scrolling at 390px");
      await ws.press(tab, "cancel");
      // A show's "where to watch" stays in its box, which asks for the year now.
      await ws.openEditor(tab, "Night Ferry");
      eq(only(await ws.editor(tab), "row", "info", "infoShown", "infoLabel"), { row: false, info: "2023, StreamCo", infoShown: true, infoLabel: "Year" }, "a show's box holds it");
      await ws.press(tab, "cancel");

      // A day on, a week on: the same.
      await travel(tab, 1);
      eq(await as(), before, "a day on");
      await travel(tab, 7);
      eq(await as(), before, "a week on");
    }
  },
  {
    name: "wanshitong: an older movie's info stays its “Note from before” until it's cleared — kept through an edit; moved into Director and Year and cleared, it's gone from the line and the box doesn't come back, after a reload too",
    async run(t) {
      const tab = await open(t, { app: "wanshitong", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.library([{ name: "Spirited Away", cat: "movie", info: "Miyazaki, 2001" }]));

      // A tap on Yes and Save: the note stays, under its name too.
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "infoShown", "infoLabel", "info"), { infoShown: true, infoLabel: "Note from before", info: "Miyazaki, 2001" }, "the note's box");
      await p.click(`${ws.POP} #itemHave [data-have="yes"]`);
      await ws.press(tab, "save");
      eq([(await ws.item(tab, "Spirited Away")).info, (await ws.line(tab, "backlog", "Spirited Away")).info], ["Miyazaki, 2001", "Miyazaki, 2001"], "kept through the edit");

      // Moved into Director and Year, the note cleared: the box stays while the pop-up is open; then the line comes from
      // Director and Year alone (the search without the note's comma), and the box is gone the next time.
      await ws.openEditor(tab, "Spirited Away");
      await ws.fill(tab, { director: "Miyazaki", year: "2001", info: "" });
      eq(only(await ws.editor(tab), "infoShown", "infoLabel"), { infoShown: true, infoLabel: "Note from before" }, "still there while it's open");
      await ws.press(tab, "save");
      eq(await ws.line(tab, "backlog", "Spirited Away"), { name: "Spirited Away", info: "Miyazaki, 2001", q: "Spirited Away Miyazaki 2001 movie" }, "the line from Director and Year");
      eq(only(await ws.item(tab, "Spirited Away"), "director", "year", "info"), { director: "Miyazaki", year: "2001", info: "" }, "the note gone");
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "row", "infoShown"), { row: true, infoShown: false }, "no box the next time");
      await ws.press(tab, "cancel");

      // Kept: after a reload, the same.
      await p.reload();
      await p.waitForFunction(() => Kyoshi.active() === Kyoshi.apps.wanshitong && Kyoshi.active().started);
      await ws.openEditor(tab, "Spirited Away");
      eq(only(await ws.editor(tab), "director", "year", "info", "infoShown"), { director: "Miyazaki", year: "2001", info: "", infoShown: false }, "after a reload");
    }
  }
];
