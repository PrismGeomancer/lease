export class RpcError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

export interface Rpc {
  call<T = unknown>(method: string, params?: unknown[]): Promise<T>;
  /** true once any call had to use a fallback endpoint */
  readonly degraded: boolean;
  /** true if the primary endpoint is a Helius URL (DAS methods available) */
  readonly das: boolean;
  readonly primary: string;
}

export interface RpcOptions {
  urls: string[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  ttlMs?: number;
  tries?: number;
}

const RETRYABLE = new Set([429, 403, 408, 500, 502, 503, 504]);

export function createRpc(opts: RpcOptions): Rpc {
  const urls = opts.urls.filter(Boolean);
  const f = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const ttl = opts.ttlMs ?? 60_000;
  const tries = opts.tries ?? 3;
  const cache = new Map<string, { value: unknown; expires: number }>();
  let degraded = false;
  let id = 0;

  async function once<T>(url: string, method: string, params: unknown[]): Promise<T> {
    const res = await f(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    });
    if (!res.ok) throw Object.assign(new RpcError(`HTTP ${res.status}`, res.status), { retry: RETRYABLE.has(res.status) });
    const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };
    if (json.error) {
      throw Object.assign(new RpcError(json.error.message, json.error.code), { retry: json.error.code === -32005 });
    }
    return json.result as T;
  }

  return {
    get degraded() {
      return degraded;
    },
    get das() {
      return /helius/i.test(urls[0] ?? '');
    },
    get primary() {
      return urls[0] ?? '';
    },
    async call<T>(method: string, params: unknown[] = []): Promise<T> {
      const key = method + JSON.stringify(params);
      const hit = cache.get(key);
      if (hit && hit.expires > Date.now()) return hit.value as T;
      let last: unknown = new RpcError('no endpoint configured');
      for (let u = 0; u < urls.length; u++) {
        for (let attempt = 0; attempt < tries; attempt++) {
          try {
            const value = await once<T>(urls[u]!, method, params);
            if (u > 0) degraded = true;
            cache.set(key, { value, expires: Date.now() + ttl });
            return value;
          } catch (e) {
            last = e;
            const retry = (e as { retry?: boolean }).retry ?? !(e instanceof RpcError); // network/CORS errors retry
            if (!retry) throw e; // real JSON-RPC errors (e.g. invalid params) don't retry or fall back
            if (attempt < tries - 1) await sleep(200 * 2 ** attempt);
          }
        }
        degraded = true;
      }
      throw last;
    },
  };
}

// ---------- typed helpers ----------
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export interface ParsedMint {
  program: 'spl-token' | 'token-2022';
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
  extensions: { extension: string; state?: Record<string, unknown> }[];
}

interface AccountValue {
  owner: string;
  data: { parsed?: { type: string; info: Record<string, unknown> }; program?: string } | [string, string];
  lamports: number;
}

export async function getParsedMint(rpc: Rpc, mint: string): Promise<ParsedMint | null> {
  const r = await rpc.call<{ value: AccountValue | null }>('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const v = r.value;
  if (!v || Array.isArray(v.data)) return null;
  const parsed = v.data.parsed;
  if (!parsed || parsed.type !== 'mint') return null;
  const info = parsed.info as Record<string, unknown>;
  return {
    program: v.owner === TOKEN_2022_PROGRAM ? 'token-2022' : 'spl-token',
    mintAuthority: (info.mintAuthority as string | null) ?? null,
    freezeAuthority: (info.freezeAuthority as string | null) ?? null,
    supply: String(info.supply),
    decimals: Number(info.decimals),
    extensions: (info.extensions as ParsedMint['extensions']) ?? [],
  };
}

export async function getMultipleParsed(rpc: Rpc, keys: string[]): Promise<(AccountValue | null)[]> {
  const out: (AccountValue | null)[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const r = await rpc.call<{ value: (AccountValue | null)[] }>('getMultipleAccounts', [keys.slice(i, i + 100), { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    out.push(...r.value);
  }
  return out;
}

export async function getRawAccount(rpc: Rpc, key: string): Promise<Uint8Array | null> {
  const r = await rpc.call<{ value: { data: [string, string] } | null }>('getAccountInfo', [key, { encoding: 'base64', commitment: 'confirmed' }]);
  if (!r.value) return null;
  return Uint8Array.from(atob(r.value.data[0]), (c) => c.charCodeAt(0));
}

export interface LargestAccount { address: string; amount: string }
export async function getLargestAccounts(rpc: Rpc, mint: string): Promise<LargestAccount[]> {
  const r = await rpc.call<{ value: LargestAccount[] }>('getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]);
  return r.value;
}

export async function getOwnerBalance(rpc: Rpc, owner: string, mint: string): Promise<bigint> {
  const r = await rpc.call<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>(
    'getTokenAccountsByOwner',
    [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
  );
  return r.value.reduce((s, a) => s + BigInt(a.account.data.parsed.info.tokenAmount.amount), 0n);
}

export interface SigInfo { signature: string; blockTime: number | null; err: unknown }
export async function getSignatures(rpc: Rpc, address: string, opts: { limit?: number; before?: string; until?: string } = {}): Promise<SigInfo[]> {
  return rpc.call<SigInfo[]>('getSignaturesForAddress', [address, { limit: opts.limit ?? 1000, before: opts.before, until: opts.until, commitment: 'confirmed' }]);
}

export interface ParsedTx {
  blockTime: number | null;
  transaction: { message: { accountKeys: { pubkey: string; signer?: boolean }[]; instructions: unknown[] } };
  meta: {
    err: unknown;
    preTokenBalances?: { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }[];
    postTokenBalances?: { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }[];
    preBalances?: number[];
    postBalances?: number[];
    logMessages?: string[];
  } | null;
}
export async function getParsedTx(rpc: Rpc, signature: string): Promise<ParsedTx | null> {
  return rpc.call<ParsedTx | null>('getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 255, commitment: 'confirmed' }]);
}
