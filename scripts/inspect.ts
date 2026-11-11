import 'dotenv/config';
import { CONFIG } from '../src/config';
import { createDex } from '../src/chain/dex';
import { createHelius } from '../src/chain/helius';
import { createRpc } from '../src/chain/rpc';
import { INSPECTOR_NAME, ROMAN, type InspectCtx } from '../src/types';
import { NotMintError, inspectAll, summarize } from '../src/inspectors';

const mint = process.argv[2];
const withNeighbours = process.argv.includes('--neighbours');
if (!mint) {
  console.error('usage: npm run inspect -- <mint> [--neighbours]');
  process.exit(1);
}
const key = process.env.HELIUS_API_KEY;
const urls = [key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : '', process.env.RPC_URL ?? '', CONFIG.PUBLIC_RPC_FALLBACK];
const rpc = createRpc({ urls });
const ctx: InspectCtx = {
  mint, rpc, now: Date.now(), runNeighbours: withNeighbours, memo: new Map(),
  dex: createDex(CONFIG.DEXSCREENER_BASE),
  helius: createHelius(rpc, key ? 'https://api.helius.xyz' : '', key),
};

try {
  const findings = await inspectAll(ctx, (f) => console.error(`${ROMAN[Object.keys(INSPECTOR_NAME).indexOf(f.id)]} ${INSPECTOR_NAME[f.id]}: ${f.status} (${f.ms} ms)`));
  console.table(findings.map((f) => ({ inspector: INSPECTOR_NAME[f.id], status: f.status, value: f.value ?? '', finding: f.summary, ms: f.ms })));
  console.log(summarize(findings), rpc.degraded ? '(fallback RPC used)' : '');
} catch (e) {
  console.error(e instanceof NotMintError ? "That address isn't a token." : `Failed: ${(e as Error).message}`);
  process.exit(2);
}
