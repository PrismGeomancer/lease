import type { Inspector, InspectCtx } from '../types';
import { getParsedTx, getSignatures } from '../chain/rpc';
import { isOnCurve } from '../chain/pda';
import { neighboursStatus } from '../thresholds';
import { acct, mk, pairsOf, topHolders } from './common';

async function funderOf(ctx: InspectCtx, wallet: string): Promise<string | null> {
  const cached = ctx.funders?.get(wallet);
  if (cached !== undefined) return cached;
  let f: string | null = null;
  if (ctx.helius) f = await ctx.helius.firstFunder(wallet);
  if (f === null) {
    // Fallback: oldest signature, fee payer if it isn't the wallet itself.
    let before: string | undefined;
    let oldest: string | undefined;
    for (let p = 0; p < 3; p++) {
      const sigs = await getSignatures(ctx.rpc, wallet, { limit: 1000, before });
      if (!sigs.length) break;
      oldest = sigs[sigs.length - 1]!.signature;
      if (sigs.length < 1000) break;
      before = oldest;
    }
    if (oldest) {
      const tx = await getParsedTx(ctx.rpc, oldest);
      const payer = tx?.transaction.message.accountKeys[0]?.pubkey;
      f = payer && payer !== wallet ? payer : null;
    }
  }
  ctx.funders?.set(wallet, f);
  return f;
}

/** Slow. Browser: explicit click only. Actions: always. */
export const neighbours: Inspector = async (ctx) => {
  const source = { label: 'Solana RPC · first incoming SOL', url: acct(ctx, ctx.mint) };
  if (!ctx.runNeighbours) {
    return mk('neighbours', 'UNVERIFIABLE', 'Not run yet. Press "Run Neighbours (slow)".', source, { evidence: { notRun: true } });
  }
  const [h, pairs] = await Promise.all([topHolders(ctx), pairsOf(ctx).catch(() => [])]);
  const pairAddrs = new Set(pairs.map((p) => p.pairAddress));
  const groups = new Map<string, string[]>();
  let traced = 0;
  for (const row of h.rows) {
    let f: string | null = null;
    try { f = await funderOf(ctx, row.owner); } catch { f = null; }
    if (!f) continue;
    traced++;
    if (!isOnCurve(f) || pairAddrs.has(f)) continue; // programs/pools aren't a "person"
    groups.set(f, [...(groups.get(f) ?? []), row.owner]);
  }
  if (traced === 0) return mk('neighbours', 'UNVERIFIABLE', "Couldn't trace where the top wallets got their first SOL.", source);
  let top: [string, string[]] | null = null;
  for (const g of groups) if (!top || g[1].length > top[1].length) top = g;
  const size = top?.[1].length ?? 0;
  const status = neighboursStatus(size);
  const summary = size >= 2 ? `${size} top wallets share one funder.` : 'No shared funder among the top wallets.';
  return mk('neighbours', status, summary, source, {
    value: size,
    evidence: { traced, groups: [...groups].filter(([, w]) => w.length > 1).map(([funder, wallets]) => ({ funder, wallets })) },
  });
};
