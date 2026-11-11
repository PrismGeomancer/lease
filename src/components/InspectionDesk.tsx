import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { Button } from './Button';
import { AddressChip } from './misc';
import { InspectionLog, TokenImage, summaryLine, Evidence } from './InspectionParts';
import { InspectionBoard } from './InspectionBoard';
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

// Real, well-known tokens so a first visit can see results without finding an address.
const KNOWN = [
  { label: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { label: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
];

export function InspectionDesk({ initialMint, full }: { initialMint?: string; full?: boolean }) {
  const [input, setInput] = useState(initialMint ?? '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const insp = useInspection();
  const { state } = insp;

  // A registered lease for this mint means the inspection uses the dev's own terms.
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

  useEffect(() => {
    if (initialMint) { setInput(initialMint); void go(initialMint); }
     
  }, [initialMint]);

  const paste = async () => {
    try { setInput((await navigator.clipboard.readText()).trim()); } catch { toast('Clipboard blocked. Paste with Ctrl/Cmd+V.'); }
  };

  const errorText = inputError ?? state.error;
  const resolved = INSPECTOR_ORDER.filter((id) => state.findings[id]).length;
  const started = state.running || resolved > 0;
  const ticker = clean(state.meta?.symbol ?? '', 12);
  const link = state.mint ? `${location.origin}${location.pathname}#/inspect/${state.mint}` : '';
  const idp = full ? 'full' : 'desk';

  return (
    <div class="desk">
      <div class="desk__left">
        <form class="paper desk__form" data-intro-target onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <label class="desk__label" for={`mint-${idp}`}>{copy.desk.label}</label>
          <input
            id={`mint-${idp}`} class="field__input" value={input} placeholder={copy.desk.placeholder}
            autocomplete="off" autocapitalize="off" spellcheck={false}
            aria-invalid={!!errorText} aria-describedby={errorText ? `desk-err-${idp}` : undefined}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
          {errorText && <span id={`desk-err-${idp}`} class="field__error" role="alert">{errorText}</span>}
          <div class="desk__btns">
            <Button type="submit" loading={state.running}>{copy.desk.run}</Button>
            <Button variant="secondary" onPaper onClick={paste}>{copy.desk.paste}</Button>
          </div>
          <div class="desk__try">
            <span>{copy.extra.tryKnown}</span>
            {KNOWN.map((k) => (
              <button type="button" class="chipbtn" key={k.label} disabled={state.running}
                onClick={() => { setInput(k.mint); void go(k.mint); }}>{k.label}</button>
            ))}
          </div>
          <p class="desk__note">
            {lease ? copy.desk.withLease : copy.desk.noLease}
            {lease && <> <a href={`#/l/${encodeLease(lease)}`}>{copy.desk.openLease}</a></>}
          </p>
        </form>

        {state.mint && (
          <div class="desk__token">
            <TokenImage src={state.meta?.image} size={44} />
            <div>
              {state.meta?.name && <strong>{clean(state.meta.name, 40)}{ticker && ` (${ticker})`}</strong>}
              <AddressChip address={state.mint} label="Mint" link={`${CONFIG.EXPLORER_ACCOUNT}${state.mint}`} />
            </div>
          </div>
        )}

        {started && (
          <p class="desk__summary" aria-live="polite">
            {resolved === 9 ? summaryLine(insp.list) : `${resolved} of 9 inspectors reported`}
          </p>
        )}

        {state.done && (
          <div class="desk__actions">
            {!full && <Button size="sm" href={`#/inspect/${state.mint}`}>{copy.desk.openFull}</Button>}
            <Button size="sm" variant="secondary" onClick={() => { saveKey({ kind: 'report', title: `Report ${state.mint!.slice(0, 6)}…`, ref: state.mint! }); toast(copy.toast.saved); }}>{copy.desk.save}</Button>
            <Button size="sm" variant="secondary" onClick={() => downloadCard({ kind: 'report', ticker: ticker || state.mint!.slice(0, 6), mint: state.mint!, statuses: insp.list.map((f) => f.status), date: new Date().toISOString().slice(0, 10) }, `lease-report-${state.mint!.slice(0, 6)}.png`)}>{copy.desk.card}</Button>
            <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); toast(copy.toast.leaseCopied); }}>{copy.desk.copyLink}</Button>
            {state.findings.neighbours?.evidence?.notRun && (
              <div class="desk__slow">
                <Button size="sm" variant="secondary" onClick={() => insp.runNeighbours()}>{copy.desk.neighbours}</Button>
                <small>{copy.desk.neighboursNote}</small>
              </div>
            )}
          </div>
        )}
      </div>

      <div class="desk__right">
        <InspectionBoard findings={state.findings} running={state.running} started={started} />
        {started && <InspectionLog lines={state.log} />}
      </div>

      {full && state.done && <div class="desk__evidence"><Evidence list={insp.list} mint={state.mint!} /></div>}
    </div>
  );
}
