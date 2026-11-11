import { parseLease, type Lease } from './schema';
import { canonicalJson } from './canonical';

export const MAX_PAYLOAD_BYTES = 2048;

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad base64url');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeLease(l: Lease): string {
  const bytes = new TextEncoder().encode(canonicalJson(l));
  if (bytes.length > MAX_PAYLOAD_BYTES) throw new Error('lease payload too large');
  return b64urlEncode(bytes);
}

/** Decode a `#/l/:payload` string. Gives null for anything malformed or oversize. */
export function decodeLease(payload: string): Lease | null {
  try {
    if (payload.length > Math.ceil((MAX_PAYLOAD_BYTES * 4) / 3) + 4) return null;
    const bytes = b64urlDecode(payload);
    if (bytes.length > MAX_PAYLOAD_BYTES) return null;
    return parseLease(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch {
    return null;
  }
}
