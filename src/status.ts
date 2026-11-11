export type Status =
  | 'KEPT' | 'WATCH' | 'BREACHED' | 'UNVERIFIABLE' | 'PENDING'
  | 'RENEWED' | 'EVICTED' | 'ACTIVE' | 'SAMPLE';

export interface StatusMeta { color: string; icon: string; text: string }

// icon = inline SVG path data (24x24 viewBox, stroke-based)
export const STATUS: Record<Status, StatusMeta> = {
  KEPT: { color: 'var(--ledger-green)', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM7.5 12.5l3 3 6-6.5', text: 'KEPT' },
  WATCH: { color: 'var(--watch-amber)', icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z', text: 'WATCH' },
  BREACHED: { color: 'var(--stamp-red)', icon: 'M4 4h16v16H4zM8 8l8 8M16 8l-8 8', text: 'BREACHED' },
  UNVERIFIABLE: { color: 'var(--slate-grey)', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.5', text: 'UNVERIFIABLE' },
  PENDING: { color: 'var(--slate-grey)', icon: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9', text: 'PENDING' },
  RENEWED: { color: 'var(--ledger-green)', icon: 'M8 15a4 4 0 110-8 4 4 0 010 8zM11 12h10M18 12v4M15 12v3', text: 'RENEWED' },
  EVICTED: { color: 'var(--stamp-red)', icon: 'M5 3h9v18H5zM14 12h8M19 9l3 3-3 3', text: 'EVICTED' },
  ACTIVE: { color: 'var(--brass)', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', text: 'ACTIVE' },
  SAMPLE: { color: 'var(--slate-grey)', icon: '', text: 'SAMPLE — FICTIONAL COIN' },
};

/** Severity ordering for "worst of" calculations. */
const RANK: Record<string, number> = { KEPT: 0, PENDING: 1, UNVERIFIABLE: 2, WATCH: 3, BREACHED: 4 };
export function worst(list: Status[]): Status {
  let w: Status = 'KEPT';
  for (const s of list) if ((RANK[s] ?? 0) > (RANK[w] ?? 0)) w = s;
  return w;
}
