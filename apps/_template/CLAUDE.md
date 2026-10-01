# Template — what it does (a Kyoshi app)
One paragraph: what the app is for and its core idea. Rules, versioning and the app contract: the root `CLAUDE.md`.
Version & changelog: `changelog.js`.

This folder is the starter for new apps and isn't loaded. It's a tiny working list app that shows every
part of the contract: storage, backups, sync merging (with delete markers), and the hooks.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, width); constants; state `A.S`; small helpers |
| `markup.js` | the page, with the Backup & sync section |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning, backups and sync merge (`A.data`) |
| `render.js` | `renderAll` |
| `events.js` | `A.init` wiring and the hooks (`onKeydown`, `onReload`, `bugState`) |
| `template.css` | styles under `.app-template` |

## State (`A.S`)
`items` [{ id, text, deleted, at, u }] — deleted ones stay as markers; `at` is when it was added (the list's order), `u` when it last changed (the later wins in sync).

## Storage (`A.store`) and backups
Key: `items` (plus core's `sync`). Backup JSON: `{ schemaVersion: 1, appVersion, items }`.

## Adding a new app from this template
1. Copy this folder to `apps/<id>/` (`<id>`: lowercase letters and digits, from a letter, not used yet); rename `template`/`Template` → `<id>`/`<Name>` in every file (incl. `.app-template`, `template.css` → `<id>.css`).
2. In `app.js` set name, tab title, subtitle, page width and icon (a Lucide SVG with a stroke color, like Bosco's and Momo's).
3. Add its `<link>`/`<script>` tags to `index.html` (app.js first, events.js last; the switcher lists apps in that order), then give every link a new build stamp.
4. Rewrite this `CLAUDE.md` for the app (purpose, file map, data model). Start its changelog at 1.000 and add a line to Kyoshi's changelog.
