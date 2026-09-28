/* Kyoshi · core/storage.js — localStorage, as K.storage.
 * Each app gets its own space as A.store (keys "kyoshi.<id>.<key>", made by scoped()).
 * K.storage.get/set/… are for core's own keys ("kyoshi.<key>": theme, bug reports…) and
 * for reading what the standalone apps left behind (legacy keys).
 * Storage can be blocked (strict privacy settings): Kyoshi then keeps working in memory and warns once.
 * In test mode (time travel) app data stays in memory, so nothing real changes until a reload;
 * core's keys (theme, bug reports) are still kept. */
(function (K) {
  "use strict";
  let warned = false;
  let shadow = null; // app keys -> value (null once removed), while in test mode

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Couldn't save to local storage.", e);
      if (!warned) alert("This browser isn't letting Kyoshi save your data, so it will be lost when the page closes. Use Export JSON to keep a copy.");
      warned = true;
    }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* nothing to clean up */ }
  }
  const parse = text => { try { return JSON.parse(text); } catch (e) { return null; } };
  const json = key => parse(get(key));

  // An app's own space: the same calls, with keys under prefix ("kyoshi.<id>."), held in memory in test mode.
  function scoped(prefix) {
    const key = k => prefix + k;
    const sget = k => (shadow && shadow.has(key(k)) ? shadow.get(key(k)) : get(key(k)));
    return {
      prefix, key,
      get: sget,
      set: (k, v) => (shadow ? void shadow.set(key(k), String(v)) : set(key(k), v)),
      remove: k => (shadow ? void shadow.set(key(k), null) : remove(key(k))),
      json: k => parse(sget(k))
    };
  }

  // Test mode: from now on, app data stays in memory.
  const startTest = () => { if (!shadow) shadow = new Map(); };

  K.storage = { get, set, remove, json, scoped, startTest };
})(Kyoshi);
