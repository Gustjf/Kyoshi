/* Wan Shi Tong · markup.js — the page (A.markup): In progress and Up next, the backlog (a
 * fold-away group per category, filled in by render.js), the Finished list, Backup & sync, the
 * add / edit pop-up, and the one asking what makes room when In progress is full. The shell
 * supplies the header, footer, Developer Mode and bug reports; core/backup.js fills
 * [data-kyoshi="backup"]. Ids only need to be unique within the app (look them up with A.$). */
Kyoshi.apps.wanshitong.markup = `
  <div class="spots">
    <section class="spot now">
      <h2>In progress <span class="count" id="nowCount"></span></h2>
      <div class="spot-body" id="nowBody"></div>
    </section>
    <section class="spot next">
      <h2>Up next</h2>
      <div class="spot-body" id="nextBody"></div>
    </section>
  </div>

  <section>
    <div class="section-header">
      <h2>Backlog <span class="count" id="backlogCount"></span></h2>
      <button id="addBtn">+ Add</button>
    </div>
    <div id="backlogEmpty" class="empty-msg"></div>
    <div id="backlogGroups"></div>
    <div class="footnote" id="backlogHint">Start puts a recommendation in progress (up to three at once), and Up next lines one up to take the place of the next you finish. Click a name to edit or delete it, or the magnifier to look it up on Google.</div>
  </section>

  <section id="finishedSection" hidden>
    <details id="finishedBox">
      <summary><h2>Finished <span class="count" id="finishedCount"></span></h2></summary>
      <ul class="items" id="finishedList"></ul>
    </details>
  </section>

  <section data-kyoshi="backup"></section>

  <div class="overlay" id="itemOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="itemModalTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="itemModalTitle">Add a recommendation</h3>
      <div class="field">
        <label>Category</label>
        <div class="choice-pills" id="itemCats"></div>
      </div>
      <div class="field">
        <label for="itemName">Name</label>
        <input type="text" id="itemName" maxlength="120" autocomplete="off">
      </div>
      <div class="field">
        <label for="itemInfo" id="itemInfoLabel">Author</label>
        <input type="text" id="itemInfo" maxlength="120" autocomplete="off">
      </div>
      <div class="field">
        <label>Have it?</label>
        <div class="choice-pills" id="itemHave"></div>
      </div>
      <div class="field" id="itemCostField">
        <label for="itemCost">Cost, $</label>
        <input type="number" id="itemCost" min="0" step="any" placeholder="0 if it's free">
      </div>
      <div class="field">
        <label for="itemWhy">Why it's here (optional)</label>
        <textarea id="itemWhy" rows="2" maxlength="500" placeholder="e.g. Sam's favourite, for when I want something hopeful"></textarea>
      </div>
      <div class="field-row" id="itemDates">
        <div class="field">
          <label for="itemAdded">Added</label>
          <input type="date" id="itemAdded">
        </div>
        <div class="field" id="itemDoneField">
          <label for="itemDone">Finished</label>
          <input type="date" id="itemDone">
        </div>
      </div>
      <div class="modal-actions">
        <button id="itemSaveBtn">Add</button>
        <button class="secondary" id="itemAnotherBtn" title="Adds this one, then clears the form for the next">Add another</button>
        <button class="secondary" id="itemCancelBtn">Cancel</button>
        <span class="spacer"></span>
        <button class="danger" id="itemDeleteBtn">Delete</button>
      </div>
      <div class="modal-status" id="itemStatus"></div>
    </div>
  </div>

  <div class="overlay" id="swapOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="swapTitle">
      <button class="modal-close" aria-label="Close">&times;</button>
      <h3 id="swapTitle">In progress is full</h3>
      <p class="modal-hint" id="swapText"></p>
      <div class="swap-list" id="swapList"></div>
      <div class="modal-actions">
        <button class="secondary" id="swapCancelBtn">Cancel</button>
      </div>
    </div>
  </div>
`;
