import type { Lease } from './schema';
import { applyRound, clauseStatuses, newRecord, type LeaseRecord, type LeaseState } from './evaluate';
import type { LeaseHistory, RoundRecord } from '../lib/dataTypes';
import type { Finding, FindingStatus } from '../types';
import { worst } from '../status';

export const MAX_ROUNDS = 500;

export function newHistory(lease: Lease, tx: string, start: number, nowIso: string): LeaseHistory {
  return {
    schema: 1, generatedAt: nowIso, lease, tx, start, state: 'ACTIVE', stateAt: null, breachedClause: null,
    rounds: [], daily: [], pendingBreach: {},
  };
}

export interface RoundResult {
  history: LeaseHistory;
  /** Set only when the lease changed state in this round. */
  transition: { from: LeaseState; to: LeaseState; clause: string | null } | null;
  worst: FindingStatus;
}

const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/** Apply one round of findings to a lease history. Pure: returns a new history. */
export function processRound(h: LeaseHistory, findings: Finding[], t: number): RoundResult {
  const clauses = clauseStatuses(h.lease, findings);
  const rec: LeaseRecord = {
    start: h.start, term: h.lease.term, state: h.state, stateAt: h.stateAt,
    breachedClause: h.breachedClause as LeaseRecord['breachedClause'], pendingBreach: h.pendingBreach as LeaseRecord['pendingBreach'],
  };
  const next = applyRound(rec, clauses, t);

  const worstStatus = worst(Object.values(clauses) as FindingStatus[]) as FindingStatus;
  const round: RoundRecord = {
    t,
    clause: clauses as Record<string, FindingStatus>,
    findings: findings.map((f) => ({ id: f.id, status: f.status, ...(f.value !== undefined ? { value: f.value } : {}) })),
  };
  const rounds = [...h.rounds, round].slice(-MAX_ROUNDS);

  const d = day(t);
  const daily = h.daily.slice();
  const i = daily.findIndex((x) => x.day === d);
  if (i >= 0) daily[i] = { day: d, worst: worst([daily[i]!.worst, worstStatus]) as FindingStatus };
  else daily.push({ day: d, worst: worstStatus });

  const history: LeaseHistory = {
    ...h, generatedAt: new Date(t * 1000).toISOString(),
    state: next.state, stateAt: next.stateAt, breachedClause: next.breachedClause,
    pendingBreach: next.pendingBreach as Record<string, number>, rounds, daily,
  };
  const transition = next.state !== h.state ? { from: h.state, to: next.state, clause: next.breachedClause } : null;
  return { history, transition, worst: worstStatus };
}

export { newRecord };
