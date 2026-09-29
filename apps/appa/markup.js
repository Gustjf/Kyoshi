/* Appa · markup.js — the page (A.markup): three views, one on screen at a time (render.js) — home (Coming
 * up, Things, Records, Backup & sync), a thing (its reading, Schedule and History) and a job (what to do,
 * the timer) — and the pop-ups: thing, job, record (done / log / edit), reading and report. The shell
 * supplies the header, footer, Developer Mode and bug reports; core/backup.js fills [data-kyoshi="backup"].
 * Ids only need to be unique within the app (look them up with A.$). */
Kyoshi.apps.appa.markup = `
  <div class="timer-bar" id="timerBar" hidden></div>

  <div id="homeView">
    <section>
      <div class="section-header">
        <h2>Coming up</h2>
        <button class="secondary small" id="logWorkBtn" hidden>+ Log work</button>
      </div>
      <div id="comingUp"></div>
    </section>

    <section>
      <div class="section-header">
        <h2>Things</h2>
        <button id="addThingBtn">+ Add a thing</button>
      </div>
      <div id="thingsEmpty" class="empty-msg">Add the things you look after: a car, a robot vacuum, a floor jack… Then give each one the jobs from its manual.</div>
      <div class="rows" id="thingsList"></div>
      <details class="archived" id="archivedBox" hidden>
        <summary>Archived <span class="count" id="archivedCount"></span></summary>
        <div class="rows" id="archivedList"></div>
      </details>
    </section>

    <section id="recordsSection" hidden>
      <div class="section-header">
        <h2>Records</h2>
        <button class="secondary small" id="reportBtn">Report&hellip;</button>
      </div>
      <div id="homeRecords"></div>
    </section>

    <section data-kyoshi="backup"></section>
  </div>

  <div id="thingView" hidden>
    <button type="button" class="back-link" data-go="home">&larr; All things</button>
    <section>
      <div class="section-header thing-head">
        <div class="thing-title">
          <div class="thing-name" id="thName"></div>
          <div class="thing-about" id="thAbout"></div>
        </div>
        <div class="head-actions">
          <button class="secondary small" id="editThingBtn">Edit</button>
          <button class="secondary small" id="thingReportBtn">Report&hellip;</button>
        </div>
      </div>
      <div class="meter-line" id="meterLine"></div>
      <div class="sources" id="thSources"></div>
    </section>
    <section>
      <div class="section-header">
        <h2>Schedule</h2>
        <button class="small" id="addJobBtn">+ Job</button>
      </div>
      <div class="empty-msg" id="jobsEmpty">No jobs yet. Add each one from the manual: what to do, how often, and where it says so.</div>
      <div class="rows" id="jobsList"></div>
    </section>
    <section>
      <div class="section-header">
        <h2>History</h2>
        <button class="secondary small" id="addRecordBtn">+ Record</button>
      </div>
      <div id="thingRecords"></div>
    </section>
  </div>

  <div id="jobView" hidden>
    <button type="button" class="back-link" id="jobBack"></button>
    <section class="job-card">
      <div class="job-thing" id="jvThing"></div>
      <h2 class="job-title" id="jvTitle"></h2>
      <div class="job-due" id="jvDue"></div>
      <div class="job-source" id="jvSource"></div>
      <div class="job-notes" id="jvNotes"></div>
      <div class="job-last" id="jvLast"></div>
      <div class="job-actions" id="jvActions"></div>
      <div class="job-next" id="jvNext" hidden></div>
    </section>
  </div>

  <div class="overlay" id="thingOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tmTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="tmTitle">Add a thing</h3>
      <div class="field">
        <label for="tmName">Name</label>
        <input type="text" id="tmName" maxlength="28" placeholder="e.g. Civic, Robot vacuum, Floor jack" autocomplete="off">
      </div>
      <div class="field">
        <label for="tmAbout">Description (optional)</label>
        <input type="text" id="tmAbout" maxlength="100" placeholder="e.g. 2019 Honda Civic EX, blue" autocomplete="off">
      </div>
      <div class="field">
        <label for="tmSerial">VIN or serial number (optional)</label>
        <input type="text" id="tmSerial" maxlength="40" autocomplete="off">
      </div>
      <div class="field">
        <label>Keeps track of</label>
        <div class="choice-pills" id="tmMeter"></div>
        <div class="field-note" id="tmMeterNote"></div>
      </div>
      <div class="field-row" id="tmMeterFields">
        <div class="field">
          <label for="tmReading" id="tmReadingLabel">Odometer now</label>
          <input type="number" id="tmReading" min="0" step="any">
        </div>
        <div class="field">
          <label for="tmPace" id="tmPaceLabel">About how many a year?</label>
          <input type="number" id="tmPace" min="0" step="any" placeholder="e.g. 12000">
        </div>
      </div>
      <div class="field">
        <label>Manuals &amp; sources</label>
        <div class="docs" id="tmDocs"></div>
        <button type="button" class="secondary small" id="tmAddDoc">+ Add a source</button>
        <div class="field-note">Where the schedule comes from: "Owner's manual" with a link to its PDF, or where the paper copy is kept.</div>
      </div>
      <div class="modal-actions">
        <button id="tmSaveBtn">Add</button>
        <button class="secondary" id="tmCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="secondary small" id="tmArchiveBtn">Archive</button>
        <button class="danger" id="tmDeleteBtn">Delete</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="jobOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="jmTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="jmTitle">Add a job</h3>
      <div class="field">
        <label for="jmName">Job</label>
        <input type="text" id="jmName" maxlength="60" placeholder="e.g. Oil &amp; filter, Replace the filter, Charge the batteries" autocomplete="off">
      </div>
      <div class="field">
        <label for="jmMode">How often</label>
        <div class="sched-row">
          <select id="jmMode" class="auto">
            <option value="every">Every</option>
            <option value="season">Each season</option>
            <option value="none">By the meter only</option>
          </select>
          <input type="number" id="jmEveryN" min="1" max="999" step="1" class="num-short" aria-label="How many">
          <select id="jmEveryUnit" class="auto" aria-label="Days, weeks, months or years">
            <option value="d">days</option><option value="w">weeks</option><option value="m">months</option><option value="y">years</option>
          </select>
          <div class="choice-pills" id="jmSeasons"></div>
        </div>
        <div class="sched-row" id="jmMeterRow">
          <span id="jmOrEvery">or every</span>
          <input type="number" id="jmMeterEvery" min="0" step="any" class="num-mid" aria-label="Meter interval">
          <span id="jmMeterUnit"></span>
        </div>
        <div class="field-note" id="jmSchedNote"></div>
      </div>
      <div class="field-row" id="jmFromRow">
        <div class="field">
          <label for="jmFromDate">Last done, if you know</label>
          <input type="date" id="jmFromDate">
        </div>
        <div class="field" id="jmFromReadingField">
          <label for="jmFromReading" id="jmFromReadingLabel">At</label>
          <input type="number" id="jmFromReading" min="0" step="any">
        </div>
      </div>
      <div class="field-note" id="jmFromNote"></div>
      <div class="field-row">
        <div class="field">
          <label for="jmEst">About how long?</label>
          <input type="text" id="jmEst" placeholder="e.g. 30 min" autocomplete="off">
        </div>
        <div class="field">
          <label for="jmSource">Source</label>
          <select id="jmSource"></select>
        </div>
        <div class="field">
          <label for="jmWhere">Page or section</label>
          <input type="text" id="jmWhere" maxlength="60" placeholder="e.g. p. 214" autocomplete="off">
        </div>
      </div>
      <div class="field-row" id="jmNewDoc" hidden>
        <div class="field">
          <label for="jmDocTitle">New source</label>
          <input type="text" id="jmDocTitle" maxlength="60" placeholder="e.g. Owner's manual" autocomplete="off">
        </div>
        <div class="field">
          <label for="jmDocLink">Link, or where it's kept (optional)</label>
          <input type="text" id="jmDocLink" maxlength="800" placeholder="https://… or Glovebox" autocomplete="off">
        </div>
      </div>
      <div class="field">
        <label for="jmNotes">What you need and how (shown while you do it)</label>
        <textarea id="jmNotes" rows="6" maxlength="4000" placeholder="- Filter PH7317, 0W-20 × 4.4 qt&#10;- Drain plug 14 mm, 29 ft-lb, new washer&#10;- Reset the oil-life display"></textarea>
      </div>
      <div class="modal-actions">
        <button id="jmSaveBtn">Add</button>
        <button class="secondary" id="jmCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="jmDeleteBtn">Delete</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="recOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="rcTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="rcTitle">Done</h3>
      <div class="field" id="rcThingField">
        <label for="rcThing">Thing</label>
        <select id="rcThing"></select>
      </div>
      <div class="field" id="rcJobsField">
        <label id="rcJobsLabel">What was done</label>
        <div class="choice-pills" id="rcJobs"></div>
      </div>
      <div class="field" id="rcWhatField">
        <label for="rcWhat" id="rcWhatLabel">Other work</label>
        <input type="text" id="rcWhat" maxlength="60" placeholder="e.g. Replaced the wiper motor" autocomplete="off">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="rcDate">Done on</label>
          <input type="date" id="rcDate">
        </div>
        <div class="field">
          <label for="rcTook">Took</label>
          <input type="text" id="rcTook" placeholder="e.g. 45 min" autocomplete="off">
        </div>
        <div class="field" id="rcReadingField">
          <label for="rcReading" id="rcReadingLabel">Odometer</label>
          <input type="number" id="rcReading" min="0" step="any">
        </div>
      </div>
      <button type="button" class="more-link" id="rcMoreBtn">+ Details: who, cost, notes, photos &amp; PDFs</button>
      <div id="rcMore" hidden>
        <div class="field-row">
          <div class="field">
            <label for="rcBy">Done by</label>
            <input type="text" id="rcBy" list="rcShops" maxlength="40" placeholder="You" autocomplete="off">
            <datalist id="rcShops"></datalist>
          </div>
          <div class="field">
            <label for="rcCost">Cost</label>
            <input type="text" id="rcCost" inputmode="decimal" placeholder="$0.00" autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label for="rcNotes">Notes</label>
          <textarea id="rcNotes" rows="2" maxlength="2000" placeholder="Parts used, tread depth, anything worth remembering"></textarea>
        </div>
        <div class="field">
          <label>Proof</label>
          <div class="proof-list" id="rcProof"></div>
          <div class="proof-actions" id="rcProofActions">
            <button type="button" class="secondary small" id="rcAddPhoto">+ Photo</button>
            <button type="button" class="secondary small" id="rcAddPdf">+ PDF</button>
            <button type="button" class="secondary small" id="rcAddLink">+ Link</button>
            <input type="file" id="rcPhotoFile" accept="image/*" multiple hidden>
            <input type="file" id="rcPdfFile" accept="application/pdf,.pdf" multiple hidden>
          </div>
          <div class="link-entry" id="rcLinkEntry" hidden>
            <input type="text" id="rcLinkUrl" placeholder="https://…" autocomplete="off">
            <input type="text" id="rcLinkLabel" maxlength="60" placeholder="What it is, e.g. Parts list" autocomplete="off">
            <button type="button" class="small" id="rcLinkAdd">Add</button>
          </div>
          <div class="field-note" id="rcProofNote"></div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="rcSaveBtn">Done</button>
        <button class="secondary" id="rcCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="rcDeleteBtn">Delete</button>
      </div>
      <div class="modal-status" id="rcStatus"></div>
    </div>
  </div>

  <div class="overlay" id="readingOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rdTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="rdTitle">Reading</h3>
      <p class="modal-hint" id="rdHint"></p>
      <div class="field-row">
        <div class="field">
          <label for="rdValue" id="rdLabel">Reading</label>
          <input type="number" id="rdValue" min="0" step="any">
        </div>
        <div class="field">
          <label for="rdDate">On</label>
          <input type="date" id="rdDate">
        </div>
      </div>
      <div class="modal-actions">
        <button id="rdSaveBtn">Save</button>
        <button class="secondary" id="rdCancelBtn">Cancel</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="reportOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rpTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="rpTitle">Maintenance report</h3>
      <p class="modal-hint">A PDF of what was done, newest first, with each job's proof right after it: for a buyer, an insurer or your own files.</p>
      <div class="field">
        <label>Things</label>
        <div class="check-list" id="rpThings"></div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="rpFrom">From (optional)</label>
          <input type="date" id="rpFrom">
        </div>
        <div class="field">
          <label for="rpName">Your name</label>
          <input type="text" id="rpName" maxlength="80" autocomplete="name">
        </div>
      </div>
      <div class="field check-line">
        <label><input type="checkbox" id="rpCosts" checked> Costs</label>
        <label><input type="checkbox" id="rpPhotos" checked> Photos with each job</label>
      </div>
      <div class="modal-actions">
        <button id="rpMakeBtn">Make PDF</button>
        <button class="secondary" id="rpCancelBtn">Cancel</button>
      </div>
      <div class="modal-status" id="rpStatus"></div>
    </div>
  </div>
`;
