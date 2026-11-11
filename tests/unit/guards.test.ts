import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const BANNED = [
  'BLACKBOX', 'bureau', 'investigator', 'lorem', 'TODO', 'guaranteed', '100x', 'moon', 'profit', 'returns',
  'reward', 'airdrop', 'giveaway', 'passive income', 'financial freedom', 'buy now',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'coverage', '.git', 'test-results', 'playwright-report', 'logo'].includes(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('truth guard', () => {
  const files = [
    ...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'public')), ...walk(path.join(ROOT, 'scripts')),
    path.join(ROOT, 'index.html'), path.join(ROOT, 'README.md'), path.join(ROOT, 'BUILD_LOG.md'),
  ].filter((f) => existsSync(f) && /\.(ts|tsx|css|json|html|md|txt|webmanifest|xml)$/.test(f));

  it('scans a meaningful set of files', () => expect(files.length).toBeGreaterThan(30));

  for (const word of BANNED) {
    it(`no "${word}" anywhere in shipped text`, () => {
      const re = new RegExp(`\\b${word.replace(/ /g, '\\s+')}`, 'i');
      const hits = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
      expect(hits).toEqual([]);
    });
  }

  it('the copy deck makes no promise of payouts', () => {
    const copy = readFileSync(path.join(ROOT, 'src/copy.ts'), 'utf8');
    expect(copy).toContain('no payouts, no revenue share');
  });
  it('every page footer carries the risk line', () => {
    const shell = readFileSync(path.join(ROOT, 'src/components/Shell.tsx'), 'utf8');
    expect(shell).toContain('copy.footer.risk');
  });
});

describe.skipIf(!existsSync(path.join(ROOT, 'dist')))('dist secret scan', () => {
  const files = existsSync(path.join(ROOT, 'dist')) ? walk(path.join(ROOT, 'dist')).filter((f) => /\.(js|html|css|json|xml|webmanifest)$/.test(f)) : [];
  it('contains no API keys or Telegram tokens', () => {
    // The Actions key lives in .env locally. The domain-restricted client key (VITE_RPC_URL) is the only one allowed in a build.
    const envFile = existsSync(path.join(ROOT, '.env')) ? readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
    const key = (process.env.HELIUS_API_KEY ?? /HELIUS_API_KEY=(\S+)/.exec(envFile)?.[1] ?? '').trim();
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/\d{8,10}:[A-Za-z0-9_-]{35}/);
      expect(t, f).not.toMatch(/HELIUS_API_KEY/);
      if (key) expect(t, f).not.toContain(key);
    }
  });
  it('ships a CSP meta tag', () => {
    expect(readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8')).toContain('Content-Security-Policy');
  });
});
