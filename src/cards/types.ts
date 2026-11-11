import type { FindingStatus } from '../types';

export type CardData =
  | { kind: 'report'; ticker: string; mint: string; statuses: FindingStatus[]; date: string; demo?: boolean }
  | { kind: 'lease'; ticker: string; dev: string; clauses: string[]; fp: string; term: number }
  | { kind: 'renewed'; ticker: string; term: number; fp: string }
  | { kind: 'evicted'; ticker: string; clause: string; date: string; fp: string }
  | { kind: 'hearing'; ticker: string; innocent: string; guilty: string; verdict: 'fair' | 'breach' | null; fp: string };
