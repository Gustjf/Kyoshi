/* Pabu · markup.js — the page (A.markup): This week (filled in by render.js; hidden while no one has a call, text or
 * visit), quick add (the name and Add, then the how-often and how chips), the Birthdays strip (shown when one is coming
 * up; its heading names the anniversary while there's one), People (the group chips and the list, filled in by
 * render.js), the person pop-up (the name and group, the birthday as month, day and an optional year, notes, their
 * calls, texts and visits — filled in by editor.js — then the line saying what stopped Save, and Save, Cancel and
 * Delete, kept in view at its foot), and Set up (who you're in a relationship with — filled in by setup.js — and the
 * anniversary as month, day and an optional year; the line saying what stopped Save, Save and Cancel). The shell
 * supplies the header, footer, Developer Mode and bug reports. Ids only need to be unique within the app (look them up
 * with A.$). */
Kyoshi.apps.pabu.markup = `
  <section id="weekSection" hidden>
    <h2>This week <span class="count" id="weekCount"></span></h2>
    <div id="weekEmpty" class="empty-msg">No one's due this week.</div>
    <ul class="week" id="weekList"></ul>
    <div class="footnote">Tap ✓ once you've talked: it stays ticked until the week ends (tap it again to undo). Tap a name to change it. Each one due is a card of its own in Momo too: it waits in Momo's Tasks, up to 6 days early, until you drag it onto a day.</div>
  </section>

  <section class="quick-add">
    <form id="addForm" novalidate autocomplete="off">
      <div class="add-line">
        <input type="text" id="addName" maxlength="40" placeholder="Someone to keep in touch with" aria-label="Their name" enterkeyhint="enter">
        <button type="submit" id="addBtn">Add</button>
      </div>
      <div class="chips every" id="addEvery" role="group" aria-label="How often">
        <button type="button" class="mode-btn chip" data-every="week">Every week</button>
        <button type="button" class="mode-btn chip" data-every="2weeks">Every 2 weeks</button>
        <button type="button" class="mode-btn chip" data-every="month">Every month</button>
        <button type="button" class="mode-btn chip" data-every="quarter">Every quarter</button>
        <button type="button" class="mode-btn chip" data-every="year">Every year</button>
        <button type="button" class="mode-btn chip" data-every="none">Birthday only</button>
      </div>
      <div class="chips how" id="addHow" role="group" aria-label="How">
        <button type="button" class="mode-btn chip" data-how="call">Call</button>
        <button type="button" class="mode-btn chip" data-how="text">Text</button>
        <button type="button" class="mode-btn chip" data-how="visit">Visit</button>
      </div>
      <div class="add-status" id="addStatus" role="status"></div>
    </form>
  </section>

  <section id="bdaySection" hidden>
    <h2 id="bdayTitle">Birthdays</h2>
    <ul class="bdays" id="bdayList"></ul>
  </section>

  <section>
    <h2>People <span class="count" id="peopleCount"></span></h2>
    <div class="chips groups" id="groupChips" role="group" aria-label="Show a group" hidden></div>
    <div id="listEmpty" class="empty-msg">No one yet. Add the people you want to stay close to above.</div>
    <ul class="roster" id="roster"></ul>
    <div class="footnote">Tap someone to change their calls, texts and visits, group, notes or birthday, or to delete them.</div>
  </section>

  <div class="overlay" id="personOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="personModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="personModalTitle">Person</h3>
      <form id="personForm" novalidate autocomplete="off">
        <div class="field-row">
          <div class="field">
            <label for="personName">Name</label>
            <input type="text" id="personName" maxlength="40">
          </div>
          <div class="field">
            <label for="personGroup">Group (optional)</label>
            <input type="text" id="personGroup" maxlength="30" list="personGroupList" placeholder="Family, Work…">
            <datalist id="personGroupList"></datalist>
          </div>
        </div>
        <div class="field">
          <label for="personBdayMonth">Birthday (optional)</label>
          <div class="bday-fields">
            <select id="personBdayMonth" aria-label="Birthday: the month">
              <option value="">—</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <input type="number" id="personBdayDay" min="1" max="31" step="1" inputmode="numeric" placeholder="Day" aria-label="Birthday: the day">
            <input type="number" id="personBdayYear" min="1900" step="1" inputmode="numeric" placeholder="Year (optional)" aria-label="Birthday: the year born (optional)">
          </div>
        </div>
        <div class="field">
          <label for="personNote">Notes: likes, dislikes, what you talked about</label>
          <textarea id="personNote" rows="4" maxlength="1000"></textarea>
        </div>
        <div class="field">
          <div class="field-label">Calls, texts and visits</div>
          <div class="cadences" id="personCadences"></div>
          <p class="cadences-none" id="personNoCadence">Birthday only: no calls, texts or visits.</p>
          <button type="button" class="secondary" id="personCadenceAdd">+ Add a call, text or visit</button>
        </div>
        <div class="modal-foot">
          <p class="modal-hint" id="personHint" role="status" hidden></p>
          <div class="modal-actions">
            <button type="submit">Save</button>
            <button type="button" class="secondary" id="personCancelBtn">Cancel</button>
            <span class="spacer"></span>
            <button type="button" class="danger" id="personDeleteBtn">Delete</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="setupOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="setupModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="setupModalTitle">Set up</h3>
      <form id="setupForm" novalidate autocomplete="off">
        <div class="field">
          <label for="setupPartner">Who are you in a relationship with?</label>
          <select id="setupPartner"></select>
        </div>
        <div class="field">
          <label for="setupMonth">Anniversary (optional)</label>
          <div class="bday-fields">
            <select id="setupMonth" aria-label="Anniversary: the month">
              <option value="">—</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <input type="number" id="setupDay" min="1" max="31" step="1" inputmode="numeric" placeholder="Day" aria-label="Anniversary: the day">
            <input type="number" id="setupYear" min="1900" step="1" inputmode="numeric" placeholder="Year (optional)" aria-label="Anniversary: the year (optional)">
          </div>
        </div>
        <p class="modal-hint">It shows like a birthday: beside their name, in the strip when it's within 30 days, and on Momo's board.</p>
        <p class="modal-hint" id="setupHint" role="status" hidden></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="setupCancelBtn">Cancel</button>
        </div>
      </form>
    </div>
  </div>
`;
