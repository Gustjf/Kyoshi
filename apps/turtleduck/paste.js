/* Turtleduck · paste.js — Paste recipes (#pasteOverlay): many recipes at once, written out in a plain text format (the
 * pop-up shows it, folded): each starts at a line beginning with "#" (its name), then keys in any order and any case, the
 * colon optional (Meal, Serves / Servings / Yield, Prep, Cook, Per serving: 650 kcal, 45 g protein, …, or Calories,
 * Protein, Carbs, Fat, Fiber each on a line, Link, Store-bought: yes (or Bought, Ready-made: something bought ready to
 * eat)); "-", "*" or "•" lines are ingredients (or every line under "Ingredients:"); everything after the ingredients,
 * or after "Steps:", is the steps as typed. Preview lists each block with a tick (none for a name you already have:
 * ticking it adds a second, "Chili (2)"), its counts and any problems; a block with no name, or with neither
 * ingredients nor steps (unless it's store-bought), is skipped. Add puts the ticked ones in. A paste never changes a
 * recipe you have. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId } = K.util;
  const { MAX_NAME, MAX_LINES, MAX_STEPS, MAX_PASTE, MAX_SERVINGS, MAX_MINUTES, MAX_KCAL, MAX_GRAMS, TYPES, cleanLine, plural, sameName, fmtKcal } = A;
  const overlay = () => $("pasteOverlay");
  const TYPE_KEYS = TYPES.map(t => t[0]);

  // --- Reading a block's lines ---
  const KEY = /^(meal|type|serves|servings|yield|makes|prep(?:\s*time)?|cook(?:ing)?(?:\s*time)?|per\s+serving|nutrition|calories|kcal|energy|protein|carbs|carbohydrates|fat|fiber|fibre|link|url|source|store[\s-]*bought|bought|ready[\s-]*made)(\s*:)?\s*(.*)$/i;
  const HEAD = /^(ingredients|steps|method|directions|instructions)\s*(?::\s*(.*))?$/i; // alone on its line, or with a colon
  const BULLET = /^\s*[-*•·]\s*(.*)$/;
  const NUMBER = /(\d+(?:[.,]\d+)?)/;
  const num = v => { const m = NUMBER.exec(v); return m ? +m[1].replace(",", ".") : null; };
  // "1 h 15 min", "1h15", "90 min", "1.5 hours", "45" → minutes (a range, "15-20 min", its lower end, as amounts are);
  // null when there's no number.
  function minutesOf(text) {
    const v = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:-|–|—|to\s)\s*\d+(?:[.,]\d+)?/gi, "$1");
    const h = /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)(?![a-z])/i.exec(v);
    const m = /(\d+)\s*(?:m|min|mins|minute|minutes)(?![a-z])/i.exec(v) || (h && /^\s*(\d+)/.exec(v.slice(h.index + h[0].length)));
    if (h || m) return Math.round((h ? +h[1].replace(",", ".") * 60 : 0) + (m ? +m[1] : 0));
    return num(v) === null ? null : Math.round(num(v));
  }
  // "650 kcal, 45 g protein, 40 g carbs, 30 g fat, 8 g fiber" (or "P 45", "45g protein"…) → { kcal, protein, … }.
  const WORD = /(?<![a-z])(kcal|calories|cal|energy|protein|prot|carbohydrates|carbs|carb|fiber|fibre|fat|fi|p|c|f)(?![a-z])/i;
  const NUTRIENT = { kcal: "kcal", calories: "kcal", cal: "kcal", energy: "kcal", protein: "protein", prot: "protein", p: "protein", carbohydrates: "carbs", carbs: "carbs", carb: "carbs", c: "carbs", fat: "fat", f: "fat", fiber: "fiber", fibre: "fiber", fi: "fiber" };
  function nutrientsOf(v) {
    const out = {};
    v.split(/[,;·|]/).forEach(part => { const w = WORD.exec(part), n = num(part); if (w && n !== null) out[NUTRIENT[w[1].toLowerCase()]] = n; });
    return out;
  }
  const inRange = (v, max) => v !== null && v >= 0 && v <= max;

  // A key line ("Serves: 4"): sets the field and returns true; false when it isn't one. Without a colon it's a key only
  // before the ingredients, and only when its value reads ("Cook the pasta" is text; "Protein powder, 1 scoop" in the
  // list an ingredient). With a colon, a value that doesn't read is a problem, and the line is still a key.
  function readKey(m, r, problems, head) {
    const key = m[1].toLowerCase().replace(/\s+/g, " "), colon = !!m[2], v = m[3].trim(), word = m[1];
    if (!colon && !head) return false;
    const bad = what => { if (colon) problems.push(`${word}: couldn't read ${what}`); return colon; };
    if (key === "meal" || key === "type") {
      const t = (v.toLowerCase().match(/[a-z]+/) || [""])[0], meal = t === "supper" ? "dinner" : t === "brunch" ? "breakfast" : t;
      if (!TYPE_KEYS.includes(meal)) return bad("the meal (breakfast, lunch, dinner, snack or any)");
      r.meal = meal;
    } else if (/^(serves|servings|yield|makes)$/.test(key)) {
      const n = num(v);
      if (!inRange(n, MAX_SERVINGS) || n < 1) return bad("how many it serves");
      r.servings = Math.round(n);
    } else if (key.startsWith("prep") || key.startsWith("cook")) {
      const n = minutesOf(v);
      if (!inRange(n, MAX_MINUTES)) return bad("the minutes");
      r[key.startsWith("prep") ? "prepMin" : "cookMin"] = n;
    } else if (key === "per serving" || key === "nutrition") {
      const got = nutrientsOf(v);
      if (!Object.keys(got).length) return bad("the numbers");
      Object.assign(r, got);
    } else if (/^(calories|kcal|energy)$/.test(key)) {
      if (!inRange(num(v), MAX_KCAL)) return bad("the calories");
      r.kcal = num(v);
    } else if (/^(protein|carbs|carbohydrates|fat|fiber|fibre)$/.test(key)) {
      if (!inRange(num(v), MAX_GRAMS)) return bad("the grams");
      r[NUTRIENT[key]] = num(v);
    } else if (/bought|made/.test(key)) {
      // "Store-bought: yes" (or alone on its line), "Bought: no".
      const yes = !v || /^(yes|y|true)$/i.test(v);
      if (!yes && !/^(no|n|false)$/i.test(v)) return bad("yes or no");
      r.bought = yes;
    } else {
      if (!v || !colon) return colon;
      r.link = v;
    }
    return true;
  }

  // One block (its lines after the name): keys, then ingredients, then steps (see the header). Text before any
  // ingredient that isn't a key (a description) goes at the top of the steps.
  function readBlock(lines, r, problems) {
    const ingredients = [], intro = [], steps = [], hasSteps = lines.some(l => { const h = HEAD.exec(l.trim()); return h && h[1].toLowerCase() !== "ingredients"; });
    let state = "head"; // "head" → "list" (under Ingredients:) or "bullets" → "steps"
    for (const raw of lines) {
      const t = raw.trim();
      if (state === "steps") { steps.push(raw.replace(/\s+$/, "")); continue; }
      if (!t) { if (state === "list" && !hasSteps && ingredients.length) state = "steps"; continue; }
      const h = HEAD.exec(t);
      if (h) {
        state = h[1].toLowerCase() === "ingredients" ? "list" : "steps";
        if (h[2]) (state === "list" ? ingredients : steps).push(h[2]);
        continue;
      }
      const k = KEY.exec(t);
      if (k && readKey(k, r, problems, state === "head")) continue;
      const b = BULLET.exec(t);
      if (state === "list") ingredients.push(b ? b[1] : t);
      else if (b) { if (b[1]) ingredients.push(b[1]); state = "bullets"; }
      else if (state === "bullets") { state = "steps"; steps.push(raw.replace(/\s+$/, "")); }
      else intro.push(t);
    }
    if (ingredients.length > MAX_LINES) problems.push(`only the first ${MAX_LINES} ingredients are kept`);
    r.ingredients = ingredients.filter(Boolean);
    r.steps = intro.concat(intro.length && steps.length ? [""] : [], steps).join("\n").trim();
    if (r.steps.length > MAX_STEPS) problems.push(`the steps are cut to ${MAX_STEPS} characters`);
  }

  // The whole paste → { blocks: [{ n, name, recipe (cleaned: the shape it's kept in), problems, skip }], problems }.
  function parsePaste(text) {
    const lines = String(text).split(/\r\n?|\n/), blocks = [], problems = [];
    let current = null, before = false;
    lines.forEach(line => {
      const m = /^\s*#+\s*(.*)$/.exec(line);
      if (m) { blocks.push(current = { name: m[1].replace(/\s*#+\s*$/, "").trim(), lines: [] }); return; }
      if (current) current.lines.push(line);
      else if (line.trim()) before = true;
    });
    if (before) problems.push("The text before the first # was skipped: each recipe starts with a line like “# Chili”.");
    if (blocks.length > MAX_PASTE) problems.push(`Only the first ${MAX_PASTE} recipes are read: paste the rest after adding these.`);
    return {
      problems,
      blocks: blocks.slice(0, MAX_PASTE).map((b, i) => {
        const r = { name: cleanLine(b.name, MAX_NAME), meal: "any" }, out = [];
        if ([...b.name].length > MAX_NAME) out.push(`the name is cut to ${MAX_NAME} characters`);
        readBlock(b.lines, r, out);
        const skip = !r.name ? `Recipe ${i + 1} has no name after its #` : !r.ingredients.length && !r.steps && !r.bought ? "no ingredients or steps" : "";
        return { n: i + 1, name: r.name, recipe: skip ? null : A.cleanRecipes([{ ...r, id: "paste" }])[0], problems: skip ? [skip, ...out] : out, skip: !!skip };
      })
    };
  }

  // --- The pop-up ---
  const pending = () => !!$("pasteText").value.trim();
  // The names the ticked blocks will get: one you already have, or one earlier in the paste, gets " (2)", " (3)"…
  function finalNames(blocks) {
    const taken = A.liveRecipes().map(r => r.name), out = new Map();
    blocks.forEach(b => {
      if (!b.recipe || !b.on) return;
      let name = b.recipe.name;
      for (let n = 2; taken.some(x => sameName(x, name)); n++) name = `${[...b.recipe.name].slice(0, MAX_NAME - String(n).length - 3).join("").trim()} (${n})`;
      taken.push(name);
      out.set(b.n, name);
    });
    return out;
  }

  function renderPreview() {
    const p = S.paste;
    $("pastePreview").hidden = !p;
    $("pasteAddBtn").hidden = !p;
    if (!p) return;
    const names = finalNames(p.blocks), count = p.blocks.filter(b => b.recipe && b.on).length;
    $("pasteProblems").innerHTML = p.problems.map(x => `<div class="paste-problem">${esc(x)}</div>`).join("");
    $("pasteRows").innerHTML = p.blocks.map(b => {
      const r = b.recipe, exists = r && A.liveRecipes().some(x => sameName(x.name, r.name));
      const counts = !r ? "" : (r.bought ? ["store-bought", r.ingredients.length ? plural(r.ingredients.length, "ingredient") : "", r.kcal !== null ? `${fmtKcal(r.kcal)} kcal` : ""]
        : [plural(r.ingredients.length, "ingredient"), r.kcal !== null ? `${fmtKcal(r.kcal)} kcal` : "", r.steps ? "" : "no steps"]).filter(Boolean).join(" · ");
      // A name you have: unticked ("already have Chili"), or ticked, added as "Chili (2)"; one repeated in the paste too.
      const renamed = r && b.on && names.get(b.n) !== r.name ? `adds “${names.get(b.n)}”` : "";
      const note = [exists ? `already have ${r.name}` : "", renamed].filter(Boolean);
      return `<label class="paste-row${r ? "" : " skip"}"><input type="checkbox" data-n="${b.n}"${b.on ? " checked" : ""}${r ? "" : " disabled"}>` +
        `<span class="paste-main"><span class="paste-name">${esc(b.name || `Recipe ${b.n}`)}</span>` +
        (counts ? `<span class="paste-meta">${esc(counts)}</span>` : "") +
        note.map(x => `<span class="paste-meta">${esc(x)}</span>`).join("") +
        b.problems.map(x => `<span class="paste-problem">${esc(x)}</span>`).join("") + `</span></label>`;
    }).join("") || `<div class="empty-msg">No recipes found: each one starts with a line like “# Chili”.</div>`;
    $("pasteAddBtn").textContent = `Add ${plural(count, "recipe")}`;
    $("pasteAddBtn").disabled = !count;
  }

  function preview() {
    const p = parsePaste($("pasteText").value);
    p.blocks.forEach(b => { b.on = !!b.recipe && !A.liveRecipes().some(x => sameName(x.name, b.recipe.name)); });
    S.paste = p;
    renderPreview();
  }

  function add() {
    const p = S.paste;
    if (!p) return;
    const names = finalNames(p.blocks), t = Date.now(), added = [];
    p.blocks.forEach(b => { if (b.recipe && b.on) added.push({ ...b.recipe, id: newId(), name: names.get(b.n), at: t + added.length, u: t }); });
    if (!added.length) return;
    S.recipes = S.recipes.concat(A.cleanRecipes(added));
    A.save();
    close();
    A.showView("recipes");
  }

  function openPaste() {
    $("pasteText").value = "";
    S.paste = null;
    renderPreview();
    K.modal.open(overlay());
    $("pasteText").focus();
  }
  function close() {
    K.modal.close(overlay());
    S.paste = null;
  }

  function wirePaste() {
    // Esc, × and a click beside it ask first if something was pasted (core/modal.js); Cancel doesn't.
    K.modal.define(overlay(), { dismiss: close, pending, ask: "Discard what you've pasted?" });
    $("pastePreviewBtn").addEventListener("click", preview);
    $("pasteAddBtn").addEventListener("click", add);
    $("pasteCancelBtn").addEventListener("click", close);
    // A change to the text needs a new preview.
    $("pasteText").addEventListener("input", () => { if (S.paste) { S.paste = null; renderPreview(); } });
    $("pasteRows").addEventListener("change", e => {
      const b = S.paste && S.paste.blocks.find(x => String(x.n) === e.target.dataset.n);
      if (b) { b.on = e.target.checked; renderPreview(); }
    });
  }

  Object.assign(A, { parsePaste, openPaste, wirePaste });
})(Kyoshi, Kyoshi.apps.turtleduck);
