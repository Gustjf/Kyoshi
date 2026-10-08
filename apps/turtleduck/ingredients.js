/* Turtleduck · ingredients.js — ingredient lines as the grocery list and the cook view read them: "2 cups rice, rinsed"
 * → { qty: 2, unit: "cup", name: "rice", note: "rinsed" } (a line that doesn't start with an amount is all name: "salt");
 * the units with their plurals and long forms (grams → g, tablespoons → tbsp, fl. oz → fl oz), every weight counted in
 * g and every volume in ml so each family merges (base units; cans, cloves and the other counts stay their own); names
 * keyed with their last word singular, so "2 onions" merges with "1 onion"; amounts as words again, as entered, metric
 * or the US way ("1.5 kg", "1½ cups", "5 eggs": fractions only for the neat ones, never for grams or millilitres);
 * scaling a line; and an ingredient's store section, guessed from its name (one set by hand wins: groceries.js). Pure
 * functions; a line's parse is remembered by its text, so a better parser later improves every recipe at once. */
(function (K, A) {
  "use strict";
  const { fmtNum } = K.util;

  // --- Units: each spelling → the one kept. Every weight is counted in g and every volume in ml (BASE: [base, size]),
  // so a family merges in one row; the rest are counts, each its own (a can, a clove, a stick of butter). ---
  const UNIT_WORDS = {
    g: "g gr gram grams gramme grammes", kg: "kg kgs kilo kilos kilogram kilograms", oz: "oz ounce ounces", lb: "lb lbs pound pounds",
    ml: "ml millilitre millilitres milliliter milliliters", l: "l ltr litre litres liter liters",
    tbsp: "tbsp tbsps tbs tablespoon tablespoons", tsp: "tsp tsps teaspoon teaspoons", cup: "cup cups",
    pint: "pint pints pt pts", quart: "quart quarts qt qts", gallon: "gallon gallons gal gals", can: "can cans tin tins",
    clove: "clove cloves", slice: "slice slices", bunch: "bunch bunches", head: "head heads",
    pkg: "pkg pkgs package packages pack packs packet packets", pinch: "pinch pinches", piece: "piece pieces pc pcs", stick: "stick sticks"
  };
  const UNITS = new Map(Object.entries(UNIT_WORDS).flatMap(([unit, words]) => words.split(" ").map(w => [w, unit])));
  const FL_OZ = /^\s*(?:fl\.?\s*oz|fluid\s+ounces?)\.?(?=[\s,]|$)/i; // the unit of two words: "fl oz", "fl. oz.", "fluid ounces"
  const BASE = {
    g: ["g", 1], kg: ["g", 1000], oz: ["g", 28.3495], lb: ["g", 453.592],
    ml: ["ml", 1], l: ["ml", 1000], tsp: ["ml", 4.929], tbsp: ["ml", 14.787], "fl oz": ["ml", 29.5735], cup: ["ml", 236.588],
    pint: ["ml", 473.176], quart: ["ml", 946.353], gallon: ["ml", 3785.41]
  };
  const METRIC = new Set(["g", "kg", "ml", "l"]);
  const PLURAL = { cup: "cups", pint: "pints", quart: "quarts", gallon: "gallons", can: "cans", clove: "cloves", slice: "slices", bunch: "bunches", head: "heads", pinch: "pinches", piece: "pieces", stick: "sticks" };
  // Units the lines didn't know before Turtleduck 1.300: their words were part of the name then ("oz cheese").
  const NEW_UNITS = new Set(["oz", "lb", "fl oz", "pint", "quart", "gallon", "stick"]);

  // --- Plurals: a name's last word, made singular for its key ("berries" → berry, "tomatoes" → tomato, "leaves" →
  // leaf, "peaches" → peach, "eggs" → egg). Words that end in s when there's one stay; the few the rules miss are named. ---
  const AS_IS = new Set(["hummus", "couscous", "asparagus", "molasses"]);
  const IRREGULAR = new Map(Object.entries({
    olives: "olive", chives: "chive", cloves: "clove", endives: "endive", cookies: "cookie", brownies: "brownie",
    veggies: "veggie", pies: "pie", chilies: "chili", chillies: "chilli", quiches: "quiche"
  }));
  function singular(w) {
    if (AS_IS.has(w) || w.length < 3) return w;
    if (IRREGULAR.has(w)) return IRREGULAR.get(w);
    if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
    if (w.endsWith("ves")) return `${w.slice(0, -3)}f`;
    if (/(?:o|ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2);
    return /[^s]s$/.test(w) ? w.slice(0, -1) : w;
  }

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
  // Those amounts anywhere in a text, for a RegExp (paste.js's minutes: "1½ hours"); readAmount reads what it finds.
  const AMOUNT = `(?:\\d+\\s*[${F}]|\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|[${F}]|\\d*[.,]\\d+|\\d+)`;

  // An ingredient's name in any case, spaces collapsed; as the list keys it (keyName), its last word singular too.
  const normName = name => name.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();
  const keyName = name => normName(name).replace(/\p{L}+$/u, singular);

  // A line's amount, unit, name and note, with the units known (known(unit): the parse before 1.300 knew fewer).
  function split(line, known) {
    let [qty, rest] = readAmount(line), unit = "";
    if (qty !== null) {
      const range = /^\s*(?:-|–|—|to\s)\s*/i.exec(rest);
      if (range) { const [upTo, after] = readAmount(rest.slice(range[0].length)); if (upTo !== null) rest = after; }
      const word = FL_OZ.exec(rest) || /^\s*([a-zA-Z]+)\.?(?=[\s,]|$)/.exec(rest);
      const u = word && (word[1] ? UNITS.get(word[1].toLowerCase()) : "fl oz");
      if (u && known(u)) { unit = u; rest = rest.slice(word[0].length); }
      rest = rest.replace(/^\s*of\s+/i, "");
    }
    const comma = rest.indexOf(",");
    let name = (comma < 0 ? rest : rest.slice(0, comma)).trim(), note = comma < 0 ? "" : rest.slice(comma + 1).trim();
    if (!name) { qty = null; unit = ""; name = line; note = ""; } // an amount with no name: the line is all name
    return { qty, unit, name, note };
  }

  // "2-3 cloves garlic, minced" → { qty: 2, unit: "clove", name: "garlic", note: "minced", norm: "garlic", key:
  // "garlic|clove", plural: false, oldKey: "garlic|clove" } (a range counts its lower end; "of" after the unit goes).
  // key: the norm (last word singular) and the base unit, so "1 lb beef" and "500 g beef" are "beef|g"; plural: the
  // name's last word is a plural; oldKey: the line's key before 1.300 (no plurals merged, kg with g and l with ml only),
  // where ticks and sections set then are still found (groceries.js).
  const memo = new Map();
  function parseLine(text) {
    const line = String(text).replace(/^\s*[-*•·]\s*/, "").replace(/\s+/g, " ").trim();
    if (memo.has(line)) return memo.get(line);
    const p = split(line, () => true), was = split(line, u => !NEW_UNITS.has(u));
    p.norm = keyName(p.name);
    p.key = `${p.norm}|${BASE[p.unit] ? BASE[p.unit][0] : p.unit}`;
    p.plural = p.norm !== normName(p.name);
    p.oldKey = `${normName(was.name)}|${was.unit === "kg" ? "g" : was.unit === "l" ? "ml" : was.unit}`;
    if (memo.size > 5000) memo.clear();
    memo.set(line, p);
    return p;
  }

  // A parsed line's amount in base units: { qty (null when none), unit }.
  const toBase = p => (BASE[p.unit] ? { qty: p.qty === null ? null : p.qty * BASE[p.unit][1], unit: BASE[p.unit][0] } : { qty: p.qty, unit: p.unit });

  // --- Amounts as words ---
  const NEAT = [[1 / 2, "½"], [1 / 4, "¼"], [3 / 4, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
  // A number as an amount: "1½", "¾", "2", "0.15" (a neat fraction only when it's one).
  function fmtQty(q) {
    const whole = Math.floor(q + 1e-9), neat = NEAT.find(([v]) => Math.abs(q - whole - v) < 0.01);
    return neat ? `${whole || ""}${neat[1]}` : fmtNum(q, 2);
  }
  // "1½ cups", "1 cup", "2 tbsp", "3 cans" (n as it reads, text: n as words).
  const inUnit = (n, unit, text = fmtQty(n)) => `${text} ${n >= 1.005 && PLURAL[unit] ? PLURAL[unit] : unit}`;
  // The US way, rounded to a neat amount: a weight in oz under a pound, then lb, to a decimal; a volume in tsp under a
  // tablespoon, tbsp under ¼ cup, cups up to 4, then quarts, then gallons from 4 quarts, to the nearest ¼ or ⅓ (an
  // amount under ⅛ as it is).
  const STEPS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
  function toNeat(n) {
    const whole = Math.floor(n), step = STEPS.reduce((a, b) => (Math.abs(n - whole - b) < Math.abs(n - whole - a) ? b : a));
    return whole + step || n;
  }
  function fmtUS(q, base) {
    const weight = base === "g";
    const steps = weight ? [["oz", 16], ["lb", Infinity]] : [["tsp", 3], ["tbsp", 4], ["cup", 4.01], ["quart", 4], ["gallon", Infinity]];
    for (const [unit, below] of steps) {
      const n = q / BASE[unit][1], r = weight ? +n.toFixed(n < 0.095 ? 2 : 1) : toNeat(n);
      if (r < below) return inUnit(r, unit, weight ? String(r) : fmtQty(r));
    }
    return "";
  }
  // An amount in base units as words: "250 g", "1.4 kg", "1½ cups", "¾ tsp", "5" (a count: unit ""). A weight or a
  // volume is shown by mode: "entered" (in the unit its lines used, units, when they agree; the US way when they're
  // all US units; else metric), "metric" (g → kg and ml → l from 1000) or "us" (fmtUS). Counts are as they are.
  function fmtAmount(q, unit, mode = "entered", units = []) {
    if (unit !== "g" && unit !== "ml") return unit ? inUnit(q, unit) : fmtQty(q);
    if (mode === "entered" && units.length && units.every(u => !METRIC.has(u))) {
      if (units.length === 1) return inUnit(q / BASE[units[0]][1], units[0]);
      mode = "us";
    }
    if (mode === "us") return fmtUS(q, unit);
    return q >= 1000 ? `${fmtNum(q / 1000, 1)} ${unit === "g" ? "kg" : "l"}` : `${fmtNum(q, 1)} ${unit}`;
  }
  // A grocery row ({ qty, unit, units, name, many } in base units) as words, by mode: "1.5 kg rice", "5 eggs", "salt";
  // a count over one takes a plural spelling when a recipe wrote one ("3 onions", never "3 onion").
  const fmtLine = (row, mode) => (row.qty === null ? row.name
    : `${fmtAmount(row.qty, row.unit, mode, row.units)} ${!row.unit && row.qty >= 1.005 && row.many ? row.many : row.name}`);
  // A recipe's line at a scale, as the cook view shows it: as typed at ×1 (or with no amount), else the amount scaled,
  // in the line's own unit ("2 tbsp" doubled is "4 tbsp"; 500 g doubled is "1 kg").
  function scaledLine(text, scale) {
    const p = parseLine(text);
    if (scale === 1 || p.qty === null) return String(text).replace(/^\s*[-*•·]\s*/, "").trim();
    const b = toBase(p);
    return `${fmtAmount(b.qty * scale, b.unit, "entered", [p.unit])} ${p.name}${p.note ? `, ${p.note}` : ""}`;
  }

  // --- Store sections, guessed from the words in a name, singular or plural (the first group with one of them wins, so
  // "chicken stock" is Pantry and "chicken" Meat & fish); anything else is Other. ---
  const GUESS = [
    ["Frozen", "frozen ice"],
    ["Pantry", "stock broth bouillon can cans tin canned tinned paste sauce powder flakes dried spice spices seasoning peanut coconut black"],
    ["Drinks", "juice coffee tea wine beer soda water lemonade kombucha"],
    ["Meat & fish", "chicken beef pork salmon tuna turkey lamb bacon sausage sausages shrimp prawns fish cod mince ham steak chorizo"],
    ["Dairy & eggs", "milk cheese yogurt yoghurt butter egg eggs cream feta parmesan mozzarella cheddar ricotta"],
    ["Bakery", "bread tortilla tortillas bun buns bagel bagels pita baguette wraps"],
    ["Pantry", "rice pasta spaghetti noodles flour oil olive sugar salt beans lentils chickpeas oats quinoa vinegar honey cumin paprika cinnamon oregano cereal nuts almonds"],
    ["Produce", "onion garlic tomato pepper peppers lettuce apple lemon lime herbs potato carrot celery spinach kale cucumber avocado banana berries ginger cilantro parsley basil chives mushroom zucchini broccoli cabbage scallions leek eggplant aubergine"]
  ].map(([section, words]) => [section, new Set(words.split(" ").flatMap(w => [w, singular(w)]))]);
  function guessSection(norm) {
    const words = norm.split(/[^a-z]+/).filter(Boolean);
    const forms = w => [w, w.replace(/s$/, ""), w.replace(/es$/, ""), singular(w)]; // "limes" → lime, "berry" as berries
    for (const [section, set] of GUESS) if (words.some(w => forms(w).some(f => set.has(f)))) return section;
    return "Other";
  }

  Object.assign(A, { parseLine, readAmount, AMOUNT, toBase, fmtAmount, fmtLine, scaledLine, normName, guessSection });
})(Kyoshi, Kyoshi.apps.turtleduck);
