/* Kyoshi · core/shell.js — the shell: app registry, header & switcher, theme, start-up.
 * K.register(meta) → A, an app's namespace (the app contract is in CLAUDE.md).
 * K.start() (the last line of index.html) opens the store (core/storage.js), makes each app's
 * root from A.markup, loads and starts every app (and its meetings, core/meetings.js), then K.ready is
 * true (an app reading other apps waits for it: they start one at a time), shows one
 * (the URL's #id, else the last used), then runs the shared keyboard, minute tick and other-tab reloads.
 * Only the app on screen is in the page: the others' roots are kept aside (detached) but
 * keep running — so ids only need to be unique within an app, and A.$ looks only inside it.
 * One app is hidden (meta.hidden): core's own record, the hidden Kyoshi app (core/record.js: the bug log and the theme
 * picked, synced and backed up as an app's data is). It has no page, is never shown nor in the switcher, and its writes
 * are kept in test mode. The theme is drawn from this device's copy (K.setTheme) before anything else is read. */
(function (K) {
  "use strict";
  const { esc } = K.util;
  const $ = id => document.getElementById(id);
  const TICK_MS = 60000;
  let active = null;    // the app on screen
  let menuOpen = false; // the switcher's list of apps

  // An app's id is its folder, storage prefix, sync subfolder, #id and CSS scope: lowercase letters and
  // digits from a letter, one app each ("storage" is taken: core keeps kyoshi.storage.moved; "kyoshi" is core's own
  // record, the one hidden app, core/record.js).
  K.register = meta => {
    if (!/^[a-z][a-z0-9]*$/.test(meta.id) || meta.id === "storage" || (meta.id === "kyoshi") !== (meta.hidden === true) || K.apps[meta.id]) {
      throw new Error(`Kyoshi can't add an app with the id "${meta.id}": use lowercase letters and digits, starting with a letter, that no other app uses.`);
    }
    const A = {
      id: meta.id, meta, S: {}, root: null, started: false, subtitle: meta.subtitle || "",
      store: K.storage.scoped(`kyoshi.${meta.id}.`, !meta.hidden), // the hidden app's writes are kept in test mode
      files: K.files.scoped(meta.id), // photos and documents (core/files.js)
      $: id => A.root.querySelector(`#${CSS.escape(id)}`),
      isActive: () => active === A,
      // A listener on document/window that only fires while this app is on screen.
      listen: (target, type, fn, opts) => target.addEventListener(type, e => { if (active === A) fn(e); }, opts),
      // A change can end what keeps the screen on, and start the app's meetings counting (its first goal, say). quiet: the
      // app's own bookkeeping (Momo's asks), synced like any change but not when the data here last changed (core/sync.js).
      changed: (unsaved = true, quiet = false) => { K.sync.changed(A, unsaved, quiet); K.meetings.settle(A); K.wakeLock.check(); },
      setSubtitle: text => { A.subtitle = text; if (active === A) $("kAppSubtitle").textContent = text; },
      refreshDev: () => K.dev.refreshTools(A)
    };
    K.apps[meta.id] = A;
    K.order.push(meta.id);
    return A;
  };
  K.active = () => active;

  // --- Starting ---
  K.start = async () => {
    initTheme();
    const slow = setTimeout(K.backup.checkStorage, 5000); // says why nothing shows up, if the browser is slow
    await K.storage.open(); // everything saved, into memory
    clearTimeout(slow);
    K.backup.init();
    K.cloudUI.init();
    K.record.init(); // core's own record, the hidden Kyoshi app (core/record.js): registered now, so it starts last
    K.bugs.init();
    K.meetings.init();
    K.order.forEach(id => startApp(K.apps[id]));
    K.ready = true; // every app has started (or failed to): what one reads from the others is all there now
    K.dev.init();
    wireSwitcher();
    wireKeys();
    K.storage.onChange(onStoreChange);
    window.addEventListener("storage", e => { if (e.key === "kyoshi.theme") applyTheme(e.newValue); });
    window.addEventListener("hashchange", () => show(K.apps[location.hash.slice(1)]));
    setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
    show(K.apps[location.hash.slice(1)] || K.apps[K.storage.get("kyoshi.lastApp")] || first());
    K.sync.init();
    K.backup.checkStorage();
  };

  // Makes the app's root, then loads (A.load) with its meetings, gets its sync identity and starts it (A.init).
  // An app that fails shows why instead, with a way to download its data, and the others carry on.
  function startApp(A) {
    A.root = document.createElement("div");
    A.root.className = `app-root app-${A.id}`;
    A.root.innerHTML = A.markup || "";
    let loaded = false;
    try {
      if (A.load) A.load();
      loaded = true;
      K.meetings.load(A);
      if (A.data) K.sync.loadMeta(A);
      if (A.init) A.init();
      A.started = true;
    } catch (err) {
      console.error(`${A.meta.name} couldn't start.`, err);
      A.root.innerHTML = `<section><h2>${esc(A.meta.name)} couldn't start</h2><p class="note">Something went wrong while loading it. Use Bugs &amp; requests below: a bug report includes the error. Your data is still kept in this browser, and you can download a copy of it.</p><div class="toolbar"><button class="secondary">Download its data</button></div></section>`;
      A.root.querySelector("button").addEventListener("click", () => rescue(A, loaded));
    }
  }

  // The data of an app that couldn't start, so it's never out of reach: its usual backup (Import JSON
  // takes it back) when its data could be read, else every key it stored, as it was kept.
  function rescue(A, loaded) {
    if (loaded && A.data) {
      try { return K.backup.exportApp(A); } catch (err) { console.error(`${A.meta.name} couldn't make its backup.`, err); }
    }
    const keys = {};
    A.store.keys().forEach(k => { keys[k] = A.store.get(k); });
    K.util.downloadJSON({ kyoshiApp: A.id, savedAt: new Date().toISOString(), keys }, `${A.id}-saved-data-${K.util.todayStr()}.json`);
  }

  // The first app with a page: a new device's, and the one shown for the hidden app (#kyoshi in the URL, say).
  const first = () => K.apps[K.order.find(id => !K.apps[id].meta.hidden)];

  // Puts an app on screen: its root, header (meetings too), width, and #id in the URL. The tab stays "Kyoshi" (index.html).
  function show(A) {
    if (A && A.meta.hidden) A = first();
    if (!A || A === active) return;
    closeMenu();
    if (active) {
      call(active, "onHide");
      active.root.remove();
    }
    active = A;
    $("kMount").appendChild(A.root);
    document.documentElement.style.setProperty("--app-width", `${A.meta.width || 780}px`);
    $("kAppName").textContent = A.meta.name;
    $("kAppSubtitle").textContent = A.subtitle;
    K.meetings.render();
    $("kFooterName").textContent = A.meta.name;
    $("kVersionTag").textContent = A.VERSION ? `v${A.VERSION}` : "";
    K.storage.set("kyoshi.lastApp", A.id);
    if (location.hash.slice(1) !== A.id) try { history.replaceState(null, "", `#${A.id}`); } catch (err) { /* some file:// setups */ }
    call(A, "onShow");
    K.wakeLock.check(); // the screen stays on only for the app on screen that asks (core/wakelock.js)
    renderSwitcher();
    K.dev.refresh();
  }
  K.show = id => show(K.apps[id]);

  // Runs an app's hook, if it has one and started; a failing hook is logged, not fatal.
  function call(A, hook, ...args) {
    if (!A.started || !A[hook]) return undefined;
    try { return A[hook](...args); } catch (err) { console.error(`${A.meta.name}'s ${hook} failed.`, err); return undefined; }
  }

  // --- Switcher: one button (the app on screen's icon) opening a list of every app (but the hidden one) ---
  // What an app says needs you ("" if nothing), else its overdue meeting: a dot on its icon, and on the button for others.
  const attention = A => call(A, "attention") || (A.started ? K.meetings.attention(A) : "");
  const listed = () => K.order.map(id => K.apps[id]).filter(A => !A.meta.hidden);

  function renderSwitcher() {
    if (!active) return;
    const waiting = listed().filter(A => A !== active && attention(A));
    $("kSwitchIcon").innerHTML = active.meta.icon;
    $("kSwitchDot").hidden = !waiting.length;
    $("kSwitchBtn").title = waiting.length ? `Switch app (${waiting.map(A => `${A.meta.name}: ${attention(A)}`).join("; ")})` : "Switch app";
    $("kSwitchBtn").setAttribute("aria-label", `${active.meta.name}. Switch app${waiting.length ? `, ${waiting.length} waiting` : ""}`);
    if (menuOpen) renderMenu();
  }
  K.refreshSwitcher = renderSwitcher;

  function renderMenu() {
    const focused = document.activeElement && document.activeElement.dataset.app;
    $("kSwitchMenu").innerHTML = listed().map(A => {
      const why = attention(A), cur = A === active;
      return `<button type="button" class="switch-item${cur ? " current" : ""}" role="menuitem" data-app="${A.id}"${why ? ` title="${esc(why)}"` : ""}${cur ? ' aria-current="true"' : ""}>` +
        `<span class="app-icon">${A.meta.icon}</span><span class="switch-name">${esc(A.meta.name)}</span>` +
        (why ? `<span class="attn-dot" role="img" aria-label="${esc(why)}"></span>` : "") +
        (cur ? `<span class="switch-check" aria-hidden="true">&#10003;</span>` : "") + `</button>`;
    }).join("");
    const again = focused && $("kSwitchMenu").querySelector(`[data-app="${focused}"]`);
    if (again) again.focus();
  }

  function openMenu() {
    menuOpen = true;
    renderMenu();
    $("kSwitchMenu").hidden = false;
    $("kSwitchBtn").setAttribute("aria-expanded", "true");
    const cur = $("kSwitchMenu").querySelector(".current") || $("kSwitchMenu").querySelector("button");
    if (cur) cur.focus();
  }

  function closeMenu(refocus = false) {
    if (!menuOpen) return;
    menuOpen = false;
    $("kSwitchMenu").hidden = true;
    $("kSwitchBtn").setAttribute("aria-expanded", "false");
    if (refocus) $("kSwitchBtn").focus();
  }

  function wireSwitcher() {
    $("kSwitchBtn").addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
    $("kSwitchMenu").addEventListener("click", e => {
      const item = e.target.closest("[data-app]");
      if (!item) return;
      closeMenu();
      show(K.apps[item.dataset.app]);
    });
    // Up and down arrows move through the list.
    $("kSwitchMenu").addEventListener("keydown", e => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [...$("kSwitchMenu").querySelectorAll("button")], i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    });
    document.addEventListener("pointerdown", e => { if (menuOpen && !$("kSwitcher").contains(e.target)) closeMenu(); });
  }

  // --- Theme (one for every app, and the one picked on any device: core/record.js keeps the pick, prefs) ---
  const applyTheme = theme => { document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light"; };
  // Shows a theme and keeps it on this device (localStorage: the page draws from it at start, before any data is read).
  function setTheme(theme) {
    applyTheme(theme);
    K.storage.set("kyoshi.theme", theme);
  }
  K.setTheme = setTheme; // a pick that came in from another device (core/record.js)
  // A new device's first guess, by the hour, isn't a pick: it stays this device's own until one is made, here or elsewhere.
  function initTheme() {
    const saved = K.storage.get("kyoshi.theme"), hour = new Date().getHours();
    setTheme(saved === "dark" || saved === "light" ? saved : hour >= 19 || hour < 7 ? "dark" : "light");
    $("kThemeToggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      setTheme(next);
      K.record.setPref("theme", next); // the same on every device once they sync
    });
  }

  // --- Keys: Ctrl+9 toggles Developer Mode; the app on screen gets the rest first
  // (A.onKeydown returns true when it handled one); then Esc closes the top pop-up,
  // else Developer Mode. ---
  function wireKeys() {
    document.addEventListener("keydown", e => {
      if (e.ctrlKey && (e.key === "9" || e.code === "Digit9")) {
        e.preventDefault();
        K.dev.toggle();
        return;
      }
      if (e.key === "Escape" && menuOpen) return closeMenu(true);
      if (active && call(active, "onKeydown", e)) return;
      if (e.key === "Escape") {
        const top = K.modal.top();
        if (top) K.modal.requestDismiss(top);
        else if (K.dev.isOn()) K.dev.toggle();
      }
    });
  }

  // --- Every minute and whenever the page is back in view: each app catches up (a new day,
  // a dose coming due, a week to close out), in view or not, and so do the meetings (one whose
  // app came into use by sync starts counting) and the screen's wake lock (core/wakelock.js). ---
  function tick() {
    K.order.forEach(id => { if (K.apps[id].started) K.meetings.settle(K.apps[id]); });
    K.order.forEach(id => call(K.apps[id], "onTick"));
    K.meetings.render();
    renderSwitcher();
    K.backup.checkStorage();
    K.wakeLock.check();
  }
  K.tick = tick;

  // --- Another tab of Kyoshi saved (keys, or null for everything): the app whose keys changed
  // reloads them (once that tab's done), so this one never saves over it. Not in test mode,
  // which isn't saving. ---
  const reloadTimers = {};
  function onStoreChange(keys) {
    if (K.testMode) return;
    const touched = prefix => keys === null || keys.some(k => k.startsWith(prefix));
    K.order.forEach(id => { // the hidden Kyoshi app too: the bug log
      const A = K.apps[id];
      if (!A.started || !touched(A.store.prefix)) return;
      clearTimeout(reloadTimers[id]);
      reloadTimers[id] = setTimeout(() => {
        try {
          A.load();
          K.meetings.load(A);
          if (A.data) K.sync.loadMeta(A);
          call(A, "onReload");
          if (A === active) { K.meetings.render(); K.wakeLock.check(); }
          renderSwitcher();
        } catch (err) { console.error(`${A.meta.name} couldn't reload another tab's changes.`, err); }
      }, 50);
    });
  }
})(Kyoshi);
