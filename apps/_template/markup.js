/* Template · markup.js — the app's page (A.markup). The shell supplies the header, footer,
 * Developer Mode and bug reports.
 * Ids only need to be unique within the app (look them up with A.$). */
Kyoshi.apps.template.markup = `
  <section>
    <h2>Items</h2>
    <div class="row">
      <div>
        <label for="itemInput">New item</label>
        <input type="text" id="itemInput" maxlength="200" placeholder="e.g. Something to remember" autocomplete="off">
      </div>
      <div class="btn-cell"><button id="addItemBtn">Add</button></div>
    </div>
    <div id="itemsEmpty" class="empty-msg">Nothing here yet.</div>
    <ul class="items" id="itemsList"></ul>
  </section>
`;
