export function Svg({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
export const ICON_COPY = 'M9 9h11v11H9zM5 15V4h11';
export const ICON_OUT = 'M7 17L17 7M8 7h9v9';
export const ICON_X = 'M4 4l16 16M20 4L4 20';

/** The logo key as inline SVG (brass key with red seal). */
/** The brand logo (public/logo.png). KeyGlyph stays for status-coloured keys. */
export function Logo({ size = 32 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}logo.png`} width={size} height={size} alt="" aria-hidden="true" decoding="async" style={{ display: 'block', objectFit: 'contain' }} />;
}

export function KeyGlyph({ size = 56, color = 'var(--brass)' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="60 120 400 260" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill={color}>
        <path fill-rule="evenodd" d="M168 140a116 116 0 1 1 0 232a116 116 0 1 1 0-232zm0 64a52 52 0 1 0 0 104a52 52 0 1 0 0-104z" />
        <rect x="262" y="226" width="186" height="60" rx="14" />
        <rect x="388" y="262" width="60" height="110" rx="14" />
        <rect x="320" y="262" width="44" height="76" rx="12" />
      </g>
      <circle cx="168" cy="256" r="20" fill="var(--stamp-red)" />
    </svg>
  );
}

/** One-time SVG defs (ink-bleed filter). Rendered once in the app shell. */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="ink-bleed">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
      </filter>
    </svg>
  );
}
