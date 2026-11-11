import { signal } from '../signal';

export interface ToastItem { id: number; text: string; href?: string; linkText?: string }
export const toasts = signal<ToastItem[]>([]);
let nextId = 1;

export function toast(text: string, opts: { href?: string; linkText?: string } = {}) {
  const item: ToastItem = { id: nextId++, text, ...opts };
  toasts.set([...toasts.get(), item].slice(-3));
  setTimeout(() => dismiss(item.id), 3500);
}
export function dismiss(id: number) {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}
