import { Stamp } from './Stamp';

export interface NoticeProps {
  kind: 'renewed' | 'evicted';
  ticker: string;
  clause?: string;
  date: string;
}

export function Notice({ kind, ticker, clause, date }: NoticeProps) {
  return (
    <div class="door">
      <div class={`notice notice--${kind} paper`}>
        <span class="tape tape--l" aria-hidden="true" />
        <span class="tape tape--r" aria-hidden="true" />
        <h3>{kind === 'renewed' ? 'Lease renewed' : 'Eviction notice'}</h3>
        <p class="mono">{ticker} · {date}</p>
        {clause && <p>{clause}</p>}
        <Stamp status={kind === 'renewed' ? 'RENEWED' : 'EVICTED'} size="lg" />
      </div>
    </div>
  );
}
