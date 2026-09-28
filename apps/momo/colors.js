/* Momo · colors.js — card and goal colours.
 * Every card with the same title is the same colour, wherever it is, and no
 * two titles share one; a goal's cards (and any card called its name) are
 * the goal's colour instead. So colours belong to keys — "t:" and a title
 * in lower case, or "g:" and a goal's id — in data.colors as { c, u }: c is
 * a PALETTE name, or "x0", "x1"… for colours made up once the whole palette
 * is on show. Free time is slate unless it's given a colour.
 * A key on show (on the baseline, this week or next, or a goal) without a
 * colour gets the highlight least like the colours on show, else the least
 * like them of the rest. A title off the boards keeps its colour for
 * COLOR_WEEKS after it was last used, unless one on show needs it, so it's
 * the same colour when it's back. Picking a colour another key has swaps them. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays } = K.util;
  const { PALETTE, HIGHLIGHTS, FREE_TIME, COLOR_WEEKS, thisWeekKey, nextWeekKey } = A;

  const PALETTE_HEX = new Map(PALETTE);
  const FREE_KEY = `t:${FREE_TIME.toLowerCase()}`;
  const goalKey = id => `g:${id}`;
  // A title's key; a goal's name is that goal's, so a card called that is its colour too.
  function titleKey(title, d = S.data) {
    const t = title.trim().toLowerCase(), g = d.goals.find(x => !x.deleted && x.name.toLowerCase() === t);
    return g ? goalKey(g.id) : `t:${t}`;
  }
  // A card's key: its goal's while it has one, else its title's.
  const cardKey = (c, d = S.data) => (c.goalId && d.goals.some(g => g.id === c.goalId && !g.deleted) ? goalKey(c.goalId) : titleKey(c.title, d));
  const isColor = c => PALETTE_HEX.has(c) || /^x\d{1,4}$/.test(c);
  // Made-up colours, in OKLCH: hues a golden angle apart, at two lightnesses.
  const extraLch = i => [i % 2 ? 0.74 : 0.64, 0.1, (i * 137.508 + 10) % 360];
  function colorCss(c) {
    if (PALETTE_HEX.has(c)) return PALETTE_HEX.get(c);
    if (!isColor(c)) return "var(--momo-slate)";
    const [l, ch, h] = extraLch(+c.slice(1));
    return `oklch(${l} ${ch} ${h.toFixed(1)})`;
  }
  const colorName = c => (c === "slate" ? "Slate" : PALETTE_HEX.has(c) ? c[0].toUpperCase() + c.slice(1) : `Extra colour ${+c.slice(1) + 1}`);
  // What a key or a card shows: its colour, else slate (Free time's).
  const keyColor = key => colorCss(S.data.colors[key] ? S.data.colors[key].c : "slate");
  const cardColor = c => keyColor(cardKey(c));

  // Where a colour sits in OKLab (Björn Ottosson's), where the distance
  // between two colours is how different they look.
  const labs = new Map();
  function colorLab(c) {
    if (labs.has(c)) return labs.get(c);
    let lab;
    if (PALETTE_HEX.has(c)) {
      const hex = PALETTE_HEX.get(c);
      const [r, g, b] = [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      lab = [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
    } else {
      const [l, ch, h] = extraLch(+c.slice(1));
      lab = [l, ch * Math.cos(h * Math.PI / 180), ch * Math.sin(h * Math.PI / 180)];
    }
    labs.set(c, lab);
    return lab;
  }
  const colorGap = (a, b) => { const p = colorLab(a), q = colorLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

  // The keys on show — the baseline's, this week's and next week's cards,
  // then every goal — and those used lately: on show, or in any week from
  // COLOR_WEEKS back on.
  function colorKeys(d) {
    const tk = thisWeekKey(), from = addDays(tk, -7 * COLOR_WEEKS), shown = new Set(), lately = new Set();
    [d.baseline, d.weeks[tk], d.weeks[nextWeekKey()]].forEach(list => { if (list) list.cards.forEach(c => shown.add(cardKey(c, d))); });
    d.goals.forEach(g => { if (!g.deleted) shown.add(goalKey(g.id)); });
    Object.keys(d.weeks).forEach(k => { if (k >= from) d.weeks[k].cards.forEach(c => lately.add(cardKey(c, d))); });
    shown.forEach(k => lately.add(k));
    return { shown: [...shown], lately };
  }

  // Keeps every key on show with a colour of its own. Where two keys have
  // the same one (two devices' changes combined), the one on show keeps it,
  // else the one changed last; a key not used lately lets its colour go;
  // then each key on show without one gets one. True if anything changed.
  function ensureColors(d = S.data) {
    const before = JSON.stringify(d.colors), { shown, lately } = colorKeys(d), onShow = new Set(shown), taken = new Set();
    Object.keys(d.colors).sort((a, b) => onShow.has(b) - onShow.has(a) || d.colors[b].u - d.colors[a].u || (a < b ? -1 : 1)).forEach(k => {
      if (!lately.has(k) || taken.has(d.colors[k].c)) delete d.colors[k];
      else taken.add(d.colors[k].c);
    });
    shown.forEach(k => { if (k !== FREE_KEY && !d.colors[k]) setColor(d, k, freeColor(d, shown)); });
    d.colors = Object.fromEntries(Object.keys(d.colors).sort().map(k => [k, d.colors[k]]));
    return JSON.stringify(d.colors) !== before;
  }

  // The colour for a key on show that needs one: one no key has, else one
  // only a title off the boards has (which gives it up); a highlight before
  // the rest, and of those the one least like the colours on show. Once
  // every colour in the palette is on show, a made-up one.
  function freeColor(d, shown) {
    const owner = new Map(Object.keys(d.colors).map(k => [d.colors[k].c, k]));
    const onShow = shown.filter(k => d.colors[k]).map(k => d.colors[k].c);
    const apart = c => Math.min(Infinity, ...onShow.map(o => colorGap(c, o)));
    for (const spare of [c => !owner.has(c), c => !onShow.includes(c)]) {
      for (const tier of [PALETTE.slice(0, HIGHLIGHTS), PALETTE.slice(HIGHLIGHTS)]) {
        const options = tier.map(([c]) => c).filter(spare);
        if (options.length) return options.reduce((best, c) => (apart(c) > apart(best) ? c : best));
      }
    }
    for (let i = 0; ; i++) if (!owner.has(`x${i}`)) return `x${i}`;
  }

  // Gives a key a colour; a title off the boards that had it lets it go.
  function setColor(d, key, c) {
    Object.keys(d.colors).forEach(k => { if (k !== key && d.colors[k].c === c) delete d.colors[k]; });
    d.colors[key] = { c, u: 0 };
  }

  // A colour picked for a key. The key that had it swaps: it takes this
  // key's old colour, or gets a new one if this key had none (a new title,
  // or Free time's slate). Picking slate gives Free time its own back.
  function pickColor(key, c) {
    const colors = S.data.colors, old = colors[key] ? colors[key].c : null;
    if (c === "slate") { if (key === FREE_KEY) delete colors[key]; return; }
    if (!isColor(c) || c === old) return;
    const other = Object.keys(colors).find(k => k !== key && colors[k].c === c);
    colors[key] = { c, u: 0 };
    if (other && old) colors[other] = { c: old, u: 0 };
    else if (other) delete colors[other]; // ensureColors gives it a new one, if it's on show
  }

  // The cards on the baseline, this week and next; and whether one besides skip has a key.
  const cardsOnShow = () => [S.data.baseline, A.weekOf(thisWeekKey()), A.weekOf(nextWeekKey())].flatMap(list => list.cards);
  const keyOnShow = (key, skip = null) => cardsOnShow().some(c => c !== skip && cardKey(c) === key);

  // A key as it's known: its goal's name, or its title as a card on show has it.
  function keyName(key) {
    if (key.startsWith("g:")) { const g = A.goalById(key.slice(2)); return g ? g.name : ""; }
    const c = cardsOnShow().find(x => cardKey(x) === key);
    return c ? c.title : key.slice(2);
  }

  Object.assign(A, {
    PALETTE_HEX, FREE_KEY, goalKey, titleKey, cardKey, isColor, colorCss, colorName, keyColor, cardColor,
    colorKeys, ensureColors, freeColor, setColor, pickColor, cardsOnShow, keyOnShow, keyName
  });
})(Kyoshi, Kyoshi.apps.momo);
