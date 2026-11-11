import { useState } from 'preact/hooks';
import { copy } from '../copy';
import { INSPECTOR_ORDER, type Finding, type InspectorId } from '../types';
import { KeyGlyph } from './Icons';
import { Stamp } from './Stamp';
import { ExternalLink } from './misc';
import { clean, shorten } from '../lib/util';

const KEY_COLOR: Record<string, string> = {
  KEPT: 'var(--ledger-green)', WATCH: 'var(--watch-amber)', BREACHED: 'var(--stamp-red)',
  UNVERIFIABLE: 'var(--slate-grey)', PENDING: 'var(--slate-grey)',
};

/**
 * The nine inspectors as ledger rows. Idle: each row shows the question it asks.
 * Running: unresolved rows say PENDING. As each real result arrives, the key swings and the stamp lands.
 */
export function InspectionBoard({
  findings, running, started,
}: { findings: Partial<Record<InspectorId, Finding>>; running: boolean; started: boolean }) {
  const [open, setOpen] = useState<InspectorId | null>(null);
  return (
    <ol class="board" aria-label="The nine inspectors">
      {INSPECTOR_ORDER.map((id, i) => {
        const tag = copy.inspectors.tags[i]!;
        const f = findings[id];
        const isOpen = open === id;
        return (
          <li key={id} class="brow" data-status={f?.status ?? (started ? 'PENDING' : 'IDLE')}>
            <button
              class="brow__main" aria-expanded={isOpen} aria-controls={`brow-${id}`}
              onClick={() => setOpen(isOpen ? null : id)}
            >
              <span class={`brow__key${f ? ' is-swung' : ''}`} key={f?.status ?? 'none'}>
                <KeyGlyph size={30} color={f ? KEY_COLOR[f.status] : 'var(--brass)'} />
              </span>
              <span class="brow__who">
                <span class="brow__name">
                  <span class="brow__no">{tag.n}</span> {tag.name}
                </span>
                <span class="brow__line">{f ? clean(f.summary, 200) : tag.checks}</span>
              </span>
              <span class="brow__stamp">
                {f ? (
                  <Stamp status={f.status} size="sm" animate />
                ) : started && running ? (
                  <Stamp status="PENDING" size="sm" />
                ) : null}
              </span>
            </button>
            {isOpen && (
              <div class="brow__more" id={`brow-${id}`}>
                <p><em>“{tag.joke}”</em></p>
                {f?.value !== undefined && <p class="mono">Value: {shorten(String(f.value), 12)}</p>}
                <p class="mono">
                  Source: {f?.source.url ? <ExternalLink href={f.source.url}>{f.source.label}</ExternalLink> : (f?.source.label ?? 'not run yet')}
                  {f ? ` · ${f.ms} ms` : ''}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
