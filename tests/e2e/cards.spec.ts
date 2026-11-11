import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
});

const CARDS = [
  { kind: 'report', ticker: 'ABCDEFGHIJKL', mint: 'So11111111111111111111111111111111111111112', statuses: ['KEPT', 'KEPT', 'WATCH', 'KEPT', 'BREACHED', 'KEPT', 'UNVERIFIABLE', 'KEPT', 'UNVERIFIABLE'], date: '2026-01-01', demo: true },
  { kind: 'lease', ticker: '$A', dev: 'So11111111111111111111111111111111111111112', fp: 'a1b2-c3d4-e5f6', term: 30, clauses: ['Authorities renounced', 'Metadata locked', 'Dev holds ≤ 5%', 'No dev sells for 14 days', 'LP burned or locked', 'Top 10 hold ≤ 40%', 'Liquidity ≥ $5000'] },
  { kind: 'renewed', ticker: 'ABCDEFGHIJKL', term: 30, fp: 'a1b2-c3d4-e5f6' },
  { kind: 'evicted', ticker: 'ABCDEFGHIJKL', clause: 'dev sold 4.1% inside the no-sell window of the lease', date: '2026-01-02', fp: 'a1b2-c3d4-e5f6' },
  { kind: 'hearing', ticker: 'ABCD', innocent: 'Dev moved 4% to another wallet, possibly for marketing or an exchange.', guilty: "Dev sold 4% inside a no-sell window. That's a partial exit.", verdict: 'breach', fp: 'a1b2-c3d4-e5f6' },
] as const;

for (const card of CARDS) {
  test(`share card "${card.kind}" renders 1200x630 PNG`, async ({ page }) => {
    await page.goto('/');
    const dims = await page.evaluate(async (c) => {
      const mod = await (window as unknown as { __cards: () => Promise<{ renderCard: (d: unknown) => Promise<Blob> }> }).__cards();
      const blob = await mod.renderCard(c);
      const bmp = await createImageBitmap(blob);
      return { w: bmp.width, h: bmp.height, type: blob.type, size: blob.size };
    }, card as unknown as Record<string, unknown>);
    expect(dims).toMatchObject({ w: 1200, h: 630, type: 'image/png' });
    expect(dims.size).toBeGreaterThan(5000);
  });
}
