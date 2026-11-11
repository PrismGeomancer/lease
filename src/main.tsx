import { render } from 'preact';
import { lazy, Suspense } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from './router';
import { useSignal } from './signal';
import { copy } from './copy';
import './styles/base.css';
import './styles/pages.css';
import { SvgDefs } from './components/Icons';
import { Toasts } from './components/misc';
import { Banners, ErrorBoundary, Footer, Nav } from './components/Shell';
import Home from './pages/Home';
import { InspectPage, KeyringPage, NotFoundPage, OfficePage, RegisterPage } from './pages/simple';
import { trySilentReconnect } from './chain/wallet';
import { Intro, introNeeded } from './anim/Intro';
import { initLamp, initReveals } from './anim/reveals';

const Draft = lazy(() => import('./pages/Draft'));
const LeasePage = lazy(() => import('./pages/LeasePage'));
const HearingPage = lazy(() => import('./pages/Hearing'));
const Kit = lazy(() => import('./pages/Kit'));

const TITLES: Record<string, string> = {
  home: copy.meta.title,
  inspect: 'Inspection Desk — LEASE',
  draft: 'Draft a lease — LEASE',
  lease: 'Lease — LEASE',
  register: 'The register — LEASE',
  hearing: 'Hearing — LEASE',
  keyring: 'Your keyring — LEASE',
  office: 'How the office works — LEASE',
  kit: 'Component kit — LEASE',
  notfound: 'Room not found — LEASE',
};
const DESCRIPTIONS: Record<string, string> = {
  home: copy.meta.description,
  inspect: 'Paste any Solana token. Nine checks, straight from the chain, in seconds.',
  draft: 'Sign a public lease for your coin with the wallet that holds the keys.',
  register: 'Every lease recorded on-chain, inspected every round.',
  office: 'Data sources, default thresholds, rounds and limitations.',
};

function Page() {
  const r = useSignal(route);
  useEffect(() => {
    document.title = TITLES[r.name] ?? copy.meta.title;
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', DESCRIPTIONS[r.name] ?? copy.meta.description);
    window.scrollTo(0, 0);
    // Move focus to the new h1 (or main) on route change, except the first load.
    const t = setTimeout(() => {
      if (!document.body.dataset.booted) { document.body.dataset.booted = '1'; return; }
      const h = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main');
      h?.setAttribute('tabindex', '-1');
      h?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [r]);

  // Scroll reveals per route; reverted on route change.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let dead = false;
    const t = setTimeout(() => { initReveals().then((c) => { if (dead) c(); else cleanup = c; }).catch(() => {}); }, 80);
    return () => { dead = true; clearTimeout(t); cleanup?.(); };
  }, [r]);

  const fallback = <main id="main" class="container page"><p class="mono">{copy.extra.loading}</p></main>;
  switch (r.name) {
    case 'home': return <main id="main"><Home /></main>;
    case 'inspect': return <InspectPage mint={r.params.mint} />;
    case 'draft': return <Suspense fallback={fallback}><Draft /></Suspense>;
    case 'lease': return <Suspense fallback={fallback}><LeasePage payload={r.params.payload!} /></Suspense>;
    case 'register': return <RegisterPage />;
    case 'hearing': return <Suspense fallback={fallback}><HearingPage fingerprint={r.params.fingerprint!} clause={r.params.clause!} /></Suspense>;
    case 'keyring': return <KeyringPage />;
    case 'office': return <OfficePage />;
    case 'kit': return <Suspense fallback={fallback}><Kit /></Suspense>;
    default: return <NotFoundPage />;
  }
}

function App() {
  const [intro, setIntro] = useState(() => introNeeded() && route.get().name === 'home');
  const lamp = useRef<HTMLDivElement>(null);
  useEffect(() => { void trySilentReconnect(); }, []);
  useEffect(() => (lamp.current ? initLamp(lamp.current) : undefined), []);
  return (
    <ErrorBoundary>
      <SvgDefs />
      <div class="lamp" ref={lamp} aria-hidden="true" />
      {intro && <Intro onDone={() => setIntro(false)} />}
      <a class="skip-link" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.setAttribute('tabindex', '-1'); m?.focus(); }}>{copy.extra.skipLink}</a>
      <Nav />
      <Banners />
      <Page />
      <Footer />
      <Toasts />
    </ErrorBoundary>
  );
}

// Test hook: lets e2e render share cards without driving the whole UI.
(window as unknown as { __cards: () => Promise<unknown> }).__cards = () => import('./cards/canvas');

render(<App />, document.getElementById('app')!);
