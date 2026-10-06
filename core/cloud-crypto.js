/* Kyoshi · core/cloud-crypto.js — the cloud's key and its locked files, as K.cloudCrypto. No UI, no network, and
 * nothing from other files but K, so a page with core/base.js alone can use it (a standalone decrypt page, later).
 * The key is one string, kyoshi1.<owner>/<repo>.<token>.<secret>: the private GitHub repository, a token that may read
 * and write it, and the secret (32 random bytes as base64url: 43 characters) that locks every file. "kyoshi1" names the
 * format. Kyoshi makes it on the first device and the others take it pasted; parseKey reads it from the end, as a
 * repository's name may hold dots.
 * A file in the cloud (data/<app>.json) is an envelope, plain JSON text that says what it is:
 *   { "kyoshi": 1, "app": "momo", "alg": "AES-256-GCM", "zip": "gzip", "iv": "<base64, 12 bytes>", "data": "<base64>" }
 * seal: the app's save as JSON → UTF-8 → gzip where the browser has CompressionStream (else zip "none") → AES-256-GCM
 * with the secret and a fresh random iv every time (data: the ciphertext with GCM's 16-byte tag after it, as Web Crypto
 * writes it) → base64. open undoes it, reading zip "gzip" and "none" forever: a wrong key or a changed file throws an
 * error with code "key", anything else that isn't a readable envelope code "format".
 * Text only: there is no binary variant, and nothing here takes a Blob. Needs Web Crypto (crypto.subtle), which browsers
 * give a page over https or opened from a file, not one over plain http, and DecompressionStream (supported says so). */
(function (K) {
  "use strict";
  const FORMAT = "kyoshi1", ALG = "AES-256-GCM", IV_BYTES = 12, SECRET_BYTES = 32;
  const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/, NAME = /^(?!\.+$)[A-Za-z0-9._-]{1,100}$/; // GitHub's rules; never "." or ".."
  const TOKEN = /^[A-Za-z0-9_]+$/, SECRET = /^[A-Za-z0-9_-]{43}$/;
  // Web Crypto, and the browser's own unzipping (every device's files are gzipped). Why, when it can't:
  const supported = !!(window.crypto && window.crypto.subtle) && typeof DecompressionStream === "function";
  const unsupported = !(window.crypto && window.crypto.subtle) ? "Cloud sync needs the site over https, or Kyoshi opened from a file."
    : "Cloud sync needs a newer browser: this one can't unzip the cloud's files.";
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const fail = code => Object.assign(new Error(code === "key" ? "This key doesn't open that file." : "That isn't a readable Kyoshi cloud file."), { code });

  // --- Bytes and text ---
  const utf8 = text => new TextEncoder().encode(text);
  const fromUtf8 = bytes => new TextDecoder().decode(bytes);
  // In chunks: String.fromCharCode(...a big array) overflows the call stack.
  function toBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  // Throws on anything that isn't base64 (line breaks and spaces are fine).
  function fromBase64(text) {
    const s = atob(String(text).replace(/\s+/g, "")), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const toBase64url = bytes => toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromBase64url = text => fromBase64(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "="));

  // --- The key string ---
  const clean = str => String(str == null ? "" : str).replace(/\s+/g, ""); // a pasted key may come with spaces or line breaks
  // "owner/name", as GitHub allows them.
  function isRepo(repo) {
    const parts = String(repo).split("/");
    return parts.length === 2 && OWNER.test(parts[0]) && NAME.test(parts[1]);
  }
  const isToken = token => TOKEN.test(String(token));
  // The key's parts, { repo: "owner/name", token, secret: 32 bytes }, or null when it isn't a whole key.
  function parseKey(str) {
    const s = clean(str);
    if (!s.startsWith(`${FORMAT}.`)) return null;
    const parts = s.slice(FORMAT.length + 1).split(".");
    if (parts.length < 3) return null;
    const secret = parts.pop(), token = parts.pop(), repo = parts.join(".");
    if (!isRepo(repo) || !isToken(token) || !SECRET.test(secret)) return null;
    const bytes = fromBase64url(secret);
    return bytes.length === SECRET_BYTES ? { repo, token, secret: bytes } : null;
  }
  // Why a paste isn't a key, in one line ("" when it is one).
  function keyError(str) {
    const s = clean(str);
    if (!s) return "Paste the key first: it starts with kyoshi1.";
    if (parseKey(s)) return "";
    if (/^(github_pat_|gh[pousr]_)/.test(s)) return "That's a token on its own: paste the whole key, which starts with kyoshi1.";
    if (/^kyoshi\d+\./.test(s) && !s.startsWith(`${FORMAT}.`)) return "That key is for a newer Kyoshi: reload the page, then paste it again.";
    if (!s.startsWith(`${FORMAT}.`)) return "That isn't a Kyoshi cloud key: the whole key starts with kyoshi1.";
    return "That key looks cut short or changed: copy the whole of it again, from kyoshi1. to its end.";
  }
  const makeKey = ({ repo, token, secret }) => `${FORMAT}.${repo}.${token}.${toBase64url(secret)}`;
  const newSecret = () => crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const importKey = secret => crypto.subtle.importKey("raw", secret, "AES-GCM", false, ["encrypt", "decrypt"]);

  // --- Locking and unlocking a save ---
  // Through one of the browser's own streams (CompressionStream or DecompressionStream).
  const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const isEnvelope = x => isObj(x) && x.kyoshi === 1 && x.alg === ALG && (x.zip === "gzip" || x.zip === "none") && typeof x.iv === "string" && typeof x.data === "string";

  // An app's save (any JSON-able object) as an envelope, locked with key (importKey's).
  async function seal(obj, key, app) {
    let bytes = utf8(JSON.stringify(obj)), zip = "none";
    if (typeof CompressionStream === "function" && typeof Response === "function") {
      try { bytes = await through(bytes, new CompressionStream("gzip")); zip = "gzip"; } catch (err) { /* kept as it is */ }
    }
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
    return { kyoshi: 1, app: String(app), alg: ALG, zip, iv: toBase64(iv), data: toBase64(data) };
  }

  // The save an envelope holds (parsed JSON).
  async function open(env, key) {
    if (!isEnvelope(env)) throw fail("format");
    let iv, data, plain;
    try { iv = fromBase64(env.iv); data = fromBase64(env.data); } catch (err) { throw fail("format"); }
    if (iv.length !== IV_BYTES) throw fail("format");
    try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)); } catch (err) { throw fail(err && err.name === "OperationError" ? "key" : "format"); }
    try {
      if (env.zip === "gzip") plain = await through(plain, new DecompressionStream("gzip"));
      return JSON.parse(fromUtf8(plain));
    } catch (err) { throw fail("format"); }
  }

  K.cloudCrypto = { supported, unsupported, parseKey, keyError, makeKey, isRepo, isToken, newSecret, importKey, seal, open, isEnvelope, toBase64, fromBase64, utf8, fromUtf8 };
})(Kyoshi);
