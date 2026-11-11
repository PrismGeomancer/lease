import { getWallets } from '@wallet-standard/app';
import bs58 from 'bs58';
import { signal } from '../signal';
import { storageGet, storageSet } from '../lib/util';
import { copy } from '../copy';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWallet = any;
type AnyAccount = any;

export interface WalletInfo { name: string; icon: string; wallet: AnyWallet; detected: true }
export interface WalletState { name: string; address: string }

export const walletState = signal<WalletState | null>(null);
export const walletEvents = signal<{ changed: number }>({ changed: 0 }); // bump when the account switches

let current: { wallet: AnyWallet; account: AnyAccount } | null = null;
const LAST = 'lease:wallet:last';
const PREFERRED = ['Phantom', 'Solflare', 'Backpack'];

export function listWallets(): WalletInfo[] {
  const all = getWallets().get() as AnyWallet[];
  const ok = all.filter((w) => w.features['standard:connect'] && (w.features['solana:signMessage'] || w.features['solana:signAndSendTransaction']));
  return ok
    .map((w) => ({ name: String(w.name), icon: String(w.icon), wallet: w, detected: true as const }))
    .sort((a, b) => {
      const ia = PREFERRED.indexOf(a.name), ib = PREFERRED.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
    });
}

export function onWalletsChange(fn: () => void): () => void {
  const w = getWallets();
  const off1 = w.on('register', fn);
  const off2 = w.on('unregister', fn);
  return () => { off1(); off2(); };
}

function adopt(wallet: AnyWallet, account: AnyAccount) {
  const prev = current?.account?.address;
  current = { wallet, account };
  walletState.set({ name: wallet.name, address: account.address });
  if (prev && prev !== account.address) walletEvents.set({ changed: walletEvents.get().changed + 1 });
  wallet.features['standard:events']?.on('change', ({ accounts }: { accounts?: AnyAccount[] }) => {
    if (accounts && accounts.length && current?.wallet === wallet) adopt(wallet, accounts[0]);
  });
}

export async function connectWallet(info: WalletInfo, silent = false): Promise<void> {
  const res = await info.wallet.features['standard:connect'].connect(silent ? { silent: true } : undefined);
  const account = (res.accounts?.[0] ?? info.wallet.accounts?.[0]) as AnyAccount | undefined;
  if (!account) throw new Error('declined');
  adopt(info.wallet, account);
  storageSet(LAST, info.name); // name only, never keys
}

/** Silent reconnect only if the user connected before and the wallet supports it. Never prompts. */
export async function trySilentReconnect(): Promise<void> {
  const last = storageGet(LAST);
  if (!last) return;
  const info = listWallets().find((w) => w.name === last);
  if (!info) return;
  try { await connectWallet(info, true); } catch { /* stay disconnected */ }
}

export async function disconnectWallet(): Promise<void> {
  try { await current?.wallet.features['standard:disconnect']?.disconnect(); } catch { /* ignore */ }
  current = null;
  walletState.set(null);
}

export class WalletError extends Error {
  constructor(public kind: 'declined' | 'unsupported' | 'none', message: string) { super(message); }
}

export async function signMessage(message: string): Promise<string> {
  if (!current) throw new WalletError('none', copy.extra.walletMissing);
  const f = current.wallet.features['solana:signMessage'];
  if (!f) throw new WalletError('unsupported', copy.draft.noSignMessage);
  try {
    const [out] = await f.signMessage({ account: current.account, message: new TextEncoder().encode(message) });
    return bs58.encode(out.signature);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (/unsupported|not supported|ledger/.test(msg)) throw new WalletError('unsupported', copy.draft.noSignMessage);
    throw new WalletError('declined', copy.draft.declined);
  }
}

export async function signAndSend(tx: Uint8Array, chain: 'solana:mainnet' | 'solana:devnet'): Promise<string> {
  if (!current) throw new WalletError('none', copy.extra.walletMissing);
  const f = current.wallet.features['solana:signAndSendTransaction'];
  if (!f) throw new WalletError('unsupported', 'This wallet cannot send transactions.');
  try {
    const [out] = await f.signAndSendTransaction({ account: current.account, transaction: tx, chain });
    return bs58.encode(out.signature);
  } catch {
    throw new WalletError('declined', 'Transaction declined. Nothing was sent.');
  }
}

export function mobileDeepLinks(url: string) {
  const u = encodeURIComponent(url);
  return { phantom: `https://phantom.app/ul/browse/${u}`, solflare: `https://solflare.com/ul/v1/browse/${u}` };
}
export const INSTALL_LINKS = [
  { name: 'Phantom', url: 'https://phantom.app/' },
  { name: 'Solflare', url: 'https://solflare.com/' },
  { name: 'Backpack', url: 'https://backpack.app/' },
];
