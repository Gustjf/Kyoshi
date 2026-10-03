/* Badgermole · session.js — the session screen, made for a glance between sets: the exercise big (a superset's colour
 * beside it, and its partner), "Set 2 of 3" ("· 8+ reps, to failure" when its reps are a minimum), the weight and reps
 * (number fields with − / + beside them, prefilled: stats.js prefill), ✓ Log set and Log all sets (neither moves on:
 * the extra sets are "Set 4", "Set 5"…; but for ✓ in a superset, which goes to the partner while it has planned sets
 * left), the sets logged (a PR badge the moment one beats the exercise's best; tap one to change it: it waits in the
 * steppers, and goes back as it was unless it's logged again), the routine's exercise list (tap to jump), and the
 * sticky Back · Next · Finish. The session in progress is this device's own (A.S.live, stored as "live": a reload
 * resumes it), and the screen stays on while it runs (A.awake in events.js; core/wakelock.js). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, isNum, newId, readNumber, todayStr, now } = K.util;
  const { MAX_REPS, MAX_WEIGHT, MAX_SESSION_SETS, STALE_HOURS, plural, round2, fmtMinutes, fmtSet, inUnit, unit, stepOf, pairClass } = A;

  const current = () => S.live.items[S.live.pos.item];
  const setsOf = (l, exerciseId) => l.sets.filter(s => s.exerciseId === exerciseId);
  // Its superset partner's place in the session (-1 without one).
  const partnerOf = (l, j) => { const p = l.items[j].pair; return p ? l.items.findIndex((x, k) => k !== j && x.pair === p) : -1; };
  // "23 min" since it started.
  const elapsedText = () => { const m = S.live ? Math.floor((now() - S.live.started) / 60000) : 0; return m > 0 ? fmtMinutes(m) : "Just started"; };
  const pickOverlay = () => $("pickOverlay");

  // A set tapped to change goes back where it was, as it was (moving on, finishing, or tapping another).
  function restoreHeld(l) {
    if (!l.held) return;
    l.sets.splice(Math.min(l.held.index, l.sets.length), 0, l.held.set);
    l.sets = A.numbered(l.sets);
    l.held = null;
  }
  // The held set's number within its exercise, once back in its place.
  const heldN = l => l.sets.slice(0, l.held.index).filter(s => s.exerciseId === l.held.set.exerciseId).length + 1;

  // The steppers as left (show) belong to one exercise in one unit: anything else starts from a set held to change,
  // else the prefill.
  function ensureShow() {
    const l = S.live, item = current(), h = l.held && l.held.set.exerciseId === item.exerciseId && l.held.set;
    if (l.show && l.show.item === l.pos.item && l.show.unit === unit()) return;
    l.show = { item: l.pos.item, ...(h ? { weight: inUnit(h.weight, h.unit), reps: h.reps, up: false } : A.prefill(item, setsOf(l, item.exerciseId).length + 1)), unit: unit() };
  }

  function renderSession() {
    const l = S.live;
    if (!l) return;
    ensureShow();
    const item = current(), logged = setsOf(l, item.exerciseId), held = l.held && l.held.set.exerciseId === item.exerciseId;
    const n = held ? heldN(l) : logged.length + 1, last = l.pos.item === l.items.length - 1, p = partnerOf(l, l.pos.item);
    $("sesName").textContent = l.name;
    $("sesElapsed").textContent = elapsedText();
    $("sesPos").textContent = `Exercise ${l.pos.item + 1} of ${l.items.length}`;
    $("exName").textContent = item.name;
    $("exName").className = `ex-name${p < 0 ? "" : pairClass(item.pair)}`;
    $("exPair").className = `ex-pair${p < 0 ? "" : pairClass(item.pair)}`;
    $("exPair").textContent = p < 0 ? "" : `Superset with ${l.items[p].name}`;
    $("exPair").hidden = p < 0;
    $("setNo").textContent = n <= item.sets ? `Set ${n} of ${item.sets}${item.toFailure ? ` · ${item.reps}+ reps, to failure` : ""}` : `Set ${n}`;
    $("sessionBox").classList.toggle("bw", item.bodyweight);
    $("weightLabel").textContent = `${item.bodyweight ? "Added weight" : "Weight"} (${unit()})`;
    $("repsLabel").textContent = item.toFailure ? "Good reps" : "Reps";
    $("weightInput").value = isNum(l.show.weight) ? l.show.weight : "";
    $("repsInput").value = isNum(l.show.reps) ? l.show.reps : "";
    $("upNote").textContent = `↑ +${item.bodyweight ? "1 rep" : `${stepOf(item.exerciseId)} ${unit()}`} from last time`;
    $("upNote").hidden = !l.show.up;
    $("logAllBtn").disabled = !held && logged.length >= item.sets;
    if (held) setStatus(`Set ${n} (${fmtSet(l.held.set)}) is in the steppers: change it and log it again, or it stays as it was.`);
    // The sets logged of this exercise, newest last; a PR badge on those that beat everything before them.
    const prs = A.livePRs();
    $("loggedList").innerHTML = l.sets.map((s, i) => ({ s, i })).filter(({ s }) => s.exerciseId === item.exerciseId).map(({ s, i }) =>
      `<li><button type="button" class="logged-set" data-act="relog" data-i="${i}" title="Change this set">` +
      `<span class="logged-n">${s.n}</span><span class="logged-what">${esc(fmtSet(s))}</span><span class="logged-tick" aria-hidden="true">&#10003;</span>` +
      `${prs.has(i) ? `<span class="badge pr">PR</span>` : ""}</button></li>`).join("");
    $("exList").innerHTML = l.items.map((it, j) => {
      const c = setsOf(l, it.exerciseId).length + (l.held && l.held.set.exerciseId === it.exerciseId ? 1 : 0), done = c >= it.sets;
      return `<button type="button" class="ex-chip${pairClass(it.pair)}${j === l.pos.item ? " current" : ""}${done ? " done" : ""}" data-act="jump" data-i="${j}"${j === l.pos.item ? ' aria-current="true"' : ""}>` +
        `${it.pair ? `<span class="pair-dot" aria-hidden="true"></span>` : ""}<span class="ex-chip-name">${esc(it.name)}</span><span class="ex-chip-count">${c}/${it.sets}${done ? " &#10003;" : ""}</span></button>`;
    }).join("");
    $("backBtn").disabled = l.pos.item === 0;
    $("nextBtn").disabled = last;
    $("nextBtn").textContent = last ? "Last exercise" : `Next: ${l.items[l.pos.item + 1].name}`;
  }

  // Every few seconds while a session runs: its minutes, here and on Home's Next up.
  function updateElapsed() {
    if (!S.live || !A.isActive()) return;
    [$("sesElapsed"), $("liveElapsed")].forEach(el => { if (el) el.textContent = elapsedText(); });
  }

  function setStatus(text, pr = false) {
    $("logStatus").innerHTML = text ? `${pr ? `<span class="badge pr">PR</span> ` : ""}${esc(text)}` : "";
    $("logStatus").classList.remove("bad");
  }
  function setProblem(text, field) {
    $("logStatus").textContent = text;
    $("logStatus").classList.add("bad");
    if (field) $(field).focus();
  }

  // ==========================================================================
  // Starting, moving about, finishing
  // ==========================================================================
  // One session at a time: with one in progress, Start just goes back to it.
  function startSession(routineId) {
    if (K.modal.isOpen(pickOverlay())) K.modal.close(pickOverlay());
    if (S.live) return resume();
    const r = A.routineById(routineId), items = A.routineItems(r);
    if (!r) return;
    if (!items.length) return alert(`${r.name} has no exercises yet. Add some to it in Routines first.`);
    S.live = A.cleanLive({ id: newId(), date: todayStr(), routineId: r.id, name: r.name, started: now(), items, sets: [], pos: { item: 0 } });
    A.storeLive();
    K.wakeLock.check(); // the screen stays on while it runs
    A.showView("session");
    setStatus("");
  }

  const resume = () => A.showView("session");

  function jumpTo(i) {
    const l = S.live;
    if (!l || !Number.isInteger(i) || i < 0 || i >= l.items.length || i === l.pos.item) return;
    restoreHeld(l);
    l.pos.item = i;
    l.show = null;
    A.storeLive();
    setStatus("");
    renderSession();
    window.scrollTo(0, 0);
  }

  // What the steppers say, checked: { weight, reps }, or null after saying what's wrong.
  function readShown() {
    const w = readNumber($("weightInput")), r = readNumber($("repsInput"));
    const weight = w === null ? 0 : w;
    if (!isNum(weight) || weight < 0 || weight > MAX_WEIGHT) { setProblem(`The weight goes from 0 to ${MAX_WEIGHT}.`, "weightInput"); return null; }
    if (!isNum(r) || Math.round(r) < 1 || Math.round(r) > MAX_REPS) { setProblem(`Reps go from 1 to ${MAX_REPS}.`, "repsInput"); return null; }
    return { weight: round2(weight), reps: Math.round(r) };
  }

  // The steppers changed (− / +, or typed): kept with the session (stored when store, so a reload or a trip to another
  // app keeps them; typing is stored once the field is left, not at every key).
  function keepShown(store) {
    const l = S.live;
    if (!l) return;
    l.show = { item: l.pos.item, weight: readNumber($("weightInput")), reps: readNumber($("repsInput")), unit: unit(), up: false };
    $("upNote").hidden = true;
    if (store) A.storeLive();
  }

  // − / +: the exercise's step of weight (its progression step: +5 lb, +2.5 kg…) or one rep.
  function step(field, dir) {
    if (!S.live) return;
    const el = field === "weight" ? $("weightInput") : $("repsInput"), v = readNumber(el), base = isNum(v) ? v : 0;
    el.value = field === "weight" ? Math.min(MAX_WEIGHT, Math.max(0, round2(base + dir * stepOf(current().exerciseId)))) : Math.min(MAX_REPS, Math.max(1, Math.round(base) + dir));
    keepShown(true);
  }

  // ✓: count sets as shown (Log all sets: the planned ones still to do). A set tapped to change goes back in its place
  // (its weight and unit as they were, if its weight wasn't changed); the others go last. Neither moves on, but for a
  // new set from ✓ (alternate) in a superset: on to the partner while it has planned sets left (back and forth).
  function log(count, alternate = false) {
    const l = S.live;
    if (!l) return;
    const v = readShown();
    if (!v || count < 1) return;
    const item = current(), set = { exerciseId: item.exerciseId, name: item.name, bodyweight: item.bodyweight, n: 0, reps: v.reps, weight: v.weight, unit: unit(), at: now() };
    const h = l.held && l.held.set.exerciseId === item.exerciseId ? l.held.set : null, place = h ? Math.min(l.held.index, l.sets.length) : -1;
    if (l.sets.length + count + (l.held && !h ? 1 : 0) > MAX_SESSION_SETS) return setProblem(`A session holds up to ${MAX_SESSION_SETS} sets.`);
    if (!h) restoreHeld(l);
    l.held = null;
    const at = place < 0 ? [...Array(count).keys()].map(k => l.sets.length + k) : [place].concat([...Array(count - 1).keys()].map(k => l.sets.length + 1 + k));
    const sets = l.sets.slice();
    if (h) sets.splice(place, 0, v.weight === inUnit(h.weight, h.unit) ? { ...set, weight: h.weight, unit: h.unit } : { ...set });
    for (let k = h ? 1 : 0; k < count; k++) sets.push({ ...set });
    l.sets = A.numbered(sets);
    l.show = { item: l.pos.item, weight: v.weight, reps: v.reps, unit: unit(), up: false };
    A.storeLive();
    const prs = A.livePRs(), numbers = at.map(i => l.sets[i].n), pr = at.some(i => prs.has(i));
    const what = `${count > 1 ? `Sets ${numbers[0]}–${numbers[numbers.length - 1]}` : `Set ${numbers[0]}`} logged: ${fmtSet(set)}`;
    const p = alternate && !h ? partnerOf(l, l.pos.item) : -1;
    if (p >= 0 && setsOf(l, l.items[p].exerciseId).length < l.items[p].sets) {
      jumpTo(p);
      return setStatus(`${item.name} · ${what}`, pr);
    }
    renderSession();
    setStatus(what, pr);
  }
  const logSet = () => log(1, true);
  function logAll() {
    const l = S.live;
    if (!l) return;
    const item = current(), held = l.held && l.held.set.exerciseId === item.exerciseId ? 1 : 0;
    log(Math.max(held, item.sets - setsOf(l, item.exerciseId).length));
  }

  // A logged set tapped: it waits in the steppers to be changed and logged again (in its place); moving on without
  // logging it puts it back as it was, so a stray tap loses nothing.
  function relog(i) {
    const l = S.live;
    if (!l || !l.sets[i]) return;
    if (l.held) {
      const h = Math.min(l.held.index, l.sets.length);
      restoreHeld(l);
      if (h <= i) i++; // the held set is back before it
    }
    const s = l.sets[i];
    l.held = { index: i, set: s };
    l.sets = A.numbered(l.sets.filter((_, j) => j !== i));
    const at = l.items.findIndex(it => it.exerciseId === s.exerciseId);
    if (at >= 0) l.pos.item = at;
    l.show = { item: l.pos.item, weight: inUnit(s.weight, s.unit), reps: s.reps, unit: unit(), up: false };
    A.storeLive();
    renderSession();
  }

  // The session ends: nothing in progress any more, Home again.
  function end() {
    S.live = null;
    A.storeLive();
    K.wakeLock.check();
    A.showView("home");
  }

  // Finish: the session is kept (with no set logged, there's nothing to keep), then its day pop-up opens on it, PRs
  // marked, typos fixable. One left running for hours ends at its last set, so its length stays believable.
  function finish() {
    const l = S.live;
    if (!l) return;
    restoreHeld(l);
    if (!l.sets.length) {
      if (confirm("Nothing was logged. Discard this session?")) end();
      return;
    }
    const t = now(), lastAt = Math.max(...l.sets.map(s => s.at));
    const finished = t - l.started > STALE_HOURS * 3600000 ? (lastAt > l.started ? lastAt : l.started + 60000) : t;
    const [session] = A.cleanSessions([{ id: l.id, date: l.date, routineId: l.routineId, name: l.name, sets: l.sets, started: l.started, finished, u: Date.now() }]);
    S.sessions = S.sessions.filter(s => s.id !== session.id).concat(session);
    A.save();
    end();
    A.openDay(session.date, session.id);
  }

  // Cancel the session (or Discard on Home): nothing from it is kept.
  function discard() {
    const l = S.live, n = l ? l.sets.length + (l.held ? 1 : 0) : 0;
    if (!l || !confirm(`Cancel this session${n ? ` and its ${plural(n, "set")}` : ""}? Nothing from it is kept.`)) return;
    end();
  }

  // Pick a routine: one big button each, to start any of them.
  function openPick() {
    const list = A.liveRoutines();
    $("pickList").innerHTML = list.length ? list.map(r => `<button type="button" class="pick-btn" data-act="start" data-id="${esc(r.id)}">` +
      `<span>${esc(r.name)}</span><span class="pick-meta">${esc(plural(A.routineItems(r).length, "exercise"))}</span></button>`).join("")
      : `<div class="empty-msg">No routines yet: add one in Routines.</div>`;
    K.modal.open(pickOverlay());
  }

  function wireSession() {
    K.modal.define(pickOverlay());
    $("sessionBox").addEventListener("click", e => {
      const b = e.target.closest("button[data-step]");
      if (b) step(b.dataset.step, +b.dataset.dir);
    });
    ["weightInput", "repsInput"].forEach(id => {
      $(id).addEventListener("input", () => keepShown(false));
      $(id).addEventListener("change", () => keepShown(true));
      // Enter (the phone's Done) just puts the keyboard away: logging is ✓'s job.
      $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $(id).blur(); } });
    });
    $("logBtn").addEventListener("click", logSet);
    $("logAllBtn").addEventListener("click", logAll);
    $("backBtn").addEventListener("click", () => S.live && jumpTo(S.live.pos.item - 1));
    $("nextBtn").addEventListener("click", () => S.live && jumpTo(S.live.pos.item + 1));
    $("finishBtn").addEventListener("click", finish);
    $("cancelSessionBtn").addEventListener("click", discard);
  }

  Object.assign(A, { renderSession, updateElapsed, elapsedText, startSession, resume, jumpTo, relog, finish, discard, openPick, wireSession });
})(Kyoshi, Kyoshi.apps.badgermole);
