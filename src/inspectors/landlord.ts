import type { Inspector } from '../types';
import { landlordStatus } from '../thresholds';
import { acct, mk, topHolders } from './common';

export const landlord: Inspector = async (ctx) => {
  const source = { label: 'Solana RPC · largest token accounts', url: acct(ctx, ctx.mint) };
  let h;
  try {
    h = await topHolders(ctx);
  } catch (e) {
    if (/too many accounts|overloaded/i.test((e as Error).message)) {
      return mk('landlord', 'UNVERIFIABLE', "Too many holders for the RPC to list. Marked UNVERIFIABLE, not guilty.", source, { evidence: { clauses: { tt: 'UNVERIFIABLE' } } });
    }
    throw e;
  }
  if (h.supply === 0n || h.rows.length === 0) {
    return mk('landlord', 'UNVERIFIABLE', 'No ordinary holders found to measure.', source, { evidence: { clauses: { tt: 'UNVERIFIABLE' } } });
  }
  const sum = h.rows.reduce((s, r) => s + r.amount, 0n);
  const pct = Number((sum * 10000n) / h.supply) / 100;
  const status = landlordStatus(pct, ctx.lease?.c.tt);
  return mk('landlord', status, `Top 10 wallets hold ${pct}% (pools excluded).`, source, {
    value: `${pct}%`,
    evidence: {
      clauses: { tt: landlordStatus(pct, ctx.lease?.c.tt) },
      pct,
      holders: h.rows.map((r) => ({ owner: r.owner, pct: r.pct })),
      excluded: h.excluded,
    },
  });
};
