/* Hawky · markup.js — the page (A.markup): quick add (the field and Add, then the day and estimate
 * chips, each with the field its last chip asks for), the list (its groups filled in by render.js), the
 * Done fold, Backup & sync, and the errand pop-up. The shell supplies the header, footer, Developer Mode
 * and bug reports; core/backup.js fills [data-kyoshi="backup"]. Ids only need to be unique within the
 * app (look them up with A.$). */
Kyoshi.apps.hawky.markup = `
  <section class="quick-add">
    <form id="addForm" novalidate autocomplete="off">
      <div class="add-line">
        <input type="text" id="addText" maxlength="60" placeholder="New errand" aria-label="New errand" enterkeyhint="enter">
        <button type="submit" id="addBtn">Add</button>
      </div>
      <div class="chips" id="addDays" role="group" aria-label="When">
        <button type="button" class="mode-btn chip" data-day="today">Today</button>
        <button type="button" class="mode-btn chip" data-day="tomorrow">Tomorrow</button>
        <button type="button" class="mode-btn chip" data-day="pick">Pick a day</button>
        <button type="button" class="mode-btn chip" data-day="none">No day</button>
      </div>
      <input type="date" id="addDate" class="add-extra" aria-label="The day it's due" hidden>
      <div class="chips" id="addMinutes" role="group" aria-label="How long">
        <button type="button" class="mode-btn chip" data-minutes="15">15 min</button>
        <button type="button" class="mode-btn chip" data-minutes="30">30 min</button>
        <button type="button" class="mode-btn chip" data-minutes="60">1 hour</button>
        <button type="button" class="mode-btn chip" data-minutes="other">Other</button>
      </div>
      <input type="number" id="addOther" class="add-extra" min="5" max="480" step="5" inputmode="numeric" placeholder="Minutes, 5 to 480" aria-label="How many minutes" enterkeyhint="enter" hidden>
      <div class="add-status" id="addStatus" role="status"></div>
    </form>
  </section>

  <section>
    <h2>Errands <span class="count" id="openCount"></span></h2>
    <div id="listEmpty" class="empty-msg">Nothing to do. Add errands above as they come up.</div>
    <div id="groups"></div>
    <div class="footnote">Tick ✓ once one's done, or tap it to change or delete it. Each one is a card of its own in Momo: it waits in Momo's Tasks until you drag it onto a day.</div>
  </section>

  <section id="doneSection" hidden>
    <details id="doneBox">
      <summary><h2>Done <span class="count" id="doneCount"></span></h2></summary>
      <ul class="errands" id="doneList"></ul>
      <button type="button" class="secondary small" id="doneMore" hidden>Show more</button>
    </details>
  </section>

  <section data-kyoshi="backup"></section>

  <div class="overlay" id="errandOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="errandModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="errandModalTitle">Errand</h3>
      <form id="errandForm" novalidate autocomplete="off">
        <div class="field">
          <label for="errandText">What</label>
          <input type="text" id="errandText" maxlength="60">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="errandDue">Due (optional)</label>
            <input type="date" id="errandDue">
          </div>
          <div class="field">
            <label for="errandMinutes">Minutes</label>
            <input type="number" id="errandMinutes" min="5" max="480" step="5" inputmode="numeric">
          </div>
        </div>
        <p class="modal-hint" id="errandDoneNote" hidden></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="errandCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="errandDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>
`;
