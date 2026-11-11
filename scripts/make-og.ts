/** Renders public/og.png from the Inspection Report card layout with DEMO data. Needs `npm run build && npm run preview`. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
await page.goto(process.env.URL ?? 'http://localhost:4173/');
const b64 = await page.evaluate(async () => {
  const mod = await (window as unknown as { __cards: () => Promise<{ renderCard: (d: unknown) => Promise<Blob> }> }).__cards();
  const blob = await mod.renderCard({
    kind: 'report', ticker: 'DEMO', mint: 'So11111111111111111111111111111111111111112',
    statuses: ['KEPT', 'KEPT', 'WATCH', 'KEPT', 'KEPT', 'KEPT', 'UNVERIFIABLE', 'KEPT', 'UNVERIFIABLE'], date: 'DEMO', demo: true,
  });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (const c of buf) s += String.fromCharCode(c);
  return btoa(s);
});
await writeFile('public/og.png', Buffer.from(b64, 'base64'));
await browser.close();
console.log('wrote public/og.png');
