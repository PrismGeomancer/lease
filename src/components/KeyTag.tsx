import { useState } from 'preact/hooks';
import type { Status } from '../status';
import { KeyGlyph } from './Icons';
import { Stamp } from './Stamp';

export interface KeyTagProps {
  index: string;
  name: string;
  checks: string;
  joke: string;
  status?: Status;
  source?: string;
  demo?: boolean;
  onOpen?: () => void;
}

export function KeyTag({ index, name, checks, joke, status = 'PENDING', source, demo, onOpen }: KeyTagProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        class="keytag"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) onOpen?.();
        }}
      >
        <span class="keytag__key"><KeyGlyph size={56} /></span>
        <span class="keytag__tag">
          <span class="keytag__no">{index}</span> {name}
          <br />
          <Stamp status={status} size="sm" text={demo ? `DEMO · ${status}` : undefined} />
        </span>
      </button>
      {open && (
        <div class="keytag__detail" role="note">
          <strong>{checks}</strong>
          <p>“{joke}”</p>
          {source && <span class="mono">Source: {source}</span>}
        </div>
      )}
    </div>
  );
}
