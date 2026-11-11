import { describe, it, expect } from 'vitest';
import { render } from 'preact-render-to-string';
import { h } from 'preact';
import { VerdictBar, KpiRow } from '../../src/components/Dashboard';

describe('VerdictBar', () => {
  it('prints counts, widths follow counts, pending fills the rest, and it has a text alternative', () => {
    const html = render(h(VerdictBar, { counts: { kept: 5, watch: 1, breached: 0, unverifiable: 2 } }));
    expect(html).toContain('Nine inspectors: 5 kept, 1 watch, 2 unverifiable, 1 pending');
    expect(html).toContain('flex-grow:5');
    expect(html).not.toContain('data-status="BREACHED"'); // a zero part draws nothing
    expect(html).toContain('vbar__seg--pending');
  });
  it('thin variant has no text', () => {
    const html = render(h(VerdictBar, { counts: { kept: 9, watch: 0, breached: 0, unverifiable: 0 }, thin: true }));
    expect(html).not.toContain('vbar__legend');
    expect(html).not.toContain('vbar__seg--pending');
  });
});

describe('KpiRow', () => {
  const office = (c: Partial<Record<string, number>>, last: string | null = null) =>
    ({ schema: 1 as const, generatedAt: '', lastRoundAt: last, counts: { onFile: 0, active: 0, renewed: 0, evicted: 0, rejected: 0, ...c } });
  it('shows an em dash while loading, never zero', () => {
    const html = render(h(KpiRow, { office: null }));
    expect(html).not.toMatch(/kpi__value[^>]*>0</);
    expect(html).toContain('—');
  });
  it('shows honest zeros and "None yet" before the first round', () => {
    const html = render(h(KpiRow, { office: office({}) }));
    expect(html).toContain('Be the first tenant');
    expect(html).toContain('None yet');
  });
  it('shows real counts and the last round time', () => {
    const html = render(h(KpiRow, { office: office({ onFile: 4, active: 2, renewed: 1, evicted: 1 }, '2026-02-03T04:05:00Z') }));
    expect(html).toContain('>4<');
    expect(html).toContain('04:05 UTC');
    expect(html).toContain('2026-02-03');
    expect(html).not.toContain('Be the first tenant');
  });
});
