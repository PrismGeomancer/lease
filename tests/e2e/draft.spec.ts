import { test, expect, type Page } from '@playwright/test';
import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

test.use({ baseURL: 'http://localhost:4174' });

const MINT = 'So11111111111111111111111111111111111111112';
const SEED = new Uint8Array(32).map((_, i) => 200 - i);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));

/** Mock Wallet Standard wallet: real ed25519 signing in Node, so signatures genuinely verify in the app. */
async function installWallet(page: Page) {
  const pub = await ed.getPublicKeyAsync(SEED);
  const sent: Uint8Array[] = [];
  await page.exposeFunction('__sign', async (h: string) => hex(await ed.signAsync(unhex(h), SEED)));
  await page.exposeFunction('__send', async (h: string) => { sent.push(unhex(h)); return hex(new Uint8Array(64).fill(7)); });
  await page.addInitScript(({ address, pubHex }) => {
    sessionStorage.setItem('lease:intro:seen', '1');
    const h2b = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
    const b2h = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const w = window as unknown as { __sign: (h: string) => Promise<string>; __send: (h: string) => Promise<string> };
    const account = { address, publicKey: h2b(pubHex), chains: ['solana:mainnet', 'solana:devnet'], features: ['solana:signMessage', 'solana:signAndSendTransaction'] };
    const wallet = {
      version: '1.0.0', name: 'MockWallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
      chains: ['solana:mainnet', 'solana:devnet'], accounts: [] as unknown[],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [account]; return { accounts: [account] }; } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { wallet.accounts = []; } },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signMessage': { version: '1.0.0', signMessage: async (...inputs: { message: Uint8Array }[]) =>
          Promise.all(inputs.map(async (i) => ({ signedMessage: i.message, signature: h2b(await w.__sign(b2h(i.message))) }))) },
        'solana:signAndSendTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy'], signAndSendTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
          Promise.all(inputs.map(async (i) => ({ signature: h2b(await w.__send(b2h(i.transaction))) }))) },
      },
    };
    const register = (api: { register: (x: unknown) => void }) => api.register(wallet);
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
    window.addEventListener('wallet-standard:app-ready', ((e: CustomEvent) => register(e.detail)) as EventListener);
  }, { address: bs58.encode(pub), pubHex: hex(pub) });
  return { sent, address: bs58.encode(pub) };
}

async function mockChain(page: Page) {
  await page.route('https://api.mainnet-beta.solana.com/**', async (route) => {
    const { method, params, id } = route.request().postDataJSON() as { method: string; params: unknown[]; id: number };
    const enc = (params[1] as { encoding?: string } | undefined)?.encoding;
    const result: Record<string, unknown> = {
      getAccountInfo: enc === 'base64' ? { value: null } : { value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', lamports: 1, data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null, supply: '1000000000', decimals: 6 } } } } },
      getTokenAccountsByOwner: { value: [] },
      getTokenLargestAccounts: { value: [] },
      getMultipleAccounts: { value: [] },
      getSignaturesForAddress: [],
      getLatestBlockhash: { value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1 } },
      getSignatureStatuses: { value: [{ confirmationStatus: 'confirmed', err: null }] },
      getTransaction: { blockTime: Math.floor(Date.now() / 1000) },
    };
    await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ jsonrpc: '2.0', id, result: result[method] ?? null }) });
  });
  await page.route('https://api.dexscreener.com/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
}

test('draft → sign → lease page → link reopens and verifies → tamper fails → record on-chain', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { sent, address } = await installWallet(page);
  await mockChain(page);
  await page.goto('/#/draft');

  // 1 building
  await page.locator('#d-mint').fill(MINT);
  await expect(page.getByText(/supply 1,000/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  // 2 tenant
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.getByRole('button', { name: /MockWallet/ }).click();
  await expect(page.getByText('You hold 0% of supply.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  // 3 terms (defaults: authorities, dev max 5%, no sells 14 days)
  await expect(page.getByText('Your lease so far')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  // 4 sign
  const msg = page.getByLabel('Message to sign');
  await expect(msg).toContainText('LEASE OFFICE — FORM L-01');
  await expect(msg).toContainText(address);
  await expect(msg).toContainText('This signature moves no funds and grants no permissions.');
  await page.getByRole('button', { name: 'Sign without holding' }).click();
  await expect(page.getByText('Lease signed.')).toBeVisible();
  await expect(page.getByText('SIGNATURE VALID').first()).toBeVisible({ timeout: 10000 });
  const url = page.url();
  expect(url).toContain('#/l/');

  // the link reopens in a brand-new browser context and still verifies
  const fresh = await browser.newContext({ baseURL: 'http://localhost:4174' });
  const p2 = await fresh.newPage();
  await mockChain(p2);
  await p2.addInitScript(() => sessionStorage.setItem('lease:intro:seen', '1'));
  await p2.goto(url);
  await expect(p2.getByText('SIGNATURE VALID').first()).toBeVisible({ timeout: 10000 });
  // changing one character makes the signature invalid
  const payload = url.split('#/l/')[1]!;
  const i = Math.floor(payload.length / 2);
  const tampered = payload.slice(0, i) + (payload[i] === 'A' ? 'B' : 'A') + payload.slice(i + 1);
  await p2.goto(`/#/l/${tampered}`);
  await p2.reload();
  await expect(p2.getByRole('alert')).toBeVisible({ timeout: 10000 });
  await fresh.close();

  // record on-chain (wallet is still connected in the original page)
  await expect(page.getByText('Not recorded on-chain.')).toBeVisible();
  await page.getByRole('button', { name: 'Record on-chain' }).click();
  await expect(page.getByText(/network fee ≈ 0\.00000\d+ SOL/)).toBeVisible();
  await page.getByRole('button', { name: 'Record it' }).click();
  await expect(page.getByText('Lease recorded on-chain.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/RECORDED ON-CHAIN/)).toBeVisible();
  expect(sent).toHaveLength(1);
  const txText = Buffer.from(sent[0]!).toString('latin1');
  expect(txText).toContain('LEASE1:');
  expect(txText).toContain('"mint":"' + MINT + '"');
  const officeBytes = Buffer.from(bs58.decode(MINT)).toString('latin1');
  expect(txText).toContain(officeBytes); // office address is an account in the transaction
  expect(errors).toEqual([]);
});

