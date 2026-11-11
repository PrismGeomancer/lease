/** All default thresholds in one place. Shown on #/office and unit-tested. */
export const THRESHOLDS = {
  landlord: { keptMaxPct: 30, watchMaxPct: 50 }, // <=30 KEPT, 30-50 WATCH, >50 BREACHED
  tenant: { keptMaxPct: 5, watchMaxPct: 10 },
  foundations: { keptMinUsd: 10_000, watchMinUsd: 2_000 },
  noise: { keptMaxRatio: 1.5, watchMaxRatio: 3, minVolumeUsd: 500 },
  neighbours: { breachedAt: 3, watchAt: 2 },
  nsTolerance: 0.005, // 0.5% of the starting balance
  inspectorTimeoutMs: 8_000,
  neighboursTimeoutMs: 90_000,
  breachConfirmRounds: 2,
} as const;

type S = 'KEPT' | 'WATCH' | 'BREACHED';

export function landlordStatus(pct: number, limit?: number): S {
  if (limit !== undefined) return pct <= limit ? 'KEPT' : 'BREACHED';
  const t = THRESHOLDS.landlord;
  return pct <= t.keptMaxPct ? 'KEPT' : pct <= t.watchMaxPct ? 'WATCH' : 'BREACHED';
}
export function tenantStatus(pct: number, limit?: number, inferred = false): S {
  let s: S;
  if (limit !== undefined) s = pct <= limit ? 'KEPT' : 'BREACHED';
  else {
    const t = THRESHOLDS.tenant;
    s = pct <= t.keptMaxPct ? 'KEPT' : pct <= t.watchMaxPct ? 'WATCH' : 'BREACHED';
  }
  return inferred && s === 'BREACHED' ? 'WATCH' : s;
}
export function foundationsStatus(usd: number, min?: number): S {
  if (min !== undefined) return usd >= min ? 'KEPT' : 'BREACHED';
  const t = THRESHOLDS.foundations;
  return usd >= t.keptMinUsd ? 'KEPT' : usd >= t.watchMinUsd ? 'WATCH' : 'BREACHED';
}
export function noiseStatus(sells: number, buys: number): S {
  const ratio = buys === 0 ? (sells === 0 ? 0 : Infinity) : sells / buys;
  const t = THRESHOLDS.noise;
  return ratio <= t.keptMaxRatio ? 'KEPT' : ratio <= t.watchMaxRatio ? 'WATCH' : 'BREACHED';
}
export function neighboursStatus(largestGroup: number): S {
  const t = THRESHOLDS.neighbours;
  return largestGroup >= t.breachedAt ? 'BREACHED' : largestGroup >= t.watchAt ? 'WATCH' : 'KEPT';
}
