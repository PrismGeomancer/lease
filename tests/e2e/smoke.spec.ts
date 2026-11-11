import { test, expect } from '@playwright/test';

for (const [hash, h1] of [['#/', 'Home'], ['#/register', 'Register'], ['#/zzz', 'Room not found']] as const) {
  test(`route ${hash}`, async ({ page }) => {
    await page.goto('/' + hash);
    await expect(page.locator('h1')).toHaveText(h1);
  });
}
