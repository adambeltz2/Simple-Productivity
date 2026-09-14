// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('seeds sample projects and numbers only the active ones', async ({ page }) => {
  await expect(page.locator('#activeCount')).toHaveText('4 active');
  const numbers = await page.locator('.project-card:not(.inactive) .project-num').allTextContents();
  expect(numbers).toEqual(['1', '2', '3', '4']);
});

test('search filters projects and the task/follow-up rails together', async ({ page }) => {
  await page.fill('#searchInput', 'walnut');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('#tasksList .rail-item')).toHaveCount(1);
  await expect(page.locator('#followupsList .rail-item')).toHaveCount(1);
});

test('toggling a task checkbox persists into the note body', async ({ page }) => {
  const firstTaskCheckbox = page.locator('#tasksList .rail-item input[type="checkbox"]').first();
  await expect(firstTaskCheckbox).not.toBeChecked();
  await firstTaskCheckbox.check();

  await page.reload();
  const reloadedCheckbox = page.locator('#tasksList .rail-item.done input[type="checkbox"]').first();
  await expect(reloadedCheckbox).toBeChecked();
});

test('creating a project shows up numbered on the dashboard', async ({ page }) => {
  await page.click('#newProjectBtn');
  await page.fill('#editTitle', 'Test Project From Playwright');
  await page.fill('#editBody', '# Test Project From Playwright\n\nSome body text.\n\n- [ ] a task\n');
  await page.click('#saveProjectBtn');

  await expect(page.locator('.project-card', { hasText: 'Test Project From Playwright' })).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('5 active');
});

test('Dropbox connect opens the explainer modal and links to the real OAuth authorize URL', async ({ page }) => {
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
  await page.click('#dbxBtn');
  await expect(page.locator('#dropboxInfoBackdrop')).toHaveClass(/active/);
  await page.click('#dbxInfoCancel');
  await expect(page.locator('#dropboxInfoBackdrop')).not.toHaveClass(/active/);
  await expect(page.locator('#dbxStatusText')).toHaveText('Dropbox not connected');
});

test('info icon documents the #followup and task syntax', async ({ page }) => {
  const infoIcon = page.locator('.info-icon');
  await expect(infoIcon).toHaveAttribute('title', /#followup/);
  await expect(infoIcon).toHaveAttribute('title', /- \[ \] do the thing/);
});

test('dark mode toggle flips the theme attribute and persists across reload', async ({ page }) => {
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
  await expect(page.locator('#appVersion')).toHaveText(/^v\d+\.\d+\.\d+$/);

  const githubLink = page.locator('footer a', { hasText: 'GitHub' });
  await expect(githubLink).toHaveAttribute('href', 'https://github.com/adambeltz2/Simple-Productivity');
  await expect(githubLink).toHaveAttribute('target', '_blank');

  const coffeeLink = page.locator('footer a', { hasText: 'Buy me a coffee' });
  await expect(coffeeLink).toHaveAttribute('href', 'https://www.buymeacoffee.com/adambeltz');
  await expect(coffeeLink).toHaveAttribute('target', '_blank');
});
