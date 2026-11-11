import { decodeMemo, stripMemoLength } from '../chain/memo';
import { fingerprint } from './canonical';
import type { Lease } from './schema';
import { verifyLease } from './verify';

export interface RawEntry {
  memo: string;
  feePayer: string;
  blockTime: number;
  signature: string;
}
export type Rejection = 'prefix' | 'payload' | 'signature' | 'payer' | 'not-mint' | 'duplicate';
export type Validated =
  | { ok: true; lease: Lease; fp: string; blockTime: number; tx: string }
  | { ok: false; reason: Rejection };

export interface ValidateOpts {
  seen: Set<string>;
  isMint: (mint: string) => Promise<boolean>;
}

/** Same logic in browser and in Actions. First recording of a fingerprint wins. */
export async function validateEntry(e: RawEntry, o: ValidateOpts): Promise<Validated> {
  const memo = stripMemoLength(e.memo);
  if (!memo.startsWith('LEASE1:')) return { ok: false, reason: 'prefix' };
  const lease = decodeMemo(memo);
  if (!lease) return { ok: false, reason: 'payload' };
  if (!(await verifyLease(lease))) return { ok: false, reason: 'signature' };
  if (e.feePayer !== lease.dev) return { ok: false, reason: 'payer' };
  const fp = await fingerprint(lease);
  if (o.seen.has(fp)) return { ok: false, reason: 'duplicate' };
  if (!(await o.isMint(lease.mint))) return { ok: false, reason: 'not-mint' };
  o.seen.add(fp);
  return { ok: true, lease, fp, blockTime: e.blockTime, tx: e.signature };
}
