import * as ed from '@noble/ed25519';
import bs58 from 'bs58';
import { buildMessage } from '../src/lease/message';
import type { Lease, LeaseBody } from '../src/lease/schema';

export const SEED = new Uint8Array(32).map((_, i) => i + 1);
export const MINT = 'So11111111111111111111111111111111111111112';

export async function devAddress(seed = SEED): Promise<string> {
  return bs58.encode(await ed.getPublicKeyAsync(seed));
}

export async function makeLease(over: Partial<LeaseBody> = {}, seed = SEED): Promise<Lease> {
  const body: LeaseBody = {
    v: 1,
    mint: MINT,
    dev: await devAddress(seed),
    t0: 1_760_000_000,
    term: 30,
    b0: '1000000000',
    c: { ar: 1, ml: 1, dm: 5, ns: 14, lp: 1, tt: 40, liq: 5000 },
    ...over,
  };
  const msg = new TextEncoder().encode(await buildMessage(body));
  const sig = bs58.encode(await ed.signAsync(msg, seed));
  return { ...body, sig };
}

export function worstCaseBody(dev: string): LeaseBody {
  return {
    v: 1,
    mint: MINT,
    dev,
    t0: 1_760_000_000,
    term: 90,
    b0: '18446744073709551615',
    c: { ar: 1, ml: 1, dm: 19.5, ns: 90, lp: 1, lpm: MINT, tt: 79.5, liq: 999999999 },
    n: 'x'.repeat(140),
  };
}
