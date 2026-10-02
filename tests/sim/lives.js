/* Kyoshi · tests/sim/lives.js — the six made-up lives of the flow test (testplan.md): each an archetype and a seed, its world on
 * the first day (world.js), its habits (how reliable it is in each app, when it plans, how it treats the close-out, which
 * devices it uses) and a timeline of life events. A life:
 *   { id, n, name, seed, years, step: "daily" | "weekly", tz, world, habits, events: [{ from, to, kind, … }], screens(week, date) }
 * habits: { rel: { default, <app> } (the chance a planned thing gets done), phone: true (opens Momo's Today each morning),
 *   computer: weekdays planned on the computer (0 = Monday; "alternate": Sunday every other week), plan: { baseline: "reload" |
 *   "load" | "copy" | "none" (and baselineFrom: a week number), skill (the share of Tasks placed), fillGaps, early (closes out on
 *   Sunday) }, closeOut: "confirm" | "later2" (Later twice, then confirm) | "late" (only when the banner nags for a week),
 *   errands: a week, overdueShare, people: a new person every N days, meetings: the chance a meeting is held when due,
 *   checkups: days between checkups (0: never), workouts: the share of the target done, turtleduck: "full" | "dinners" | null,
 *   joins: { app: the day it's first used } }
 * events: vacation (nothing touched), sick (apps opened, nothing done), gap (nothing at all, then a return), baby (baseline
 *   rewritten, goals paused a season, reliability down for three months), reinstall (Export all → fresh profile → Import all),
 *   oldImport (a year-1 backup over current data), twoTabs (a month with a phone tab and a computer tab), renameGoal, dropGoal,
 *   newJob, retire. Weeks count from 0, the week of the start day (2026-09-28). */
"use strict";
const { addDays } = require("../lib");

const START = "2026-09-30"; // the tests' TODAY: a Wednesday eight days into fall
const ALL = ["momo", "bosco", "wanshitong", "appa", "hawky", "iroh", "badgermole", "turtleduck", "pabu"];
const weekOf = (date, start = START) => Math.floor((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - Date.UTC(2026, 8, 28)) / 864e5 / 7);
// A week is a "screens" week: every action through the real page.
const every = () => true;
const sampled = (n, extra = () => false) => (week, date, life) => week % n === 0 || extra(week, date) || life.eventIn(week);

const plannerWorld = { apps: ALL, baseline: "full", hawky: { open: 6 }, pabu: { people: 15, visits: 0.15 }, appa: "small", badgermole: { target: 3, weeks: 8 }, turtleduck: "full", iroh: { areas: 3, year: 2, season: "planner" }, checkups: 10 };
const plannerHabits = {
  rel: { default: 0.9 }, phone: true, computer: [6], planAt: "19:00",
  plan: { baseline: "reload", skill: 0.95, fillGaps: true, early: true }, closeOut: "confirm",
  errands: 5, overdueShare: 0.1, people: 90, meetings: 0.95, checkups: 30, workouts: 1, turtleduck: "full", recipes: 120
};

const LIVES = [
  {
    id: "planner", n: 1, name: "Sunday planner", seed: 1101, years: 1, step: "daily", tz: "UTC", screens: every,
    world: plannerWorld, habits: plannerHabits,
    events: [{ from: "2027-02-15", to: "2027-02-21", kind: "vacation" }, { from: "2027-05-10", to: "2027-05-16", kind: "sick" }]
  },
  {
    id: "parent", n: 2, name: "Overloaded parent", seed: 2202, years: 1, step: "daily", tz: "UTC", screens: every,
    world: { apps: ["momo", "appa", "hawky", "iroh", "badgermole", "turtleduck", "pabu"], baseline: "full", hawky: { open: 14 }, pabu: { people: 25, visits: 0.3 }, appa: "big", badgermole: { target: 3, weeks: 6 }, turtleduck: "dinners", iroh: { areas: 4, year: 3, season: "parent" }, checkups: 25 },
    habits: {
      rel: { default: 0.6, hawky: 0.55, pabu: 0.5 }, phone: true, computer: "alternate", planAt: "21:00", phoneDays: 0.85, mondayPhonePlan: 0.5,
      plan: { baseline: "load", baselineFrom: 6, skill: 0.6, fillGaps: true, early: false }, closeOut: "later2",
      errands: 10, overdueShare: 0.35, people: 45, meetings: 0.45, checkups: 0, workouts: 0.5, turtleduck: "dinners", recipes: 0
    },
    events: [{ from: "2027-01-18", to: "2027-01-31", kind: "gap" }, { on: "2026-11-16", kind: "renameGoal", goal: "sg-piano", title: "Piano lessons" },
      { on: "2027-02-08", kind: "dropGoal" }]
  },
  {
    id: "light", n: 3, name: "Cold start, light", seed: 3303, years: 1, step: "daily", tz: "UTC", screens: every,
    world: null, // nothing to start with: everything is added through the apps
    habits: {
      rel: { default: 0.75 }, phone: true, phoneOnly: true, computer: [], planAt: "20:00",
      plan: { baseline: "none", skill: 0.7, fillGaps: false, early: false }, closeOut: "confirm",
      errands: 3, overdueShare: 0.15, people: 120, meetings: 0.7, checkups: 0, workouts: 0.8, turtleduck: null, recipes: 0,
      joins: { hawky: START, pabu: START, badgermole: "2026-10-03", iroh: "2027-04-12", turtleduck: "2027-06-07" }
    },
    events: []
  },
  {
    id: "changes", n: 4, name: "Life changes", seed: 4404, years: 3, step: "daily", tz: "UTC", screens: sampled(4),
    world: plannerWorld, habits: plannerHabits,
    events: [
      { from: "2027-12-06", to: "2028-03-05", kind: "baby" },
      { from: "2028-04-17", to: "2028-08-13", kind: "gap" },
      { on: "2029-02-05", kind: "reinstall" }, { on: "2029-02-12", kind: "oldImport" },
      { from: "2029-03-05", to: "2029-04-01", kind: "twoTabs" }
    ]
  },
  {
    id: "seasons", n: 5, name: "Seasons", seed: 5505, years: 3, step: "daily", tz: "UTC",
    screens: sampled(4, (w, d) => +d.slice(8) >= 25),
    world: { ...plannerWorld, iroh: { areas: 5, year: 3, season: "seasons" }, appa: "big", pabu: { people: 20, visits: 0.1, leap: true } },
    habits: { ...plannerHabits, meetings: 1, irohLed: true, programChanges: true, templates: true },
    events: [{ on: "2028-02-29", kind: "leap" }]
  },
  {
    id: "long", n: 6, name: "The long haul", seed: 6606, years: 10, step: "weekly", tz: "America/Chicago",
    screens: (week, date, life) => life.milestone(week, date),
    world: plannerWorld, habits: { ...plannerHabits, rel: { default: 0.85 } },
    events: [{ on: "2030-03-04", kind: "replaceThings" }, { on: "2032-01-05", kind: "newJob" }, { on: "2035-01-08", kind: "retire" }]
  }
];

module.exports = { LIVES, START, ALL, weekOf, addDays };
