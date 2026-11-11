import { copy } from '../copy';
import { THRESHOLDS } from '../thresholds';
import { INSPECTOR_NAME, INSPECTOR_ORDER, type Finding, type InspectCtx, type Inspector, type InspectorId } from '../types';
import { NotMintError, mintInfo } from './common';
import { mint } from './mint';
import { freeze } from './freeze';
import { paint } from './paint';
import { landlord } from './landlord';
import { tenant } from './tenant';
import { foundations } from './foundations';
import { locks } from './locks';
import { noise } from './noise';
import { neighbours } from './neighbours';

export { NotMintError };
export const INSPECTORS: Record<InspectorId, Inspector> = { mint, freeze, paint, landlord, tenant, foundations, locks, noise, neighbours };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Run one inspector. Never throws: timeouts and errors become UNVERIFIABLE. */
export async function runInspector(id: InspectorId, ctx: InspectCtx): Promise<Finding> {
  const start = Date.now();
  const limit = id === 'neighbours' ? THRESHOLDS.neighboursTimeoutMs : THRESHOLDS.inspectorTimeoutMs;
  try {
    const f = await withTimeout(INSPECTORS[id](ctx), limit);
    return { ...f, id, ms: Date.now() - start };
  } catch (e) {
    const timedOut = e instanceof Error && e.message === 'timeout';
    return {
      id, status: 'UNVERIFIABLE', ms: Date.now() - start,
      summary: timedOut ? copy.desk.timeout(INSPECTOR_NAME[id]) : `${INSPECTOR_NAME[id]} couldn't read the chain. Marked UNVERIFIABLE, not guilty.`,
      source: { label: 'n/a' },
    };
  }
}

/** Throws NotMintError if the address isn't a token; otherwise runs all nine, reporting each as it settles. */
export async function inspectAll(ctx: InspectCtx, onFinding?: (f: Finding) => void): Promise<Finding[]> {
  await mintInfo(ctx); // surfaces NotMintError / RPC failure early
  const out = await Promise.all(
    INSPECTOR_ORDER.map(async (id) => {
      const f = await runInspector(id, ctx);
      onFinding?.(f);
      return f;
    }),
  );
  return out;
}

export function summarize(findings: Finding[]) {
  const n = (s: string) => findings.filter((f) => f.status === s).length;
  return { kept: n('KEPT'), watch: n('WATCH'), breached: n('BREACHED'), unverifiable: n('UNVERIFIABLE') };
}
