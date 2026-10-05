/* Turtleduck · markup.js — the page (A.markup): the nav (Plan · Recipes · Groceries), then one view at a time
 * (render.js) — Plan (the tabs, the week's Confirm and its line about Momo, the ⋯ menu, the grid with its sidebar, or a
 * phone's list of days: plan-view.js), Recipes (recipes.js), Groceries (add by hand, the lists, Settings: groceries.js)
 * and the cook view (cook.js) — Backup & sync, and the pop-ups: the picker and a planned meal's (plan-popups.js), the
 * recipe (recipes.js), Paste recipes (paste.js), Save as template, and Times & trips (times.js). The shell supplies the
 * header, footer, Developer Mode and bug reports; core/backup.js fills [data-kyoshi="backup"]. Ids only need to be
 * unique within the app (A.$). */
(function (A) {
  "use strict";
  const { MAX_NAME, MAX_LINK, MAX_STEPS, MAX_QUICK, MAX_MANUAL, MAX_TEMPLATE_NAME, MAX_SERVINGS, MAX_MINUTES, MAX_KCAL, MAX_GRAMS, TYPES, UNIT_MODES, MIN_LENGTH, MAX_LENGTH } = A;
  // Times & trips: a meal's row (its usual time, its usual length), the Cook row's (a time only).
  const timeRow = (k, label, length = true) => `<label class="tm-name" for="time_${k}">${label}</label><input type="time" id="time_${k}" step="900">` +
    (length ? `<span class="tm-len"><input type="number" id="len_${k}" min="${MIN_LENGTH}" max="${MAX_LENGTH}" step="5" inputmode="numeric" aria-label="${label}: usual length in minutes"> min</span>` : `<span class="tm-len tm-note">as long as its recipes</span>`);
  // Five number fields: kcal, then protein ("Quality protein": complete proteins only), carbs, fat and fiber in grams
  // (ids prefix + Kcal, Protein…).
  const nums = (prefix, max = [MAX_KCAL, MAX_GRAMS]) => [["Kcal", "kcal", max[0]], ["Protein", "Quality protein (g)", max[1]], ["Carbs", "Carbs (g)", max[1]], ["Fat", "Fat (g)", max[1]], ["Fiber", "Fiber (g)", max[1]]]
    .map(([id, label, top]) => `<label class="own-num"><span>${label}</span><input type="number" id="${prefix}${id}" min="0" max="${top}" step="any" inputmode="decimal"></label>`).join("");
  // Lucide's ellipsis (ISC license), for the ⋯ menu.
  const MORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  const FORMAT = `# Chili
Meal: dinner
Serves: 4
Prep: 15 min
Cook: 45 min
Per serving: 650 kcal, 45 g protein, 40 g carbs, 30 g fat, 8 g fiber
Link: https://example.com/chili
Ingredients:
- 500 g ground beef
- 2 cans kidney beans, drained
Steps:
Brown the beef. Add the beans and simmer 30 min.
Season to taste.`;

  A.markup = `
  <div class="mode-toggle td-nav" id="nav" role="group" aria-label="Turtleduck">
    <button type="button" class="mode-btn" data-view="plan">Plan</button>
    <button type="button" class="mode-btn" data-view="recipes">Recipes</button>
    <button type="button" class="mode-btn" data-view="groceries">Groceries</button>
  </div>

  <div id="planView">
    <div class="plan-bar" id="planBar">
      <div class="mode-toggle weeks" id="weekToggle" role="group" aria-label="Which week">
        <button type="button" class="mode-btn" data-week="this"><span>This week</span><span class="wk-sub" id="weekSub_this"></span></button>
        <button type="button" class="mode-btn" data-week="next"><span>Next week</span><span class="wk-sub" id="weekSub_next"></span></button>
      </div>
      <button type="button" class="confirm-btn" id="confirmBtn" data-act="confirm-week" hidden>Confirm this week</button>
      <div class="menu-wrap">
        <button type="button" class="icon-btn menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-controls="planMenu" aria-label="More: times and trips, copy last week, templates, clear the week" title="Times & trips, copy last week, templates, clear the week">${MORE}</button>
        <div class="plan-menu" id="planMenu" role="menu" hidden></div>
      </div>
    </div>
    <div class="week-status" id="momoLine"></div>
    <div class="plan-body" id="planBody">
      <section class="grid-box">
        <div class="plan-grid" id="planGrid"></div>
        <div class="week-avg" id="weekAvg"></div>
        <div class="footnote">Drag a recipe from the side onto a day, or tap + to pick one; drag a meal to move it, or Ctrl+C over it and Ctrl+V over other days to copy it. A recipe on the Cook row is cooked that day for later: its portions wait under Leftovers, to drag onto later days. The cart above a day puts a shopping trip there; Groceries lists what each trip needs.</div>
      </section>
      <aside class="sidebar" id="sidebar">
        <input type="text" id="sideSearch" placeholder="Search recipes" aria-label="Search recipes" autocomplete="off">
        <div id="sideShelf"></div>
        <div id="sideRecipes"></div>
      </aside>
    </div>
    <div id="planList" hidden></div>
  </div>

  <div id="recipesView" hidden>
    <section>
      <div class="recipes-bar">
        <button type="button" id="newRecipeBtn">+ New recipe</button>
        <button type="button" class="secondary" id="pasteBtn">Paste recipes&hellip;</button>
        <input type="text" id="recipeSearch" placeholder="Search" aria-label="Search recipes" autocomplete="off">
      </div>
      <div id="recipesEmpty" class="empty-msg" hidden></div>
      <div id="recipeGroups"></div>
    </section>
    <section id="archivedSection" hidden>
      <details id="archivedBox">
        <summary><h2>Archived <span class="count" id="archivedCount"></span></h2></summary>
        <div id="archivedList"></div>
      </details>
    </section>
  </div>

  <div id="groceriesView" hidden>
    <section class="manual-add">
      <form id="manualForm" novalidate autocomplete="off">
        <input type="text" id="manualText" maxlength="${MAX_MANUAL}" placeholder="Running out of&hellip;" aria-label="Add a grocery by hand" enterkeyhint="enter">
        <button type="submit">Add</button>
      </form>
    </section>
    <div id="lists"></div>
    <section class="settings">
      <details id="settingsBox">
        <summary><h2>Settings</h2></summary>
        <div class="subhead">When</div>
        <button type="button" class="secondary times-btn" data-act="times">Times &amp; trips&hellip;</button>
        <div class="footnote">When you usually eat and cook, how long meals take, and your grocery trips every week: Momo keeps them in your baseline at those times.</div>
        <div class="subhead targets-head">Amounts</div>
        <div class="mode-toggle amounts" id="unitsToggle" role="group" aria-label="Amounts">${UNIT_MODES.map(([k, t]) => `<button type="button" class="mode-btn" data-units="${k}">${t}</button>`).join("")}</div>
        <div class="footnote">As entered: in the recipes' own unit when they agree (cups, oz…), the US way when they all use US units, else metric. US: ounces and pounds, spoons, cups, quarts and gallons, rounded to a neat amount.</div>
        <div class="subhead targets-head">A day's targets (each optional)</div>
        <div class="own-nums targets">${nums("target", [4 * MAX_KCAL, 2 * MAX_GRAMS])}</div>
        <div class="footnote">A day's totals on the plan turn amber past a target: kcal, carbs and fat above theirs, protein and fiber below.</div>
      </details>
    </section>
  </div>

  <div id="cookView" hidden>
    <div class="cook-top">
      <button type="button" class="back-link" data-act="cook-back">&larr; Back</button>
      <div class="cook-pager" id="cookPager"></div>
    </div>
    <section class="cook-page" id="cookBox"></section>
  </div>

  <section data-kyoshi="backup"></section>

  <div class="overlay" id="pickOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="pickTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="pickTitle">Pick a meal</h3>
      <input type="text" id="pickSearch" placeholder="Search recipes" aria-label="Search recipes" autocomplete="off">
      <div class="pick-list" id="pickList"></div>
      <button type="button" class="secondary small pick-more" id="pickMore" hidden>Show more</button>
      <div class="pick-own" id="pickOwn">
        <details id="quickBox">
          <summary>Quick meal&hellip;</summary>
          <form id="quickForm" novalidate autocomplete="off">
            <div class="field"><label for="quickText">What</label><input type="text" id="quickText" maxlength="${MAX_QUICK}" placeholder="e.g. Shake"></div>
            <div class="own-nums">${nums("quick")}</div>
            <button type="submit">Add</button>
          </form>
        </details>
        <details id="outBox">
          <summary>Restaurant&hellip;</summary>
          <form id="outForm" novalidate autocomplete="off">
            <div class="field"><label for="outText">Where (optional)</label><input type="text" id="outText" maxlength="${MAX_QUICK}" placeholder="e.g. Pho on Main"></div>
            <div class="own-nums">${nums("out")}</div>
            <button type="submit">Add</button>
          </form>
        </details>
        <button type="button" class="secondary skip-btn" id="skipBtn">Skip this meal</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="entryOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="entryTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="entryTitle">Meal</h3>
      <div class="entry-where" id="entryWhere"></div>
      <div id="entryBody"></div>
      <div class="modal-actions">
        <button type="button" class="secondary" data-entry="read">Read</button>
        <button type="button" class="secondary" data-entry="edit">Edit recipe</button>
        <button type="button" class="secondary" data-entry="replace">Replace&hellip;</button>
        <span class="spacer"></span>
        <button type="button" class="danger" data-entry="remove">Remove</button>
      </div>
      <div class="modal-actions"><button type="button" id="entryDoneBtn">Done</button></div>
    </div>
  </div>

  <div class="overlay" id="recipeOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="recipeTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="recipeTitle">Recipe</h3>
      <form id="recipeForm" novalidate autocomplete="off">
        <div class="field"><label for="recipeName">Name</label><input type="text" id="recipeName" maxlength="${MAX_NAME}" placeholder="e.g. Chili"></div>
        <div class="field">
          <label>Meal</label>
          <div class="mode-toggle many types" id="recipeTypes" role="group" aria-label="Meal">${TYPES.map(([k, t]) => `<button type="button" class="mode-btn" data-type="${k}">${t}</button>`).join("")}</div>
        </div>
        <div class="field-row">
          <div class="field"><label for="recipeServings">Serves</label><input type="number" id="recipeServings" min="1" max="${MAX_SERVINGS}" step="1" inputmode="numeric" placeholder="1"></div>
          <div class="field"><label for="recipePrep">Prep (min)</label><input type="number" id="recipePrep" min="0" max="${MAX_MINUTES}" step="1" inputmode="numeric"></div>
          <div class="field"><label for="recipeCook">Cook (min)</label><input type="number" id="recipeCook" min="0" max="${MAX_MINUTES}" step="1" inputmode="numeric"></div>
        </div>
        <div class="subhead">Per serving</div>
        <div class="own-nums">${nums("recipe")}</div>
        <div class="field">
          <label for="recipeIngredients">Ingredients, one a line</label>
          <textarea id="recipeIngredients" rows="7" placeholder="200 g rice&#10;1 can beans, drained&#10;salt"></textarea>
          <div class="hint">Like “200 g rice”, “1 can beans, drained” or “salt”: the grocery list adds them up (g/kg/oz/lb together, ml/l/tsp/tbsp/cup together, onions with onion).</div>
        </div>
        <div class="field"><label for="recipeSteps">Steps</label><textarea id="recipeSteps" rows="7" maxlength="${MAX_STEPS}" placeholder="As you like: a paragraph, or a line each (start one with - for a bullet)"></textarea></div>
        <div class="field"><label for="recipeLink">Link (optional)</label><input type="text" id="recipeLink" maxlength="${MAX_LINK}" inputmode="url" placeholder="https://…"></div>
        <p class="modal-hint" id="recipeUse" hidden></p>
        <div class="modal-status good" id="recipeStatus" role="status"></div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="recipeAnotherBtn">Save &amp; add another</button>
          <button type="button" class="secondary" id="recipeCancelBtn">Cancel</button>
          <span class="spacer"></span>
          <button type="button" class="secondary small" id="recipeArchiveBtn">Archive</button>
          <button type="button" class="danger" id="recipeDeleteBtn">Delete</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="pasteOverlay">
    <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="pasteTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="pasteTitle">Paste recipes</h3>
      <p class="modal-hint">As many as you like, each starting with a line like “# Chili”; then Preview, and Add.</p>
      <details class="paste-format">
        <summary>The format</summary>
        <pre>${FORMAT}</pre>
        <div class="footnote">Keys in any order and any case, the colon optional: Meal (breakfast, lunch, dinner, snack or any), Serves, Prep, Cook, Per serving (or Calories, Protein (quality protein), Carbs, Fat and Fiber, each on a line), Link. Lines starting with - (or * or •) are ingredients, or every line under “Ingredients:”; everything after them, or after “Steps:”, is the steps as you typed them. A recipe you already have isn't changed: ticking it adds a second one.</div>
      </details>
      <textarea id="pasteText" rows="12" spellcheck="false" placeholder="# Chili&#10;Serves: 4&#10;- 500 g ground beef&#10;Brown the beef…"></textarea>
      <div id="pastePreview" hidden>
        <div id="pasteProblems"></div>
        <div class="paste-rows" id="pasteRows"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary" id="pastePreviewBtn">Preview</button>
        <button type="button" id="pasteAddBtn" hidden>Add</button>
        <button type="button" class="secondary" id="pasteCancelBtn">Cancel</button>
      </div>
    </div>
  </div>

  <div class="overlay" id="templateOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="templateTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="templateTitle">Save as template</h3>
      <form id="templateForm" novalidate autocomplete="off">
        <p class="modal-hint"><span id="templateWeek">This week's</span> meals, by weekday, to add to any week later from the &hellip; menu.</p>
        <div class="field"><label for="templateName">Name</label><input type="text" id="templateName" maxlength="${MAX_TEMPLATE_NAME}" placeholder="e.g. Usual breakfasts"></div>
        <div class="modal-status bad" id="templateStatus" role="status"></div>
        <div class="modal-actions">
          <button type="submit">Save</button>
          <button type="button" class="secondary" id="templateCancelBtn">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="overlay" id="timesOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="timesTitle">
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
      <h3 id="timesTitle">Times &amp; trips</h3>
      <p class="modal-hint">When you usually eat, cook and shop: Momo keeps each meal and trip in your baseline at its time, fixed there. A day that's different: tap its meal on the plan, or the trip's time on its list.</p>
      <div class="times-grid">
        <span></span><span class="tm-head">Usually at</span><span class="tm-head">Takes</span>
        ${timeRow("breakfast", "Breakfast")}${timeRow("lunch", "Lunch")}${timeRow("dinner", "Dinner")}${timeRow("cook", "Cooking", false)}
      </div>
      <div class="subhead">Grocery trips every week</div>
      <div id="tripRows"></div>
      <button type="button" class="secondary small" id="tripAddBtn">+ Add a trip day</button>
      <div class="field tm-other"><label for="time_trip">A trip you place by hand, at</label><input type="time" id="time_trip" step="900"></div>
      <div class="modal-status bad" id="timesStatus" role="status"></div>
      <div class="modal-actions">
        <button type="button" id="timesSaveBtn">Save</button>
        <button type="button" class="secondary" id="timesCancelBtn">Cancel</button>
      </div>
    </div>
  </div>
`;
})(Kyoshi.apps.turtleduck);
