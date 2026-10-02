/* Turtleduck · ingredients.js — ingredient lines as the grocery list and the cook view read them: "2 cups rice, rinsed"
 * → { qty: 2, unit: "cup", name: "rice", note: "rinsed" } (a line that doesn't start with an amount is all name: "salt");
 * the units with their plurals and long forms (grams → g, tablespoons → tbsp), kg and l counted in g and ml so they
 * merge (base units); amounts as words again ("1.5 kg", "1½ cups", "5 eggs": fractions only for the neat ones, never for
 * grams or millilitres); scaling a line; and an ingredient's store section, guessed from its name (one set by hand
 * wins: groceries.js). Pure functions; a line's parse is remembered by its text, so a better parser later improves
 * every recipe at once. */
(function (K, A) {
  "use strict";
  const { fmtNum } = K.util;

  // --- Units: each spelling → the one kept; kg and l are counted in g and ml (BASE), so they merge with them ---
  const UNIT_WORDS = {
    g: "g gr gram grams gramme grammes", kg: "kg kgs kilo kilos kilogram kilograms",
    ml: "ml millilitre millilitres milliliter milliliters", l: "l ltr litre litres liter liters",
    tbsp: "tbsp tbsps tbs tablespoon tablespoons", tsp: "tsp tsps teaspoon teaspoons", cup: "cup cups", can: "can cans tin tins",
    clove: "clove cloves", slice: "slice slices", bunch: "bunch bunches", head: "head heads",
    pkg: "pkg pkgs package packages pack packs packet packets", pinch: "pinch pinches", piece: "piece pieces pc pcs"
  };
  const UNITS = new Map(Object.entries(UNIT_WORDS).flatMap(([unit, words]) => words.split(" ").map(w => [w, unit])));
  const BASE = { kg: ["g", 1000], l: ["ml", 1000] };
  const PLURAL = { cup: "cups", can: "cans", clove: "cloves", slice: "slices", bunch: "bunches", head: "heads", pinch: "pinches", piece: "pieces" };

  // --- Amounts at the start of a line: "1½", "1 1/2", "1/2", "½", "1,500" (thousands), "2", "1.5", "1,5", ".5" ---
  const FRACTIONS = { "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };
  const F = Object.keys(FRACTIONS).join("");
  const AMOUNTS = [
    [new RegExp(`^(\\d+)\\s*([${F}])`), m => +m[1] + FRACTIONS[m[2]]],
    [/^(\d+)\s+(\d+)\s*\/\s*(\d+)/, m => (+m[3] ? +m[1] + m[2] / m[3] : null)],
    [/^(\d+)\s*\/\s*(\d+)/, m => (+m[2] ? m[1] / m[2] : null)],
    [new RegExp(`^([${F}])`), m => FRACTIONS[m[1]]],
    [/^(\d{1,3}),(\d{3})(?![\d.,])/, m => +(m[1] + m[2])],
    [/^(\d*[.,]\d+|\d+)/, m => +m[1].replace(",", ".")]
  ];
  function readAmount(s) {
    for (const [re, value] of AMOUNTS) {
      const m = re.exec(s), v = m && value(m);
      if (m && v !== null && isFinite(v)) return [v, s.slice(m[0].length)];
    }
    return [null, s];
  }

  // An ingredient's name as the list keys it: any case, spaces collapsed.
  const normName = name => name.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();

  // "2-3 cloves garlic, minced" → { qty: 2, unit: "clove", name: "garlic", note: "minced", norm: "garlic", key:
  // "garlic|clove" } (a range counts its lower end; "of" after the unit goes). key merges kg with g and l with ml.
  const memo = new Map();
  function parseLine(text) {
    const line = String(text).replace(/^\s*[-*•·]\s*/, "").replace(/\s+/g, " ").trim();
    if (memo.has(line)) return memo.get(line);
    let [qty, rest] = readAmount(line), unit = "";
    if (qty !== null) {
      const range = /^\s*(?:-|–|—|to\s)\s*/i.exec(rest);
      if (range) { const [upTo, after] = readAmount(rest.slice(range[0].length)); if (upTo !== null) rest = after; }
      const word = /^\s*([a-zA-Z]+)\.?(?=[\s,]|$)/.exec(rest), u = word && UNITS.get(word[1].toLowerCase());
      if (u) { unit = u; rest = rest.slice(word[0].length); }
      rest = rest.replace(/^\s*of\s+/i, "");
    }
    const comma = rest.indexOf(",");
    let name = (comma < 0 ? rest : rest.slice(0, comma)).trim(), note = comma < 0 ? "" : rest.slice(comma + 1).trim();
    if (!name) { qty = null; unit = ""; name = line; note = ""; } // an amount with no name: the line is all name
    const norm = normName(name), base = BASE[unit];
    const p = { qty, unit, name, note, norm, key: `${norm}|${base ? base[0] : unit}` };
    if (memo.size > 5000) memo.clear();
    memo.set(line, p);
    return p;
  }

  // A parsed line's amount in base units: { qty (null when none), unit }.
  const toBase = p => (BASE[p.unit] ? { qty: p.qty === null ? null : p.qty * BASE[p.unit][1], unit: BASE[p.unit][0] } : { qty: p.qty, unit: p.unit });

  // An amount in base units as words: "250 g", "1.4 kg", "1½ cups", "¾ tsp", "5" (a count: unit "").
  const NEAT = [[1 / 2, "½"], [1 / 4, "¼"], [3 / 4, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
  function fmtAmount(q, unit) {
    if (unit === "g" || unit === "ml") return q >= 1000 ? `${fmtNum(q / 1000, 1)} ${unit === "g" ? "kg" : "l"}` : `${fmtNum(q, 1)} ${unit}`;
    const whole = Math.floor(q + 1e-9), neat = NEAT.find(([v]) => Math.abs(q - whole - v) < 0.01);
    const n = neat ? `${whole || ""}${neat[1]}` : fmtNum(q, 2);
    return unit ? `${n} ${q > 1 && PLURAL[unit] ? PLURAL[unit] : unit}` : n;
  }
  // A grocery row ({ qty, unit, name } in base units) as words: "1.5 kg rice", "5 eggs", "salt".
  const fmtLine = row => (row.qty === null ? row.name : `${fmtAmount(row.qty, row.unit)} ${row.name}`);
  // A recipe's line at a scale, as the cook view shows it: as typed at ×1 (or with no amount), else the amount scaled.
  function scaledLine(text, scale) {
    const p = parseLine(text);
    if (scale === 1 || p.qty === null) return String(text).replace(/^\s*[-*•·]\s*/, "").trim();
    const b = toBase(p);
    return `${fmtAmount(b.qty * scale, b.unit)} ${p.name}${p.note ? `, ${p.note}` : ""}`;
  }

  // --- Store sections, guessed from the words in a name (the first group with one of them wins, so "chicken stock" is
  // Pantry and "chicken" Meat & fish); anything else is Other. ---
  const GUESS = [
    ["Frozen", "frozen ice"],
    ["Pantry", "stock broth bouillon can cans tin canned tinned paste sauce powder flakes dried spice spices seasoning peanut coconut black"],
    ["Drinks", "juice coffee tea wine beer soda water lemonade kombucha"],
    ["Meat & fish", "chicken beef pork salmon tuna turkey lamb bacon sausage sausages shrimp prawns fish cod mince ham steak chorizo"],
    ["Dairy & eggs", "milk cheese yogurt yoghurt butter egg eggs cream feta parmesan mozzarella cheddar ricotta"],
    ["Bakery", "bread tortilla tortillas bun buns bagel bagels pita baguette wraps"],
    ["Pantry", "rice pasta spaghetti noodles flour oil olive sugar salt beans lentils chickpeas oats quinoa vinegar honey cumin paprika cinnamon oregano cereal nuts almonds"],
    ["Produce", "onion garlic tomato pepper peppers lettuce apple lemon lime herbs potato carrot celery spinach kale cucumber avocado banana berries ginger cilantro parsley basil chives mushroom zucchini broccoli cabbage scallions leek eggplant aubergine"]
  ].map(([section, words]) => [section, new Set(words.split(" "))]);
  function guessSection(norm) {
    const words = norm.split(/[^a-z]+/).filter(Boolean);
    const forms = w => [w, w.replace(/s$/, ""), w.replace(/es$/, "")]; // "limes" → lime, "tomatoes" → tomato
    for (const [section, set] of GUESS) if (words.some(w => forms(w).some(f => set.has(f)))) return section;
    return "Other";
  }

  Object.assign(A, { parseLine, toBase, fmtAmount, fmtLine, scaledLine, normName, guessSection });
})(Kyoshi, Kyoshi.apps.turtleduck);
