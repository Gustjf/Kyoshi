/* Kyoshi · core/shell.js — the shell: app registry, header & switcher, theme, start-up.
 * K.register(meta) → A, an app's namespace (the app contract is in CLAUDE.md).
 * K.start() (the last line of index.html) makes each app's root from A.markup, loads and
 * starts every app, shows one (the URL's #id, else the last used), then runs the shared
 * keyboard, minute tick and other-tab reloads.
 * Only the app on screen is in the page: the others' roots are kept aside (detached) but
 * keep running — so ids only need to be unique within an app, and A.$ looks only inside it. */
(function (K) {
  "use strict";
  const { esc } = K.util;
  const $ = id => document.getElementById(id);
  const TICK_MS = 60000;
  let active = null;    // the app on screen
  let menuOpen = false; // the switcher's list of apps

  K.register = meta => {
    const A = {
      id: meta.id, meta, S: {}, root: null, started: false, subtitle: meta.subtitle || "",
      store: K.storage.scoped(`kyoshi.${meta.id}.`),
      $: id => A.root.querySelector(`#${CSS.escape(id)}`),
      isActive: () => active === A,
      // A listener on document/window that only fires while this app is on screen.
      listen: (target, type, fn, opts) => target.addEventListener(type, e => { if (active === A) fn(e); }, opts),
      changed: (unsaved = true) => K.sync.changed(A, unsaved),
      setSubtitle: text => { A.subtitle = text; if (active === A) $("kAppSubtitle").textContent = text; },
      refreshDev: () => K.dev.refreshTools(A)
    };
    K.apps[meta.id] = A;
    K.order.push(meta.id);
    return A;
  };
  K.active = () => active;

  // --- Starting ---
  K.start = () => {
    initTheme();
    K.backup.init();
    K.bugs.init();
    K.order.forEach(id => startApp(K.apps[id]));
    K.dev.init();
    wireSwitcher();
    wireKeys();
    window.addEventListener("storage", onStorage);
    window.addEventListener("hashchange", () => show(K.apps[location.hash.slice(1)]));
    setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
    show(K.apps[location.hash.slice(1)] || K.apps[K.storage.get("kyoshi.lastApp")] || K.apps[K.order[0]]);
    K.sync.init();
  };

  // Makes the app's root, then loads (A.load), gets its sync identity and starts it (A.init).
  // An app that fails shows why instead, and the others carry on.
  function startApp(A) {
    A.root = document.createElement("div");
    A.root.className = `app-root app-${A.id}`;
    A.root.innerHTML = A.markup || "";
    try {
      if (A.data) K.backup.mount(A);
      if (A.load) A.load();
      if (A.data) K.sync.loadMeta(A);
      if (A.init) A.init();
      A.started = true;
    } catch (err) {
      console.error(`${A.meta.name} couldn't start.`, err);
      A.root.innerHTML = `<section><h2>${esc(A.meta.name)} couldn't start</h2><p class="note">Something went wrong while loading it. Use Report a bug below: the report includes the error.</p></section>`;
    }
  }

  // Puts an app on screen: its root, header, tab title & icon, width, and #id in the URL.
  function show(A) {
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
    $("kFooterName").textContent = A.meta.name;
    $("kVersionTag").textContent = A.VERSION ? `v${A.VERSION}` : "";
    document.title = A.meta.title || A.meta.name;
    $("kFavicon").href = `data:image/svg+xml,${encodeURIComponent(A.meta.icon)}`;
    K.storage.set("kyoshi.lastApp", A.id);
    if (location.hash.slice(1) !== A.id) try { history.replaceState(null, "", `#${A.id}`); } catch (err) { /* some file:// setups */ }
    call(A, "onShow");
    renderSwitcher();
    K.dev.refresh();
  }
  K.show = id => show(K.apps[id]);

  // Runs an app's hook, if it has one and started; a failing hook is logged, not fatal.
  function call(A, hook, ...args) {
    if (!A.started || !A[hook]) return undefined;
    try { return A[hook](...args); } catch (err) { console.error(`${A.meta.name}'s ${hook} failed.`, err); return undefined; }
  }

  // --- Switcher: one button (the app on screen's icon) opening a list of every app ---
  // What an app says needs you ("" if nothing): a dot on its icon, and on the button for others.
  const attention = A => call(A, "attention") || "";

  function renderSwitcher() {
    if (!active) return;
    const waiting = K.order.map(id => K.apps[id]).filter(A => A !== active && attention(A));
    $("kSwitchIcon").innerHTML = active.meta.icon;
    $("kSwitchDot").hidden = !waiting.length;
    $("kSwitchBtn").title = waiting.length ? `Switch app (${waiting.map(A => `${A.meta.name}: ${attention(A)}`).join("; ")})` : "Switch app";
    $("kSwitchBtn").setAttribute("aria-label", `${active.meta.name}. Switch app${waiting.length ? `, ${waiting.length} waiting` : ""}`);
    if (menuOpen) renderMenu();
  }
  K.refreshSwitcher = renderSwitcher;

  function renderMenu() {
    const focused = document.activeElement && document.activeElement.dataset.app;
    $("kSwitchMenu").innerHTML = K.order.map(id => {
      const A = K.apps[id], why = attention(A), cur = A === active;
      return `<button type="button" class="switch-item${cur ? " current" : ""}" role="menuitem" data-app="${id}"${why ? ` title="${esc(why)}"` : ""}${cur ? ' aria-current="true"' : ""}>` +
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

  // --- Theme (one for every app) ---
  const applyTheme = theme => { document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light"; };
  function setTheme(theme) {
    applyTheme(theme);
    K.storage.set("kyoshi.theme", theme);
  }
  function initTheme() {
    const saved = K.storage.get("kyoshi.theme"), hour = new Date().getHours();
    setTheme(saved === "dark" || saved === "light" ? saved : hour >= 19 || hour < 7 ? "dark" : "light");
    $("kThemeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
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
  // a dose coming due, a week to close out), in view or not. ---
  function tick() {
    K.order.forEach(id => call(K.apps[id], "onTick"));
    renderSwitcher();
  }
  K.tick = tick;

  // --- Another tab of Kyoshi saved: the app whose keys changed reloads them (once that
  // tab's done), so this one never saves over it. Not in test mode, which isn't saving. ---
  const reloadTimers = {};
  function onStorage(e) {
    if (K.testMode) return;
    if (e.key === "kyoshi.theme") return applyTheme(e.newValue);
    if (e.key === "kyoshi.bugReports") { K.bugs.load(); return K.dev.refresh(); }
    K.order.forEach(id => {
      const A = K.apps[id];
      if (!A.started || (e.key !== null && !e.key.startsWith(A.store.prefix))) return;
      clearTimeout(reloadTimers[id]);
      reloadTimers[id] = setTimeout(() => {
        try {
          A.load();
          if (A.data) K.sync.loadMeta(A);
          call(A, "onReload");
          renderSwitcher();
        } catch (err) { console.error(`${A.meta.name} couldn't reload another tab's changes.`, err); }
      }, 50);
    });
  }
})(Kyoshi);
