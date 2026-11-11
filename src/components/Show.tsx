import type { ComponentChildren } from 'preact';

/** Renders children only when `if` is truthy and non-empty. Used for every config-dependent link. */
export function Show({ if: cond, children }: { if: unknown; children?: ComponentChildren }) {
  if (cond === undefined || cond === null || cond === false || cond === '' || cond === 0) return null;
  return <>{children}</>;
}
