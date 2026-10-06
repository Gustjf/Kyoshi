/* Kyoshi · core/cloud-key.js — taking a cloud key up and letting it go, added to K.cloud (core/cloud.js): Enter key…
 * (connect), Set up a new cloud… (setup: a new key, and KYOSHI.md in the repository), Update token… (updateToken) and
 * Disconnect (disconnect); and the plain copies: Download decrypted copy (exportDecrypted) and Decrypt a file…
 * (decryptFile). No UI (core/cloud-ui.js calls these): each resolves (the key to show, or what it did, in words) or
 * throws an Error whose message the pop-up shows as it is (refusal: true), GitHub's answers put in plain words.
 * The same safety rules as core/cloud.js: a public repository is refused, so is a key that can't open the data already
 * in its repository, and nothing is written there but data/<app>.json (core/cloud.js) and KYOSHI.md (here, kept equal to
 * GUIDE: written when missing, rewritten when it differs; GitHub's own README is left alone). */
(function (K) {
  "use strict";
  const { isObj, isPos, todayStr, downloadJSON } = K.util;
  const C = K.cloudCrypto, cloud = K.cloud;
  const refuse = text => Object.assign(new Error(text), { code: "refused", refusal: true });
  // KYOSHI.md: what the repository is and how its files are made (no names, no data).
  const GUIDE = [
    "# Kyoshi's cloud", "",
    "This private repository is where Kyoshi (small apps that run in a web browser) keeps each app's data current across its owner's devices.", "",
    "**Every file here is encrypted** with AES-256-GCM, under a key that is not in this repository: only the owner's devices hold it. Without that key nobody can read these files, GitHub included.", "",
    "## What's here",
    "- `data/<app>.json`: one file per app (momo, bosco, hawky, …; `kyoshi` is Kyoshi's own record: the Bugs & requests log), saved again by Kyoshi after each change; each save is a commit. The history keeps the last 8 days of saves: about once a day Kyoshi folds older ones into one commit (the files stay as they are).",
    "- `KYOSHI.md`: this file, written by Kyoshi.", "",
    "Kyoshi writes nothing else here. Photos and documents (such as the proof attached to Appa's records) are never kept here: they stay on the device they were added on.", "",
    "## A file in data/",
    "A small JSON text file:", "",
    "    { \"kyoshi\": 1, \"app\": \"momo\", \"alg\": \"AES-256-GCM\", \"zip\": \"gzip\", \"iv\": \"…\", \"data\": \"…\" }", "",
    "- `kyoshi`: the file format's version (1).",
    "- `app`: the app whose data it holds.",
    "- `alg`: AES-256-GCM, its key being the secret at the end of the owner's Kyoshi key (32 bytes).",
    "- `iv`: the 12-byte nonce (base64), new for every save.",
    "- `zip`: `gzip` (the data was gzipped before it was encrypted) or `none`.",
    "- `data`: the encrypted data (base64): the ciphertext, then GCM's 16-byte tag.", "",
    "Decrypted (and unzipped), each file is an ordinary Kyoshi backup of that app, in JSON: Kyoshi's Import JSON takes it as it is.", "",
    "## The key",
    "One string, `kyoshi1.<owner>/<repository>.<token>.<secret>`: this repository, a GitHub token that may read and write it, and the secret (32 random bytes, base64url) that locks the files.", "",
    "## Reading a file",
    "In Kyoshi: Developer Mode (Ctrl+9, or the DEV badge) → Cloud sync → *Decrypt a file…* (one file from here), or *Download decrypted copy* (every app in one file, which Import all takes back).", "",
    "Without Kyoshi running: `tools/decrypt.html` in Kyoshi's own repository (download it with the rest of Kyoshi and open that page from disk). It takes the key and files from here (a Download ZIP of this repository, unzipped), needs no network, and gives each file back as plain JSON.", ""
  ].join("\n");

  // --- Checking a key against GitHub ---
  // GitHub's refusal of a key being checked, in plain words.
  function plain(err) {
    if (err.code === "auth") return "GitHub doesn't accept that token (expired, revoked or mistyped): make a new one with the same settings.";
    if (err.code === "forbidden") return "That token isn't allowed into that repository: it needs Contents: Read and write, for that repository.";
    if (err.code === "notfound") return "That repository can't be found with this token: check its name, and that the token may use it.";
    if (err.code === "ratelimit") return `GitHub asks us to wait until ${cloud.timeOf(err.until)}.`;
    if (err.code === "network") return "Couldn't reach GitHub: check the connection, then try again.";
    return "GitHub didn't answer properly: try again in a few minutes.";
  }
  // A step against GitHub, its failure as a refusal in plain words.
  async function ask(step) {
    try { return await step(); } catch (err) { throw err instanceof K.github.GithubError ? refuse(plain(err)) : err; }
  }
  // A client for a key's repository, once GitHub says it's there, reachable and private.
  async function reach(k, tell) {
    if (!C.supported) throw refuse(C.unsupported);
    if (K.testMode) throw refuse("Cloud sync is paused in test mode: reload the page first.");
    const c = K.github.client(k);
    tell("Checking the repository…");
    if (!(await ask(() => c.repo())).private) throw refuse("That repository is public: make it private first (on GitHub, its Settings → Change visibility), then try again.");
    return c;
  }
  // Keeps KYOSHI.md as GUIDE says.
  async function writeGuide(c) {
    let sha = "";
    try {
      const file = await c.getFile("KYOSHI.md");
      if (C.fromUtf8(file.bytes) === GUIDE) return;
      sha = file.sha;
    } catch (err) { if (err.code !== "notfound") throw err; }
    try { await c.putFile("KYOSHI.md", C.toBase64(C.utf8(GUIDE)), { sha, message: "Kyoshi: KYOSHI.md" }); } catch (err) {
      if (err.code !== "conflict" && err.code !== "invalid") throw err; // another device wrote it just now
    }
  }

  // --- Taking a key up, and letting it go ---
  // Enter key…: the key must fit its repository (private, and able to open the data already there); then this device
  // combines with the cloud.
  async function connect(text, remember = true, tell = () => {}) {
    const k = C.parseKey(text);
    if (!k) throw refuse(C.keyError(text));
    const c = await reach(k, tell), secret = await C.importKey(k.secret);
    tell("Reading the cloud's files…");
    const first = (await ask(() => c.listDir("data"))).files.find(f => cloud.appOf(f.path));
    if (first) {
      const file = await ask(() => c.getFile(first.path));
      let env = null;
      try { env = JSON.parse(C.fromUtf8(file.bytes)); } catch (err) { /* not an envelope */ }
      if (isObj(env) && isPos(env.kyoshi) && env.kyoshi > 1) throw refuse("That repository was saved by a newer Kyoshi: reload this page, then try again.");
      try { await C.open(env, secret); } catch (err) {
        throw refuse(err.code === "key" ? "That key doesn't fit the data already in that repository: it was made for another one." : "That repository holds files Kyoshi can't read: is it the one this key was made for?");
      }
    }
    await ask(() => writeGuide(c));
    return cloud.take(k, remember, c, secret, true);
  }
  // Set up a new cloud…: an empty private repository and its token make a new key (returned, for the owner to keep).
  async function setup({ repo = "", token = "", remember = true } = {}, tell = () => {}) {
    repo = String(repo).trim().replace(/^(https?:\/\/)?github\.com\//i, "").replace(/(\.git)?\/*$/i, "");
    token = String(token).trim();
    if (!C.isRepo(repo)) throw refuse("Type the repository as owner/name, for example you/kyoshi-data.");
    if (!C.isToken(token)) throw refuse("Paste the token GitHub showed you: it starts with github_pat_.");
    const k = { repo, token, secret: C.newSecret() }, c = await reach(k, tell);
    tell("Looking for data already there…");
    if ((await ask(() => c.listDir("data"))).files.length) throw refuse("That repository already holds Kyoshi data: use Enter key with the key you made for it, or empty it first.");
    tell("Writing KYOSHI.md…");
    await ask(() => writeGuide(c));
    return cloud.take(k, remember, c, await C.importKey(k.secret), true);
  }
  // Update token…: the same repository and secret with a new token (GitHub's expire): the new key, for the other devices.
  async function updateToken(token = "", tell = () => {}) {
    const held = cloud.held();
    if (!held) throw refuse("Enter the key first.");
    token = String(token).trim();
    if (!C.isToken(token)) throw refuse("Paste the new token GitHub showed you: it starts with github_pat_.");
    const k = { ...held.key, token }, c = await reach(k, tell);
    return cloud.take(k, held.remember, c, await held.lock, false);
  }
  // Disconnect: this device forgets the key; its data and the repository stay as they are.
  function disconnect() {
    if (!confirm("Disconnect this device from cloud sync? Your data stays on this device and the cloud's copy stays in the repository; connecting again takes the key.")) return false;
    cloud.forget();
    return true;
  }

  // --- Plain copies ---
  // Download decrypted copy: every app's file in the cloud, unlocked, as one Export all file (Import all takes it back).
  // Nothing changes, here or there. Resolves to what it did, in words.
  async function exportDecrypted(tell = () => {}) {
    const held = cloud.held();
    if (!held) throw refuse("Enter the key first.");
    if (K.testMode) throw refuse("Cloud sync is paused in test mode: reload the page first.");
    tell("Reading the cloud's files…");
    const secret = await held.lock, out = {}, unread = [];
    for (const f of (await ask(() => held.client.listDir("data"))).files) {
      const id = cloud.appOf(f.path), name = K.apps[id] ? K.apps[id].meta.name : id;
      if (!id) continue;
      tell(`Decrypting ${name}…`);
      const file = await ask(() => held.client.getFile(f.path));
      try { out[id] = await C.open(JSON.parse(C.fromUtf8(file.bytes)), secret); } catch (err) { unread.push(name); }
    }
    const n = Object.keys(out).length;
    if (!n) throw refuse(unread.length ? "None of the cloud's files can be read with this key." : "The cloud holds no data yet.");
    downloadJSON({ kyoshiVersion: K.VERSION, exportedAt: new Date().toISOString(), cloud: true, apps: out }, `kyoshi-cloud-${todayStr()}.json`);
    return `Downloaded ${n} app${n === 1 ? "" : "s"}, decrypted${unread.length ? `; ${K.backup.nameList(unread)} can't be read with this key` : ""}.`;
  }
  // Decrypt a file…: one data/<app>.json taken from the repository → its plain save (Import JSON takes it).
  async function decryptFile(text) {
    const held = cloud.held();
    if (!held) throw refuse("Enter the key first.");
    let env = null;
    try { env = JSON.parse(text); } catch (err) { /* not JSON */ }
    if (!C.isEnvelope(env)) throw refuse("That isn't a Kyoshi cloud file.");
    let save;
    try { save = await C.open(env, await held.lock); } catch (err) {
      throw refuse(err.code === "key" ? "That file can't be read with this device's key: it was locked with another one." : "That file is damaged: it can't be read.");
    }
    const id = /^[a-z][a-z0-9]*$/.test(env.app) ? env.app : "file"; // not "kyoshi": that's the hidden Kyoshi app's (core/record.js)
    downloadJSON(save, `${id}-cloud-${todayStr()}.json`);
    return `Decrypted ${K.apps[id] ? `${K.apps[id].meta.name}'s file` : "the file"}: its plain copy is downloading.`;
  }

  Object.assign(K.cloud, { connect, setup, updateToken, disconnect, exportDecrypted, decryptFile });
})(Kyoshi);
