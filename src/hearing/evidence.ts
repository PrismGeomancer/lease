import { getParsedTx, getSignatures } from '../chain/rpc';
import { isOnCurve } from '../chain/pda';
import { mintInfo, pairsOf, pctOf } from '../inspectors/common';
import type { InspectCtx } from '../types';

export interface SaleRow {
  signature: string;
  t: number | null;
  amount: string;
  pct: number;
  kind: 'liquidity pool' | 'another wallet' | 'program' | 'unknown';
  label: string;
}

const LABEL: Record<SaleRow['kind'], string> = {
  'liquidity pool': 'sold into a pool',
  'another wallet': 'moved to another wallet',
  program: 'sent to a program',
  unknown: 'destination unclear',
};

/** Dev token outflows since lease start (max 200 txs). Counterparty classified from balance deltas. */
export async function devSales(ctx: InspectCtx): Promise<SaleRow[]> {
  const lease = ctx.lease;
  if (!lease) return [];
  const [m, pairs] = await Promise.all([mintInfo(ctx), pairsOf(ctx).catch(() => [])]);
  const supply = BigInt(m.supply);
  const pairAddrs = new Set(pairs.map((p) => p.pairAddress));
  const sigs = (await getSignatures(ctx.rpc, lease.dev, { limit: 200 })).filter(
    (s) => !s.err && (s.blockTime ?? 0) >= lease.t0,
  );
  const rows: SaleRow[] = [];
  for (const s of sigs) {
    const tx = await getParsedTx(ctx.rpc, s.signature);
    const pre = tx?.meta?.preTokenBalances ?? [];
    const post = tx?.meta?.postTokenBalances ?? [];
    const total = (list: typeof pre) =>
      list.filter((b) => b.mint === ctx.mint && b.owner === lease.dev).reduce((n, b) => n + BigInt(b.uiTokenAmount.amount), 0n);
    const delta = total(post) - total(pre);
    if (delta >= 0n) continue;
    const out = -delta;
    const gains = post
      .filter((b) => b.mint === ctx.mint && b.owner && b.owner !== lease.dev)
      .map((b) => {
        const before = pre.find((p) => p.accountIndex === b.accountIndex);
        return { owner: b.owner!, d: BigInt(b.uiTokenAmount.amount) - BigInt(before?.uiTokenAmount.amount ?? '0') };
      })
      .filter((g) => g.d > 0n)
      .sort((a, b) => (b.d > a.d ? 1 : -1));
    const top = gains[0];
    const kind: SaleRow['kind'] = !top
      ? 'unknown'
      : pairAddrs.has(top.owner)
        ? 'liquidity pool'
        : isOnCurve(top.owner)
          ? 'another wallet'
          : 'program';
    rows.push({ signature: s.signature, t: s.blockTime, amount: out.toString(), pct: pctOf(out, supply), kind, label: LABEL[kind] });
  }
  return rows;
}
