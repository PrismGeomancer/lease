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
