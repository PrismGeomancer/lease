import { describe, it, expect } from 'vitest';
import { Transaction, SystemProgram, SystemInstruction } from '@solana/web3.js';
import { buildRecordTx, estimateFeeSol } from '../../src/chain/record';
import { decodeMemo, MEMO_PROGRAM } from '../../src/chain/memo';
import { makeLease, devAddress } from '../helpers';

describe('record-on-chain transaction', () => {
  it('has compute budget, a zero-lamport transfer to the office, and a memo that decodes back to the lease', async () => {
    const lease = await makeLease();
    const office = await devAddress(new Uint8Array(32).fill(42));
    const bytes = await buildRecordTx(lease, office, '11111111111111111111111111111111');
    const tx = Transaction.from(bytes);
    expect(tx.feePayer?.toBase58()).toBe(lease.dev);
    expect(tx.instructions).toHaveLength(4);
    const transfer = tx.instructions[2]!;
    expect(transfer.programId.equals(SystemProgram.programId)).toBe(true);
    expect(SystemInstruction.decodeTransfer(transfer)).toMatchObject({ lamports: 0n });
    expect(transfer.keys.map((k) => k.pubkey.toBase58())).toContain(office);
    const memo = tx.instructions[3]!;
    expect(memo.programId.toBase58()).toBe(MEMO_PROGRAM);
    expect(decodeMemo(memo.data.toString('utf8'))?.sig).toBe(lease.sig);
    expect(bytes.length).toBeLessThan(1232); // fits in one packet
  });
  it('supports the one-lamport fallback', async () => {
    const lease = await makeLease();
    const office = await devAddress(new Uint8Array(32).fill(42));
    const tx = Transaction.from(await buildRecordTx(lease, office, '11111111111111111111111111111111', 1));
    expect(SystemInstruction.decodeTransfer(tx.instructions[2]!).lamports).toBe(1n);
  });
  it('fee estimate is a small SOL amount', () => {
    expect(Number(estimateFeeSol())).toBeGreaterThan(0);
    expect(Number(estimateFeeSol())).toBeLessThan(0.001);
  });
});
