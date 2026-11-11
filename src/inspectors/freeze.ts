import type { Inspector } from '../types';
import { acct, mintInfo, mk } from './common';

export const freeze: Inspector = async (ctx) => {
  const m = await mintInfo(ctx);
  const source = { label: 'Solana RPC · mint account', url: acct(ctx, ctx.mint) };
  if (m.freezeAuthority === null) {
    return mk('freeze', 'KEPT', 'Freeze authority is null. Nobody can freeze your tokens.', source, { value: 'null', evidence: { clauses: { ar: 'KEPT' } } });
  }
  return mk('freeze', 'BREACHED', `Freeze authority is still set: ${m.freezeAuthority}.`, source, {
    value: m.freezeAuthority, evidence: { clauses: { ar: 'BREACHED' }, authority: m.freezeAuthority },
  });
};
