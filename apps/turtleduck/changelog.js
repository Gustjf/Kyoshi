/* Turtleduck · changelog.js — the app's version history, shown in Developer Mode.
 * Newest first; A.VERSION is the top entry. Version X.YYY, bump one tier per change:
 * +0.001 bug fix, +0.010 tiny tweak, +0.100 small feature, +1 large feature.
 * Keep entries brief and high level: a sentence per change. */
(function (A) {
  "use strict";
  A.CHANGELOG = [
    { version: "2.520", date: "2026-10-08", changes: [
      "Sync combines what two devices changed with one shared rule (the later change wins; a tie the same on every device), the same code in every app instead of a copy each. Nothing changes in what you see."
    ] },
    { version: "2.510", date: "2026-10-06", changes: [
      "Backup & sync left the page: Export JSON, Import JSON and the sync folder are in Developer Mode now (Ctrl+9, or the DEV badge)."
    ] },
    { version: "2.500", date: "2026-10-05", changes: [
      "Store-bought items: in a recipe's pop-up, pick Cooked or Store-bought. A store-bought item shows a bag on the plan, never goes on the Cook row, keeps no leftovers, and takes a quick 20 minutes in Momo.",
      "Track how many you have on hand if you like: the plan uses them up day by day, the Recipes list says how many are left or the day they run out, and from then on the grocery list adds the item by count.",
      "A recipe with no ingredient lines (something ready to eat) goes on the grocery list by its own name.",
      "Paste recipes reads “Store-bought: yes” (or Bought, Ready-made), and such an item needs no ingredients or steps. Reload Turtleduck on every device after updating, so an older copy doesn't drop the new fields when it saves."
    ] },
    { version: "2.400", date: "2026-10-05", changes: [
      "Protein fields read “Quality protein”, a reminder to count complete proteins only.",
      "On the plan, a trip placed by hand carries a small dot and a skipped scheduled trip a slash, so the unusual stands out.",
      "A meal eaten as two or more portions shows ×2 on its chip (and its card in Momo says so).",
      "Also on… places two, three or four portions on a day: tap the day again for one more, − for one fewer.",
      "A batch never gives out more portions than it yields: placing one more is refused and says why; where a batch is already overdrawn (a lowered ×, a recipe's servings changed, two devices), the latest-dated portions are marked short."
    ] },
    { version: "2.300", date: "2026-10-04", changes: [
      "Times & trips (the ⋯ menu, or Groceries → Settings on a phone): when you usually have breakfast, lunch and dinner and cook, how long each meal usually takes, and your grocery trips every week; a day that's different: tap its meal and change its time there.",
      "The trip schedule puts a trip on those days by itself: tap the cart to skip one (and again to bring it back); a trip's time for one day changes on its list in Groceries.",
      "The grocery lists go by those times: a trip at 6 pm covers that evening's dinner, and that day's lunch belongs to the list before.",
      "A meal cooked there turns amber when no trip comes before it, and red once its trip is past while things for it aren't ticked as bought.",
      "Confirm each week for Momo (by the week's tabs, or at the top of a phone's list): until then nothing of that week goes there; once confirmed, changes follow by themselves. The line under the tabs says whether Momo has it, and the dot on the icon reminds you any day while this week isn't confirmed, and from Friday while next week isn't. After updating, confirm this week and next once: until then nothing of Turtleduck's is on Momo.",
      "Momo keeps your meals and scheduled trips in its baseline at your times, fixed there (changed here only); each week's meals fill them, and a cooking session or an extra trip gets a pinned card of its own. What's needed before the first trip no longer goes to Momo's Tasks.",
      "Reload Turtleduck on every device: an older copy would drop the times, the schedule and the weeks confirmed when it syncs."
    ] },
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
