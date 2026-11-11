import { useEffect, useState } from 'preact/hooks';

/** Tiny observable store, enough for router, toasts and wallet state. */
export interface Signal<T> {
  get(): T;
  set(v: T): void;
  subscribe(fn: (v: T) => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(v) {
      value = v;
      subs.forEach((f) => f(v));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useSignal<T>(s: Signal<T>): T {
  const [v, setV] = useState(s.get());
  useEffect(() => s.subscribe(setV), [s]);
  return v;
}
