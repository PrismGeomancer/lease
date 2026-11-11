import { CONFIG } from '../config';
import { bestPair, type Pair } from '../chain/dex';
import { isOnCurve } from '../chain/pda';
import {
  getLargestAccounts, getMultipleParsed, getParsedMint, getParsedTx, getSignatures, type ParsedMint,
} from '../chain/rpc';
import type { Finding, FindingStatus, InspectCtx, InspectorId } from '../types';

export class NotMintError extends Error {}

export const INCINERATOR = '1nc1nerator11111111111111111111111111111111';

export const acct = (ctx: InspectCtx, a: string) => `${ctx.explorerAccount ?? CONFIG.EXPLORER_ACCOUNT}${a}`;
export const txUrl = (ctx: InspectCtx, s: string) => `${ctx.explorerTx ?? CONFIG.EXPLORER_TX}${s}`;

export function memoize<T>(ctx: InspectCtx, key: string, fn: () => Promise<T>): Promise<T> {
  let p = ctx.memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    ctx.memo.set(key, p);
  }
  return p;
}

export function mk(
  id: InspectorId, status: FindingStatus, summary: string, source: Finding['source'],
  extra: { value?: string | number; evidence?: Record<string, unknown> } = {},
): Finding {
  return { id, status, summary, source, ms: 0, ...extra };
}

export function mintInfo(ctx: InspectCtx): Promise<ParsedMint> {
  return memoize(ctx, 'mint', async () => {
    const m = await getParsedMint(ctx.rpc, ctx.mint);
    if (!m) throw new NotMintError('not a mint');
    return m;
  });
}

export function pairsOf(ctx: InspectCtx): Promise<Pair[]> {
  return memoize(ctx, 'pairs', () => ctx.dex.pairs(ctx.mint));
}
export async function bestPairOf(ctx: InspectCtx): Promise<Pair | null> {
  return bestPair(await pairsOf(ctx));
}

/** pct with 2 decimals using bigint math */
export function pctOf(amount: bigint, supply: bigint): number {
  if (supply === 0n) return 0;
  return Number((amount * 10000n) / supply) / 100;
}

export interface HolderRow { owner: string; tokenAccount: string; amount: bigint; pct: number }
export interface Holders {
  rows: HolderRow[]; // top 10 after exclusions
  excluded: { owner: string; tokenAccount: string; amount: string; reason: string }[];
  supply: bigint;
}

/** Top-10 holders excluding pools/programs (off-curve owners) and DexScreener pair addresses. */
export function topHolders(ctx: InspectCtx): Promise<Holders> {
  return memoize(ctx, 'holders', async () => {
    const [m, largest, pairs] = await Promise.all([mintInfo(ctx), getLargestAccounts(ctx.rpc, ctx.mint), pairsOf(ctx).catch(() => [] as Pair[])]);
    const supply = BigInt(m.supply);
    const accounts = await getMultipleParsed(ctx.rpc, largest.map((l) => l.address));
    const pairAddrs = new Set(pairs.map((p) => p.pairAddress));
    const rows: HolderRow[] = [];
    const excluded: Holders['excluded'] = [];
    largest.forEach((l, i) => {
      const data = accounts[i]?.data;
      const owner = !Array.isArray(data) ? (data?.parsed?.info?.owner as string | undefined) : undefined;
      if (!owner) return;
      const reason =
        pairAddrs.has(owner) || pairAddrs.has(l.address) ? 'DexScreener pair'
        : owner === INCINERATOR ? 'incinerator'
        : !isOnCurve(owner) ? 'off-curve owner (pool or program)'
        : null;
      const amount = BigInt(l.amount);
      if (reason) excluded.push({ owner, tokenAccount: l.address, amount: l.amount, reason });
      else if (rows.length < 10) rows.push({ owner, tokenAccount: l.address, amount, pct: pctOf(amount, supply) });
    });
    return { rows, excluded, supply };
  });
}

/** Dev wallet: lease.dev, or inferred as fee payer of the oldest signature on the mint. */
export function devWallet(ctx: InspectCtx): Promise<{ address: string; inferred: boolean } | null> {
  return memoize(ctx, 'dev', async () => {
    if (ctx.lease) return { address: ctx.lease.dev, inferred: false };
    let before: string | undefined;
    let oldest: string | undefined;
    for (let page = 0; page < 5; page++) {
      const sigs = await getSignatures(ctx.rpc, ctx.mint, { limit: 1000, before });
      if (sigs.length === 0) break;
      oldest = sigs[sigs.length - 1]!.signature;
      if (sigs.length < 1000) {
        const tx = await getParsedTx(ctx.rpc, oldest);
        const payer = tx?.transaction.message.accountKeys[0]?.pubkey;
        return payer ? { address: payer, inferred: true } : null;
      }
      before = oldest;
    }
    return null; // too much history to trace cheaply
  });
}
