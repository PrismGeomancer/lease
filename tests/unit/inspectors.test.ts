import { describe, it, expect } from 'vitest';
import bs58 from 'bs58';
import type { Rpc } from '../../src/chain/rpc';
import type { Dex, Pair } from '../../src/chain/dex';
import type { Helius } from '../../src/chain/helius';
import type { InspectCtx, Finding } from '../../src/types';
import { inspectAll, runInspector, summarize, NotMintError } from '../../src/inspectors';
import { metadataPda, isOnCurve, parseMetaplexMetadata } from '../../src/chain/pda';
import { landlordStatus, tenantStatus, foundationsStatus, noiseStatus, neighboursStatus } from '../../src/thresholds';
import { clauseStatuses, applyRound, newRecord, liveState, dayOf, endsAt } from '../../src/lease/evaluate';
import { makeLease, devAddress, MINT } from '../helpers';

// ---- synthetic fixtures (shapes mirror real RPC / DexScreener responses) ----
const PDA_OWNER = await metadataPda(MINT); // guaranteed off-curve
const wallet = async (n: number) => devAddress(new Uint8Array(32).fill(n)); // on-curve
const W = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(wallet));
const DEV = W[0]!;

type Handler = (params: unknown[]) => unknown;
function mockRpc(h: Record<string, Handler>, das = false): Rpc {
  return {
    degraded: false, das, primary: 'mock',
    async call(method, params = []) {
      const fn = h[method];
      if (!fn) throw new Error(`unmocked ${method}`);
      return fn(params) as never;
    },
  };
}
const mintAcct = (o: Record<string, unknown> = {}) => ({
  value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', lamports: 1, data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null, supply: '1000000', decimals: 6, ...o } } } },
});
const pair = (o: Partial<Pair> = {}): Pair => ({ dexId: 'raydium', pairAddress: 'PAIR', url: 'https://dexscreener.com/x', liquidity: { usd: 50_000 }, pairCreatedAt: Date.now() - 3 * 86_400_000, txns: { h24: { buys: 100, sells: 100 } }, volume: { h24: 10_000 }, ...o });
const dex = (pairs: Pair[]): Dex => ({ pairs: async () => pairs });

function ctx(h: Record<string, Handler>, pairs: Pair[] = [pair()], extra: Partial<InspectCtx> = {}): InspectCtx {
  return { mint: MINT, rpc: mockRpc(h), dex: dex(pairs), now: Date.now(), memo: new Map(), ...extra };
}
const run = (id: Parameters<typeof runInspector>[0], c: InspectCtx) => runInspector(id, c);
const tokAcct = (owner: string) => ({ data: { parsed: { info: { owner } } }, owner: 'T', lamports: 1 });
const ownerBal = (amount: string) => ({ value: [{ account: { data: { parsed: { info: { tokenAmount: { amount } } } } } }] });

describe('mint / freeze', () => {
  it('KEPT when null, BREACHED when set', async () => {
    const ok = ctx({ getAccountInfo: () => mintAcct() });
    expect((await run('mint', ok)).status).toBe('KEPT');
    expect((await run('freeze', ok)).status).toBe('KEPT');
    const bad = ctx({ getAccountInfo: () => mintAcct({ mintAuthority: DEV, freezeAuthority: DEV }) });
    const m = await run('mint', bad);
    expect(m.status).toBe('BREACHED');
    expect(m.summary).toContain(DEV);
    expect((await run('freeze', bad)).status).toBe('BREACHED');
  });
  it('not a mint => NotMintError from inspectAll, UNVERIFIABLE from a single inspector', async () => {
    const c = ctx({ getAccountInfo: () => ({ value: null }) });
    await expect(inspectAll(c)).rejects.toBeInstanceOf(NotMintError);
    expect((await run('mint', c)).status).toBe('UNVERIFIABLE');
  });
});

describe('paint', () => {
  it('uses Helius DAS when available', async () => {
    const helius: Helius = { getAsset: async () => ({ mutable: false }), firstFunder: async () => null };
    expect((await run('paint', ctx({ getAccountInfo: () => mintAcct() }, [pair()], { helius }))).status).toBe('KEPT');
    const mutable: Helius = { getAsset: async () => ({ mutable: true }), firstFunder: async () => null };
    expect((await run('paint', ctx({ getAccountInfo: () => mintAcct() }, [pair()], { helius: mutable }))).status).toBe('WATCH');
    const lease = await makeLease({ c: { ml: 1 } });
    expect((await run('paint', ctx({ getAccountInfo: () => mintAcct() }, [pair()], { helius: mutable, lease }))).status).toBe('BREACHED');
  });
  it('reads Token-2022 metadata extension', async () => {
    const locked = ctx({ getAccountInfo: () => mintAcct({ extensions: [{ extension: 'tokenMetadata', state: { updateAuthority: null } }] }) });
    expect((await run('paint', locked)).status).toBe('KEPT');
    const open = ctx({ getAccountInfo: () => mintAcct({ extensions: [{ extension: 'tokenMetadata', state: { updateAuthority: DEV } }] }) });
    expect((await run('paint', open)).status).toBe('WATCH');
  });
  it('decodes the Metaplex metadata account', async () => {
    const enc = (s: string) => { const b = new TextEncoder().encode(s); const o = new Uint8Array(4 + b.length); new DataView(o.buffer).setUint32(0, b.length, true); o.set(b, 4); return o; };
    const build = (mutable: number, creators: boolean) => {
      const parts = [Uint8Array.of(4), bs58.decode(DEV), bs58.decode(MINT), enc('Name\0\0'), enc('SYM'), enc('https://x'), Uint8Array.of(0, 0),
        creators ? Uint8Array.of(1, 1, 0, 0, 0, ...new Uint8Array(34)) : Uint8Array.of(0), Uint8Array.of(0, mutable)];
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
    };
    expect(parseMetaplexMetadata(build(0, true))).toMatchObject({ name: 'Name', symbol: 'SYM', isMutable: false });
    expect(parseMetaplexMetadata(build(1, false)).isMutable).toBe(true);
    const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
    const h = (m: number) => ({ getAccountInfo: (p: unknown[]) => ((p[1] as { encoding: string }).encoding === 'base64' ? { value: { data: [b64(build(m, false)), 'base64'] } } : mintAcct()) });
    expect((await run('paint', ctx(h(0)))).status).toBe('KEPT');
    expect((await run('paint', ctx(h(1)))).status).toBe('WATCH');
    const none = ctx({ getAccountInfo: (p) => ((p[1] as { encoding: string }).encoding === 'base64' ? { value: null } : mintAcct()) });
    expect((await run('paint', none)).status).toBe('UNVERIFIABLE');
    expect(() => parseMetaplexMetadata(Uint8Array.from([4, ...new Uint8Array(64), 255, 255, 255, 255]))).toThrow();
  });
});

describe('landlord', () => {
  const largest = (amounts: [string, string][]) => ({ value: amounts.map(([address, amount]) => ({ address, amount })) });
  it('excludes off-curve owners and pair addresses; computes top-10 share', async () => {
    const handlers = (rows: [string, string, string][]) => ({
      getAccountInfo: () => mintAcct({ supply: '1000' }),
      getTokenLargestAccounts: () => largest(rows.map(([a, , amt]) => [a, amt])),
      getMultipleAccounts: () => ({ value: rows.map(([, owner]) => tokAcct(owner)) }),
    });
    // pool (off-curve) 500, then three wallets 100 each => 30% => KEPT
    const c = ctx(handlers([['A1', PDA_OWNER, '500'], ['A2', W[1]!, '100'], ['A3', W[2]!, '100'], ['A4', W[3]!, '100'], ['A5', 'PAIR', '50']]));
    const f = await run('landlord', c);
    expect(f.status).toBe('KEPT');
    expect(f.value).toBe('30%');
    expect((f.evidence!.excluded as unknown[]).length).toBe(2);
    // 600 in ordinary wallets => BREACHED by default (>50%)
    const big = await run('landlord', ctx(handlers([['A1', W[1]!, '600']])));
    expect(big.status).toBe('BREACHED');
    // with a lease limit of 70%, the same holding is KEPT
    const lease = await makeLease({ c: { tt: 70 } });
    expect((await run('landlord', ctx(handlers([['A1', W[1]!, '600']]), [pair()], { lease }))).status).toBe('KEPT');
    // nothing but pools => UNVERIFIABLE
    expect((await run('landlord', ctx(handlers([['A1', PDA_OWNER, '900']])))).status).toBe('UNVERIFIABLE');
  });
});

describe('tenant', () => {
  const base = (bal: string, extra: Record<string, Handler> = {}) => ({
    getAccountInfo: () => mintAcct({ supply: '1000' }),
    getTokenAccountsByOwner: () => ownerBal(bal),
    ...extra,
  });
  it('with a lease: dm and ns clauses', async () => {
    const t0 = Math.floor(Date.now() / 1000) - 86400;
    const lease = await makeLease({ t0, b0: '100', term: 30, c: { dm: 12, ns: 14 } });
    const kept = await run('tenant', ctx(base('100'), [pair()], { lease }));
    expect(kept.evidence!.clauses).toEqual({ dm: 'KEPT', ns: 'KEPT' });
    const sold = await run('tenant', ctx(base('50'), [pair()], { lease }));
    expect(sold.evidence!.clauses).toEqual({ dm: 'KEPT', ns: 'BREACHED' });
    expect(sold.status).toBe('BREACHED');
    const over = await run('tenant', ctx(base('200'), [pair()], { lease }));
    expect((over.evidence!.clauses as Record<string, string>).dm).toBe('BREACHED');
    // window over and balance dropped => needs history => UNVERIFIABLE, not guilty
    const old = await makeLease({ t0: t0 - 40 * 86400, b0: '100', c: { ns: 14 } });
    expect((await run('tenant', ctx(base('50'), [pair()], { lease: old }))).evidence!.clauses).toEqual({ ns: 'UNVERIFIABLE' });
    // window not started
    const future = await makeLease({ t0: t0 + 10 * 86400, b0: '100', c: { ns: 14 } });
    expect((await run('tenant', ctx(base('100'), [pair()], { lease: future }))).evidence!.clauses).toEqual({ ns: 'PENDING' });
    const zero = await makeLease({ t0, b0: '0', c: { ns: 14 } });
    expect((await run('tenant', ctx(base('0'), [pair()], { lease: zero }))).evidence!.clauses).toEqual({ ns: 'UNVERIFIABLE' });
  });
  it('without a lease: infers the dev and never goes stronger than WATCH', async () => {
    const h = base('500', {
      getSignaturesForAddress: () => [{ signature: 'S2' }, { signature: 'S1' }],
      getTransaction: () => ({ transaction: { message: { accountKeys: [{ pubkey: DEV }] } } }),
    });
    const f = await run('tenant', ctx(h));
    expect(f.status).toBe('WATCH');
    expect(f.summary).toContain('inferred');
    expect(f.evidence).toMatchObject({ dev: DEV, inferred: true });
    const none = await run('tenant', ctx(base('1', { getSignaturesForAddress: () => [] })));
    expect(none.status).toBe('UNVERIFIABLE');
    const long = await run('tenant', ctx(base('1', { getSignaturesForAddress: () => new Array(1000).fill({ signature: 'x' }) })));
    expect(long.status).toBe('UNVERIFIABLE');
    expect((await run('tenant', ctx({ getAccountInfo: () => mintAcct({ supply: '0' }), getSignaturesForAddress: () => [] }))).status).toBe('UNVERIFIABLE');
  });
});

describe('market inspectors', () => {
  const rpc = { getAccountInfo: () => mintAcct() };
  it('foundations', async () => {
    expect((await run('foundations', ctx(rpc, [pair({ liquidity: { usd: 50_000 } })]))).status).toBe('KEPT');
    expect((await run('foundations', ctx(rpc, [pair({ liquidity: { usd: 5_000 } })]))).status).toBe('WATCH');
    expect((await run('foundations', ctx(rpc, [pair({ liquidity: { usd: 100 } })]))).status).toBe('BREACHED');
    expect((await run('foundations', ctx(rpc, []))).status).toBe('UNVERIFIABLE');
    const lease = await makeLease({ c: { liq: 60_000 } });
    expect((await run('foundations', ctx(rpc, [pair({ liquidity: { usd: 50_000 } })], { lease }))).status).toBe('BREACHED');
    expect((await run('foundations', ctx(rpc, [pair({ dexId: 'pumpfun', liquidity: { usd: 0 } })]))).status).toBe('UNVERIFIABLE');
    // picks the highest-liquidity pair
    const f = await run('foundations', ctx(rpc, [pair({ liquidity: { usd: 1 } }), pair({ liquidity: { usd: 99_000 }, pairAddress: 'BIG' })]));
    expect(f.value).toBe(99_000);
  });
  it('noise', async () => {
    const n = (buys: number, sells: number, vol = 10_000) => run('noise', ctx(rpc, [pair({ txns: { h24: { buys, sells } }, volume: { h24: vol } })]));
    expect((await n(100, 100)).status).toBe('KEPT');
    expect((await n(100, 200)).status).toBe('WATCH');
    expect((await n(100, 400)).status).toBe('BREACHED');
    expect((await n(0, 5)).status).toBe('BREACHED');
    expect((await n(100, 100, 100)).status).toBe('UNVERIFIABLE');
    expect((await run('noise', ctx(rpc, []))).status).toBe('UNVERIFIABLE');
  });
  it('locks', async () => {
    expect((await run('locks', ctx(rpc, [pair({ dexId: 'pumpfun' })]))).status).toBe('KEPT');
    expect((await run('locks', ctx(rpc, [pair({ dexId: 'raydium' })]))).status).toBe('UNVERIFIABLE');
    expect((await run('locks', ctx(rpc, []))).status).toBe('UNVERIFIABLE');
  });
  it('locks with an LP mint', async () => {
    const INC = '1nc1nerator11111111111111111111111111111111';
    const LPM = await devAddress(new Uint8Array(32).fill(77));
    const lp = (holders: [string, string][], supply = '1000') => ({
      getAccountInfo: () => ({ value: { owner: 'T', data: { parsed: { type: 'mint', info: { supply, decimals: 0, mintAuthority: null, freezeAuthority: null } } } } }),
      getTokenLargestAccounts: () => ({ value: holders.map(([, a], i) => ({ address: `L${i}`, amount: a })) }),
      getMultipleAccounts: () => ({ value: holders.map(([o]) => tokAcct(o)) }),
    });
    const lease = await makeLease({ c: { lp: 1, lpm: LPM } });
    const go = (h: ReturnType<typeof lp>) => run('locks', ctx(h, [pair()], { lease }));
    expect((await go(lp([[INC, '990']]))).status).toBe('KEPT');
    expect((await go(lp([[W[1]!, '600'], [INC, '400']]))).status).toBe('BREACHED');
    expect((await go(lp([[PDA_OWNER, '900'], [INC, '100']]))).status).toBe('UNVERIFIABLE');
    expect((await go(lp([], '0'))).status).toBe('KEPT');
    const notMint = await run('locks', ctx({ getAccountInfo: () => ({ value: null }), getTokenLargestAccounts: () => ({ value: [] }) }, [pair()], { lease }));
    expect(notMint.status).toBe('UNVERIFIABLE');
  });
  it('neighbours: explicit run only; groups shared funders', async () => {
    const funderA = W[10]!, funderB = W[11]!;
    const owners = [W[1]!, W[2]!, W[3]!, W[4]!];
    const h = {
      getAccountInfo: () => mintAcct({ supply: '1000' }),
      getTokenLargestAccounts: () => ({ value: owners.map((_, i) => ({ address: `T${i}`, amount: '100' })) }),
      getMultipleAccounts: () => ({ value: owners.map(tokAcct) }),
    };
    expect((await run('neighbours', ctx(h))).evidence).toEqual({ notRun: true });
    const funders = new Map<string, string | null>([[owners[0]!, funderA], [owners[1]!, funderA], [owners[2]!, funderA], [owners[3]!, funderB]]);
    const three = await run('neighbours', ctx(h, [pair()], { runNeighbours: true, funders }));
    expect(three.status).toBe('BREACHED');
    const two = await run('neighbours', ctx(h, [pair()], { runNeighbours: true, funders: new Map([[owners[0]!, funderA], [owners[1]!, funderA], [owners[2]!, funderB], [owners[3]!, W[9]!]]) }));
    expect(two.status).toBe('WATCH');
    const none = await run('neighbours', ctx(h, [pair()], { runNeighbours: true, funders: new Map(owners.map((o, i) => [o, W[5 + (i % 4)]!])) }));
    expect(none.status).toBe('KEPT');
    // pool funders ignored
    const pool = await run('neighbours', ctx(h, [pair()], { runNeighbours: true, funders: new Map(owners.map((o) => [o, PDA_OWNER])) }));
    expect(pool.status).toBe('KEPT');
    // helius funder lookup is used and cached
    const helius: Helius = { getAsset: async () => null, firstFunder: async () => funderA };
    const cache = new Map<string, string | null>();
    const viaHelius = await run('neighbours', ctx(h, [pair()], { runNeighbours: true, helius, funders: cache }));
    expect(viaHelius.status).toBe('BREACHED');
    expect(cache.size).toBe(4);
    // nothing traceable
    const blind: Helius = { getAsset: async () => null, firstFunder: async () => null };
    const noTrace = await run('neighbours', ctx({ ...h, getSignaturesForAddress: () => [] }, [pair()], { runNeighbours: true, helius: blind }));
    expect(noTrace.status).toBe('UNVERIFIABLE');
    // RPC fallback path: oldest tx fee payer
    const viaRpc = await run('neighbours', ctx({ ...h, getSignaturesForAddress: () => [{ signature: 's' }], getTransaction: () => ({ transaction: { message: { accountKeys: [{ pubkey: funderA }] } } }) }, [pair()], { runNeighbours: true }));
    expect(viaRpc.status).toBe('BREACHED');
  });
});

describe('runner', () => {
  it('maps errors and timeouts to UNVERIFIABLE', async () => {
    const boom = ctx({ getAccountInfo: () => { throw new Error('rpc down'); } });
    const f = await run('mint', boom);
    expect(f.status).toBe('UNVERIFIABLE');
    expect(f.summary).toContain('not guilty');
    const slow: InspectCtx = { ...ctx({}), rpc: { ...mockRpc({}), call: () => new Promise(() => {}) } };
    const real = setTimeout;
    // speed up: patch global setTimeout for the 8s guard only
    globalThis.setTimeout = ((fn: () => void, ms?: number) => real(fn, ms === 8000 ? 5 : ms)) as typeof setTimeout;
    try {
      const t = await run('mint', slow);
      expect(t.summary).toContain('ran out of time');
    } finally { globalThis.setTimeout = real; }
  });
  it('inspectAll reports progressively and summarises', async () => {
    const c = ctx({
      getAccountInfo: (p) => ((p[1] as { encoding: string }).encoding === 'base64' ? { value: null } : mintAcct()),
      getTokenLargestAccounts: () => ({ value: [] }), getMultipleAccounts: () => ({ value: [] }),
      getSignaturesForAddress: () => [], getTokenAccountsByOwner: () => ownerBal('0'),
    });
    const seen: Finding[] = [];
    const all = await inspectAll(c, (f) => seen.push(f));
    expect(all).toHaveLength(9);
    expect(seen).toHaveLength(9);
    const s = summarize(all);
    expect(s.kept + s.watch + s.breached + s.unverifiable).toBe(9);
  });
});

describe('thresholds', () => {
  it('boundaries', () => {
    expect(landlordStatus(30)).toBe('KEPT'); expect(landlordStatus(30.01)).toBe('WATCH'); expect(landlordStatus(50)).toBe('WATCH'); expect(landlordStatus(50.01)).toBe('BREACHED');
    expect(tenantStatus(5)).toBe('KEPT'); expect(tenantStatus(10)).toBe('WATCH'); expect(tenantStatus(10.1)).toBe('BREACHED'); expect(tenantStatus(10.1, undefined, true)).toBe('WATCH');
    expect(tenantStatus(3, 2)).toBe('BREACHED'); expect(tenantStatus(2, 2)).toBe('KEPT');
    expect(foundationsStatus(10_000)).toBe('KEPT'); expect(foundationsStatus(2_000)).toBe('WATCH'); expect(foundationsStatus(1_999)).toBe('BREACHED');
    expect(noiseStatus(150, 100)).toBe('KEPT'); expect(noiseStatus(300, 100)).toBe('WATCH'); expect(noiseStatus(301, 100)).toBe('BREACHED'); expect(noiseStatus(0, 0)).toBe('KEPT');
    expect(neighboursStatus(1)).toBe('KEPT'); expect(neighboursStatus(2)).toBe('WATCH'); expect(neighboursStatus(3)).toBe('BREACHED');
  });
  it('curve check', () => {
    expect(isOnCurve(DEV)).toBe(true);
    expect(isOnCurve(PDA_OWNER)).toBe(false);
    expect(isOnCurve('nope')).toBe(false);
  });
});

describe('clause evaluation + state machine', () => {
  const f = (id: Finding['id'], clauses: Record<string, string>): Finding => ({ id, status: 'KEPT', summary: '', source: { label: '' }, ms: 0, evidence: { clauses } });
  it('maps findings to clauses; ar is the worst of mint and freeze', async () => {
    const lease = await makeLease({ c: { ar: 1, dm: 5, ml: 1 } });
    const s = clauseStatuses(lease, [f('mint', { ar: 'KEPT' }), f('freeze', { ar: 'BREACHED' }), f('tenant', { dm: 'KEPT' })]);
    expect(s).toEqual({ ar: 'BREACHED', ml: 'UNVERIFIABLE', dm: 'KEPT' });
    expect(clauseStatuses(lease, [{ ...f('mint', {}), evidence: undefined }]).ar).toBe('UNVERIFIABLE');
  });
  it('two-round rule; authority breach is immediate; transient failures never evict', () => {
    let r = newRecord(1000, 7);
    r = applyRound(r, { tt: 'BREACHED' }, 1100);
    expect(r.state).toBe('ACTIVE');
    expect(r.pendingBreach.tt).toBe(1100);
    r = applyRound(r, { tt: 'UNVERIFIABLE' }, 1200); // RPC blip keeps the streak but doesn't evict
    expect(r.state).toBe('ACTIVE');
    r = applyRound(r, { tt: 'KEPT' }, 1300); // recovered => streak resets
    expect(r.pendingBreach.tt).toBeUndefined();
    r = applyRound(r, { tt: 'BREACHED' }, 1400);
    r = applyRound(r, { tt: 'BREACHED' }, 1500);
    expect(r).toMatchObject({ state: 'EVICTED', breachedClause: 'tt', stateAt: 1500 });
    expect(applyRound(r, { tt: 'KEPT' }, 99999)).toBe(r); // permanent
    const a = applyRound(newRecord(0, 7), { ar: 'BREACHED' }, 5);
    expect(a).toMatchObject({ state: 'EVICTED', breachedClause: 'ar' });
  });
  it('renews when the term ends clean', () => {
    const rec = newRecord(0, 7);
    expect(applyRound(rec, { ar: 'KEPT', dm: undefined }, 86400 * 3).state).toBe('ACTIVE');
    const done = applyRound(rec, { ar: 'KEPT' }, endsAt(rec));
    expect(done).toMatchObject({ state: 'RENEWED', stateAt: endsAt(rec) });
  });
  it('live state and day counter', async () => {
    const lease = await makeLease({ t0: 0, term: 7 });
    expect(liveState(lease, { ar: 'BREACHED' }, 10)).toBe('EVICTED');
    expect(liveState(lease, { ar: 'KEPT' }, 10)).toBe('ACTIVE');
    expect(liveState(lease, { ar: 'KEPT' }, 86400 * 8)).toBe('RENEWED');
    expect(dayOf(0, 0, 7)).toBe(1);
    expect(dayOf(0, 86400 * 3, 7)).toBe(4);
    expect(dayOf(0, 86400 * 100, 7)).toBe(7);
  });
});
