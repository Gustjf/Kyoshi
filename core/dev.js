/* Kyoshi · core/dev.js — the one Developer Mode for every app, as K.dev.
 * Ctrl+9 or the DEV badge (bottom-right, for phones) opens #kDevPanel: versions, the app on
 * screen's own tools (A.renderDev(box)), Cloud sync (core/cloud-ui.js: the key, Sync now, decrypted copies), Backup &
 * sync (core/backup.js: Export/Import JSON for the app on screen, Export/Import all apps, the sync folder), time travel
 * (test mode), storage used, bugs & requests (core/bugs.js), and the app's or Kyoshi's changelog (its latest entries;
 * the file holds the rest). The test banner lives here too. */
(function (K) {
  "use strict";
  const { fmtDate, todayStr, addMonths, daysBetween, fmtBytes } = K.util;
  const $ = id => document.getElementById(id);
  const LOG_ENTRIES = 3; // the changelog's latest entries shown
  let on = false;
  let logFor = "app"; // the changelog shown: "app" (the one on screen) or "kyoshi"

  function toggle() {
    on = !on;
    document.body.classList.toggle("dev-mode", on);
    $("kDevBadge").setAttribute("aria-pressed", on);
    refresh();
  }

  // Redraws the panel for the app on screen, while it's open (its Cloud and Backup & sync blocks always: core/cloud-ui.js,
  // core/backup.js).
  function refresh() {
    $("kDevBugCount").textContent = K.bugs.count();
    K.cloudUI.render();
    K.backup.render();
    const A = K.active();
    if (!on || !A) return;
    $("kDevVersion").textContent = `${A.meta.name} ${A.VERSION} | Kyoshi ${K.VERSION}`;
    $("kDevToday").textContent = fmtDate(todayStr(), { weekday: "short", month: "short", day: "numeric" });
    refreshTools(A);
    renderStorage();
    const log = logFor === "kyoshi" ? K.CHANGELOG : A.CHANGELOG || [], older = log.length - LOG_ENTRIES;
    const file = logFor === "kyoshi" ? "core/changelog.js" : `apps/${A.id}/changelog.js`;
    $("kDevLogPills").innerHTML = [["app", A.meta.name], ["kyoshi", "Kyoshi"]].map(([v, label]) =>
      `<button type="button" class="pill${v === logFor ? " active" : ""}" data-log="${v}">${label}</button>`).join("");
    $("kDevChangelog").innerHTML = log.slice(0, LOG_ENTRIES).map(c => `<div class="changelog-entry">
      <span class="changelog-version">v${c.version}</span><span class="changelog-date">${c.date}</span>
      <ul>${c.changes.map(x => `<li>${x}</li>`).join("")}</ul>
    </div>`).join("") + (older > 0 ? `<div class="dev-hint">… and ${older} older ${older === 1 ? "entry" : "entries"}, in ${file}</div>` : "");
  }

  // Redraws just the app's own tools (A.refreshDev() calls this after the app changes).
  function refreshTools(A) {
    if (!on || A !== K.active()) return;
    const box = $("kDevAppTools");
    box.innerHTML = "";
    if (!A.started || !A.renderDev) return;
    try { A.renderDev(box); } catch (err) { console.error(`${A.meta.name}'s developer tools failed to draw.`, err); }
  }

  // How much Kyoshi keeps, where, and whether the browser has promised to keep it.
  async function renderStorage() {
    const [u, f] = await Promise.all([K.storage.usage(), K.files.usage()]);
    const where = { indexeddb: "the browser's large store (IndexedDB)", localStorage: "localStorage, the small store (about 5 MB for everything at this address)", memory: "memory only: this browser's storage can't be reached, so changes aren't kept" }[u.backend];
    $("kDevStorage").textContent = `Kyoshi's data: ${fmtBytes(u.bytes)}, in ${where}.` +
      (f.count ? ` Photos and documents: ${f.count} (${fmtBytes(f.bytes)}).` : "") +
      (u.backend !== "memory" && u.quota ? ` This site uses ${fmtBytes(u.used)} of the ${fmtBytes(u.quota)} this browser allows it.` : "") +
      ` Protected from automatic clean-up: ${u.persisted ? "yes" : "no"}.`;
  }

  // Moves "today" forward to rehearse rollovers, reminders and close-outs. The first
  // jump switches to test mode, where nothing is saved or synced until a reload.
  function travel(days) {
    if (!K.testMode) {
      if (!confirm("Time travel is for testing. Kyoshi switches to test mode: nothing is saved or synced until you reload the page. Continue?")) return;
      K.testMode = true;
      K.storage.startTest();
      K.files.startTest();
      K.sync.stopTimers();
    }
    K.dayOffset += days;
    renderTestBanner();
    K.tick(); // every app catches up with the new day
    refresh();
  }

  function renderTestBanner() {
    $("kTestBanner").hidden = !K.testMode;
    if (K.testMode) $("kTestBannerText").textContent = `Test mode: Kyoshi thinks today is ${fmtDate(todayStr(), { weekday: "long", month: "short", day: "numeric", year: "numeric" })}. Nothing is being saved or synced — reload to go back.`;
  }

  function init() {
    $("kDevBadge").addEventListener("click", toggle);
    $("kDevClose").addEventListener("click", toggle);
    $("kDevPlusDay").addEventListener("click", () => travel(1));
    $("kDevPlusWeek").addEventListener("click", () => travel(7));
    $("kDevPlusMonth").addEventListener("click", () => travel(daysBetween(todayStr(), addMonths(todayStr(), 1))));
    $("kDevPlusSeason").addEventListener("click", () => travel(daysBetween(todayStr(), K.seasons.seasonAfter(todayStr())))); // to the next season's first day
    $("kDevCopyBugs").addEventListener("click", K.bugs.copyAll);
    $("kDevDownloadBugs").addEventListener("click", K.bugs.download);
    $("kDevClearBugs").addEventListener("click", K.bugs.clear);
    $("kDevLogPills").addEventListener("click", e => {
      const btn = e.target.closest("button[data-log]");
      if (btn) { logFor = btn.dataset.log; refresh(); }
    });
    $("kTestBannerBtn").addEventListener("click", () => location.reload());
    refresh();
  }

  K.dev = { init, toggle, isOn: () => on, refresh, refreshTools, travel };
})(Kyoshi);
