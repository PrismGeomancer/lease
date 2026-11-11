import type { Status } from './status';
import type { Lease } from './lease/schema';
import type { Rpc } from './chain/rpc';
import type { Dex } from './chain/dex';
import type { Helius } from './chain/helius';

export type InspectorId =
  | 'mint' | 'freeze' | 'paint' | 'landlord' | 'tenant' | 'foundations' | 'locks' | 'noise' | 'neighbours';

export type FindingStatus = Extract<Status, 'KEPT' | 'WATCH' | 'BREACHED' | 'UNVERIFIABLE' | 'PENDING'>;

export interface Finding {
  id: InspectorId;
  status: FindingStatus;
  summary: string;
  value?: string | number;
  source: { label: string; url?: string };
  /** Machine-readable details. Clause evaluation reads evidence.clauses when present. */
  evidence?: Record<string, unknown>;
  ms: number;
}

export interface InspectCtx {
  mint: string;
  lease?: Lease;
  rpc: Rpc;
  dex: Dex;
  helius?: Helius;
  now: number; // unix ms
  /** Browser: neighbours only on explicit click. Actions: always true. */
  runNeighbours?: boolean;
  /** Per-run memo so inspectors can share expensive reads. */
  memo: Map<string, Promise<unknown>>;
  /** Cache of wallet -> first SOL funder (never changes; persisted by Actions). */
  funders?: Map<string, string | null>;
  explorerAccount?: string;
  explorerTx?: string;
}

export type Inspector = (ctx: InspectCtx) => Promise<Finding>;

export const INSPECTOR_ORDER: InspectorId[] = [
  'mint', 'freeze', 'paint', 'landlord', 'tenant', 'foundations', 'locks', 'noise', 'neighbours',
];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const INSPECTOR_NAME: Record<InspectorId, string> = {
  mint: 'Ada Mint', freeze: 'Otto Frost', paint: 'Vera Varnish', landlord: 'Walter Deed',
  tenant: 'Ruth Keys', foundations: 'Basil Stone', locks: 'Ivo Bolt', noise: 'Nora Knock', neighbours: 'Ned Fence',
};
