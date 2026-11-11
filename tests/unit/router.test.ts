import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('location', { hash: '' });
vi.stubGlobal('window', { addEventListener: () => {} });

describe('router', () => {
  it('parses every route', async () => {
    const { parseHash } = await import('../../src/router');
    expect(parseHash('#/').name).toBe('home');
    expect(parseHash('').name).toBe('home');
    expect(parseHash('#/inspect').name).toBe('inspect');
    expect(parseHash('#/inspect/abc').params.mint).toBe('abc');
    expect(parseHash('#/draft').name).toBe('draft');
    expect(parseHash('#/l/xyz').params.payload).toBe('xyz');
    expect(parseHash('#/register').name).toBe('register');
    expect(parseHash('#/hearing/fp/ns').params.clause).toBe('ns');
    expect(parseHash('#/keyring').name).toBe('keyring');
    expect(parseHash('#/office').name).toBe('office');
    expect(parseHash('#/nope').name).toBe('notfound');
  });
});
