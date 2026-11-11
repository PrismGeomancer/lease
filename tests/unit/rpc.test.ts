import { describe, it, expect } from 'vitest';
import { createRpc, RpcError } from '../../src/chain/rpc';
import { createDex, bestPair } from '../../src/chain/dex';
import { createHelius } from '../../src/chain/helius';

const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
const status = (n: number) => new Response('x', { status: n });
const noSleep = async () => {};

describe('rpc wrapper', () => {
  it('retries with backoff, then falls back and marks degraded; caches results', async () => {
    const calls: string[] = []; const sleeps: number[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return url.includes('primary') ? status(429) : ok(42);
    }) as unknown as typeof fetch;
    const rpc = createRpc({ urls: ['https://primary', 'https://fallback'], fetchImpl, sleep: async (ms) => { sleeps.push(ms); } });
    expect(await rpc.call('getSlot')).toBe(42);
    expect(calls.filter((c) => c.includes('primary'))).toHaveLength(3);
    expect(sleeps).toEqual([200, 400]);
    expect(rpc.degraded).toBe(true);
    await rpc.call('getSlot');
    expect(calls).toHaveLength(4); // second call served from cache
  });
  it('network errors retry; JSON-RPC errors do not', async () => {
    let n = 0;
    const flaky = (async () => { if (++n < 3) throw new TypeError('CORS'); return ok('fine'); }) as unknown as typeof fetch;
    expect(await createRpc({ urls: ['https://a'], fetchImpl: flaky, sleep: noSleep }).call('x')).toBe('fine');
    let m = 0;
    const bad = (async () => { m++; return new Response(JSON.stringify({ error: { code: -32602, message: 'invalid params' } })); }) as unknown as typeof fetch;
    await expect(createRpc({ urls: ['https://a', 'https://b'], fetchImpl: bad, sleep: noSleep }).call('x')).rejects.toBeInstanceOf(RpcError);
    expect(m).toBe(1);
    let r = 0;
    const limited = (async () => (++r < 2 ? new Response(JSON.stringify({ error: { code: -32005, message: 'busy' } })) : ok(1))) as unknown as typeof fetch;
    expect(await createRpc({ urls: ['https://a'], fetchImpl: limited, sleep: noSleep }).call('x')).toBe(1);
  });
  it('retries "service overloaded, try again" errors', async () => {
    let n = 0;
    const f = (async () => (++n < 3 ? new Response(JSON.stringify({ error: { code: -32000, message: 'account index service overloaded, please try again.' } })) : ok(7))) as unknown as typeof fetch;
    expect(await createRpc({ urls: ['https://a'], fetchImpl: f, sleep: noSleep }).call('x')).toBe(7);
    expect(n).toBe(3);
  });
  it('throws when everything fails and when no endpoint exists; exposes das flag', async () => {
    const dead = (async () => status(503)) as unknown as typeof fetch;
    await expect(createRpc({ urls: ['https://a'], fetchImpl: dead, sleep: noSleep }).call('x')).rejects.toThrow('HTTP 503');
    await expect(createRpc({ urls: [''], sleep: noSleep }).call('x')).rejects.toThrow('no endpoint');
    const h = createRpc({ urls: ['https://mainnet.helius-rpc.com/?k'], fetchImpl: dead });
    expect(h.das).toBe(true);
    expect(h.primary).toContain('helius');
    expect(createRpc({ urls: [] }).das).toBe(false);
  });
});

describe('dexscreener client', () => {
  const pairs = [{ dexId: 'a', pairAddress: 'P1', liquidity: { usd: 5 } }, { dexId: 'b', pairAddress: 'P2', liquidity: { usd: 50 } }];
  it('uses /tokens/v1 first, falls back to /latest, caches', async () => {
    let urls: string[] = [];
    const f1 = (async (u: string) => { urls.push(u); return new Response(JSON.stringify(pairs)); }) as unknown as typeof fetch;
    const d1 = createDex('https://dex', f1);
    expect((await d1.pairs('M')).length).toBe(2);
    await d1.pairs('M');
    expect(urls).toEqual(['https://dex/tokens/v1/solana/M']);
    urls = [];
    const f2 = (async (u: string) => { urls.push(u); return u.includes('/tokens/v1') ? status(500) : new Response(JSON.stringify({ pairs: [...pairs, { dexId: 'eth', pairAddress: 'E', chainId: 'ethereum' }] })); }) as unknown as typeof fetch;
    expect((await createDex('https://dex', f2).pairs('M')).length).toBe(2);
    expect(urls).toHaveLength(2);
    const f3 = (async (u: string) => (u.includes('/tokens/v1') ? new Response('{}') : new Response(JSON.stringify({ pairs: null })))) as unknown as typeof fetch;
    expect(await createDex('https://dex', f3).pairs('M')).toEqual([]);
    expect(bestPair(pairs)!.pairAddress).toBe('P2');
    expect(bestPair([])).toBeNull();
  });
});

describe('helius client', () => {
  it('getAsset maps DAS fields and is skipped without DAS', async () => {
    const asset = { mutable: false, content: { metadata: { name: 'N', symbol: 'S' }, links: { image: 'https://i' } } };
    const f = (async () => ok(asset)) as unknown as typeof fetch;
    const rpc = createRpc({ urls: ['https://x.helius-rpc.com/'], fetchImpl: f });
    expect(await createHelius(rpc, '', undefined, f).getAsset('M')).toEqual({ mutable: false, name: 'N', symbol: 'S', image: 'https://i' });
    expect(await createHelius(createRpc({ urls: ['https://plain'], fetchImpl: f }), '').getAsset('M')).toBeNull();
    const nul = createRpc({ urls: ['https://x.helius-rpc.com/'], fetchImpl: (async () => ok(null)) as unknown as typeof fetch });
    expect(await createHelius(nul, '').getAsset('M')).toBeNull();
    const err = createRpc({ urls: ['https://x.helius-rpc.com/'], fetchImpl: (async () => status(400)) as unknown as typeof fetch, sleep: noSleep, tries: 1 });
    expect(await createHelius(err, '').getAsset('M')).toBeNull();
  });
  it('firstFunder pages back and returns the earliest incoming sender', async () => {
    const page = (n: number, tag: string) => Array.from({ length: n }, (_, i) => ({ signature: `${tag}${i}`, nativeTransfers: [{ fromUserAccount: `${tag}F`, toUserAccount: 'W', amount: 1 }] }));
    const seen: string[] = [];
    const f = (async (u: string) => { seen.push(u); return new Response(JSON.stringify(u.includes('before=') ? page(5, 'old') : page(100, 'new'))); }) as unknown as typeof fetch;
    const h = createHelius(createRpc({ urls: ['https://p'] }), 'https://api', 'KEY', f);
    expect(await h.firstFunder('W')).toBe('oldF');
    expect(seen[0]).toContain('api-key=KEY');
    expect(await createHelius(createRpc({ urls: ['https://p'] }), '').firstFunder('W')).toBeNull();
    const bad = (async () => status(500)) as unknown as typeof fetch;
    expect(await createHelius(createRpc({ urls: ['https://p'] }), 'https://api', undefined, bad).firstFunder('W')).toBeNull();
    const empty = (async () => new Response('[]')) as unknown as typeof fetch;
    expect(await createHelius(createRpc({ urls: ['https://p'] }), 'https://api', undefined, empty).firstFunder('W')).toBeNull();
  });
});
