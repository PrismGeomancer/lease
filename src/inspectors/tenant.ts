import type { FindingStatus, Inspector } from '../types';
import { getOwnerBalance } from '../chain/rpc';
import { THRESHOLDS, tenantStatus } from '../thresholds';
import { acct, devWallet, mintInfo, mk, pctOf } from './common';

export const tenant: Inspector = async (ctx) => {
  const [m, dev] = await Promise.all([mintInfo(ctx), devWallet(ctx)]);
  const source = { label: 'Solana RPC · dev token balance', url: dev ? acct(ctx, dev.address) : undefined };
  if (!dev) return mk('tenant', 'UNVERIFIABLE', "Couldn't trace the dev wallet. Too much history.", source);
  const supply = BigInt(m.supply);
  if (supply === 0n) return mk('tenant', 'UNVERIFIABLE', 'Supply is zero.', source);
  const bal = await getOwnerBalance(ctx.rpc, dev.address, ctx.mint);
  const pct = pctOf(bal, supply);
  const lease = ctx.lease;

  const dm = tenantStatus(pct, lease?.c.dm, dev.inferred);
  const clauses: Record<string, FindingStatus> = {};
  if (lease?.c.dm !== undefined) clauses.dm = dm;

  let ns: FindingStatus | null = null;
  if (lease?.c.ns !== undefined) {
    const nowSec = ctx.now / 1000;
    const end = lease.t0 + lease.c.ns * 86400;
    const b0 = BigInt(lease.b0);
    const floor = b0 - (b0 * BigInt(Math.round(THRESHOLDS.nsTolerance * 10000))) / 10000n;
    if (nowSec < lease.t0) ns = 'PENDING';
    else if (b0 === 0n) ns = 'UNVERIFIABLE';
    else if (bal >= floor) ns = 'KEPT';
    else ns = nowSec <= end ? 'BREACHED' : 'UNVERIFIABLE'; // after the window, only round history can say
    clauses.ns = ns;
  }

  const statuses: FindingStatus[] = [dm, ...(ns && ns !== 'PENDING' ? [ns] : [])];
  const status: FindingStatus = statuses.includes('BREACHED') ? 'BREACHED' : statuses.includes('WATCH') ? 'WATCH' : statuses.includes('UNVERIFIABLE') ? 'UNVERIFIABLE' : 'KEPT';
  const summary = dev.inferred
    ? `Dev wallet inferred from the first transaction. Treat with care. It holds ${pct}%.`
    : `Dev wallet holds ${pct}% of supply.`;
  return mk('tenant', status, summary, source, {
    value: `${pct}%`,
    evidence: { clauses, dev: dev.address, inferred: dev.inferred, pct, balance: bal.toString(), b0: lease?.b0 },
  });
};
