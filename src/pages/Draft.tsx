import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { Button } from '../components/Button';
import { Heading } from '../components/Heading';
import { TriplicateForm } from '../components/TriplicateForm';
import { NumberField, Segmented, Toggle, AddressChip } from '../components/misc';
import { Stamp } from '../components/Stamp';
import { TokenImage } from '../components/InspectionParts';
import { WalletModal } from '../components/WalletModal';
import { useSignal } from '../signal';
import { walletState, walletEvents, signMessage, WalletError } from '../chain/wallet';
import { getParsedMint, getOwnerBalance } from '../chain/rpc';
import { getRpc, makeCtx } from '../lib/chainctx';
import { isAddress, TERMS, type Clauses, type Lease, type LeaseBody, type Term } from '../lease/schema';
import { buildMessage } from '../lease/message';
import { encodeLease } from '../lease/encode';
import { verifyLease } from '../lease/verify';
import { clauseStatuses } from '../lease/evaluate';
import { inspectAll } from '../inspectors';
import { toast } from '../lib/toast';
import { clean } from '../lib/util';
import { pctOf } from '../inspectors/common';
import { CLAUSE_SHORT } from '../hearing/templates';

const STORE = 'lease:draft:v1';
interface Draft {
  step: number; mint: string; term: Term;
  ar: boolean; ml: boolean; dm: boolean; dmV: number; ns: boolean; nsV: number; lp: boolean; lpm: string;
  tt: boolean; ttV: number; liq: boolean; liqV: number; note: string;
}
const DEFAULT: Draft = { step: 0, mint: '', term: 30, ar: true, ml: false, dm: true, dmV: 5, ns: true, nsV: 14, lp: false, lpm: '', tt: false, ttV: 40, liq: false, liqV: 5000, note: '' };

function loadDraft(): Draft {
  try { return { ...DEFAULT, ...(JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as Partial<Draft>) }; } catch { return DEFAULT; }
}

interface MintPreview { name?: string; symbol?: string; image?: string; supply: string; decimals: number }

export default function DraftPage() {
  const [d, setD] = useState<Draft>(loadDraft);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const w = useSignal(walletState);
  const changed = useSignal(walletEvents);
  const [walletOpen, setWalletOpen] = useState(false);
  const [preview, setPreview] = useState<MintPreview | null>(null);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [signErr, setSignErr] = useState<string | null>(null);
  const [signed, setSigned] = useState<Lease | null>(null);
  const [t0] = useState(() => Math.floor(Date.now() / 1000));
  const h1 = useRef<HTMLHeadingElement>(null);

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);
  useEffect(() => { h1.current?.focus(); }, [d.step]);

  // Step 1: live mint preview
  useEffect(() => {
    setPreview(null); setMintErr(null);
    const mint = d.mint.trim();
    if (!mint) return;
    if (!isAddress(mint)) { setMintErr(copy.desk.errInvalid); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const m = await getParsedMint(getRpc(), mint);
        if (!alive) return;
        if (!m) { setMintErr(copy.desk.errNotMint); return; }
        const ctx = makeCtx(mint);
        const a = await ctx.helius?.getAsset(mint).catch(() => null);
        if (alive) setPreview({ supply: m.supply, decimals: m.decimals, name: a?.name, symbol: a?.symbol, image: a?.image });
      } catch { if (alive) setMintErr(copy.desk.errRpc); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [d.mint]);

  // Step 2: balance (re-read whenever the account changes)
  useEffect(() => {
    setBalance(null);
    if (!w || !preview) return;
    let alive = true;
    getOwnerBalance(getRpc(), w.address, d.mint.trim()).then((b) => alive && setBalance(b)).catch(() => alive && setBalance(null));
    return () => { alive = false; };
  }, [w?.address, preview, d.mint]);

  useEffect(() => {
    if (changed.changed === 0) return;
    toast('Wallet changed. Balance re-read.');
    setSigned(null); setSignErr(null);
    if (d.step === 3) set({ step: 2 });
     
  }, [changed.changed]);

  const clauses = useMemo<Clauses>(() => {
    const c: Clauses = {};
    if (d.ar) c.ar = 1;
    if (d.ml) c.ml = 1;
    if (d.dm) c.dm = d.dmV;
    if (d.ns) c.ns = Math.min(d.nsV, d.term);
    if (d.lp) { c.lp = 1; if (d.lpm.trim()) c.lpm = d.lpm.trim(); }
    if (d.tt) c.tt = d.ttV;
    if (d.liq) c.liq = d.liqV;
    return c;
  }, [d]);

  const body: LeaseBody | null = useMemo(() => {
    if (!w || !preview) return null;
    const note = clean(d.note, 140);
    return { v: 1, mint: d.mint.trim(), dev: w.address, t0, term: d.term, b0: (balance ?? 0n).toString(), c: clauses, ...(note ? { n: note } : {}) };
  }, [w, preview, d.mint, d.term, clauses, d.note, balance, t0]);

  const supply = preview ? BigInt(preview.supply) : 0n;
  const holdPct = balance !== null && supply > 0n ? pctOf(balance, supply) : null;

  // Step 3: "evicted on day one" warnings, from a real inspection against the draft terms
  useEffect(() => {
    if (d.step !== 2 || !body || Object.keys(clauses).length === 0) { setWarnings([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const draft = { ...body, sig: '1'.repeat(88) } as Lease;
        const ctx = makeCtx(body.mint, { lease: draft });
        const findings = await inspectAll(ctx);
        const st = clauseStatuses(draft, findings);
        if (alive) setWarnings(Object.entries(st).filter(([, s]) => s === 'BREACHED').map(([k]) => CLAUSE_SHORT[k as keyof typeof CLAUSE_SHORT]));
      } catch { if (alive) setWarnings([]); }
    }, 700);
    return () => { alive = false; clearTimeout(t); };
  }, [d.step, body, clauses]);

  useEffect(() => {
    if (d.step !== 3 || !body) return;
    buildMessage(body).then(setMessage);
  }, [d.step, body]);

  const valid3 =
    Object.keys(clauses).length > 0 &&
    (!d.dm || (d.dmV >= 0.1 && d.dmV <= 20)) && (!d.ns || (d.nsV >= 1 && d.nsV <= d.term)) &&
    (!d.tt || (d.ttV >= 10 && d.ttV <= 80)) && (!d.liq || (d.liqV >= 1 && d.liqV <= 1e12)) &&
    (!d.lpm.trim() || isAddress(d.lpm.trim())) && d.note.length <= 140;

  const reason: Record<number, string | null> = {
    0: preview ? null : (mintErr ?? 'Paste a valid token mint to continue.'),
    1: w && balance !== null ? null : (w ? 'Reading your balance…' : 'Connect the dev wallet to continue.'),
    2: valid3 ? null : 'Pick at least one clause and keep every number in range.',
    3: null,
  };

  const sign = async () => {
    if (!body) return;
    setSignErr(null);
    try {
      const msg = await buildMessage(body);
      const sig = await signMessage(msg);
      const lease: Lease = { ...body, sig };
      if (!(await verifyLease(lease))) throw new WalletError('declined', 'The wallet returned a signature that does not verify. Nothing was saved.');
      setSigned(lease);
      toast(copy.toast.signed);
      try { sessionStorage.removeItem(STORE); } catch { /* ignore */ }
      setTimeout(() => { location.hash = `#/l/${encodeLease(lease)}`; }, 1400);
    } catch (e) {
      setSignErr(e instanceof WalletError ? e.message : copy.draft.declined);
    }
  };

  const labels = copy.draft.steps;
  return (
    <main id="main" class="container page draft" >
      <h1 ref={h1} tabIndex={-1}><span>{copy.draft.h1[0]}</span><em class="accent">{copy.draft.h1[1]}</em></h1>
      <div class="draft__layout">
        <ol class="stepper" aria-label="Steps">
          {labels.map((l, i) => (
            <li key={l} aria-current={d.step === i ? 'step' : undefined} class={d.step === i ? 'is-current' : i < d.step ? 'is-done' : ''}>
              <span class="mono">L-01/{i + 1}</span> <span class="stepper__label">{l}</span>
            </li>
          ))}
        </ol>
        <div class="draft__sheet" key={d.step}>
          <TriplicateForm formNo={`FORM L-01 / ${d.step + 1}`} title={labels[d.step]?.slice(2)} torn={!!signed} labels={!!signed} max={680}>
            {d.step === 0 && (
              <div class="field">
                <h2 class="draft__q">{copy.draft.s1}</h2>
                <label class="label" for="d-mint">{copy.desk.label}</label>
                <input id="d-mint" class="field__input" value={d.mint} placeholder={copy.desk.placeholder} autocomplete="off" spellcheck={false}
                  aria-invalid={!!mintErr} onInput={(e) => set({ mint: (e.target as HTMLInputElement).value })} />
                <span class="mono">{copy.draft.s1h}</span>
                {mintErr && <span class="field__error" role="alert">{mintErr}</span>}
                {preview && (
                  <p class="mono draft__preview"><TokenImage src={preview.image} size={40} /> <strong>{clean(preview.name ?? 'Unnamed token', 40)} {preview.symbol ? `(${clean(preview.symbol, 12)})` : ''}</strong> · supply {(Number(preview.supply) / 10 ** preview.decimals).toLocaleString('en-US')}</p>
                )}
              </div>
            )}
            {d.step === 1 && (
              <div>
                <h2 class="draft__q">{copy.draft.s2}</h2>
                <p>{copy.draft.s2h}</p>
                {w ? <p><AddressChip address={w.address} label="Tenant" /></p> : <Button onPaper onClick={() => setWalletOpen(true)}>{copy.nav.connect}</Button>}
                {holdPct !== null && <p class="mono" aria-live="polite">{copy.draft.holds(String(holdPct))}</p>}
                {w && balance === null && <p class="mono">{copy.extra.loading}</p>}
              </div>
            )}
            {d.step === 2 && (
              <div class="terms">
                <h2 class="draft__q">{copy.draft.s3}</h2>
                <div><span class="label">{copy.draft.term}</span><br /><Segmented options={[...TERMS]} value={d.term} onChange={(v) => set({ term: v as Term })} label={copy.draft.term} /> days</div>
                <Toggle checked={d.ar} onChange={(v) => set({ ar: v })} label={copy.draft.ar} hint={copy.draft.arH} />
                <Toggle checked={d.ml} onChange={(v) => set({ ml: v })} label={copy.draft.ml} hint={copy.draft.mlH} />
                <div class="termrow"><Toggle checked={d.dm} onChange={(v) => set({ dm: v })} label={copy.draft.dm(d.dmV)} />{d.dm && <NumberField label="Dev max percent" value={d.dmV} onChange={(v) => set({ dmV: v })} min={0.1} max={20} step={0.1} suffix="%" />}</div>
                <div class="termrow"><Toggle checked={d.ns} onChange={(v) => set({ ns: v })} label={copy.draft.ns(Math.min(d.nsV, d.term))} />{d.ns && <NumberField label="No-sell days" value={d.nsV} onChange={(v) => set({ nsV: Math.round(v) })} min={1} max={d.term} suffix="days" />}</div>
                <div class="termrow"><Toggle checked={d.lp} onChange={(v) => set({ lp: v })} label={copy.draft.lp} /></div>
                {d.lp && (
                  <div class="field"><label class="label" for="d-lpm">{copy.draft.lpm}</label>
                    <input id="d-lpm" class="field__input" value={d.lpm} aria-invalid={!!d.lpm && !isAddress(d.lpm.trim())} onInput={(e) => set({ lpm: (e.target as HTMLInputElement).value })} /></div>
                )}
                <div class="termrow"><Toggle checked={d.tt} onChange={(v) => set({ tt: v })} label={copy.draft.tt(d.ttV)} />{d.tt && <NumberField label="Top 10 max percent" value={d.ttV} onChange={(v) => set({ ttV: v })} min={10} max={80} step={1} suffix="%" />}</div>
                <div class="termrow"><Toggle checked={d.liq} onChange={(v) => set({ liq: v })} label={copy.draft.liq(d.liqV)} />{d.liq && <NumberField label="Minimum liquidity dollars" value={d.liqV} onChange={(v) => set({ liqV: v })} min={1} max={1e12} step={100} suffix="$" />}</div>
                <div class="field"><label class="label" for="d-note">{copy.draft.note}</label>
                  <input id="d-note" class="field__input" maxLength={140} value={d.note} onInput={(e) => set({ note: (e.target as HTMLInputElement).value })} />
                  <span class="mono">{copy.draft.noteH}</span></div>
                {warnings.length > 0 && (
                  <p class="field__error" role="alert"><Stamp status="BREACHED" size="sm" /> {copy.draft.dayOne} ({warnings.join(', ')})</p>
                )}
              </div>
            )}
            {d.step === 3 && (
              <div>
                <h2 class="draft__q">{copy.draft.s4}</h2>
                <pre class="message mono" tabIndex={0} aria-label="Message to sign">{message}</pre>
                <p>{copy.draft.truth1}</p>
                <p>{copy.draft.truth2}</p>
                {signErr && <p class="field__error" role="alert">{signErr}</p>}
                {signed ? <Stamp status="ACTIVE" size="lg" text="SIGNED" animate /> : <Button hold={1000} onComplete={sign} disabled={!body || !message}>{copy.draft.sign}</Button>}
                {!signed && !!body && <p><Button size="sm" variant="ghost" onPaper onClick={sign}>Sign without holding</Button></p>}
              </div>
            )}
            <div class="draft__nav">
              <Button variant="secondary" onPaper disabled={d.step === 0 || !!signed} onClick={() => set({ step: d.step - 1 })}>Previous</Button>
              {d.step < 3 && <Button onPaper disabled={reason[d.step] !== null} onClick={() => set({ step: d.step + 1 })}>Next</Button>}
            </div>
            {d.step < 3 && reason[d.step] && <p class="mono draft__reason" aria-live="polite">{reason[d.step]}</p>}
          </TriplicateForm>
        </div>
      </div>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </main>
  );
}

export { Heading };
