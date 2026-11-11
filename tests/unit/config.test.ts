import { describe, it, expect } from 'vitest';
import { render } from 'preact-render-to-string';
import { h } from 'preact';
import { Show } from '../../src/components/Show';
import { CONFIG } from '../../src/config';
import { copy } from '../../src/copy';

const link = (url: string) => h(Show, { if: url }, h('a', { href: url }, 'x'));

describe('config-driven links', () => {
  it('renders nothing for empty values', () => {
    for (const k of ['X_URL', 'TELEGRAM_URL', 'GITHUB_URL', 'BUY_URL', 'TOKEN_CA', 'OFFICE_ADDRESS'] as const) {
      expect(CONFIG[k]).toBe('');
      expect(render(link(CONFIG[k]))).toBe('');
    }
  });
  it('renders when set', () => {
    expect(render(link('https://x.com/a'))).toContain('href="https://x.com/a"');
  });
});

describe('copy deck', () => {
  it('has nine inspectors and nine faq items', () => {
    expect(copy.inspectors.tags).toHaveLength(9);
    expect(copy.faq).toHaveLength(9);
  });
  it('uses the configured round interval', () => {
    expect(copy.faq[4]!.a).toContain(String(CONFIG.ROUND_INTERVAL_MIN));
  });
});
