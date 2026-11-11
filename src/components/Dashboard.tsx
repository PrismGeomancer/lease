import { useState } from 'preact/hooks';
import { copy } from '../copy';
import { STATUS, type Status } from '../status';
import { Svg } from './Icons';
import { Button } from './Button';
import { WalletModal } from './WalletModal';
import { useSignal } from '../signal';
import { walletState } from '../chain/wallet';
import { keyring } from '../lib/keyring';
import { recent, clearRecent } from '../lib/recent';
import { clean, shorten } from '../lib/util';
import type { Office } from '../lib/dataTypes';

/* ------------------------------------------------------------- KPI row */
function Tile({ label, value, note, icon, status }: { label: string; value: string; note: string; icon?: string; status?: Status }) {
  return (
    <li class="kpi">
      <span class="kpi__label">{icon && <Svg d={icon} size={14} />}{label}</span>
      <span class={`kpi__value${/^\d/.test(value) || value === '—' ? '' : ' kpi__value--text'}`} data-status={status}>{value}</span>
      <span class="kpi__note">{note}</span>
    </li>
  );
}

/** Real numbers only. Zero is shown as zero; while loading, an em dash, never a guess. */
export function KpiRow({ office }: { office: Office | null }) {
  const c = office?.counts;
  const n = (v: number | undefined) => (v === undefined ? '—' : String(v));
  const none = c?.onFile === 0;
  const last = office?.lastRoundAt ? new Date(office.lastRoundAt) : null;
  return (
    <ul class="kpis" aria-label="Office at a glance">
      <Tile label={copy.extra.kpiOnFile} value={n(c?.onFile)} note={none ? copy.extra.kpiFirst : copy.extra.kpiOnFileNote} />
      <Tile label={copy.extra.kpiActive} value={n(c?.active)} note={copy.extra.kpiActiveNote} icon={STATUS.ACTIVE.icon} status="ACTIVE" />
      <Tile label={copy.extra.kpiRenewed} value={n(c?.renewed)} note={copy.extra.kpiRenewedNote} icon={STATUS.RENEWED.icon} status="RENEWED" />
      <Tile label={copy.extra.kpiEvicted} value={n(c?.evicted)} note={copy.extra.kpiEvictedNote} icon={STATUS.EVICTED.icon} status="EVICTED" />
      <Tile
        label={copy.extra.kpiRound}
        value={last ? last.toISOString().slice(11, 16) + ' UTC' : office ? 'None yet' : '—'}
        note={last ? last.toISOString().slice(0, 10) : copy.extra.kpiRoundNote}
      />
    </ul>
  );
}

/* --------------------------------------------------------- verdict bar */
const ORDER: ('KEPT' | 'WATCH' | 'BREACHED' | 'UNVERIFIABLE')[] = ['KEPT', 'WATCH', 'BREACHED', 'UNVERIFIABLE'];

export interface Counts { kept: number; watch: number; breached: number; unverifiable: number }
const countOf = (c: Counts, s: (typeof ORDER)[number]) => c[s.toLowerCase() as keyof Counts];

/** One whole (the nine inspectors) split by verdict. Tall: counts printed inside. Thin: no text. */
export function VerdictBar({ counts, total = 9, thin }: { counts: Counts; total?: number; thin?: boolean }) {
  const done = counts.kept + counts.watch + counts.breached + counts.unverifiable;
  const pending = Math.max(0, total - done);
  const label = ORDER.filter((s) => countOf(counts, s) > 0).map((s) => `${countOf(counts, s)} ${s.toLowerCase()}`).join(', ') + (pending ? `, ${pending} pending` : '');
  return (
    <figure class={`vbar${thin ? ' vbar--thin' : ''}`}>
      <div class="vbar__bar" role="img" aria-label={`Nine inspectors: ${label}`}>
        {ORDER.map((s) => countOf(counts, s) > 0 && (
          <span key={s} class="vbar__seg" data-status={s} style={{ flexGrow: countOf(counts, s) }}>{thin ? '' : countOf(counts, s)}</span>
        ))}
        {pending > 0 && <span class="vbar__seg vbar__seg--pending" style={{ flexGrow: pending }} />}
      </div>
      {!thin && (
        <figcaption class="vbar__legend">
          {ORDER.filter((s) => countOf(counts, s) > 0).map((s) => (
            <span key={s} data-status={s}><i /><Svg d={STATUS[s].icon} size={14} />{s.charAt(0) + s.slice(1).toLowerCase()} {countOf(counts, s)}</span>
          ))}
          {pending > 0 && <span class="vbar__pending">Pending {pending}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/* -------------------------------------------- recent inspections + yours */
export function RecentList({ onPick, disabled }: { onPick: (mint: string) => void; disabled?: boolean }) {
  const list = useSignal(recent);
  return (
    <section class="panel2" aria-labelledby="recent-h">
      <div class="panel2__head">
        <h2 id="recent-h">{copy.extra.recentTitle}</h2>
        {list.length > 0 && <button class="linkbtn" onClick={clearRecent}>Clear</button>}
      </div>
      {list.length === 0 ? (
        <p class="panel2__empty">{copy.extra.recentEmpty}</p>
      ) : (
        <ul class="recent">
          {list.map((r) => (
            <li key={r.mint}>
              <button class="recent__row" disabled={disabled} onClick={() => onPick(r.mint)} title={r.mint}>
                <span class="recent__name">{clean(r.label, 24)}</span>
                <span class="recent__mint">{shorten(r.mint, 4)}</span>
                <VerdictBar counts={r} thin />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function YourDesk() {
  const w = useSignal(walletState);
  const keys = useSignal(keyring);
  const [open, setOpen] = useState(false);
  return (
    <section class="panel2" aria-labelledby="yours-h">
      <div class="panel2__head"><h2 id="yours-h">{copy.extra.yoursTitle}</h2></div>
      {w ? (
        <p class="panel2__text">Connected as <span class="mono">{shorten(w.address, 4)}</span>. <a href={`#/register?dev=${w.address}`}>{copy.nav.myLeases}</a></p>
      ) : (
        <div class="panel2__text">
          <p>{copy.extra.yoursConnect}</p>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{copy.nav.connect}</Button>
        </div>
      )}
      <p class="panel2__text">
        {keys.length === 0 ? copy.extra.keyringEmpty : `${keys.length} saved in your keyring.`} <a href="#/keyring">{copy.nav.keyring}</a>
      </p>
      <WalletModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
