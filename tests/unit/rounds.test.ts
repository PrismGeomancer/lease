import { describe, it, expect } from 'vitest';
import { newHistory, processRound, MAX_ROUNDS } from '../../src/lease/rounds';
import { makeLease } from '../helpers';
import type { Finding } from '../../src/types';

const f = (id: Finding['id'], clauses: Record<string, string>, status: Finding['status'] = 'KEPT'): Finding =>
  ({ id, status, summary: '', source: { label: '' }, ms: 0, evidence: { clauses } });
const T = 1_760_000_000;

describe('processRound', () => {
  it('records rounds and a daily worst-of summary', async () => {
    const lease = await makeLease({ t0: T, term: 7, c: { ar: 1, tt: 40 } });
    let h = newHistory(lease, 'tx', T, 'x');
    let r = processRound(h, [f('mint', { ar: 'KEPT' }), f('freeze', { ar: 'KEPT' }), f('landlord', { tt: 'KEPT' })], T + 60);
    expect(r.transition).toBeNull();
    expect(r.worst).toBe('KEPT');
    h = r.history;
    r = processRound(h, [f('mint', { ar: 'KEPT' }), f('landlord', { tt: 'WATCH' })], T + 120);
    expect(r.history.rounds).toHaveLength(2);
    expect(r.history.daily).toHaveLength(1);
    expect(r.history.daily[0]!.worst).toBe('WATCH');
  });
  it('needs two consecutive rounds for a non-authority breach, then evicts permanently and reports the transition once', async () => {
    const lease = await makeLease({ t0: T, term: 7, c: { tt: 40 } });
    let h = newHistory(lease, 'tx', T, 'x');
    const bad = [f('landlord', { tt: 'BREACHED' }, 'BREACHED')];
    let r = processRound(h, bad, T + 100);
    expect(r.history.state).toBe('ACTIVE');
    expect(r.history.pendingBreach.tt).toBe(T + 100);
    h = r.history;
    r = processRound(h, bad, T + 200);
    expect(r.transition).toEqual({ from: 'ACTIVE', to: 'EVICTED', clause: 'tt' });
    h = r.history;
    r = processRound(h, [f('landlord', { tt: 'KEPT' })], T + 300);
    expect(r.history.state).toBe('EVICTED');
    expect(r.transition).toBeNull();
  });
  it('an authority breach evicts immediately', async () => {
    const lease = await makeLease({ t0: T, term: 7, c: { ar: 1 } });
    const r = processRound(newHistory(lease, 'tx', T, 'x'), [f('mint', { ar: 'BREACHED' }, 'BREACHED')], T + 10);
    expect(r.transition?.to).toBe('EVICTED');
  });
  it('UNVERIFIABLE rounds never evict', async () => {
    const lease = await makeLease({ t0: T, term: 7, c: { tt: 40 } });
    let h = newHistory(lease, 'tx', T, 'x');
    for (let i = 1; i <= 5; i++) h = processRound(h, [f('landlord', { tt: 'UNVERIFIABLE' }, 'UNVERIFIABLE')], T + i * 60).history;
    expect(h.state).toBe('ACTIVE');
  });
  it('renews at the end of a clean term; caps rounds at 500', async () => {
    const lease = await makeLease({ t0: T, term: 7, c: { ar: 1 } });
    let h = newHistory(lease, 'tx', T, 'x');
    for (let i = 0; i < MAX_ROUNDS + 5; i++) h = processRound(h, [f('mint', { ar: 'KEPT' })], T + 60 + i).history;
    expect(h.rounds).toHaveLength(MAX_ROUNDS);
    const r = processRound(h, [f('mint', { ar: 'KEPT' })], T + 7 * 86400 + 1);
    expect(r.transition).toEqual({ from: 'ACTIVE', to: 'RENEWED', clause: null });
  });
});
