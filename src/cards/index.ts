import type { CardData } from './types';
import { toast } from '../lib/toast';
import { copy } from '../copy';

export type { CardData };

/** Lazy-loads the canvas renderer (its own chunk), draws the card and triggers a PNG download. */
export async function downloadCard(data: CardData, filename: string): Promise<void> {
  const { renderCard } = await import('./canvas');
  const blob = await renderCard(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(copy.toast.cardDownloaded);
}
