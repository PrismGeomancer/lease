import type { ComponentChildren } from 'preact';
import { useHold } from '../lib/useHold';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  hold?: number;
  onClick?: (e: MouseEvent) => void;
  onComplete?: () => void;
  onPaper?: boolean;
  type?: 'button' | 'submit';
  icon?: ComponentChildren;
  children?: ComponentChildren;
  ariaLabel?: string;
}

export function Button(p: ButtonProps) {
  const { variant = 'primary', size = 'md', loading, disabled, href, hold, onPaper } = p;
  const cls = `btn btn--${variant} btn--${size}${onPaper ? ' btn--on-paper' : ''}`;
  const inner = (
    <>
      {p.icon}
      <span>{p.children}</span>
      {loading && <span class="btn__dots" aria-hidden="true" />}
    </>
  );
  if (hold) return <HoldButton {...p} cls={cls} />;
  if (href && !disabled) {
    return (
      <a class={cls} href={href} aria-label={p.ariaLabel}>
        {inner}
      </a>
    );
  }
  return (
    <button
      class={cls}
      type={p.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={p.ariaLabel}
      onClick={p.onClick}
    >
      {inner}
    </button>
  );
}

function HoldButton(p: ButtonProps & { cls: string }) {
  const { progress, handlers } = useHold({ durationMs: p.hold ?? 1000, onComplete: () => p.onComplete?.() });
  const hintId = `hold-${Math.round(Math.random() * 1e6)}`;
  return (
    <>
      <button
        class={p.cls}
        type="button"
        disabled={p.disabled}
        aria-describedby={hintId}
        {...handlers}
        style={{ touchAction: 'none' }}
      >
        <svg class="btn__ring" aria-hidden="true" preserveAspectRatio="none">
          <rect
            x="1.5" y="1.5" rx="6" width="calc(100% - 3px)" height="calc(100% - 3px)"
            pathLength={100} stroke-dasharray="100" stroke-dashoffset={100 - progress * 100}
          />
        </svg>
        <span>{p.children}</span>
      </button>
      <span id={hintId} class="sr-only">Press and hold</span>
    </>
  );
}
