/* Pabu · markup.js — the page (A.markup): quick add (the name and Add, then the how-often and how chips), the
 * Birthdays strip (shown when one is coming up), the list (its groups filled in by render.js), Backup & sync, and the
 * person pop-up (the name, how often and how, minutes, the birthday as month, day and an optional year, a note, and the
 * days you talked). The shell supplies the header, footer, Developer Mode and bug reports; core/backup.js fills
 * [data-kyoshi="backup"]. Ids only need to be unique within the app (look them up with A.$). */
Kyoshi.apps.pabu.markup = `
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
    <h2>Birthdays</h2>
    <ul class="bdays" id="bdayList"></ul>
  </section>

  <section>
    <h2>People <span class="count" id="peopleCount"></span></h2>
    <div id="listEmpty" class="empty-msg">No one yet. Add the people you want to stay close to above.</div>
    <div id="groups"></div>
    <div class="footnote">Tap ✓ once you've talked, or the name to change or delete. Momo fits them into your “Keep in touch” cards, soonest due first and up to 6 days early; what doesn't fit waits in its Tasks.</div>
  </section>

  <section data-kyoshi="backup"></section>

  <div class="overlay" id="personOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="personModalTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="personModalTitle">Person</h3>
      <form id="personForm" novalidate autocomplete="off">
        <div class="field">
          <label for="personName">Name</label>
          <input type="text" id="personName" maxlength="40">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="personEvery">How often</label>
            <select id="personEvery">
              <option value="week">Every week</option>
              <option value="2weeks">Every 2 weeks</option>
              <option value="month">Every month</option>
              <option value="quarter">Every quarter</option>
              <option value="year">Every year</option>
              <option value="none">Birthday only</option>
            </select>
          </div>
          <div class="field">
            <label for="personHow">How</label>
            <select id="personHow">
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="visit">Visit</option>
            </select>
          </div>
          <div class="field">
            <label for="personMinutes">Minutes</label>
            <input type="number" id="personMinutes" min="5" max="480" step="5" inputmode="numeric">
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
          <label for="personNote">Note (optional)</label>
          <textarea id="personNote" rows="3" maxlength="300" placeholder="What to ask about next time"></textarea>
        </div>
        <div class="field">
          <label for="personTalkDate">Talked on</label>
          <ul class="talks" id="personTalks"></ul>
          <div class="talk-add">
            <input type="date" id="personTalkDate" aria-label="A day you talked">
            <button type="button" class="secondary" id="personTalkAdd">Add a day</button>
          </div>
        </div>
        <p class="modal-hint" id="personHint" role="status" hidden></p>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="personCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="danger" id="personDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>
`;
