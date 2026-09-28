/* Kyoshi · core/backup.js — backup & sync UI, as K.backup.
 * Fills each app's <section data-kyoshi="backup"></section> with Export JSON / Import JSON /
 * Sync Folder… and the sync status line; runs the sync banner (#kSyncBanner) above every app;
 * Export all / Import all (Developer Mode, see core/dev.js) put every app in one file.
 * Uses each app's A.data: build() for exports, importBackup(raw, ask) for imports. */
(function (K) {
  "use strict";
  const { isObj, todayStr, downloadJSON, readFile } = K.util;
  const $ = id => document.getElementById(id);
  const running = () => K.order.map(id => K.apps[id]).filter(A => A.started);
  // "Bosco", "Bosco and Momo", "Bosco, Momo and Appa".
  const nameList = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

  // Fills an app's backup section (if its markup has one); called once, when its root is made.
  function mount(A) {
    const box = A.root.querySelector('[data-kyoshi="backup"]');
    if (!box) return;
    box.innerHTML = `<h2>Backup &amp; sync</h2>
      <div class="toolbar">
        <button class="secondary">Export JSON</button>
        <button class="secondary">Import JSON</button>
        <button class="secondary" hidden>Sync Folder&hellip;</button>
        <input type="file" accept=".json,application/json" hidden>
      </div>
      <div class="note"></div>
      <div class="footnote">${A.meta.backupNote || "Your data lives only in this browser. Export a backup now and then, or sync to a folder to keep it on other devices too."}</div>`;
    const [exportBtn, importBtn, syncBtn] = box.querySelectorAll("button"), file = box.querySelector("input");
    A._backup = { exportBtn, syncBtn, status: box.querySelector(".note") };
    exportBtn.addEventListener("click", () => exportApp(A));
    importBtn.addEventListener("click", () => file.click());
    file.addEventListener("change", async e => {
      const f = e.target.files[0];
      e.target.value = ""; // so picking the same file again still triggers an import
      const text = f ? await readFile(f) : null;
      if (typeof text === "string") importText(A, text);
    });
    syncBtn.addEventListener("click", () => (K.sync.state() === "off" ? K.sync.choose() : K.sync.stop()));
    setUnsaved(A, !!A._unsaved);
  }

  // Highlights an app's Export JSON while it has changes that aren't in a backup yet.
  function setUnsaved(A, value) {
    A._unsaved = value;
    if (A._backup) A._backup.exportBtn.classList.toggle("unsaved", value);
  }

  function exportApp(A) {
    downloadJSON(A.data.build(), `${A.id}-backup-${todayStr()}.json`);
    setUnsaved(A, false);
  }

  // Import JSON in an app: its own backup, or its part of an Export all file.
  function importText(A, text) {
    let raw;
    try { raw = JSON.parse(text); } catch (err) { return alert(`That file isn't a valid ${A.meta.name} backup (it couldn't be read as JSON).`); }
    if (isObj(raw) && isObj(raw.apps) && !A.data.looksLike(raw)) {
      if (!isObj(raw.apps[A.id])) return alert(`That Kyoshi backup has nothing for ${A.meta.name} in it.`);
      raw = raw.apps[A.id];
    }
    A.data.importBackup(raw, true);
  }

  // One file with every app's backup, under apps.<id>.
  function exportAll() {
    const apps = {};
    running().forEach(A => { apps[A.id] = A.data.build(); });
    downloadJSON({ kyoshiVersion: K.VERSION, exportedAt: new Date().toISOString(), apps }, `kyoshi-backup-${todayStr()}.json`);
    running().forEach(A => setUnsaved(A, false));
  }

  // Replaces each app in an Export all file with its part, after asking once.
  function importAllText(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (err) { return alert("That file isn't a valid Kyoshi backup (it couldn't be read as JSON)."); }
    const apps = isObj(raw) && isObj(raw.apps) ? running().filter(A => isObj(raw.apps[A.id])) : [];
    if (!apps.length) return alert("That file isn't an Export all backup. To bring in one app's backup, use Import JSON in that app.");
    if (!confirm(`Replace everything in ${nameList(apps.map(A => A.meta.name))} with this backup? This can't be undone.`)) return;
    apps.forEach(A => A.data.importBackup(raw.apps[A.id], false));
  }

  // Every app's sync button and status line, and the banner shown while sync is paused or broken.
  function render() {
    const state = K.sync.state(), folder = K.sync.folderName() ? `“${K.sync.folderName()}”` : "";
    K.order.forEach(id => {
      const A = K.apps[id], b = A._backup;
      if (!b) return;
      const note = K.sync.note(A);
      const status = !K.sync.supported ? "Autosave & sync to a folder needs Chrome or Edge, on a computer or Android."
        : state === "on" ? `Autosave & sync on with folder ${folder}${note ? ` | ${note}` : ""}` : "";
      b.syncBtn.hidden = !K.sync.supported;
      b.syncBtn.textContent = state === "off" ? "Sync Folder…" : "Stop Syncing";
      b.status.textContent = status;
      b.status.hidden = !status;
    });
    $("kSyncBanner").hidden = state !== "paused" && state !== "error";
    $("kSyncBannerText").textContent = state === "paused" ? `Autosave & sync with ${folder} is paused until you allow access again.` : K.sync.message();
    $("kSyncBannerBtn").textContent = state === "paused" ? "Reconnect" : "Choose Folder";
  }

  function init() {
    $("kSyncBannerBtn").addEventListener("click", () => (K.sync.state() === "paused" ? K.sync.reconnect() : K.sync.choose()));
  }

  K.backup = { init, mount, render, setUnsaved, isUnsaved: A => !!A._unsaved, exportApp, importText, exportAll, importAllText, nameList };
})(Kyoshi);
