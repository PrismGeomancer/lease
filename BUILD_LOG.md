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
Live (this environment): public RPC `getAccountInfo`, DexScreener and Helius-less paths respond. Public RPC answers HTTP 429 for `getTokenLargestAccounts` (landlord/neighbours → UNVERIFIABLE) — a Helius key is needed for those.
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

## Stage 9 — Office rounds
Done: `scripts/rounds.ts` + pure `src/lease/rounds.ts`; workflow `office-rounds.yml`; dependabot. Ran locally against live mainnet: token facts for a real mint written; a simulated signed test lease on USDC (clause: authorities renounced) was inspected with all nine inspectors and evicted on the first round (authority checks are deterministic); data restored afterwards.
Not verified: scanning a real Lease Office address (no office wallet exists yet), Telegram delivery, the workflow on GitHub itself, `actionlint` (not installed; YAML parses). Neighbours ran on the public RPC without a Helius key, so it likely reported UNVERIFIABLE for rate limits.

## Stage 10 — Hardening
Done: CSP meta (build-only, build fails if an RPC host isn't allowed), canonical/OG url + sitemap when `SITE_URL` is set, manifest, icons, `og.png` (DEMO data), JSON-LD, README, dependabot, truth-guard test (banned words), dist secret scan, inlined CSS + font preloads, a11y fixes, 79 unit tests, 32 e2e tests.
Lighthouse (mobile, local preview, simulated throttling): Home 90 / 100 / 100 / 100 (LCP 3.3 s); Inspect 95 / 100 / 100 / 100.
Live-verified this session (Helius key in git-ignored .env): authority, metadata, holders, tenant inference, liquidity, bonding-curve LP and neighbours inspectors on a real pump.fun token; a signed test lease evicted by `rounds.ts`. Two real bugs found by live runs and fixed: transaction version ≥1 rejected; $0 bonding-curve liquidity flagged as BREACHED.

### Manual QA checklist status (§31) — what was NOT done
- [x] Intro plays / skips / once per session / reduced motion (Playwright)
- [x] Hero hold-to-sign keyboard + click; early release (Playwright). Touch not tested.
- [x] Invalid address; tampered lease link; keyring save/export/import
- [x] 320 px no overflow on all routes
- [ ] Wallet signing with a real wallet, record on devnet, register pickup, rounds on devnet — need a wallet and a funded office address
- [ ] Three mainnet tokens recorded here (one bonding-curve token inspected live; migrated token and mint-authority-set token only as USDC)
- [ ] 375 / 768 / 1280 / 1920 widths, screen reader, full keyboard journey Home→Lease — not done
- [ ] Share-card visual check on every card with long/short ticker — dimensions tested only
- [ ] Block-the-RPC-host degraded state — unit tested, not driven in a browser

## Redesign pass — the desk is the page
Feedback: too much like a landing page, functionality too late, design stale.
Changed: Home now opens on the working inspection desk (form + nine-row board that shows each inspector's question before any run, then resolves live with a key swing and stamp), one-click real example tokens (JUP, BONK, WIF), shorter intro (~2.5 s) whose form lands in the desk form, a single-line headline without the eyebrow or one-word italic accent, section headings in one voice. Merged the separate inspectors and corkboard sections into the desk and the Sign section; paper is reserved for things you fill in or sign, dark ledger rows for what the chain says.
Added: `VITE_RPC_URL` read only in dev from git-ignored `.env.development.local`; mocked e2e for the desk (idle, progressive resolve, not-a-mint, blocked RPC, 320 px chip).
Lighthouse mobile Home after redesign: 93 / 100 / 100 / 100 (LCP 2.9 s).

## Polish pass — every route audited at 1280 and 390 px
Method: full-page screenshots of Home, Inspect, Draft, Lease (live-inspected test lease on BONK), Hearing, Register, Keyring, Office, 404.
Fixed: footer (balanced brand / nav / legal rows, no empty column), programmatic focus box on headings, mixed-case h1s, lease header (stamp overlap, duplicate ticker name, giant punch cells, stretched form sheets), unreadable brass links on paper and on dark tables, chips wrapping, hearing page showing "?%" (now says evidence is unavailable; and the RPC now retries "service overloaded" errors), register counting samples as leases, doubled Draft step numbers, clipped long stamps on mobile, section headings that could stay hidden if a scroll event was skipped (reveals now also fire when jumped past, with a 6 s safety net).
Added: live "Your lease so far" summary beside the Draft form.
Not re-checked after this pass: Keyring and 404 at desktop width, the Draft pages for steps 2-4 (wallet needed), the intro on a slow device.

## Wallet flow test (mock Wallet Standard wallet)
Real devnet send NOT done: no funds could be obtained (Helius devnet faucet returned HTTP 500, public faucet is closed, no local validator installed). So the 0-lamport transfer on devnet is still unconfirmed.
Instead: `tests/e2e/draft.spec.ts` drives draft → connect → sign (real ed25519 signature made in Node by a mock Wallet Standard wallet) → lease page → the link reopens in a fresh browser context and verifies → one changed character gives the invalid panel → Record on-chain (send is mocked; the test checks the transaction bytes contain the LEASE1 memo, the lease JSON and the office account). Runs against a second build with an office address baked in (port 4174).
Real bugs this found and fixed: (1) wallet modal was painted under page content (stacking context) so wallet buttons could not be clicked — modals now portal to body; (2) Record on-chain would have thrown "Buffer is not defined" in browsers — now guarded by a test.

## Sample label removed (owner's call)
Placeholder cards ($DRAFTY, $MOTEL, $ATTIC) stay; the "SAMPLE — FICTIONAL COIN" stamp, the "sample" caption and the "These are samples:" line are gone. They are still excluded from every count, the bulletin and register.json, and are not links. Note: the spec's rule (§2.3) required the label; with it removed, visitors cannot tell these are fictional.
