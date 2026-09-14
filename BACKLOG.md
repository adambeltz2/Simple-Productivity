# Backlog

Deferred features, bugs, and debt, per `CLAUDE.md` §4. Tags: `[BUG]`,
`[FEATURE]`, `[REFACTOR]`, `[DEBT]`.

- `[FEATURE]` "Export all": zip up every project as its own latest `.md`
  file (frontmatter for `title`/`active`/`sortOrder` + the markdown body,
  matching the note format documented in README.md) and download it as one
  `.zip`, so a user's data is portable outside Dropbox too. The browser has
  no native zip capability, so this is the one place a new CDN dependency
  is likely justified per `CLAUDE.md` §5 (e.g. a pinned, SRI-hashed
  `JSZip` build) — check first whether it can be done without one (a
  hand-rolled minimal zip writer, no compression) before reaching for a
  library. Triggering a save of the generated blob also needs a real
  `<a download>` click, which only works for an end user in the deployed
  app, not inside an Artifact preview. _Affected: `index.html`._
- `[FEATURE]` CSV/JSON export-import of all projects, as a portable
  interchange format independent of Dropbox (matches Simple Gantt's CSV
  round-trip). _Affected: `index.html`._
- `[DEBT]` A file renamed directly in Dropbox (not through the app) isn't
  matched back to its project: discovery only ever matches a file to a
  known project by filename, and a renamed file's new name won't match, so
  it's offered as a brand-new project — confirming the import creates a
  duplicate rather than updating the existing one. (Renaming a project's
  *title* through the app is handled correctly: `performDropboxBackup()`
  tracks the actual last-synced filename per project and cleans up the
  stale file on the next backup after a title change — this item is only
  about an out-of-band rename done in Dropbox itself.) _Affected:
  `index.html`._
- `[DEBT]` No merge across devices: each Dropbox backup overwrites that
  project's file in place, so a device pushing a backup always wins outright
  over what's already there — no version history to fall back on, and two
  devices editing the *same* project between backups can't have their
  changes combined automatically. _Affected: `index.html`._
- `[DEBT]` `performDropboxBackup()` re-uploads every real (non-sample)
  local project on each auto-backup, even ones that haven't changed since
  the last one — fine at personal-notebook scale, but wasteful as the
  project count grows. Track a per-project dirty flag (or a body hash) and
  only back up what actually changed. _Affected: `index.html`._
- `[DEBT]` Search is a plain substring match over title/body; consider a
  lightweight fuzzy/ranked index (still client-side, still zero
  dependencies unless one is clearly justified per `CLAUDE.md` §5) once the
  note count grows enough for substring search to feel imprecise.
  _Affected: `index.html`._
- `[DEBT]` No drag-and-drop reordering of `sortOrder` yet — it's only
  editable as a raw number in the note editor. _Affected: `index.html`._
- `[DEBT]` No undo for project deletion beyond the browser confirm dialog
  — and since deleting a project now also deletes its Dropbox file when
  connected, this is more consequential than it used to be.
  _Affected: `index.html`._
