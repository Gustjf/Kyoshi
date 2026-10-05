/* Hawky · markup.js — the page (A.markup): the nav (Errands | Shopping), then one view at a time. Errands: quick
 * add (the field and Add, then the day and estimate chips, each with the field its last chip asks for, and + Note),
 * the list (its groups filled in by render.js) and the Done fold. Shopping: the add row (store, topic, item, + Note or
 * link), the lists by store and the Done fold (filled in by lists-view.js). Then Backup & sync, and the pop-ups
 * (errand, list, item). The shell supplies the header, footer, Developer Mode and bug reports; core/backup.js fills
 * [data-kyoshi="backup"]. Ids only need to be unique within the app (look them up with A.$). */
Kyoshi.apps.hawky.markup = `
  <div class="mode-toggle hawky-nav" id="nav" role="group" aria-label="Hawky">
    <button type="button" class="mode-btn" data-view="errands">Errands</button>
    <button type="button" class="mode-btn" data-view="lists">Shopping<span class="nav-ready" id="navReady"></span></button>
  </div>

  <div id="errandsView">
  <section class="quick-add">
    <form id="addForm" novalidate autocomplete="off">
      <div class="add-line">
        <input type="text" id="addText" maxlength="60" placeholder="New errand" aria-label="New errand" enterkeyhint="enter">
        <button type="submit" id="addBtn">Add</button>
      </div>
      <div class="chips days" id="addDays" role="group" aria-label="When">
        <button type="button" class="mode-btn chip" data-day="today">Today</button>
        <button type="button" class="mode-btn chip" data-day="week" title="Due this Sunday">This week</button>
        <button type="button" class="mode-btn chip" data-day="nextweek" title="Due next Sunday">Next week</button>
        <button type="button" class="mode-btn chip" data-day="pick">Pick a day</button>
        <button type="button" class="mode-btn chip" data-day="none">No day</button>
      </div>
      <input type="date" id="addDate" class="add-extra" aria-label="The day it's due" hidden>
      <div class="chips" id="addMinutes" role="group" aria-label="How long">
        <button type="button" class="mode-btn chip" data-minutes="5">5 min</button>
        <button type="button" class="mode-btn chip" data-minutes="15">15 min</button>
        <button type="button" class="mode-btn chip" data-minutes="30">30 min</button>
        <button type="button" class="mode-btn chip" data-minutes="60">1 hour</button>
        <button type="button" class="mode-btn chip" data-minutes="other">Other</button>
      </div>
      <input type="number" id="addOther" class="add-extra" min="5" max="480" step="5" inputmode="numeric" placeholder="Minutes, 5 to 480" aria-label="How many minutes" enterkeyhint="enter" hidden>
      <button type="button" class="note-btn" id="addNoteBtn">+ Note</button>
      <input type="text" id="addNote" class="add-extra" maxlength="200" placeholder="Note" aria-label="Note" enterkeyhint="enter" hidden>
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
  </div>

  <div id="listsView" hidden>
  <section class="quick-add">
    <form id="listForm" novalidate autocomplete="off">
      <div class="add-pair">
        <input type="text" id="listVendor" maxlength="40" placeholder="Store" aria-label="Store" list="hawkyVendors" enterkeyhint="next">
        <input type="text" id="listTopic" maxlength="40" placeholder="Topic" aria-label="Topic" list="hawkyTopics" enterkeyhint="next">
      </div>
      <div class="add-line">
        <input type="text" id="listItem" maxlength="100" placeholder="Item" aria-label="Item" enterkeyhint="enter">
        <button type="submit" id="listAddBtn">Add</button>
      </div>
      <button type="button" class="note-btn" id="listNoteBtn">+ Note or link</button>
      <input type="text" id="listNote" class="add-extra" maxlength="300" placeholder="Note or web link" aria-label="Note or web link" enterkeyhint="enter" hidden>
      <datalist id="hawkyVendors"></datalist>
      <datalist id="hawkyTopics"></datalist>
      <div class="add-status" id="listStatus" role="status"></div>
    </form>
  </section>

  <section>
    <h2>Shopping lists <span class="count" id="listsCount"></span></h2>
    <div id="listsEmpty" class="empty-msg">No lists yet. Add an item above: its store and topic make the list.</div>
    <div id="vendors"></div>
    <div class="footnote">Once everything's on a list, lock it for 30 or 7 days: while it cools off you can only take items off. Once it unlocks, tick each item as you buy it. Shopping lists stay here: nothing goes to Momo.</div>
  </section>

  <section id="listsDoneSection" hidden>
    <details id="listsDoneBox">
      <summary><h2>Done <span class="count" id="listsDoneCount"></span></h2></summary>
      <div id="listsDone"></div>
      <button type="button" class="secondary small" id="listsDoneMore" hidden>Show more</button>
    </details>
  </section>
  </div>

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
        <div class="field">
          <label for="errandNote">Note (optional)</label>
          <textarea id="errandNote" maxlength="200" rows="3"></textarea>
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
        <p class="modal-hint" id="errandPostponedNote" hidden></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="errandCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="errandDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="listOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="listModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="listModalTitle">Rename list</h3>
      <form id="listEditForm" novalidate autocomplete="off">
        <div class="field-row">
          <div class="field">
            <label for="listEditVendor">Store</label>
            <input type="text" id="listEditVendor" maxlength="40">
          </div>
          <div class="field">
            <label for="listEditTopic">Topic</label>
            <input type="text" id="listEditTopic" maxlength="40">
          </div>
        </div>
        <p class="modal-hint" id="listEditHint"></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="listEditCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="listDeleteBtn">Delete list</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="itemOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="itemModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="itemModalTitle">Item</h3>
      <form id="itemForm" novalidate autocomplete="off">
        <div class="field">
          <label for="itemText">What</label>
          <input type="text" id="itemText" maxlength="100">
        </div>
        <div class="field">
          <label for="itemNote">Note or web link (optional)</label>
          <textarea id="itemNote" maxlength="300" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="itemCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="itemRemoveBtn">Remove</button>
        </div>
      </form>
    </div>
  </div>
`;
