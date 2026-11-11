import { useEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { CONFIG } from '../config';
import { Button } from '../components/Button';
import { Heading } from '../components/Heading';
import { InspectionDesk } from '../components/InspectionDesk';
import { Accordion } from '../components/misc';
import { Stamp } from '../components/Stamp';
import { IndexCard } from '../components/LeaseParts';
import { TriplicateForm } from '../components/TriplicateForm';
import { THRESHOLDS } from '../thresholds';
import { keyring, storageBlocked, removeKey, clearKeys, exportKeys, importKeys, downloadText } from '../lib/keyring';
import { useSignal } from '../signal';
import { toast } from '../lib/toast';
import { loadRegister } from '../lib/data';
import { fetchNewEntries, validateAll } from '../chain/office';
import { getRpc } from '../lib/chainctx';
import type { RegisterEntry } from '../lib/dataTypes';
import { SAMPLES } from '../samples';
import { clean } from '../lib/util';
import { newRecord } from '../lease/evaluate';
import { fingerprint } from '../lease/canonical';

/* ----------------------------------------------------------------- Inspect */
export function InspectPage({ mint }: { mint?: string }) {
  return (
    <main id="main" class="container page" tabIndex={-1}>
      <Heading level={1} parts={copy.desk.heading} />
      <p>{copy.desk.lede}</p>
      <InspectionDesk initialMint={mint} full />
    </main>
  );
}

/* ---------------------------------------------------------------- NotFound */
export function NotFoundPage() {
  return (
    <main id="main" class="container page notfound" tabIndex={-1}>
      <svg viewBox="0 0 120 180" width="120" aria-hidden="true">
        <rect x="10" y="10" width="100" height="160" fill="#1b2238" stroke="var(--brass)" stroke-width="4" />
        <circle cx="90" cy="95" r="6" fill="var(--brass)" />
      </svg>
      <Heading level={1} parts={copy.notFound.h1} />
      <p>{copy.notFound.body}</p>
      <Button href="#/">{copy.notFound.back}</Button>
    </main>
  );
}

/* ----------------------------------------------------------------- Keyring */
export function KeyringPage() {
  const list = useSignal(keyring);
  const blocked = useSignal(storageBlocked);
  const file = useRef<HTMLInputElement>(null);
  return (
    <main id="main" class="container page" tabIndex={-1}>
      <Heading level={1} parts={copy.keyring.h1} />
      <p>{copy.keyring.lede}</p>
      {blocked && <p class="field__error" role="alert">{copy.keyring.blocked}</p>}
      <div class="hero__cta">
        <Button variant="secondary" onClick={() => downloadText('lease-keyring.json', exportKeys())}>{copy.keyring.export}</Button>
        <Button variant="secondary" onClick={() => file.current?.click()}>{copy.keyring.import}</Button>
        <Button variant="danger" hold={1200} onComplete={() => clearKeys()}>{copy.keyring.clear}</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import keyring file" onChange={async (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (!f) return;
          const n = f.size < 1_000_000 ? importKeys(await f.text()) : null;
          toast(n === null ? copy.toast.badImport : copy.toast.imported(n));
          (e.target as HTMLInputElement).value = '';
        }} />
      </div>
      {list.length === 0 ? (
        <p class="mono">{copy.keyring.empty}</p>
      ) : (
        <ul class="keyrows">
          {list.map((k) => (
            <li key={k.id} class="paper keyrow">
              <KeyIcon kind={k.kind} />
              <div>
                <strong>{clean(k.title, 80)}</strong>
                <div class="mono">{new Date(k.savedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC · {k.kind}</div>
              </div>
              <Button size="sm" onPaper variant="secondary" href={k.kind === 'lease' ? `#/l/${k.ref}` : `#/inspect/${k.ref}`}>{copy.keyring.reinspect}</Button>
              <Button size="sm" onPaper variant="ghost" onClick={() => removeKey(k.id)} ariaLabel={`Remove ${k.title}`}>×</Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
const KeyIcon = ({ kind }: { kind: string }) => <span class="label" aria-hidden="true">{kind === 'lease' ? 'L-01' : 'L-02'}</span>;

/* ---------------------------------------------------------------- Register */
type Filter = 'all' | 'active' | 'renewed' | 'evicted';
export function RegisterPage() {
  const [entries, setEntries] = useState<RegisterEntry[] | null>(null);
  const [rejected, setRejected] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'end'>('new');
  const [shown, setShown] = useState(24);
  const sentinel = useRef<HTMLDivElement>(null);
  const dev = new URLSearchParams(location.hash.split('?')[1] ?? '').get('dev');

  useEffect(() => {
    let alive = true;
    (async () => {
      const reg = await loadRegister();
      const base = reg?.leases ?? [];
      if (alive) setEntries(base);
      if (!CONFIG.OFFICE_ADDRESS) return;
      try {
        const rpc = getRpc();
        const { entries: raw } = await fetchNewEntries(rpc, CONFIG.OFFICE_ADDRESS, reg?.cursor ?? null);
        const seen = new Set(base.map((b) => b.fp));
        const { valid, rejected: rj } = await validateAll(rpc, raw, seen);
        const extra: RegisterEntry[] = valid.map((v) => ({
          fp: v.fp, mint: v.lease.mint, ticker: null, name: null, image: null, dev: v.lease.dev, term: v.lease.term, start: v.blockTime, tx: v.tx,
          state: newRecord(v.blockTime, v.lease.term).state, stateAt: null, breachedClause: null, lastRoundAt: null, worst: 'PENDING',
        }));
        if (alive) { setEntries([...extra, ...base]); setRejected(rj); }
      } catch { /* live fetch is best-effort; the data file stands */ }
    })();
    return () => { alive = false; };
  }, []);

  const real = entries ?? [];
  const source = entries !== null && real.length === 0 ? SAMPLES : real;
  const needle = q.trim().toLowerCase();
  const rows = source
    .filter((e) => filter === 'all' || e.state.toLowerCase() === filter)
    .filter((e) => !dev || e.dev === dev)
    .filter((e) => !needle || (e.ticker ?? '').toLowerCase().includes(needle) || e.mint.toLowerCase().includes(needle))
    .sort((a, b) => (sort === 'new' ? b.start - a.start : a.start + a.term * 86400 - (b.start + b.term * 86400)));

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setShown((n) => n + 24));
    io.observe(el);
    return () => io.disconnect();
  }, [rows.length]);

  return (
    <main id="main" class="container page" tabIndex={-1}>
      <Heading level={1} parts={copy.register.heading} />
      <p>{copy.register.lede}</p>
      <div class="filterbar">
        <div class="seg" role="radiogroup" aria-label="State">
          {(['all', 'active', 'renewed', 'evicted'] as Filter[]).map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} onClick={() => { setFilter(f); setShown(24); }} style={{ color: 'var(--form-white)' }}>{copy.register.filters[f]}</button>
          ))}
        </div>
        <label class="sr-only" for="reg-q">{copy.register.search}</label>
        <input id="reg-q" class="field__input" style={{ maxWidth: 260, minHeight: 44 }} placeholder={copy.register.search} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <label class="sr-only" for="reg-s">Sort</label>
        <select id="reg-s" class="field__input" style={{ maxWidth: 180, minHeight: 44 }} value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as 'new' | 'end')}>
          <option value="new">{copy.register.sortNewest}</option><option value="end">{copy.register.sortEnding}</option>
        </select>
      </div>
      <p class="mono" aria-live="polite">{entries === null ? copy.extra.loading : `${rows.length} ${rows.length === 1 ? 'lease' : 'leases'}`}{dev ? ` · tenant ${dev.slice(0, 4)}…` : ''}</p>
      {entries !== null && real.length === 0 && <p class="mono">{copy.register.empty}</p>}
      {rejected > 0 && <p class="mono">{copy.register.rejected(rejected)}</p>}
      {rows.length === 0 && entries !== null ? (
        <div><p>No leases match.</p><Button variant="secondary" onClick={() => { setFilter('all'); setQ(''); }}>Clear filters</Button></div>
      ) : (
        <div class="reg-grid">{rows.slice(0, shown).map((e) => <IndexCard key={e.fp} entry={e} />)}</div>
      )}
      <div ref={sentinel} style={{ height: 1 }} />
    </main>
  );
}

/* ------------------------------------------------------------------ Office */
export function OfficePage() {
  useEffect(() => {
    const id = location.hash.split('#')[2];
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50);
  }, []);
  const t = THRESHOLDS;
  const sections = copy.office.sections;
  return (
    <main id="main" class="container page office" tabIndex={-1}>
      <Heading level={1} parts={copy.office.h1} />
      <div class="office__layout">
        <nav class="office__toc" aria-label="On this page">
          {[...sections, 'FAQ'].map((s) => <a key={s} href={`#/office#${slug(s)}`}>{s}</a>)}
        </nav>
        <div>
          <section id={slug(sections[0])}><h2>{sections[0]}</h2>
            <ul>
              <li>Solana chain, read through Helius or the public RPC: authorities, holders, balances, transactions.</li>
              <li>DexScreener: liquidity, pair age, 24h buys, sells and volume.</li>
              <li>Metaplex / Token-2022 metadata accounts (and Helius DAS when available).</li>
              <li>Nothing is typed in by hand. No price data is shown anywhere.</li>
            </ul>
          </section>
          <section id={slug(sections[1])}><h2>{sections[1]}</h2>
            <p>Used when a coin has no lease on file. A lease replaces these with the dev's own numbers.</p>
            <table class="itable">
              <thead><tr><th scope="col">Inspector</th><th scope="col">KEPT</th><th scope="col">WATCH</th><th scope="col">BREACHED</th></tr></thead>
              <tbody>
                <tr><th scope="row">Walter Deed (top 10)</th><td>≤ {t.landlord.keptMaxPct}%</td><td>≤ {t.landlord.watchMaxPct}%</td><td>&gt; {t.landlord.watchMaxPct}%</td></tr>
                <tr><th scope="row">Ruth Keys (dev share)</th><td>≤ {t.tenant.keptMaxPct}%</td><td>≤ {t.tenant.watchMaxPct}%</td><td>&gt; {t.tenant.watchMaxPct}% (inferred dev: WATCH at most)</td></tr>
                <tr><th scope="row">Basil Stone (liquidity)</th><td>≥ ${t.foundations.keptMinUsd.toLocaleString('en-US')}</td><td>≥ ${t.foundations.watchMinUsd.toLocaleString('en-US')}</td><td>below</td></tr>
                <tr><th scope="row">Nora Knock (sells per buy, 24h)</th><td>≤ {t.noise.keptMaxRatio}</td><td>≤ {t.noise.watchMaxRatio}</td><td>above (under ${t.noise.minVolumeUsd} volume: UNVERIFIABLE)</td></tr>
                <tr><th scope="row">Ned Fence (shared funder)</th><td>1</td><td>{t.neighbours.watchAt} wallets</td><td>{t.neighbours.breachedAt}+ wallets</td></tr>
              </tbody>
            </table>
            <p>Authority checks (Ada Mint, Otto Frost) are KEPT only when the authority is null. Failed or timed-out checks are UNVERIFIABLE, never guilty.</p>
          </section>
          <section id={slug(sections[2])}><h2>{sections[2]}</h2>
            <p>Recording a lease sends one transaction from the dev wallet: a zero-lamport transfer to the Lease Office address plus a Memo containing the signed lease. The memo is public and permanent.</p>
            <p class="mono">Memo prefix: LEASE1: · Office: {CONFIG.OFFICE_ADDRESS || 'not configured yet'}</p>
          </section>
          <section id={slug(sections[3])}><h2>{sections[3]}</h2>
            <p>A scheduled GitHub Action inspects every active lease roughly every {CONFIG.ROUND_INTERVAL_MIN} minutes and writes the results as JSON files. GitHub can delay scheduled runs. A breach must be seen in {t.breachConfirmRounds} consecutive rounds before eviction, except authority checks, which are deterministic. A failed RPC call never evicts anyone.</p>
          </section>
          <section id={slug(sections[4])}><h2>{sections[4]}</h2>
            <p>{copy.office.limitsIntro}</p>
            <ul>
              <li>Nothing enforces a lease in this version.</li>
              <li>A signature proves wallet approval, not identity.</li>
              <li>Without a lease, the dev wallet is inferred and best-effort.</li>
              <li>LP lock checks are partial. Unknown pool types are UNVERIFIABLE.</li>
              <li>The neighbours check is heuristic and slow.</li>
              <li>Scheduled rounds can be delayed. The public RPC fallback can be rate-limited.</li>
              <li>Hearing verdicts are stored only on your device.</li>
              <li>Floors 2 and 3 are plans, not features.</li>
            </ul>
          </section>
          <section id={slug(sections[5])}><h2>{sections[5]}</h2>
            {copy.phases.floors.map((f) => <p key={f.t}><strong>{f.t}.</strong> {f.b}</p>)}
            <p class="mono">{copy.phases.note}</p>
          </section>
          <section id="faq"><h2>FAQ</h2>
            <Accordion items={copy.faq.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
          </section>
        </div>
      </div>
    </main>
  );
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export { Stamp, TriplicateForm, fingerprint };
