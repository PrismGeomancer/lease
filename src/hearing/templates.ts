import type { ClauseKey } from '../lease/schema';

export type HearingKind =
  | 'sold' | 'devmax' | 'top10' | 'liquidity' | 'authority' | 'metadata' | 'neighbours' | 'noise';

export interface Reading { innocent: string; guilty: string }
export interface HearingValues {
  pct?: number | string; max?: number | string; min?: number | string;
  n?: number | string; ratio?: number | string; which?: 'mint' | 'freeze';
}

/** Fixed templates (no AI). Values are filled from real evidence. */
export function reading(kind: HearingKind, v: HearingValues = {}): Reading {
  switch (kind) {
    case 'sold':
      return {
        innocent: `Dev moved ${v.pct}% to another wallet, possibly for marketing or an exchange.`,
        guilty: `Dev sold ${v.pct}% inside a no-sell window. That's a partial exit.`,
      };
    case 'devmax':
      return {
        innocent: 'Dev bought more. Confidence looks like this sometimes.',
        guilty: `Dev holds ${v.pct}% against a promised ${v.max}%.`,
      };
    case 'top10':
      return {
        innocent: 'Big holders may be exchanges or treasury wallets.',
        guilty: `${v.pct}% of supply sits in ten wallets.`,
      };
    case 'liquidity':
      return {
        innocent: 'The whole market dipped and took liquidity with it.',
        guilty: `Liquidity fell below the promised $${v.min}. Floors were pulled.`,
      };
    case 'authority':
      return {
        innocent: "The dev hasn't got round to renouncing.",
        guilty: `Someone can still ${v.which === 'freeze' ? 'freeze' : 'mint'}. That was promised away.`,
      };
    case 'metadata':
      return { innocent: 'Still fixing the logo and links.', guilty: 'The building can be renamed overnight.' };
    case 'neighbours':
      return {
        innocent: 'Same exchange paid out to several wallets.',
        guilty: `${v.n} top wallets share one funder. One tenant, many doors.`,
      };
    case 'noise':
      return {
        innocent: 'Holders cashing out after a run is normal traffic.',
        guilty: `Sellers outnumber buyers ${v.ratio} to 1.`,
      };
  }
}

/** URL clause segment: a lease clause key, or the extra inspector keys 'nb' / 'nz'. */
export const CLAUSE_KINDS: Record<string, HearingKind> = {
  ns: 'sold', dm: 'devmax', tt: 'top10', liq: 'liquidity', ar: 'authority', ml: 'metadata', nb: 'neighbours', nz: 'noise',
};

export const CLAUSE_SHORT: Record<ClauseKey | 'nb' | 'nz', string> = {
  ar: 'authority still set', ml: 'metadata still mutable', dm: 'dev over max', ns: 'dev sold',
  lp: 'LP not locked', tt: 'top 10 over limit', liq: 'liquidity under floor',
  nb: 'shared funder', nz: 'sellers outnumber buyers',
};
