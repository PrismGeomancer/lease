import type { Lease, LeaseBody } from './schema';
import { stripSig } from './schema';

/** Canonical JSON: keys sorted recursively, no whitespace. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function canonicalBody(l: Lease | LeaseBody): string {
  const body = 'sig' in l ? stripSig(l as Lease) : l;
  return canonicalJson(body);
}

/** Full hex fingerprint of the lease without its signature. */
export async function fingerprint(l: Lease | LeaseBody): Promise<string> {
  return sha256Hex(canonicalBody(l));
}

/** Display form: first 12 chars grouped a1b2-c3d4-e5f6. */
export function shortFingerprint(fp: string): string {
  const s = fp.slice(0, 12);
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
