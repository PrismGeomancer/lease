import { describe, it, expect } from 'vitest';
import bs58 from 'bs58';
import { canonicalJson, fingerprint, shortFingerprint, canonicalBody } from '../../src/lease/canonical';
import { buildMessage } from '../../src/lease/message';
import { b64urlEncode, b64urlDecode, encodeLease, decodeLease, MAX_PAYLOAD_BYTES } from '../../src/lease/encode';
import { verifyLease } from '../../src/lease/verify';
import { parseLease, isAddress, stripSig, type Lease, type LeaseBody } from '../../src/lease/schema';
import { encodeMemo, decodeMemo, stripMemoLength, MEMO_MAX_BYTES } from '../../src/chain/memo';
import { validateEntry } from '../../src/lease/register';
import { makeLease, worstCaseBody, devAddress, MINT } from '../helpers';
import * as ed from '@noble/ed25519';

describe('canonical json + fingerprint', () => {
  it('is stable regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1}',
    );
    expect(canonicalJson({ a: 1, u: undefined })).toBe('{"a":1}');
  });
  it('fingerprint matches a fixed vector and ignores sig', async () => {
    const l = await makeLease();
    const fp = await fingerprint(l);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprint({ ...l, sig: 'x' })).toBe(fp);
    expect(canonicalBody(l)).not.toContain('sig');
    expect(await fingerprint(stripSig(l))).toBe(fp);
    expect(shortFingerprint(fp)).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
    // fixed vector: sha256 of '{"a":1}'
    const { sha256Hex } = await import('../../src/lease/canonical');
    expect(await sha256Hex('{"a":1}')).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
  });
});

describe('message', () => {
  it('is byte-identical for a fixture', async () => {
    const l = await makeLease({ c: { ar: 1, dm: 5, ns: 14, liq: 5000 } });
    const fp = await fingerprint(l);
    expect(await buildMessage(l)).toBe(
      [
        'LEASE OFFICE — FORM L-01',
        `I, ${l.dev}, sign this lease for token ${MINT}.`,
        'Term: 30 days from 2025-10-09T08:53:20.000Z.',
        'Clauses:',
        '- Mint and freeze authority are renounced.',
        '- Dev holds at most 5% of supply.',
        '- Dev does not sell for 14 days (tolerance 0.5% of the starting balance).',
        '- Liquidity stays above $5000.',
        `Fingerprint: ${fp}`,
        'This signature moves no funds and grants no permissions.',
      ].join('\n'),
    );
  });
  it('covers every clause line', async () => {
    const l = await makeLease({ c: { ar: 1, ml: 1, dm: 1, ns: 1, lp: 1, tt: 10, liq: 1 } });
    const m = await buildMessage(l);
    for (const s of ['metadata is locked', 'burned or locked', 'Top 10 wallets hold at most 10%']) expect(m).toContain(s);
  });
});

describe('signing and verification', () => {
  it('valid signature verifies; tampering fails', async () => {
    const l = await makeLease();
    expect(await verifyLease(l)).toBe(true);
    expect(await verifyLease({ ...l, term: 60 })).toBe(false);
    expect(await verifyLease({ ...l, c: { ...l.c, dm: 6 } })).toBe(false);
    expect(await verifyLease({ ...l, sig: 'nope' })).toBe(false);
    const other = await makeLease({}, new Uint8Array(32).fill(9));
    expect(await verifyLease({ ...l, dev: other.dev })).toBe(false);
  });
});

describe('base64url + payload', () => {
  it('round-trips arbitrary bytes', () => {
    const b = Uint8Array.from([0, 250, 251, 252, 253, 254, 255, 1, 2]);
    expect(Array.from(b64urlDecode(b64urlEncode(b)))).toEqual(Array.from(b));
    expect(b64urlEncode(b)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(() => b64urlDecode('a+b')).toThrow();
  });
  it('round-trips a lease and rejects bad/oversize payloads', async () => {
    const l = await makeLease();
    expect(decodeLease(encodeLease(l))).toEqual(JSON.parse(canonicalJson(l)));
    expect(decodeLease('!!!')).toBeNull();
    expect(decodeLease(b64urlEncode(new TextEncoder().encode('not json')))).toBeNull();
    expect(decodeLease('A'.repeat(4000))).toBeNull();
    const big = b64urlEncode(new Uint8Array(MAX_PAYLOAD_BYTES + 1).fill(65));
    expect(decodeLease(big)).toBeNull();
    expect(decodeLease(b64urlEncode(new Uint8Array([0xff, 0xfe])))).toBeNull();
    expect(() => encodeLease({ ...l, n: 'é'.repeat(140), c: { ...l.c, lpm: MINT } } as Lease)).not.toThrow();
    expect(() => encodeLease({ ...l, n: 'x'.repeat(3000) } as Lease)).toThrow();
  });
});

describe('schema guard', () => {
  it('accepts a valid lease and rejects each kind of malformed one', async () => {
    const l = await makeLease();
    expect(parseLease(l)).toBe(l);
    const bad = (patch: object) => parseLease({ ...l, ...patch });
    expect(parseLease(null)).toBeNull();
    expect(parseLease([])).toBeNull();
    expect(parseLease('x')).toBeNull();
    expect(bad({ v: 2 })).toBeNull();
    expect(bad({ extra: 1 })).toBeNull();
    expect(bad({ mint: 'short' })).toBeNull();
    expect(bad({ mint: '0'.repeat(44) })).toBeNull();
    expect(bad({ dev: 5 })).toBeNull();
    expect(bad({ t0: 1.5 })).toBeNull();
    expect(bad({ t0: -1 })).toBeNull();
    expect(bad({ term: 10 })).toBeNull();
    expect(bad({ b0: '-1' })).toBeNull();
    expect(bad({ sig: 'abc' })).toBeNull();
    expect(bad({ sig: '0'.repeat(80) })).toBeNull();
    expect(bad({ n: 5 })).toBeNull();
    expect(bad({ n: 'x'.repeat(141) })).toBeNull();
    expect(bad({ n: 'bad\u0000' })).toBeNull();
    expect(bad({ c: null })).toBeNull();
    expect(bad({ c: [] })).toBeNull();
    expect(bad({ c: {} })).toBeNull();
    expect(bad({ c: { zz: 1 } })).toBeNull();
    expect(bad({ c: { ar: 2 } })).toBeNull();
    expect(bad({ c: { ml: 0 } })).toBeNull();
    expect(bad({ c: { lp: 0 } })).toBeNull();
    expect(bad({ c: { dm: 25 } })).toBeNull();
    expect(bad({ c: { dm: 0.01 } })).toBeNull();
    expect(bad({ c: { ns: 31 } })).toBeNull();
    expect(bad({ c: { ns: 1.5 } })).toBeNull();
    expect(bad({ c: { tt: 5 } })).toBeNull();
    expect(bad({ c: { liq: 0 } })).toBeNull();
    expect(bad({ c: { ar: 1, lpm: MINT } })).toBeNull(); // lpm needs lp
    expect(bad({ c: { lp: 1, lpm: 'bad' } })).toBeNull();
    expect(bad({ n: undefined })).not.toBeNull();
    expect(isAddress(MINT)).toBe(true);
    expect(isAddress('0OIl' + 'a'.repeat(30))).toBe(false);
    expect(isAddress(undefined)).toBe(false);
    // 64-byte-looking but wrong length sig
    expect(bad({ sig: bs58.encode(new Uint8Array(63).fill(1)).padEnd(70, '1') })).toBeNull();
  });
});

describe('memo', () => {
  it('worst-case lease fits in 560 bytes and round-trips', async () => {
    const dev = await devAddress();
    const body = worstCaseBody(dev);
    const { buildMessage: bm } = await import('../../src/lease/message');
    const sig = bs58.encode(await ed.signAsync(new TextEncoder().encode(await bm(body)), new Uint8Array(32).map((_, i) => i + 1)));
    const lease: Lease = { ...body, sig };
    const memo = encodeMemo(lease);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(MEMO_MAX_BYTES);
    expect(decodeMemo(memo)).toEqual(JSON.parse(canonicalJson(lease)));
  });
  it('rejects too large, bad prefix, bad json', async () => {
    const l = await makeLease();
    expect(() => encodeMemo({ ...l, n: '€'.repeat(140), c: { ...l.c, lpm: MINT, lp: 1 } } as Lease)).toThrow(/too large/);
    expect(decodeMemo('NOPE:{}')).toBeNull();
    expect(decodeMemo('LEASE1:{bad')).toBeNull();
    expect(decodeMemo('LEASE1:' + ' '.repeat(600))).toBeNull();
    expect(decodeMemo(5 as unknown as string)).toBeNull();
    expect(stripMemoLength('[12] LEASE1:x')).toBe('LEASE1:x');
    expect(stripMemoLength('LEASE1:x')).toBe('LEASE1:x');
  });
});

describe('register validator', () => {
  const ok = async () => true;
  const mk = async (over: Partial<LeaseBody> = {}) => {
    const l = await makeLease(over);
    return { l, e: { memo: encodeMemo(l), feePayer: l.dev, blockTime: 1, signature: 'sigx' } };
  };
  it('accepts a good entry (with RPC length prefix) and dedupes', async () => {
    const { l, e } = await mk();
    const seen = new Set<string>();
    const r = await validateEntry({ ...e, memo: `[${e.memo.length}] ${e.memo}` }, { seen, isMint: ok });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lease.dev).toBe(l.dev);
    expect(await validateEntry(e, { seen, isMint: ok })).toEqual({ ok: false, reason: 'duplicate' });
  });
  it('rejects bad prefix, payload, signature, payer, non-mint', async () => {
    const { l, e } = await mk();
    const o = { seen: new Set<string>(), isMint: ok };
    expect(await validateEntry({ ...e, memo: 'hello' }, o)).toEqual({ ok: false, reason: 'prefix' });
    expect(await validateEntry({ ...e, memo: 'LEASE1:{}' }, o)).toEqual({ ok: false, reason: 'payload' });
    const tampered = encodeMemo({ ...l, term: 60 });
    expect(await validateEntry({ ...e, memo: tampered }, o)).toEqual({ ok: false, reason: 'signature' });
    expect(await validateEntry({ ...e, feePayer: MINT }, o)).toEqual({ ok: false, reason: 'payer' });
    expect(await validateEntry(e, { seen: new Set(), isMint: async () => false })).toEqual({ ok: false, reason: 'not-mint' });
  });
});
