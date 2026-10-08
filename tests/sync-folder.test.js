/* Kyoshi · tests/sync-folder.test.js — autosave & sync to a folder (core/sync-folder.js), with the browser's folder
 * picker stood in for by a folder in memory (headless Chromium has no picker): connected through Developer Mode's Sync
 * Folder… button, this device's save goes in; another device's is loaded, and lands in the browser's storage together
 * with its version counters (a reload keeps it); and when the folder is stopped while a pass is reading its next file,
 * the save already brought in is stored with its counters all the same — never the counters alone, which would claim
 * changes this device doesn't have (the file is never read again, and the next save would spread the loss); a save made
 * by a newer Kyoshi isn't brought in: sync stops, its banner saying to reload, and nothing is saved meanwhile. */
"use strict";
const { DESKTOP, eq, ok, has, open, devPanel, importBackup, lastDialog, text } = require("./lib");
const gen = require("./generate");

const ERRANDS = gen.ERRANDS.slice(0, 3).map(([text, minutes]) => ({ text, minutes }));
const TEXTS = ERRANDS.map(e => e.text).sort();
const FOLDER = "Kyoshi Sync";
const PHONE_FILE = "hawky-autosave-phone-phone1.json", TABLET_FILE = "hawky-autosave-phone-tablet.json";
const BTN = "#kDevSyncFolder";

// The browser's folder picker and its handles, in each page before Kyoshi loads, as core/sync-folder.js and core/files.js
// use them (kind, name, entries, getDirectoryHandle, getFileHandle, removeEntry, queryPermission, requestPermission;
// getFile → a File; createWritable → write, close). Their methods are on the prototypes, so a handle can be kept in
// IndexedDB as the real one is (its structured clone keeps kind and name alone: after a reload the folder is "paused",
// as a real one may be). window.__folder: plant(app, name, text) (a file another device's sync tool dropped, newer than
// any), read(app, name), names(app), hold(name) (that file's next read waits until release(); held counts the reads
// waiting).
function fakeFolder() {
  const st = { tick: 0, holdOn: "", wait: null, release: null, held: 0 };
  class FileHandle {
    constructor(name) { this.kind = "file"; this.name = name; Object.defineProperty(this, "_", { value: { text: "", modified: 0 } }); }
    async getFile() {
      const { text, modified } = this._, file = new File([text], this.name, { lastModified: modified });
      if (st.holdOn === this.name) file.text = async () => { st.held++; await st.wait; st.held--; return text; };
      return file;
    }
    async createWritable() {
      let out = "";
      return {
        write: async chunk => { out += typeof chunk === "string" ? chunk : await new Response(chunk).text(); },
        close: async () => { this._.text = out; this._.modified = ++st.tick; }
      };
    }
  }
  class DirHandle {
    constructor(name) { this.kind = "directory"; this.name = name; Object.defineProperty(this, "_", { value: new Map() }); }
    async *entries() { yield* this._; }
    async getDirectoryHandle(name, opts) { return this.child(name, opts, DirHandle); }
    async getFileHandle(name, opts) { return this.child(name, opts, FileHandle); }
    child(name, opts, Kind) {
      let h = this._.get(name);
      if (h && !(h instanceof Kind)) throw new DOMException(`“${name}” isn't that kind of entry`, "TypeMismatchError");
      if (!h && !(opts && opts.create)) throw new DOMException(`No “${name}” in “${this.name}”`, "NotFoundError");
      if (!h) this._.set(name, h = new Kind(name));
      return h;
    }
    async removeEntry(name) { this._.delete(name); }
    async queryPermission() { return "granted"; }
    async requestPermission() { return "granted"; }
  }
  const root = new DirHandle("Kyoshi Sync"), sub = app => root.child(app, { create: true }, DirHandle);
  window.showDirectoryPicker = async () => root;
  window.__folder = {
    plant(app, name, text) { const h = sub(app).child(name, { create: true }, FileHandle); h._.text = text; h._.modified = ++st.tick; },
    read: (app, name) => sub(app).child(name, {}, FileHandle)._.text,
    names: app => [...sub(app)._.keys()],
    hold(name) { st.holdOn = name; st.wait = new Promise(r => { st.release = r; }); },
    release() { st.holdOn = ""; st.release(); },
    get held() { return st.held; }
  };
}

const shown = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.items.filter(i => !i.deleted).map(i => i.text).sort());
const note = tab => tab.page.evaluate(() => Kyoshi.folder.note(Kyoshi.apps.hawky));
const folderState = tab => tab.page.evaluate(() => Kyoshi.folder.state());
const held = tab => tab.page.evaluate(() => window.__folder.held);
const plant = (tab, name, save) => tab.page.evaluate(([n, s]) => window.__folder.plant("hawky", n, s), [name, JSON.stringify(save)]);
const ready = tab => tab.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
async function until(check, what) {
  for (let i = 0; i < 250; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 20)); }
  throw new Error(`${what}: not within 5s`);
}
// A key as the browser's storage holds it (IndexedDB "kyoshi-data", core/storage.js), read fresh: what a reload finds.
const onDisk = (tab, key) => tab.page.evaluate(k => new Promise((resolve, reject) => {
  const req = indexedDB.open("kyoshi-data");
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result, get = db.transaction("kv").objectStore("kv").get(k);
    get.onsuccess = () => { db.close(); resolve(get.result === undefined ? null : JSON.parse(get.result)); };
    get.onerror = () => { db.close(); reject(get.error); };
  };
}), key);
// Hawky's errands and version counters as stored: { errands, clock }.
async function stored(tab) {
  const items = (await onDisk(tab, "kyoshi.hawky.items")) || [], sync = (await onDisk(tab, "kyoshi.hawky.sync")) || {};
  return { errands: items.filter(i => !i.deleted).map(i => i.text).sort(), clock: sync.clock || {} };
}

// Sync Folder… in Developer Mode, until this device's Hawky save is in the folder; its file's name.
async function connect(tab) {
  const p = tab.page;
  await devPanel(tab, true);
  eq(await text(tab, BTN), "Sync Folder…", "the button offers a folder");
  await p.click(BTN);
  await until(async () => (await note(tab)).startsWith("Saved"), "this device's save goes in");
  eq(await folderState(tab), "on", "on");
  eq(await text(tab, BTN), "Stop Syncing", "the button now stops it");
  has(await text(tab, "#kDevSyncNote"), `Autosave & sync on with folder “${FOLDER}” | Saved at`, "the status line says so");
  const names = await p.evaluate(() => window.__folder.names("hawky"));
  eq(names.length, 1, "one file for this device in Hawky's subfolder");
  return names[0];
}
// Another device's save of Hawky, made from this device's: our errands and one more, our counters and one change of its own.
function otherSave(mine, device, text) {
  const first = mine.items[0];
  const item = { ...first, id: `${device}0001`, text, due: "", done: "", postponed: 0, at: first.at + 1000, u: first.u + 1000 };
  return { ...mine, items: [...mine.items, item], savedAt: "2026-09-30T06:50:00.000Z", sync: { device, clock: { ...mine.sync.clock, [device]: 1 } } };
}

module.exports = [
  {
    name: "sync folder: connected through Developer Mode, this device's save goes in; another device's is loaded and stored with its counters, through a reload",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP, init: fakeFolder }), p = tab.page;
      await importBackup(tab, gen.hawkyItems(ERRANDS));
      const own = await connect(tab);
      const mine = JSON.parse(await p.evaluate(n => window.__folder.read("hawky", n), own));
      eq(mine.items.map(i => i.text).sort(), TEXTS, "this device's save holds its errands");
      ok(mine.sync && mine.sync.clock[mine.sync.device] >= 1 && typeof mine.savedAt === "string" && mine.meetings, "with its device, counters, savedAt and meetings");

      // A phone's save lands in the folder: ours plus one errand, made on top of our version.
      await plant(tab, PHONE_FILE, otherSave(mine, "phone1", "Call the plumber"));
      await p.clock.runFor(5000); // the next check
      await until(async () => (await note(tab)).startsWith("Loaded"), "the phone's save is loaded");
      has(await note(tab), `Loaded “${PHONE_FILE}” at`, "the note names the file");
      const all = [...TEXTS, "Call the plumber"].sort();
      eq(await shown(tab), all, "Hawky shows the phone's errand");
      const s = await stored(tab);
      eq(s.errands, all, "it's in the browser's storage");
      eq(s.clock.phone1, 1, "and so is the phone's counter");
      await p.reload();
      await ready(tab);
      eq(await shown(tab), all, "a reload shows it still");
    }
  },
  {
    name: "sync folder: stopped while a pass reads its next file, the save already brought in is stored with its counters, never the counters alone",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP, init: fakeFolder }), p = tab.page;
      await importBackup(tab, gen.hawkyItems(ERRANDS));
      const own = await connect(tab);
      const mine = JSON.parse(await p.evaluate(n => window.__folder.read("hawky", n), own));
      // Two other devices' saves: the tablet's older, the phone's newer, so the phone's is read first; the tablet's read waits.
      await plant(tab, TABLET_FILE, otherSave(mine, "tablet", "Water the plants"));
      await plant(tab, PHONE_FILE, otherSave(mine, "phone1", "Call the plumber"));
      await p.evaluate(n => window.__folder.hold(n), TABLET_FILE);
      await p.clock.runFor(5000);
      await until(async () => (await held(tab)) === 1, "the pass brings the phone's save in, then reads the tablet's");
      const withPhone = [...TEXTS, "Call the plumber"].sort();
      eq(await shown(tab), withPhone, "the phone's errand is on screen already");

      // Stop Syncing meanwhile; then the tablet's file arrives, too late.
      await p.click(BTN);
      has(lastDialog(tab), `Stop autosave & sync with “${FOLDER}”?`, "it asks first");
      eq(await folderState(tab), "off", "off");
      await p.evaluate(() => window.__folder.release());
      await until(async () => (await held(tab)) === 0, "the read ends");
      const s = await stored(tab);
      eq({ stored: s.errands.includes("Call the plumber"), counted: s.clock.phone1 === 1 }, { stored: true, counted: true },
        "the phone's save is in the browser's storage, with its counter, though the folder was stopped before the next file was read");
      ok(!s.clock.tablet && !s.errands.includes("Water the plants"), "the tablet's, never read, is neither");
      await p.reload();
      await ready(tab);
      eq(await shown(tab), withPhone, "a reload shows the phone's errand");
      eq(await p.evaluate(() => Kyoshi.sync.saveOf(Kyoshi.apps.hawky).items.map(i => i.text).sort()), withPhone, "and this device's next save carries it");
    }
  },
  {
    name: "sync folder: a save made by a newer Kyoshi isn't brought in; sync stops, saying to reload, and saves nothing meanwhile",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP, init: fakeFolder }), p = tab.page;
      await importBackup(tab, gen.hawkyItems(ERRANDS));
      const own = await connect(tab);
      const mine = JSON.parse(await p.evaluate(n => window.__folder.read("hawky", n), own));
      // The phone runs a later Hawky: its save says so.
      const later = (parseFloat(await p.evaluate(() => Kyoshi.apps.hawky.VERSION)) + 0.001).toFixed(3);
      await plant(tab, PHONE_FILE, { ...otherSave(mine, "phone1", "Call the plumber"), appVersion: later });
      await p.clock.runFor(5000);
      await until(async () => (await folderState(tab)) === "error", "sync stops");
      eq(await text(tab, "#kSyncBannerText"), `“${PHONE_FILE}” in the sync folder was saved by a newer Kyoshi (Hawky): reload this page to get it. Until then nothing is saved to the folder from here.`, "the banner says why");
      eq(await shown(tab), TEXTS, "nothing of it came in");
      ok(!(await stored(tab)).clock.phone1, "nor its counter");
      // A change here meanwhile stays out of the folder.
      await p.fill("#kMount #addText", "Get a key cut");
      await p.press("#kMount #addText", "Enter");
      await p.clock.runFor(5000);
      eq(JSON.parse(await p.evaluate(n => window.__folder.read("hawky", n), own)).items.map(i => i.text).sort(), TEXTS, "this device's file is left as it was");
    }
  }
];
