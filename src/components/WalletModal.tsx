import { useEffect, useState } from 'preact/hooks';
import { Modal } from './misc';
import { INSTALL_LINKS, connectWallet, listWallets, mobileDeepLinks, onWalletsChange, type WalletInfo } from '../chain/wallet';
import { copy } from '../copy';
import { toast } from '../lib/toast';

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [wallets, setWallets] = useState<WalletInfo[]>(() => listWallets());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setWallets(listWallets());
    return onWalletsChange(() => setWallets(listWallets()));
  }, [open]);

  const pick = async (w: WalletInfo) => {
    setError(null);
    setBusy(w.name);
    try {
      await connectWallet(w);
      toast(copy.toast.connected);
      onClose();
    } catch {
      setError(copy.draft.declined);
    } finally {
      setBusy(null);
    }
  };
  const links = mobileDeepLinks(location.href);
  const mobile = typeof navigator !== 'undefined' && /android|iphone|ipad/i.test(navigator.userAgent);

  return (
    <Modal open={open} onClose={onClose} title={copy.nav.connect}>
      {wallets.length > 0 ? (
        <ul class="wlist">
          {wallets.map((w) => (
            <li key={w.name}>
              <button class="btn btn--secondary btn--on-paper" disabled={busy !== null} onClick={() => pick(w)}>
                <img src={w.icon} alt="" width={24} height={24} /> {w.name}
                <span class="mono wlist__badge">Detected</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p>{copy.extra.walletMissing}</p>
          <ul>{INSTALL_LINKS.map((l) => <li key={l.name}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a></li>)}</ul>
          {mobile && (
            <p>
              {copy.extra.openInWallet}{' '}
              <a href={links.phantom}>Phantom</a> · <a href={links.solflare}>Solflare</a>
            </p>
          )}
        </>
      )}
      {error && <p class="field__error" role="alert">{error}</p>}
    </Modal>
  );
}
