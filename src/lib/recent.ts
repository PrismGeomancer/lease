import { signal } from '../signal';
import { storageGet, storageSet } from './util';

export interface RecentItem {
  mint: string;
  label: string;
  kept: number; watch: number; breached: number; unverifiable: number;
  at: number;
}
const KEY = 'lease:recent:v1';
const MAX = 8;

function read(): RecentItem[] {
  try {
    const x = JSON.parse(storageGet(KEY) ?? '[]') as unknown;
    if (!Array.isArray(x)) return [];
    return x.filter((i): i is RecentItem => !!i && typeof i.mint === 'string' && typeof i.label === 'string'
      && ['kept', 'watch', 'breached', 'unverifiable', 'at'].every((k) => typeof (i as Record<string, unknown>)[k] === 'number')).slice(0, MAX);
  } catch {
    return [];
  }
}

export const recent = signal<RecentItem[]>(read());

/** Newest first, one entry per mint. Stored only in this browser. */
export function rememberInspection(item: Omit<RecentItem, 'at'>) {
  const list = [{ ...item, at: Date.now() }, ...recent.get().filter((r) => r.mint !== item.mint)].slice(0, MAX);
  recent.set(list);
  storageSet(KEY, JSON.stringify(list));
}
export function clearRecent() {
  recent.set([]);
  storageSet(KEY, '[]');
}
