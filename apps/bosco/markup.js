/* Bosco · markup.js — Bosco's page (A.markup): its sections and its dose pop-up.
 * The shell supplies the header, footer, Developer Mode and bug reports; the
 * [data-kyoshi="backup"] section is filled in by core/backup.js.
 * Ids only need to be unique within Bosco (look them up with A.$). */
Kyoshi.apps.bosco.markup = `
  <section id="oneTimeInfoSection" hidden>
    <h2>Get Started</h2>
    <div class="row" id="oneTimeInfoFields"></div>
    <!-- Dosing plan and the one active vial, for the medication picked above (or already chosen). -->
    <div class="dosing" id="dosingBox" hidden>
      <div class="subhead" id="dosingTitle">Dosing</div>
      <div class="dose-fields">
        <div>
          <label for="doseIntervalInput">Days between doses</label>
          <input type="number" id="doseIntervalInput" step="1" min="1" max="14" placeholder="1–14">
        </div>
        <div>
          <label for="weeklyDoseInput">Weekly dose, mg</label>
          <input type="number" id="weeklyDoseInput" step="any" min="0">
        </div>
        <div>
          <label for="doseTimeInput">Usual dose time</label>
          <input type="time" id="doseTimeInput">
        </div>
      </div>
      <div class="note" id="eachDoseNote" hidden></div>
      <!-- What the schedule counts from; an anchor dose is only for starting or restarting doses. -->
      <div class="summary-line anchor-line">
        <span class="muted" id="anchorSummary"></span>
        <button type="button" class="secondary small" id="setAnchorBtn">Set anchor dose</button>
      </div>
      <div id="anchorEditor" hidden>
        <div class="dose-fields">
          <div>
            <label for="anchorDateInput">Anchor dose date</label>
            <input type="date" id="anchorDateInput">
          </div>
        </div>
        <div class="note">Only for starting or restarting doses: your schedule starts over with a dose on this day.</div>
      </div>
      <div class="subhead vial-head">Active vial</div>
      <div id="vialSummary">
        <div class="summary-line">
          <span id="vialSummaryText"></span>
          <button type="button" class="secondary small" id="changeVialBtn">Add vial</button>
        </div>
        <div class="note" id="vialUnitsNote" hidden></div>
      </div>
      <div class="vial-card" id="vialEditor" hidden>
        <div class="window-pills" id="vialModeToggle">
          <button type="button" class="pill active" data-vial-mode="mix">Vial mg + BAC water</button>
          <button type="button" class="pill" data-vial-mode="known">Known mg/mL</button>
        </div>
        <div id="vialMixWrap">
          <div class="row">
            <div>
              <label for="vialMgInput">Vial total, mg</label>
              <input type="number" id="vialMgInput" step="any" min="0" placeholder="e.g. 30">
            </div>
          </div>
          <div class="rate-head bac-head">
            <label for="bacMlInput">BAC water added</label>
            <span class="rate-value" id="bacMlValue">2 mL</span>
          </div>
          <input type="range" id="bacMlInput" step="0.1" min="1" max="3" value="2" autocomplete="off">
          <div class="rate-ticks bac-ticks" aria-hidden="true"></div>
          <div class="rate-labels"><span class="rl-min">1 mL</span><span class="rl-mid">2 mL</span><span class="rl-max">3 mL</span></div>
        </div>
        <div class="row" id="vialKnownWrap" hidden>
          <div>
            <label for="vialConcInput">Concentration, mg/mL</label>
            <input type="number" id="vialConcInput" step="0.001" min="0" placeholder="e.g. 20">
          </div>
        </div>
        <div class="note" id="vialCalcNote" hidden></div>
        <div class="actions">
          <button type="button" id="saveVialBtn">Save as active vial</button>
          <button type="button" class="secondary" id="cancelVialBtn">Cancel</button>
        </div>
      </div>
    </div>
    <!-- The weekly pace Current Trend's weekly rate is colored against. -->
    <div class="pace-goal" id="paceBox" hidden>
      <div class="subhead">Weekly pace goal</div>
      <div class="mode-toggle" id="paceDirToggle">
        <button type="button" class="mode-btn active" data-pace-dir="lose">Lose weight</button>
        <button type="button" class="mode-btn" data-pace-dir="gain">Gain weight</button>
      </div>
      <div class="dose-fields">
        <div>
          <label for="pacePctInput">Weekly target, %</label>
          <input type="number" id="pacePctInput" step="0.05" min="0" max="3" placeholder="e.g. 1">
        </div>
        <div>
          <label for="paceRangeInput">On-pace range, &plusmn;%</label>
          <input type="number" id="paceRangeInput" step="0.05" min="0" placeholder="e.g. 0.25">
        </div>
      </div>
      <div class="note" id="paceNote" hidden></div>
    </div>
    <div class="actions">
      <button id="oneTimeInfoSaveBtn">Save</button>
      <button class="secondary" id="oneTimeInfoCancelBtn" hidden>Cancel</button>
    </div>
  </section>

  <section>
    <h2>Add Entry</h2>
    <div class="row" id="entryRow">
      <div class="date-cell">
        <label for="dateInput">Date</label>
        <input type="date" id="dateInput">
      </div>
      <div>
        <label for="weightInput" id="weightInputLabel">Weight, lb</label>
        <input type="number" id="weightInput" step="0.1" min="0" placeholder="e.g. 185.4">
      </div>
      <div class="btn-cell"><button id="addBtn">Add Entry</button></div>
    </div>
  </section>

  <section id="upcomingDosesSection" class="med" hidden>
    <div class="vial-row">
      <h2 id="upcomingDosesTitle">Upcoming Tirzepatide Doses</h2>
      <span class="badge vial" id="upcomingVialBadge" hidden></span>
    </div>
    <div class="stat-grid" id="upcomingDosesGrid"></div>
  </section>

  <section id="statsSection" hidden>
    <h2>Current Trend</h2>
    <div class="stat-grid">
      <div class="stat">
        <div class="val" id="statRate">&mdash;</div><div class="lbl" id="statRateNote">weekly rate</div>
        <div class="lbl" id="statPace"></div>
        <div class="window-pills" id="trendWindowWrap">
          <button class="pill active" data-window="7">7d</button>
          <button class="pill" data-window="14">14d</button>
          <button class="pill" data-window="30">30d</button>
          <button class="pill" data-window="60">60d</button>
          <button class="pill" data-window="90">90d</button>
        </div>
      </div>
      <div class="stat">
        <div class="val" id="statAvg">&mdash;</div><div class="lbl" id="statAvgLabel">7-day rolling avg</div>
        <div class="window-pills" id="avgWindowWrap">
          <button class="pill active" data-avg-window="7">7d</button>
          <button class="pill" data-avg-window="14">14d</button>
          <button class="pill" data-avg-window="30">30d</button>
          <button class="pill" data-avg-window="60">60d</button>
          <button class="pill" data-avg-window="90">90d</button>
        </div>
      </div>
    </div>
  </section>

  <section>
    <h2>History</h2>
    <div id="historyEmpty" class="empty-msg">No entries yet. Add your first weigh-in above.</div>
    <div id="historyWrap" hidden>
      <table>
        <thead><tr><th>Date</th><th>Weight</th><th>Change</th><th class="med" id="doseColumnHead">Tirzepatide Dose</th><th></th></tr></thead>
        <tbody id="historyBody"></tbody>
      </table>
      <div class="pagination">
        <span id="pageInfo"></span>
        <div>
          <button class="secondary small" id="prevPageBtn">&larr; Newer</button>
          <button class="secondary small" id="nextPageBtn">Older &rarr;</button>
        </div>
      </div>
    </div>
    <div id="trackedSpanNote" class="footnote"></div>
  </section>

  <section id="goalsSection" hidden>
    <div class="section-header">
      <h2>Goal Weights</h2>
      <button class="icon-btn" id="exportImageBtn" title="Export progress as image" aria-label="Export goals as image">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
      </button>
    </div>
    <div class="row">
      <div>
        <label for="goalInput">Add goal weight</label>
        <input type="number" id="goalInput" step="0.1" min="0" placeholder="e.g. 150">
      </div>
      <div class="btn-cell"><button id="addGoalBtn" class="secondary">Add Goal</button></div>
    </div>

    <div class="proj-box">
      <div class="subhead">Projection settings &mdash; drives the ETAs below</div>
      <div class="mode-toggle" id="rateModeToggle">
        <button type="button" class="mode-btn active" data-rate-mode="trend">Current trend</button>
        <button type="button" class="mode-btn" data-rate-mode="custom">Custom weekly %</button>
      </div>
      <div id="customRateWrap" hidden>
        <div class="rate-head">
          <label for="customRate">Custom weekly rate toward goal</label>
          <span class="rate-value" id="customRateValue">0%</span>
        </div>
        <input type="range" id="customRate" step="0.25" min="-2" max="1" value="0" autocomplete="off">
        <div class="rate-ticks" aria-hidden="true"></div>
        <div class="rate-labels"><span class="rl-min">&minus;2%</span><span class="rl-zero">0%</span><span class="rl-max">+1%</span></div>
      </div>
      <div id="goalsRateNote" class="note"></div>
      <div class="stat-grid" id="futureWeightGrid"></div>
    </div>

    <table class="goals-table">
      <thead><tr><th>Goal</th><th>Status</th><th>ETA / Date Achieved</th><th></th></tr></thead>
      <tbody id="goalsBody"></tbody>
    </table>
  </section>

  <section id="chartSection" hidden>
    <h2>Chart</h2>
    <svg id="chartSvg" viewBox="0 0 640 320" preserveAspectRatio="xMidYMid meet"></svg>
    <div class="legend">
      <span><span class="swatch"></span> Actual history</span>
      <span><span class="swatch goal"></span> Active goals</span>
    </div>
  </section>

  <section data-kyoshi="backup"></section>

  <!-- Asks about a scheduled dose once it's due; nothing is logged until it's confirmed,
       and then as scheduled (its amount, on its day or, for a late one taken late, today),
       with nothing to edit. -->
  <div class="overlay" id="doseOverlay">
    <div class="modal" role="dialog" aria-labelledby="doseModalTitle">
      <h3 id="doseModalTitle">Did you take your dose?</h3>
      <p class="modal-hint" id="doseModalText"></p>
      <div class="stat">
        <div class="vial-row">
          <div class="val" id="doseModalMg"></div>
          <span class="badge vial" id="doseModalVial" hidden></span>
        </div>
        <div class="dose" id="doseModalUnits" hidden></div>
        <div class="lbl" id="doseModalWeekly"></div>
      </div>
      <div class="modal-actions">
        <button id="doseLogBtn">Log dose</button>
        <button id="doseTodayBtn" hidden>Took it today</button>
        <button class="secondary" id="doseSnoozeBtn">Not yet</button>
        <button class="secondary" id="dosePostponeBtn">Postpone to tomorrow</button>
      </div>
    </div>
  </div>
`;
