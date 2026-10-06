/* Kyoshi · core/backup.js — backup & sync UI, as K.backup.
 * Fills Developer Mode's Backup & sync block (#kDevBackup, see core/dev.js) for the app on screen: Export JSON /
 * Import JSON, Export all / Import all (every app in one file), Sync Folder… and the folder's status line
 * (core/sync-folder.js), and where the app's data lives (its meta.backupNote, else DEFAULT_NOTE). The apps' pages hold
 * none of it. Runs the banners above every app for sync (#kSyncBanner) and storage (#kStorageBanner: slow to open,
 * out of reach, or nearly full).
 * Uses each app's A.data: build() for exports, importBackup(raw, ask) for imports (true once it's in). A backup
 * also holds the app's meetings (core/meetings.js), which an import combines with ours, the later change winning, and
 * when it was made (savedAt, core's). Every import's confirm names that date and how much newer what's here is: an app's
 * importBackup asks through K.backup.ask(A, raw, question). */
(function (K) {
  "use strict";
  const { isObj, todayStr, downloadJSON, readFile, fmtBytes } = K.util;
  const $ = id => document.getElementById(id);
  const running = () => K.order.map(id => K.apps[id]).filter(A => A.started);
  const DEFAULT_NOTE = "Your data lives only in this browser. Export a backup now and then, or sync to a folder to keep it on other devices too.";
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

  // Highlights an app's Export JSON (and Export all) while it has changes that aren't in a backup yet.
  function setUnsaved(A, value) {
    A._unsaved = value;
    render();
  }
  const isUnsaved = A => !!A._unsaved;

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
    if (!apps.length) return alert("That file isn't an Export all backup. To bring in one app's backup, switch to that app and use Import JSON.");
    const newest = apps.reduce((a, b) => (changedAt(b) > changedAt(a) ? b : a));
    withFile(date, () => {
      const note = ageNote(madeAt(raw), changedAt(newest), apps.length > 1 ? newest.meta.name : "");
      if (!confirm([`Replace everything in ${nameList(apps.map(A => A.meta.name))} with this backup?`, note, "This can't be undone."].filter(Boolean).join(" "))) return;
      apps.forEach(A => importApp(A, raw.apps[A.id], false));
    });
  }

  // Developer Mode's Backup & sync block, for the app on screen: its name, Export JSON highlighted while it has changes in
  // no backup (Export all while any app has), the sync folder's button and status line, and where its data lives. Then
  // the banner shown while sync is paused or broken. Called on every change, and by Developer Mode for a switch of app.
  function render() {
    const A = K.active(), state = K.folder.state(), folder = K.folder.folderName() ? `“${K.folder.folderName()}”` : "";
    if (A) {
      const note = K.folder.note(A), usable = !!(A.started && A.data); // an app that couldn't start offers its data on its page
      const status = !K.folder.supported ? "Autosave & sync to a folder needs Chrome or Edge, on a computer or Android."
        : state === "on" ? `Autosave & sync on with folder ${folder}${note ? ` | ${note}` : ""}` : "";
      $("kDevBackupApp").textContent = A.meta.name;
      $("kDevExportApp").classList.toggle("unsaved", isUnsaved(A));
      $("kDevExportApp").disabled = $("kDevImportApp").disabled = !usable;
      $("kDevSyncNote").textContent = status;
      $("kDevSyncNote").hidden = !status;
      $("kDevBackupNote").textContent = A.meta.backupNote || DEFAULT_NOTE;
    }
    $("kDevExportAll").classList.toggle("unsaved", running().some(isUnsaved));
    $("kDevSyncFolder").hidden = !K.folder.supported;
    $("kDevSyncFolder").textContent = state === "off" ? "Sync Folder…" : "Stop Syncing";
    $("kSyncBanner").hidden = state !== "paused" && state !== "error";
    $("kSyncBannerText").textContent = state === "paused" ? `Autosave & sync with ${folder} is paused until you allow access again.` : K.folder.message();
    $("kSyncBannerBtn").textContent = state === "paused" ? "Reconnect" : "Choose Folder";
  }

  // Picks a file through a hidden file input, then hands its text and date to fn.
  function onFile(input, fn) {
    input.addEventListener("change", async e => {
      const f = e.target.files[0];
      e.target.value = ""; // so picking the same file again still triggers an import
      const text = f ? await readFile(f) : null;
      if (typeof text === "string") fn(text, f.lastModified); // the file's date, for an old file that doesn't say
    });
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
    $("kSyncBannerBtn").addEventListener("click", () => (K.folder.state() === "paused" ? K.folder.reconnect() : K.folder.choose()));
    $("kDevExportApp").addEventListener("click", () => exportApp(K.active()));
    $("kDevImportApp").addEventListener("click", () => $("kDevImportAppFile").click());
    onFile($("kDevImportAppFile"), (text, date) => importText(K.active(), text, date)); // the app on screen once it's read
    $("kDevExportAll").addEventListener("click", exportAll);
    $("kDevImportAll").addEventListener("click", () => $("kDevImportFile").click());
    onFile($("kDevImportFile"), importAllText);
    $("kDevSyncFolder").addEventListener("click", () => (K.folder.state() === "off" ? K.folder.choose() : K.folder.stop()));
  }

  K.backup = { init, render, checkStorage, setUnsaved, isUnsaved, exportApp, importText, exportAll, importAllText, nameList, ask };
})(Kyoshi);
