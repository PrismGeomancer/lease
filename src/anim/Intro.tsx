import { useEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { prefersReducedMotion } from '../lib/util';
import { KeyGlyph } from '../components/Icons';

const SEEN = 'lease:intro:seen';

export function introNeeded(): boolean {
  try {
    return sessionStorage.getItem(SEEN) !== '1';
  } catch {
    return true;
  }
}

/** ≤ 4.5 s, once per session. Skip: button, Esc, click/tap. Reduced motion: 400 ms fade only. */
export function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [typed, setTyped] = useState('');
  const finished = useRef(false);
  const tl = useRef<{ kill: () => void } | null>(null);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    tl.current?.kill();
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }
    onDone();
    document.documentElement.removeAttribute('data-intro');
    document.dispatchEvent(new Event('lease:intro-done'));
    requestAnimationFrame(() => document.getElementById('hero-h')?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-intro', '1');
    document.body.classList.add('scroll-lock');
    const el = root.current!;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', key);
    const unlock = () => document.body.classList.remove('scroll-lock');

    if (prefersReducedMotion()) {
      el.style.transition = 'opacity 400ms';
      requestAnimationFrame(() => { el.style.opacity = '0'; });
      const t = setTimeout(() => { unlock(); finish(); }, 400);
      return () => { clearTimeout(t); unlock(); document.removeEventListener('keydown', key); };
    }

    let dead = false;
    (async () => {
      const [{ gsap }, { Flip }] = await Promise.all([import('gsap'), import('gsap/Flip')]);
      if (dead) return;
      gsap.registerPlugin(Flip);
      const q = (s: string) => el.querySelector<HTMLElement>(s)!;
      const form = q('.intro__form'), keyEl = q('.intro__key'), stampEl = q('.intro__stamp'), lamp = q('.intro__lamp');

      // loader: tied to real font loading, shown at least 1.2 s
      const t0 = performance.now();
      const loaded = { n: 0 };
      let fontsReady = false;
      document.fonts.ready.then(() => { fontsReady = true; });
      const loadTick = () => {
        const elapsed = performance.now() - t0;
        const target = fontsReady ? Math.min(9, Math.floor((elapsed / 1200) * 9)) : Math.min(8, Math.floor((elapsed / 1200) * 8));
        if (target > loaded.n) { loaded.n = target; setCount(target); }
        if (loaded.n < 9 && !finished.current) requestAnimationFrame(loadTick);
      };
      loadTick();

      const text = copy.intro.typewriter;
      const tw = { i: 0 };
      const line = gsap.timeline({ onComplete: () => { unlock(); finish(); } });
      tl.current = line;
      gsap.set(form, { y: 600, rotation: 6, opacity: 1 });
      gsap.set(keyEl, { y: -500, opacity: 0 });
      gsap.set(stampEl, { opacity: 0, scale: 1.4 });
      gsap.set(lamp, { opacity: 0 });
      line
        // 0.3 lamp clicks on, flickers twice
        .to(lamp, { opacity: 0.6, duration: 0.08 }, 0.3).to(lamp, { opacity: 0.2, duration: 0.1 }).to(lamp, { opacity: 0.6, duration: 0.08 })
        .to(lamp, { opacity: 0.2, duration: 0.1 }).to(lamp, { opacity: 1, duration: 0.14 })
        // 0.9 form slides into the light
        .to(form, { y: 0, rotation: -2, duration: 0.9, ease: 'back.out(1.4)' }, 0.9)
        .to(tw, { i: text.length, duration: (text.length * 28) / 1000, ease: 'none', onUpdate: () => setTyped(text.slice(0, Math.round(tw.i))) }, 1.0)
        // 2.0 key drops, bounces once, rotates 8deg
        .to(keyEl, { opacity: 1, y: 0, duration: 0.45, ease: 'bounce.out', rotation: 8 }, 2.0)
        // 2.6 stamp slams
        .to(stampEl, { opacity: 1, scale: 1, duration: 0.12, ease: 'power4.in' }, 2.6)
        .to(el, { x: 2, duration: 0.04, yoyo: true, repeat: 1 }, 2.72)
        // 3.2 lamp widens, form flips into the hero slot
        .to(lamp, { scale: 3, duration: 0.8, ease: 'power2.out' }, 3.2)
        .add(() => {
          const target = document.querySelector<HTMLElement>('[data-hero-form] .tri__main');
          if (target) Flip.fit(form, target, { duration: 0.9, ease: 'power3.inOut', scale: true });
        }, 3.2)
        .to(el, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 4.0);
    })();

    return () => { dead = true; tl.current?.kill(); unlock(); document.removeEventListener('keydown', key); };
     
  }, []);

  return (
    <div ref={root} class="intro" role="dialog" aria-label="Intro" onClick={finish}>
      <button class="btn btn--secondary btn--sm intro__skip" onClick={(e) => { e.stopPropagation(); finish(); }} autofocus>{copy.intro.skip}</button>
      <div class="intro__lamp" aria-hidden="true" />
      <div class="intro__form" aria-hidden="true">
        <span class="mono">{typed}<span class="intro__caret">▍</span></span>
        <span class="intro__key"><KeyGlyph size={72} /></span>
        <span class="intro__stamp">{copy.intro.stamp}</span>
      </div>
      <p class="intro__loader mono" aria-live="off">{copy.intro.loader(count)}</p>
    </div>
  );
}
