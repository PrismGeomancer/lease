import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

export const METAPLEX_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/** True when the 32 bytes decode to a point on the ed25519 curve (i.e. a normal wallet, not a PDA). */
export function isOnCurve(address: string): boolean {
  try {
    const bytes = bs58.decode(address);
    if (bytes.length !== 32) return false;
    ed.Point.fromHex(ed.etc.bytesToHex(bytes));
    return true;
  } catch {
    return false;
  }
}

export async function findPda(seeds: Uint8Array[], programId: string): Promise<string> {
  const program = bs58.decode(programId);
  const tag = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), program, tag];
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    try {
      ed.Point.fromHex(ed.etc.bytesToHex(hash));
    } catch {
      return bs58.encode(hash);
    }
  }
  throw new Error('no PDA');
}

export async function metadataPda(mint: string): Promise<string> {
  return findPda([new TextEncoder().encode('metadata'), bs58.decode(METAPLEX_PROGRAM), bs58.decode(mint)], METAPLEX_PROGRAM);
}

export interface MetaplexMetadata { updateAuthority: string; name: string; symbol: string; uri: string; isMutable: boolean }

/** Minimal Borsh reader for the Metaplex Token Metadata account (name, symbol, uri, isMutable). */
export function parseMetaplexMetadata(d: Uint8Array): MetaplexMetadata {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let o = 1; // key
  const updateAuthority = bs58.encode(d.slice(o, o + 32)); o += 32;
  o += 32; // mint
  const str = () => {
    const len = dv.getUint32(o, true); o += 4;
    if (len > 1000 || o + len > d.length) throw new Error('bad metadata string');
    const s = new TextDecoder().decode(d.slice(o, o + len)).replace(/\0+$/, ''); o += len;
    return s;
  };
  const name = str(); const symbol = str(); const uri = str();
  o += 2; // seller fee
  if (d[o++] === 1) { const n = dv.getUint32(o, true); o += 4; o += n * 34; } // creators
  o += 1; // primarySaleHappened
  const isMutable = d[o] === 1;
  return { updateAuthority, name, symbol, uri, isMutable };
}
