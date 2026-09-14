# Backlog

Deferred features, bugs, and debt, per `CLAUDE.md` §4. Tags: `[BUG]`,
`[FEATURE]`, `[REFACTOR]`, `[DEBT]`.

- `[FEATURE]` Register a real Dropbox app and set `DROPBOX_APP_KEY` in
  `index.html`. Currently a deliberate placeholder — see README.md's
  Dropbox section. _Affected: `index.html`._
- `[FEATURE]` Dropbox restore UI: list/preview available backups and let
  the user pull one down, mirroring Simple Gantt's "Projects found in
  Dropbox" flow. Right now only backup (upload) is wired up. _Affected:
  `index.html`._
- `[FEATURE]` Auto-backup to Dropbox on a debounce after edits, instead of
  requiring a manual trigger, once restore exists (auto-backup without
  restore risks masking data loss). _Affected: `index.html`._
- `[FEATURE]` Multi-device conflict handling for the Dropbox backup file —
  today `backupToDropbox()` always overwrites
  `/Notebook Backups/notebook.json`, which is fine for a single-device
  backup but would silently clobber a second device's notes. _Affected:
  `index.html`._
- `[FEATURE]` Rich markdown rendering in the note editor (currently a plain
  textarea) — at least a preview pane, ideally inline formatting.
  _Affected: `index.html`._
- `[FEATURE]` PWA support (manifest.json, service worker, app icons),
  matching Simple Gantt's `manifest.json` + `sw.js` + `icons/` pattern.
  _Affected: new `manifest.json`, `sw.js`, `icons/`._
- `[FEATURE]` CSV/JSON export-import of all projects, as a portable
  interchange format independent of Dropbox (matches Simple Gantt's CSV
  round-trip). _Affected: `index.html`._
- `[DEBT]` Search is a plain substring match over title/body; consider a
  lightweight fuzzy/ranked index (still client-side, still zero
  dependencies unless one is clearly justified per `CLAUDE.md` §5) once the
  note count grows enough for substring search to feel imprecise.
  _Affected: `index.html`._
- `[DEBT]` No drag-and-drop reordering of `sortOrder` yet — it's only
  editable as a raw number in the note editor. _Affected: `index.html`._
- `[DEBT]` No undo for project deletion beyond the browser confirm dialog.
  _Affected: `index.html`._
