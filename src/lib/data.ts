import { CONFIG } from '../config';
import type { Bulletin, LeaseHistory, LeaseOwn, Office, Register, TokenFacts } from './dataTypes';
import { parseLease } from '../lease/schema';

const warned = new Set<string>();
async function load<T>(file: string, guard: (x: unknown) => x is T): Promise<T | null> {
  try {
    const r = await fetch(`${CONFIG.DATA_BASE}${file}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as unknown;
    if (!guard(j)) throw new Error('unexpected shape');
    return j;
  } catch (e) {
    if (!warned.has(file)) {
      warned.add(file);
      console.warn(`[lease] data file ${file} unavailable, treating as empty:`, (e as Error).message);
    }
    return null;
  }
}

const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const base = (x: unknown): x is Record<string, unknown> => obj(x) && x.schema === 1;
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);

export const isOffice = (x: unknown): x is Office =>
  base(x) && obj(x.counts) && ['onFile', 'active', 'renewed', 'evicted'].every((k) => num((x.counts as Record<string, unknown>)[k]));
export const isRegister = (x: unknown): x is Register =>
  base(x) && Array.isArray(x.leases) && x.leases.every((l) => obj(l) && typeof l.fp === 'string' && typeof l.mint === 'string' && typeof l.dev === 'string' && num(l.term) && num(l.start));
export const isBulletin = (x: unknown): x is Bulletin =>
  base(x) && Array.isArray(x.items) && x.items.every((i) => obj(i) && num(i.t) && typeof i.fp === 'string');
export const isToken = (x: unknown): x is TokenFacts => base(x);
export const isOwn = (x: unknown): x is LeaseOwn => base(x) && (x.lease === null || parseLease(x.lease) !== null);
export const isHistory = (x: unknown): x is LeaseHistory => base(x) && Array.isArray(x.rounds) && Array.isArray(x.daily) && parseLease(x.lease) !== null;

export const loadOffice = () => load('office.json', isOffice);
export const loadRegister = () => load('register.json', isRegister);
export const loadBulletin = () => load('bulletin.json', isBulletin);
export const loadToken = () => load('token.json', isToken);
export const loadOwnLease = () => load('lease-own.json', isOwn);
export const loadHistory = (fp: string) => (/^[0-9a-f]{64}$/.test(fp) ? load(`leases/${fp}.json`, isHistory) : Promise.resolve(null));
