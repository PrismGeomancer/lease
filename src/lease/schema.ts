import bs58 from 'bs58';

export const TERMS = [7, 14, 30, 60, 90] as const;
export type Term = (typeof TERMS)[number];
export const CLAUSE_ORDER = ['ar', 'ml', 'dm', 'ns', 'lp', 'tt', 'liq'] as const;
export type ClauseKey = (typeof CLAUSE_ORDER)[number];

export interface Clauses {
  ar?: 1;
  ml?: 1;
  dm?: number;
  ns?: number;
  lp?: 1;
  lpm?: string;
  tt?: number;
  liq?: number;
}

export interface Lease {
  v: 1;
  mint: string;
  dev: string;
  t0: number;
  term: Term;
  b0: string;
  c: Clauses;
  n?: string;
  sig: string;
}

export type LeaseBody = Omit<Lease, 'sig'>;

export const MAX_NOTE = 140;

export function isAddress(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false;
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

function isSig(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 64 || s.length > 90) return false;
  try {
    return bs58.decode(s).length === 64;
  } catch {
    return false;
  }
}

const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

/** Strict shape guard. Gives a clean Lease or null. Never throws. */
export function parseLease(x: unknown): Lease | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const topKeys = new Set(['v', 'mint', 'dev', 't0', 'term', 'b0', 'c', 'n', 'sig']);
  if (Object.keys(o).some((k) => !topKeys.has(k))) return null;
  if (o.v !== 1) return null;
  if (!isAddress(o.mint) || !isAddress(o.dev)) return null;
  if (!Number.isInteger(o.t0) || (o.t0 as number) <= 0 || (o.t0 as number) > 4102444800) return null;
  if (!TERMS.includes(o.term as Term)) return null;
  if (typeof o.b0 !== 'string' || !/^\d{1,20}$/.test(o.b0)) return null;
  if (!isSig(o.sig)) return null;
  if (o.n !== undefined && (typeof o.n !== 'string' || [...o.n].length > MAX_NOTE || CONTROL.test(o.n))) return null;
  if (typeof o.c !== 'object' || o.c === null || Array.isArray(o.c)) return null;
  const c = o.c as Record<string, unknown>;
  const clauseKeys = new Set<string>([...CLAUSE_ORDER, 'lpm']);
  if (Object.keys(c).some((k) => !clauseKeys.has(k))) return null;
  const term = o.term as number;
  if (c.ar !== undefined && c.ar !== 1) return null;
  if (c.ml !== undefined && c.ml !== 1) return null;
  if (c.lp !== undefined && c.lp !== 1) return null;
  if (c.dm !== undefined && !inRange(c.dm, 0.1, 20)) return null;
  if (c.ns !== undefined && !(Number.isInteger(c.ns) && inRange(c.ns, 1, term))) return null;
  if (c.tt !== undefined && !inRange(c.tt, 10, 80)) return null;
  if (c.liq !== undefined && !inRange(c.liq, 1, 1e12)) return null;
  if (c.lpm !== undefined && !isAddress(c.lpm)) return null;
  if (c.lpm !== undefined && c.lp !== 1) return null;
  if (!CLAUSE_ORDER.some((k) => c[k] !== undefined)) return null; // at least one clause
  return x as Lease;
}

export function stripSig(l: Lease): LeaseBody {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sig: _sig, ...body } = l;
  return body;
}
