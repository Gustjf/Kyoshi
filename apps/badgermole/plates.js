/* Badgermole · plates.js — the plate calculator (#plateOverlay): the weight to load (− / + by two of the smallest plate on),
 * the plates to put on each side of the bar, heaviest first, using only the plates turned on (if it can't be made exactly, the
 * nearest weight below it, and how short that is), a small diagram of the bar redrawn as you type, the common plates to turn
 * on or off and the bar's weight. Opens from the session's weight (with that weight) and from Home (with the bar). The plates
 * and the bar are kept per unit in settings (bar, plates: the same on every device, synced with the rest of settings);
 * the weight typed here is not kept. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { fmtNum, readNumber } = K.util;
  const { PLATES, MAX_BAR, MAX_WEIGHT, unit, round2 } = A;
  const overlay = () => $("plateOverlay");
  const QUARTERS = 4; // every plate is a multiple of 0.25 (1.25, 2.5…), so each side is counted in quarters

  // The plates for one side of the bar, as heavy as they go, and the weight they make. Fewest plates for the nearest weight
  // not above the target (what a greedy pass finds with the usual plates, and still finds one when it would stall).
  // → { plates: [45, 45], total, short } (short: how far below the target, 0 when exact).
  function solve(target, bar, avail) {
    const coins = avail.map(p => Math.round(p * QUARTERS)).filter(c => c > 0).sort((a, b) => b - a);
    const room = Math.max(0, Math.floor((target - bar) / 2 * QUARTERS + 1e-6));
    const best = [0];
    for (let i = 1; i <= room; i++) {
      best[i] = Infinity;
      for (const c of coins) if (c <= i && best[i - c] + 1 < best[i]) best[i] = best[i - c] + 1;
    }
    let at = room;
    while (at > 0 && best[at] === Infinity) at--;
    const plates = [];
    for (let i = at; i > 0;) {
      const c = coins.find(x => x <= i && best[i - x] === best[i] - 1);
      plates.push(c / QUARTERS);
      i -= c;
    }
    const total = round2(bar + 2 * at / QUARTERS);
    return { plates, total, short: target > total ? round2(target - total) : 0 };
  }

  // --- What is set now ---
  const bars = () => S.settings.bar[unit()];
  const on = () => S.settings.plates[unit()];
  const step = () => 2 * Math.min(...(on().length ? on() : PLATES[unit()]));
  // The bar as typed, when it's usable (else the one kept).
  function barNow() {
    const v = readNumber($("plateBar"));
    return v !== null && Number.isFinite(v) && v >= 0 && v <= MAX_BAR ? v : bars();
  }
  const targetNow = bar => { const v = readNumber($("plateTarget")); return v !== null && Number.isFinite(v) && v >= 0 ? Math.min(v, MAX_WEIGHT) : bar; };

  // --- The diagram: the bar across, a collar and the plates each side of the middle (the same on both), taller and
  // darker the heavier. Colours are the theme's, set in the css. ---
  function diagram(plates, u) {
    const maxP = PLATES[u][0], SIDE = 98, ROOM = 84, GAP = 1.5;
    const wide = p => 7 + 6 * (p / maxP);
    const need = plates.reduce((n, p) => n + wide(p) + GAP, 0), k = need > ROOM ? ROOM / need : 1;
    const rects = [];
    [-1, 1].forEach(dir => {
      let x = dir < 0 ? SIDE : 320 - SIDE; // the collar side of each plate
      plates.forEach(p => {
        const w = Math.max(1, wide(p) * k), h = Math.min(120, 26 + 88 * Math.sqrt(p / maxP)), left = dir < 0 ? x - w : x;
        rects.push(`<rect class="pc-plate" x="${left.toFixed(1)}" y="${(65 - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill-opacity="${(0.35 + 0.65 * Math.sqrt(p / maxP)).toFixed(2)}"><title>${fmtNum(p)} ${u}</title></rect>`);
        x += dir * (w + GAP * k);
      });
    });
    return `<rect class="pc-bar" x="6" y="61" width="308" height="8" rx="3"/>` +
      `<rect class="pc-collar" x="${SIDE}" y="52" width="4" height="26" rx="1"/><rect class="pc-collar" x="${320 - SIDE - 4}" y="52" width="4" height="26" rx="1"/>` + rects.join("");
  }

  function render() {
    const u = unit(), bar = barNow(), target = targetNow(bar), r = solve(target, bar, on());
    $("plateTargetLabel").textContent = `Weight to load (${u})`;
    $("plateBarLabel").textContent = `Bar (${u})`;
    $("plateSides").textContent = r.plates.length ? `Per side: ${r.plates.map(p => fmtNum(p)).join(", ")}` : "Just the bar";
    $("plateTotal").textContent = r.short ? `Closest: ${fmtNum(r.total)} ${u} — ${fmtNum(r.short)} ${u} short` : target < bar ? `The bar is ${fmtNum(bar)} ${u}` : `${fmtNum(r.total)} ${u} in all`;
    $("plateSvg").innerHTML = diagram(r.plates, u);
    $("plateSvg").setAttribute("aria-label", r.plates.length ? `The bar with ${r.plates.map(p => fmtNum(p)).join(", ")} on each side` : "The bar, with no plates");
    $("plateChips").querySelectorAll("button").forEach(b => { const v = on().includes(+b.dataset.p); b.classList.toggle("active", v); b.setAttribute("aria-pressed", String(v)); });
  }

  // Kept with the settings (everywhere): the stamp moves, so the later change wins when devices sync.
  function keep(patch) {
    S.settings = { ...S.settings, ...patch, u: Date.now() };
    A.save();
  }
  function togglePlate(p) {
    const u = unit();
    keep({ plates: { ...S.settings.plates, [u]: PLATES[u].filter(w => (w === p ? !on().includes(w) : on().includes(w))) } });
    render();
  }
  function saveBar() {
    const v = readNumber($("plateBar"));
    if (v === null || !Number.isFinite(v) || v < 0 || v > MAX_BAR) {
      $("plateBar").value = bars();
      render();
      return alert(`The bar weighs from 0 to ${MAX_BAR}.`);
    }
    if (round2(v) !== bars()) keep({ bar: { ...S.settings.bar, [unit()]: round2(v) } });
    $("plateBar").value = bars();
    render();
  }

  // − / +: to the next weight the plates can make step by step from the bar (two of the smallest plate on).
  function nudge(dir) {
    const bar = barNow(), s = step(), t = targetNow(bar), n = (t - bar) / s;
    const k = dir > 0 ? Math.floor(n + 1e-9) + 1 : Math.ceil(n - 1e-9) - 1;
    $("plateTarget").value = fmtNum(Math.min(MAX_WEIGHT, Math.max(0, bar + k * s)));
    render();
  }

  // Opens with the weight on the session's field (fromSession), or with just the bar.
  function openPlates(fromSession) {
    const u = unit(), w = fromSession ? readNumber($("weightInput")) : null;
    $("plateChips").innerHTML = PLATES[u].map(p => `<button type="button" class="pill pc-chip" data-p="${p}" aria-pressed="false">${fmtNum(p)}</button>`).join("");
    $("plateBar").value = bars();
    $("plateTarget").value = w !== null && Number.isFinite(w) && w > 0 ? fmtNum(Math.min(w, MAX_WEIGHT)) : fmtNum(bars());
    render();
    K.modal.open(overlay());
  }

  function wirePlates() {
    K.modal.define(overlay(), { dismiss: () => K.modal.close(overlay()) });
    $("plateTarget").addEventListener("input", render);
    $("plateBar").addEventListener("input", render);
    $("plateBar").addEventListener("change", saveBar);
    $("plateOverlay").querySelectorAll(".pc-step").forEach(b => b.addEventListener("click", () => nudge(+b.dataset.dir)));
    $("plateChips").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (b) togglePlate(+b.dataset.p); });
    $("plateDoneBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
  }

  Object.assign(A, { wirePlates, openPlates, solvePlates: solve });
})(Kyoshi, Kyoshi.apps.badgermole);
