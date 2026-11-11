/**
 * Office rounds. Run by GitHub Actions (and locally: `npm run rounds`).
 * Reads the Lease Office address on-chain, inspects every active lease, writes JSON into public/data/.
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '../src/config';
import { copy } from '../src/copy';
import { createDex, bestPair } from '../src/chain/dex';
import { createHelius } from '../src/chain/helius';
import { createRpc, getParsedMint } from '../src/chain/rpc';
import { fetchNewEntries, validateAll } from '../src/chain/office';
import { fingerprint } from '../src/lease/canonical';
import { parseLease, type Lease } from '../src/lease/schema';
import { newHistory, processRound } from '../src/lease/rounds';
import { inspectAll } from '../src/inspectors';
import { CLAUSE_SHORT } from '../src/hearing/templates';
import { THRESHOLDS } from '../src/thresholds';
import type { Bulletin, LeaseHistory, LeaseOwn, Office, Register, RegisterEntry, TokenFacts } from '../src/lib/dataTypes';
import type { InspectCtx } from '../src/types';

const DATA = path.resolve(process.cwd(), 'public/data');
const env = process.env;
const key = env.HELIUS_API_KEY;
const OFFICE = env.OFFICE_ADDRESS || CONFIG.OFFICE_ADDRESS;
const TOKEN = env.TOKEN_CA || CONFIG.TOKEN_CA;
const SITE = (env.SITE_URL || '').replace(/\/$/, '');
const devnet = env.NET === 'devnet';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log('[rounds]', ...a.map((x) => (typeof x === 'string' ? x.replace(key ?? '\u0000', '***') : x)));

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(DATA, file), 'utf8')) as T; } catch { return fallback; }
}
async function writeJson(file: string, v: unknown) {
  const p = path.join(DATA, file);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(v, null, 2) + '\n');
}

async function telegram(text: string) {
  const token = env.TELEGRAM_BOT_TOKEN, chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    if (!r.ok) log(`telegram HTTP ${r.status}`);
  } catch { log('telegram failed'); }
}

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const nowIso = new Date(now * 1000).toISOString();
  const urls = devnet
    ? ['https://api.devnet.solana.com']
    : [key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : '', CONFIG.PUBLIC_RPC_FALLBACK];
  const rpc = createRpc({ urls, sleep });
  const helius = createHelius(rpc, key ? 'https://api.helius.xyz' : '', key);
  const dex = createDex(CONFIG.DEXSCREENER_BASE);

  const register = await readJson<Register>('register.json', { schema: 1, generatedAt: nowIso, cursor: null, leases: [] });
  const bulletin = await readJson<Bulletin>('bulletin.json', { schema: 1, generatedAt: nowIso, items: [] });
  const own = await readJson<LeaseOwn>('lease-own.json', { schema: 1, lease: null });
  const alerts = await readJson<{ schema: 1; sent: string[] }>('alerts.json', { schema: 1, sent: [] });
  const funderObj = await readJson<{ schema: 1; funders: Record<string, string | null> }>('funders.json', { schema: 1, funders: {} });
  const funders = new Map(Object.entries(funderObj.funders));
  let rejected = 0;
  const memo = new Map<string, Awaited<ReturnType<typeof helius.getAsset>>>();
  const meta = async (mint: string) => {
    if (!memo.has(mint)) memo.set(mint, await helius.getAsset(mint).catch(() => null));
    return memo.get(mint) ?? null;
  };
  const alert = async (k: string, text: string) => {
    if (alerts.sent.includes(k)) return;
    alerts.sent.push(k);
    await telegram(text);
  };
  const url = (fp: string) => (SITE ? `${SITE}/#/l/${fp}` : `#/l/${fp}`);

  // 1. New recordings on-chain
  if (OFFICE) {
    try {
      const { entries, newCursor } = await fetchNewEntries(rpc, OFFICE, register.cursor);
      const seen = new Set(register.leases.map((l) => l.fp));
      const { valid, rejected: rj } = await validateAll(rpc, entries, seen);
      rejected += rj;
      for (const v of valid) {
        const m = await meta(v.lease.mint);
        const entry: RegisterEntry = {
          fp: v.fp, mint: v.lease.mint, ticker: m?.symbol?.slice(0, 12) ?? null, name: m?.name?.slice(0, 40) ?? null, image: m?.image ?? null,
          dev: v.lease.dev, term: v.lease.term, start: v.blockTime, tx: v.tx, state: 'ACTIVE', stateAt: null, breachedClause: null,
          lastRoundAt: null, worst: 'PENDING',
        };
        register.leases.push(entry);
        await writeJson(`leases/${v.fp}.json`, newHistory(v.lease, v.tx, v.blockTime, nowIso));
        bulletin.items.push({ t: v.blockTime, kind: 'NEW', fp: v.fp, ticker: entry.ticker, term: v.lease.term });
        await alert(`${v.fp}:NEW`, copy.alerts.newLease(entry.ticker ?? v.lease.mint.slice(0, 6), v.lease.term, url(v.fp)));
        log(`new lease ${v.fp.slice(0, 12)}`);
      }
      register.cursor = newCursor;
    } catch (e) {
      log('office fetch failed (cursor not advanced):', (e as Error).message);
    }
  } else log('OFFICE_ADDRESS empty: skipping register scan');

  // 2. $LEASE's own lease gets inspected too (history file only; not in the register unless recorded)
  const targets: { fp: string; lease: Lease; entry?: RegisterEntry }[] = [];
  for (const e of register.leases) if (e.state === 'ACTIVE') {
    const h = await readJson<LeaseHistory | null>(`leases/${e.fp}.json`, null);
    if (h?.lease && parseLease(h.lease)) targets.push({ fp: e.fp, lease: h.lease, entry: e });
  }
  if (own.lease && parseLease(own.lease)) {
    const fp = await fingerprint(own.lease);
    if (!targets.some((t) => t.fp === fp)) {
      const h = await readJson<LeaseHistory | null>(`leases/${fp}.json`, null);
      if (!h || h.state === 'ACTIVE') targets.push({ fp, lease: own.lease });
    }
  }

  // 3. Inspect each active lease, sequentially
  for (const t of targets) {
    try {
      let h = await readJson<LeaseHistory | null>(`leases/${t.fp}.json`, null);
      h ??= newHistory(t.lease, '', t.lease.t0, nowIso);
      const ctx: InspectCtx = { mint: t.lease.mint, lease: t.lease, rpc, dex, helius, now: now * 1000, runNeighbours: true, memo: new Map(), funders };
      const findings = await inspectAll(ctx);
      const r = processRound(h, findings, now);
      await writeJson(`leases/${t.fp}.json`, r.history);
      if (t.entry) {
        t.entry.lastRoundAt = now; t.entry.worst = r.worst; t.entry.state = r.history.state;
        t.entry.stateAt = r.history.stateAt; t.entry.breachedClause = r.history.breachedClause;
      }
      if (r.transition && r.transition.to !== 'ACTIVE') {
        const ticker = t.entry?.ticker ?? t.lease.mint.slice(0, 6);
        const clause = r.transition.clause ? (CLAUSE_SHORT[r.transition.clause as keyof typeof CLAUSE_SHORT] ?? r.transition.clause) : '';
        bulletin.items.push({ t: now, kind: r.transition.to === 'EVICTED' ? 'EVICTED' : 'RENEWED', fp: t.fp, ticker: t.entry?.ticker ?? null, term: t.lease.term, ...(r.transition.clause ? { clause: r.transition.clause } : {}) });
        await alert(`${t.fp}:${r.transition.to}`, r.transition.to === 'EVICTED' ? copy.alerts.evicted(ticker, clause, url(t.fp)) : copy.alerts.renewed(ticker, t.lease.term, url(t.fp)));
        log(`${t.fp.slice(0, 12)} -> ${r.transition.to}`);
      } else log(`${t.fp.slice(0, 12)} round ok (${r.worst})`);
    } catch (e) {
      log(`lease ${t.fp.slice(0, 12)} skipped this round:`, (e as Error).message); // never a false eviction
    }
    await sleep(150);
  }

  // 4. $LEASE token facts
  let token: TokenFacts = { schema: 1, generatedAt: nowIso, mint: null, supply: null, decimals: null, mintAuthority: null, freezeAuthority: null, liquidityUsd: null, pairUrl: null };
  if (TOKEN) {
    try {
      const m = await getParsedMint(rpc, TOKEN);
      const pair = bestPair(await dex.pairs(TOKEN).catch(() => []));
      if (m) token = { schema: 1, generatedAt: nowIso, mint: TOKEN, supply: m.supply, decimals: m.decimals, mintAuthority: m.mintAuthority, freezeAuthority: m.freezeAuthority, liquidityUsd: pair?.liquidity?.usd ?? null, pairUrl: pair?.url ?? null };
    } catch (e) { log('token facts failed:', (e as Error).message); }
  }

  // 5. Write everything
  const counts = {
    onFile: register.leases.length,
    active: register.leases.filter((l) => l.state === 'ACTIVE').length,
    renewed: register.leases.filter((l) => l.state === 'RENEWED').length,
    evicted: register.leases.filter((l) => l.state === 'EVICTED').length,
    rejected: 0,
  };
  counts.rejected = ((await readJson<Office | null>('office.json', null))?.counts.rejected ?? 0) + rejected;
  const office: Office = { schema: 1, generatedAt: nowIso, lastRoundAt: nowIso, counts };
  bulletin.items = bulletin.items.sort((a, b) => a.t - b.t).slice(-30);
  bulletin.generatedAt = nowIso;
  register.generatedAt = nowIso;
  await writeJson('register.json', register);
  await writeJson('bulletin.json', bulletin);
  await writeJson('office.json', office);
  await writeJson('token.json', token);
  await writeJson('alerts.json', { schema: 1, sent: alerts.sent.slice(-500) });
  await writeJson('funders.json', { schema: 1, funders: Object.fromEntries(funders) });
  log(`done: ${counts.onFile} on file, ${counts.active} active, breach rule = ${THRESHOLDS.breachConfirmRounds} rounds`);
}

main().catch((e) => { console.error('[rounds] fatal:', (e as Error).message); process.exit(1); });
