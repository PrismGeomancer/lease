import { CONFIG } from '../config';
import { createDex } from '../chain/dex';
import { createHelius } from '../chain/helius';
import { createRpc, type Rpc } from '../chain/rpc';
import type { Lease } from '../lease/schema';
import type { InspectCtx } from '../types';

/** Dev-only network flag: append ?net=devnet before the hash, e.g. /?net=devnet#/draft */
export function network(): 'mainnet' | 'devnet' {
  try {
    return new URLSearchParams(location.search).get('net') === 'devnet' ? 'devnet' : 'mainnet';
  } catch {
    return 'mainnet';
  }
}

let rpc: Rpc | null = null;
export function getRpc(): Rpc {
  if (!rpc) {
    const urls = network() === 'devnet' ? ['https://api.devnet.solana.com'] : [CONFIG.RPC_URL, CONFIG.PUBLIC_RPC_FALLBACK];
    rpc = createRpc({ urls });
  }
  return rpc;
}

function clientKey(): string | undefined {
  try {
    return CONFIG.RPC_URL ? (new URL(CONFIG.RPC_URL).searchParams.get('api-key') ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

export function makeCtx(mint: string, opts: { lease?: Lease; runNeighbours?: boolean; ctxMemo?: InspectCtx['memo'] } = {}): InspectCtx {
  const r = getRpc();
  return {
    mint, rpc: r, now: Date.now(), memo: opts.ctxMemo ?? new Map(), lease: opts.lease, runNeighbours: opts.runNeighbours,
    dex: createDex(CONFIG.DEXSCREENER_BASE),
    helius: createHelius(r, CONFIG.HELIUS_API_BASE, clientKey()),
  };
}
