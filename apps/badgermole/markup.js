/* Badgermole · markup.js — the page (A.markup): two views, one on screen at a time (render.js) — Home (Next up, this
 * week and the streak, the calendar, the setup folds: Exercises, Routines, Program, Settings; Backup & sync) and the
 * session (session.js: the exercise, its steppers, ✓, the exercise list and the sticky Back · Next · Finish) — and
 * the pop-ups: exercise, routine, day and Pick a routine. The shell supplies the header, footer, Developer Mode and
 * bug reports; core/backup.js fills [data-kyoshi="backup"]. Ids only need to be unique within the app (A.$). */
(function (A) {
  "use strict";
  const { MAX_EXERCISE, MAX_ROUTINE, MAX_REPS, MAX_WEIGHT, MAX_TARGET } = A;
  // Icons from Lucide (ISC license): chevrons for the calendar's months.
  const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const fold = (id, title, body) => `
    <section class="setup">
      <details id="${id}Box">
        <summary><h2>${title} <span class="count" id="${id}Count"></span></h2></summary>
        <div class="fold-body">${body}</div>
      </details>
    </section>`;
  const stepper = (field, label, mode, less, more) => `
      <div class="stepper-row" id="${field}Row">
        <label class="stepper-label" for="${field}Input" id="${field}Label">${label}</label>
        <div class="stepper">
          <button type="button" class="step" data-step="${field}" data-dir="-1" aria-label="${less}">&minus;</button>
          <input type="number" id="${field}Input" inputmode="${mode}" min="0" max="${field === "reps" ? MAX_REPS : MAX_WEIGHT}" step="any" enterkeyhint="done">
          <button type="button" class="step" data-step="${field}" data-dir="1" aria-label="${more}">+</button>
        </div>
      </div>`;

  A.markup = `
  <div id="homeView">
    <section class="next-up" id="nextUp"></section>

    <section>
      <div class="stat-grid week-stats">
        <div class="stat"><div class="val" id="weekVal"></div><div class="lbl">This week</div></div>
        <div class="stat"><div class="val" id="streakVal"></div><div class="lbl">Streak</div></div>
      </div>
      <div class="cal-head">
        <button type="button" class="icon-btn" id="calPrev" aria-label="Previous month">${icon('<path d="m15 18-6-6 6-6"/>')}</button>
        <h2 id="calTitle"></h2>
        <button type="button" class="icon-btn" id="calNext" aria-label="Next month">${icon('<path d="m9 18 6-6-6-6"/>')}</button>
      </div>
      <div class="cal" id="calGrid"></div>
    </section>
    ${fold("exercises", "Exercises", `
        <div id="exercisesEmpty" class="empty-msg">No exercises yet. Add your own, or start with the usual ones.</div>
        <div class="rows" id="exercisesList"></div>
        <div class="toolbar">
          <button type="button" id="addExerciseBtn">+ Add exercise</button>
          <button type="button" class="secondary" id="starterBtn">Add the starter exercises</button>
        </div>`)}
    ${fold("routines", "Routines", `
        <div id="routinesEmpty" class="empty-msg"></div>
        <div class="rows" id="routinesList"></div>
        <div class="toolbar"><button type="button" id="addRoutineBtn">+ Add routine</button></div>`)}
    ${fold("program", "Program", `
        <div id="programEmpty" class="empty-msg">Nothing in the program yet: add your routines in the order you do them.</div>
        <ol class="program" id="programList"></ol>
        <div class="program-add">
          <select id="programSelect" aria-label="Routine to add to the program"></select>
          <button type="button" id="programAddBtn">Add to program</button>
        </div>
        <div class="footnote" id="programNote"></div>`)}
    ${fold("settings", "Settings", `
        <div class="field">
          <label>Weights in</label>
          <div class="mode-toggle unit-toggle" id="unitToggle" role="group" aria-label="Weights in">
            <button type="button" class="mode-btn" data-unit="lb">lb</button>
            <button type="button" class="mode-btn" data-unit="kg">kg</button>
          </div>
        </div>
        <div class="field target-field">
          <label for="targetInput">Workouts a week</label>
          <input type="number" id="targetInput" min="1" max="${MAX_TARGET}" step="1" inputmode="numeric">
        </div>
        <div class="footnote">Changing the unit converts nothing: each set keeps the unit it was logged in, and shows in this one.</div>`)}

    <section data-kyoshi="backup"></section>
  </div>

  <div id="sessionView" hidden>
    <button type="button" class="back-link" data-act="home">&larr; Home</button>
    <section class="session" id="sessionBox">
      <div class="session-head">
        <span class="session-name" id="sesName"></span>
        <span class="session-time" id="sesElapsed"></span>
        <span class="session-pos" id="sesPos"></span>
      </div>
      <div class="ex-name" id="exName"></div>
      <div class="set-no" id="setNo"></div>
      <div class="steppers">
        ${stepper("weight", "Weight", "decimal", "Less weight", "More weight")}
        ${stepper("reps", "Reps", "numeric", "One rep less", "One rep more")}
      </div>
      <div class="up-note" id="upNote" hidden>&uarr; from last time</div>
      <button type="button" class="log-btn" id="logBtn">&#10003; Log set</button>
      <button type="button" class="secondary log-all" id="logAllBtn">Log all sets</button>
      <div class="log-status" id="logStatus" role="status"></div>
      <ul class="logged" id="loggedList"></ul>
    </section>
    <section>
      <h2>Exercises</h2>
      <div class="ex-list" id="exList"></div>
      <button type="button" class="more-link" id="cancelSessionBtn">Cancel the session</button>
    </section>
    <div class="session-bar">
      <button type="button" class="secondary" id="backBtn">Back</button>
      <button type="button" class="secondary" id="nextBtn"></button>
      <button type="button" id="finishBtn">Finish</button>
    </div>
  </div>

  <div class="overlay" id="exerciseOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exerciseTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="exerciseTitle">Exercise</h3>
      <form id="exerciseForm" novalidate autocomplete="off">
        <div class="field">
          <label for="exerciseName">Name</label>
          <input type="text" id="exerciseName" maxlength="${MAX_EXERCISE}" placeholder="e.g. Bench press">
        </div>
        <label class="check"><input type="checkbox" id="exerciseBodyweight"> Bodyweight exercise (reps, plus any added weight)</label>
        <p class="modal-hint" id="exerciseUse" hidden></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="exerciseCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="exerciseDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="routineOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="routineTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="routineTitle">Routine</h3>
      <form id="routineForm" novalidate autocomplete="off">
        <div class="field">
          <label for="routineName">Name</label>
          <input type="text" id="routineName" maxlength="${MAX_ROUTINE}" placeholder="e.g. Pull A">
        </div>
        <div class="subhead">Exercises, in order</div>
        <div class="lines" id="routineLines"></div>
        <button type="button" class="secondary small" id="routineAddLineBtn">+ Add exercise</button>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="routineCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="routineDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="dayOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="dayTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="dayTitle">Day</h3>
      <form id="dayForm" novalidate autocomplete="off">
        <div id="daySessions"></div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="dayCancelBtn">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="pickOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pickTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="pickTitle">Pick a routine</h3>
      <div class="pick-list" id="pickList"></div>
    </div>
  </div>
`;
})(Kyoshi.apps.badgermole);
