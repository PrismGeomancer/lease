import { CLAUSE_ORDER, type ClauseKey, type Lease } from './schema';
import type { Finding, FindingStatus } from '../types';

export type LeaseState = 'ACTIVE' | 'RENEWED' | 'EVICTED';
export type ClauseStatuses = Partial<Record<ClauseKey, FindingStatus>>;

const RANK: Record<FindingStatus, number> = { KEPT: 0, PENDING: 1, UNVERIFIABLE: 2, WATCH: 3, BREACHED: 4 };

/** Map findings to the lease's own clauses. Worst status among contributing inspectors wins. */
export function clauseStatuses(lease: Lease, findings: Finding[]): ClauseStatuses {
  const out: ClauseStatuses = {};
  for (const key of CLAUSE_ORDER) {
    if (lease.c[key] === undefined) continue;
    let w: FindingStatus | null = null;
    for (const f of findings) {
      const s = (f.evidence?.clauses as Record<string, FindingStatus> | undefined)?.[key];
      if (s && (w === null || RANK[s] > RANK[w])) w = s;
    }
    out[key] = w ?? 'UNVERIFIABLE';
  }
  return out;
}

export interface LeaseRecord {
  start: number; // unix s (blockTime when recorded)
  term: number; // days
  state: LeaseState;
  stateAt: number | null;
  breachedClause: ClauseKey | null;
  /** clause -> first time breach was observed (for the two-round rule) */
  pendingBreach: Partial<Record<ClauseKey, number>>;
}

export function newRecord(start: number, term: number): LeaseRecord {
  return { start, term, state: 'ACTIVE', stateAt: null, breachedClause: null, pendingBreach: {} };
}

/** Authority checks are deterministic; everything else needs the breach seen in two consecutive rounds. */
const DETERMINISTIC: ClauseKey[] = ['ar'];

export function endsAt(rec: Pick<LeaseRecord, 'start' | 'term'>): number {
  return rec.start + rec.term * 86400;
}

/** One office round. Transitions are permanent. A transient RPC failure (UNVERIFIABLE) never evicts. */
export function applyRound(rec: LeaseRecord, clauses: ClauseStatuses, t: number): LeaseRecord {
  if (rec.state !== 'ACTIVE') return rec;
  const next: LeaseRecord = { ...rec, pendingBreach: { ...rec.pendingBreach } };
  for (const key of CLAUSE_ORDER) {
    const s = clauses[key];
    if (s === undefined) continue;
    if (s === 'BREACHED') {
      if (DETERMINISTIC.includes(key) || next.pendingBreach[key] !== undefined) {
        return { ...next, state: 'EVICTED', stateAt: t, breachedClause: key };
      }
      next.pendingBreach[key] = t;
    } else if (s !== 'UNVERIFIABLE') {
      delete next.pendingBreach[key]; // observed fine: reset the streak. UNVERIFIABLE keeps it.
    }
  }
  if (t >= endsAt(rec)) return { ...next, state: 'RENEWED', stateAt: endsAt(rec) };
  return next;
}

/** Live-only state for link-only leases (no history). */
export function liveState(lease: Lease, clauses: ClauseStatuses, nowSec: number): LeaseState {
  if (Object.values(clauses).includes('BREACHED')) return 'EVICTED';
  return nowSec >= lease.t0 + lease.term * 86400 ? 'RENEWED' : 'ACTIVE';
}

export function dayOf(startSec: number, nowSec: number, term: number): number {
  return Math.min(term, Math.max(1, Math.floor((nowSec - startSec) / 86400) + 1));
}
