import bs58 from 'bs58';
import { CONFIG } from '../config';
import type { Lease } from '../lease/schema';
import { MEMO_PROGRAM, encodeMemo } from './memo';
import { getRpc, network } from '../lib/chainctx';
import { signAndSend } from './wallet';

export const COMPUTE_UNIT_LIMIT = 30_000;
export const PRIORITY_MICROLAMPORTS = 10_000;

/** Approximate network fee in SOL: base 5000 lamports + priority fee. */
export function estimateFeeSol(): string {
  const lamports = 5000 + Math.ceil((COMPUTE_UNIT_LIMIT * PRIORITY_MICROLAMPORTS) / 1_000_000);
  return (lamports / 1e9).toFixed(7).replace(/0+$/, '');
}

/**
 * Build the unsigned transaction: [compute budget x2] + transfer(office) + Memo v2. Fee payer = the dev.
 * Lazy-loads web3.js. Gives the serialized (unsigned) bytes for the wallet to sign and send.
 */
export async function buildRecordTx(lease: Lease, office: string, blockhash: string, lamports = 0): Promise<Uint8Array> {
  const { PublicKey, Transaction, SystemProgram, TransactionInstruction, ComputeBudgetProgram } = await import('@solana/web3.js');
  const dev = new PublicKey(lease.dev);
  const tx = new Transaction({ feePayer: dev, recentBlockhash: blockhash });
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }),
    SystemProgram.transfer({ fromPubkey: dev, toPubkey: new PublicKey(office), lamports }),
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [{ pubkey: dev, isSigner: true, isWritable: false }],
      data: new TextEncoder().encode(encodeMemo(lease)) as unknown as Buffer, // no Buffer global in browsers
    }),
  );
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

export type RecordStage = 'wallet' | 'sending' | 'confirming' | 'done';

/**
 * Build and send: [compute budget x2] + transfer(0 lamports to office) + Memo v2.
 * The zero-lamport transfer makes the tx appear in getSignaturesForAddress(office).
 * `lamports` is overridable so the 1-lamport fallback (if a wallet/RPC rejects 0) is a one-line change.
 */
export async function recordLease(lease: Lease, onStage: (s: RecordStage) => void, lamports = 0): Promise<string> {
  if (!CONFIG.OFFICE_ADDRESS) throw new Error('No office address configured');
  const rpc = getRpc();
  const bh = await rpc.call<{ value: { blockhash: string; lastValidBlockHeight: number } }>('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const tx = await buildRecordTx(lease, CONFIG.OFFICE_ADDRESS, bh.value.blockhash, lamports);
  onStage('wallet');
  const bytes = tx;
  onStage('sending');
  const sig = await signAndSend(bytes, network() === 'devnet' ? 'solana:devnet' : 'solana:mainnet');
  onStage('confirming');
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const st = await rpc.call<{ value: ({ confirmationStatus?: string; err: unknown } | null)[] }>('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
    const s = st.value[0];
    if (s?.err) throw new Error('Transaction failed on-chain.');
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) { onStage('done'); return sig; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Not confirmed after 60 s. Check the explorer before retrying.');
}

/** blockTime (unix s) of a recorded signature, or null. */
export async function blockTimeOf(sig: string): Promise<number | null> {
  const tx = await getRpc().call<{ blockTime: number | null } | null>('getTransaction', [sig, { maxSupportedTransactionVersion: 255, commitment: 'confirmed' }]);
  return tx?.blockTime ?? null;
}
export const sigBytes = (s: string) => bs58.decode(s);
