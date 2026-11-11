import type { Inspector } from '../types';
import { getRawAccount } from '../chain/rpc';
import { metadataPda, parseMetaplexMetadata } from '../chain/pda';
import { acct, mintInfo, mk } from './common';

/** Decide mutability from, in order: Helius DAS, Token-2022 metadata extension, Metaplex PDA. */
export const paint: Inspector = async (ctx) => {
  let mutable: boolean | null = null;
  let via = '';

  const asset = await ctx.helius?.getAsset(ctx.mint);
  if (asset && typeof asset.mutable === 'boolean') {
    mutable = asset.mutable;
    via = 'Helius DAS';
  }
  if (mutable === null) {
    const m = await mintInfo(ctx);
    const ext = m.extensions.find((e) => e.extension === 'tokenMetadata');
    if (ext?.state) {
      mutable = ext.state.updateAuthority != null; // null update authority => locked
      via = 'Token-2022 metadata extension';
    }
  }
  if (mutable === null) {
    const data = await getRawAccount(ctx.rpc, await metadataPda(ctx.mint));
    if (data) {
      mutable = parseMetaplexMetadata(data).isMutable;
      via = 'Metaplex metadata account';
    }
  }
  const source = { label: via || 'Metaplex metadata', url: acct(ctx, ctx.mint) };
  if (mutable === null) {
    return mk('paint', 'UNVERIFIABLE', "No metadata found, so mutability can't be confirmed.", source, { evidence: { clauses: { ml: 'UNVERIFIABLE' } } });
  }
  if (!mutable) return mk('paint', 'KEPT', 'Metadata is immutable. Name and image are locked.', source, { value: 'immutable', evidence: { clauses: { ml: 'KEPT' }, via } });
  const status = ctx.lease?.c.ml ? 'BREACHED' : 'WATCH';
  return mk('paint', status, 'Metadata is still mutable: the name and image can change.', source, {
    value: 'mutable', evidence: { clauses: { ml: status }, via },
  });
};
