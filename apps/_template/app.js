/* Template · app.js — registers the app with Kyoshi, plus its constants, state (A.S) and small helpers.
 * Loads first of the app's files: the others destructure what's here at the top, and call
 * functions from each other as A.name(). File map and data: apps/template/CLAUDE.md.
 * New app: copy apps/_template/ to apps/<id>/ and rename template/Template everywhere (root CLAUDE.md). */
(function (K) {
  "use strict";

  const A = K.register({
    id: "template",                        // folder name, storage prefix, URL #id, CSS scope .app-template
    name: "Template",                      // the header and the switcher
    title: "Template — What It Does",      // the browser tab
    subtitle: "One line about what this app is for.",
    width: 780,                            // page width in px (Bosco 780, Momo 1180)
    // A regular meeting with you (core/meetings.js), only for an app reviewed less often than daily (Iroh, say):
    // meetings: [{ id: "review", title: "What to look over", every: "month", minutes: 10 }],
    // The "list-todo" icon from Lucide (ISC license), in a color of its own for tabs and the switcher.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/></svg>'
  });

  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1,
    MAX_TEXT: 200
  });

  Object.assign(A.S, {
    items: [] // { id, text, deleted, at, u }: deleted ones stay as markers so sync can't bring them back; at = added, u = last changed
  });

  const liveItems = () => A.S.items.filter(i => !i.deleted);

  Object.assign(A, { liveItems });
})(Kyoshi);
