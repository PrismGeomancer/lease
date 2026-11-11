import type { Inspector } from '../types';
import { acct, mintInfo, mk } from './common';

export const mint: Inspector = async (ctx) => {
  const m = await mintInfo(ctx);
  const source = { label: 'Solana RPC · mint account', url: acct(ctx, ctx.mint) };
  if (m.mintAuthority === null) {
    return mk('mint', 'KEPT', 'Mint authority is null. Nobody can print more.', source, { value: 'null', evidence: { clauses: { ar: 'KEPT' }, program: m.program } });
  }
  return mk('mint', 'BREACHED', `Mint authority is still set: ${m.mintAuthority}.`, source, {
    value: m.mintAuthority, evidence: { clauses: { ar: 'BREACHED' }, authority: m.mintAuthority, program: m.program },
  });
};
