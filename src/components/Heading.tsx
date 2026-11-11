import type { ComponentChildren } from 'preact';

/** Heading whose odd-indexed parts are the italic brass accent (`*like this*` in the copy deck). */
export function Heading({ level = 2, parts, id, tabIndex }: { level?: 1 | 2; parts: readonly string[]; id?: string; tabIndex?: number }) {
  const Tag = (level === 1 ? 'h1' : 'h2') as 'h1';
  const kids: ComponentChildren[] = parts.map((p, i) =>
    i % 2 === 1 ? (
      <em class="accent" key={i} data-accent>
        {p}
      </em>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
  return (
    <Tag id={id} tabIndex={tabIndex} data-reveal="heading">
      {kids}
    </Tag>
  );
}
