/* Kyoshi · core/cloud-ui.js — cloud sync's UI, as K.cloudUI (core/cloud.js does the work).
 * Developer Mode's Cloud block (#kDevCloud, above Backup & sync): the state ("off", "on · owner/repo", "needs you"), a
 * line on how it's going (and the app on screen's last cloud news), and the buttons that state allows: Sync now, Enter
 * key…, Set up a new cloud…, Show key, Update token…, Download decrypted copy, Decrypt a file…, Disconnect.
 * While all is well nothing shows on the page. While the cloud needs the owner (K.cloud.status().attention: GitHub out
 * of reach, or the key refused, or a file it can't read) the banner above the app (#kCloudBanner) says so in plain
 * words, with Try now (or Open Developer Mode), and the header shows the cloud-off glyph (#kCloudBtn, opening the
 * block); both go away on their own once a check gets through or the key is fixed: they can't be dismissed.
 * One pop-up (#kCloudOverlay), in one of four modes: setup (Set up a new cloud…: the three steps on GitHub, the
 * repository and token, then the new key to keep), enter (Enter key…), token (Update token…, then the new key), show
 * (Show key). The token is never shown again once saved: the key's box is the only place it's readable, on purpose.
 * render() is called by K.cloud on every change and by Developer Mode. */
(function (K) {
  "use strict";
  const { copyText, readFile } = K.util;
  const $ = id => document.getElementById(id);
  const INTRO = "Keeps every app's data current on your phone and computers through a private GitHub repository, encrypted with a key only your devices hold. Photos and documents stay on this device (and in the sync folder, if you use one).";
  // The block's buttons in each state.
  const BUTTONS = {
    off: ["kDevCloudEnter", "kDevCloudSetup", "kDevCloudDecrypt"],
    on: ["kDevCloudSync", "kDevCloudKey", "kDevCloudToken", "kDevCloudExport", "kDevCloudDecrypt", "kDevCloudOff"],
    "needs-key": ["kDevCloudEnter", "kDevCloudToken", "kDevCloudDecrypt", "kDevCloudOff"],
    error: ["kDevCloudEnter", "kDevCloudDecrypt", "kDevCloudOff"]
  };
  // The pop-up's modes: its title, its Go button, the parts it shows, a line under the title.
  const PARTS = ["kCloudSteps", "kCloudHint", "kCloudRepoField", "kCloudTokenField", "kCloudKeyInField", "kCloudRememberRow", "kCloudKeyBox"];
  const MODES = {
    setup: { title: "Set up a new cloud", go: "Create key", parts: ["kCloudSteps", "kCloudRepoField", "kCloudTokenField", "kCloudRememberRow"] },
    enter: { title: "Enter key", go: "Connect", parts: ["kCloudHint", "kCloudKeyInField", "kCloudRememberRow"],
      hint: "Paste the key made when the cloud was set up (it starts with kyoshi1.). This device then fills up from the cloud, and what's already here is combined with it." },
    token: { title: "Update token", go: "Save", parts: ["kCloudHint", "kCloudTokenField"],
      hint: "Make a new token on GitHub with the same settings (Settings → Developer settings → Fine-grained tokens), and paste it here. The repository and its data stay as they are; the key changes, so you'll paste the new one on your other devices." },
    show: { title: "Show key", parts: ["kCloudKeyBox"] }
  };
  let mode = "";   // the pop-up's
  let busy = false, done = false; // checking with GitHub; a key shown at the end
  let said = "", saidBad = false; // the block's last word on Download decrypted copy or Decrypt a file…

  // --- The block, the banner and the glyph ---
  const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `at ${K.cloud.timeOf(ms)}`; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // How it's going, in a line.
  function textOf(s) {
    if (!K.cloudCrypto.supported) return K.cloudCrypto.unsupported;
    if (s.state === "off") return [INTRO, s.message].filter(Boolean).join(" ");
    if (s.state !== "on") return s.message;
    if (K.testMode) return "Paused in test mode: nothing is saved or synced until you reload.";
    if (s.busy) return s.busy;
    if (s.lost) return s.message;
    const left = s.waiting ? `${plural(s.waiting, "app has", "apps have")} changes waiting` : "Up to date";
    if (s.failedAt) return `Couldn't reach GitHub at ${K.cloud.timeOf(s.failedAt)}; trying again soon.${s.waiting ? ` ${left}.` : ""}`;
    const A = K.active(), note = A && A.data ? K.cloud.note(A) : "";
    return `${left}; ${s.checkedAt ? `checked ${ago(s.checkedAt)}` : "checking…"}.${note ? ` ${A.meta.name}: ${note[0].toLowerCase()}${note.slice(1)}.` : ""}`;
  }

  function render() {
    const s = K.cloud.status(), ok = K.cloudCrypto.supported;
    $("kDevCloudState").textContent = !ok ? "unavailable" : s.state === "off" ? "off" : s.state === "on" ? `on · ${s.repo}` : "needs you";
    $("kDevCloudText").textContent = textOf(s);
    $("kDevCloudSaid").textContent = said;
    $("kDevCloudSaid").hidden = !said;
    $("kDevCloudSaid").classList.toggle("bad", saidBad);
    const shown = ok ? BUTTONS[s.state] || [] : [];
    $("kDevCloudActions").querySelectorAll("button").forEach(b => { b.hidden = !shown.includes(b.id); });
    // Nothing on the page while all is well; the banner and the glyph while the cloud needs you.
    $("kCloudBanner").hidden = $("kCloudBtn").hidden = !s.attention;
    if (!s.attention) return;
    $("kCloudBannerText").textContent = s.message;
    $("kCloudBannerBtn").textContent = s.lost ? "Try now" : "Open Developer Mode";
    $("kCloudBtn").title = s.message;
    $("kCloudBtn").setAttribute("aria-label", s.message);
  }

  // Developer Mode, open at the Cloud block.
  function showBlock() {
    if (!K.dev.isOn()) K.dev.toggle();
    $("kDevCloud").scrollIntoView({ block: "nearest" });
  }
  function say(text, bad = false) {
    said = text;
    saidBad = bad;
    render();
  }
  // Runs one of the block's actions, its progress and outcome in the block's last line.
  async function act(fn) {
    try { say(await fn(text => say(text))); } catch (err) {
      if (!err.refusal) console.error("Cloud sync's action failed.", err);
      say(err.refusal ? err.message : "That didn't work: try again, and use Bugs & requests if it keeps happening.", true);
    }
  }

  // --- The pop-up ---
  const overlay = () => $("kCloudOverlay");
  function setStatus(text, cls = "") {
    $("kCloudStatus").textContent = text;
    $("kCloudStatus").className = `modal-status ${cls}`;
  }
  // The typed fields and the key box emptied (the token never stays in the page).
  function clear() {
    ["kCloudRepo", "kCloudToken", "kCloudKeyIn", "kCloudKeyOut"].forEach(id => { $(id).value = ""; });
    setStatus("");
  }
  // Whether closing would lose something typed.
  const typed = () => !done && ["kCloudRepo", "kCloudToken", "kCloudKeyIn"].some(id => !$(id).closest("[hidden]") && $(id).value.trim());

  function openPop(m) {
    const d = MODES[m];
    mode = m;
    busy = done = false;
    clear();
    $("kCloudTitle").textContent = d.title;
    PARTS.forEach(id => { $(id).hidden = !d.parts.includes(id); });
    $("kCloudHint").textContent = d.hint || "";
    $("kCloudRemember").checked = true;
    $("kCloudGo").hidden = !d.go;
    $("kCloudGo").textContent = d.go || "";
    $("kCloudGo").disabled = false;
    $("kCloudCopy").hidden = m !== "show";
    $("kCloudCancel").textContent = m === "show" ? "Close" : "Cancel";
    if (m === "show") showKey(K.cloud.keyString(), "Keep it in your password manager. On another device, Enter key… (Developer Mode → Cloud sync) takes it.");
    K.modal.open(overlay());
    const first = overlay().querySelector(".field:not([hidden]) input, .field:not([hidden]) textarea:not([readonly])");
    if (first) first.focus();
  }
  // The pop-up's end: the key, with Copy (the token field emptied for good).
  function showKey(key, note) {
    PARTS.forEach(id => { $(id).hidden = id !== "kCloudKeyBox"; });
    $("kCloudToken").value = "";
    $("kCloudKeyOut").value = key;
    $("kCloudKeyNote").textContent = note;
    $("kCloudGo").hidden = true;
    $("kCloudCopy").hidden = false;
    $("kCloudCancel").textContent = "Done";
    done = true;
  }

  async function go() {
    if (busy) return;
    busy = true;
    $("kCloudGo").disabled = true;
    const tell = text => setStatus(text);
    try {
      if (mode === "setup") {
        showKey(await K.cloud.setup({ repo: $("kCloudRepo").value, token: $("kCloudToken").value, remember: $("kCloudRemember").checked }, tell),
          "Keep it in your password manager and paste it on your other devices. Without it the cloud copy can't be read; it isn't stored anywhere else.");
        setStatus("This device is on: its data is going up to the cloud now.", "good");
      } else if (mode === "token") {
        showKey(await K.cloud.updateToken($("kCloudToken").value, tell), "Paste this on your other devices too.");
        setStatus("Saved: the cloud is on again with the new token.", "good");
      } else if (mode === "enter") {
        await K.cloud.connect($("kCloudKeyIn").value, $("kCloudRemember").checked, tell);
        done = true;
        K.modal.dismiss(overlay());
      }
    } catch (err) {
      if (!err.refusal) console.error("Cloud sync couldn't connect.", err);
      setStatus(err.refusal ? err.message : "Something went wrong: try again, and use Bugs & requests if it keeps happening.", "bad");
    } finally {
      busy = false;
      $("kCloudGo").disabled = false;
    }
  }

  async function copyKey() {
    const copied = await copyText($("kCloudKeyOut").value);
    setStatus(copied ? "Copied." : "Couldn't copy it: select the key and copy it by hand.", copied ? "good" : "bad");
  }

  function init() {
    K.modal.define(overlay(), {
      pending: () => busy || typed(),
      ask: "Discard what you typed?",
      dismiss: () => { K.modal.close(overlay()); clear(); busy = false; }
    });
    $("kCloudGo").addEventListener("click", go);
    $("kCloudCopy").addEventListener("click", copyKey);
    $("kCloudCancel").addEventListener("click", () => K.modal.dismiss(overlay()));
    // Enter in a one-line field is Go (the key's box takes Ctrl+Enter, as it may wrap).
    overlay().addEventListener("keydown", e => {
      if (e.key === "Enter" && !$("kCloudGo").hidden && (e.target.tagName === "INPUT" || e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); }
    });
    $("kDevCloudSync").addEventListener("click", () => K.cloud.syncNow());
    $("kDevCloudEnter").addEventListener("click", () => openPop("enter"));
    $("kDevCloudSetup").addEventListener("click", () => openPop("setup"));
    $("kDevCloudKey").addEventListener("click", () => openPop("show"));
    $("kDevCloudToken").addEventListener("click", () => openPop("token"));
    $("kDevCloudExport").addEventListener("click", () => act(tell => K.cloud.exportDecrypted(tell)));
    $("kDevCloudDecrypt").addEventListener("click", () => $("kDevCloudDecryptFile").click());
    $("kDevCloudDecryptFile").addEventListener("change", async e => {
      const f = e.target.files[0];
      e.target.value = ""; // so the same file can be picked again
      const text = f ? await readFile(f) : null;
      if (typeof text === "string") act(() => K.cloud.decryptFile(text));
    });
    $("kDevCloudOff").addEventListener("click", () => { if (K.cloud.disconnect()) say(""); });
    $("kCloudBtn").addEventListener("click", showBlock);
    $("kCloudBannerBtn").addEventListener("click", () => (K.cloud.status().lost ? K.cloud.syncNow() : showBlock()));
    render();
  }

  K.cloudUI = { init, render, open: openPop };
})(Kyoshi);
