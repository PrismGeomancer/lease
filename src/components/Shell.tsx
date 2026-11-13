import { Component } from 'preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CONFIG } from '../config';
import { copy } from '../copy';
import { route } from '../router';
import { useSignal } from '../signal';
import { Button } from './Button';
import { Show } from './Show';
import { Logo } from './Icons';
import { AddressChip, ExternalLink, Modal } from './misc';
import { WalletModal } from './WalletModal';
import { walletState, disconnectWallet } from '../chain/wallet';
import { toast } from '../lib/toast';
import { shorten } from '../lib/util';
import { loadOffice } from '../lib/data';
import { getRpc } from '../lib/chainctx';
import type { Office } from '../lib/dataTypes';

const LINKS: [string, string, string][] = [
  ['#/inspect', copy.nav.inspect, 'inspect'],
  ['#/draft', copy.nav.draft, 'draft'],
  ['#/register', copy.nav.register, 'register'],
  ['#/keyring', copy.nav.keyring, 'keyring'],
  ['#/office', copy.nav.office, 'office'],
];

export function Nav() {
  const r = useSignal(route);
  const w = useSignal(walletState);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [wallet, setWallet] = useState(false);
  const [dd, setDd] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 80);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setMenu(false); setDd(false); }, [r]);
  useEffect(() => {
    if (!menu) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [menu]);

  const walletBtn = w ? (
    <span class="walletwrap">
      <button class="btn btn--secondary btn--sm mono" aria-expanded={dd} onClick={() => setDd(!dd)}>{shorten(w.address)}</button>
      {dd && (
        <div class="dropdown" role="menu">
          <button role="menuitem" onClick={async () => { await navigator.clipboard.writeText(w.address).catch(() => {}); toast(copy.toast.copied); setDd(false); }}>{copy.nav.copyAddress}</button>
          <a role="menuitem" href={`#/register?dev=${w.address}`}>{copy.nav.myLeases}</a>
          <button role="menuitem" onClick={async () => { await disconnectWallet(); toast(copy.toast.disconnected); setDd(false); }}>{copy.nav.disconnect}</button>
        </div>
      )}
    </span>
  ) : (
    <Button size="sm" variant="secondary" onClick={() => setWallet(true)}>{copy.nav.connect}</Button>
  );

  return (
    <header class={`nav${scrolled || r.name !== 'home' ? ' nav--solid' : ''}`}>
      <div class="nav__in container">
        <a class="nav__logo" href="#/" aria-label="LEASE home"><Logo size={34} /><span>LEASE</span></a>
        <nav class="nav__links" aria-label="Main">
          {LINKS.map(([href, label, name]) => <a key={href} href={href} aria-current={r.name === name ? 'page' : undefined}>{label}</a>)}
        </nav>
        <div class="nav__right">
          <Show if={CONFIG.X_URL}><a class="iconbtn" href={CONFIG.X_URL} target="_blank" rel="noopener noreferrer" aria-label="LEASE on X">𝕏</a></Show>
          <Show if={CONFIG.TELEGRAM_URL}><a class="iconbtn" href={CONFIG.TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="LEASE on Telegram">✈</a></Show>
          {walletBtn}
          <button class="btn btn--ghost btn--sm nav__burger" aria-expanded={menu} aria-controls="drawer" onClick={() => setMenu(!menu)}>{copy.nav.menu}</button>
        </div>
      </div>
      <div id="drawer" class={`drawer${menu ? ' drawer--open' : ''}`} aria-hidden={!menu} inert={!menu}>
        <nav aria-label="Mobile">
          {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <Button variant="ghost" onClick={() => setMenu(false)}>{copy.nav.closeMenu}</Button>
      </div>
      <WalletModal open={wallet} onClose={() => setWallet(false)} />
    </header>
  );
}

export function Footer() {
  const [office, setOffice] = useState<Office | null>(null);
  useEffect(() => { loadOffice().then(setOffice); }, []);
  const hasLinks = !!(CONFIG.TOKEN_CA || CONFIG.X_URL || CONFIG.TELEGRAM_URL || CONFIG.GITHUB_URL);
  return (
    <footer class="footer">
      <div class="container">
        <div class="footer__top">
          <div class="footer__brand">
            <a class="nav__logo" href="#/"><Logo size={34} /><span>LEASE</span></a>
            <p>{copy.footer.line}</p>
          </div>
          <nav class="footer__nav" aria-label="Footer">
            {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          {hasLinks && (
            <div class="footer__links">
              <Show if={CONFIG.TOKEN_CA}><AddressChip address={CONFIG.TOKEN_CA} label="Contract address" link={`${CONFIG.EXPLORER_ACCOUNT}${CONFIG.TOKEN_CA}`} /></Show>
              <p>
                <Show if={CONFIG.X_URL}><ExternalLink href={CONFIG.X_URL}>X</ExternalLink> </Show>
                <Show if={CONFIG.TELEGRAM_URL}><ExternalLink href={CONFIG.TELEGRAM_URL}>Telegram</ExternalLink> </Show>
                <Show if={CONFIG.GITHUB_URL}><ExternalLink href={CONFIG.GITHUB_URL}>GitHub</ExternalLink></Show>
              </p>
            </div>
          )}
        </div>
        <div class="footer__legal">
          <p class="footer__risk">{copy.footer.risk}</p>
          <p class="footer__meta">
            {copy.footer.copy}
            {office?.lastRoundAt && <> · {copy.footer.lastRound(new Date(office.lastRoundAt).toUTCString())}</>}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Banners() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const t = setInterval(() => setSlow(getRpc().degraded), 2000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, []);
  return (
    <>
      {!online && <div class="banner" role="status">{copy.extra.offline}</div>}
      {slow && <div class="banner banner--amber" role="status">{copy.extra.rpcSlow}</div>}
    </>
  );
}

export class ErrorBoundary extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  override state = { failed: false };
  override componentDidCatch(e: unknown) { console.error('[lease] render error', e); this.setState({ failed: true }); }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main class="container page" id="main">
        <h1>{copy.error.title}</h1>
        <p>{copy.error.body}</p>
        <Button onClick={() => location.reload()}>{copy.error.reload}</Button>
      </main>
    );
  }
}

export { Modal };
