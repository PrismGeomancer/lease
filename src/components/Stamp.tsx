import { useEffect, useRef } from 'preact/hooks';
import { STATUS, type Status } from '../status';
import { Svg } from './Icons';
import { prefersReducedMotion } from '../lib/util';

export interface StampProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  diagonal?: boolean;
  rotate?: number;
  text?: string;
}

export function Stamp({ status, size = 'md', animate, diagonal, rotate, text }: StampProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const meta = STATUS[status];
  useEffect(() => {
    const el = ref.current;
    if (!animate || !el || prefersReducedMotion() || !el.animate) return;
    el.animate(
      [
        { transform: `scale(1.6) rotate(-18deg)`, opacity: 0 },
        { transform: `scale(1) rotate(${rotate ?? -8}deg)`, opacity: 1 },
      ],
      { duration: 140, easing: 'cubic-bezier(.6,-0.28,.74,.05)', fill: 'none' },
    );
  }, [animate, status, rotate]);
  const cls = `stamp stamp--${size}${status === 'PENDING' ? ' stamp--outline' : ''}${diagonal ? ' stamp--diag' : ''}`;
  return (
    <span
      ref={ref}
      class={cls}
      data-status={status}
      style={{ '--stamp-color': meta.color, '--stamp-rot': `${rotate ?? -8}deg` } as Record<string, string>}
    >
      {meta.icon && <Svg d={meta.icon} />}
      <span>{text ?? meta.text}</span>
    </span>
  );
}
