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
// context (who: a name for it): the CORS preflight, GET /repos/o/r, the listing of data/ (404 while empty, 304 for its
// ETag), a file (base64 with GitHub's line breaks; left out over `big` bytes, then fetched as a blob), PUT of a file (a
// stale sha: 409, none for one that's there: 422; both count in clashes), and a blob. Anything else answers 404 and counts
// in odd, so a test can check nothing unexpected was sent. mode: "ok", "auth" (401 to everything), "offline" (no answer)
// or "nosave" (saves answer 502; reading works). token: the one it accepts. hold(who, what): that device's saves ("save")
// or file reads ("read") wait (counted in held) until the function it returns is called, so something can happen meanwhile.
function fakeGithub({ repo = REPO } = {}) {
  const base = `/repos/${repo}`;
  const fake = { files: new Map(), puts: 0, clashes: 0, gets: 0, requests: 0, odd: 0, mode: "ok", token: TOKEN, isPrivate: true, big: Infinity, held: 0 };
  const holds = new Map(); // "who what" → the promise those requests wait on
  const sha1 = bytes => crypto.createHash("sha1").update(bytes).digest("hex");
  const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "etag, x-ratelimit-remaining, x-ratelimit-reset" };
  const reply = (route, status, body, headers = {}) =>
    route.fulfill({ status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...headers }, body: body === null ? "" : JSON.stringify(body) });

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
      if (method === "GET" && p === "data") {
        const list = [...fake.files].filter(([k]) => k.startsWith("data/")).map(([k, v]) => ({ type: "file", name: k.slice(5), path: k, sha: v.sha, size: v.bytes.length }));
        if (!list.length) return reply(route, 404, { message: "Not Found" });
        const etag = `W/"${sha1(JSON.stringify(list))}"`;
        if (req.headers()["if-none-match"] === etag) return route.fulfill({ status: 304, headers: { ...CORS, etag } });
        return reply(route, 200, list, { etag });
      }
      if (method === "GET") {
        if (holds.has(`${who} read`)) { fake.held++; await holds.get(`${who} read`); }
        if (!f) return reply(route, 404, { message: "Not Found" });
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
        fake.puts++;
        return reply(route, now ? 200 : 201, { content: { type: "file", name: p.split("/").pop(), path: p, sha, size: bytes.length }, commit: { sha: sha1(`commit ${fake.puts}`) } });
      }
    }
    if (method === "GET" && path.startsWith(`${base}/git/blobs/`)) {
      const sha = path.split("/").pop(), f = [...fake.files.values()].find(v => v.sha === sha);
      if (f) return reply(route, 200, { sha, size: f.bytes.length, encoding: "base64", content: f.bytes.toString("base64").replace(/(.{60})/g, "$1\n") });
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
  fake.plant = (path, bytes) => fake.files.set(path, { sha: sha1(bytes), bytes });
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

// Waits until the cloud checks asked for so far are done.
const settled = tab => tab.page.evaluate(() => Kyoshi.cloud.settled());
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
