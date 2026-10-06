/* Momo · markup.js — Momo's page (A.markup): the board's view (the week tabs, the To Be Budgeted bank
 * with Tasks, a chunk per app, the board) or Today's, each with Upcoming weekends folded at its bottom, and
 * its pop-ups (card editor, an event, a card on Today, a weekend's plan and days off, the sleep routine, close-out).
 * The shell supplies the header, footer, Developer Mode and bug reports.
 * Ids only need to be unique within Momo (look them up with A.$). */
Kyoshi.apps.momo.markup = `
  <!-- Icons from Lucide (lucide.dev) — ISC License, Copyright (c) Lucide Icons and Contributors. -->
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></symbol>
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
    <details class="weekends"><summary></summary><div class="weekend-list"></div></details>
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
        <button class="secondary" id="sleepBtn">Sleep routine…</button>
        <button class="secondary" id="fillGapsBtn">Fill gaps with Free time</button>
        <button class="secondary" id="reopenBtn">Reopen week</button>
        <button class="secondary" id="saveAsBaseBtn">Save as baseline</button>
        <button class="secondary" id="clearBtn">Clear week</button>
      </div>
    </div>
    <!-- Tasks: what each app still needs a place for, a chunk per app, what's ongoing in other apps, then cards without a
         day (tasks.js); on the baseline, the true cost (truecost.js). -->
    <div class="tasks" id="tasks">
      <div class="tasks-head">
        <span class="tasks-label">Tasks</span>
        <span class="tasks-total" id="tasksTotal"></span>
        <button class="secondary small tasks-add" id="addTaskBtn">+ New card</button>
      </div>
      <div class="tasks-cards" id="taskCards"></div>
    </div>
  </section>

  <div class="board-wrap" id="boardWrap">
    <div class="board" id="board"></div>
  </div>
  <!-- Upcoming weekends (weekends.js), folded: also at the bottom of Today. -->
  <details class="weekends"><summary></summary><div class="weekend-list"></div></details>
  </div>

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
      <div class="field">
        <label for="cardHours">Hours</label>
        <div class="stepper">
          <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
          <input type="number" id="cardHours" step="0.25" min="0.25" max="24">
          <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
        </div>
        <div class="note" id="cardInnerNote" hidden></div>
      </div>
      <!-- Before & after (sides.js): cards inside it at its start and its end, a commute by default; none is the default. -->
      <div class="field" id="cardSidesField">
        <div class="field-head">
          <label for="cardSideTitle">Before &amp; after</label>
          <label class="check"><input type="checkbox" id="cardSidesSame"> Same both ways</label>
        </div>
        <input type="text" id="cardSideTitle" maxlength="40" list="titleSuggestions" placeholder="Commute" autocomplete="off">
        <div class="field-row sides-row">
          <div class="field">
            <label for="cardBefore">Minutes before</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
              <input type="number" id="cardBefore" step="15" min="0" max="240" data-minutes>
              <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
            </div>
          </div>
          <div class="field">
            <label for="cardAfter">Minutes after</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
              <input type="number" id="cardAfter" step="15" min="0" max="240" data-minutes>
              <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
            </div>
          </div>
        </div>
        <div class="note">Inside the card, at its start and its end. A pinned card's time is when the whole block starts.</div>
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
        <span class="card-change" id="cardChange" hidden></span>
        <button class="danger" id="cardDeleteBtn">Delete</button>
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

  <!-- A card tapped on Today (today.js): when, and what fills it with "Open in <App>"; one set in its app, where to change it. -->
  <div class="overlay" id="detailOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 class="event-head"><span class="detail-dot" id="detailDot" aria-hidden="true"></span><span id="detailTitle"></span></h3>
      <p class="modal-hint" id="detailWhen"></p>
      <div class="modal-hint card-from" id="detailFrom" hidden></div>
      <div class="modal-actions">
        <button id="detailCloseBtn">Close</button>
        <span class="spacer"></span>
        <span class="card-change" id="detailChange" hidden></span>
        <button class="secondary" id="detailEditBtn">Edit card</button>
      </div>
    </div>
  </div>

  <!-- A weekend's plan and days off around it (weekends.js): brief notes, kept by its Saturday; what's left of PTO with
       them, once it's set (timeoff.js). -->
  <div class="overlay" id="weekendOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="weekendTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="weekendTitle"></h3>
      <div class="field">
        <label for="weekendPlan">Plan</label>
        <input type="text" id="weekendPlan" maxlength="120" placeholder="Camping with …, or Rest" autocomplete="off">
      </div>
      <div class="field">
        <label>Days off</label>
        <div class="field-row off-row">
          <div class="field">
            <label for="weekendBefore">Before</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-step="-1" aria-label="Half a day less">&minus;</button>
              <input type="number" id="weekendBefore" step="0.5" min="0" max="5" data-days>
              <button type="button" class="step-btn" data-step="1" aria-label="Half a day more">+</button>
            </div>
            <div class="note" id="weekendBeforeNote"></div>
          </div>
          <div class="field">
            <label for="weekendAfter">After</label>
            <div class="stepper">
              <button type="button" class="step-btn" data-step="-1" aria-label="Half a day less">&minus;</button>
              <input type="number" id="weekendAfter" step="0.5" min="0" max="5" data-days>
              <button type="button" class="step-btn" data-step="1" aria-label="Half a day more">+</button>
            </div>
            <div class="note" id="weekendAfterNote"></div>
          </div>
        </div>
        <div class="note">Half days: the afternoon before, the morning after. Days off take no hours.</div>
        <div class="note" id="weekendPto" hidden></div>
      </div>
      <div class="modal-actions">
        <button id="weekendSaveBtn">Save</button>
        <button class="secondary" id="weekendCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="secondary" id="weekendClearBtn">Clear</button>
      </div>
    </div>
  </div>

  <!-- The sleep routine (sleep.js): pinned Sleep cards in the baseline, one per night split at midnight, with a wind-down
       before bed and a morning routine after waking inside them if you like. -->
  <div class="overlay" id="sleepOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sleepModalTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="sleepModalTitle">Sleep routine</h3>
      <p class="modal-hint">Makes pinned Sleep cards in the baseline, one per night, split at midnight. Load or reload the baseline to bring them into a week.</p>
      <div class="field-row sleep-row">
        <div class="field">
          <label for="sleepBed">Bedtime</label>
          <input type="text" id="sleepBed" maxlength="5" inputmode="numeric" placeholder="e.g. 2230" autocomplete="off">
        </div>
        <div class="field">
          <label for="sleepWake">Wake up</label>
          <input type="text" id="sleepWake" maxlength="5" inputmode="numeric" placeholder="e.g. 0700" autocomplete="off">
        </div>
      </div>
      <div class="note sleep-note" id="sleepNote"></div>
      <div class="field">
        <label>Nights</label>
        <div class="day-pills" id="sleepNights"></div>
        <div class="note">A night goes by the evening it starts: Fri is Friday night into Saturday.</div>
      </div>
      <div class="field">
        <label for="sleepWind">Wind down before bed</label>
        <div class="sleep-side">
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
            <input type="number" id="sleepWind" step="15" min="0" max="240" data-minutes aria-label="Minutes before bed">
            <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
          </div>
          <input type="text" id="sleepWindTitle" maxlength="40" placeholder="Wind down" autocomplete="off" aria-label="What it's called">
        </div>
      </div>
      <div class="field">
        <label for="sleepRise">Morning routine after waking</label>
        <div class="sleep-side">
          <div class="stepper">
            <button type="button" class="step-btn" data-step="-1" aria-label="Less">&minus;</button>
            <input type="number" id="sleepRise" step="15" min="0" max="240" data-minutes aria-label="Minutes after waking">
            <button type="button" class="step-btn" data-step="1" aria-label="More">+</button>
          </div>
          <input type="text" id="sleepRiseTitle" maxlength="40" placeholder="Morning routine" autocomplete="off" aria-label="What it's called">
        </div>
        <div class="note">In minutes, inside the night's cards: 0 for none.</div>
      </div>
      <div class="field">
        <label for="sleepName">The cards' title</label>
        <input type="text" id="sleepName" maxlength="40" placeholder="Sleep" autocomplete="off">
      </div>
      <div class="modal-status" id="sleepStatus" role="status"></div>
      <div class="modal-actions">
        <button id="sleepSaveBtn">Save</button>
        <button class="secondary" id="sleepCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="sleepRemoveBtn">Remove</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="closeOutOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="closeOutTitle">
      <h3 id="closeOutTitle">Close out the week</h3>
      <p class="modal-hint">Your goals' hours this week, as planned. Change any that differed. Errands, maintenance and the rest are marked done in their own apps.</p>
      <div id="closeOutRows"></div>
      <div class="modal-actions">
        <button id="closeOutConfirmBtn">Close out week</button>
        <button class="secondary" id="closeOutLaterBtn">Later</button>
        <span class="spacer"></span>
        <button class="secondary" id="closeOutAllBtn" hidden>Close all as planned</button>
      </div>
    </div>
  </div>
`;
