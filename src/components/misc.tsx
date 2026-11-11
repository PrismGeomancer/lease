import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { shorten } from '../lib/util';
import { toast, toasts, dismiss } from '../lib/toast';
import { useSignal } from '../signal';
import { copy } from '../copy';
import { Svg, ICON_COPY, ICON_OUT } from './Icons';
import { Show } from './Show';

export function ExternalLink({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Svg d={ICON_OUT} size={12} />
      <span class="sr-only"> (opens in new tab)</span>
    </a>
  );
}

export function CopyButton({ text, label = 'Copy', message = copy.toast.copied }: { text: string; label?: string; message?: string }) {
  return (
    <button
      class="iconbtn"
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast(message);
        } catch {
          toast('Copy blocked by the browser.');
        }
      }}
    >
      <Svg d={ICON_COPY} />
    </button>
  );
}

export function AddressChip({ address, label, link }: { address: string; label?: string; link?: string }) {
  return (
    <span class="chip mono" title={address}>
      {label && <span class="sr-only">{label}: </span>}
      <span>{shorten(address)}</span>
      <CopyButton text={address} label={`Copy ${label ?? 'address'}`} />
      <Show if={link}>
        <a class="iconbtn" href={link} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer">
          <Svg d={ICON_OUT} />
        </a>
      </Show>
    </span>
  );
}

export function Toasts() {
  const list = useSignal(toasts);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div class="toast" key={t.id} onClick={() => dismiss(t.id)}>
          {t.text}
          {t.href && <a href={t.href} target="_blank" rel="noopener noreferrer">{t.linkText ?? 'Open'}</a>}
        </div>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('scroll-lock');
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('scroll-lock');
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Accordion({ items, single = true }: { items: { q: string; a: ComponentChildren }[]; single?: boolean }) {
  const [open, setOpen] = useState<number[]>([]);
  const toggle = (i: number) =>
    setOpen(open.includes(i) ? open.filter((x) => x !== i) : single ? [i] : [...open, i]);
  return (
    <div class="acc">
      {items.map((it, i) => (
        <div class="acc__item" key={i} id={`faq-${i + 1}`}>
          <h3 style={{ margin: 0 }}>
            <button class="acc__btn" aria-expanded={open.includes(i)} aria-controls={`acc-p-${i}`} onClick={() => toggle(i)}>
              {it.q}
              <span aria-hidden="true">{open.includes(i) ? '–' : '+'}</span>
            </button>
          </h3>
          {open.includes(i) && <div class="acc__panel" id={`acc-p-${i}`}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{String(o)}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span>{label}{hint && <><br /><small>{hint}</small></>}</span>
    </label>
  );
}

export function NumberField({ value, onChange, min, max, step = 1, suffix, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: '%' | '$' | 'days'; label: string }) {
  const invalid = !Number.isFinite(value) || value < min || value > max;
  return (
    <span class="field">
      <span class="sr-only">{label}</span>
      <input
        class="field__input" style={{ maxWidth: '140px', minHeight: '44px' }}
        type="number" inputMode="decimal" value={value} min={min} max={max} step={step}
        aria-label={label} aria-invalid={invalid}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
      {suffix && <span class="mono" aria-hidden="true">{suffix}</span>}
      {invalid && <span class="field__error" role="alert">{min}–{max}</span>}
    </span>
  );
}
