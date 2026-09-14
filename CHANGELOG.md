# Changelog

All notable changes to this project are documented here. Versions follow
`MAJOR.MINOR.PATCH`; see the "Versioning" section of `README.md` for the
bump process.

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
