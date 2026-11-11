import { storageGet, storageSet } from './util';
import { signal } from '../signal';

export interface KeyItem {
  id: string;
  kind: 'lease' | 'report';
  title: string;
  /** lease: base64url payload; report: mint address */
  ref: string;
  savedAt: number;
}
const KEY = 'lease:keyring:v1';

export function readKeyring(): KeyItem[] {
  const raw = storageGet(KEY);
  if (!raw) return [];
  try {
    return validate(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
}

export function validate(x: unknown): KeyItem[] | null {
  if (!Array.isArray(x)) return null;
  const out: KeyItem[] = [];
  for (const i of x) {
    if (typeof i !== 'object' || i === null) return null;
    const o = i as Record<string, unknown>;
    if (typeof o.id !== 'string' || (o.kind !== 'lease' && o.kind !== 'report') || typeof o.title !== 'string' || typeof o.ref !== 'string' || typeof o.savedAt !== 'number') return null;
    if (o.ref.length > 4000 || o.title.length > 200) return null;
    out.push({ id: o.id, kind: o.kind, title: o.title, ref: o.ref, savedAt: o.savedAt });
  }
  return out;
}

export const keyring = signal<KeyItem[]>(readKeyring());
export const storageBlocked = signal<boolean>(false);

function persist(list: KeyItem[]) {
  keyring.set(list);
  storageBlocked.set(!storageSet(KEY, JSON.stringify(list)));
}
export function saveKey(item: Omit<KeyItem, 'savedAt' | 'id'>) {
  const id = `${item.kind}:${item.ref.slice(0, 64)}`;
  persist([{ ...item, id, savedAt: Date.now() }, ...keyring.get().filter((k) => k.id !== id)]);
}
export function removeKey(id: string) { persist(keyring.get().filter((k) => k.id !== id)); }
export function clearKeys() { persist([]); }
export function importKeys(text: string): number | null {
  try {
    const list = validate(JSON.parse(text));
    if (!list) return null;
    const merged = new Map(keyring.get().map((k) => [k.id, k]));
    for (const k of list) merged.set(k.id, k);
    persist([...merged.values()].sort((a, b) => b.savedAt - a.savedAt));
    return list.length;
  } catch {
    return null;
  }
}
export function exportKeys(): string { return JSON.stringify(keyring.get(), null, 2); }

export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
