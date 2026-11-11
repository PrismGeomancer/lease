import { canonicalJson } from '../lease/canonical';
import { parseLease, type Lease } from '../lease/schema';

export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MEMO_PREFIX = 'LEASE1:';
export const MEMO_MAX_BYTES = 560;

/**
 * Memo = "LEASE1:" + compact canonical JSON (incl. sig).
 * Note: raw JSON rather than base64url, because base64 of the worst-case lease
 * would exceed 560 bytes. Memo v2 accepts any valid UTF-8.
 */
export function encodeMemo(l: Lease): string {
  const memo = MEMO_PREFIX + canonicalJson(l);
  if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) {
    throw new Error('memo too large: shorten the dev note');
  }
  return memo;
}

export function decodeMemo(memo: string): Lease | null {
  if (typeof memo !== 'string' || !memo.startsWith(MEMO_PREFIX)) return null;
  const json = memo.slice(MEMO_PREFIX.length);
  if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) return null;
  try {
    return parseLease(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Solana RPC returns memo log text as `[len] <memo>`; getSignaturesForAddress `memo` field likewise. */
export function stripMemoLength(raw: string): string {
  return raw.replace(/^\[\d+\]\s/, '');
}
