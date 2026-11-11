import { useEffect, useMemo, useState } from 'preact/hooks';
import { copy } from '../copy';
import { CONFIG } from '../config';
import { Button } from '../components/Button';
import { Heading } from '../components/Heading';
import { Modal, AddressChip, ExternalLink } from '../components/misc';
import { Stamp } from '../components/Stamp';
import { TriplicateForm } from '../components/TriplicateForm';
import { PunchCard } from '../components/PunchCard';
import { Notice } from '../components/Notice';
import { Show } from '../components/Show';
import { HistoryTimeline, LeaseClauses } from '../components/LeaseParts';
import { TokenImage } from '../components/InspectionParts';
import { InspectionLog } from '../components/InspectionParts';
import { decodeLease, encodeLease } from '../lease/encode';
import { fingerprint, shortFingerprint } from '../lease/canonical';
import { verifyLease } from '../lease/verify';
import { clauseStatuses, dayOf, liveState, type LeaseState } from '../lease/evaluate';
import type { Lease } from '../lease/schema';
import { loadHistory } from '../lib/data';
import type { LeaseHistory } from '../lib/dataTypes';
import { useInspection } from '../lib/useInspection';
import { saveKey } from '../lib/keyring';
import { downloadText } from '../lib/keyring';
import { toast } from '../lib/toast';
import { downloadCard } from '../cards';
import { clean, fmtDate, shorten } from '../lib/util';
import { useSignal } from '../signal';
import { walletState } from '../chain/wallet';
import { WalletModal } from '../components/WalletModal';
import { blockTimeOf, estimateFeeSol, recordLease, type RecordStage } from '../chain/record';
import { CLAUSE_SHORT } from '../hearing/templates';

type Resolved = { lease: Lease; history: LeaseHistory | null } | 'invalid' | 'missing' | null;

export default function LeasePage({ payload }: { payload: string }) {
  const [res, setRes] = useState<Resolved>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [fp, setFp] = useState('');

  useEffect(() => {
    let alive = true;
    setRes(null); setValid(null);
    (async () => {
      let lease: Lease | null = null;
      let history: LeaseHistory | null = null;
      if (/^[0-9a-f]{64}$/.test(payload)) {
        history = await loadHistory(payload);
        lease = history?.lease ?? null;
        if (!lease) { if (alive) setRes('missing'); return; }
      } else {
        lease = decodeLease(payload);
        if (!lease) { if (alive) setRes('invalid'); return; }
      }
      const f = await fingerprint(lease);
      if (!history) history = await loadHistory(f);
      const ok = await verifyLease(lease);
      if (!alive) return;
      setFp(f); setValid(ok); setRes({ lease, history });
    })();
    return () => { alive = false; };
  }, [payload]);

  if (res === null || (typeof res === 'object' && valid === null)) {
    return <main id="main" class="container page" tabIndex={-1}><h1>Lease</h1><p class="mono">{copy.extra.loading}</p><div class="skel" style={{ width: '60%' }} /></main>;
  }
  if (res === 'invalid' || res === 'missing' || valid === false) {
    return (
      <main id="main" class="container page" tabIndex={-1}>
        <h1>Lease</h1>
        <div class="paper warnpanel" role="alert">
          <Stamp status="BREACHED" size="lg" text={res === 'missing' ? 'NOT FOUND' : 'INVALID'} />
          <p><strong>{res === 'missing' ? "That lease isn't on file." : copy.lease.invalid}</strong></p>
          <p>{res === 'invalid' ? 'The link is malformed or too large.' : res === 'missing' ? 'No record with that fingerprint exists in the register.' : 'The signature does not match the text. No inspection was run.'}</p>
          <Button href="#/">{copy.notFound.back}</Button>
        </div>
      </main>
    );
  }
  return <Valid lease={res.lease} history={res.history} fp={fp} />;
}

function Valid({ lease, history, fp }: { lease: Lease; history: LeaseHistory | null; fp: string }) {
  const insp = useInspection();
  const w = useSignal(walletState);
  const [walletOpen, setWalletOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [stage, setStage] = useState<RecordStage | null>(null);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [recTx, setRecTx] = useState<string | null>(history?.tx ?? null);
  const [recTime, setRecTime] = useState<number | null>(history?.start ?? null);
  const payload = useMemo(() => encodeLease(lease), [lease]);
  const nowSec = Math.floor(Date.now() / 1000);

  useEffect(() => { void insp.run(lease.mint, { lease });   }, [fp]);

  const statuses = useMemo(() => (insp.state.done ? clauseStatuses(lease, insp.list) : undefined), [insp.state.done, lease]);
  const start = recTime ?? lease.t0;
  const state: LeaseState = history?.state ?? (statuses ? liveState(lease, statuses, nowSec) : 'ACTIVE');
  const day = dayOf(start, nowSec, lease.term);
  const meta = insp.state.meta;
  const ticker = clean(meta?.symbol ?? '', 12) || shorten(lease.mint);
  const breached = Object.entries(statuses ?? {}).find(([, s]) => s === 'BREACHED')?.[0];
  const breachedClause = history?.breachedClause ?? breached ?? null;
  const canRecord = !!CONFIG.OFFICE_ADDRESS && !recTx;
  const rightWallet = w?.address === lease.dev;

  const doRecord = async () => {
    setRecErr(null);
    try {
      const sig = await recordLease(lease, setStage);
      setRecTx(sig);
      setRecTime(await blockTimeOf(sig).catch(() => null));
      setRecordOpen(false);
      toast(copy.toast.recorded, { href: `${CONFIG.EXPLORER_TX}${sig}`, linkText: copy.toast.viewTx });
    } catch (e) {
      setRecErr((e as Error).message);
    } finally { setStage(null); }
  };

  const stageText = stage === 'wallet' ? 'Waiting for wallet…' : stage === 'sending' ? 'Sending…' : stage === 'confirming' ? 'Confirming…' : stage === 'done' ? 'Recorded.' : null;
  const clauseLabel = breachedClause ? (CLAUSE_SHORT[breachedClause as keyof typeof CLAUSE_SHORT] ?? breachedClause) : undefined;

  return (
    <main id="main" class="container page leasepage" tabIndex={-1}>
      <div class="leasepage__top">
        <h1>{copy.lease.header.split(' · ')[1]}</h1>
        <Stamp status={state} size="xl" animate />
        <p class="mono leasepage__ticker"><TokenImage src={meta?.image} size={40} /> <strong>{ticker}</strong> {meta?.name && <span>{clean(meta.name, 40)}</span>}</p>
        <div class="leasepage__progress">
          <PunchCard days={lease.term} elapsed={state === 'RENEWED' ? lease.term : day} breachDay={state === 'EVICTED' && history?.stateAt ? dayOf(start, history.stateAt, lease.term) : undefined} />
          <p class="mono">{copy.lease.day(state === 'RENEWED' ? lease.term : day, lease.term)}</p>
        </div>
      </div>

      {state === 'EVICTED' && <Notice kind="evicted" ticker={ticker} clause={clauseLabel} date={fmtDate(history?.stateAt ?? nowSec)} />}
      {state === 'RENEWED' && <Notice kind="renewed" ticker={ticker} date={fmtDate(history?.stateAt ?? nowSec)} />}

      <div class="leasepage__grid">
        <TriplicateForm formNo="FORM L-01 / REV. 3" title={copy.lease.header} max={720}>
          <p class="mono">{copy.lease.fingerprint(shortFingerprint(fp))}</p>
          <p>I, <span class="mono">{shorten(lease.dev, 6)}</span>, lease the building <span class="mono">{shorten(lease.mint, 6)}</span> for {lease.term} days on these terms:</p>
          <LeaseClauses lease={lease} statuses={statuses} hearingBase={`#/hearing/${history ? fp : payload}`} />
          <p class="sign mono" aria-label="Signature">{shorten(lease.dev, 6)}</p>
          {!insp.state.done && <InspectionLog lines={insp.state.log} />}
          {insp.state.error && <p class="field__error" role="alert">{insp.state.error}</p>}
        </TriplicateForm>

        <aside class="leasepage__side">
          <section class="paper panel">
            <Stamp status="KEPT" size="sm" text="SIGNATURE VALID" />
            <p class="visually-note">{copy.lease.valid}</p>
            <dl class="facts mono">
              <dt>Tenant</dt><dd><AddressChip address={lease.dev} label="Tenant" link={`${CONFIG.EXPLORER_ACCOUNT}${lease.dev}`} /></dd>
              <dt>Building</dt><dd><AddressChip address={lease.mint} label="Mint" link={`${CONFIG.EXPLORER_ACCOUNT}${lease.mint}`} /></dd>
              <dt>Fingerprint</dt><dd>{fp.slice(0, 16)}…</dd>
            </dl>
            <p class="mono">{copy.lease.signed(fmtDate(lease.t0))}</p>
            <p class="mono">{recTx && recTime ? <>{copy.lease.recorded(fmtDate(recTime))} · <ExternalLink href={`${CONFIG.EXPLORER_TX}${recTx}`}>tx</ExternalLink></> : copy.lease.notRecorded}</p>
            {recTx && <Stamp status="ACTIVE" size="sm" text={`RECORDED ON-CHAIN${recTime ? ' · ' + fmtDate(recTime) : ''}`} />}
            <p class="mono">{copy.draft.truth1}</p>
            <p class="mono">{copy.draft.truth2}</p>
          </section>
          <section class="paper panel actions">
            <Button size="sm" onPaper variant="secondary" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/l/${payload}`).catch(() => {}); toast(copy.toast.leaseCopied); }}>{copy.lease.copyLink}</Button>
            <Button size="sm" onPaper variant="secondary" onClick={() => downloadCard({ kind: 'lease', ticker, dev: lease.dev, fp: shortFingerprint(fp), term: lease.term, clauses: clauseTexts(lease) }, `lease-${fp.slice(0, 8)}.png`)}>{copy.lease.downloadCard}</Button>
            <Button size="sm" onPaper variant="secondary" onClick={() => downloadText(`lease-${fp.slice(0, 8)}.json`, JSON.stringify(lease, null, 2))}>{copy.lease.downloadJson}</Button>
            <Button size="sm" onPaper variant="secondary" onClick={() => { saveKey({ kind: 'lease', title: `${ticker} · ${lease.term}-day lease`, ref: payload }); toast(copy.toast.saved); }}>{copy.lease.save}</Button>
            {state === 'RENEWED' && <Button size="sm" onPaper variant="secondary" onClick={() => downloadCard({ kind: 'renewed', ticker, term: lease.term, fp: shortFingerprint(fp) }, `renewed-${fp.slice(0, 8)}.png`)}>Download renewal card</Button>}
            {state === 'EVICTED' && <Button size="sm" onPaper variant="secondary" onClick={() => downloadCard({ kind: 'evicted', ticker, clause: clauseLabel ?? 'clause breached', date: fmtDate(history?.stateAt ?? nowSec), fp: shortFingerprint(fp) }, `eviction-${fp.slice(0, 8)}.png`)}>Download eviction notice</Button>}
            <Show if={canRecord}>
              {rightWallet
                ? <Button size="sm" onPaper onClick={() => setRecordOpen(true)}>{copy.lease.record}</Button>
                : <div><Button size="sm" onPaper onClick={() => setWalletOpen(true)} disabled={!!w}>{copy.lease.record}</Button><p class="mono">{copy.lease.wrongWallet(shorten(lease.dev))}</p></div>}
            </Show>
          </section>
          {!history && <p class="mono">Live check only, no history.</p>}
        </aside>
      </div>

      {history && <section><h2>History</h2><HistoryTimeline daily={history.daily} /></section>}
      <Modal open={recordOpen} onClose={() => !stage && setRecordOpen(false)} title={copy.lease.recordTitle}>
        <p>{copy.lease.recordBody(estimateFeeSol())}</p>
        {stageText && <p class="mono" aria-live="polite">{stageText}</p>}
        {recErr && <p class="field__error" role="alert">{recErr}</p>}
        <div class="draft__nav">
          <Button onPaper variant="secondary" disabled={!!stage} onClick={() => setRecordOpen(false)}>{copy.lease.recordNo}</Button>
          <Button onPaper loading={!!stage} onClick={doRecord}>{copy.lease.recordYes}</Button>
        </div>
      </Modal>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </main>
  );
}

function clauseTexts(l: Lease): string[] {
  const c = l.c;
  return [
    c.ar && 'Authorities renounced', c.ml && 'Metadata locked', c.dm !== undefined && `Dev holds ≤ ${c.dm}%`,
    c.ns !== undefined && `No dev sells for ${c.ns} days`, c.lp && 'LP burned or locked',
    c.tt !== undefined && `Top 10 hold ≤ ${c.tt}%`, c.liq !== undefined && `Liquidity ≥ $${c.liq}`,
  ].filter((x): x is string => !!x);
}

export { Heading };
