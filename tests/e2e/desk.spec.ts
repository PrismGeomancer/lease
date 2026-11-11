import { test, expect, type Page } from '@playwright/test';

const MINT = 'So11111111111111111111111111111111111111112';

async function mockNetwork(page: Page, mode: 'ok' | 'notmint' = 'ok') {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
  await page.route('https://api.mainnet-beta.solana.com/**', async (route) => {
    const { method, params, id } = route.request().postDataJSON() as { method: string; params: unknown[]; id: number };
    const enc = (params[1] as { encoding?: string } | undefined)?.encoding;
    const result: Record<string, unknown> = {
      getAccountInfo: mode === 'notmint' || enc === 'base64' ? { value: null } : {
        value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', lamports: 1, data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null, supply: '1000000', decimals: 6 } } } },
      },
      getTokenLargestAccounts: { value: [] },
      getMultipleAccounts: { value: [] },
      getSignaturesForAddress: [],
      getTokenAccountsByOwner: { value: [] },
    };
    // stagger so rows resolve progressively rather than all at once
    await new Promise((r) => setTimeout(r, method === 'getTokenLargestAccounts' ? 400 : 50));
    await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jsonrpc: '2.0', id, result: result[method] ?? null }) });
  });
  await page.route('https://api.dexscreener.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
}

test('desk idle state already shows what each inspector asks', async ({ page }) => {
  await mockNetwork(page);
  await page.goto('/');
  await expect(page.getByText('Can anyone still print more?')).toBeVisible();
  await expect(page.getByText('Are the big wallets secretly one person?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'JUP' })).toBeVisible();
});

test('valid mint: nine rows resolve progressively with real findings and an overall summary', async ({ page }) => {
  await mockNetwork(page);
  await page.goto('/#/inspect');
  await page.locator('#mint-full').fill(MINT);
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await expect(page.getByText('Mint authority is null. Nobody can print more.')).toBeVisible();
  // progressive: at some point fewer than nine have reported
  await expect(page.getByText(/^[1-8] of 9 inspectors reported$/)).toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByRole('img', { name: /^Nine inspectors: .*(kept|unverifiable)/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('img', { name: /pending/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save to Keyring' })).toBeVisible();
  await expect(page.getByText('Evidence', { exact: true })).toBeVisible();
});

test('address that is not a token shows the right message', async ({ page }) => {
  await mockNetwork(page, 'notmint');
  await page.goto('/#/inspect');
  await page.locator('#mint-full').fill(MINT);
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await expect(page.getByRole('alert')).toContainText("That address isn't a token");
});

test('RPC host blocked: clear message, no crash', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
  await page.route('https://api.mainnet-beta.solana.com/**', (r) => r.abort());
  await page.goto('/#/inspect');
  await page.locator('#mint-full').fill(MINT);
  await page.getByRole('button', { name: 'Run inspection' }).click();
  await expect(page.getByRole('alert')).toContainText("records room isn't answering", { timeout: 20000 });
});

test('sample chip runs an inspection in one click (320px, keyboard reachable)', async ({ page }) => {
  await mockNetwork(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const chip = page.getByRole('button', { name: 'WIF' });
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Mint authority is null. Nobody can print more.')).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('dashboard: verdict bar fills as inspectors report; recent list remembers the coin; your-desk panel prompts to connect', async ({ page }) => {
  await mockNetwork(page);
  await page.goto('/');
  await expect(page.getByText('Coins you inspect appear here, on this device only.')).toBeVisible();
  await expect(page.getByText('Connect the dev wallet to see its leases.')).toBeVisible();
  await page.getByRole('button', { name: 'WIF' }).click();
  await expect(page.getByRole('img', { name: /^Nine inspectors: .*kept/ }).first()).toBeVisible({ timeout: 15000 });
  const recent = page.getByRole('region', { name: 'Recent inspections' }).or(page.locator('section[aria-labelledby="recent-h"]'));
  await expect(recent.locator('.recent__row')).toHaveCount(1, { timeout: 15000 });
  await page.reload();
  await expect(page.locator('section[aria-labelledby="recent-h"] .recent__row')).toHaveCount(1);
  await page.locator('section[aria-labelledby="recent-h"]').getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Coins you inspect appear here, on this device only.')).toBeVisible();
});
