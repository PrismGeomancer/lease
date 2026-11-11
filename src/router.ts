import { signal } from './signal';

export interface Route {
  name: 'home' | 'inspect' | 'draft' | 'lease' | 'register' | 'hearing' | 'keyring' | 'office' | 'kit' | 'notfound';
  params: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = seg;
  if (seg.length === 0) return { name: 'home', params: {} };
  if (a === 'inspect' && seg.length <= 2) return { name: 'inspect', params: b ? { mint: b } : {} };
  if (a === 'draft' && seg.length === 1) return { name: 'draft', params: {} };
  if (a === 'l' && b && seg.length === 2) return { name: 'lease', params: { payload: b } };
  if (a === 'register' && seg.length === 1) return { name: 'register', params: {} };
  if (a === 'hearing' && b && c && seg.length === 3) return { name: 'hearing', params: { fingerprint: b, clause: c } };
  if (a === 'keyring' && seg.length === 1) return { name: 'keyring', params: {} };
  if (a === 'office' && seg.length === 1) return { name: 'office', params: {} };
  if (a === 'kit' && seg.length === 1 && import.meta.env.DEV) return { name: 'kit', params: {} };
  return { name: 'notfound', params: {} };
}

export const route = signal<Route>(parseHash(location.hash));
window.addEventListener('hashchange', () => {
  route.set(parseHash(location.hash));
});
