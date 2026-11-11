import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { CONFIG } from '../config';
import { Button } from '../components/Button';
import { ExternalLink } from '../components/misc';
import { Stamp } from '../components/Stamp';
import { Heading } from '../components/Heading';
import { decodeLease } from '../lease/encode';
import { fingerprint, shortFingerprint } from '../lease/canonical';
import { verifyLease } from '../lease/verify';
import type { Lease } from '../lease/schema';
import { loadHistory } from '../lib/data';
import { makeCtx } from '../lib/chainctx';
import { inspectAll } from '../inspectors';
import type { Finding } from '../types';
import { CLAUSE_KINDS, reading, type HearingValues } from '../hearing/templates';
import { devSales, type SaleRow } from '../hearing/evidence';
import { downloadCard } from '../cards';
import { clean, fmtDate, shorten, storageGet, storageSet } from '../lib/util';

type Verdict = 'fair' | 'breach';
const vKey = (fp: string, clause: string) => `lease:verdict:v1:${fp}:${clause}`;

export default function HearingPage({ fingerprint: param, clause }: { fingerprint: string; clause: string }) {
  const kind = CLAUSE_KINDS[clause];
  const [lease, setLease] = useState<Lease | null | 'bad'>(null);
  const [fp, setFp] = useState('');
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let l: Lease | null = null;
      if (/^[0-9a-f]{64}$/.test(param)) l = (await loadHistory(param))?.lease ?? null;
      else l = decodeLease(param);
      if (!l || !(await verifyLease(l))) { if (alive) setLease('bad'); return; }
      const f = await fingerprint(l);
      if (!alive) return;
      setLease(l); setFp(f);
      const v = storageGet(vKey(f, clause));
      if (v === 'fair' || v === 'breach') setVerdict(v);
      const ctx = makeCtx(l.mint, { lease: l, runNeighbours: clause === 'nb' });
      try { const found = await inspectAll(ctx); if (alive) setFindings(found); } catch { if (alive) setFindings([]); }
      if (clause === 'ns') { try { const s = await devSales(ctx); if (alive) setSales(s); } catch { if (alive) setSales([]); } }
    })();
    return () => { alive = false; };
  }, [param, clause]);

  if (!kind) return <main id="main" class="container page"><h1>Hearing</h1><p>{copy.notFound.body}</p><Button href="#/">{copy.notFound.back}</Button></main>;
  if (lease === 'bad') return <main id="main" class="container page"><h1>Hearing</h1><Stamp status="BREACHED" text="NOT FOUND" /><p>No valid lease for that link.</p></main>;
  if (lease === null) return <main id="main" class="container page"><h1>Hearing</h1><p class="mono">{copy.extra.loading}</p></main>;

  const f = (id: string) => findings?.find((x) => x.id === id);
  const ev = (id: string) => (f(id)?.evidence ?? {}) as Record<string, unknown>;
  const vals: HearingValues = {};
  if (kind === 'sold') vals.pct = sales && sales.length ? Math.round(sales.reduce((n, s) => n + s.pct, 0) * 100) / 100 : '?';
  if (kind === 'devmax') { vals.pct = (ev('tenant').pct as number | undefined) ?? '?'; vals.max = lease.c.dm ?? '?'; }
  if (kind === 'top10') vals.pct = (ev('landlord').pct as number | undefined) ?? '?';
  if (kind === 'liquidity') vals.min = lease.c.liq ?? '?';
  if (kind === 'authority') vals.which = f('mint')?.status === 'BREACHED' ? 'mint' : 'freeze';
  if (kind === 'neighbours') vals.n = ((ev('neighbours').groups as { wallets: string[] }[] | undefined)?.[0]?.wallets.length) ?? '?';
  if (kind === 'noise') { const e = ev('noise'); vals.ratio = e.buys ? Math.round(((e.sells as number) / (e.buys as number)) * 100) / 100 : '?'; }
  const num = (v: unknown) => typeof v === 'number';
  const known =
    kind === 'sold' ? !!sales && sales.length > 0
    : kind === 'devmax' ? num(vals.pct)
    : kind === 'top10' ? num(vals.pct)
    : kind === 'liquidity' ? num(ev('foundations').liquidityUsd)
    : kind === 'authority' ? f('mint')?.status === 'BREACHED' || f('freeze')?.status === 'BREACHED'
    : kind === 'neighbours' ? num(vals.n)
    : kind === 'noise' ? num(vals.ratio)
    : true;
  const loaded = findings !== null && (kind !== 'sold' || sales !== null);
  const base = reading(kind, vals);
  const r = known
    ? base
    : { innocent: base.innocent, guilty: loaded ? "The evidence couldn't be read just now, so there is no guilty reading to show. Try again in a minute." : 'Reading the chain…' };

  const stamp = (v: Verdict) => { setVerdict(v); storageSet(vKey(fp, clause), v); };
  const cap = <T,>(a: T[]) => (all ? a : a.slice(0, 20));
  const holders = (ev('landlord').holders as { owner: string; pct: number }[] | undefined) ?? [];
  const groups = (ev('neighbours').groups as { funder: string; wallets: string[] }[] | undefined) ?? [];
  const funderOf = (o: string) => groups.findIndex((g) => g.wallets.includes(o));
  const pairUrl = f('foundations')?.source.url;

  return (
    <main id="main" class="container page hearing" tabIndex={-1}>
      <Heading level={1} parts={copy.hearing.heading} />
      <p class="mono">Lease {shortFingerprint(fp)} · clause <strong>{clause}</strong></p>
      <div class="tworeadings">
        <article class="paper tworeadings__col"><span class="label">{copy.hearing.innocent}</span><p>{r.innocent}</p></article>
        <span class="staple" aria-hidden="true" />
        <article class="paper tworeadings__col tworeadings__pink"><span class="label">{copy.hearing.guilty}</span><p>{r.guilty}</p></article>
      </div>

      <section class="evidence-wrap">
        <h2>Evidence</h2>
        {!findings && <p class="mono">{copy.extra.loading}</p>}
        {loaded && !known && <p class="mono">No evidence to show for this clause right now.</p>}
        {kind === 'sold' && (sales === null ? <p class="mono">Reading the dev wallet's transactions…</p> : sales.length === 0 ? <p class="mono">No dev outflows found since the lease start.</p> : (
          <table class="itable"><thead><tr><th scope="col">When</th><th scope="col">Amount (% of supply)</th><th scope="col">Where</th><th scope="col">Tx</th></tr></thead>
            <tbody>{cap(sales).map((s) => <tr key={s.signature}><td class="mono">{s.t ? fmtDate(s.t) : '—'}</td><td class="mono">{s.pct}%</td><td>{s.label}{s.kind === 'unknown' ? '' : s.kind === 'another wallet' ? ' (exchange-like address, unverified)' : ''}</td><td><ExternalLink href={`${CONFIG.EXPLORER_TX}${s.signature}`}>{shorten(s.signature, 6)}</ExternalLink></td></tr>)}</tbody></table>
        ))}
        {(kind === 'top10' || kind === 'neighbours') && holders.length > 0 && (
          <table class="itable"><thead><tr><th scope="col">Rank</th><th scope="col">Wallet</th><th scope="col">Share</th><th scope="col">Funder group</th></tr></thead>
            <tbody>{cap(holders).map((h, i) => <tr key={h.owner}><td class="mono">{i + 1}</td><td class="mono"><ExternalLink href={`${CONFIG.EXPLORER_ACCOUNT}${h.owner}`}>{shorten(h.owner, 6)}</ExternalLink></td><td class="mono">{h.pct}%</td><td>{funderOf(h.owner) >= 0 ? `Group ${funderOf(h.owner) + 1}` : '—'}</td></tr>)}</tbody></table>
        )}
        {kind === 'devmax' && <p class="mono">Dev wallet <ExternalLink href={`${CONFIG.EXPLORER_ACCOUNT}${lease.dev}`}>{shorten(lease.dev, 6)}</ExternalLink> holds {String(vals.pct)}% against a promised {String(vals.max)}%.</p>}
        {kind === 'liquidity' && <p class="mono">Liquidity now: ${Math.round((ev('foundations').liquidityUsd as number) ?? 0).toLocaleString('en-US')} · promised minimum: ${String(vals.min)} · 24h volume: ${Math.round((ev('noise').volumeUsd as number) ?? 0).toLocaleString('en-US')} {pairUrl && <ExternalLink href={pairUrl}>DexScreener</ExternalLink>}</p>}
        {(kind === 'authority' || kind === 'metadata') && <p class="mono">Authority / metadata for <ExternalLink href={`${CONFIG.EXPLORER_ACCOUNT}${lease.mint}`}>{shorten(lease.mint, 6)}</ExternalLink>: {clean([f('mint')?.summary, f('freeze')?.summary, f('paint')?.summary].filter(Boolean).join(' '), 400)}</p>}
        {kind === 'noise' && <p class="mono">{clean(f('noise')?.summary ?? '', 200)}</p>}
        {sales && sales.length > 20 && !all && <Button size="sm" variant="secondary" onClick={() => setAll(true)}>Show all</Button>}
      </section>

      <section class="verdict">
        <h2>Your verdict</h2>
        <div class="verdict__btns">
          <button class={`verdict__btn${verdict === 'fair' ? ' is-chosen' : ''}`} aria-pressed={verdict === 'fair'} onClick={() => stamp('fair')}><Stamp status="KEPT" size="md" text={copy.hearing.fair} /></button>
          <button class={`verdict__btn${verdict === 'breach' ? ' is-chosen' : ''}`} aria-pressed={verdict === 'breach'} onClick={() => stamp('breach')}><Stamp status="BREACHED" size="md" text={copy.hearing.breach} /></button>
        </div>
        <p class="mono">{copy.hearing.note}</p>
        <Button variant="secondary" onClick={() => downloadCard({ kind: 'hearing', ticker: shorten(lease.mint, 4), innocent: r.innocent, guilty: r.guilty, verdict, fp: shortFingerprint(fp) }, `hearing-${fp.slice(0, 8)}.png`)}>{copy.hearing.download}</Button>
      </section>
      <p class="hearing__back"><a href={`#/l/${param}`}>Back to the lease</a></p>
    </main>
  );
}
