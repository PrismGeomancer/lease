import { prefersReducedMotion } from '../lib/util';

/** Seeded rotation per card so it is stable between renders. */
function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return (x - Math.floor(x)) * 1.6 - 0.8;
}

/**
 * Scroll reveals for the current route. Transforms and opacity only; once per element.
 * Gives a cleanup that reverts everything (called on route change).
 */
export async function initReveals(root: ParentNode = document): Promise<() => void> {
  if (prefersReducedMotion()) return () => {};
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  const ctx = gsap.context(() => {
    const waitIntro = document.documentElement.hasAttribute('data-intro');
    root.querySelectorAll<HTMLElement>('[data-reveal="heading"]').forEach((h) => {
      const isHero = h.id === 'hero-h';
      const accent = h.querySelector<HTMLElement>('[data-accent]');
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(h, { yPercent: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { yPercent: 0, opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'power3.out' });
      if (accent) tl.fromTo(accent, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power3.out' }, '-=0.2');
      gsap.set(h, { opacity: 0 });
      if (isHero && waitIntro) {
        document.addEventListener('lease:intro-done', () => tl.play(), { once: true });
      } else {
        // Reveal on enter, and also if the user jumps past it or it is already above the fold:
        // content must never stay hidden because a scroll event was skipped.
        ScrollTrigger.create({
          trigger: h, start: 'top 85%', once: true,
          onEnter: () => tl.play(), onLeave: () => tl.progress(1), onRefresh: (self) => { if (self.progress > 0) tl.progress(1); },
        });
      }
    });
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal="card"]'));
    cards.forEach((c, i) => {
      const pin = c.querySelector<HTMLElement>('.how__pin');
      gsap.set(c, { opacity: 0, y: 40, rotation: i % 2 ? 2 : -2 });
      if (pin) gsap.set(pin, { scale: 0 });
      ScrollTrigger.create({
        trigger: c, start: 'top 90%', once: true,
        onLeave: () => { gsap.set(c, { opacity: 1, y: 0, rotation: seeded(i) }); if (pin) gsap.set(pin, { scale: 1 }); },
        onEnter: () => {
          gsap.to(c, { opacity: 1, y: 0, rotation: seeded(i), duration: 0.6, ease: 'power3.out', delay: (i % 4) * 0.09 });
          if (pin) gsap.to(pin, { scale: 1, duration: 0.25, ease: 'back.out(3)', delay: (i % 4) * 0.09 });
        },
      });
    });
    // Safety net: whatever is still hidden a few seconds in is shown (a skipped scroll event must not hide content).
    gsap.delayedCall(6, () => root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      if (getComputedStyle(el).opacity === '0') gsap.to(el, { opacity: 1, y: 0, yPercent: 0, clipPath: 'inset(0 0 0% 0)', duration: 0.3 });
    }));
  }, root as Element);
  return () => ctx.revert();
}

/** Lamp vignette that drifts ≤ 6% of the viewport with scroll. Desktop + fine pointer only. */
export function initLamp(el: HTMLElement): () => void {
  if (prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  let raf = 0;
  const on = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      el.style.setProperty('--lamp-y', `${(window.scrollY / max) * 6}vh`);
    });
  };
  window.addEventListener('scroll', on, { passive: true });
  return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
}
