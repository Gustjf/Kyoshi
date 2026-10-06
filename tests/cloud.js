/* Kyoshi · tests/cloud.js — cloud sync as the tests drive it: a fake GitHub that Playwright answers in place of
 * api.github.com (the real one is never reached), Developer Mode's Cloud block (Set up a new cloud…, Enter key…, Sync
 * now, its state), and decrypting a file in Node, as the repository's KYOSHI.md describes it (AES-256-GCM: the
 * ciphertext, then its 16-byte tag; gzip inside), to check what the cloud holds (or locking one, as another device would). Made-up keys only: a made-up token and
 * fixed secrets, never real ones. Selectors live here, so a markup change is fixed in one place. */
"use strict";
const crypto = require("crypto");
const zlib = require("zlib");
const { devPanel } = require("./lib");

const REPO = "tester/kyoshi-data-test";
const TOKEN = "github_pat_TEST0000000000000000000000_madeUpForKyoshiTestsOnly0000000000000000000000000000";
const SECRET = Buffer.from(Array.from({ length: 32 }, (_, i) => i * 7 + 3)); // a fixed made-up secret
const b64url = bytes => Buffer.from(bytes).toString("base64url");
const keyOf = ({ repo = REPO, token = TOKEN, secret = SECRET } = {}) => `kyoshi1.${repo}.${token}.${b64url(secret)}`;
const KEY = keyOf();
const secretOf = key => Buffer.from(key.split(".").pop(), "base64url");

// A fake GitHub for one private repository: { files: Map<path, { sha, bytes }>, puts, clashes, gets, requests, odd, mode,
// token, isPrivate, big, held, route(ctx, who), hold(who, what) }. route answers https://api.github.com/** in that browser
// context (who: a name for it): the CORS preflight, GET /repos/o/r, a folder's listing (its files, and its folders as
// "dir" entries, by name: data/, backups/, a day's backups/<date>/; 404 while it holds nothing, 304 for its ETag), a file
// (base64 with GitHub's line breaks; left out over `big` bytes, then fetched as a blob), PUT of a file (a stale sha:
// 409, none for one that's there: 422; both count in clashes), and a blob; and the history: each save (and plant) is a
// commit on main dated fake.now (history() lists them, newest first), the branch, its commits (since, until, pages), a
// new blob, a new tree (from base_tree, its entries applied: sha null takes a path out), a new commit (made counts them)
// and moving the branch (moves, forced: those by force; its files become that commit's; not by force, only on from the
// head, else 422). Anything else answers 404 and counts in odd, so a test can check nothing unexpected was sent. mode:
// "ok", "auth" (401 to everything), "offline" (no answer), "nosave" (saves answer 502; reading works) or "notidy" (moving
// the branch by force answers 403, as a rule protecting it would). token: the one it accepts. expires: the token's end as
// GitHub writes it, sent on every answer when set. hold(who, what): that device's saves ("save"), file reads ("read") or
// new trees ("tree") wait (counted in held) until the function it returns is called, so something can happen meanwhile.
function fakeGithub({ repo = REPO } = {}) {
  const base = `/repos/${repo}`;
  const fake = { files: new Map(), puts: 0, clashes: 0, gets: 0, requests: 0, odd: 0, mode: "ok", token: TOKEN, isPrivate: true, big: Infinity, held: 0,
    now: Date.parse("2026-09-30T07:00:00Z"), commits: new Map(), head: "", made: 0, moves: 0, forced: 0, expires: "" };
  const holds = new Map(); // "who what" → the promise those requests wait on
  const trees = new Map(), blobs = new Map(); // tree sha → { path: blob sha }; blob sha → bytes
  const sha1 = bytes => crypto.createHash("sha1").update(bytes).digest("hex");
  const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "etag, link, x-ratelimit-remaining, x-ratelimit-reset, github-authentication-token-expiration" };
  const reply = (route, status, body, headers = {}) => route.fulfill({ status, body: body === null ? "" : JSON.stringify(body),
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...(fake.expires ? { "github-authentication-token-expiration": fake.expires } : {}), ...headers } });
  const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const person = date => ({ name: "Tester", email: "tester@example.com", date });
  // A commit of the files as they are now, on the branch, dated fake.now (a second after the last, at the least).
  function commitFiles(message) {
    const snap = Object.fromEntries([...fake.files].sort().map(([p, f]) => [p, f.sha])), tree = sha1(JSON.stringify(snap));
    trees.set(tree, snap);
    const last = fake.commits.get(fake.head), date = iso(Math.max(fake.now, last ? Date.parse(last.committer.date) + 1000 : 0));
    return (fake.head = addCommit({ tree, parents: fake.head ? [fake.head] : [], message, author: person(date), committer: person(date) }));
  }
  // A commit, not on the branch (yet).
  function addCommit(c) {
    const sha = sha1(JSON.stringify(c) + fake.commits.size);
    fake.commits.set(sha, { sha, ...c });
    return sha;
  }
  // The branch's history, newest first: [{ sha, tree, parents, message, date }].
  fake.history = () => {
    const out = [];
    for (let c = fake.commits.get(fake.head); c; c = fake.commits.get(c.parents[0])) out.push({ sha: c.sha, tree: c.tree, parents: c.parents, message: c.message, date: c.committer.date });
    return out;
  };
  const asListed = c => ({ sha: c.sha, commit: { message: c.message, tree: { sha: c.tree }, author: c.author, committer: c.committer }, parents: c.parents.map(sha => ({ sha })) });
  // Whether commit `to` is `from` or one of its ancestors.
  function reaches(from, to) {
    const seen = new Set(), todo = [from];
    while (todo.length) {
      const sha = todo.pop();
      if (sha === to) return true;
      if (seen.has(sha) || !fake.commits.has(sha)) continue;
      seen.add(sha);
      todo.push(...fake.commits.get(sha).parents);
    }
    return false;
  }
  // A folder's listing as GitHub's contents API gives it: its files, then its folders as "dir" entries, by name.
  function listing(p) {
    const under = [...fake.files.keys()].filter(k => k.startsWith(`${p}/`)).sort(), out = new Map();
    for (const k of under) {
      const rest = k.slice(p.length + 1), name = rest.split("/")[0];
      if (out.has(name)) continue;
      out.set(name, rest.includes("/")
        ? { type: "dir", name, path: `${p}/${name}`, sha: sha1(JSON.stringify(under.filter(x => x.startsWith(`${p}/${name}/`)).map(x => [x, fake.files.get(x).sha]))), size: 0 }
        : { type: "file", name, path: k, sha: fake.files.get(k).sha, size: fake.files.get(k).bytes.length });
    }
    return [...out.values()];
  }

  async function handle(route, who) {
    const req = route.request(), method = req.method(), path = decodeURIComponent(new URL(req.url()).pathname);
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-methods": "GET, PUT, POST, PATCH, OPTIONS", "access-control-allow-headers": "accept, authorization, content-type, if-none-match, x-github-api-version" } });
    }
    fake.requests++;
    if (fake.mode === "offline") return route.abort("internetdisconnected");
    if (fake.mode === "auth" || req.headers().authorization !== `Bearer ${fake.token}`) return reply(route, 401, { message: "Bad credentials" });
    if (method === "GET" && path === base) return reply(route, 200, { full_name: repo, private: fake.isPrivate, default_branch: "main" });
    const contents = `${base}/contents/`;
    if (path.startsWith(contents)) {
      const p = path.slice(contents.length), f = fake.files.get(p);
      if (method === "GET" && !f) { // no file there: a folder (or nothing)
        const list = listing(p);
        if (!list.length) return reply(route, 404, { message: "Not Found" });
        const etag = `W/"${sha1(JSON.stringify(list))}"`;
        if (req.headers()["if-none-match"] === etag) return route.fulfill({ status: 304, headers: { ...CORS, ...(fake.expires ? { "github-authentication-token-expiration": fake.expires } : {}), etag } });
        return reply(route, 200, list, { etag });
      }
      if (method === "GET") {
        if (holds.has(`${who} read`)) { fake.held++; await holds.get(`${who} read`); }
        fake.gets++;
        const whole = f.bytes.length <= fake.big;
        return reply(route, 200, { type: "file", name: p.split("/").pop(), path: p, sha: f.sha, size: f.bytes.length, encoding: whole ? "base64" : "none",
          content: whole ? f.bytes.toString("base64").replace(/(.{60})/g, "$1\n") : "" });
      }
      if (method === "PUT") {
        if (holds.has(`${who} save`)) { fake.held++; await holds.get(`${who} save`); }
        if (fake.mode === "nosave") return reply(route, 502, { message: "Server Error" });
        const body = JSON.parse(req.postData() || "{}"), now = fake.files.get(p);
        if ((now && body.sha !== now.sha) || (!now && body.sha)) {
          fake.clashes++;
          return now && !body.sha ? reply(route, 422, { message: "Invalid request. \"sha\" wasn't supplied." }) : reply(route, 409, { message: "does not match" });
        }
        const bytes = Buffer.from(body.content, "base64"), sha = sha1(bytes);
        fake.files.set(p, { sha, bytes, message: body.message });
        blobs.set(sha, bytes);
        commitFiles(body.message);
        fake.puts++;
        return reply(route, now ? 200 : 201, { content: { type: "file", name: p.split("/").pop(), path: p, sha, size: bytes.length }, commit: { sha: sha1(`commit ${fake.puts}`) } });
      }
    }
    // The history: the branch, its commits (newest first; since and until on the commit's date, both taking it), a new
    // commit (made, not on the branch), and moving the branch (mode "notidy": refused, as a rule protecting it would).
    const q = new URL(req.url()).searchParams;
    if (method === "GET" && path === `${base}/branches/main`) {
      const head = fake.commits.get(fake.head);
      return reply(route, 200, { name: "main", commit: { sha: fake.head, commit: { tree: { sha: head.tree } } } });
    }
    if (method === "GET" && path === `${base}/commits`) {
      if (!fake.head) return reply(route, 409, { message: "Git Repository is empty." });
      const since = q.get("since") ? Date.parse(q.get("since")) : -Infinity, until = q.get("until") ? Date.parse(q.get("until")) : Infinity;
      const per = +q.get("per_page") || 30, page = +q.get("page") || 1;
      const all = fake.history().filter(c => Date.parse(c.date) >= since && Date.parse(c.date) <= until).map(c => asListed(fake.commits.get(c.sha)));
      return reply(route, 200, all.slice((page - 1) * per, page * per));
    }
    // A new blob (its bytes kept), and a new tree: base_tree's paths with the entries applied (sha null: that path out).
    if (method === "POST" && path === `${base}/git/blobs`) {
      const body = JSON.parse(req.postData() || "{}"), bytes = Buffer.from(String(body.content || ""), body.encoding === "base64" ? "base64" : "utf8"), sha = sha1(bytes);
      blobs.set(sha, bytes);
      return reply(route, 201, { sha });
    }
    if (method === "POST" && path === `${base}/git/trees`) {
      if (holds.has(`${who} tree`)) { fake.held++; await holds.get(`${who} tree`); }
      const body = JSON.parse(req.postData() || "{}");
      if (!trees.has(body.base_tree)) return reply(route, 422, { message: "base_tree is not a valid tree" });
      const snap = { ...trees.get(body.base_tree) };
      for (const e of body.tree || []) {
        if (e.sha === null && e.path in snap) delete snap[e.path];
        else if (e.sha !== null && blobs.has(e.sha) && e.type === "blob" && e.mode === "100644") snap[e.path] = e.sha;
        else return reply(route, 422, { message: "GitRPC::BadObjectState" });
      }
      const sorted = Object.fromEntries(Object.entries(snap).sort(([a], [b]) => (a < b ? -1 : 1))), tree = sha1(JSON.stringify(sorted));
      trees.set(tree, sorted);
      return reply(route, 201, { sha: tree });
    }
    if (method === "POST" && path === `${base}/git/commits`) {
      const body = JSON.parse(req.postData() || "{}"), date = iso(fake.now);
      if (!trees.has(body.tree) || !(body.parents || []).every(sha => fake.commits.has(sha))) return reply(route, 422, { message: "Tree or parent not found" });
      const sha = addCommit({ tree: body.tree, parents: body.parents || [], message: body.message, author: body.author || person(date), committer: body.committer || person(date) });
      fake.made++;
      return reply(route, 201, { sha, tree: { sha: body.tree }, parents: (body.parents || []).map(s => ({ sha: s })), message: body.message });
    }
    if (method === "PATCH" && path === `${base}/git/refs/heads/main`) {
      const body = JSON.parse(req.postData() || "{}"), c = fake.commits.get(body.sha);
      if (fake.mode === "notidy" && body.force) return reply(route, 403, { message: "Resource not accessible by personal access token" });
      if (!c) return reply(route, 422, { message: "Object does not exist" });
      if (!body.force && fake.head && !reaches(c.sha, fake.head)) return reply(route, 422, { message: "Update is not a fast forward" });
      fake.head = c.sha;
      fake.moves++;
      if (body.force) fake.forced++;
      const snap = trees.get(c.tree);
      for (const p of [...fake.files.keys()]) if (!(p in snap)) fake.files.delete(p);
      for (const [p, sha] of Object.entries(snap)) if (!fake.files.has(p) || fake.files.get(p).sha !== sha) fake.files.set(p, { sha, bytes: blobs.get(sha) });
      return reply(route, 200, { ref: "refs/heads/main", object: { sha: c.sha, type: "commit" } });
    }
    if (method === "GET" && path.startsWith(`${base}/git/blobs/`)) {
      const sha = path.split("/").pop(), bytes = blobs.get(sha);
      if (bytes) return reply(route, 200, { sha, size: bytes.length, encoding: "base64", content: bytes.toString("base64").replace(/(.{60})/g, "$1\n") });
    }
    fake.odd++;
    return reply(route, 404, { message: "Not Found" });
  }

  fake.route = (ctx, who = "") => ctx.route("https://api.github.com/**", route => handle(route, who));
  fake.hold = (who, what = "save") => {
    let release;
    holds.set(`${who} ${what}`, new Promise(resolve => { release = resolve; }));
    return () => { holds.delete(`${who} ${what}`); release(); };
  };
  // Puts a file there as another device would (bytes: a Buffer).
  fake.plant = (path, bytes) => { fake.files.set(path, { sha: sha1(bytes), bytes }); blobs.set(sha1(bytes), bytes); commitFiles(`Kyoshi: ${path} planted`); };
  fake.text = path => (fake.files.has(path) ? fake.files.get(path).bytes.toString("utf8") : "");
  fake.paths = () => [...fake.files.keys()].sort();
  return fake;
}

// A cloud file (an envelope's text) decrypted in Node: its JSON save.
function decryptInNode(text, secret = SECRET) {
  const env = JSON.parse(text), iv = Buffer.from(env.iv, "base64"), data = Buffer.from(env.data, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", secret, iv);
  d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return JSON.parse((env.zip === "gzip" ? zlib.gunzipSync(plain) : plain).toString("utf8"));
}

// A save locked in Node as Kyoshi locks it: the envelope's text (another device's file, for a test to plant).
function encryptInNode(save, app, secret = SECRET) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", secret, iv);
  const data = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(save)))), c.final(), c.getAuthTag()]);
  return JSON.stringify({ kyoshi: 1, app, alg: "AES-256-GCM", zip: "gzip", iv: iv.toString("base64"), data: data.toString("base64") }, null, 2);
}

// Waits until the cloud checks asked for so far are done, and the history's trim and the day's backup one may have
// started.
const settled = tab => tab.page.evaluate(async () => { await Kyoshi.cloud.settled(); await Kyoshi.cloud.tidied(); await Kyoshi.cloud.backedUp(); });
// The Cloud block's state ("off", "on · owner/repo", "needs you") and line.
const cloudState = tab => tab.page.evaluate(() => document.getElementById("kDevCloudState").textContent);
const cloudText = tab => tab.page.evaluate(() => document.getElementById("kDevCloudText").textContent);
// Whether the page shows the cloud's banner and its header glyph: [banner, glyph].
const alarms = tab => tab.page.evaluate(() => ["kCloudBanner", "kCloudBtn"].map(id => !document.getElementById(id).hidden));
const bannerText = tab => tab.page.evaluate(() => document.getElementById("kCloudBannerText").textContent);

// Fills the pop-up and presses its button; waits for the outcome. Returns the refusal shown ("" when it went through).
async function popUp(tab, button, fields, remember) {
  const p = tab.page, was = await devPanel(tab, true);
  await p.click(button);
  for (const [sel, value] of fields) await p.fill(sel, value);
  if (!remember) await p.uncheck("#kCloudRemember");
  await p.click("#kCloudGo");
  await p.waitForFunction(() => {
    const st = document.getElementById("kCloudStatus");
    return !document.getElementById("kCloudOverlay").classList.contains("open") || document.getElementById("kCloudKeyOut").value || st.classList.contains("bad");
  });
  const refused = await p.evaluate(() => (document.getElementById("kCloudStatus").classList.contains("bad") ? document.getElementById("kCloudStatus").textContent : ""));
  const key = await p.inputValue("#kCloudKeyOut");
  if (await p.evaluate(() => document.getElementById("kCloudOverlay").classList.contains("open"))) await p.click("#kCloudCancel");
  if (!refused) await settled(tab);
  await devPanel(tab, was);
  return { refused, key };
}
// Set up a new cloud… with a repository and token: the key it shows (refused: why not).
const setUp = (tab, { repo = REPO, token = TOKEN, remember = true } = {}) => popUp(tab, "#kDevCloudSetup", [["#kCloudRepo", repo], ["#kCloudToken", token]], remember);
// Enter key…: "" once connected, else the pop-up's refusal.
const enterKey = async (tab, key = KEY, remember = true) => (await popUp(tab, "#kDevCloudEnter", [["#kCloudKeyIn", key]], remember)).refused;
// Update token…: the new key.
const updateToken = (tab, token) => popUp(tab, "#kDevCloudToken", [["#kCloudToken", token]], true);
// Sync now, in Developer Mode, and the check it starts.
async function syncNow(tab) {
  const was = await devPanel(tab, true);
  await tab.page.click("#kDevCloudSync");
  await settled(tab);
  await devPanel(tab, was);
}

module.exports = { REPO, TOKEN, SECRET, KEY, keyOf, secretOf, fakeGithub, decryptInNode, encryptInNode, settled, cloudState, cloudText, alarms, bannerText, setUp, enterKey, updateToken, syncNow };
