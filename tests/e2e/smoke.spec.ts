import { test, expect } from '@playwright/test';

// The intro has its own spec; everything else starts with it already seen.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
});

const ROUTES: [string, RegExp][] = [
  ['#/', /on the lease/i],
  ['#/inspect', /inspection/i],
  ['#/draft', /draft a/i],
  ['#/register', /register/i],
  ['#/keyring', /keyring/i],
  ['#/office', /office/i],
  ['#/l/notalease', /lease/i],
  ['#/zzz', /room not found/i],
];

test.describe('routes', () => {
  for (const [hash, re] of ROUTES) {
    test(`renders ${hash}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/' + hash);
      await expect(page.locator('h1').first()).toHaveText(re);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('320px: no horizontal overflow', () => {
  test.use({ viewport: { width: 320, height: 700 } });
  for (const [hash] of ROUTES) {
    test(`no overflow on ${hash}`, async ({ page }) => {
      await page.goto('/' + hash);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  }
});

test('home: empty states are honest (no fake activity)', async ({ page }) => {
  await page.goto('/');
  // KPI row shows real zeros, never invented activity
  const kpis = page.getByRole('list', { name: 'Office at a glance' });
  await expect(kpis.getByText('Leases on file')).toBeVisible();
  await expect(kpis.getByText('Be the first tenant')).toBeVisible();
  await expect(kpis.getByText('None yet')).toBeVisible();
  await expect(kpis.locator('.kpi__value').first()).toHaveText('0');
  await expect(page.getByText('Office quiet. No leases on file yet.')).toBeVisible();
  await expect(page.getByText('PENDING — NOT YET LISTED')).toBeVisible();
  await expect(page.getByText('SAMPLE — FICTIONAL COIN')).toHaveCount(0);
  await expect(page.getByText('$DRAFTY').first()).toBeVisible();
  // empty config => no dead links to X / Telegram / market
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByText('View market')).toHaveCount(0);
});

test('register: placeholder cards are not links and have no label', async ({ page }) => {
  await page.goto('/#/register');
  await expect(page.getByText('$DRAFTY')).toBeVisible();
  await expect(page.getByText(/sample/i)).toHaveCount(0);
  await expect(page.locator('a.icard')).toHaveCount(0);
});

test('keyring: export / import / clear', async ({ page }) => {
  await page.goto('/#/keyring');
  await expect(page.getByText('No keys yet.')).toBeVisible();
  const file = { name: 'k.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ id: 'report:abc', kind: 'report', title: 'Report abc', ref: 'abc', savedAt: 1 }])) };
  await page.setInputFiles('input[type=file]', file);
  await expect(page.getByText('Report abc')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Report abc')).toBeVisible();
  await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await expect(page.getByText("That file isn't a keyring export.")).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  expect(dl.suggestedFilename()).toBe('lease-keyring.json');
});

test('desk: invalid address shows an inline error', async ({ page }) => {
  await page.goto('/#/inspect');
  await page.locator('#mint-full').fill('not-an-address');
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await expect(page.getByRole('alert')).toContainText("That's not a Solana address");
});

test('tampered lease link shows SIGNATURE INVALID panel', async ({ page }) => {
  await page.goto('/#/l/' + 'A'.repeat(40));
  await expect(page.getByRole('alert')).toBeVisible();
});
