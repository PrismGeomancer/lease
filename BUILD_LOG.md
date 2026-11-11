# BUILD LOG

## Stage 0 — Scaffold
Done: Vite 6 + TS 5.9 (strict, noUncheckedIndexedAccess) + Preact, ESLint, Prettier, Vitest, Playwright; hash router with placeholder per route; all npm scripts; `base: './'`.
Missing: everything else. Note: TypeScript pinned to 5.9 (TS 7 conflicts with typescript-eslint); Vite pinned to 6 (Node 20.18 here).

## Stage 1 — Tokens and kit
Done: tokens.css, self-hosted fonts, Button (hold), Stamp, TriplicateForm, KeyTag, PunchCard, Notice, AddressChip, CopyButton, Toast, Modal, Accordion, Segmented, Toggle, NumberField, `#/kit` (dev only).
Missing: KeyTag flip animation, GSAP-based motion (Stage 7).

## Stage 2 — Copy and config
Done: `copy.ts` (full deck), `config.ts`, `<Show>` helper, unit test that empty config hides links.

## Stage 3 — Lease core
Done: schema guard, canonical JSON, fingerprint, message, base64url, verify, memo codec, register validator. 100% line coverage on `src/lease/` and `src/chain/memo.ts`.
Deviation: memo is `LEASE1:` + raw canonical JSON (not base64url) because base64 of the worst-case lease is >560 bytes. Raw JSON worst case fits (tested).

## Stage 4 — Chain layer
Done: RPC wrapper (fallback, backoff 200/400 ms, 60 s cache), DexScreener client, Helius client, PDA + Metaplex Borsh reader, nine inspectors, clause evaluation + state machine (`src/lease/evaluate.ts`), `npm run inspect -- <mint> [--neighbours]`. 44 unit tests; 100% coverage on lease/memo/evaluate.
Live (this environment): public RPC `getAccountInfo`, DexScreener and Helius-less paths respond. Public RPC returns HTTP 429 for `getTokenLargestAccounts` (landlord/neighbours → UNVERIFIABLE) — a Helius key is needed for those.
Fixtures: synthetic (shapes mirror real responses), defined inline in tests; not captured from live responses because the public RPC rate-limits the holder calls.
Known gaps: LP rule for PumpSwap/Raydium is UNVERIFIABLE by design (no verified protocol-level burn guarantee).

## Stage 5-6 — Home and pages
Done: app shell (nav, drawer, footer, banners, error boundary), all 12 home sections with real copy, Inspect/Draft/Lease/Register/Hearing/Keyring/Office/404, wallet modal (Wallet Standard), record-on-chain flow, register reader, hearing evidence. e2e: every route renders, 320px has no horizontal overflow, empty states are honest.
Missing/unverified: signing with a real wallet, recording on devnet (needs a funded devnet wallet and OFFICE_ADDRESS) — not testable from this environment.

## Stage 7 — Motion
Done: intro (GSAP timeline + Flip, once per session, Skip/Esc/click, reduced-motion fade), hero hold-to-sign with signature draw, scroll reveals (ScrollTrigger, once), pins, flip card, elevator doors, key swing, bulletin marquee (CSS), lamp parallax, page-in transition, toasts. GSAP is a lazy chunk (≈55 KB gz); initial JS ≈32 KB gz.
Deviations: bulletin marquee is CSS (not GSAP) to save bytes; outgoing page fade omitted (incoming only).
Missing: stamp 2 px screen nudge on result stamps; the intro was not measured on a low-end device.

## Stage 8 — Cards and keyring
Done: five canvas cards (report, lease, renewed, eviction, hearing) at 1200×630, layout helpers unit-tested for long tickers; keyring export/import/clear e2e. Card dimensions verified by Playwright; visual quality only spot-checked.
