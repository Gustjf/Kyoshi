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
