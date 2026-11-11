import * as ed from '@noble/ed25519';
import bs58 from 'bs58';
import type { Lease } from './schema';
import { buildMessage } from './message';

/** Verify the dev's ed25519 signature over the rebuilt message. Never throws. */
export async function verifyLease(l: Lease): Promise<boolean> {
  try {
    const msg = new TextEncoder().encode(await buildMessage(l));
    return await ed.verifyAsync(bs58.decode(l.sig), msg, bs58.decode(l.dev));
  } catch {
    return false;
  }
}
