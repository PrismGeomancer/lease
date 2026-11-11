import { useEffect, useRef, useState } from 'preact/hooks';
import { CONFIG } from '../config';
import { copy } from '../copy';
import { Button } from '../components/Button';
import { Heading } from '../components/Heading';
import { Show } from '../components/Show';
import { Stamp } from '../components/Stamp';
import { TriplicateForm } from '../components/TriplicateForm';
import { Accordion, CopyButton, ExternalLink } from '../components/misc';
import { InspectionDesk } from '../components/InspectionDesk';
import { InspectionBoard } from '../components/InspectionBoard';
import { IndexCard } from '../components/LeaseParts';
import { KeyGlyph } from '../components/Icons';
import { KpiRow } from '../components/Dashboard';
import { useHold } from '../lib/useHold';
import { prefersReducedMotion } from '../lib/util';
import { loadBulletin, loadOffice, loadRegister, loadToken, loadOwnLease } from '../lib/data';
import type { Bulletin, Office, Register, TokenFacts } from '../lib/dataTypes';
import { SAMPLES } from '../samples';
import { useInspection } from '../lib/useInspection';
import { encodeLease } from '../lease/encode';
import type { Lease } from '../lease/schema';
import { CLAUSE_SHORT, reading } from '../hearing/templates';

/* ------------------------------------------------------------------ desk */
function Desk({ office }: { office: Office | null }) {
  return (
    <section id="hero" class="deskhero container" aria-labelledby="hero-h">
      <div class="deskhero__head">
        <h1 id="hero-h" tabIndex={-1} data-reveal="heading">{copy.hero.h1a}{copy.hero.h1b}</h1>
        <p class="deskhero__sub">{copy.extra.deskSub}</p>
      </div>
      <KpiRow office={office} />
      <div id="desk"><InspectionDesk /></div>
    </section>
  );
}

/* -------------------------------------------------------------- bulletin */
function BulletinStrip({ data }: { data: Bulletin | null }) {
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
      <span class="bulletin__label">{copy.bulletin.label}</span>
      {text.length === 0 ? (
        <p class="bulletin__empty">{copy.bulletin.empty}</p>
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

/* ------------------------------------------------- register + sign (floor) */
const SIG_PATH = 'M6 62 C 20 20, 34 10, 40 40 S 52 70, 66 30 C 74 6, 84 8, 86 36 S 100 64, 124 34 C 134 22, 144 24, 148 44 S 170 58, 214 26';

function SignDemo() {
  const [torn, setTorn] = useState(false);
  const { progress, handlers } = useHold({ durationMs: 1400, onComplete: () => setTorn(true) });
  const p = torn ? 1 : progress;
  const L = 320;
  return (
    <TriplicateForm formNo="FORM L-01 / REV. 3" title="Lease agreement" tilt={-2} torn={torn} labels max={440}>
      <ul class="demo__terms">
        <li>Mint and freeze authority renounced</li>
        <li>Dev holds at most 5% of supply</li>
        <li>No dev sells for 14 days</li>
      </ul>
      <div class="sigline" role="button" tabIndex={0} aria-label={copy.hero.holdHint} aria-describedby="sig-hint" {...handlers} style={{ touchAction: 'none' }}>
        <svg viewBox="0 0 220 80" aria-hidden="true">
          <path d={SIG_PATH} fill="none" stroke="#1d2b6b" stroke-width="3" stroke-linecap="round" opacity={p > 0 ? 1 : 0} stroke-dasharray={L} stroke-dashoffset={L * (1 - p)} />
        </svg>
        <span class="sigline__x">✕</span>
      </div>
      <p id="sig-hint" class="demo__hint">{torn ? '' : `${copy.hero.holdHint}. ${copy.hero.holdKeyboard}.`}</p>
      <div class="demo__foot">
        {torn ? (
          <>
            <Stamp status="ACTIVE" size="md" animate text={copy.hero.signedDemo} />
            <a href="#/draft" class="btn btn--primary btn--sm">{copy.hero.signReal}</a>
          </>
        ) : (
          <Button size="sm" variant="secondary" onPaper onClick={() => setTorn(true)}>{copy.hero.signDemo}</Button>
        )}
      </div>
    </TriplicateForm>
  );
}

function Floor({ reg, office }: { reg: Register | null; office: Office | null }) {
  const real = reg?.leases.slice().sort((a, b) => b.start - a.start).slice(0, 6) ?? [];
  return (
    <section id="register-preview" class="section container" aria-labelledby="rp-h">
      <div class="floor__head">
        <Heading parts={copy.register.heading} id="rp-h" />
        <Button variant="secondary" href="#/register">{copy.register.cta}</Button>
      </div>
      <p>{copy.register.lede} {office && office.counts.onFile > 0 && <span class="mono">{copy.hero.facts(office.counts.onFile, office.counts.renewed, office.counts.evicted).join(', ')}.</span>}</p>
      <div class="drawer-cards">
        {(real.length ? real : SAMPLES).map((e) => <IndexCard key={e.fp} entry={e} />)}
      </div>
    </section>
  );
}

function SignSection() {
  return (
    <section id="draft-teaser" class="section container split" aria-labelledby="dt-h">
      <div>
        <h2 id="dt-h" data-reveal="heading">{copy.extra.signHeading}</h2>
        <p>{copy.teaser.body}</p>
        <ol class="steps4" aria-label="How a lease works">
          {copy.how.steps.map((s) => (
            <li key={s.t}><strong>{s.t}</strong> {s.b}</li>
          ))}
        </ol>
        <Button size="lg" href="#/draft">{copy.teaser.cta}</Button>
      </div>
      <SignDemo />
    </section>
  );
}

/* ---------------------------------------------------------------- others */
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
        {live ? (
          <InspectionBoard findings={insp.state.findings} running={insp.state.running} started />
        ) : (
          <TriplicateForm formNo="FORM L-01 · $LEASE" title="Lease agreement" max={640}>
            <Stamp status="PENDING" size="lg" text={copy.building.pending} />
            <p>{copy.building.preLaunch}</p>
          </TriplicateForm>
        )}
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
  const t = useRef<number>(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const pick = (i: number) => {
    if (i === floor) return;
    if (prefersReducedMotion()) { setFloor(i); return; }
    setOpen(false);
    t.current = window.setTimeout(() => { setFloor(i); setOpen(true); }, 750);
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
      <Desk office={office} />
      <BulletinStrip data={bulletin} />
      <Floor reg={reg} office={office} />
      <Building token={token} own={own} />
      <SignSection />
      <HearingExplainer />
      <Phases />
      <Faq />
    </>
  );
}
