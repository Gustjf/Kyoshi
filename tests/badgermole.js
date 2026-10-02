/* Kyoshi · tests/badgermole.js — Badgermole's screens as the tests read and use them: Next up, the stats, the
 * calendar's days, the setup folds' rows, and the session (its steppers, logged sets and exercise list), plus doing a
 * whole session with taps. Selectors live here, so a markup change is fixed in one place. */
"use strict";

const nextUp = tab => tab.page.locator("#nextUp").innerText();
const stats = async tab => ({ week: await tab.page.locator("#weekVal").innerText(), streak: await tab.page.locator("#streakVal").innerText() });
// The rows of a setup fold ("exercises", "routines"), each "Name · meta"; the program's ("Push (next)"). The fold is
// opened first, as the user would.
async function rows(tab, fold) {
  await openFold(tab, fold);
  return tab.page.$$eval(`#${fold}List .row-btn`, els => els.map(e => e.innerText.replace(/\s*\n\s*/g, " · ").trim()));
}
async function programRows(tab) {
  await openFold(tab, "program");
  return tab.page.$$eval("#programList .prog-row", els => els.map(e => e.querySelector(".prog-name").innerText + (e.classList.contains("next") ? " (next)" : "")));
}
// The calendar's filled days: { "YYYY-MM-DD": "2" or "2×2" }.
const filledDays = tab => tab.page.$$eval("#calGrid .cal-day.filled", els => Object.fromEntries(els.map(e => [e.dataset.date, e.innerText.replace(/\s+/g, "")])));

async function openFold(tab, fold) {
  const box = tab.page.locator(`#${fold}Box`);
  if (!(await box.evaluate(el => el.open))) await tab.page.click(`#${fold}Box > summary`);
}

// The session screen as it is: the exercise, "Set 2 of 3", the steppers, the note, the logged sets and the list.
async function screen(tab) {
  const p = tab.page;
  return {
    exercise: await p.locator("#exName").innerText(),
    set: await p.locator("#setNo").innerText(),
    weight: await p.locator("#weightInput").inputValue(),
    reps: await p.locator("#repsInput").inputValue(),
    weightLabel: await p.locator("#weightLabel").innerText(),
    up: await p.locator("#upNote").isVisible(),
    logged: await p.$$eval("#loggedList .logged-set", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim())),
    list: await p.$$eval("#exList .ex-chip", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim())),
    status: await p.locator("#logStatus").innerText(),
    next: await p.locator("#nextBtn").innerText()
  };
}

// Starts a routine: the big Start when it's next, else through Pick another routine.
async function start(tab, name) {
  const p = tab.page;
  if ((await nextUp(tab)).includes(name) && await p.locator('#nextUp [data-act="start"]').count()) await p.click('#nextUp [data-act="start"]');
  else {
    await p.click('#nextUp [data-act="pick"]');
    await p.click(`#pickList .pick-btn:has-text("${name}")`);
  }
  await p.waitForSelector("#sessionView:not([hidden])");
}

// Logs every planned set of every exercise as prefilled (Log all sets, then Next), then Finish; the day pop-up that
// opens is closed with Cancel. minutes: how long the session seems to take (the clock moves on).
async function doSession(tab, name, { minutes = 45 } = {}) {
  const p = tab.page;
  await start(tab, name);
  const count = await p.locator("#exList .ex-chip").count();
  for (let i = 0; i < count; i++) {
    if (!(await p.locator("#logAllBtn").isDisabled())) await p.click("#logAllBtn");
    if (i < count - 1) await p.click("#nextBtn");
  }
  await tab.ctx.clock.fastForward(minutes * 60000);
  await p.click("#finishBtn");
  await p.waitForSelector("#dayOverlay.open");
  await p.click("#dayCancelBtn");
}

module.exports = { nextUp, stats, rows, programRows, filledDays, openFold, screen, start, doSession };
