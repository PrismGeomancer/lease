import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { Button } from './Button';
import { TriplicateForm } from './TriplicateForm';
import { AddressChip } from './misc';
import { InspectionLog, InspectorTable, TokenImage, summaryLine, Evidence } from './InspectionParts';
import { useInspection, validateMintInput } from '../lib/useInspection';
import { toast } from '../lib/toast';
import { saveKey } from '../lib/keyring';
import { downloadCard } from '../cards';
import { loadHistory, loadRegister } from '../lib/data';
import { encodeLease } from '../lease/encode';
import type { Lease } from '../lease/schema';
import { CONFIG } from '../config';
import { clean } from '../lib/util';
import { INSPECTOR_ORDER } from '../types';

export function InspectionDesk({ initialMint, full }: { initialMint?: string; full?: boolean }) {
  const [input, setInput] = useState(initialMint ?? '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const insp = useInspection();
  const { state } = insp;

  // Look for a registered lease for this mint so the inspection uses the dev's own terms.
  const findLease = async (mint: string): Promise<Lease | null> => {
    const reg = await loadRegister();
    const hit = reg?.leases.filter((l) => l.mint === mint && l.state === 'ACTIVE').sort((a, b) => b.start - a.start)[0];
    if (!hit) return null;
    return (await loadHistory(hit.fp))?.lease ?? null;
  };

  const go = async (mint = input) => {
    const bad = validateMintInput(mint);
    setInputError(bad);
    if (bad) return;
    const l = await findLease(mint.trim());
    setLease(l);
    await insp.run(mint, { lease: l ?? undefined });
  };

  useEffect(() => { if (initialMint) { setInput(initialMint); void go(initialMint); }   }, [initialMint]);

  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      setInput(t);
    } catch { toast('Clipboard blocked. Paste with Ctrl/Cmd+V.'); }
  };

  const errorText = inputError ?? state.error;
  const findings = INSPECTOR_ORDER.map((id) => state.findings[id]).filter((f) => !!f);
  const ticker = clean(state.meta?.symbol ?? '', 12);
  const link = state.mint ? `${location.origin}${location.pathname}#/inspect/${state.mint}` : '';

  return (
    <div class="desk">
      <form class="paper desk__form" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <div class="field">
          <label class="label" for={full ? 'mint-full' : 'mint-desk'}>{copy.desk.label}</label>
          <div class="desk__row">
            <input
              id={full ? 'mint-full' : 'mint-desk'} class="field__input" value={input} placeholder={copy.desk.placeholder}
              autocomplete="off" autocapitalize="off" spellcheck={false}
              aria-invalid={!!errorText} aria-describedby={errorText ? 'desk-err' : undefined}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            />
            <Button variant="secondary" onPaper onClick={paste}>{copy.desk.paste}</Button>
            <Button type="submit" loading={state.running}>{copy.desk.run}</Button>
          </div>
          {errorText && <span id="desk-err" class="field__error" role="alert">{errorText}</span>}
        </div>
        <p class="mono desk__note">{lease ? copy.desk.withLease : copy.desk.noLease}{lease && <> <a href={`#/l/${encodeLease(lease)}`}>{copy.desk.openLease}</a></>}</p>
      </form>

      {(state.running || findings.length > 0) && (
        <div class="desk__result">
          <TriplicateForm formNo="FORM L-02 · INSPECTION REPORT" title="Inspection report" max={960}>
            {state.mint && <div class="mono desk__mint"><TokenImage src={state.meta?.image} size={40} /> {state.meta?.name && <strong>{clean(state.meta.name, 40)} {ticker && `(${ticker})`}</strong>} <AddressChip address={state.mint} label="Mint" link={`${CONFIG.EXPLORER_ACCOUNT}${state.mint}`} /></div>}
            <InspectorTable findings={state.findings} />
            <p class="desk__summary" aria-live="polite">{findings.length === 9 ? summaryLine(insp.list) : copy.extra.loading}</p>
            {state.done && (
              <div class="desk__actions">
                {full ? null : <Button size="sm" href={`#/inspect/${state.mint}`}>{copy.desk.openFull}</Button>}
                <Button size="sm" variant="secondary" onPaper onClick={() => { saveKey({ kind: 'report', title: `Report ${state.mint!.slice(0, 6)}…`, ref: state.mint! }); toast(copy.toast.saved); }}>{copy.desk.save}</Button>
                <Button size="sm" variant="secondary" onPaper onClick={() => downloadCard({ kind: 'report', ticker: ticker || state.mint!.slice(0, 6), mint: state.mint!, statuses: insp.list.map((f) => f.status), date: new Date().toISOString().slice(0, 10) }, `lease-report-${state.mint!.slice(0, 6)}.png`)}>{copy.desk.card}</Button>
                <Button size="sm" variant="secondary" onPaper onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); toast(copy.toast.leaseCopied); }}>{copy.desk.copyLink}</Button>
                {state.findings.neighbours?.evidence?.notRun && (
                  <span>
                    <Button size="sm" variant="secondary" onPaper onClick={() => insp.runNeighbours()}>{copy.desk.neighbours}</Button>
                    <small class="mono"> {copy.desk.neighboursNote}</small>
                  </span>
                )}
              </div>
            )}
          </TriplicateForm>
          <InspectionLog lines={state.log} />
        </div>
      )}
      {full && state.done && <Evidence list={insp.list} mint={state.mint!} />}
    </div>
  );
}
