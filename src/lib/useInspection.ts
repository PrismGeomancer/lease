import { useCallback, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { isAddress, type Lease } from '../lease/schema';
import { INSPECTOR_NAME, INSPECTOR_ORDER, ROMAN, type Finding, type InspectorId } from '../types';
import { NotMintError, inspectAll, runInspector, summarize } from '../inspectors';
import { makeCtx } from './chainctx';
import type { InspectCtx } from '../types';

export interface InspectionState {
  mint: string | null;
  running: boolean;
  findings: Partial<Record<InspectorId, Finding>>;
  log: string[];
  error: string | null;
  done: boolean;
  ctx: InspectCtx | null;
  meta: { name?: string; symbol?: string; image?: string } | null;
}

const EMPTY: InspectionState = { mint: null, running: false, findings: {}, log: [], error: null, done: false, ctx: null, meta: null };

export function validateMintInput(raw: string): string | null {
  const s = raw.trim();
  return isAddress(s) ? null : copy.desk.errInvalid;
}

/** Progressive inspection: each inspector resolves its own row as its promise settles. */
export function useInspection() {
  const [state, setState] = useState<InspectionState>(EMPTY);
  const run$ = useRef(0);

  const run = useCallback(async (mintRaw: string, opts: { lease?: Lease; runNeighbours?: boolean } = {}) => {
    const mint = mintRaw.trim();
    const bad = validateMintInput(mint);
    if (bad) { setState({ ...EMPTY, error: bad }); return; }
    const token = ++run$.current;
    const ctx = makeCtx(mint, opts);
    setState({ ...EMPTY, mint, running: true, ctx });
    const upd = (fn: (s: InspectionState) => InspectionState) => { if (run$.current === token) setState(fn); };
    ctx.helius?.getAsset(mint).then((a) => a && upd((s) => ({ ...s, meta: { name: a.name, symbol: a.symbol, image: a.image } }))).catch(() => {});
    try {
      await inspectAll(ctx, (f) => {
        const idx = INSPECTOR_ORDER.indexOf(f.id);
        const line = copy.desk.log(ROMAN[idx]!, INSPECTOR_NAME[f.id], f.status === 'UNVERIFIABLE' ? 'could not confirm' : 'reading', f.ms);
        upd((s) => ({ ...s, findings: { ...s.findings, [f.id]: f }, log: [...s.log, line] }));
      });
      upd((s) => ({ ...s, running: false, done: true, error: null }));
    } catch (e) {
      const msg = e instanceof NotMintError ? copy.desk.errNotMint : copy.desk.errRpc;
      upd((s) => ({ ...s, running: false, error: msg }));
    }
  }, []);

  /** Run only the slow neighbours inspector on the existing context. */
  const runNeighbours = useCallback(async () => {
    const ctx = state.ctx;
    if (!ctx) return;
    ctx.runNeighbours = true;
    setState((s) => ({ ...s, running: true, findings: { ...s.findings, neighbours: { ...(s.findings.neighbours as Finding), status: 'PENDING', summary: copy.extra.loading } } }));
    const f = await runInspector('neighbours', ctx);
    setState((s) => ({ ...s, running: false, findings: { ...s.findings, neighbours: f } }));
  }, [state.ctx]);

  const list = INSPECTOR_ORDER.map((id) => state.findings[id]).filter((f): f is Finding => !!f);
  return { state, run, runNeighbours, list, summary: summarize(list), reset: () => setState(EMPTY) };
}
