import { describe, it, expect } from 'vitest';
import { reading, CLAUSE_KINDS } from '../../src/hearing/templates';

describe('hearing templates', () => {
  it('fills real values into the fixed copy', () => {
    expect(reading('sold', { pct: 4.1 }).guilty).toBe("Dev sold 4.1% inside a no-sell window. That's a partial exit.");
    expect(reading('devmax', { pct: 9, max: 5 }).guilty).toBe('Dev holds 9% against a promised 5%.');
    expect(reading('authority', { which: 'freeze' }).guilty).toContain('freeze');
    expect(reading('authority', { which: 'mint' }).guilty).toContain('mint');
    expect(reading('noise', { ratio: 4 }).guilty).toBe('Sellers outnumber buyers 4 to 1.');
    expect(reading('neighbours', { n: 3 }).guilty).toContain('3 top wallets');
    for (const k of Object.values(CLAUSE_KINDS)) {
      const r = reading(k, { pct: 1, max: 1, min: 1, n: 1, ratio: 1 });
      expect(r.innocent.length).toBeGreaterThan(10);
      expect(r.guilty).not.toMatch(/undefined|NaN/);
    }
  });
});
