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
// client_modified, contents}) representing the one flat DROPBOX_FOLDER --
// no per-project subfolders. Seed window.__dbxFiles with pre-existing
// project files (frontmatter + body, matching serializeProjectMarkdown()
// in index.html) before navigating; an empty/nonexistent folder correctly
// rejects with path/not_found, matching real Dropbox. Each of these tests
// does its own single, explicit goto() with the #access_token hash already
// in the URL -- see the note at the top of this file on why that must be
// the only navigation.

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
          const pathLower = args.path.toLowerCase();
          // mode: 'overwrite' replaces the file at this exact path in place,
          // matching real Dropbox -- without this, repeated backups to the
          // same stable filename would pile up as duplicate entries here.
          window.__dbxFiles = window.__dbxFiles.filter((f) => f.path_lower !== pathLower);
          window.__dbxFiles.push({
            path_lower: pathLower,
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

test('connecting pushes every local project to Dropbox as its own flat file, named from its title', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');

  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox connected');
  // 6 seeded sample projects (4 active + 2 inactive) -- every one backs up, not just active ones.
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6);
  const paths = await page.evaluate(() => window.__uploads.map((u) => u.path));
  expect(new Set(paths).size).toBe(6); // each project got its own distinct file
  expect(paths.every((p) => /^\/Notebook Projects\/[^/]+\.md$/.test(p))).toBe(true); // flat -- no subfolders
  expect(paths).toContain('/Notebook Projects/kitchen-remodel.md');
});

test('re-backing up a renamed project leaves the old file behind under its previous name', async ({ page }) => {
  // This is the documented tradeoff of matching by filename instead of a
  // stored id -- see BACKLOG.md.
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6);
  expect(await page.evaluate(() => window.__dbxFiles.some((f) => f.path_lower === '/notebook projects/kitchen-remodel.md'))).toBe(true);

  await page.click('.project-card >> nth=0'); // Kitchen Remodel, numbered 1
  await page.fill('#editTitle', 'Kitchen Remodel 2.0');
  await page.click('#saveProjectBtn');
  await page.evaluate(() => window.__notebook.performDropboxBackup(true));

  await expect.poll(() => page.evaluate(() => window.__dbxFiles.some((f) => f.path_lower === '/notebook projects/kitchen-remodel-2-0.md'))).toBe(true);
  // The old file is still there, untouched -- not renamed, not deleted.
  expect(await page.evaluate(() => window.__dbxFiles.some((f) => f.path_lower === '/notebook projects/kitchen-remodel.md'))).toBe(true);
});

test('a project only in Dropbox is offered via the discovery modal, and Not Now leaves it unimported', async ({ page }) => {
  await stubDropboxSdk(page);
  await page.addInitScript(() => {
    window.__dbxFiles = [{
      path_lower: '/notebook projects/remote-only-project.md',
      name: 'remote-only-project.md',
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
      path_lower: '/notebook projects/remote-only-project.md',
      name: 'remote-only-project.md',
      client_modified: '2026-01-01T12:00:00Z',
      contents: '---\ntitle: "Remote Only Project"\nactive: true\nsortOrder: 1\n---\n# Remote Only Project\n',
    }];
  });

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).toHaveClass(/active/);
  await page.click('#dbxDiscoveryImport');

  await expect(page.locator('.project-card', { hasText: 'Remote Only Project' })).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('5 active');

  // Re-checking manually should find nothing new or changed now: the
  // imported project's fields match the Dropbox file byte-for-byte.
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#dbxCheckBtn');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).not.toHaveClass(/active/);
});

test('editing a known project\'s file directly in Dropbox is detected as "changed" on next check', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6); // initial connect push

  // Simulate hand-editing Kitchen Remodel's file directly in Dropbox.
  await page.evaluate(() => {
    const file = window.__dbxFiles.find((f) => f.path_lower === '/notebook projects/kitchen-remodel.md');
    file.contents = '---\ntitle: "Kitchen Remodel"\nactive: true\nsortOrder: 1\n---\nEdited straight in Dropbox.\n';
  });

  await page.click('#dbxCheckBtn');

  await expect(page.locator('#dropboxDiscoveryBackdrop')).toHaveClass(/active/);
  const row = page.locator('#dropboxDiscoveryList label', { hasText: 'Kitchen Remodel' });
  await expect(row).toContainText('changed');
});

test('confirming a change made directly in Dropbox updates the existing project in place, not as a duplicate', async ({ page }) => {
  await stubDropboxSdk(page);

  await page.goto('/index.html#access_token=fake-test-token&token_type=bearer');
  await expect.poll(() => page.evaluate(() => window.__uploads.length)).toBe(6);

  await page.evaluate(() => {
    const file = window.__dbxFiles.find((f) => f.path_lower === '/notebook projects/kitchen-remodel.md');
    file.contents = '---\ntitle: "Kitchen Remodel"\nactive: true\nsortOrder: 1\n---\nEdited straight in Dropbox.\n';
  });

  await page.click('#dbxCheckBtn');
  await expect(page.locator('#dropboxDiscoveryBackdrop')).toHaveClass(/active/);
  await page.click('#dbxDiscoveryImport');

  await expect(page.locator('#activeCount')).toHaveText('4 active'); // unchanged -- no new project added
  await expect(page.locator('.project-card', { hasText: 'Kitchen Remodel' })).toHaveCount(1); // not duplicated
  await expect(page.locator('.project-card', { hasText: 'Edited straight in Dropbox.' })).toBeVisible();
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
