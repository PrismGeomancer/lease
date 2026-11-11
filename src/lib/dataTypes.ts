import type { Status } from '../status';
import type { Lease } from '../lease/schema';
import type { LeaseState } from '../lease/evaluate';
import type { FindingStatus } from '../types';

export interface Office {
  schema: 1; generatedAt: string; lastRoundAt: string | null;
  counts: { onFile: number; active: number; renewed: number; evicted: number; rejected: number };
}
export interface RegisterEntry {
  fp: string; mint: string; ticker: string | null; name: string | null; image: string | null;
  dev: string; term: number; start: number; tx: string;
  state: LeaseState; stateAt: number | null; breachedClause: string | null;
  lastRoundAt: number | null; worst: Status;
  sample?: boolean;
}
export interface Register { schema: 1; generatedAt: string; cursor: string | null; leases: RegisterEntry[] }
export interface BulletinItem { t: number; kind: 'NEW' | 'RENEWED' | 'EVICTED'; fp: string; ticker: string | null; term?: number; clause?: string }
export interface Bulletin { schema: 1; generatedAt: string; items: BulletinItem[] }
export interface TokenFacts {
  schema: 1; generatedAt: string; mint: string | null; supply: string | null; decimals: number | null;
  mintAuthority: string | null; freezeAuthority: string | null; liquidityUsd: number | null; pairUrl: string | null;
}
export interface RoundRecord {
  t: number; clause: Record<string, FindingStatus>;
  findings: { id: string; status: FindingStatus; value?: string | number }[];
}
export interface LeaseHistory {
  schema: 1; generatedAt: string; lease: Lease; tx: string; start: number;
  state: LeaseState; stateAt: number | null; breachedClause: string | null;
  rounds: RoundRecord[]; daily: { day: string; worst: FindingStatus }[];
  pendingBreach: Record<string, number>;
}
export interface LeaseOwn { schema: 1; lease: Lease | null }
