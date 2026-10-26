/* Bosco · treatments.js — the non-daily treatments (creams like tretinoin, tazarotene, glycopyrrolate): their data
 * (cleaning, merging), the "Non-daily treatments" section (a card each: the day last taken, "10/25 - (yesterday)";
 * Took it today, or Undo while today's), start-up info's list (add, rename, remove) and Developer Mode's days between.
 * No schedule: the days between only light a card once that many days have passed.
 * S.retinoids = { regimens, log } (store and backup key "retinoids", kept from the retinoid build-ups this replaced, 9.037):
 * each treatment { id, name, every: days between, at (when added: the order), u, x? (removed) }; each day taken a log
 * record { id: "<treatment>:<date>", r, date, u, x? (undone) }. An old retinoid regimen reads as a treatment named after
 * its retinoid, every its last step's days; its log stays as it is. Nothing is deleted: a removed treatment and an undone
 * day are markers (x: true, a later u); both lists merge record by record by the later change. Never sent to Momo. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { isObj, isDate, esc, newId, todayStr, daysBetween, mergeById, readNumber } = K.util;
  const { MAX_TREATMENTS, MAX_EVERY, DEFAULT_EVERY, retinoidLabel } = A;

  // ==========================================================================
  // DATA: cleaning (storage, backups, sync saves) and merging
  // ==========================================================================
  const isWhole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const stamp = v => (Number.isFinite(v) && v >= 0 ? v : 0);
  const isId = v => typeof v === "string" && /^[a-z0-9]{1,40}$/i.test(v);
  const cleanName = v => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 40) : "");
  // A stamp for a record changed here now: later than now and than the version it replaces (another device's clock may run ahead).
  const stampAbove = old => Math.max(Date.now(), old ? stamp(old.u) + 1 : 0);

  // A treatment from storage or a file, or null if it's unusable; an old retinoid regimen (8.601–8.937) as one.
  function cleanTreatment(r) {
    if (!isObj(r) || !isId(r.id)) return null;
    const old = typeof r.retinoid === "string" && r.retinoid.trim() ? r.retinoid.trim().toLowerCase() : "";
    const name = cleanName(r.name) || (old ? cleanName(retinoidLabel(old)) : "");
    const steps = Array.isArray(r.steps) ? r.steps.filter(s => isObj(s) && isWhole(s.every, 1, MAX_EVERY)) : [];
    const every = isWhole(r.every, 1, MAX_EVERY) ? r.every : steps.length ? steps[steps.length - 1].every : DEFAULT_EVERY;
    if (!name) return null;
    return { id: r.id, name, every, at: stamp(r.at), u: stamp(r.u), ...(r.x === true ? { x: true } : {}) };
  }
  // A log record, its id rebuilt from its treatment and day (never trusted), or null.
  function cleanRecord(l) {
    if (!isObj(l) || !isId(l.r) || !isDate(l.date)) return null;
    return { id: `${l.r}:${l.date}`, r: l.r, date: l.date, u: stamp(l.u), ...(l.x === true ? { x: true } : {}) };
  }
  // Both lists in the order they're kept (the same on every device): treatments by when they were added, the log by day.
  const sorted = d => ({
    regimens: d.regimens.slice().sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    log: d.log.slice().sort((a, b) => a.date.localeCompare(b.date) || a.r.localeCompare(b.r))
  });
  // From storage or a file: undefined unless it has them (an older copy's, which leaves ours as they are); else the
  // usable records, a repeated id's later change.
  function cleanRetinoids(raw) {
    if (!isObj(raw)) return undefined;
    const list = (l, clean) => mergeById([], (Array.isArray(l) ? l : []).map(clean).filter(Boolean));
    return sorted({ regimens: list(raw.regimens, cleanTreatment), log: list(raw.log, cleanRecord) });
  }
  // Two versions record by record, each its later change (one undefined: the other's).
  const mergeRetinoids = (a, b) => (!a ? b : !b ? a : sorted({ regimens: mergeById(a.regimens, b.regimens), log: mergeById(a.log, b.log) }));
  // A change made here, kept in order and saved.
  function keep(d) {
    S.retinoids = sorted(d);
    A.save();
    A.renderAll();
  }

  const treatments = () => S.retinoids.regimens.filter(r => !r.x); // the live ones, by when they were added
  // The day a treatment was last taken, "" if never.
  const lastTaken = r => S.retinoids.log.filter(l => l.r === r.id && !l.x && l.date <= todayStr()).map(l => l.date).pop() || "";
  // "10/25 - (yesterday)", "10/22 - (4 days ago)"; the year too when it isn't this one.
  function lastWords(date) {
    if (!date) return "Not taken yet";
    const [y, m, d] = date.split("-").map(Number), n = daysBetween(date, todayStr());
    const ago = n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
    return `${m}/${d}${date.slice(0, 4) === todayStr().slice(0, 4) ? "" : `/${String(y).slice(2)}`} - (${ago})`;
  }

  // Took it today: today's record (again, if it was undone). Undo: today's taken back, a marker.
  function take(id) {
    const today = todayStr(), rid = `${id}:${today}`, old = S.retinoids.log.find(l => l.id === rid);
    keep({ ...S.retinoids, log: S.retinoids.log.filter(l => l !== old).concat({ id: rid, r: id, date: today, u: stampAbove(old) }) });
  }
  function undo(id) {
    const rid = `${id}:${todayStr()}`;
    keep({ ...S.retinoids, log: S.retinoids.log.map(l => (l.id === rid && !l.x ? { ...l, x: true, u: stampAbove(l) } : l)) });
  }
  // A treatment changed (renamed, its days between) or removed (a marker; its days taken stay in the data).
  function change(id, fields) {
    keep({ ...S.retinoids, regimens: S.retinoids.regimens.map(r => (r.id === id ? { ...r, ...fields, u: stampAbove(r) } : r)) });
  }
  // A new one, at the end; false after saying why.
  function add(name) {
    name = cleanName(name);
    if (!name) return false;
    if (treatments().length >= MAX_TREATMENTS) { alert(`Up to ${MAX_TREATMENTS} treatments.`); return false; }
    keep({ ...S.retinoids, regimens: S.retinoids.regimens.concat({ id: newId(), name, every: DEFAULT_EVERY, at: Date.now(), u: Date.now() }) });
    return true;
  }

  // ==========================================================================
  // THE SECTION: a card each (hidden with none)
  // ==========================================================================
  function renderTreatments() {
    const list = treatments(), today = todayStr();
    $("treatmentsSection").hidden = !list.length;
    $("treatmentsGrid").innerHTML = list.map(r => {
      const last = lastTaken(r), due = !last || daysBetween(last, today) >= r.every;
      return `<div class="stat${last !== today && due ? " due" : ""}">
        <div class="val">${esc(r.name)}</div><div class="lbl">${lastWords(last)}</div>
        ${last === today ? `<button class="secondary small" data-undo-treatment="${r.id}">Undo</button>`
          : `<button class="small" data-take="${r.id}">Took it today</button>`}
      </div>`;
    }).join("");
  }

  // ==========================================================================
  // START-UP INFO: the list (a name each, renamed in place; Remove) and the add line
  // ==========================================================================
  function renderTreatmentsSetup() {
    const list = treatments();
    $("treatmentList").innerHTML = list.map(r => `<div class="treatment-item">
      <input type="text" maxlength="40" value="${esc(r.name)}" data-rename="${r.id}" aria-label="Name">
      <button type="button" class="secondary small" data-remove-treatment="${r.id}">Remove</button>
    </div>`).join("");
    $("treatmentAddLine").hidden = list.length >= MAX_TREATMENTS;
  }
  // What's typed in the add line goes in (also from start-up info's Save).
  function addTyped() {
    if (!$("treatmentNew").value.trim()) return;
    if (add($("treatmentNew").value)) $("treatmentNew").value = "";
    renderTreatmentsSetup();
  }

  // ==========================================================================
  // DEVELOPER MODE: each one's days between
  // ==========================================================================
  function renderDevTreatments(box) {
    const list = treatments();
    if (!list.length) return;
    const block = document.createElement("div");
    block.className = "dev-block";
    block.innerHTML = `<div class="dev-block-head">Non-daily treatments: days between</div>${list.map(r => `<label class="treatment-every">
      <span>${esc(r.name)}</span><input type="number" min="1" max="${MAX_EVERY}" step="1" value="${r.every}" data-every="${r.id}"></label>`).join("")}
      <div class="dev-hint">A card turns amber once this many days have passed since it was last taken.</div>`;
    block.querySelectorAll("[data-every]").forEach(el => el.addEventListener("change", () => {
      const n = readNumber(el), r = treatments().find(x => x.id === el.dataset.every);
      if (r && isWhole(n, 1, MAX_EVERY)) change(r.id, { every: n });
      else if (r) el.value = r.every;
    }));
    box.appendChild(block);
  }

  // ==========================================================================
  // WIRING (from A.init)
  // ==========================================================================
  function initTreatments() {
    const onButton = (el, selector, fn) => el.addEventListener("click", e => { const b = e.target.closest(selector); if (b) fn(b); });
    onButton($("treatmentsGrid"), "button[data-take]", b => take(b.dataset.take));
    onButton($("treatmentsGrid"), "button[data-undo-treatment]", b => undo(b.dataset.undoTreatment));
    onButton($("treatmentList"), "button[data-remove-treatment]", b => {
      const r = treatments().find(x => x.id === b.dataset.removeTreatment);
      if (!r || !confirm(`Remove ${r.name}? The days you took it stay in your data.`)) return;
      change(r.id, { x: true });
      renderTreatmentsSetup();
    });
    $("treatmentList").addEventListener("change", e => {
      const el = e.target.closest("[data-rename]"), r = el && treatments().find(x => x.id === el.dataset.rename);
      if (!r) return;
      const name = cleanName(el.value);
      if (name && name !== r.name) change(r.id, { name });
      else el.value = r.name;
    });
    $("addTreatmentBtn").addEventListener("click", addTyped);
    $("treatmentNew").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } });
  }

  Object.assign(A, {
    cleanRetinoids, mergeRetinoids, stampAbove, treatments, lastTaken, lastWords, renderTreatments, renderTreatmentsSetup, addTyped, renderDevTreatments, initTreatments
  });
})(Kyoshi, Kyoshi.apps.bosco);
