/* Momo · truecost.js — the true cost (YNAB's "true expenses", in hours): what the apps ask of an average week, against
 * what the baseline gives — each block title (Meeting, Iroh's goals) the room the baseline gives it, and the apps' own
 * cards (fill "card": errands, calls, workouts, meals, jobs), all together, the free time it leaves (its 168 hours less
 * its cards; Free time counts as free) — so what's short every week shows up before it bites.
 * Each week's asks are kept as they're seen (data.asks, model.js): while a week is this week, what every app asks of it,
 * by app and block title ("<app>|" for its own cards), in minutes: the needs on its days (done ones too), its hours needs,
 * and any other that could go on it (tasks.js canGo), but never what's ongoing. They're recorded only once every app has
 * started (K.ready: until then the others' needs aren't in), and only when this device sees them change, so two devices
 * that see a week a little differently never write over each other in turn. The baseline's Tasks show it: first a line
 * with what the apps' own cards ask, app by app, and the free time the baseline leaves (✓, or short); then, an app at a
 * time, a block title the baseline gives less than its average ask is a task as long as the gap (drag it onto a day, or
 * click it to pick days); one it covers, a quiet ✓. The average is over the weeks kept among the last COST_WEEKS (this
 * one too): a week Momo wasn't opened isn't counted, and one where a title asked nothing counts 0 for it. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, sum, addDays } = K.util;
  const { DAY_HOURS, STEP, COST_WEEKS, FREE_TIME, fmtH, cleanText, thisWeekKey } = A;

  // What the apps ask of the week starting key: { "<app>|<block title>": minutes }, the title as first spelt, "<app>|" for
  // its own cards, in key order.
  function weekAsk(f, key) {
    const out = {}, spelt = new Map(), end = addDays(key, 6);
    f.needs.filter(n => n.fill !== "ongoing" && (n.date ? n.date >= key && n.date <= end : A.canGo(n, key))).forEach(n => {
      const title = n.fill === "card" ? "" : cleanText(n.block), low = `${n.app}|${title.toLowerCase()}`;
      if (!title && n.fill !== "card") return;
      if (!spelt.has(low)) spelt.set(low, `${n.app}|${title}`);
      const k = spelt.get(low);
      out[k] = (out[k] || 0) + A.needMinutes(n);
    });
    return Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
  }

  // Keeps this week's asks (f: the fill just drawn) when this device sees them change, or when the week has none kept (an
  // import replaced Momo's data, say). True if Momo's data changed. forgetAsks: after an import, see them afresh.
  let seen = ""; // this week's asks as this device last worked them out
  const forgetAsks = () => { seen = ""; };
  function recordAsks(f) {
    if (!K.ready || !S.data) return false;
    const key = thisWeekKey(), by = weekAsk(f, key), now = `${key} ${JSON.stringify(by)}`, had = S.data.asks[key];
    if (now === seen && had) return false;
    seen = now;
    if (had && JSON.stringify(had.by) === JSON.stringify(by)) return false; // a week that asked nothing is kept too: it counts 0
    S.data.asks[key] = { by, u: had ? had.u : 0 }; // save() stamps it
    return true;
  }

  // The true cost: { weeks: how many weeks it's over, rows: the block titles [{ title, apps: [{ id, minutes }] (most
  // first), minutes: its average a week, room: the baseline's minutes for it (any case), short }] in the order first
  // asked, apps: the apps' own cards [{ id, minutes: their average a week }] in the switcher's order, total: theirs
  // together, free: the minutes the baseline leaves free (Free time counts as free) }. An app that asks for cards of its
  // own (now, or in a week kept) and for nothing else now has the block titles kept from before it did ("Errands")
  // counted as its own cards, so last month's rows don't linger.
  function trueCost() {
    const tk = thisWeekKey(), from = addDays(tk, -7 * (COST_WEEKS - 1));
    const weeks = Object.keys(S.data.asks).filter(k => k >= from && k <= tk).sort(), titles = new Map(), room = new Map(), own = new Map();
    const split = ak => { const bar = ak.indexOf("|"); return [ak.slice(0, bar), ak.slice(bar + 1)]; };
    const now = S.fill ? S.fill.needs : [], cardApps = new Set(now.filter(n => n.fill === "card").map(n => n.app));
    weeks.forEach(k => Object.keys(S.data.asks[k].by).forEach(ak => { const [app, title] = split(ak); if (!title) cardApps.add(app); }));
    now.forEach(n => { if (n.fill !== "card" && n.fill !== "ongoing") cardApps.delete(n.app); });
    weeks.forEach(k => Object.keys(S.data.asks[k].by).forEach(ak => {
      const [app, title] = split(ak), low = title.toLowerCase(), m = S.data.asks[k].by[ak];
      if (!title || cardApps.has(app)) return own.set(app, (own.get(app) || 0) + m);
      const t = titles.get(low) || titles.set(low, { title, apps: new Map() }).get(low);
      t.apps.set(app, (t.apps.get(app) || 0) + m);
    }));
    S.data.baseline.cards.forEach(c => { const low = c.title.toLowerCase(); room.set(low, (room.get(low) || 0) + Math.round(c.hours * 60)); });
    const apps = [...own.keys()].sort((a, b) => order(a) - order(b) || (a < b ? -1 : 1)).map(id => ({ id, minutes: own.get(id) / weeks.length }));
    const busy = sum(S.data.baseline.cards.filter(c => c.title.toLowerCase() !== FREE_TIME.toLowerCase()).map(c => Math.round(c.hours * 60)));
    return {
      weeks: weeks.length,
      rows: [...titles].map(([low, t]) => {
        const apps = [...t.apps].map(([id, m]) => ({ id, minutes: m / weeks.length })).sort((a, b) => b.minutes - a.minutes);
        const minutes = sum(apps.map(a => a.minutes)), r = room.get(low) || 0;
        return { title: t.title, apps, minutes, room: r, short: Math.max(0, minutes - r) };
      }),
      apps, total: sum(apps.map(a => a.minutes)), free: 7 * DAY_HOURS * 60 - busy
    };
  }
  // An app's place in the switcher (one not there last).
  const order = id => (K.order.includes(id) ? K.order.indexOf(id) : K.order.length);
  // Short by at least half of 15 minutes, once rounded.
  const isShortBy = m => Math.round(m / (STEP * 60)) > 0;
  const isShort = r => isShortBy(r.short);

  // The baseline's tasks: each block title it gives less than its average ask, as long as the gap (to the nearest 15 minutes,
  // as its numbers show), in its main app's chunk.
  const costTasks = () => trueCost().rows.filter(isShort).map(r => ({ key: `c:${r.title.toLowerCase()}`, app: r.apps[0].id, title: cleanText(r.title), hours: Math.min(DAY_HOURS, Math.round(r.short / (STEP * 60)) * STEP), needs: [], cost: r }));

  // Minutes on the 15-minute grid, as Momo writes hours: "2.5h", "45m".
  const about = m => fmtH(Math.max(STEP, Math.round(m / (STEP * 60)) * STEP));
  const appNames = r => A.names(r.apps.map(a => ({ title: K.apps[a.id] ? K.apps[a.id].meta.name : a.id })));
  // A block title the baseline is short of: what it asks a week and what the baseline gives, and the gap to drag in.
  function costHTML(t) {
    const r = t.cost, gives = r.room ? fmtH(r.room / 60) : "nothing";
    const label = `${t.title}: ${appNames(r)} ask${r.apps.length === 1 ? "s" : ""} about ${about(r.minutes)} a week, your baseline gives ${gives} — drag onto a day to add the ${fmtH(t.hours)} it's short, or click to pick days`;
    return `<div class="card parked task cost" data-task="${esc(t.key)}" role="button" tabindex="0" aria-label="${esc(label)}" title="${esc(label)}" style="--c:${A.cardColor(t)}">` +
      `<span class="card-title">${esc(t.title)}<span class="card-fill"> · ${about(r.minutes)} a week, baseline ${r.room ? fmtH(r.room / 60) : "0h"}</span></span><span class="task-hours">+${fmtH(t.hours)}</span></div>`;
  }
  // One the baseline covers: quiet, with its ✓.
  function okHTML(r) {
    const label = `${r.title}: ${appNames(r)} ask${r.apps.length === 1 ? "s" : ""} about ${about(r.minutes)} a week, your baseline gives ${fmtH(r.room / 60)} ✓`;
    return `<span class="cost-ok" title="${esc(label)}" aria-label="${esc(label)}" style="--c:${A.keyColor(A.titleKey(r.title))}">${esc(r.title)}<span class="card-fill"> · ${about(r.minutes)} ✓</span></span>`;
  }

  // The apps' own cards in an average week, app by app, against the free time the baseline leaves: ✓, or short (amber).
  function appsHTML(c) {
    if (!c.apps.length) return "";
    const gap = c.total - c.free, short = isShortBy(gap), each = c.apps.map(a => `${K.apps[a.id] ? K.apps[a.id].meta.name : a.id} ${about(a.minutes)}`).join(" · ");
    return `<div class="cost-apps">Your apps ask about ${about(c.total)} a week — ${esc(each)}. The baseline leaves ${fmtH(Math.max(0, c.free) / 60)} free` +
      (short ? `: <strong class="cost-short">short ${about(gap)}</strong>` : ` <span class="cost-fine">✓</span>`) + `</div>`;
  }
  // The baseline bank's words when the apps' own cards ask more than the baseline leaves free (else ""): "your apps ask
  // about 11h, 2h more than your baseline leaves free".
  function appsShort(c = trueCost()) {
    const gap = c.total - c.free;
    return c.apps.length && isShortBy(gap) ? `your apps ask about ${about(c.total)}, ${about(gap)} more than your baseline leaves free` : "";
  }

  // Draws the baseline's Tasks (tasks.js renderTasks; list: its tasks, short ones and the ongoing): the apps' own cards'
  // line, then a chunk per app, each block title it asks for (short ones first), then what's ongoing there; the head
  // says what it's an average of.
  function renderCost(list) {
    const cost = trueCost(), { weeks, rows } = cost, ok = rows.filter(r => !isShort(r)).map(r => ({ app: r.apps[0].id, r }));
    const html = appsHTML(cost) + A.appsIn(list.concat(ok)).map(id => {
      const mine = list.filter(t => t.app === id), P = K.apps[id];
      const m = sum(rows.filter(r => r.apps.some(a => a.id === id)).map(r => r.apps.find(a => a.id === id).minutes));
      return A.chunkHTML(P, P ? P.meta.name : id, m ? `about ${about(m)} a week` : "in progress",
        mine.filter(t => t.cost).map(A.taskHTML).join("") + ok.filter(x => x.app === id).map(x => okHTML(x.r)).join("") + mine.filter(t => t.ongoing).map(A.taskHTML).join(""));
    }).join("");
    $("taskCards").innerHTML = html || `<span class="tasks-empty">What the apps ask for in an average week shows up here, against what your baseline gives each block and the free time it leaves, and what's ongoing in them, to drag onto a day.</span>`;
    $("tasksTotal").textContent = weeks ? `True cost: the apps' average week (the last ${weeks === 1 ? "week" : `${weeks} weeks`} seen) against your baseline` : "";
  }

  Object.assign(A, { weekAsk, recordAsks, forgetAsks, trueCost, costTasks, costHTML, appsShort, renderCost });
})(Kyoshi, Kyoshi.apps.momo);
