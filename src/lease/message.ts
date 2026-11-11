import { CLAUSE_ORDER, type Lease, type LeaseBody } from './schema';
import { fingerprint } from './canonical';

export function clauseLine(body: LeaseBody, key: (typeof CLAUSE_ORDER)[number]): string | null {
  const c = body.c;
  switch (key) {
    case 'ar':
      return c.ar ? '- Mint and freeze authority are renounced.' : null;
    case 'ml':
      return c.ml ? '- Token metadata is locked.' : null;
    case 'dm':
      return c.dm !== undefined ? `- Dev holds at most ${c.dm}% of supply.` : null;
    case 'ns':
      return c.ns !== undefined
        ? `- Dev does not sell for ${c.ns} days (tolerance 0.5% of the starting balance).`
        : null;
    case 'lp':
      return c.lp ? '- Liquidity pool tokens are burned or locked.' : null;
    case 'tt':
      return c.tt !== undefined ? `- Top 10 wallets hold at most ${c.tt}%.` : null;
    case 'liq':
      return c.liq !== undefined ? `- Liquidity stays above $${c.liq}.` : null;
  }
}

/** Deterministic, human-readable message that the dev signs. */
export async function buildMessage(l: Lease | LeaseBody): Promise<string> {
  const body: LeaseBody = l;
  const fp = await fingerprint(body);
  const lines = CLAUSE_ORDER.map((k) => clauseLine(body, k)).filter((x): x is string => x !== null);
  return [
    'LEASE OFFICE — FORM L-01',
    `I, ${body.dev}, sign this lease for token ${body.mint}.`,
    `Term: ${body.term} days from ${new Date(body.t0 * 1000).toISOString()}.`,
    'Clauses:',
    ...lines,
    `Fingerprint: ${fp}`,
    'This signature moves no funds and grants no permissions.',
  ].join('\n');
}
