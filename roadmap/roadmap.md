# Kyoshi roadmap: what's being built, and where the finished plans are
`roadmap/` holds the plan in progress, one dated file per plan (`<date>_<name>_plan.md`); a plan moves to
`roadmap/archive/` once every phase is ticked, kept for its decisions. This file is the index: read it first, then only
the plan you're running (its top sections and your phase).

## In progress
Nothing right now.

## How a plan is run
1. A new session; the strongest model the budget allows for anything that touches stored data or sync. Say "Execute
   phase N of roadmap/<file>".
2. The executing model reads the root `CLAUDE.md` (automatic), the plan's top sections and its phase, then the phase's
   **Read first** files, nothing else up front. It builds the phase as one unit, adds the phase's tests and runs
   `node tests/run.js`, checks by hand from disk (console, phone width, time travel, Export then Import), bumps the
   changelogs and the build stamp, pushes to `main` unless the plan says a branch, then ticks the phase in the plan's
   *Status* with what was decided, and keeps the `CLAUDE.md` files current.
3. The owner lives with it a few days and sends notes in one batch; a batch becomes the next plan (or a phase added to
   this one).
4. Once every phase is ticked, the plan moves to `archive/` and leaves this index.

## Finished (in `archive/`, dated; each keeps its decisions)
- `2026-10-02_momo_center_plan.md` — the system around Momo, phases 0–8 (the inbox, Today, meetings, Hawky, Iroh,
  Momo's close-out, Badgermole, Turtleduck, Pabu, the flow fixes). Its top sections still describe the system as built:
  how we work, the decisions, the shape of the system, what each app sends Momo, verification.
- `2026-10-03_v4_feedback.md`, `2026-10-03_v4_plan.md`, `2026-10-03_v4_phase7_plan.md` — v4: the owner's app-by-app
  feedback, the plan built from it, and Phase 7 (Turtleduck sets the times) planned on its own.
- `2026-10-05_feedback_batch_plan.md` — 19 reports, eight phases.
- `2026-10-06_cloud_sync_plan.md` — cloud sync through a private GitHub repository, three phases.
- `2026-10-06_feedback_batch_plan.md` — 14 reports, seven phases (Bosco's sites by body part, bug reports in the cloud,
  the daily cloud backup, Momo's PTO).
- `2026-10-08_audit_plan.md` — the codebase audit: seven bugs, then sync hardening (the shared merge).
- `2026-10-08_tests_speed_plan.md` — the end-to-end tests, faster and side by side.
- `2026-10-08_feedback_batch_plan.md` — 8 reports, six phases (a report deleted, the theme and Bosco's answers following
  you, Hawky's Bought, Pabu's partner).
- `2026-10-11_bosco_retinoids_plan.md` — retinoid build-up reminders in Bosco (tazarotene, tretinoin), two phases (the
  feature; Hold this step a week, Undo, Developer Mode's lines). Nothing of it goes to Momo (the owner's choice).
