/* Momo · markup.js — Momo's page (A.markup): the board's view (the week tabs, the To Be Budgeted bank
 * with Tasks, the board, long-term goals) or Today's, and its pop-ups (card editor, goal editor, an event,
 * a card on Today, close-out).
 * The shell supplies the header, footer, Developer Mode and bug reports; the
 * [data-kyoshi="backup"] section is filled in by core/backup.js.
 * Ids only need to be unique within Momo (look them up with A.$). */
Kyoshi.apps.momo.markup = `
  <!-- Icons from Lucide (lucide.dev) — ISC License, Copyright (c) Lucide Icons and Contributors. -->
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></symbol>
  </svg>

  <section id="closeOutBanner" class="banner" hidden>
    <span id="closeOutBannerText"></span>
    <button id="closeOutBannerBtn">Review</button>
  </section>

  <!-- Today (today.js): now, next, the rest of today, then tomorrow. Momo opens here on a phone. -->
  <div class="today-view" id="todayView" hidden>
    <div class="today-bar">
      <div class="today-head"><h2>Today</h2><span class="today-date" id="todayDate"></span></div>
      <button class="secondary" id="weekBtn">Week</button>
    </div>
    <div id="todayBody"></div>
  </div>

  <div id="boardView">
  <div class="weekbar">
    <button class="secondary" id="todayBtn">Today</button>
    <div class="mode-toggle views" id="viewToggle">
      <button type="button" class="mode-btn" data-view="this"><span>This week</span><span class="vb-date" id="tabDate_this"></span><span class="vb-status" id="tabStatus_this"></span></button>
      <button type="button" class="mode-btn" data-view="next"><span>Next week</span><span class="vb-date" id="tabDate_next"></span><span class="vb-status" id="tabStatus_next"></span></button>
      <button type="button" class="mode-btn" data-view="base"><span>Baseline</span><span class="vb-date" id="tabDate_base"></span><span class="vb-status" id="tabStatus_base"></span></button>
    </div>
    <button class="secondary" id="closeOutNowBtn" hidden>Close out this week</button>
  </div>

  <section class="bank" id="bank">
    <div class="bank-top">
      <div class="bank-figure">
        <h2 id="bankLabel">To Be Budgeted</h2>
        <div class="bank-line" id="bankLine"><span class="bank-num" id="bankNum"></span><span class="bank-of" id="bankOf"></span></div>
        <div class="bank-msg" id="bankMsg"></div>
      </div>
      <div class="bank-actions">
        <button id="loadBaselineBtn">Load baseline</button>
        <button class="secondary" id="copyPrevBtn">Copy previous week</button>
        <button id="gotoBaselineBtn">Set up baseline &rarr;</button>
        <button id="sampleBaselineBtn">Start from a sample</button>
        <button class="secondary" id="fillGapsBtn">Fill gaps with Free time</button>
        <button class="secondary" id="reopenBtn">Reopen week</button>
        <button class="secondary" id="saveAsBaseBtn">Save as baseline</button>
        <button class="secondary" id="clearBtn">Clear week</button>
      </div>
    </div>
    <!-- Tasks: what other apps need that no block covers, each goal, what's ongoing in other apps, then cards without a day (tasks.js). -->
    <div class="tasks" id="tasks">
      <span class="tasks-label">Tasks</span>
      <span class="tasks-total" id="tasksTotal"></span>
      <div class="tasks-cards" id="taskCards"></div>
      <button class="secondary small tasks-add" id="addTaskBtn">+ New card</button>
    </div>
  </section>

  <div class="board-wrap" id="boardWrap">
    <div class="board" id="board"></div>
  </div>

  <section id="goalsSection">
    <div class="section-header">
      <h2>Long-term goals</h2>
      <button class="secondary small" id="newGoalBtn">+ New goal</button>
    </div>
    <div id="goalsEmpty" class="empty-msg">No goals yet. Add a long-term project &mdash; a novel, a language, a certification &mdash; and fund it a few hours every week.</div>
    <div id="goalsList"></div>
  </section>
  </div>

  <section data-kyoshi="backup"></section>

  <!-- Where a dragged card would land: one line per day it lands on (drop.js). -->
  <div id="dropLines"></div>

  <div class="overlay" id="cardOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cardModalTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="cardModalTitle">New card</h3>
      <div class="modal-hint card-from" id="cardFrom" hidden></div>
      <div class="field">
        <label for="cardTitle">What</label>
        <input type="text" id="cardTitle" maxlength="40" list="titleSuggestions" placeholder="e.g. Gym" autocomplete="off">
        <datalist id="titleSuggestions"></datalist>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="cardHours">Hours</label>
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
            <input type="number" id="cardHours" step="0.25" min="0.25" max="24">
            <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
          </div>
          <div class="note" id="cardInnerNote" hidden></div>
        </div>
        <div class="field" id="cardGoalField">
          <label for="cardGoal">Goal</label>
          <select id="cardGoal"></select>
        </div>
      </div>
      <div class="field">
        <div class="field-head">
          <label>Days</label>
          <span class="presets">
            <button type="button" class="secondary small" id="cardDailyBtn">Daily</button>
            <button type="button" class="secondary small" id="cardWeekdaysBtn">Weekdays</button>
            <button type="button" class="secondary small" id="cardClearDaysBtn">Clear</button>
          </span>
        </div>
        <div class="day-pills" id="cardDays"></div>
      </div>
      <div class="field" id="cardPinField">
        <label for="cardPin">Pinned at</label>
        <input type="text" id="cardPin" maxlength="5" inputmode="numeric" placeholder="e.g. 2300" autocomplete="off">
        <div class="note">It starts at this time in every week the baseline goes into. Leave it empty to start where the card above ends.</div>
      </div>
      <div class="field-row" id="cardInField">
        <div class="field">
          <label for="cardIn">Inside</label>
          <select id="cardIn"></select>
        </div>
        <div class="field" id="cardPosField">
          <label for="cardPos">Where</label>
          <select id="cardPos">
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>
      </div>
      <div class="field" id="cardColorField">
        <label>Colour</label>
        <div class="swatches" id="cardColors"></div>
        <div class="note" id="cardColorNote"></div>
      </div>
      <div class="modal-actions">
        <button id="cardSaveBtn">Save</button>
        <button class="secondary" id="cardCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="cardDeleteBtn">Delete</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="goalOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="goalModalTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="goalModalTitle">New goal</h3>
      <div class="field">
        <label for="goalName">Goal</label>
        <input type="text" id="goalName" maxlength="40" placeholder="e.g. Write the novel" autocomplete="off">
      </div>
      <div class="field mode-toggle" id="goalKind" role="group" aria-label="Measure the goal in">
        <button type="button" class="mode-btn" data-kind="total">Total hours</button>
        <button type="button" class="mode-btn" data-kind="weekly">Hours a week</button>
      </div>
      <div class="field-row">
        <div class="field" id="goalTargetField">
          <label for="goalTarget">Total hours</label>
          <input type="number" id="goalTarget" min="0.25" max="100000" step="0.25" placeholder="e.g. 500">
        </div>
        <div class="field" id="goalPerWeekField" hidden>
          <label for="goalPerWeek">Hours a week</label>
          <input type="number" id="goalPerWeek" min="0.25" max="168" step="0.25" placeholder="e.g. 5">
        </div>
        <div class="field">
          <label for="goalDone">Done so far</label>
          <input type="number" id="goalDone" min="0" max="100000" step="0.25" placeholder="0">
        </div>
      </div>
      <p class="modal-hint" id="goalWeeklyNote" hidden>Each week it turns green once the week has these hours, yellow while it's short but enough hours are left to budget, and red when too few are.</p>
      <div class="field" id="goalDueField">
        <div class="field-head">
          <label for="goalDueMonth">Finish by (optional)</label>
          <span class="presets" id="goalSeasons">
            <button type="button" class="secondary small" data-season="0">Spring</button>
            <button type="button" class="secondary small" data-season="1">Summer</button>
            <button type="button" class="secondary small" data-season="2">Fall</button>
            <button type="button" class="secondary small" data-season="3">Winter</button>
          </span>
        </div>
        <div class="date-parts">
          <select id="goalDueMonth" aria-label="Month"></select>
          <input type="number" id="goalDueDay" min="1" max="31" step="1" inputmode="numeric" placeholder="Day" aria-label="Day">
          <input type="number" id="goalDueYear" min="2000" max="2999" step="1" inputmode="numeric" placeholder="Year" aria-label="Year">
        </div>
        <div class="date-foot" id="goalDueFoot">
          <span class="date-note" id="goalDueNote"></span>
          <button type="button" class="secondary small" id="goalDueClearBtn">Clear</button>
        </div>
      </div>
      <div class="field" id="goalMaxField">
        <label for="goalMax">Most hours a week</label>
        <input type="number" id="goalMax" min="0.25" max="168" step="0.25" placeholder="10">
        <div class="note">The goal turns red when finishing by its date would take more than this.</div>
      </div>
      <div class="field">
        <label>Colour</label>
        <div class="swatches" id="goalColors"></div>
        <div class="note" id="goalColorNote"></div>
      </div>
      <div class="modal-actions">
        <button id="goalSaveBtn">Save</button>
        <button class="secondary" id="goalCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="goalDeleteBtn">Delete</button>
      </div>
    </div>
  </div>

  <!-- An event from another app (triage.js): what it conflicts with and its quick fix, or (without a conflict) a time near its own to move it to. -->
  <div class="overlay" id="eventOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="eventTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 class="event-head"><span class="app-icon" id="eventIcon" aria-hidden="true"></span><span id="eventTitle"></span></h3>
      <p class="modal-hint" id="eventFrom"></p>
      <div class="event-clash" id="eventClash" hidden>
        <div id="eventClashText"></div>
        <div class="event-fixes" id="eventFixes"></div>
      </div>
      <div class="field" id="eventTimeField">
        <label for="eventTime" id="eventTimeLabel">Time</label>
        <div class="stepper event-time">
          <button type="button" class="step-btn" data-step="-1" aria-label="15 minutes earlier">&minus;</button>
          <input type="text" id="eventTime" data-clock maxlength="5" inputmode="numeric" placeholder="any time" autocomplete="off">
          <button type="button" class="step-btn" data-step="1" aria-label="15 minutes later">+</button>
        </div>
        <div class="note" id="eventNote" hidden></div>
      </div>
      <div class="modal-actions">
        <button id="eventMoveBtn">Move</button>
        <button class="secondary" id="eventCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="secondary small" id="eventResetBtn"></button>
      </div>
    </div>
  </div>

  <!-- A card tapped on Today (today.js): when, its goal, and what fills it with "Open in <App>". -->
  <div class="overlay" id="detailOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 class="event-head"><span class="detail-dot" id="detailDot" aria-hidden="true"></span><span id="detailTitle"></span></h3>
      <p class="modal-hint" id="detailWhen"></p>
      <div class="modal-hint card-from" id="detailFrom" hidden></div>
      <div class="modal-actions">
        <button id="detailCloseBtn">Close</button>
        <span class="spacer"></span>
        <button class="secondary" id="detailEditBtn">Edit card</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="closeOutOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="closeOutTitle">
      <h3 id="closeOutTitle">Close out the week</h3>
      <p class="modal-hint">Hours done toward each goal. Lower any that fell short.</p>
      <div id="closeOutRows"></div>
      <div class="modal-actions">
        <button id="closeOutConfirmBtn">Close out week</button>
        <button class="secondary" id="closeOutLaterBtn">Later</button>
      </div>
    </div>
  </div>
`;
