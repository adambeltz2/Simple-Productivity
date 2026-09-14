// @ts-check
const { test, expect } = require('@playwright/test');

// No global beforeEach here on purpose: the Dropbox tests below navigate to
// a URL that differs from a plain '/index.html' load only by a #hash, and
// Chromium treats that as a same-document navigation (no real reload, no
// re-run of addInitScript) when it follows an earlier navigation to the
// same path -- so every test does its own single, explicit goto() instead.

test('seeds sample projects and numbers only the active ones', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#activeCount')).toHaveText('4 active');
  const numbers = await page.locator('.project-card:not(.inactive) .project-num').allTextContents();
  expect(numbers).toEqual(['1', '2', '3', '4']);
});

test('search filters projects and the task/follow-up rails together', async ({ page }) => {
  await page.goto('/index.html');
  await page.fill('#searchInput', 'walnut');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('#tasksList .rail-item')).toHaveCount(1);
  await expect(page.locator('#followupsList .rail-item')).toHaveCount(1);
});

test('toggling a task checkbox persists into the note body', async ({ page }) => {
  await page.goto('/index.html');
  const firstTaskCheckbox = page.locator('#tasksList .rail-item input[type="checkbox"]').first();
  await expect(firstTaskCheckbox).not.toBeChecked();
  await firstTaskCheckbox.check();

  await page.reload();
  const reloadedCheckbox = page.locator('#tasksList .rail-item.done input[type="checkbox"]').first();
  await expect(reloadedCheckbox).toBeChecked();
});

test('creating a project shows up numbered on the dashboard', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('#newProjectBtn');
  await page.fill('#editTitle', 'Test Project From Playwright');
  await page.fill('#editBody', '# Test Project From Playwright\n\nSome body text.\n\n- [ ] a task\n');
  await page.click('#saveProjectBtn');

  await expect(page.locator('.project-card', { hasText: 'Test Project From Playwright' })).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('5 active');
});

test('Dropbox connect opens the explainer modal and links to the real OAuth authorize URL', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox not connected');

  await page.click('#dbxBtn');
  await expect(page.locator('#dropboxInfoBackdrop')).toHaveClass(/active/);

  // Intercept instead of following the redirect -- Dropbox itself is out of scope here.
  await page.route('https://www.dropbox.com/oauth2/authorize**', (route) => route.abort());
  const [request] = await Promise.all([
    page.waitForRequest('https://www.dropbox.com/oauth2/authorize**'),
    page.click('#dbxInfoContinue'),
  ]);
  const url = new URL(request.url());
  expect(url.searchParams.get('client_id')).toBe('vfcwmj0eu2kdiud');
  expect(url.searchParams.get('response_type')).toBe('token');
  expect(url.searchParams.get('redirect_uri')).toBeTruthy();
});

test('Dropbox explainer modal can be dismissed without connecting', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('#dbxBtn');
  await expect(page.locator('#dropboxInfoBackdrop')).toHaveClass(/active/);
  await page.click('#dbxInfoCancel');
  await expect(page.locator('#dropboxInfoBackdrop')).not.toHaveClass(/active/);
  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox not connected');
});

test('info icon documents the #followup and task syntax', async ({ page }) => {
  await page.goto('/index.html');
  const infoIcon = page.locator('.info-icon');
  await expect(infoIcon).toHaveAttribute('title', /#followup/);
  await expect(infoIcon).toHaveAttribute('title', /- \[ \] do the thing/);
});

test('dark mode toggle flips the theme attribute and persists across reload', async ({ page }) => {
  await page.goto('/index.html');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.click('#themeToggleBtn');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#themeToggleBtn')).toHaveText(/Light mode/);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.click('#themeToggleBtn');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('footer shows a version number and opens GitHub / Buy Me a Coffee in new tabs', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#appVersion')).toHaveText(/^v\d+\.\d+\.\d+$/);

  const githubLink = page.locator('footer a', { hasText: 'GitHub' });
  await expect(githubLink).toHaveAttribute('href', 'https://github.com/adambeltz2/Simple-Productivity');
  await expect(githubLink).toHaveAttribute('target', '_blank');

  const coffeeLink = page.locator('footer a', { hasText: 'Buy me a coffee' });
  await expect(coffeeLink).toHaveAttribute('href', 'https://www.buymeacoffee.com/adambeltz');
  await expect(coffeeLink).toHaveAttribute('target', '_blank');
});

// Shared setup for the Dropbox tests below: blocks the real SDK (its
// <script> tag would otherwise execute after addInitScript's stub and
// clobber it, once wherever this runs can actually reach the real CDN) and
// installs a fake Dropbox.Dropbox client backed by an in-memory virtual
// filesystem (window.__dbxFiles: flat list of {path_lower, name,
// client_modified, contents}), so filesListFolder resolves real
// parent/child relationships the way Dropbox actually does -- folders are
// inferred from file paths, not stored separately. Seed window.__dbxFiles
// with pre-existing project files (frontmatter + body, matching
// serializeProjectMarkdown() in index.html) before navigating; an
// empty/nonexistent folder correctly rejects with path/not_found, matching
// real Dropbox. Each of these tests does its own single, explicit
// goto() with the #access_token hash already in the URL -- see the note
// at the top of this file on why that must be the only navigation.

async function stubDropboxSdk(page) {
  await page.route('https://cdn.jsdelivr.net/npm/dropbox**', (route) => route.abort());
  await page.addInitScript(() => {
    window.__uploads = [];
    window.__deletes = [];
    window.__dbxFiles = window.__dbxFiles || [];

    function norm(p) { return p.toLowerCase().replace(/\/+$/, ''); }

    function childrenOf(parentPath) {
      const parent = norm(parentPath);
      const seenFolders = new Set();
      const result = [];
      window.__dbxFiles.forEach((f) => {
        const full = norm(f.path_lower);
        if (!full.startsWith(parent + '/')) return;
        const rest = full.slice(parent.length + 1);
        const seg = rest.split('/')[0];
        if (rest.includes('/')) {
          if (!seenFolders.has(seg)) { seenFolders.add(seg); result.push({ '.tag': 'folder', name: seg, path_lower: `${parent}/${seg}` }); }
        } else {
          result.push({ '.tag': 'file', name: f.name, path_lower: f.path_lower, client_modified: f.client_modified });
        }
      });
      return result;
    }

    window.Dropbox = {
      Dropbox: function DropboxStub() {
        this.filesUpload = (args) => {
          window.__uploads.push(args);
          window.__dbxFiles.push({
            path_lower: args.path.toLowerCase(),
            name: args.path.split('/').pop(),
            client_modified: new Date().toISOString(),
            contents: args.contents,
          });
          return Promise.resolve({});
        };
        this.filesListFolder = (args) => {
          const entries = childrenOf(args.path);
          if (!entries.length) return Promise.reject({ error: { error_summary: 'path/not_found/...' }, status: 409 });
          return Promise.resolve({ result: { entries, has_more: false, cursor: '' } });
        };
        this.filesListFolderContinue = () => Promise.resolve({ result: { entries: [], has_more: false } });
        this.filesDownload = (args) => {
          const file = window.__dbxFiles.find((f) => f.path_lower === args.path.toLowerCase());
          const blob = new Blob([file ? file.contents : ''], { type: 'text/markdown' });
          return Promise.resolve({ result: { fileBlob: blob } });
        };
        this.filesDeleteV2 = (args) => {
          window.__deletes.push(args.path);
          window.__dbxFiles = window.__dbxFiles.filter((f) => f.path_lower !== args.path.toLowerCase());
          return Promise.resolve({});
        };
      },
    };
  });
}

test('connecting pushes every local project to Dropbox as its own file, each in its own folder', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');

  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox connected');
  // 6 seeded sample projects (4 active + 2 inactive) -- every one backs up, not just active ones.
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6);
  const paths = await page.evaluate(() => window.__uploads.map((u) => u.path));
  const folders = new Set(paths.map((p) => p.replace(/\/[^/]+\.md$/, '')));
  expect(folders.size).toBe(6); // each project got its own folder
  expect(paths.every((p) => /^\/Notebook Projects\/.+\/.+\.md$/.test(p))).toBe(true);
});

test('a project only in Dropbox is offered via the discovery modal, and Not Now leaves it unimported', async ({ page }) => {
  await stubDropboxSdk(page);
  await page.addInitScript(() => {
    window.__dbxFiles = [{
      path_lower: '/notebook projects/remote-proj-1/2026-01-01_120000.md',
      name: '2026-01-01_120000.md',
      client_modified: '2026-01-01T12:00:00Z',
      contents: '---\ntitle: "Remote Only Project"\nactive: true\nsortOrder: 1\n---\n# Remote Only Project\n',
    }];
  });

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');

  await expect(page.locator('#dropboxDiscoveryBackdrop')).toHaveClass(/active/);
  await expect(page.locator('#dropboxDiscoveryList')).toContainText('Remote Only Project');

  await page.click('#dbxDiscoverySkip');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).not.toHaveClass(/active/);
  await expect(page.locator('.project-card', { hasText: 'Remote Only Project' })).toHaveCount(0);
});

test('importing a discovered project adds it locally, and it is not offered again next connect', async ({ page }) => {
  await stubDropboxSdk(page);
  await page.addInitScript(() => {
    window.__dbxFiles = [{
      path_lower: '/notebook projects/remote-proj-1/2026-01-01_120000.md',
      name: '2026-01-01_120000.md',
      client_modified: '2026-01-01T12:00:00Z',
      contents: '---\ntitle: "Remote Only Project"\nactive: true\nsortOrder: 1\n---\n# Remote Only Project\n',
    }];
  });

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).toHaveClass(/active/);
  await page.click('#dbxDiscoveryImport');

  await expect(page.locator('.project-card', { hasText: 'Remote Only Project' })).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('5 active');

  // Re-checking manually should find nothing new now that it's known locally.
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#dbxCheckBtn');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).not.toHaveClass(/active/);
});

test('a project\'s Dropbox history is scoped to that project, and restoring one replaces only it', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6); // initial connect push

  // Open the first project (uploaded first during the connect push, in the
  // same order as `projects`) and seed an older snapshot directly into its
  // now-known folder (ensureDropboxProjectId ran during the connect push).
  await page.click('.project-card >> nth=0');
  const dropboxProjectId = await page.evaluate(() => window.__uploads[0].path.split('/')[2]);
  await page.evaluate((folderId) => {
    window.__dbxFiles.push({
      path_lower: `/notebook projects/${folderId}/2020-01-01_000000.md`.toLowerCase(),
      name: '2020-01-01_000000.md',
      client_modified: '2020-01-01T00:00:00Z',
      contents: '---\ntitle: "Old Version Of This Project"\nactive: true\nsortOrder: 1\n---\nOld body text.\n',
    });
  }, dropboxProjectId);

  await page.click('#editHistoryBtn');
  await expect(page.locator('#dropboxVersionsBackdrop')).toHaveClass(/active/);
  await expect(page.locator('#dropboxVersionsList .rail-item')).toHaveCount(2); // the initial connect push + the seeded older one

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#dropboxVersionsList .rail-item', { hasText: '1/1/2020' }).getByRole('button', { name: 'Restore' }).click();

  await expect(page.locator('.project-card', { hasText: 'Old Version Of This Project' })).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('4 active'); // unchanged -- no project was added or removed
});

test('old backups beyond the kept limit are pruned per project after a new one is pushed', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6);

  const dropboxProjectId = await page.evaluate(() => window.__uploads[0].path.split('/')[2]);
  await page.evaluate((folderId) => {
    for (let i = 0; i < 25; i++) {
      window.__dbxFiles.push({
        path_lower: `/notebook projects/${folderId}/seed-${i}.md`.toLowerCase(),
        name: `seed-${i}.md`,
        client_modified: new Date(2020, 0, i + 1).toISOString(),
        contents: '---\ntitle: "x"\nactive: true\nsortOrder: 1\n---\n',
      });
    }
  }, dropboxProjectId);
  // 26 snapshots now exist for this one project (1 from connecting + 25 seeded), one over MAX_BACKUPS.

  await page.evaluate(() => window.__notebook.performDropboxBackup(true));

  await page.waitForFunction((folderId) => {
    const count = window.__dbxFiles.filter((f) => f.path_lower.startsWith(`/notebook projects/${folderId.toLowerCase()}/`)).length;
    return count === 25;
  }, dropboxProjectId);
});

test('edits are debounced before backing up, not pushed on every change', async ({ page }) => {
  await stubDropboxSdk(page);
  await page.clock.install();

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6); // the initial connect push, one per project

  await page.locator('#tasksList .rail-item input[type="checkbox"]').first().check();
  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox connected · backup pending');
  // No new uploads yet -- the edit's backup hasn't fired.
  expect(await page.evaluate(() => window.__uploads.length)).toBe(6);

  await page.clock.fastForward(60000);
  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox connected');
  // One more push of all 6 projects (performDropboxBackup backs up everything, not just the edited one).
  expect(await page.evaluate(() => window.__uploads.length)).toBe(12);
});

test('note preview falls back to body content (not "(empty note)") when the only prose line is a heading and the project has an explicit title', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('#newProjectBtn');
  await page.fill('#editTitle', 'MDM: Product');
  await page.fill('#editBody', '# 9/14/2026\n- [ ] Task 1\n- [ ] Task 2 #followup\n\n- Notes #followup\n');
  await page.click('#saveProjectBtn');

  const card = page.locator('.project-card', { hasText: 'MDM: Product' });
  await expect(card.locator('.project-preview')).toHaveText('9/14/2026');
  await expect(card.locator('.project-preview')).not.toHaveText('(empty note)');
});

test('note preview does not repeat the title when the body opens with a heading that duplicates it', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('#newProjectBtn');
  await page.fill('#editTitle', 'Kitchen Remodel');
  await page.fill('#editBody', '# Kitchen Remodel\n\nCabinet quote came in at $14,200.\n');
  await page.click('#saveProjectBtn');

  const card = page.locator('.project-card', { hasText: 'Kitchen Remodel' }).last();
  await expect(card.locator('.project-preview')).toHaveText('Cabinet quote came in at $14,200.');
});

test('the editor\'s Preview tab renders markdown instead of raw source', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('#newProjectBtn');
  await page.fill('#editBody', '# Heading\n\nSome **bold** text.\n\n- [ ] an open task\n- [x] a done task\n- a bullet #followup\n');

  await page.click('#editTabPreview');
  await expect(page.locator('#editBody')).toBeHidden();
  await expect(page.locator('#editPreview')).toBeVisible();
  await expect(page.locator('#editPreview h1')).toHaveText('Heading');
  await expect(page.locator('#editPreview strong')).toHaveText('bold');
  await expect(page.locator('#editPreview li input[type="checkbox"]:not(:checked)')).toHaveCount(1);
  await expect(page.locator('#editPreview li input[type="checkbox"]:checked')).toHaveCount(1);
  await expect(page.locator('#editPreview .followup-tag')).toHaveText('#followup');
  // Raw markdown syntax shouldn't leak through as literal text.
  await expect(page.locator('#editPreview')).not.toContainText('**bold**');

  await page.click('#editTabWrite');
  await expect(page.locator('#editBody')).toBeVisible();
  await expect(page.locator('#editPreview')).toBeHidden();
});
