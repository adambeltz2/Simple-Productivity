# Notebook

**Live:** https://adambeltz2.github.io/Simple-Productivity/

A single dashboard of "projects" — each one an editable markdown note. The
dashboard numbers your **active** projects (1 through N, in the sort order
you choose), shows a preview of each note, and pulls every `- [ ] task` and
`#followup`-tagged line out of your notes into two always-visible rails on
the right. A header search box searches across every note, task, and
follow-up at once.

It's local-first and entirely client-side: there's no backend, no database,
no account required. Everything lives in this browser's `localStorage`.
Dropbox is an optional, add-on backup/sync layer — never the source of
truth.

A dark mode toggle (top right, next to the Dropbox button) switches
explicitly between light and dark and remembers your choice; it defaults to
your OS preference the first time. Hovering the ⓘ next to "Projects" shows
the task/follow-up syntax below as a quick reference.

This is a sibling project to [Simple Gantt](https://github.com/adambeltz2/Simple-Gantt)
and deliberately follows the same architecture: one static `index.html`,
vanilla JS, no build step, no framework.

## Running it

There's no build step. Any of these work:

```bash
# open it directly
open index.html

# or serve it (recommended -- matches how it behaves once deployed)
npx http-server -p 4173 .
```

## Note format

Each project is stored as a title, an `active` flag, a `sortOrder`, and a
markdown `body`. Within the body:

- **Tasks** use standard markdown checkbox syntax:
  ```markdown
  - [ ] Order walnut sample panel
  - [x] Email accountant re: missing 1099
  ```
- **Follow-ups** use a hashtag, anywhere on the line:
  ```markdown
  - Confirm oak vs walnut finish with Dana #followup
  ```
  (`#followup Confirm oak vs walnut finish with Dana` also works — the tag
  can lead or trail; everything else on the line is the follow-up text.)
- The first non-heading lines of the body become the dashboard preview.
- A `# Heading` on its own line is used as the title if one wasn't set
  explicitly.

Only **active** projects are numbered on the dashboard and feed the Tasks /
Follow-ups rails. Inactive projects are kept (collapsed behind a "Show N
inactive projects" toggle) rather than deleted, so archiving a project never
loses its notes.

## Dropbox sync

Dropbox integration is currently a **placeholder**: the OAuth flow, token
handling, and backup call are wired up (see `index.html`, search for
`DROPBOX_APP_KEY`), but no app key is registered yet, so clicking "Connect
Dropbox" surfaces a clear message instead of failing silently. To turn it
on:

1. Register an app at the [Dropbox App Console](https://www.dropbox.com/developers/apps)
   (scoped app, "App folder" access is enough for a single backup file).
2. Set its redirect URI to this app's deployed URL.
3. Put the app key into the `DROPBOX_APP_KEY` constant in `index.html`.

Once connected, "Connect Dropbox" backs up the full project list as JSON to
`/Notebook Backups/notebook.json` in the user's Dropbox. This browser's
`localStorage` remains authoritative; Dropbox is only ever a copy. See
`BACKLOG.md` for the remaining Dropbox work (restore UI, auto-backup,
multi-device conflict handling).

## Versioning

`APP_VERSION`, shown in the page footer, is bumped on every deploy-intended
change:

1. Bump `APP_VERSION` in `index.html` (semver: `MAJOR.MINOR.PATCH`).
2. Add an entry to `CHANGELOG.md` under a new version heading.
3. Commit both together.

## Testing

```bash
npm install
npx playwright test
```

Specs live in `tests/`. Per `CLAUDE.md`, any user-visible change to
`index.html` ships with a spec update in the same change — see
`CLAUDE.md` §5.

## Project docs

- `CLAUDE.md` — engineering conventions and the tech-stack decisions above.
- `CHANGELOG.md` — what shipped, by version.
- `BACKLOG.md` — deferred features, bugs, and debt (see `CLAUDE.md` §4 for
  the tagging convention).
