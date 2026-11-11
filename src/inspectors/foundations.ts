import type { Inspector } from '../types';
import { foundationsStatus } from '../thresholds';
import { bestPairOf, mk } from './common';

export const foundations: Inspector = async (ctx) => {
  const pair = await bestPairOf(ctx);
  const source = { label: 'DexScreener', url: pair?.url };
  if (!pair) return mk('foundations', 'UNVERIFIABLE', 'No market found for this token.', source, { evidence: { clauses: { liq: 'UNVERIFIABLE' } } });
  const usd = pair.liquidity?.usd ?? 0;
  const status = foundationsStatus(usd, ctx.lease?.c.liq);
  const ageDays = pair.pairCreatedAt ? Math.floor((ctx.now - pair.pairCreatedAt) / 86_400_000) : null;
  const usdText = Math.round(usd).toLocaleString('en-US');
  return mk('foundations', status, `Liquidity is $${usdText}${ageDays !== null ? `, pair is ${ageDays} days old` : ''}.`, source, {
    value: usd,
    evidence: { clauses: { liq: status }, liquidityUsd: usd, ageDays, dexId: pair.dexId, pair: pair.pairAddress },
  });
};
