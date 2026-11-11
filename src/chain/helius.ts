import type { Rpc } from './rpc';

export interface DasAsset {
  mutable?: boolean;
  name?: string;
  symbol?: string;
  image?: string;
}

export interface Helius {
  getAsset(mint: string): Promise<DasAsset | null>;
  /** First incoming native SOL transfer sender for a wallet (earliest page, up to 3 pages). */
  firstFunder(wallet: string): Promise<string | null>;
}

interface HeliusTx { signature: string; nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[] }

export function createHelius(rpc: Rpc, apiBase: string, apiKey?: string, fetchImpl?: typeof fetch): Helius {
  const f = fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    async getAsset(mint) {
      if (!rpc.das) return null;
      try {
        const a = await rpc.call<{ mutable?: boolean; content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } } } | null>(
          'getAsset',
          [mint] as unknown[],
        );
        if (!a) return null;
        return { mutable: a.mutable, name: a.content?.metadata?.name, symbol: a.content?.metadata?.symbol, image: a.content?.links?.image };
      } catch {
        return null;
      }
    },
    async firstFunder(wallet) {
      if (!apiBase) return null;
      let before = '';
      let last: HeliusTx[] = [];
      for (let page = 0; page < 3; page++) {
        const url = `${apiBase}/v0/addresses/${wallet}/transactions?${apiKey ? `api-key=${apiKey}&` : ''}type=TRANSFER&limit=100${before ? `&before=${before}` : ''}`;
        const r = await f(url);
        if (!r.ok) return null;
        const txs = (await r.json()) as HeliusTx[];
        if (!txs.length) break;
        last = txs;
        if (txs.length < 100) break;
        before = txs[txs.length - 1]!.signature;
      }
      for (let i = last.length - 1; i >= 0; i--) {
        const t = last[i]!.nativeTransfers?.find((n) => n.toUserAccount === wallet && n.fromUserAccount !== wallet);
        if (t) return t.fromUserAccount;
      }
      return null;
    },
  };
}
