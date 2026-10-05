/* Turtleduck · cook.js — the cook view (#cookView): a recipe on a phone stand, never touched while cooking. Its name big,
 * "×2 · 8 portions" when scaled ("Store-bought" for an item bought ready to eat), its minutes and link, the ingredients
 * (scaled), and the steps as typed (a line each, a line starting with - or • a bullet), in big type; on a batch day
 * "1 of 3 · Next: Curry ›" pages through the day's recipes. ← Back goes back to where it was opened from. The screen
 * stays on while it's on screen (A.awake, events.js). Opened by a planned meal's Read, a recipe's Cook (Read), and Momo's
 * "Open in Turtleduck". */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc } = K.util;
  const { plural, fmtScale, fmtMinutes } = A;

  // Opens on recipes ([{ recipeId, scale, name }]: the name shows if the recipe is gone), from the first or index.
  function openCook(items, index = 0) {
    const list = (items || []).filter(x => x && x.recipeId);
    if (!list.length) return;
    if (S.view !== "cook") S.back = S.view;
    S.cooking = { items: list.map(x => ({ recipeId: x.recipeId, scale: x.scale || 1, name: x.name || "" })), index: Math.max(0, Math.min(index, list.length - 1)) };
    A.showView("cook");
  }
  function closeCook() {
    S.cooking = null;
    A.showView(S.back && S.back !== "cook" ? S.back : "plan");
  }
  function pageCook(by) {
    const c = S.cooking;
    if (!c || c.index + by < 0 || c.index + by >= c.items.length) return;
    c.index += by;
    renderCook();
    window.scrollTo(0, 0);
  }

  // The steps as typed: each line its own paragraph, runs of "- " or "• " lines a list.
  function stepsHTML(text) {
    const out = [];
    let items = [];
    const flush = () => { if (items.length) out.push(`<ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`); items = []; };
    text.split("\n").forEach(line => {
      const t = line.trim(), b = /^[-•*·]\s+(.*)$/.exec(t);
      if (b) return void items.push(b[1]);
      flush();
      if (t) out.push(`<p>${esc(t)}</p>`);
    });
    flush();
    return out.join("");
  }
  // A link that's a web address opens in a new tab; anything else (a cookbook's page) is just text.
  const linkHTML = link => (/^https?:\/\/\S+$/i.test(link) ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a>` : esc(link));

  function renderCook() {
    const c = S.cooking;
    if (!c) return;
    const item = c.items[c.index], r = A.recipeById(item.recipeId), next = c.items[c.index + 1];
    const nameOf = x => { const rr = A.recipeById(x.recipeId); return rr ? rr.name : x.name || "Recipe"; };
    $("cookPager").innerHTML = c.items.length > 1 ? `<button type="button" class="icon-btn" data-act="cook-prev" aria-label="The one before"${c.index ? "" : " disabled"}>&lsaquo;</button>` +
      `<span>${c.index + 1} of ${c.items.length}${next ? ` · Next: ${esc(nameOf(next))}` : ""}</span>` +
      `<button type="button" class="icon-btn" data-act="cook-next" aria-label="The next one"${next ? "" : " disabled"}>&rsaquo;</button>` : "";
    if (!r) {
      $("cookBox").innerHTML = `<h2 class="cook-name">${esc(item.name || "Recipe")}</h2><p class="cook-meta">This recipe was deleted.</p>`;
      return;
    }
    const minutes = [r.prepMin ? `prep ${fmtMinutes(r.prepMin)}` : "", r.cookMin ? `cook ${fmtMinutes(r.cookMin)}` : ""].filter(Boolean).join(" · ");
    // A store-bought item is as it comes: never scaled.
    const scale = r.bought ? 1 : item.scale, made = r.bought ? "Store-bought" : scale !== 1 ? `×${fmtScale(scale)} · ${plural(A.yieldAt(r, scale), "portion")}` : `Serves ${r.servings}`;
    $("cookBox").innerHTML = `<h2 class="cook-name">${esc(r.name)}</h2><p class="cook-meta">${esc([made, minutes].filter(Boolean).join(" · "))}</p>` +
      (r.link ? `<p class="cook-meta cook-link">${linkHTML(r.link)}</p>` : "") +
      (r.ingredients.length ? `<h3>Ingredients</h3><ul class="cook-ings">${r.ingredients.map(l => `<li>${esc(A.scaledLine(l, scale))}</li>`).join("")}</ul>` : "") +
      (r.steps ? `<h3>Steps</h3><div class="cook-steps">${stepsHTML(r.steps)}</div>` : "");
  }

  Object.assign(A, { openCook, closeCook, pageCook, renderCook });
})(Kyoshi, Kyoshi.apps.turtleduck);
