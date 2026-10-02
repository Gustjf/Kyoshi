/* Kyoshi · core/backup.js — backup & sync UI, as K.backup.
 * Fills each app's <section data-kyoshi="backup"></section> with Export JSON / Import JSON /
 * Sync Folder… and the sync status line; runs the banners above every app for sync
 * (#kSyncBanner) and storage (#kStorageBanner: slow to open, out of reach, or nearly full);
 * Export all / Import all (Developer Mode, see core/dev.js) put every app in one file.
 * Uses each app's A.data: build() for exports, importBackup(raw, ask) for imports (true once it's in). A backup
 * also holds the app's meetings (core/meetings.js), which an import combines with ours, the later change winning, and
 * when it was made (savedAt, core's). Every import's confirm names that date and how much newer what's here is: an app's
 * importBackup asks through K.backup.ask(A, raw, question). */
(function (K) {
  "use strict";
  const { isObj, todayStr, downloadJSON, readFile, fmtBytes } = K.util;
  const $ = id => document.getElementById(id);
  const running = () => K.order.map(id => K.apps[id]).filter(A => A.started);
  // "Bosco", "Bosco and Momo", "Bosco, Momo and Appa".
  const nameList = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

  // --- How old a backup is, against what's here ---
  let fileDate = 0; // the picked file's date while it's imported, for a backup that doesn't say when it was made
  const stamp = v => { const t = typeof v === "string" ? Date.parse(v) : 0; return isFinite(t) && t > 0 ? t : 0; };
  // When a backup was made (ms): its savedAt (exports since Kyoshi 3.430, and sync folder saves), an Export all file's
  // exportedAt, else the file's own date; 0 when none says.
  const madeAt = raw => (isObj(raw) && (stamp(raw.savedAt) || stamp(raw.exportedAt))) || fileDate;
  // When an app's data here last changed (ms): a change made on this device, an import, or another device's save brought
  // in (core/sync.js keeps it, sync folder or not); 0 when it never has.
  const changedAt = A => stamp(A._sync && A._sync.meta.changedAt);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // "3 days", "5 hours", "20 minutes".
  function span(ms) {
    const days = Math.floor(ms / 864e5), hours = Math.floor(ms / 36e5);
    return days ? plural(days, "day") : hours ? plural(hours, "hour") : plural(Math.max(1, Math.round(ms / 6e4)), "minute");
  }
  const when = t => new Date(t).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  // The words an import's confirm adds: when the backup was made, and how much newer what's here is (or that nothing here
  // changed since). who: the app whose data here is newest, for Import all.
  function ageNote(made, here, who = "") {
    if (!made) return "";
    return `This backup is from ${when(made)}.${!here ? "" : here > made + 6e4 ? ` What's here is ${span(here - made)} newer (${who ? `${who} ` : ""}last changed ${when(here)}).`
      : ` Nothing here has changed since (the last change was ${when(here)}).`}`;
  }
  // An app's Import JSON asks this way (its A.data.importBackup): its own question, then the backup's date and how much
  // newer what's here is. True when the user says yes.
  const ask = (A, raw, question) => confirm([question, ageNote(madeAt(raw), changedAt(A)), "This can't be undone."].filter(Boolean).join(" "));

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
      if (typeof text === "string") importText(A, text, f.lastModified);
    });
    syncBtn.addEventListener("click", () => (K.sync.state() === "off" ? K.sync.choose() : K.sync.stop()));
    setUnsaved(A, !!A._unsaved);
  }

  // Highlights an app's Export JSON while it has changes that aren't in a backup yet.
  function setUnsaved(A, value) {
    A._unsaved = value;
    if (A._backup) A._backup.exportBtn.classList.toggle("unsaved", value);
  }

  // An app's backup: its data, with when it was made and its meetings beside it.
  const backupOf = A => ({ ...A.data.build(), savedAt: new Date().toISOString(), meetings: K.meetings.build(A) });

  // Brings in an app's backup (raw: its parsed JSON), asking first if ask; then its meetings, once it's in.
  function importApp(A, raw, ask) {
    if (A.data.importBackup(raw, ask) === true) K.meetings.take(A, raw.meetings);
  }
  // While a picked file is brought in, its own date stands in for a backup that doesn't say when it was made.
  function withFile(date, fn) {
    fileDate = date > 0 ? date : 0;
    try { fn(); } finally { fileDate = 0; }
  }

  function exportApp(A) {
    downloadJSON(backupOf(A), `${A.id}-backup-${todayStr()}.json`);
    setUnsaved(A, false);
  }

  // Import JSON in an app: its own backup, or its part of an Export all file (dated by the file, if it isn't itself).
  function importText(A, text, date = 0) {
    let raw;
    try { raw = JSON.parse(text); } catch (err) { return alert(`That file isn't a valid ${A.meta.name} backup (it couldn't be read as JSON).`); }
    if (isObj(raw) && isObj(raw.apps) && !A.data.looksLike(raw)) {
      if (!isObj(raw.apps[A.id])) return alert(`That Kyoshi backup has nothing for ${A.meta.name} in it.`);
      date = madeAt(raw) || date;
      raw = raw.apps[A.id];
    }
    withFile(date, () => importApp(A, raw, true));
  }

  // One file with every app's backup, under apps.<id>.
  function exportAll() {
    const apps = {};
    running().forEach(A => { apps[A.id] = backupOf(A); });
    downloadJSON({ kyoshiVersion: K.VERSION, exportedAt: new Date().toISOString(), apps }, `kyoshi-backup-${todayStr()}.json`);
    running().forEach(A => setUnsaved(A, false));
  }

  // Replaces each app in an Export all file with its part, after asking once: with the file's date, and how much newer
  // the newest of those apps' data here is.
  function importAllText(text, date = 0) {
    let raw;
    try { raw = JSON.parse(text); } catch (err) { return alert("That file isn't a valid Kyoshi backup (it couldn't be read as JSON)."); }
    const apps = isObj(raw) && isObj(raw.apps) ? running().filter(A => isObj(raw.apps[A.id])) : [];
    if (!apps.length) return alert("That file isn't an Export all backup. To bring in one app's backup, use Import JSON in that app.");
    const newest = apps.reduce((a, b) => (changedAt(b) > changedAt(a) ? b : a));
    withFile(date, () => {
      const note = ageNote(madeAt(raw), changedAt(newest), apps.length > 1 ? newest.meta.name : "");
      if (!confirm([`Replace everything in ${nameList(apps.map(A => A.meta.name))} with this backup?`, note, "This can't be undone."].filter(Boolean).join(" "))) return;
      apps.forEach(A => importApp(A, raw.apps[A.id], false));
    });
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

  // The storage banner: the browser is slow to open Kyoshi's storage, it's out of reach (changes
  // aren't kept), or it's 80% full.
  async function checkStorage() {
    const u = K.storage.backend() === "opening" ? { backend: "opening" } : await K.storage.usage();
    const full = u.quota > 0 && u.used / u.quota >= 0.8;
    const text = u.backend === "opening" ? "Kyoshi is waiting for this browser's storage. If nothing shows up soon, close any other Kyoshi tabs, or restart the browser."
      : u.backend === "memory" ? "Kyoshi can't reach this browser's storage right now, so changes won't be kept. Reload to try again, and export a backup if it keeps happening."
      : full ? `Kyoshi's storage in this browser is ${Math.round(u.used / u.quota * 100)}% full (${fmtBytes(u.used)} of ${fmtBytes(u.quota)}). Export all apps from Developer Mode, and free up space on this device.` : "";
    $("kStorageBanner").hidden = !text;
    $("kStorageBannerText").textContent = text;
  }

  function init() {
    $("kSyncBannerBtn").addEventListener("click", () => (K.sync.state() === "paused" ? K.sync.reconnect() : K.sync.choose()));
  }

  K.backup = { init, mount, render, checkStorage, setUnsaved, isUnsaved: A => !!A._unsaved, exportApp, importText, exportAll, importAllText, nameList, ask };
})(Kyoshi);
