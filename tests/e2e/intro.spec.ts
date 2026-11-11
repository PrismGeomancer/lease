import { test, expect } from '@playwright/test';

test('intro plays, Skip works, and it does not replay in the same session', async ({ page }) => {
  await page.goto('/');
  const intro = page.locator('.intro');
  await expect(intro).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip paperwork' })).toBeFocused();
  await page.getByRole('button', { name: 'Skip paperwork' }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.locator('#hero-h')).toBeFocused();
  await page.reload();
  await expect(page.locator('.intro')).toHaveCount(0);
});

test('Esc and click both skip', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await expect(page.locator('.intro')).toHaveCount(0);
  const p2 = await page.context().newPage();
  await p2.goto('/');
  await p2.locator('.intro').click({ position: { x: 300, y: 300 } });
  await expect(p2.locator('.intro')).toHaveCount(0);
});

test('plays fully within 4.5 s on its own', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 6000 });
});

test('reduced motion: no sequence, quick fade', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveCount(0, { timeout: 1500 });
  await ctx.close();
});

test('hero: hold-to-sign via keyboard tears the sheets; early release retracts', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
  await page.goto('/');
  const sig = page.getByRole('button', { name: 'Hold to sign the demo' });
  await sig.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(300);
  await page.keyboard.up('Space');
  await expect(page.getByText('SIGNED (DEMO)')).toHaveCount(0);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1700);
  await page.keyboard.up('Space');
  await expect(page.getByText('SIGNED (DEMO)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Now sign a real one →' })).toBeVisible();
});

test('hero: click alternative signs the demo', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign the demo', exact: true }).click();
  await expect(page.getByText('SIGNED (DEMO)')).toBeVisible();
});
