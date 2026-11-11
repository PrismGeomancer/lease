import type { Inspector } from '../types';
import { THRESHOLDS, noiseStatus } from '../thresholds';
import { bestPairOf, mk } from './common';

export const noise: Inspector = async (ctx) => {
  const pair = await bestPairOf(ctx);
  const source = { label: 'DexScreener', url: pair?.url };
  const h24 = pair?.txns?.h24;
  const vol = pair?.volume?.h24 ?? 0;
  if (!pair || !h24) return mk('noise', 'UNVERIFIABLE', 'No trading data found.', source);
  if (vol < THRESHOLDS.noise.minVolumeUsd) {
    return mk('noise', 'UNVERIFIABLE', `Too quiet to judge: $${Math.round(vol)} traded in 24h.`, source, { value: vol });
  }
  const status = noiseStatus(h24.sells, h24.buys);
  const ratio = h24.buys === 0 ? null : Math.round((h24.sells / h24.buys) * 100) / 100;
  const summary = ratio === null ? `24h: ${h24.sells} sells, no buys.` : `24h: ${h24.buys} buys, ${h24.sells} sells (${ratio} sells per buy).`;
  return mk('noise', status, summary, source, { value: ratio ?? 'no buys', evidence: { buys: h24.buys, sells: h24.sells, volumeUsd: vol } });
};
