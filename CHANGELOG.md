# Changelog

All notable changes to this project are documented here. Versions follow
`MAJOR.MINOR.PATCH`; see the "Versioning" section of `README.md` for the
bump process.

## [0.8.0] - 2026-09-14

### Fixed
- Dashboard note previews could show a weak, uninformative trailing line
  (e.g. a lone "file" note left over after tasks and follow-ups were pulled
  out) instead of a more meaningful heading the note also had (e.g.
  "9/14/2026") whenever the project had its own explicit title — the
  heading was previously discarded once any other prose line existed.
  `deriveFromBody()` now always leads the preview with that heading when it
  differs from the title, filling any remaining preview lines with prose.
- `initDropboxFromRedirect()` only pushed/checked Dropbox right after a
  fresh OAuth (re)authenticate, never on a plain reload with an
  already-saved token. If an edit's auto-backup debounce never fired (the
  tab closed first), that edit could sit unsynced in `localStorage`
  indefinitely. Resuming an already-connected session on an ordinary reload
  now always pushes a catch-up backup too.

### Changed
- Shortened the auto-backup debounce from 60 seconds to 15: "Dropbox
  connected · backup pending" no longer lingers for a full minute after an
  edit (or a task toggle) before a backup actually goes out.

## [0.7.0] - 2026-09-14

### Added
- Visible sync status: the Dropbox dot now pulses while a backup is
  actually in flight (distinct from the existing static amber "pending"
  state while waiting out the debounce), and the status text shows "synced
  Xm ago" once idle, tracking a new persisted last-synced timestamp.
- Renaming a project's title now renames its Dropbox file too:
  `performDropboxBackup()` tracks the exact filename each project last
  synced to and deletes the stale file after uploading under the new name,
  instead of leaving it behind. This also resolves importing a
  generically-named file (e.g. a `test.md` dropped straight into Dropbox)
  — give it a real title and save, and its file becomes
  `the-real-title.md`; `test.md` doesn't linger.

## [0.6.0] - 2026-09-14

### Fixed
- Onboarding sample projects (Kitchen Remodel, etc., seeded into a fresh
  browser with no existing data) were being backed up to Dropbox like real
  projects. Every fresh/private-browsing session re-seeded them, so they
  kept reappearing in Dropbox alongside real data. Sample projects are now
  tagged and skipped by every backup; editing one (or importing real data
  from Dropbox) makes it real going forward, and importing real data from
  Dropbox auto-clears whatever samples were still untouched, so there's
  nothing to manually purge.
- Dashboard note previews joined separate body lines (e.g. two bullet
  points) with a space instead of a line break, so a preview like "Note 1
  Note 2" read as one run-on line instead of matching how the same content
  looks in the editor's own Preview tab.
- `performDropboxBackup()` used `Promise.all()`, so a single failed upload
  (rate limiting, a transient network error) marked the *entire* batch as
  failed even though every other project's upload had already succeeded.
  Switched to `Promise.allSettled()`: a partial failure is now reported
  as exactly that (e.g. "failed for 1 of 6 projects") and named in the
  console, instead of one bad upload masking a mostly-successful backup.

### Added
- Deleting a project now also deletes its file from Dropbox, when
  connected (previously it only ever removed the local copy, silently
  leaving an orphaned file behind).

## [0.5.1] - 2026-09-14

### Fixed
- Editing a project's `.md` file directly in Dropbox was invisible to
  Notebook: discovery only ever checked for filenames it didn't already
  know, never for changed content of a file whose name matched a known
  project. "Check Dropbox" (and a fresh connect) now downloads and
  compares every matching file's content too, and offers a changed one
  through the same discovery checklist, tagged "changed" — applying it
  updates that one project in place rather than duplicating it.

## [0.5.0] - 2026-09-14

### Changed
- Simplified Dropbox sync: dropped the per-project subfolder + internal id
  + versioned-snapshots model from v0.4.0 in favor of one flat folder
  (`/Notebook Projects/`) with a single `.md` file per project, named from
  its title and overwritten in place on every backup. Browsing that folder
  in Dropbox now looks like nothing more than a folder of markdown files.
- Removed the "Dropbox history" per-project version browser along with it
  (no more version history to browse). Discovery ("Check Dropbox" /
  importing a project found only in Dropbox) still works, now matching by
  filename instead of a stored id.

### Known tradeoff
- Renaming a project's title changes which Dropbox file it backs up to
  next; the file under the old name is left behind rather than renamed.
  See `BACKLOG.md`.

## [0.4.0] - 2026-09-14

### Added
- Live markdown preview in the note editor: a Write/Preview tab toggle
  renders headings, bold/italic, links, task/bullet/numbered lists, and
  `#followup` tags, instead of only showing raw markdown source.
- Dropbox sync reworked to a one-file-per-project model: each project now
  syncs to its own folder in Dropbox (`/Notebook Projects/<id>/`), as its
  own timestamped `.md` snapshot (frontmatter + body) — never one combined
  file — so a project's note can be edited directly in Dropbox, or
  downloaded and edited externally, and picked up by Notebook without
  touching any other project.
- "Check Dropbox" (topbar): discovers projects that exist in Dropbox but
  aren't known to this browser yet, and offers to import them via a
  checklist (never silently).
- "Dropbox history" (inside the note editor): browse and restore any of a
  single project's kept snapshots (most recent 25, pruned automatically),
  scoped to just that project.
- On connect (or reconnecting after a session expires), Notebook now both
  pushes local projects to Dropbox and checks for anything Dropbox-only,
  immediately rather than waiting out the debounce.

### Fixed
- `- [ ] Order walnut sample panel`-only notes with no other prose line
  after removing tasks/follow-ups from consideration used to show an
  incorrect "(empty note)" dashboard preview even when the note's heading
  had real content; the heading is now shown as a fallback in that case.
  A related regression this introduced (repeating the title in the preview
  when the body's heading just duplicates it) is fixed too.

### Removed
- The single combined-JSON-blob Dropbox backup model (one file holding
  every project) from v0.2.1–v0.3.0, superseded by the one-file-per-project
  model above.

## [0.3.0] - 2026-09-14

### Added
- Dropbox is now actually connectable: a real app key is registered and
  set as `DROPBOX_APP_KEY` in `index.html`. The app secret was
  intentionally never stored anywhere in the repo — the OAuth2 implicit
  grant this app uses only needs the app key client-side.

### Changed
- Clicking "Connect Dropbox" now always opens the explainer modal instead
  of alerting that it's unconfigured.

## [0.2.1] - 2026-09-14

### Added
- GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploying
  `index.html` to GitHub Pages on every push to `main`.
- Live URL added to `README.md`: https://adambeltz2.github.io/Simple-Productivity/

## [0.2.0] - 2026-09-14

### Added
- Dark mode toggle in the topbar: explicit on/off, persisted in
  `localStorage`, defaulting to the OS preference the first time.
- Hover-over info icon (ⓘ) next to "Projects" documenting the task and
  follow-up markdown syntax at a glance.

### Changed
- Follow-up syntax switched from the `!followup: ...` line marker to an
  inline `#followup` hashtag (leading or trailing), to read like ordinary
  note-taking markdown rather than a bespoke prefix. Existing notes using
  the old marker will need to be updated manually.

## [0.1.0] - 2026-09-14

### Added
- Initial dashboard: numbered grid of active projects (sorted manually via
  `sortOrder`), with inactive projects collapsed behind a toggle.
- Each project is an editable markdown note (`index.html` modal editor)
  with `title`, `active`, and `sortOrder` fields plus a markdown body.
- Tasks (`- [ ] ...`) and follow-ups (`!followup: ...`) are parsed out of
  note bodies automatically and surfaced in two dashboard rails; toggling a
  task checkbox writes the change back into the note's markdown.
- Header search across every note title, body, task, and follow-up at once.
- `localStorage`-backed persistence; no backend, no build step.
- Dropbox backup placeholder: OAuth2 implicit-grant flow, token storage,
  and a backup call are wired up, gated behind an unset `DROPBOX_APP_KEY`
  until a real app is registered (see `BACKLOG.md`).
- Footer with app version, a GitHub link, and a Buy Me a Coffee link (both
  open in a new tab).
- Playwright test suite (`tests/dashboard.spec.js`) covering the dashboard,
  search, task persistence, project creation, and the footer.
- `CLAUDE.md`, `README.md`, `BACKLOG.md` project documentation.
