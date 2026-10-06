/* Kyoshi · core/cloud-upkeep.js — the cloud repository's upkeep, added to K.cloud (core/cloud.js): a trimmed history and
 * the token's expiry. Both quiet while all is well: core/cloud-ui.js shows the expiry in the Cloud block once it's near
 * (and the banner and the glyph once it's close), and a History line only while GitHub refuses the trim.
 * The history (the owner's choice, D4 in plan_2026-10-06.md: the last 8 days of saves, no more, with no button). Every
 * save is a commit, and an encrypted file doesn't shrink in Git's history, so the repository would grow for good. Once a
 * day (TIDY_CHECK_MS), after a check gets through, GitHub is asked whether the history holds saves older than
 * HISTORY_DAYS; if it does, it's cut back to the last KEEP_DAYS: one new first commit holds the files as they were then
 * (dated then), the later saves are made again on top of it, each with its own files, message and dates, and the branch
 * moves to the new line. The files at its end are the same (the same blob shas: no device reads anything again); the
 * older commits are no longer reachable, and GitHub frees their space in time.
 * Over TIDY_MAX saves to make again, only each hour's last is kept. They're made one at a time, TIDY_GAP_MS apart
 * (GitHub allows 80 new things a minute). A save another device makes meanwhile is added on top before the branch moves;
 * one landing in the instant between is lost from the history only: its device reads the older file at its next check,
 * sees the cloud lacks its change, and saves it again (core/cloud.js unsent). One tab trims at a time (browser locks).
 * GitHub refusing it (the token, or a rule protecting the branch): the history stays whole, the block says so, and the
 * trim is tried again after REFUSED_WAIT_MS. Anything else that stops it (offline, a rate limit): tried the next day.
 * The token's expiry: GitHub names it on its answers, when the browser may read it (core/github.js), and it's kept in the
 * key's record. From EXPIRY_NOTE_DAYS before, the block says when; from EXPIRY_ALARM_DAYS before, the banner and the
 * glyph too, until Update token… (a new key, so a new record). Once past, GitHub refuses the token (needs-key, as before).
 * Kept in the key's record (core/cloud.js keep): expiresAt, tidyCheckAt (the last daily look), tidiedAt, tidyRefusedAt.
 * Never a token, a repository name or data in a console line. */
(function (K) {
  "use strict";
  const DAY_MS = 86400000, HOUR_MS = 3600000;
  const HISTORY_DAYS = 8, KEEP_DAYS = 7; // never more than 8 days of saves: past that, cut back to 7 (so about once a day)
  const TIDY_CHECK_MS = DAY_MS;          // how often a device asks whether the history needs it
  const REFUSED_WAIT_MS = 7 * DAY_MS;    // after GitHub refused it, the next try
  const TIDY_MAX = 240, TIDY_GAP_MS = 800, CATCH_UP_TRIES = 3, MAX_PAGES = 20;
  const EXPIRY_NOTE_DAYS = 14, EXPIRY_ALARM_DAYS = 3;
  const cloud = K.cloud;
  const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"); // GitHub's own form
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const dayOf = ms => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
  const dateOf = k => Date.parse(k.committer && k.committer.date) || 0;
  const stamp = (who, ms) => ({ name: (who && who.name) || "Kyoshi", email: (who && who.email) || "kyoshi@users.noreply.github.com", date: iso(ms) });
  let running = null; // the trim under way (a promise of what it did, in words, for the tests)

  // --- The token's expiry ---
  // Once it's within EXPIRY_NOTE_DAYS: { text, urgent (within EXPIRY_ALARM_DAYS: the banner and the glyph) }; else null.
  function expiry() {
    const r = cloud.record(), at = (r && Date.parse(r.expiresAt)) || 0, left = at - Date.now();
    if (!at || left <= 0 || left > EXPIRY_NOTE_DAYS * DAY_MS) return null;
    const days = Math.ceil(left / DAY_MS);
    return {
      urgent: left <= EXPIRY_ALARM_DAYS * DAY_MS,
      text: `The token in your cloud key expires on ${dayOf(at)} (${days <= 1 ? "within a day" : `in ${days} days`}): Update token… (Developer Mode → Cloud sync) makes a new key, to paste on your other devices too.`
    };
  }

  // After every check that got through (core/cloud.js): the token's end as GitHub said it, and the daily look at the
  // history (not before REFUSED_WAIT_MS after GitHub refused it).
  function afterCheck(client) {
    const r = cloud.record(), at = client.expiresAt ? client.expiresAt() : 0, now = Date.now();
    if (!r) return;
    if (at && iso(at) !== r.expiresAt) cloud.keep({ expiresAt: iso(at) });
    if (running || now - (Date.parse(r.tidyCheckAt) || 0) < TIDY_CHECK_MS || now - (Date.parse(r.tidyRefusedAt) || 0) < REFUSED_WAIT_MS) return;
    cloud.keep({ tidyCheckAt: iso(now) });
    running = (navigator.locks && navigator.locks.request
      ? navigator.locks.request("kyoshi-cloud-tidy", { ifAvailable: true }, held => (held ? tidy(client) : "another tab"))
      : tidy(client)).catch(err => `stopped (${err.code || "error"})`).finally(() => { running = null; cloud.ui(); });
  }

  // --- The history, trimmed ---
  // Cuts the history back to KEEP_DAYS when it holds saves older than HISTORY_DAYS: what it did, in words (for the
  // tests). Stops quietly when the key changes meanwhile (Disconnect, a new key) or test mode starts.
  async function tidy(c) {
    const now = Date.now(), cutoff = now - KEEP_DAYS * DAY_MS;
    const stale = () => { const h = cloud.held(); return !h || h.client !== c || K.testMode; };
    let made = 0, first = null; // commits written; the new first one's author and committer (dated the cutoff)
    const commit = async (tree, message, parents, k = null) => {
      if (made++) await pause(TIDY_GAP_MS);
      const who = k && k.author ? { author: stamp(k.author, Date.parse(k.author.date) || dateOf(k)), committer: stamp(k.committer, dateOf(k)) } : first;
      return c.newCommit(tree, message, parents, who);
    };
    try {
      const old = await c.commits({ until: iso(now - HISTORY_DAYS * DAY_MS), perPage: 2 });
      if (!old.length || (old.length === 1 && !old[0].parents.length)) return "nothing older"; // or only a trim's first commit
      const [base] = await c.commits({ until: iso(cutoff), perPage: 1 }); // the files as they were at the cutoff
      const kept = await since(c, cutoff, base.sha);
      let top = kept.length ? kept[0].sha : base.sha; // the head this new line matches
      let line = kept.reverse();                       // oldest first
      if (line.length > TIDY_MAX) line = line.filter((k, i) => i === line.length - 1 || Math.floor(dateOf(line[i + 1]) / HOUR_MS) !== Math.floor(dateOf(k) / HOUR_MS));
      if (line.length > TIDY_MAX) line = line.slice(-TIDY_MAX);
      first = { author: stamp(base.author, cutoff), committer: stamp(base.committer, cutoff) };
      if (stale()) return "stale";
      let parent = await commit(base.tree, `Kyoshi: trimmed the history (the saves before ${dayOf(cutoff)} in one)`, []);
      for (const k of line) {
        if (stale()) return "stale";
        parent = await commit(k.tree, k.message, [parent], k);
      }
      // Saves made meanwhile (other devices, this one) go on top, then the branch moves.
      for (let n = 1; ; n++) {
        if (stale()) return "stale";
        if ((await c.branch()).sha === top) break;
        const recent = await c.commits({ perPage: 100 }), at = recent.findIndex(k => k.sha === top);
        if (n > CATCH_UP_TRIES || at < 0) return "changed meanwhile"; // another device trimming it too: tomorrow, then
        for (const k of recent.slice(0, at).reverse()) parent = await commit(k.tree, k.message, [parent], k);
        top = recent[0].sha;
      }
      if (stale()) return "stale";
      await c.moveBranch(parent);
      cloud.keep({ tidiedAt: iso(Date.now()), tidyRefusedAt: "" });
      return `kept ${line.length}`;
    } catch (err) {
      if (made && ["forbidden", "invalid", "notfound", "conflict"].includes(err.code)) {
        cloud.keep({ tidyRefusedAt: iso(Date.now()) });
        return "refused";
      }
      throw err; // offline, a rate limit: the next day
    }
  }
  // The branch's commits after the cutoff, newest first (the base left out: GitHub's since and until both take a commit
  // made right at the cutoff).
  async function since(c, cutoff, baseSha) {
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const got = await c.commits({ since: iso(cutoff), page, perPage: 100 });
      out.push(...got.filter(k => k.sha !== baseSha));
      if (got.length < 100) break;
    }
    return out;
  }

  // For the Cloud block: { days (the most the history keeps), refused (GitHub refused the last trim) }.
  function history() {
    const r = cloud.record() || {};
    return { days: HISTORY_DAYS, refused: !!r.tidyRefusedAt };
  }

  // tidied: the trim under way, or done (the tests wait on it).
  Object.assign(cloud, { tidied: () => running || Promise.resolve(""), history, expiry, afterCheck });
})(Kyoshi);
