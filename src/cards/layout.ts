/** Pure text-layout helpers (no DOM) so they can be unit-tested with a fake measurer. */
export type Measure = (text: string, sizePx: number) => number;

/** Largest font size in [min, start] at which `text` fits `maxW`; gives `min` if nothing fits. */
export function fitSize(measure: Measure, text: string, maxW: number, start: number, min: number): number {
  for (let s = start; s >= min; s -= 2) if (measure(text, s) <= maxW) return s;
  return min;
}

/** Greedy word wrap with a hard cap on lines; an over-long word is split by character. The last line gets an ellipsis if truncated. */
export function wrapLines(measure: Measure, text: string, sizePx: number, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const push = (l: string) => lines.push(l);
  for (const word of words) {
    let w = word;
    while (measure(w, sizePx) > maxW) {
      // split an over-long word
      let cut = w.length - 1;
      while (cut > 1 && measure(w.slice(0, cut), sizePx) > maxW) cut--;
      if (cur) { push(cur); cur = ''; }
      push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, sizePx) <= maxW) cur = next;
    else { push(cur); cur = w; }
  }
  if (cur) push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (last.length > 1 && measure(`${last}…`, sizePx) > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}
