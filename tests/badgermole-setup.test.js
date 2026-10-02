/* Kyoshi · tests/badgermole-setup.test.js — Badgermole from an empty profile, with taps only: the starter exercises, a
 * routine and its pop-up, the program with repeats and its "next", Pick another routine, renaming and deleting (an
 * exercise leaves its routines, a routine leaves the program), and the phone layout (folds, thumb-sized controls). */
"use strict";
const { eq, ok, has, lacks, open, lastDialog, importBackup, DESKTOP } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");

// A routine through its pop-up: the name, then each line's exercise, sets, reps and weight.
async function addRoutine(tab, name, lines) {
  const p = tab.page;
  await bm.openFold(tab, "routines");
  await p.click("#addRoutineBtn");
  await p.fill("#routineName", name);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await p.click("#routineAddLineBtn");
    const [exercise, sets, reps, weight] = lines[i], line = p.locator("#routineLines .line").nth(i);
    await line.locator("select").selectOption({ label: exercise });
    await line.locator('input[data-f="sets"]').fill(String(sets));
    await line.locator('input[data-f="reps"]').fill(String(reps));
    await line.locator('input[data-f="weight"]').fill(String(weight));
  }
  await p.click('#routineForm button[type="submit"]');
}

module.exports = [
  {
    name: "setup: starter exercises, routines, a program with repeats, Pick another routine",
    async run(t) {
      const tab = await open(t), p = tab.page;
      has(await bm.nextUp(tab), "Add your exercises and a routine below.", "Next up on a first run");
      ok(await p.locator("#exercisesBox").evaluate(el => el.open), "on a phone, the Exercises fold opens on a first run (it's what to do first)");
      ok(!(await p.locator("#programBox").evaluate(el => el.open)), "on a phone, the other folds stay folded");
      await p.click("#starterBtn");
      const exercises = await bm.rows(tab, "exercises");
      eq(exercises.length, 7, "starter exercises");
      eq(exercises.filter(r => r.includes("bodyweight")).length, 2, "starter bodyweight exercises (Pull-up, Push-up)");
      ok(await p.locator("#starterBtn").isHidden(), "the starter button goes once there are exercises");

      await addRoutine(tab, "Upper", [["Bench press", 3, 5, 135], ["Barbell row", 3, 8, 95], ["Pull-up", 3, 8, 0]]);
      await addRoutine(tab, "Lower", [["Squat", 3, 5, 185], ["Deadlift", 1, 5, 225]]);
      eq(await bm.rows(tab, "routines"), ["Upper · 3 exercises", "Lower · 2 exercises"], "routine rows");
      has(await bm.nextUp(tab), "Add a routine to the program", "Next up with routines but no program");

      // Upper, Lower, Upper: repeats are fine; the first is next.
      await bm.openFold(tab, "program");
      for (const name of ["Upper", "Lower", "Upper"]) {
        await p.selectOption("#programSelect", { label: name });
        await p.click("#programAddBtn");
      }
      eq(await bm.programRows(tab), ["Upper (next)", "Lower", "Upper"], "program with a repeat");
      has(await bm.nextUp(tab), "Upper", "Next up names the first routine");
      has(await bm.nextUp(tab), "Not done yet · 3 exercises", "Next up's line before any session");
      // ↓ on the first: Lower comes first, and is next.
      await p.click('#programList [data-act="prog-down"][data-i="0"]');
      eq(await bm.programRows(tab), ["Lower (next)", "Upper", "Upper"], "program after ↓");

      // Pick another routine starts any; cancelling keeps nothing.
      await bm.start(tab, "Upper");
      eq((await bm.screen(tab)).exercise, "Bench press", "Pick another routine started Upper");
      await p.click("#cancelSessionBtn");
      has(lastDialog(tab), "Cancel this session?", "cancel asks first");
      await p.waitForSelector("#homeView:not([hidden])");
      eq(await p.evaluate(() => Kyoshi.apps.badgermole.S.sessions.length), 0, "a cancelled session keeps nothing");
    }
  },
  {
    name: "setup: the pop-ups check what's typed, deleting an exercise or routine tidies up after it",
    async run(t) {
      const tab = await open(t), p = tab.page;
      await importBackup(tab, gen.setup());
      await bm.openFold(tab, "exercises");
      // A name taken (any case) is refused; a rename shows everywhere.
      await p.click('#exercisesList .row-btn:has-text("Squat")');
      await p.fill("#exerciseName", "bench PRESS");
      await p.click('#exerciseForm button[type="submit"]');
      has(lastDialog(tab), "There's already an exercise called", "a taken name");
      await p.fill("#exerciseName", "Back squat");
      await p.click('#exerciseForm button[type="submit"]');
      ok(await p.locator("#exerciseOverlay").evaluate(el => !el.classList.contains("open")), "the pop-up closes on Save");
      has((await bm.rows(tab, "exercises")).join("|"), "Back squat", "the renamed exercise");
      // Esc with a change asks first; saying no keeps the pop-up.
      await p.click('#exercisesList .row-btn:has-text("Deadlift")');
      await p.fill("#exerciseName", "Deadlift (conventional)");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      has(lastDialog(tab), "Discard your changes to this exercise?", "Esc with a change asks");
      ok(await p.locator("#exerciseOverlay").evaluate(el => el.classList.contains("open")), "still open after saying no");
      await p.click("#exerciseCancelBtn");

      // The routine pop-up: an exercise twice, sets out of range and a weight that isn't one are refused.
      await bm.openFold(tab, "routines");
      await p.click('#routinesList .row-btn:has-text("Push")');
      const line = i => p.locator("#routineLines .line").nth(i);
      await line(1).locator("select").selectOption({ label: "Bench press" });
      await p.click('#routineForm button[type="submit"]');
      has(lastDialog(tab), "is in this routine twice", "an exercise twice");
      await line(1).locator("select").selectOption({ label: "Overhead press" });
      await line(0).locator('input[data-f="sets"]').fill("11");
      await p.click('#routineForm button[type="submit"]');
      has(lastDialog(tab), "sets go from 1 to 10", "too many sets");
      await line(0).locator('input[data-f="sets"]').fill("4");
      await line(0).locator('input[data-f="weight"]').fill("-5");
      await p.click('#routineForm button[type="submit"]');
      has(lastDialog(tab), "the weight goes from 0 to 2000", "a negative weight");
      await line(0).locator('input[data-f="weight"]').fill("140");
      await p.click('#routineForm button[type="submit"]');
      const push = await p.evaluate(() => Kyoshi.apps.badgermole.routineById("rt-push").items[0]);
      eq([push.sets, push.weight, push.unit], [4, 140, "lb"], "the saved line");

      // Deleting an exercise in a routine: the routine loses its line; the sessions would keep its name.
      await bm.openFold(tab, "exercises");
      await p.click('#exercisesList .row-btn:has-text("Overhead press")');
      await p.click("#exerciseDeleteBtn");
      has(lastDialog(tab), "It's in 1 routine: it'll come out of it.", "delete says where it's used");
      eq(await bm.rows(tab, "routines"), ["Push · 2 exercises", "Pull · 3 exercises", "Legs · 2 exercises"], "Push lost a line");
      // Deleting a routine takes it out of the program.
      await p.click('#routinesList .row-btn:has-text("Pull")');
      await p.click("#routineDeleteBtn");
      has(lastDialog(tab), "It comes out of the program too", "delete routine asks");
      await bm.openFold(tab, "program");
      eq(await bm.programRows(tab), ["Push (next)", "Legs"], "the program without Pull");
      const kept = await p.evaluate(() => ({ ex: Kyoshi.apps.badgermole.S.exercises.filter(e => e.deleted).map(e => Object.keys(e).sort().join()), rt: Kyoshi.apps.badgermole.S.routines.filter(r => r.deleted).length }));
      eq(kept, { ex: ["at,deleted,id,u"], rt: 1 }, "deleted ones stay as bare markers");
    }
  },
  {
    name: "setup: phone layout (folds, thumb-sized controls, number pads) and a wide window",
    async run(t) {
      const phone = await open(t), p = phone.page;
      await importBackup(phone, gen.history({ weeks: 2 }));
      await p.reload();
      await p.waitForFunction(() => Kyoshi.apps.badgermole.started);
      for (const fold of ["exercises", "routines", "program", "settings"]) ok(!(await p.locator(`#${fold}Box`).evaluate(el => el.open)), `${fold} folded on a phone`);
      const startBox = await p.locator('#nextUp [data-act="start"]').boundingBox();
      ok(startBox.height >= 52 && startBox.width >= 300, `Start is thumb-sized (${startBox.width}×${startBox.height})`);
      await bm.start(phone, "Push");
      for (const sel of ["#weightInput", "#repsInput", '[data-step="weight"][data-dir="1"]', "#logBtn"]) {
        const box = await p.locator(sel).boundingBox();
        ok(box.height >= 56, `${sel} is at least 56px tall (${box.height})`);
      }
      eq(await p.locator("#weightInput").getAttribute("inputmode"), "decimal", "the weight opens the number pad");
      eq(await p.locator("#repsInput").getAttribute("inputmode"), "numeric", "reps open the number pad");
      // The bar stays on screen at the top and the bottom of the page.
      for (const y of [0, 5000]) {
        await p.evaluate(v => window.scrollTo(0, v), y);
        const bar = await p.locator(".session-bar").boundingBox();
        ok(bar.y >= 0 && bar.y + bar.height <= 844 + 1, `the bar is on screen when scrolled to ${y} (y ${bar.y})`);
      }
      const hScroll = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      ok(!hScroll, "no sideways scrolling on a phone");

      const wide = await open(t, { size: DESKTOP }), w = wide.page;
      for (const fold of ["exercises", "routines", "program", "settings"]) ok(await w.locator(`#${fold}Box`).evaluate(el => el.open), `${fold} open on a wide window`);
      lacks(await w.locator("#kMount").innerText(), "undefined", "no 'undefined' anywhere on the page");
    }
  }
];
