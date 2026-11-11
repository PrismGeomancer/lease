export interface Pair {
  dexId: string;
  pairAddress: string;
  url?: string;
  pairCreatedAt?: number;
  liquidity?: { usd?: number };
  txns?: { h24?: { buys: number; sells: number } };
  volume?: { h24?: number };
  baseToken?: { address: string; name?: string; symbol?: string };
}

export interface Dex {
  pairs(mint: string): Promise<Pair[]>;
}

export function bestPair(pairs: Pair[]): Pair | null {
  let best: Pair | null = null;
  for (const p of pairs) if (!best || (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0)) best = p;
  return best;
}

export function createDex(base: string, fetchImpl?: typeof fetch, ttlMs = 15_000): Dex {
  const f = fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const cache = new Map<string, { v: Pair[]; exp: number }>();
  const get = async (url: string) => {
    const r = await f(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`DexScreener HTTP ${r.status}`);
    return r.json() as Promise<unknown>;
  };
  return {
    async pairs(mint) {
      const hit = cache.get(mint);
      if (hit && hit.exp > Date.now()) return hit.v;
      let pairs: Pair[] = [];
      try {
        const a = await get(`${base}/tokens/v1/solana/${mint}`);
        if (Array.isArray(a)) pairs = a as Pair[];
        else throw new Error('unexpected shape');
      } catch {
        const b = (await get(`${base}/latest/dex/tokens/${mint}`)) as { pairs?: (Pair & { chainId?: string })[] | null };
        pairs = (b.pairs ?? []).filter((p) => !p.chainId || p.chainId === 'solana');
      }
      cache.set(mint, { v: pairs, exp: Date.now() + ttlMs });
      return pairs;
    },
  };
}
