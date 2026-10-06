/* Kyoshi · core/github.js — a small client for GitHub's REST API, as K.github. No UI, no crypto: core/cloud.js keeps the
 * cloud's private repository with it.
 * K.github.client({ repo: "owner/name", token }) → { repo(), listDir(path, etag), getFile(path), getBlob(sha),
 * putFile(path, base64, { sha, message }), branch(), newCommit(treeSha, message), moveBranch(sha) } (the last three
 * for tidying the repository's history). There is no call that deletes a file.
 * Every request goes to https://api.github.com and nowhere else, with the token as a Bearer header, never from the
 * browser's cache (cache: "no-store": a listing asks with its last ETag instead, and a 304 comes back as { status: 304 }),
 * and gives up after REQUEST_MS.
 * A failure throws a GithubError { status, code, until }, code one of: "auth" (401: the token is refused), "forbidden"
 * (403: the token lacks the permission, or the repository's rules refuse), "ratelimit" (403 or 429 with no requests
 * left: until = when GitHub lets us again), "notfound" (404: no such repository, the token can't see it, or no such
 * path: the caller decides), "conflict" (409: the file changed since it was read), "invalid" (422), "server" (5xx, or an
 * answer that isn't GitHub's), "network" (no answer: offline, a network that blocks GitHub, or the browser refused it).
 * As GitHub documents it (to confirm on the first real set-up from disk: the environment this was built in can't reach
 * api.github.com): a PUT whose sha is stale answers 409 (callers treat 409 and 422 alike: read again, then try again),
 * and the API answers CORS for any page, one opened from a file included (Access-Control-Allow-Origin: *, the
 * Authorization header allowed in the preflight; ETag and X-RateLimit-* exposed). */
(function (K) {
  "use strict";
  const API = "https://api.github.com";
  const REQUEST_MS = 30000; // a request with no answer by then counts as unreachable

  class GithubError extends Error {
    constructor(status, code, until = 0) {
      super(`GitHub: ${code}${status ? ` (${status})` : ""}`); // never the token, the repository or a path
      this.name = "GithubError";
      Object.assign(this, { status, code, until });
    }
  }

  // Each part of a path as it is in the URL ("data/momo.json" stays so).
  const enc = path => String(path).split("/").map(encodeURIComponent).join("/");
  // A file's content as GitHub sends it (base64 with line breaks) → bytes.
  function bytesOf(b64) {
    try { return Uint8Array.from(atob(String(b64 || "").replace(/\s+/g, "")), c => c.charCodeAt(0)); } catch (err) { throw new GithubError(200, "server"); }
  }

  // A failed answer as a GithubError: a rate limit (none left, or GitHub's "secondary" one, which its message names)
  // carries when it ends.
  async function failure(res) {
    const s = res.status, left = res.headers.get("x-ratelimit-remaining"), reset = +res.headers.get("x-ratelimit-reset") || 0;
    const retry = +res.headers.get("retry-after") || 0;
    let said = "";
    if (s === 403) try { said = String((await res.json()).message || ""); } catch (err) { /* no message */ }
    if (s === 429 || (s === 403 && (left === "0" || retry > 0 || /rate limit/i.test(said)))) {
      return new GithubError(s, "ratelimit", retry ? Date.now() + retry * 1000 : reset ? reset * 1000 : Date.now() + 60000);
    }
    return new GithubError(s, { 401: "auth", 403: "forbidden", 404: "notfound", 409: "conflict", 422: "invalid" }[s] || "server");
  }

  function client({ repo, token }) {
    const base = `/repos/${enc(repo)}`;
    let branchName = ""; // the repository's default branch, once repo() has read it

    // One request: { status, etag, data } (data: the JSON answer), or { status: 304 } when etag still holds.
    async function request(method, path, { body, etag = "" } = {}) {
      const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" };
      if (etag) headers["If-None-Match"] = etag;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const stop = typeof AbortController === "function" ? new AbortController() : null;
      const timer = stop ? setTimeout(() => stop.abort(), REQUEST_MS) : 0;
      let res = null;
      try {
        res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: stop ? stop.signal : undefined });
        if (res.status === 304) return { status: 304, etag, data: null };
        if (!res.ok) throw await failure(res);
        return { status: res.status, etag: res.headers.get("etag") || "", data: res.status === 204 ? null : await res.json() };
      } catch (err) {
        throw err instanceof GithubError ? err : new GithubError(res ? res.status : 0, res ? "server" : "network");
      } finally { clearTimeout(timer); }
    }

    const getBlob = async sha => bytesOf((await request("GET", `${base}/git/blobs/${enc(sha)}`)).data.content);

    return {
      // The repository: { private, branch } (its default branch, where Kyoshi's files go).
      async repo() {
        const { data } = await request("GET", base);
        branchName = String((data && data.default_branch) || "main");
        return { private: !!data && data.private === true, branch: branchName };
      },
      // A folder's files, { status, etag, files: [{ name, path, sha, size }] } (files [] when there's no such folder);
      // given the last listing's etag, { status: 304, files: null } while nothing in it changed.
      async listDir(path, etag = "") {
        let res;
        try { res = await request("GET", `${base}/contents/${enc(path)}`, { etag }); } catch (err) {
          if (err.code === "notfound") return { status: 404, etag: "", files: [] };
          throw err;
        }
        if (res.status === 304) return { status: 304, etag, files: null };
        const files = (Array.isArray(res.data) ? res.data : []).filter(f => f && f.type === "file")
          .map(f => ({ name: String(f.name), path: String(f.path), sha: String(f.sha), size: +f.size || 0 }));
        return { status: res.status, etag: res.etag, files };
      },
      // A file: { sha, size, bytes }. Over 1 MB GitHub leaves the content out, so it comes as a blob.
      async getFile(path) {
        const { data } = await request("GET", `${base}/contents/${enc(path)}`);
        if (!data || data.type !== "file") throw new GithubError(404, "notfound");
        const sha = String(data.sha), size = +data.size || 0;
        return { sha, size, bytes: data.content || !size ? bytesOf(data.content) : await getBlob(sha) };
      },
      getBlob,
      // Writes a file (its bytes as base64) as one commit; sha: the file it replaces (none for a new one). → { sha } of
      // the file now there.
      async putFile(path, base64, { sha = "", message = "" } = {}) {
        const { data } = await request("PUT", `${base}/contents/${enc(path)}`, { body: { message, content: base64, ...(sha ? { sha } : {}) } });
        return { sha: String((data && data.content && data.content.sha) || "") };
      },
      // For tidying the history: the default branch's head { sha, tree }, a commit of a tree with no parents, and
      // moving the branch to a commit.
      async branch() {
        if (!branchName) await this.repo();
        const { data } = await request("GET", `${base}/branches/${enc(branchName)}`);
        return { sha: String(data.commit.sha), tree: String(data.commit.commit.tree.sha) };
      },
      async newCommit(treeSha, message) {
        return String((await request("POST", `${base}/git/commits`, { body: { message, tree: treeSha, parents: [] } })).data.sha);
      },
      async moveBranch(sha) {
        if (!branchName) await this.repo();
        await request("PATCH", `${base}/git/refs/heads/${enc(branchName)}`, { body: { sha, force: true } });
      }
    };
  }

  K.github = { client, GithubError };
})(Kyoshi);
