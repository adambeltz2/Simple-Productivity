# Changelog

All notable changes to this project are documented here. Versions follow
`MAJOR.MINOR.PATCH`; see the "Versioning" section of `README.md` for the
bump process.

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
