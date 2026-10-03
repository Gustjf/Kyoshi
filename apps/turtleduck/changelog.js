/* Turtleduck · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "1.300", date: "2026-10-03", changes: [
      "Plurals add up in the grocery lists: “1 onion” and “2 onions” make one row, “3 onions” (tomatoes with tomato, berries with berry, leaves with leaf).",
      "Any unit adds up: oz and lb with g and kg; fl oz, pints, quarts and gallons with ml, l, spoons and cups; sticks of butter as their own. Groceries → Settings shows the amounts as entered, metric or US (rounded to a neat amount); the cook view stays as typed."
    ] },
    { version: "1.200", date: "2026-10-03", changes: [
      "Each meal, cooking session and grocery trip is its own card in Momo (“Dinner: Chili + Salad”, “Cook: Curry ×1½ · Chili”, “Groceries”) that lands on its day by itself, near its usual time (breakfast 7:30, lunch 12:00, cooking 16:00, dinner 18:00, trips 10:00), to move as you like."
    ] },
    { version: "1.100", date: "2026-10-02", changes: [
      "A dot on Turtleduck's icon while today or tomorrow has no dinner planned.",
      "This week's past meals show on Momo's board too, as the record of the week.",
      "Import JSON says when the backup was made and how much newer what's here is, before replacing anything."
    ] },
    { version: "1.000", date: "2026-10-02", changes: [
      "Initial release: recipes typed or pasted in bulk, this week's and next week's meals laid out by dragging recipes onto the days (or tapping), a batch's portions kept on a shelf to place on later days, and each day's calories and macros against your targets.",
      "Shopping trips placed on the days, each with its grocery list worked out from the meals until the next trip, in store sections, ticked off on the phone; a cook view that keeps the screen on.",
      "Momo fills your \"Breakfast\", \"Lunch\", \"Dinner\" and \"Cooking\" cards with the day's meals, and a \"Groceries\" card on each trip's day, ✓ once its list is bought."
    ] }
  ];
  A.VERSION = A.CHANGELOG[0].version;
})(Kyoshi.apps.turtleduck);
