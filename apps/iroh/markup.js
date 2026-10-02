/* Iroh · markup.js — the page (A.markup): This season (its goals, then Add), This year (its goals), Vision (the
 * areas), Earlier (past seasons' and years' goals, folded away), Backup & sync, and the pop-ups: a goal, its
 * reconcile, an area. The shell supplies the header (with Iroh's meetings), footer, Developer Mode and bug
 * reports; core/backup.js fills [data-kyoshi="backup"]. Ids only need to be unique within the app (look them up
 * with A.$). Buttons drawn here and by render.js carry data-act (events.js). */
Kyoshi.apps.iroh.markup = `
  <section>
    <div class="section-header">
      <h2>This season <span class="h2-sub" id="seasonName"></span></h2>
      <button type="button" data-act="add-season">+ Add a goal</button>
    </div>
    <div class="period-meta" id="seasonMeta"></div>
    <div id="seasonEmpty" class="empty-msg"></div>
    <ul class="goals" id="seasonGoals"></ul>
    <div class="footnote">Give a goal hours a week, or in total, and Momo fills your cards titled like it with them; what doesn't fit waits in its Tasks. Reconcile each goal at least once a month: is it on track, and what's the next step?</div>
  </section>

  <section>
    <div class="section-header">
      <h2>This year <span class="h2-sub" id="yearName"></span></h2>
      <button type="button" data-act="add-year">+ Add a goal</button>
    </div>
    <div class="period-meta" id="yearMeta"></div>
    <div id="yearEmpty" class="empty-msg">Three to five goals for the year, each with how you'll know it's done and why it matters. This season's goals serve them.</div>
    <ul class="goals" id="yearGoals"></ul>
  </section>

  <section>
    <div class="section-header">
      <h2>Vision</h2>
      <button type="button" class="secondary" data-act="add-area">+ Add an area</button>
    </div>
    <div id="visionEmpty" class="empty-msg">Start with the areas of your life (Health, Work, Family…): the picture of each in 10 years, and the milestones 5 years out.</div>
    <ul class="areas" id="areaList"></ul>
  </section>

  <section id="earlierSection" hidden>
    <details id="earlierBox">
      <summary><h2>Earlier <span class="h2-sub" id="earlierCount"></span></h2></summary>
      <div id="earlierList"></div>
      <div class="footnote">Carry over copies an open goal into this season, with its year goal, hours and next step.</div>
    </details>
  </section>

  <section data-kyoshi="backup"></section>

  <div class="overlay" id="goalOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="goalModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="goalModalTitle">Goal</h3>
      <p class="modal-hint" id="goalPeriod"></p>
      <form id="goalForm" novalidate autocomplete="off">
        <div class="field">
          <label for="goalTitle">Goal</label>
          <input type="text" id="goalTitle" maxlength="40" enterkeyhint="done">
          <div class="hint" id="goalTitleHint">Your cards in Momo with this title get its hours.</div>
        </div>
        <div class="field" id="goalParentField">
          <label for="goalParent">The year goal it serves</label>
          <select id="goalParent"></select>
          <div class="hint" id="goalParentNote"></div>
        </div>
        <div class="field" id="goalAreaField">
          <label for="goalArea">Area</label>
          <select id="goalArea"></select>
        </div>
        <div class="field" id="goalHoursField">
          <label id="goalHoursLabel">Hours</label>
          <div class="chips" id="goalHoursMode" role="group" aria-labelledby="goalHoursLabel">
            <button type="button" class="mode-btn chip" data-mode="none">None</button>
            <button type="button" class="mode-btn chip" data-mode="week">A week</button>
            <button type="button" class="mode-btn chip" data-mode="total">In total</button>
          </div>
          <input type="number" id="goalHours" min="0.25" step="0.25" inputmode="decimal" aria-label="How many hours" enterkeyhint="done">
        </div>
        <div class="field" id="goalNextField">
          <label for="goalNext">Next step</label>
          <input type="text" id="goalNext" maxlength="200" placeholder="The very next thing to do" enterkeyhint="done">
        </div>
        <div class="field">
          <label for="goalDoneWhen">Done when</label>
          <textarea id="goalDoneWhen" rows="2" maxlength="300" placeholder="How you'll know it's done"></textarea>
        </div>
        <div class="field">
          <label for="goalWhy">Why it matters</label>
          <textarea id="goalWhy" rows="2" maxlength="300"></textarea>
        </div>
        <div class="field" id="goalStatusField">
          <label id="goalStatusLabel">Status</label>
          <div class="chips" id="goalStatus" role="group" aria-labelledby="goalStatusLabel">
            <button type="button" class="mode-btn chip" data-status="open">Open</button>
            <button type="button" class="mode-btn chip" data-status="done">Done</button>
            <button type="button" class="mode-btn chip" data-status="dropped">Dropped</button>
          </div>
        </div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="goalCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="goalDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="recOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="recTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="recTitle">Reconcile</h3>
      <p class="modal-hint" id="recHint"></p>
      <form id="recForm" novalidate autocomplete="off">
        <div class="field">
          <label for="recNext">Next step</label>
          <input type="text" id="recNext" maxlength="200" placeholder="The very next thing to do" enterkeyhint="done">
        </div>
        <div class="modal-actions">
          <button type="submit">Reconciled ✓</button>
          <button type="button" class="secondary" id="recDoneBtn">Mark done</button>
          <button type="button" class="secondary" id="recDropBtn">Drop</button>
          <span class="spacer"></span>
          <button type="button" class="secondary" id="recCancelBtn">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="areaOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="areaModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="areaModalTitle">Area</h3>
      <form id="areaForm" novalidate autocomplete="off">
        <div class="field">
          <label for="areaName">Area</label>
          <input type="text" id="areaName" maxlength="30" placeholder="e.g. Health" enterkeyhint="done">
        </div>
        <div class="field">
          <label for="areaVision">In 10 years</label>
          <textarea id="areaVision" rows="4" maxlength="1000" placeholder="The picture: what this part of your life looks like"></textarea>
        </div>
        <div class="field">
          <label for="areaMilestones">In 5 years</label>
          <textarea id="areaMilestones" rows="3" maxlength="1000" placeholder="The milestones on the way"></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="areaCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="areaDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>
`;
