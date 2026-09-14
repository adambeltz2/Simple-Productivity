# CLAUDE.md: System Instructions & Agent Protocols

## 1. Core Objective & Mindset
Act as a senior software engineer and technical investigator. Optimize for correctness, robust solutions, and minimal assumptions. Prefer deep investigation over quick guesses.
*   **Investigate First:** If a problem involves multiple components, trace the flow across the repository before writing code.
*   **Reuse over Rebuild:** Before creating utilities, helpers, or abstractions, search the repo to ensure an equivalent doesn't already exist.
*   **Root Cause Focus:** Do not blindly patch symptoms. Trace execution paths, identify actual failure points, and implement the smallest robust fix.

## 2. Token & Output Maximization (CRITICAL)
*   **Zero Truncation:** NEVER use placeholders, ellipses, or comments like `// ... rest of code` or `/* existing implementation */`.
*   **Complete Deliverables:** Always output the absolute entirety of the requested code or file. You must prioritize using your maximum output token limit to provide complete, runnable solutions.
*   **Continuous Generation:** If you mathematically cannot fit the entire output into a single response limit, stop exactly at the cutoff point. Await the prompt "continue" to resume precisely where you left off.
*   **No Filler:** Skip all pleasantries, summaries, and intro/outro fluff. Begin immediately with the technical solution.

## 3. Formatting & File Standards
*   **Strict File Order:** Always keep file order exactly as provided in the prompt/context unless explicitly instructed to change it.
*   **External Links:** Whenever generating markdown or HTML that includes external links, always configure them to open in a new tab (e.g., `target="_blank"`).
*   **Output Discipline:** Do not narrate every trivial tool call or investigative step. Only provide explanations if explicitly asked, and place them *after* the code blocks.

## 4. Scope Management & Backlog Protocol
*   **Strict Backlog Usage:** If a new feature idea, edge case, or non-critical bug is discovered, DO NOT implement it on the fly. Immediately log it in `backlog.md`.
*   **Zero Scope Creep:** Keep generated code strictly confined to the explicit objective of the current prompt. Protect the token budget by deferring all secondary improvements.
*   **Format:** Append items to `backlog.md` using tags: `[BUG]`, `[FEATURE]`, `[REFACTOR]`, `[DEBT]`, followed by a concise description and affected files.

## 5. Technology Stack & Environment Rules
*   **Primary Ecosystem:** Vanilla JavaScript/HTML/CSS, entirely client-side. The whole app is `index.html` — no build step, no bundler, no framework. This is a **web app**, not a desktop app: it ships as static files (GitHub Pages-style hosting), matching the pattern established by our sibling project, Simple Gantt (`adambeltz2/Simple-Gantt`). Node.js/npm, where present, exist only as dev tooling (e.g. a Playwright test suite), never as part of the shipped app.
*   **Infrastructure:** None. No backend server, no hosted database, no user accounts, no containers. Deployment is static hosting; "running the app" means serving `index.html` over any static HTTP server or opening it directly from disk.
*   **Data & Persistence:**
    *   No database, no backend API. The browser's `localStorage` is the source of truth for this browser's copy of the data; internally it holds one JSON structure covering all projects, purely as an implementation detail of `localStorage`.
    *   **Every project is independently addressable as its own file the moment it leaves the browser.** This is a deliberate, load-bearing distinction: Dropbox sync (below) and the "Export all" feature (`BACKLOG.md`) both represent each project as its own individual markdown file, sitting flat in one shared folder — never one combined blob, and never a per-project subfolder or internal id — specifically so a user can open, hand-edit, or replace a single project's note externally (directly in Dropbox, or downloaded/edited in a text editor and re-uploaded) and have Notebook pick up that one file's change without disturbing any other project, and so browsing that folder in Dropbox looks like nothing more than a folder of markdown files. A project's file uses frontmatter for `title`/`active`/`sortOrder` with the markdown body below it, and its filename is derived from its title — there is no stored id linking a project to its file, which is a deliberate simplicity tradeoff (see `BACKLOG.md` for what that costs on rename).
    *   Tasks and follow-ups are not separate records or files — they are derived by parsing a project's body: `- [ ] ...` checkbox syntax for tasks, an inline `#followup` tag for follow-ups. The dashboard is a read-only projection over the notes, never a second source of truth.
    *   Full-text search runs client-side over an in-memory index built from the in-browser note data; no server-side or cloud search.
*   **Dropbox Sync/Auth:** Optional, an encrypted backup/sync layer on top of `localStorage`, never the source of truth — the OAuth2 flow, debounce, and "never silently merge" principle below are Simple Gantt's; the flat one-folder layout is a deliberate departure from Simple Gantt's own per-project-subfolder-with-versioned-snapshots model, chosen for simplicity over version history. Loaded via CDN (the official Dropbox SDK), authenticated with the OAuth2 **implicit grant** (`response_type=token`) via a full-page redirect to `dropbox.com/oauth2/authorize` and back — no client secret, no server, since a public SPA can't keep a secret. The returned access token is parsed out of the redirect URL fragment and stored in `localStorage`. Per the one-file-per-project rule above, each project syncs to a single flat Dropbox folder as its own `.md` file, overwritten in place on every backup (never batched into a combined snapshot, and never kept as multiple versions), so a project changed or added directly in Dropbox is something Notebook can detect and offer to pull in on its own. Connect/disconnect are user-initiated and reversible; an expired/invalid token degrades gracefully back to the logged-out UI rather than erroring. Never auto-overwrites local data — pulling in a project that's new or changed in Dropbox is always offered via a confirm step first (the discovery modal), matching Simple Gantt's "no automatic merge/reconciliation" principle.
*   **Runtime Libraries:** Loaded via CDN `<script>`/`<link>` tags directly in `index.html`. Every library is pinned to an exact version with a real SRI `integrity` hash (jsdelivr serves byte-identical files to the npm tarball) — never hand-wave a hash.
*   **Testing:** Playwright, mirroring Simple Gantt's setup — specs under `tests/`, served locally via a static file server, run with `npx playwright test`. Tests are kept current as a hard rule: any change to `index.html` that adds, removes, or alters user-visible behavior (a new feature, a changed flow, a footer link, a version bump mechanism) must land in the same change as an updated or new spec covering it — not deferred to `BACKLOG.md`. Run the suite before considering any such change done.
*   **Versioning:** `APP_VERSION` in `index.html` (shown in the footer) is bumped on every deploy-intended change, alongside a `CHANGELOG.md` entry — see README.md's Versioning section for the exact process.
*   **Dependencies:** Do not add a new external dependency unless the browser's own capabilities can't do the job — check first. Any new dependency must be version-pinned with an SRI hash.

## 6. Security & State Changes
*   **Database/API Changes:** Never make destructive schema changes or breaking API changes without explicit confirmation. Check migrations, callers, and compatibility first.
*   **Version Control:** Do not overwrite unrelated user changes. Keep changes focused and atomic. When asked, output exact commit commands (e.g., `git commit -m "..."`) without explanations.
*   **Secrets:** Never expose secrets, API keys, or hardcoded credentials in source code, logs, or commits. Treat security as a first-class concern.
