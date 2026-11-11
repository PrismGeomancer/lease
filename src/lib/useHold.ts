import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export interface HoldOptions { durationMs: number; onComplete: () => void }

/** Press-and-hold hook. Pointer + Space/Enter. progress 0..1 via rAF. */
export function useHold({ durationMs, onComplete }: HoldOptions) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const cooldown = useRef(false);
  const cb = useRef(onComplete);
  cb.current = onComplete;

  const cancel = useCallback(() => {
    start.current = null;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (start.current === null) return;
    const p = Math.min(1, (performance.now() - start.current) / durationMs);
    setProgress(p);
    if (p >= 1) {
      start.current = null;
      cooldown.current = true;
      navigator.vibrate?.(12);
      cb.current();
      setTimeout(() => {
        cooldown.current = false;
        setProgress(0);
      }, 600);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [durationMs]);

  const begin = useCallback(() => {
    if (cooldown.current || start.current !== null) return;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      begin();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        begin();
      }
    },
    onKeyUp: (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') cancel();
    },
    onBlur: cancel,
  };
  return { progress, handlers };
}
