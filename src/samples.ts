// Fictional leases for the empty register. Never counted, never in bulletin/alerts/register.json.
import type { RegisterEntry } from './lib/dataTypes';

const base = { image: null, dev: 'SAMPLE', tx: '', lastRoundAt: null, breachedClause: null, stateAt: null, sample: true } as const;
const now = Math.floor(Date.now() / 1000);

export const SAMPLES: RegisterEntry[] = [
  { ...base, fp: 'sample-drafty', mint: 'SAMPLE', ticker: '$DRAFTY', name: 'Drafty', term: 30, start: now - 12 * 86400, state: 'ACTIVE', worst: 'KEPT' },
  { ...base, fp: 'sample-motel', mint: 'SAMPLE', ticker: '$MOTEL', name: 'Motel', term: 14, start: now - 20 * 86400, state: 'EVICTED', worst: 'BREACHED', breachedClause: 'dev sold 4.1%' },
  { ...base, fp: 'sample-attic', mint: 'SAMPLE', ticker: '$ATTIC', name: 'Attic', term: 7, start: now - 30 * 86400, state: 'RENEWED', worst: 'KEPT' },
];
