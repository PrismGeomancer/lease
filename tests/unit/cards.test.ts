import { describe, it, expect } from 'vitest';
import { fitSize, wrapLines, type Measure } from '../../src/cards/layout';

// Monospace-ish fake measurer: width = chars * 0.6 * size
const measure: Measure = (t, s) => t.length * 0.6 * s;

describe('card text layout', () => {
  it('fits a 12-char ticker in its box at the display size, shrinking when needed', () => {
    const box = 580;
    for (const t of ['$DRAFTY', 'ABCDEFGHIJKL', 'WWWWWWWWWWWW']) {
      const s = fitSize(measure, t, box, 64, 24);
      expect(measure(t, s)).toBeLessThanOrEqual(box);
    }
    expect(fitSize(measure, 'ABCDEFGHIJKL', 400, 64, 24)).toBeLessThan(64);
  });
  it('returns the minimum size when nothing fits (caller must clip)', () => {
    expect(fitSize(measure, 'x'.repeat(200), 100, 40, 12)).toBe(12);
  });
  it('wraps without exceeding the width or the line cap, and truncates with an ellipsis', () => {
    const lines = wrapLines(measure, 'Dev sold 4.1 percent inside a no sell window which is a partial exit of everything', 22, 300, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(measure(l, 22)).toBeLessThanOrEqual(300);
    expect(lines[2]!.endsWith('…')).toBe(true);
  });
  it('splits a single over-long word', () => {
    const lines = wrapLines(measure, 'A'.repeat(60), 20, 200, 10);
    for (const l of lines) expect(measure(l, 20)).toBeLessThanOrEqual(200);
    expect(lines.join('')).toBe('A'.repeat(60));
  });
  it('short text stays on one line', () => {
    expect(wrapLines(measure, 'hello world', 20, 500, 2)).toEqual(['hello world']);
  });
});
