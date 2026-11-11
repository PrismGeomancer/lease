import { copy } from '../copy';
import { INSPECTOR_NAME, INSPECTOR_ORDER, ROMAN, type Finding, type InspectorId } from '../types';
import { Stamp } from './Stamp';
import { Accordion, ExternalLink } from './misc';
import { KeyGlyph } from './Icons';
import { clean, safeImageUrl, shorten } from '../lib/util';
import { useState } from 'preact/hooks';

export function InspectorTable({
  findings, mode = 'full',
}: { findings: Partial<Record<InspectorId, Finding>>; mode?: 'full' | 'compact' }) {
  return (
    <table class={`itable itable--${mode}`}>
      <caption class="sr-only">Inspection findings</caption>
      <thead>
        <tr>
          <th scope="col">Stamp</th><th scope="col">Inspector</th><th scope="col">Finding</th>
          <th scope="col">Value</th><th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        {INSPECTOR_ORDER.map((id, i) => {
          const f = findings[id];
          return (
            <tr key={id}>
              <td data-label="Stamp"><Stamp status={f?.status ?? 'PENDING'} size="sm" animate={!!f} /></td>
              <th scope="row" data-label="Inspector">{ROMAN[i]} · {INSPECTOR_NAME[id]}</th>
              <td data-label="Finding">{f ? clean(f.summary, 220) : <span class="skel" style={{ width: '60%', display: 'inline-block' }} />}</td>
              <td data-label="Value" class="mono">{f?.value !== undefined ? shorten(String(f.value), 8) : ''}</td>
              <td data-label="Source">{f?.source.url ? <ExternalLink href={f.source.url}>{f.source.label}</ExternalLink> : f?.source.label}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function InspectionLog({ lines }: { lines: string[] }) {
  return (
    <div class="ilog mono" role="log" aria-live="polite" aria-relevant="additions">
      {lines.map((l, i) => <div key={i}>{clean(l, 160)}</div>)}
    </div>
  );
}

export function TokenImage({ src, size = 48 }: { src?: string | null; size?: number }) {
  const [bad, setBad] = useState(false);
  const url = safeImageUrl(src);
  if (!url || bad) return <span class="timg" style={{ width: size, height: size }}><KeyGlyph size={size * 0.7} /></span>;
  return <img class="timg" src={url} width={size} height={size} alt="" referrerpolicy="no-referrer" loading="lazy" onError={() => setBad(true)} />;
}

export function summaryLine(findings: Finding[]): string {
  const n = (s: string) => findings.filter((f) => f.status === s).length;
  return copy.desk.summary(n('KEPT'), n('WATCH'), n('BREACHED'), n('UNVERIFIABLE'));
}

/** Evidence accordions: raw key/value view per inspector, with source links. */
export function Evidence({ list, mint }: { list: Finding[]; mint: string }) {
  const items = list.map((f) => ({
    q: `${INSPECTOR_NAME[f.id]} — ${f.status}`,
    a: (
      <div class="evidence">
        <p>{clean(f.summary, 300)}</p>
        {f.evidence && (
          <dl class="mono">
            {Object.entries(f.evidence).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{clean(typeof v === 'string' ? v : JSON.stringify(v, null, 1), 1200)}</dd></div>
            ))}
          </dl>
        )}
        <p class="mono">Source: {f.source.url ? <ExternalLink href={f.source.url}>{f.source.label}</ExternalLink> : f.source.label} · {f.ms} ms</p>
      </div>
    ),
  }));
  return (
    <section aria-label="Evidence" class="evidence-wrap">
      <h2>Evidence</h2>
      <Accordion items={items} single={false} />
      <p class="mono"><ExternalLink href={`https://dexscreener.com/solana/${mint}`}>DexScreener</ExternalLink></p>
    </section>
  );
}
