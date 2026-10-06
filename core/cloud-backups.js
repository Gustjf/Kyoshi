/* Kyoshi · core/cloud-backups.js — the cloud's daily backups, added to K.cloud (core/cloud.js): a dated folder a day
 * beside the constant sync, for going back to a day after a big mistake (the owner's D5 in
 * roadmap/2026-10-06_feedback_batch_plan.md). The constant sync isn't touched: data/<app>.json is still saved within
 * seconds of every change and read on every check, and nothing in backups/ is ever read by it.
 * backups/<YYYY-MM-DD>/ holds that day's data/<app>.json (the very same encrypted files: the day's tree points at the
 * blobs already there; kyoshi.json is the hidden Kyoshi app's, the bug log) and all.json (an envelope, app "all", whose
 * plain text is an Export all file of this device's saves, { kyoshiVersion, exportedAt, cloud: true, apps }: right after
 * a check got through, they're the cloud's). Today's folder and the 7 days before it are kept (BACKUP_DAYS); older ones
 * leave in the same commit: one commit a day, "Kyoshi: daily backup <day>".
 * When: after a check got through (chained on K.cloud.afterCheck, once the history's trim is done: core/cloud-upkeep.js),
 * once a day by the device's own date, never in test mode, one tab at a time (browser locks); a folder already there for
 * today (another device made it) counts as today's. The commit goes on the branch's head and the branch only moves on
 * from it: another device saving meanwhile makes GitHub refuse it, and it's tried again at the next check that gets
 * through, BACKUP_TRIES a day at most (anything else that stops it counts too). The same run makes sure KYOSHI.md is this
 * Kyoshi's (core/cloud-key.js writeGuide), once per version.
 * Back up now (backupNow, Developer Mode) makes today's straight away; Restore a day… (core/cloud-ui.js) lists the days
 * (backupDays) and reads a file (backupFile), which the ordinary import takes (core/backup.js decrypts it with the key
 * held here); the sync then carries the restored data to the other devices, as it does any change.
 * Kept in the key's record (core/cloud.js keep): backupDay (the last day known backed up), backupAt (when this device made
 * it; "" when another did), backupTries and backupTriedOn (failed tries, and their day), guideVersion (the Kyoshi whose
 * KYOSHI.md this device last made sure of). Never a token, a repository name or data in a console line. */
(function (K) {
  "use strict";
  const { isDate, addDays, localDate, fmtShort } = K.util;
  const C = K.cloudCrypto, cloud = K.cloud;
  const BACKUP_DAYS = 8;  // today's folder and the 7 days before it
  const BACKUP_TRIES = 3; // a day at most (GitHub refused one: another device saved meanwhile)
  const DIR = "backups";
  const refuse = text => Object.assign(new Error(text), { code: "refused", refusal: true });
  const today = () => localDate(new Date()); // the device's own date (never run in test mode: no time travel)
  const triesOn = (r, day) => (r && r.backupTriedOn === day ? +r.backupTries || 0 : 0); // failed tries that day
  const stale = c => { const h = cloud.held(); return !h || h.client !== c || K.testMode; }; // another key, none, or test mode
  let running = null; // the day's backup under way (a promise of what it did, in words)

  // After every check that got through (core/cloud.js), past the history's upkeep (core/cloud-upkeep.js): today's
  // backup, unless it's in, under way, or tried BACKUP_TRIES times today.
  const upkeep = cloud.afterCheck;
  function afterCheck(c) {
    upkeep(c);
    const r = cloud.record(), day = today();
    if (!r || running || K.testMode || r.backupDay === day || triesOn(r, day) >= BACKUP_TRIES) return;
    run(c, day).catch(err => { // counted as a try: again at the next check (GitHub's doing, or offline: no console line)
      if (!(err instanceof K.github.GithubError)) console.error("Cloud sync's daily backup failed.", err);
    });
  }

  // Today's backup in this tab (another tab holding the lock is making it; a browser that denies locks: without one),
  // once the trim under way is done (the backup goes on top of what it leaves), KYOSHI.md made sure of first. Resolves
  // to what it did, in words.
  function run(c, day) {
    let started = false;
    const work = async () => {
      started = true;
      await cloud.tidied();
      if (stale(c)) return "stale";
      await guide(c);
      return stale(c) ? "stale" : backUp(c, day);
    };
    running = (navigator.locks && navigator.locks.request
      ? navigator.locks.request("kyoshi-cloud-backup", { ifAvailable: true }, held => (held ? work() : "another tab"))
        .catch(err => { if (started) throw err; return work(); })
      : work()).finally(() => { running = null; cloud.ui(); });
    return running;
  }

  // KYOSHI.md as this Kyoshi's GUIDE says (written only when it differs), once per version on each device; a failure:
  // tried again with the next day's backup.
  async function guide(c) {
    const r = cloud.record();
    if (!r || r.guideVersion === K.VERSION) return;
    try { await cloud.writeGuide(c); } catch (err) { return; }
    if (!stale(c)) cloud.keep({ guideVersion: K.VERSION });
  }

  // Today's folder: data/'s files as the check just done left them, and all.json; the folders past BACKUP_DAYS taken out
  // (each file: a tree has no folder of its own); one commit on the branch's head. What it did, in words; anything that
  // stops it (GitHub refusing it, offline) counts as a try, and is thrown.
  async function backUp(c, day) {
    const folder = `${DIR}/${day}`, entry = (path, sha) => ({ path, mode: "100644", type: "blob", sha });
    try {
      if ((await c.listDir(folder)).files.length) { // in: another device made it (or this one, already known)
        const r = cloud.record();
        if (!stale(c) && r && r.backupDay !== day) cloud.keep({ backupDay: day, backupAt: "", backupTries: 0 });
        return "Today's backup is already there.";
      }
      if (stale(c)) return "stale";
      const secret = await cloud.held().lock, files = cloud.files(), apps = {};
      const entries = [...files].map(([path, sha]) => entry(`${folder}/${cloud.appOf(path)}.json`, sha));
      K.sync.apps().filter(A => A.data.hasData()).forEach(A => { apps[A.id] = K.sync.saveOf(A); });
      const env = await C.seal({ kyoshiVersion: K.VERSION, exportedAt: new Date().toISOString(), cloud: true, apps }, secret, "all");
      if (stale(c)) return "stale";
      entries.push(entry(`${folder}/all.json`, await c.newBlob(C.toBase64(C.utf8(`${JSON.stringify(env, null, 2)}\n`)))));
      const oldest = addDays(day, 1 - BACKUP_DAYS);
      for (const d of (await c.listDir(DIR)).dirs.filter(x => isDate(x) && x < oldest)) {
        (await c.listDir(`${DIR}/${d}`)).files.forEach(f => entries.push(entry(f.path, null)));
      }
      if (stale(c)) return "stale";
      const head = await c.branch();
      const commit = await c.newCommit(await c.newTree(head.tree, entries), `Kyoshi: daily backup ${day}`, [head.sha]);
      if (stale(c)) return "stale";
      await c.moveBranch(commit, { force: false }); // only on from the head: a save made meanwhile, and GitHub refuses it
      cloud.keep({ backupDay: day, backupAt: new Date().toISOString(), backupTries: 0 });
      return `Backed up ${files.size} app${files.size === 1 ? "" : "s"} into ${folder}.`;
    } catch (err) {
      if (!stale(c)) cloud.keep({ backupTries: triesOn(cloud.record(), day) + 1, backupTriedOn: day });
      throw err;
    }
  }

  // GitHub's answer to a backup or a restore, in plain words.
  function plain(err) {
    if (err.code === "invalid" || err.code === "conflict") return "GitHub refused it: another device saved at that very moment. Try again.";
    if (err.code === "forbidden") return "GitHub won't let Kyoshi write there: the token needs Contents: Read and write, and no rule may protect the branch.";
    if (err.code === "auth" || err.code === "notfound") return "GitHub refused the key: see Cloud sync's line above.";
    if (err.code === "ratelimit") return `GitHub asks us to wait until ${cloud.timeOf(err.until)}.`;
    if (err.code === "network") return "Couldn't reach GitHub: check the connection, then try again.";
    return "GitHub didn't answer properly: try again in a few minutes.";
  }
  const plainly = err => (err instanceof K.github.GithubError ? refuse(plain(err)) : err);
  // The key held here, outside test mode (else a refusal).
  function holding() {
    const held = cloud.held();
    if (!held) throw refuse("Enter the key first.");
    if (K.testMode) throw refuse("Cloud sync is paused in test mode: reload the page first.");
    return held;
  }

  // Back up now (Developer Mode): a check first (data/'s files as they are now), then today's backup, tries left or not.
  // Resolves to what it did, in words (the check's own backup, when it made one); else throws a refusal.
  async function backupNow(tell = () => {}) {
    const held = holding();
    tell("Checking the cloud…");
    if (running) await running.catch(() => "");
    cloud.syncNow();
    await cloud.settled();
    const made = running ? await running.catch(() => "") : "";
    if (/^Backed up/.test(made)) return made;
    const now = cloud.held(), s = cloud.status();
    if (!now || now.client !== held.client) throw refuse("The cloud's key changed meanwhile: try again.");
    if (s.state !== "on" || s.failedAt) throw refuse("Couldn't reach GitHub just now: try again in a few minutes.");
    tell("Backing up…");
    let said = "";
    try { said = await run(held.client, today()); } catch (err) { throw plainly(err); }
    if (said === "another tab") throw refuse("Another tab is making today's backup: try again in a moment.");
    if (said === "stale") throw refuse("The cloud's key changed meanwhile: try again.");
    return said;
  }

  // For Restore a day…: the days in backups/, newest first; and a file of one of them ("<app>.json", or "all.json":
  // every app), its text as it is (still locked), or a refusal naming the day when it holds none.
  async function backupDays() {
    const held = holding();
    try { return (await held.client.listDir(DIR)).dirs.filter(isDate).sort().reverse(); } catch (err) { throw plainly(err); }
  }
  async function backupFile(day, name) {
    const held = holding();
    try { return C.fromUtf8((await held.client.getFile(`${DIR}/${day}/${name}`)).bytes); } catch (err) {
      if (err.code !== "notfound") throw plainly(err);
      const id = name.replace(/\.json$/, ""), A = K.apps[id];
      throw refuse(`${fmtShort(day)}'s backup has nothing for ${A ? A.meta.name : id === "all" ? "every app" : id}.`);
    }
  }

  // For the Cloud block's Daily backups line: { days (how many are kept), today (today's is in), at (when this device
  // made it: ms; 0 when another did), stuck (tried BACKUP_TRIES times today) }.
  function backups() {
    const r = cloud.record() || {}, day = today(), done = r.backupDay === day;
    return { days: BACKUP_DAYS, today: done, at: done ? Date.parse(r.backupAt) || 0 : 0, stuck: !done && triesOn(r, day) >= BACKUP_TRIES };
  }

  // backedUp: the backup under way, or done, in words (the tests wait on it).
  Object.assign(cloud, {
    afterCheck, backupNow, backups, backupDays, backupFile,
    backedUp: () => (running || Promise.resolve("")).catch(err => `stopped (${err.code || "error"})`)
  });
})(Kyoshi);
