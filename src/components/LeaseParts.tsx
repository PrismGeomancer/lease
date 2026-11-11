import { CLAUSE_ORDER, type Lease } from '../lease/schema';
import { clauseLine } from '../lease/message';
import type { ClauseStatuses } from '../lease/evaluate';
import { Stamp } from './Stamp';
import { PunchCard } from './PunchCard';
import { TokenImage } from './InspectionParts';
import { clean, fmtDate, shorten } from '../lib/util';
import type { RegisterEntry, RoundRecord } from '../lib/dataTypes';
import type { Status } from '../status';
import type { FindingStatus } from '../types';

export function LeaseClauses({ lease, statuses, hearingBase }: { lease: Lease; statuses?: ClauseStatuses; hearingBase?: string }) {
  return (
    <ul class="clauses">
      {CLAUSE_ORDER.map((k) => {
        const line = clauseLine(lease, k);
        if (!line) return null;
        const s = statuses?.[k];
        return (
          <li key={k}>
            <span>{line.replace(/^- /, '')}</span>
            <span class="clauses__stamp">
              <Stamp status={s ?? 'PENDING'} size="sm" />
              {hearingBase && (s === 'BREACHED' || s === 'WATCH') && <a class="mono" href={`${hearingBase}/${k}`}>Hearing →</a>}
            </span>
          </li>
        );
      })}
      {lease.c.lpm && <li class="mono"><span>LP mint: {shorten(lease.c.lpm)}</span></li>}
      {lease.n && <li><span><em>Dev's statement — not inspected:</em> “{clean(lease.n, 140)}”</span></li>}
    </ul>
  );
}

export function IndexCard({ entry }: { entry: RegisterEntry }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.min(entry.term, Math.max(0, Math.floor((nowSec - entry.start) / 86400) + 1));
  const stateStatus: Status = entry.state;
  const inner = (
    <>
      <div class="icard__head">
        <TokenImage src={entry.image} size={36} />
        <div>
          <strong class="icard__ticker">{clean(entry.ticker ?? shorten(entry.mint), 12)}</strong>
          <div class="mono icard__sub">{entry.sample ? '' : shorten(entry.mint)}</div>
        </div>
      </div>
      <PunchCard days={entry.term} elapsed={entry.state === 'RENEWED' ? entry.term : elapsed} compact />
      <div class="icard__foot">
        <span class="mono">{entry.term}-day term</span>
        <Stamp status={stateStatus} size="sm" />
      </div>
    </>
  );
  return entry.sample ? (
    <article class="icard paper" aria-label={`Lease ${entry.ticker}`}>{inner}</article>
  ) : (
    <a class="icard paper" href={`#/l/${encodeURIComponent(entry.fp)}`} data-fp={entry.fp}>{inner}</a>
  );
}

const DOT: Record<string, string> = { KEPT: 'var(--ledger-green)', WATCH: 'var(--watch-amber)', BREACHED: 'var(--stamp-red)', UNVERIFIABLE: 'var(--slate-grey)', PENDING: 'var(--slate-grey)' };

export function HistoryTimeline({ daily }: { daily: { day: string; worst: FindingStatus }[] }) {
  if (!daily.length) return null;
  return (
    <ol class="timeline" aria-label="Daily history">
      {daily.slice(-90).map((d) => (
        <li key={d.day}>
          <span class="timeline__dot" style={{ background: DOT[d.worst] }} aria-hidden="true" />
          <span class="mono">{d.day}</span> <span>{d.worst}</span>
        </li>
      ))}
    </ol>
  );
}

export function lastRoundText(rounds: RoundRecord[]): string {
  const t = rounds[rounds.length - 1]?.t;
  return t ? new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
}
export { fmtDate };
