import { getParsedMint, getParsedTx, getSignatures, type Rpc } from './rpc';
import { validateEntry, type RawEntry, type Rejection, type Validated } from '../lease/register';
import { MEMO_PREFIX } from './memo';

/** Fetch memo entries newer than `cursor`, oldest first. Shared by browser and Actions. */
export async function fetchNewEntries(
  rpc: Rpc, office: string, cursor: string | null, maxEntries = 50,
): Promise<{ entries: RawEntry[]; newCursor: string | null }> {
  const out: RawEntry[] = [];
  let before: string | undefined;
  let newest: string | null = null;
  for (let page = 0; page < 10 && out.length < maxEntries; page++) {
    const sigs = (await getSignatures(rpc, office, { limit: 100, before, until: cursor ?? undefined })) as (Awaited<ReturnType<typeof getSignatures>>[number] & { memo?: string | null })[];
    if (!sigs.length) break;
    if (page === 0) newest = sigs[0]!.signature;
    for (const s of sigs) {
      if (s.err || !s.memo || !s.blockTime) continue;
      if (!s.memo.replace(/^\[\d+\]\s/, '').startsWith(MEMO_PREFIX)) continue;
      if (out.length >= maxEntries) break;
      const tx = await getParsedTx(rpc, s.signature);
      const payer = tx?.transaction.message.accountKeys[0]?.pubkey;
      if (!payer) continue;
      out.push({ memo: s.memo, feePayer: payer, blockTime: s.blockTime, signature: s.signature });
    }
    if (sigs.length < 100) break;
    before = sigs[sigs.length - 1]!.signature;
  }
  return { entries: out.reverse(), newCursor: newest ?? cursor };
}

export async function validateAll(rpc: Rpc, raw: RawEntry[], seen: Set<string>): Promise<{ valid: Extract<Validated, { ok: true }>[]; rejected: number; reasons: Rejection[] }> {
  const valid: Extract<Validated, { ok: true }>[] = [];
  const reasons: Rejection[] = [];
  const isMint = async (m: string) => {
    try { return (await getParsedMint(rpc, m)) !== null; } catch { return false; }
  };
  for (const e of raw) {
    const v = await validateEntry(e, { seen, isMint });
    if (v.ok) valid.push(v);
    else if (v.reason !== 'duplicate') reasons.push(v.reason);
  }
  return { valid, rejected: reasons.length, reasons };
}
