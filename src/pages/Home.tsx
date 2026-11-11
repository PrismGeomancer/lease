import { useEffect, useRef, useState } from 'preact/hooks';
import { CONFIG } from '../config';
import { copy } from '../copy';
import { Button } from '../components/Button';
import { Heading } from '../components/Heading';
import { Show } from '../components/Show';
import { Stamp } from '../components/Stamp';
import { TriplicateForm } from '../components/TriplicateForm';
import { KeyTag } from '../components/KeyTag';
import { Accordion, AddressChip, CopyButton, ExternalLink } from '../components/misc';
import { InspectionDesk } from '../components/InspectionDesk';
import { InspectorTable } from '../components/InspectionParts';
import { IndexCard } from '../components/LeaseParts';
import { Notice } from '../components/Notice';
import { KeyGlyph } from '../components/Icons';
import { useHold } from '../lib/useHold';
import { prefersReducedMotion } from '../lib/util';
import { loadBulletin, loadOffice, loadRegister, loadToken, loadOwnLease } from '../lib/data';
import type { Bulletin, Office, Register, TokenFacts } from '../lib/dataTypes';
import { SAMPLES } from '../samples';
import { useInspection } from '../lib/useInspection';
import { encodeLease } from '../lease/encode';
import type { Lease } from '../lease/schema';
import { CLAUSE_SHORT } from '../hearing/templates';
import { reading } from '../hearing/templates';
import type { FindingStatus } from '../types';

/* ------------------------------------------------------------------ hero */
const SIG_PATH = 'M6 62 C 20 20, 34 10, 40 40 S 52 70, 66 30 C 74 6, 84 8, 86 36 S 100 64, 124 34 C 134 22, 144 24, 148 44 S 170 58, 214 26';

function HeroForm() {
  const [torn, setTorn] = useState(false);
  const complete = () => setTorn(true);
  const { progress, handlers } = useHold({ durationMs: 1400, onComplete: complete });
  const p = torn ? 1 : progress;
  const L = 320;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const move = (e: PointerEvent) => {
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      el.style.transform = `perspective(900px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <div class="hero__form" ref={ref} data-hero-form>
      <TriplicateForm formNo="FORM L-01 / REV. 3" title={copy.intro.typewriter.replace('FORM L-01 — ', '')} tilt={-3} torn={torn} labels max={460}>
        <p class="mono" style={{ fontSize: '.8rem' }}>The tenant agrees to keep the terms below, in public, for the full term.</p>
        <ul class="hero__terms mono">
          <li>Mint and freeze authority renounced</li>
          <li>Dev holds at most 5% of supply</li>
          <li>No dev sells for 14 days</li>
        </ul>
        <div
          class="sigline" role="button" tabIndex={0} aria-label={copy.hero.holdHint} aria-describedby="sig-hint"
          {...handlers} style={{ touchAction: 'none' }}
        >
          <svg viewBox="0 0 220 80" aria-hidden="true">
            <path d={SIG_PATH} fill="none" stroke="#1d2b6b" stroke-width="3" stroke-linecap="round" opacity={p > 0 ? 1 : 0} stroke-dasharray={L} stroke-dashoffset={L * (1 - p)} />
          </svg>
          <span class="sigline__x mono">✕</span>
        </div>
        <p id="sig-hint" class="mono hero__hint">{torn ? '' : `${copy.hero.holdHint} · ${copy.hero.holdKeyboard}`}</p>
        <div class="hero__stampbox">{torn && <Stamp status="ACTIVE" size="md" animate text={copy.hero.signedDemo} />}</div>
        {torn
          ? <a href="#/draft" class="btn btn--primary btn--sm">{copy.hero.signReal}</a>
          : <Button size="sm" variant="secondary" onPaper onClick={complete}>{copy.hero.signDemo}</Button>}
      </TriplicateForm>
    </div>
  );
}

function Hero({ office }: { office: Office | null }) {
  const has = office && office.counts.onFile > 0;
  return (
    <section id="hero" class="hero container" aria-labelledby="hero-h">
      <div class="hero__text">
        <p class="label hero__eyebrow">{copy.hero.eyebrow}</p>
        <h1 id="hero-h" tabIndex={-1} class="display" data-reveal="heading">
          <span>{copy.hero.h1a}</span><em class="accent" data-accent>{copy.hero.h1b}</em>
        </h1>
        <p class="hero__sub">{copy.hero.sub}</p>
        <div class="hero__cta">
          <Button size="lg" href="#/inspect">{copy.hero.ctaInspect}</Button>
          <Button size="lg" variant="secondary" href="#/draft">{copy.hero.ctaSign}</Button>
        </div>
        <p class="mono hero__facts" style={{ minHeight: '1.6em' }}>
          {has ? copy.hero.facts(office.counts.onFile, office.counts.renewed, office.counts.evicted).join(' · ') : copy.hero.preOpening}
        </p>
      </div>
      <HeroForm />
    </section>
  );
}

/* -------------------------------------------------------------- bulletin */
function Bulletin({ data }: { data: Bulletin | null }) {
  const [paused, setPaused] = useState(false);
  const items = data?.items ?? [];
  const text = items.map((i) => ({
    key: `${i.fp}-${i.kind}-${i.t}`,
    href: i.kind === 'EVICTED' ? `#/hearing/${i.fp}/${i.clause ?? 'ar'}` : `#/l/${i.fp}`,
    label: i.kind === 'NEW' ? copy.bulletin.newLease(i.ticker ?? 'token', i.term ?? 0)
      : i.kind === 'RENEWED' ? copy.bulletin.renewed(i.ticker ?? 'token', i.term ?? 0)
      : copy.bulletin.evicted(i.ticker ?? 'token', i.clause ? (CLAUSE_SHORT[i.clause as keyof typeof CLAUSE_SHORT] ?? i.clause) : 'clause breached'),
  }));
  return (
    <section id="bulletin" class="bulletin" aria-label={copy.bulletin.label}>
      <span class="bulletin__label mono">{copy.bulletin.label}</span>
      {text.length === 0 ? (
        <p class="bulletin__empty mono">{copy.bulletin.empty}</p>
      ) : (
        <>
          <div class={`bulletin__track${paused || prefersReducedMotion() ? ' is-paused' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusIn={() => setPaused(true)} onFocusOut={() => setPaused(false)}>
            {[0, 1].map((dup) => (
              <ul key={dup} aria-hidden={dup === 1}>
                {text.map((i) => <li key={i.key}><KeyGlyph size={14} /> <a href={i.href} tabIndex={dup === 1 ? -1 : 0}>{i.label}</a></li>)}
              </ul>
            ))}
          </div>
          <button class="btn btn--ghost btn--sm" onClick={() => setPaused(!paused)}>{paused ? copy.bulletin.resume : copy.bulletin.pause}</button>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- how */
function How() {
  const [flip, setFlip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  useEffect(() => {
    if (reduced || !ref.current) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(ref.current);
    const t = setInterval(() => visible && setFlip((f) => !f), 3000);
    return () => { io.disconnect(); clearInterval(t); };
  }, [reduced]);
  const offsets = [0, 24, 8, 32];
  return (
    <section id="how" class="section corkboard" aria-labelledby="how-h">
      <div class="container">
        <Heading parts={copy.how.heading} id="how-h" />
        <p>{copy.how.lede}</p>
        <ol class="how__steps">
          {copy.how.steps.map((s, i) => (
            <li key={i} class="how__card paper" style={{ '--off': `${offsets[i]}px` } as Record<string, string>} data-reveal="card">
              <span class="how__pin" aria-hidden="true" />
              <span class="label">FORM L-0{i + 1}</span>
              <h3>{i + 1}. {s.t}</h3>
              <p>{s.b}</p>
              {i === 3 && (
                <div class="flipper" ref={ref}>
                  <div class={`flipper__in${flip && !reduced ? ' is-flipped' : ''}`}>
                    <div class="flipper__face"><Stamp status="RENEWED" size="md" /></div>
                    <div class="flipper__face flipper__back"><Stamp status="EVICTED" size="md" /></div>
                  </div>
                  {reduced && <div class="flipper__both"><Stamp status="RENEWED" size="sm" /> <Stamp status="EVICTED" size="sm" /></div>}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- inspectors */
const DEMO_RESULTS: FindingStatus[] = ['KEPT', 'KEPT', 'WATCH', 'KEPT', 'KEPT', 'WATCH', 'UNVERIFIABLE', 'KEPT', 'UNVERIFIABLE'];
const SOURCES = ['Solana RPC', 'Solana RPC', 'Helius DAS / Metaplex', 'Solana RPC', 'Solana RPC', 'DexScreener', 'Solana RPC + DexScreener', 'DexScreener', 'Solana RPC / Helius'];

function Inspectors() {
  const [demo, setDemo] = useState<(FindingStatus | undefined)[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const runDemo = () => {
    timers.current.forEach(clearTimeout);
    setDemo([]);
    const step = prefersReducedMotion() ? 0 : 180;
    DEMO_RESULTS.forEach((r, i) => {
      timers.current.push(window.setTimeout(() => setDemo((d) => { const n = [...d]; n[i] = r; return n; }), step * (i + 1)));
    });
  };
  return (
    <section id="inspectors" class="section container" aria-labelledby="insp-h">
      <Heading parts={copy.inspectors.heading} id="insp-h" />
      <p>{copy.inspectors.lede}</p>
      <div class="cabinet">
        {copy.inspectors.tags.map((t, i) => (
          <KeyTag key={t.n} index={t.n} name={t.name} checks={t.checks} joke={t.joke} source={SOURCES[i]} status={demo[i] ?? 'PENDING'} demo={!!demo[i]} />
        ))}
      </div>
      <div class="cabinet__actions">
        <Button variant="secondary" onClick={runDemo}>{copy.inspectors.demoRound}</Button>
        <Button href="#desk" onClick={(e) => { e.preventDefault(); document.getElementById('desk')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); document.getElementById('mint-desk')?.focus({ preventScroll: true }); }}>{copy.inspectors.inspectReal}</Button>
      </div>
      <p class="mono">{copy.inspectors.footnote}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- others */
function Desk() {
  return (
    <section id="desk" class="section container" aria-labelledby="desk-h">
      <Heading parts={copy.desk.heading} id="desk-h" />
      <p>{copy.desk.lede}</p>
      <InspectionDesk />
    </section>
  );
}

function DraftTeaser() {
  const lines = ['Authorities renounced', 'Dev holds at most 5% of supply', 'No dev sells for 14 days'];
  return (
    <section id="draft-teaser" class="section container split" aria-labelledby="dt-h">
      <div>
        <Heading parts={copy.teaser.heading} id="dt-h" />
        <p>{copy.teaser.body}</p>
        <Button size="lg" href="#/draft">{copy.teaser.cta}</Button>
      </div>
      <TriplicateForm formNo="FORM L-01 / REV. 3" title="Lease agreement" tilt={2} max={460}>
        <ul class="hero__terms mono">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p class="ghostsig" aria-hidden="true">Tenant</p>
      </TriplicateForm>
    </section>
  );
}

function RegisterPreview({ reg }: { reg: Register | null }) {
  const real = reg?.leases.slice().sort((a, b) => b.start - a.start).slice(0, 6) ?? [];
  return (
    <section id="register-preview" class="section container" aria-labelledby="rp-h">
      <Heading parts={copy.register.heading} id="rp-h" />
      <p>{copy.register.lede}</p>
      {real.length === 0 && <p class="mono">{copy.register.empty}</p>}
      <div class="drawer-cards">
        {(real.length ? real : SAMPLES).map((e) => <IndexCard key={e.fp} entry={e} />)}
      </div>
      <Button variant="secondary" href="#/register">{copy.register.cta}</Button>
    </section>
  );
}

function HearingExplainer() {
  const ex = reading('liquidity', { min: '5,000' });
  return (
    <section id="hearing-explainer" class="section container" aria-labelledby="he-h">
      <Heading parts={copy.hearing.heading} id="he-h" />
      <p>{copy.hearing.lede}</p>
      <div class="tworeadings">
        <article class="paper tworeadings__col"><span class="label">{copy.hearing.innocent}</span><p>{ex.innocent}</p></article>
        <span class="staple" aria-hidden="true" />
        <article class="paper tworeadings__col tworeadings__pink"><span class="label">{copy.hearing.guilty}</span><p>{ex.guilty}</p></article>
      </div>
      <p class="mono"><Stamp status="UNVERIFIABLE" size="sm" text="EXAMPLE" /> {copy.hearing.note}</p>
    </section>
  );
}

function Building({ token, own }: { token: TokenFacts | null; own: Lease | null }) {
  const insp = useInspection();
  const live = !!CONFIG.TOKEN_CA;
  useEffect(() => { if (live) void insp.run(CONFIG.TOKEN_CA, { lease: own ?? undefined });   }, [live, own]);
  const f = copy.building.facts;
  const renounced = (v: string | null | undefined) => (v === null ? 'Renounced' : (v ?? '—'));
  return (
    <section id="building" class="section container" aria-labelledby="bd-h">
      <Heading parts={copy.building.heading} id="bd-h" />
      <p>{copy.building.lede}</p>
      <div class="split split--7-5">
        <TriplicateForm formNo="FORM L-01 · $LEASE" title="$LEASE — lease agreement" max={640}>
          {live ? (
            <InspectorTable findings={insp.state.findings} />
          ) : (
            <>
              <Stamp status="PENDING" size="lg" text={copy.building.pending} />
              <p>{copy.building.preLaunch}</p>
            </>
          )}
        </TriplicateForm>
        <div>
          <dl class="facts mono">
            <dt>{f.supply}</dt><dd>{live ? (token?.supply ?? '—') : '—'}</dd>
            <dt>{f.mint}</dt><dd>{live && token ? renounced(token.mintAuthority) : '—'}</dd>
            <dt>{f.freeze}</dt><dd>{live && token ? renounced(token.freezeAuthority) : '—'}</dd>
            <dt>{f.liquidity}</dt><dd>{live && token?.liquidityUsd != null ? `$${Math.round(token.liquidityUsd).toLocaleString('en-US')}` : '—'}</dd>
            <dt>{f.pair}</dt><dd>{live && token?.pairUrl ? <ExternalLink href={token.pairUrl}>DexScreener</ExternalLink> : '—'}</dd>
          </dl>
          <p class="mono">Source: {live ? 'Solana chain and DexScreener, refreshed each office round.' : 'Not listed yet.'}</p>
          <div class="hero__cta">
            <Show if={CONFIG.TOKEN_CA}><span class="chip mono">{copy.building.copyCa} <CopyButton text={CONFIG.TOKEN_CA} label={copy.building.copyCa} /></span></Show>
            <Show if={CONFIG.BUY_URL}><Button variant="secondary" href={CONFIG.BUY_URL}>{copy.building.market}</Button></Show>
            <Show if={own}>{own && <Button variant="secondary" href={`#/l/${encodeLease(own)}`}>{copy.building.openLease}</Button>}</Show>
          </div>
        </div>
      </div>
    </section>
  );
}

function Phases() {
  const [floor, setFloor] = useState(0);
  const [open, setOpen] = useState(true);
  const pick = (i: number) => {
    if (i === floor) return;
    if (prefersReducedMotion()) { setFloor(i); return; }
    setOpen(false);
    setTimeout(() => { setFloor(i); setOpen(true); }, 750);
  };
  return (
    <section id="phases" class="section container" aria-labelledby="ph-h">
      <Heading parts={copy.phases.heading} id="ph-h" />
      <div class="elevator">
        <div class="elevator__panel" role="group" aria-label="Floors">
          {copy.phases.floors.map((f, i) => (
            <button key={i} class="elevator__btn" aria-pressed={floor === i} aria-label={f.t} onClick={() => pick(i)}>{i + 1}</button>
          ))}
        </div>
        <div class="elevator__shaft">
          <div class="elevator__content paper" aria-live="polite">
            <h3>{copy.phases.floors[floor]!.t}</h3>
            <p>{copy.phases.floors[floor]!.b}</p>
          </div>
          <div class={`elevator__door elevator__door--l${open ? ' is-open' : ''}`} aria-hidden="true" />
          <div class={`elevator__door elevator__door--r${open ? ' is-open' : ''}`} aria-hidden="true" />
        </div>
      </div>
      <p class="mono">{copy.phases.note}</p>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" class="section container" aria-labelledby="faq-h">
      <h2 id="faq-h">FAQ</h2>
      <div style={{ maxWidth: 860 }}><Accordion items={copy.faq.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} /></div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */
export default function Home() {
  const [office, setOffice] = useState<Office | null>(null);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [reg, setReg] = useState<Register | null>(null);
  const [token, setToken] = useState<TokenFacts | null>(null);
  const [own, setOwn] = useState<Lease | null>(null);
  useEffect(() => {
    loadOffice().then(setOffice); loadBulletin().then(setBulletin); loadRegister().then(setReg);
    loadToken().then(setToken); loadOwnLease().then((o) => setOwn(o?.lease ?? null));
  }, []);
  return (
    <>
      <Hero office={office} />
      <Bulletin data={bulletin} />
      <How />
      <Inspectors />
      <Desk />
      <DraftTeaser />
      <RegisterPreview reg={reg} />
      <HearingExplainer />
      <Building token={token} own={own} />
      <Phases />
      <Faq />
    </>
  );
}

export { Notice, AddressChip };
