import type { ComponentChildren } from 'preact';
import { copy } from '../copy';

export interface TriplicateProps {
  formNo: string;
  title?: string;
  tilt?: number;
  torn?: boolean;
  labels?: boolean;
  max?: number;
  children?: ComponentChildren;
}

export function TriplicateForm({ formNo, title, tilt = 0, torn, labels, max, children }: TriplicateProps) {
  return (
    <div
      class={`tri${torn ? ' tri--torn' : ''}`}
      style={{ '--tilt': `${tilt}deg`, '--tri-max': max ? `${max}px` : undefined } as Record<string, string | undefined>}
    >
      <div class="tri__sheet tri__sheet--pink" aria-hidden="true" />
      <div class="tri__sheet tri__sheet--yellow" aria-hidden="true" />
      <section class="tri__main paper" aria-label={title ?? formNo}>
        <span class="smudge" style={{ left: '12%', bottom: '10%' }} aria-hidden="true" />
        <span class="smudge" style={{ right: '8%', top: '30%', width: '80px' }} aria-hidden="true" />
        <span class="tri__no">{formNo}</span>
        {title && <h3 class="tri__title">{title}</h3>}
        {children}
        {labels && (
          <div class="tri__labels" aria-hidden={!torn}>
            <span>{copy.hero.officeCopy}</span>
            <span>{copy.hero.yourCopy}</span>
            <span>{copy.hero.devCopy}</span>
          </div>
        )}
      </section>
    </div>
  );
}
