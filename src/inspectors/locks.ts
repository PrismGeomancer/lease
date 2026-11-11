import type { FindingStatus, Inspector } from '../types';
import { getLargestAccounts, getMultipleParsed, getParsedMint } from '../chain/rpc';
import { isOnCurve } from '../chain/pda';
import { INCINERATOR, acct, bestPairOf, mk, pctOf } from './common';

/**
 * LP rules (document every rule with its source):
 * - dexId 'pumpfun': pump.fun bonding curve. There is no LP token to pull; liquidity sits in the
 *   curve's own accounts. https://github.com/pump-fun/pump-public-docs
 * - 'pumpswap' / 'raydium' / others: LP custody depends on how the pool was created. We have NOT
 *   verified a protocol-level burn guarantee for these, so without a lease-provided `lpm` they are
 *   UNVERIFIABLE rather than guessed.
 * - lease.c.lpm given: check the LP mint. >=95% held by the incinerator => KEPT. Largest holder is an
 *   ordinary wallet with >5% => BREACHED. Otherwise (locker/program custody) => UNVERIFIABLE.
 */
export const locks: Inspector = async (ctx) => {
  const pair = await bestPairOf(ctx);
  const source = { label: 'DexScreener + LP mint', url: pair?.url };
  const clause = (s: FindingStatus) => ({ clauses: { lp: s } });
  const lpm = ctx.lease?.c.lpm;

  if (lpm) {
    const [mintInfo, largest] = await Promise.all([getParsedMint(ctx.rpc, lpm), getLargestAccounts(ctx.rpc, lpm)]);
    if (!mintInfo) return mk('locks', 'UNVERIFIABLE', "The LP mint isn't a token.", source, { evidence: clause('UNVERIFIABLE') });
    const supply = BigInt(mintInfo.supply);
    const accounts = await getMultipleParsed(ctx.rpc, largest.map((l) => l.address));
    let burned = 0n;
    let topWalletPct = 0;
    largest.forEach((l, i) => {
      const d = accounts[i]?.data;
      const owner = !Array.isArray(d) ? (d?.parsed?.info?.owner as string | undefined) : undefined;
      if (owner === INCINERATOR) burned += BigInt(l.amount);
      else if (owner && isOnCurve(owner)) topWalletPct = Math.max(topWalletPct, pctOf(BigInt(l.amount), supply));
    });
    const burnedPct = pctOf(burned, supply);
    const src = { label: 'Solana RPC · LP mint', url: acct(ctx, lpm) };
    if (supply === 0n || burnedPct >= 95) {
      return mk('locks', 'KEPT', supply === 0n ? 'LP supply is fully burned.' : `${burnedPct}% of LP tokens are burned.`, src, { value: `${burnedPct}%`, evidence: clause('KEPT') });
    }
    if (topWalletPct > 5) {
      return mk('locks', 'BREACHED', `An ordinary wallet holds ${topWalletPct}% of LP tokens.`, src, { value: `${topWalletPct}%`, evidence: clause('BREACHED') });
    }
    return mk('locks', 'UNVERIFIABLE', "LP isn't burned and its custody can't be confirmed as locked.", src, { evidence: clause('UNVERIFIABLE') });
  }

  if (!pair) return mk('locks', 'UNVERIFIABLE', "LP status can't be confirmed: no market found.", source, { evidence: clause('UNVERIFIABLE') });
  if (pair.dexId === 'pumpfun') {
    return mk('locks', 'KEPT', 'Bonding curve: no LP to pull.', source, { value: 'bonding curve', evidence: { ...clause('KEPT'), dexId: pair.dexId } });
  }
  return mk('locks', 'UNVERIFIABLE', "LP status can't be confirmed for this pool type.", source, { evidence: { ...clause('UNVERIFIABLE'), dexId: pair.dexId } });
};
