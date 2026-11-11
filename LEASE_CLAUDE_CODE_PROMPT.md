# LEASE — Claude Code build prompt

> Paste this whole file into Claude Code in an empty repo folder (e.g. `lease/`).
> Also put `LEASE_COPY_DECK.md` and the `logo/` folder in the repo root before you start; the copy deck is the single source for every user-facing string.

---

## 0. Your role and the goal

You are building **LEASE**, a professional, animation-rich, fully working website for a Solana project, hosted on **GitHub Pages** with **no database and no server**. Persistent shared state comes from two places only:

1. **Solana itself** (leases recorded on-chain as memo transactions to a fixed Lease Office address).
2. **GitHub Actions** (a scheduled job that runs inspections and writes JSON files that the site serves).

This prompt has two parts. **Part A (§0–§16)** is the product: narrative, rules, features. **Part B (§17–§32)** is the detailed spec: build stages, layouts, motion values, component APIs, data schemas, chain calls, states, security and QA. Where Part B is more specific than Part A, Part B wins. Read both parts fully before writing code.

Build it in the stages of §17, commit after each stage, and run tests before moving on. Do not stub anything that this prompt says must work. Where something cannot be verified from your environment (e.g. a live endpoint is blocked), say so explicitly in the final summary instead of pretending.

---

## 1. The narrative (read this before writing a line of code)

**Tagline:** *You don't own the coin. You're on the lease.*
**Closing line:** *Holders get the truth. Devs get trust. Everyone gets receipts.*

In crypto, devs act like they own a coin while holders pay for it. Promises ("dev won't sell", "LP burned") live in tweets that get deleted. LEASE turns the promise into a **lease**:

- The coin is a building the holders paid for. The **dev is the tenant**.
- A dev **signs a lease**: a short list of clauses, signed with their wallet.
- The **Leasing Office** keeps the paperwork. **Nine Inspectors** check each clause against the chain, every round.
- Clauses kept → **Lease Renewed**. Clause broken → **Eviction Notice**, public and permanent.
- **$LEASE** is the office's own building, and the **first coin to sign its own lease**. It is inspected on the homepage like everyone else's.

Story arc used across the site: **Sign → Move in → Inspection → Renewed / Evicted.**

Mood: a 1970s leasing office after hours. Dark walls, a desk lamp, carbon-copy triplicate forms, brass keys, rubber stamps, a punch clock. Bureaucratic, precise, with dry humour. Never "crypto neon".

---

## 2. Truth rules (non-negotiable; enforce them in code and copy)

1. **No promises of price, returns, profit, rewards, airdrops, payouts or giveaways.** Not in copy, alt text, meta, OG images, alerts or comments. Grep for these words before finishing (see §16).
2. **Only real numbers.** Lease counts, renewals, evictions, holder figures, and "office bulletin" events must come from chain or from the Actions data files. If a number is zero, show zero or the empty state from the copy deck. Never invent activity.
3. **Sample data is labelled.** If the register is empty, show 3 sample leases for fictional coins, each with a diagonal `SAMPLE — FICTIONAL COIN` stamp. Samples are never counted in any statistic and never appear in the bulletin, alerts or `register.json`.
4. **Token facts are live or hidden.** `$LEASE` facts (supply, mint/freeze authority, liquidity) are read live. Show "Renounced" **only** if the chain returns `null` for that authority. If `TOKEN_CA` is empty, show the pre-launch state.
5. **The Inspectors are fictional characters; the checks are real code.** Say so once, clearly, in the Inspectors section footnote.
6. **No AI agent claims.** Nothing on the site is an AI. Hearing explanations come from fixed templates.
7. **A signature proves wallet approval, not identity.** Say this wherever signing appears.
8. **A lease is a public promise, inspected live. It is not a guarantee and nothing enforces it in v1.** Say this on the Draft page, the Lease page and in the FAQ.
9. **Footer risk line on every page:** not financial advice; meme coins can lose all their value; verify the contract address only via the official X account.

---

## 3. Tech stack

- **Vite + TypeScript + Preact** (`preact`, `preact-iso` or a tiny hash router you write). Hash routing (GitHub Pages has no rewrites).
- **GSAP 3** (core + ScrollTrigger + Flip; all plugins are free) for animation. Optional **Lenis** for smooth scroll (disabled under reduced motion and on touch).
- **Solana:** `@solana/web3.js` v1 (Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction), `bs58`, `@noble/ed25519` (or `tweetnacl`) for signature verification. SHA-256 via `crypto.subtle`.
- **Wallets:** Wallet Standard via `@wallet-standard/app` (`getWallets()`); use features `solana:signMessage` and `solana:signAndSendTransaction` (fall back to `solana:signTransaction` + `sendRawTransaction`). Show a modal listing detected wallets. If none: show install links for Phantom, Solflare and Backpack.
- **Fonts (self-hosted via `@fontsource`):** `Archivo` variable (use the `wdth` axis for condensed headings) and `Archivo Black` for display; `Courier Prime` for body and data; `IBM Plex Mono` for addresses and numbers (tabular figures); `Homemade Apple` (or `Caveat`) **only** for signature lines.
- **Testing:** Vitest (unit), Playwright (smoke + mobile + reduced motion).
- **Node scripts** for Actions run with `tsx` and **import the same inspector modules** as the browser. Inspector code must be environment-agnostic (no DOM, `fetch` only).
- Vite `base: './'` so it works under `https://<user>.github.io/<repo>/` **and** on a custom domain.

---

## 4. Config (single file, empty value hides the feature)

`src/config.ts`:

```ts
export const CONFIG = {
  PROJECT_NAME: 'LEASE',
  TICKER: '$LEASE',
  TOKEN_CA: '',                 // empty => pre-launch state everywhere
  OFFICE_ADDRESS: '',           // Lease Office pubkey; empty => "Record on-chain" hidden, register reads samples only
  X_URL: '',
  TELEGRAM_URL: '',
  GITHUB_URL: '',
  BUY_URL: '',                  // e.g. pump.fun / DEX link; empty => hidden. Label is "View market", never "Buy now".
  RPC_URL: '',                  // Helius RPC with a DOMAIN-RESTRICTED key, e.g. https://mainnet.helius-rpc.com/?api-key=...
  HELIUS_API_BASE: '',          // e.g. https://api.helius.xyz (for DAS / enhanced tx); empty => skip Helius-only extras
  PUBLIC_RPC_FALLBACK: 'https://api.mainnet-beta.solana.com',
  DEXSCREENER_BASE: 'https://api.dexscreener.com',
  EXPLORER_TX: 'https://solscan.io/tx/',
  EXPLORER_ACCOUNT: 'https://solscan.io/account/',
  DATA_BASE: './data/',         // JSON written by GitHub Actions
  ROUND_INTERVAL_MIN: 30,       // shown in copy ("rounds every 30 minutes")
} as const;
```

Rules:
- Every link and button that depends on a config value is **not rendered** when the value is empty (no dead `#` links, no disabled ghosts).
- `RPC_URL` is a **client-side** key. The README must instruct: restrict it to your domain in Helius → Access Control. The Actions job uses a **separate** key from the repo secret `HELIUS_API_KEY`. Never commit any key except the domain-restricted client one, and never log keys.
- RPC wrapper: try `RPC_URL`, on 429/403/network/CORS error fall back to `PUBLIC_RPC_FALLBACK`, with exponential backoff (max 3 tries) and a per-session request cache. Failures surface as the inspector's `UNVERIFIABLE` state, never as a crash.

---

## 5. Routes and information architecture

| Route | Page |
|---|---|
| `#/` | Home (long scroll, all sections below) |
| `#/inspect` and `#/inspect/:mint` | Inspection Desk, full report |
| `#/draft` | Draft a Lease (4-step wizard) |
| `#/l/:payload` | A lease (view, verify, inspect, share, record) |
| `#/register` | Public register (on-chain leases + Actions data) |
| `#/hearing/:fingerprint/:clause` | Hearing for one breached clause |
| `#/keyring` | Visitor's saved leases and reports (localStorage) |
| `#/office` | About: how it works, data sources, limitations, phases |
| anything else | 404: "Room not found" |

Home section order (ids are stable; use them for nav anchors and ScrollTrigger):

1. `#intro` (overlay, not a section)
2. `#hero`
3. `#bulletin` (office bulletin ticker strip)
4. `#how` (Sign → Move in → Inspection → Renewed / Evicted)
5. `#inspectors` (key cabinet with nine keys)
6. `#desk` (inline Inspection Desk: paste a CA)
7. `#draft-teaser` (Draft a Lease preview + CTA)
8. `#register-preview` (latest 6 leases or labelled samples)
9. `#hearing-explainer`
10. `#building` ($LEASE: the office's own lease, live)
11. `#phases`
12. `#faq`
13. footer

Top nav: logo (to `#/`), Inspect, Draft a Lease, Register, Keyring, Office. Right side: X / Telegram icons (hidden when empty), "Connect wallet" button. On mobile: a full-screen "filing cabinet" menu that slides down like a drawer.

---

## 6. Design system

### Palette (CSS custom properties)
```
--carbon-navy: #11172A   /* page background */
--carbon-deep: #0A0E1A   /* intro, footer */
--carbon-line: #2A3352   /* rules, borders on dark */
--form-white:  #F3EFE4   /* holder copy / main paper */
--form-yellow: #EBCB55   /* dev copy */
--form-pink:   #E9AFC0   /* office copy */
--stamp-red:   #D4262E   /* BREACHED, eviction */
--ledger-green:#2F8F5B   /* KEPT, renewed */
--watch-amber: #D98B2B   /* WATCH */
--slate-grey:  #8A93A8   /* UNVERIFIABLE, pending, secondary text on dark */
--ink:         #1A1A1A   /* text on paper */
--brass:       #B8935A   /* keys, accents, focus ring */
--brass-hi:    #E2C38A
```
Contrast: all text pairs must pass WCAG AA. Status is never conveyed by colour alone (always the stamp word + icon).

### Type scale
- Display (hero): Archivo Black, uppercase, `clamp(2.6rem, 8vw, 7.5rem)`, tight leading 0.9, slight negative tracking.
- Section headings: Archivo `wdth 75`, weight 800, uppercase, letter-spacing 0.02em.
- Form labels: Archivo `wdth 75`, 600, uppercase, 0.72rem, letter-spacing 0.12em.
- Body: Courier Prime 1rem/1.6.
- Data/addresses: IBM Plex Mono, tabular-nums; addresses shortened `AbCd…WxYz` with copy-to-clipboard.
- The italic accent phrase in headings (marked `*like this*` in the copy deck) is set in Courier Prime italic in `--brass-hi`.

### Textures and details
- Subtle paper grain (SVG `feTurbulence` noise as a data-URI, 4–6% opacity) on paper surfaces; faint carbon smudges (2–3 blurred SVG blobs) on forms.
- Perforated edges (CSS radial-gradient mask) on form tops; paper-clip and tape SVGs; form numbers like `FORM L-09 / REV. 3` in the corners.
- A soft desk-lamp vignette on the page: radial gradient that follows scroll slightly (disabled under reduced motion).

### Core components (build these first, in a `/components` folder, with a dev-only `#/kit` route showing all states)
- **TriplicateForm**: three stacked sheets (white, yellow, pink) offset 6px/12px with slight rotations; content on the white sheet. Props: formNo, title, children, `torn` state for the tear animation.
- **Stamp**: `KEPT` (green), `BREACHED` (red), `WATCH` (amber), `UNVERIFIABLE` (grey), `PENDING` (grey outline), `RENEWED`, `EVICTED`, `SAMPLE`. Rotated −6° to −12°, double border, ink-bleed edge via SVG filter, uppercase Archivo Black.
- **KeyTag**: a brass key with a paper tag (inspector number in Roman numerals, name, status stamp on the tag).
- **PunchCard**: a time card with N day cells for the lease term; punched cells for elapsed days; red punch for a breach day.
- **Notice**: an eviction or renewal notice on a "door" panel with tape strips.
- **Button**: primary = brass on navy, uppercase Archivo; secondary = outlined paper; hold-to-confirm variant with a progress ring. All buttons have hover, active (pressed 1px), focus-visible (2px brass ring offset 3px), loading (typewriter dots), and disabled states.
- **AddressChip**, **CopyButton** (toast on copy), **Toast** (slides in like a receipt from a printer, top-right; bottom on mobile), **Modal** (wallet picker, confirm on-chain record).

---

## 7. Intro animation (`#intro`)

Total ≤ 4.5 s. Shown **once per session** (`sessionStorage`). A **Skip** button (top-right, focusable first) plus Esc, click or tap anywhere skips. Under `prefers-reduced-motion`: a 400 ms fade of the final hero frame, no intro sequence.

Sequence (GSAP timeline):
1. **0.0 s:** black (`--carbon-deep`). A tiny loader line in IBM Plex Mono bottom-left: `Filing paperwork… 0/9 inspectors on duty` that counts up to 9/9 tied to real font/asset loading progress (cap the minimum display at 1.2 s, but never fake a long wait).
2. **0.3 s:** a desk lamp clicks on: a warm cone of light (radial gradient) flickers twice (opacity 0 → .6 → .2 → 1) over 0.5 s.
3. **0.9 s:** a triplicate form slides into the light from below with a slight rotation settle (back.out). A typewriter types `FORM L-01 — LEASE AGREEMENT` on it (character by character, 28 ms per char, with a caret).
4. **2.0 s:** a brass key (the logo) drops onto the form: falls, bounces once, rotates 8°, shadow tightens on landing.
5. **2.6 s:** a rubber stamp descends from above the viewport, slams `ON THE LEASE` in red (scale 1.4 → 1, 120 ms), ink-bleed mask expands, the screen nudges 2px for 80 ms.
6. **3.2 s:** the lamp light widens to fill the screen, the form scales and moves via **GSAP Flip** into its place in the hero (the same DOM element becomes the hero form). The headline reveals line by line (mask slide-up, 70 ms stagger).
7. **4.5 s:** intro removed from the DOM, focus moved to the hero heading, scroll unlocked.

---

## 8. Section-by-section build and motion

All scroll animations use ScrollTrigger with `once: true` for reveals; nothing scroll-jacks. Under reduced motion every reveal becomes an instant state change.

### `#hero`
- Left: eyebrow `LEASING OFFICE · SOLANA`, display headline (copy deck), subhead, two CTAs: **Inspect a coin** (primary → `#/inspect`) and **Sign a lease** (secondary → `#/draft`). Below: three small live facts pulled from `data/office.json` (leases on file, renewed, evicted). If zero or unavailable, show the pre-opening line from the copy deck instead of zeros.
- Right: the TriplicateForm from the intro, now interactive: **hold-to-sign**. Press and hold (pointer, or Space/Enter when focused) for 1.4 s; an SVG signature path draws with `stroke-dashoffset` in the handwritten font style; release early → the path retracts. On completion: the three sheets tear apart (yellow flies right labelled "Dev's copy", pink flies left "Office copy", white stays "Your copy"), a small `SIGNED (DEMO)` stamp lands, and a link appears: "Now sign a real one →" (`#/draft`). A visible button alternative ("Sign the demo") does the same on click for accessibility.
- Mouse parallax: the form tilts up to 4° toward the cursor (desktop only, off under reduced motion).

### `#bulletin`
- A thin strip like a split-flap office board, auto-scrolling (marquee via GSAP, pauses on hover and focus; a pause button for accessibility).
- Content = **real** latest events from `data/bulletin.json`: `RENEWED · $XYZ · day 30/30`, `EVICTED · $ABC · clause: dev sold 4.1%`, `NEW LEASE · $DEF · 14-day term`. Each item links to its lease or hearing.
- Empty: a single static line from the copy deck ("Office quiet. No leases on file yet."). Never seed fake events.

### `#how`
- Four steps as four forms pinned to a corkboard: **Sign / Move in / Inspection / Renewed or Evicted**. On scroll, each card is "pinned" in sequence (pin SVG pops in, card drops 12px and settles). Step 4 shows both outcomes: the card flips (3D rotateY) between a green RENEWED stamp and a red EVICTED stamp every 3 s (stops under reduced motion; then shows both side by side).

### `#inspectors`
- A brass-trimmed **key cabinet**: a 3×3 pegboard (mobile: 1-column list of tags) with nine **KeyTags** (I–IX). Hover or focus a key: it swings out (rotate around its hook, spring ease) and the tag shows the inspector's name, what they check, data source, and a one-line dry joke (copy deck).
- A **"Run a demo round"** button: keys swing out one by one (0.18 s stagger) and each tag gets a stamp from a fixed demo result labelled `DEMO`. A second button, **"Inspect a real coin"**, scrolls to `#desk`.
- Footnote: "The inspectors are fictional. The checks are real code reading the Solana chain."

### `#desk` (the Inspection Desk, inline version)
- A big paper form field: `Contract address (mint)` with paste-from-clipboard button and validation (base58, 32–44 chars, valid PublicKey). Submit = **Run inspection**.
- While running: the nine key tags go to `PENDING` and resolve **as each inspector's promise settles** (real progressive rendering, not a fake timer). A typewriter log under the form prints real steps: `IV · Landlord: reading largest accounts… done (412 ms)`.
- Result: an **Inspection Report** on a TriplicateForm: token name/symbol/image (from metadata), the nine rows (stamp, finding in one sentence, the raw value, a source link to Solscan or DexScreener), an overall line (`7 KEPT · 1 WATCH · 1 UNVERIFIABLE`), and buttons: **Open full report** (`#/inspect/:mint`), **Save to Keyring**, **Download report card (PNG)**, **Copy link**.
- Without a lease, inspectors use the **default thresholds** in §9.3 and the copy deck wording makes clear "No lease on file: checked against office defaults".

### `#draft-teaser`
- A half-filled lease form with animated typewriter clauses and a ghost signature, plus the CTA **Draft a lease** and a one-paragraph explanation of what a dev gets (trust they can prove, a live badge, a record that follows the wallet).

### `#register-preview`
- A drawer of index cards (latest 6 leases from `data/register.json`, merged with any newer on-chain entries fetched live). Each card: ticker, short mint, term progress (mini PunchCard), status stamp. Hover lifts the card out of the drawer. **View the full register** → `#/register`.
- Empty: 3 SAMPLE cards (see §2.3).

### `#hearing-explainer`
- Split screen "two readings": left column "The innocent reading" on white paper, right "The guilty reading" on pink paper, with a real example template (labelled EXAMPLE). A gavel-free design: the verdict is a rubber stamp. Explain that holders can stamp their own verdict locally and share it.

### `#building` ($LEASE)
- Title: "The office's own building." A large TriplicateForm showing **$LEASE's own lease** (from `CONFIG.TOKEN_CA` + a lease payload stored in `public/data/lease-own.json` that the dev signs before launch). Run the nine inspectors live on it with the same component as the desk.
- Pre-launch (`TOKEN_CA` empty): show the form with `PENDING — NOT YET LISTED` stamp, the copy deck text, and buttons hidden except X/Telegram if set.
- Live facts row: supply, mint authority, freeze authority, liquidity USD, pair link. Each fact shows its source.

### `#phases`
Three office floors, drawn like an elevator panel with floor buttons: **1 · The Office (live)**, **2 · Escrow Leases (planned)**, **3 · Launch on Lease (planned)**. Clicking a floor button lights it and the elevator doors (two panels) slide open to reveal the description. No dates.

### `#faq`
An accordion styled as a card catalogue (drawer pulls out). Questions in the copy deck. One open at a time. Deep-linkable (`#/` + `?faq=3` is not possible with hash routes, so use `#/office#faq-3` on the office page).

### Footer
Logo, short line, nav links, socials (hidden when empty), contract address chip (hidden when empty), risk line, `© LEASE OFFICE` and a "Last office round: <time>" from `office.json`.

---

## 9. Functionality specs

### 9.1 Inspector interface
```ts
type Status = 'KEPT' | 'WATCH' | 'BREACHED' | 'UNVERIFIABLE' | 'PENDING';
interface Finding { id: InspectorId; status: Status; summary: string; value?: string|number; source: { label: string; url?: string }; evidence?: unknown; ms: number; }
interface InspectCtx { mint: string; lease?: Lease; rpc: Rpc; dex: Dex; helius?: Helius; now: number; }
type Inspector = (ctx: InspectCtx) => Promise<Finding>;
```
Run all nine with `Promise.allSettled`, each with an 8 s timeout → `UNVERIFIABLE` on timeout or error. Inspectors never throw to the UI.

### 9.2 The nine inspectors (fictional names; real checks)

| # | Id | Name | Checks | Data |
|---|---|---|---|---|
| I | `mint` | Ada Mint | Mint authority is `null` | `getParsedAccountInfo(mint)` (SPL Token and Token-2022) |
| II | `freeze` | Otto Frost | Freeze authority is `null` | same |
| III | `paint` | Vera Varnish | Metadata immutable (`isMutable=false`) | Helius DAS `getAsset` if available, else Metaplex metadata PDA decode; Token-2022 metadata extension → treat update authority null as locked |
| IV | `landlord` | Walter Deed | Top-10 holders' share of supply, excluding liquidity pools | `getTokenLargestAccounts` + owners via `getMultipleParsedAccounts`; exclude owners that are **off-curve** (PDAs, likely pools/programs) and the DexScreener pair addresses; list exclusions in evidence |
| V | `tenant` | Ruth Keys | Dev wallet share now; sells since lease start | dev = `lease.dev` or, without a lease, best-effort creator = fee payer of the oldest signature on the mint (label "inferred"); balance via `getParsedTokenAccountsByOwner` |
| VI | `foundations` | Basil Stone | Liquidity USD and pair age | DexScreener `/tokens/v1/solana/{mint}` (fallback `/latest/dex/tokens/{mint}`); use the highest-liquidity pair |
| VII | `locks` | Ivo Bolt | LP burned or locked | If pair is a pump.fun bonding curve or PumpSwap/Raydium pool where LP is burned by protocol (detect via `dexId` + known rules; document the rules in code), `KEPT` with that reason; if lease provides an `lpMint`, check its largest holders / supply for burn (incinerator `1nc1nerator11111111111111111111111111111111` or supply burned); otherwise `UNVERIFIABLE` |
| VIII | `noise` | Nora Knock | 24h buy/sell ratio and volume | DexScreener `txns.h24`, `volume.h24` |
| IX | `neighbours` | Ned Fence | Top holders funded by the same wallet | For top-10 (non-pool) owners: first incoming SOL transfer (Helius enhanced tx API if `HELIUS_API_BASE` set; else oldest signature + parsed tx). Best-effort; in the browser only when the user clicks **Run Neighbours (slow)**; always in Actions for registered leases |

### 9.3 Default thresholds (no lease)
- landlord: ≤30% KEPT, 30–50% WATCH, >50% BREACHED
- tenant: dev ≤5% KEPT, 5–10% WATCH, >10% BREACHED; inferred dev → never stronger than WATCH
- foundations: ≥ $10k KEPT, $2k–10k WATCH, < $2k BREACHED
- noise: sells/buys ≤ 1.5 KEPT, 1.5–3 WATCH, > 3 BREACHED; volume < $500 → UNVERIFIABLE
- neighbours: ≥3 top holders sharing a funder → BREACHED, 2 → WATCH
All thresholds in one `thresholds.ts`, unit-tested, and shown on `#/office`.

### 9.4 Lease schema and clauses
```ts
interface Lease {
  v: 1;
  mint: string;            // token
  dev: string;             // dev wallet (the signer)
  t0: number;              // unix seconds, self-declared sign time
  term: 7 | 14 | 30 | 60 | 90;   // days
  b0: string;              // dev token balance (raw u64 string) at signing, read live while drafting
  c: {                     // clauses (omit = not promised)
    ar?: 1;                // authorities renounced (mint+freeze null)
    ml?: 1;                // metadata locked
    dm?: number;           // dev max % of supply (0.1–20)
    ns?: number;           // no dev sells for N days (≤ term); tolerance 0.5% of b0
    lp?: 1;                // LP burned/locked
    lpm?: string;          // optional LP mint for the locks check
    tt?: number;           // top-10 max % (10–80)
    liq?: number;          // min liquidity USD
  };
  n?: string;              // dev note ≤140 chars, shown as "Dev's statement — not inspected"
  sig: string;             // base58 ed25519 signature over the message below
}
```
- **Canonical JSON** of the lease **without** `sig`: keys sorted, no whitespace. `fingerprint = hex(sha256(canonical))`; display first 12 chars grouped `a1b2-c3d4-e5f6`.
- **Message to sign** (human-readable; built deterministically from the payload, so it can be rebuilt for verification):
```
LEASE OFFICE — FORM L-01
I, <dev>, sign this lease for token <mint>.
Term: <term> days from <ISO t0>.
Clauses:
- <one line per clause in fixed order: ar, ml, dm, ns, lp, tt, liq>
Fingerprint: <full fingerprint>
This signature moves no funds and grants no permissions.
```
- **URL encoding:** `#/l/` + base64url(JSON incl. `sig`). Reject payloads > 2 KB.
- **Verify:** decode → rebuild message → verify signature with `dev` pubkey → show `SIGNATURE VALID` or `SIGNATURE INVALID` (invalid leases render only a warning panel and no inspection).
- Clause evaluation maps each clause to inspectors with the dev's own numbers replacing defaults. A clause's status: `KEPT`, `BREACHED`, `UNVERIFIABLE`, or `PENDING` (e.g. `ns` window not started). Lease state: **ACTIVE** (term running, all evaluable clauses kept), **RENEWED** (term ended with no breach), **EVICTED** (any clause BREACHED at any recorded round; Actions history is authoritative for registered leases; for link-only leases, the live check decides and the page says "live check only, no history").

### 9.5 Draft a Lease wizard (`#/draft`)
Four steps, each a form sheet that slides in from the right (previous sheet slides under like carbon):
1. **The building:** paste mint → live preview (name, symbol, image, supply) via the same RPC helpers.
2. **The tenant:** connect wallet (Wallet Standard modal). Read the dev's current balance → `b0`, show their % of supply.
3. **The terms:** term (segmented control 7/14/30/60/90), clause toggles with number inputs and live validation (e.g. warn if `dm` is already exceeded right now: "You'd be evicted on day one."). Optional note.
4. **Sign:** show the exact message to sign in a monospace box, the truth notes (signature ≠ identity; promise ≠ guarantee). **Sign the lease** (hold-to-confirm 1 s) → `solana:signMessage`.
After signing: the triplicate tear animation, then the **Lease page** for the new payload with:
- **Copy lease link**, **Download lease card (PNG)**, **Download lease.json**, **Save to Keyring**
- **Record on-chain** (only if `OFFICE_ADDRESS` set): see 9.6.

### 9.6 Record on-chain (the public register, no database)
- Build one transaction, fee payer = `lease.dev` (must equal the connected wallet; otherwise disable with explanation):
  1. `SystemProgram.transfer({ fromPubkey: dev, toPubkey: OFFICE_ADDRESS, lamports: 0 })`. **Test on devnet first** that a 0-lamport transfer lands and the office address appears in `getSignaturesForAddress`; if a 0-lamport transfer is rejected by a wallet or RPC, use 1 lamport and document it.
  2. Memo program v2 (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) instruction with data `LEASE1:` + base64url(compact lease JSON incl. `sig`). Assert total memo ≤ 560 bytes (unit test with worst-case payload).
- Confirm modal before sending: exact cost estimate (network fee), "This is a real transaction. It records your lease permanently; it cannot be edited or deleted."
- On success: toast with explorer link; the lease page shows `RECORDED ON-CHAIN · <date from blockTime>`; the recorded `blockTime` becomes the authoritative start date (shown instead of the self-declared `t0`, with both visible on the lease).
- **Register reader** (`#/register`): load `data/register.json` (from Actions), then fetch newer signatures for `OFFICE_ADDRESS` since its `cursor`, parse memos, and validate each entry: memo prefix, payload decodes, signature valid, tx fee payer == `lease.dev`, `mint` is a real mint. Invalid entries are silently dropped (count shown in a small "x entries rejected" line). Dedupe by fingerprint (first recording wins).
- Register UI: filters (Active / Renewed / Evicted), search by ticker or mint, sort (newest, ending soon), card grid with mini PunchCards; each card → lease page.

### 9.7 The Hearing (`#/hearing/:fingerprint/:clause`)
For any BREACHED or WATCH clause: a split page. Left "The innocent reading", right "The guilty reading", both from fixed templates per clause type (copy deck §Hearing), filled with real values. Below: the **evidence** (raw values, timestamps, tx links, wallet trail list of the relevant transfers with destination type: "another wallet", "liquidity pool", "exchange-like address (unverified)"). Visitor verdict: two stamps, **"Fair wear and tear"** and **"Breach of lease"**; the chosen stamp is saved in localStorage and included in a **Download hearing card (PNG)**. Clear label: "Your verdict is stored only on this device."

### 9.8 Keyring (`#/keyring`)
localStorage (`lease:keyring:v1`) list of saved leases and reports with timestamp; each key shows status on load (re-inspect button). **Export** (JSON download) and **Import** (file input, validated), **Clear** (hold-to-confirm). Wrap storage in try/catch; if unavailable show the copy deck's "storage blocked" message.

### 9.9 Share cards (Canvas 2D, 1200×630 PNG, after `document.fonts.ready`)
Types: Inspection Report, Lease (triplicate), Lease Renewed, Eviction Notice, Hearing. Navy background, the form, stamp, ticker, short mint, fingerprint, site URL from `location.origin + pathname`. No price data on any card. Also generate a static `public/og.png` at build time (or commit one) and set OG/Twitter meta.

### 9.10 Connect wallet
Header button → modal with detected Wallet Standard wallets (icon + name). Connected state: short address chip with a dropdown (Copy address, My leases (filter register by dev), Disconnect). Persist the last wallet name only (not keys). The site never requests a transaction except the explicit **Record on-chain** action.

---

## 10. GitHub Actions: "Office rounds"

`.github/workflows/office-rounds.yml`, triggers: `schedule: '*/30 * * * *'`, `push` to `main`, `workflow_dispatch`. Permissions: `contents: write`, `pages: write`, `id-token: write`. `concurrency: office-rounds` (cancel-in-progress: false).

Job steps:
1. checkout, setup Node 20, `npm ci`.
2. `npm run rounds` (`tsx scripts/rounds.ts`) with env `HELIUS_API_KEY` (secret), `OFFICE_ADDRESS`, `TOKEN_CA` (repo variables), optional `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (secrets).
3. If `public/data/` changed: commit as `github-actions[bot]` with message `office round <ISO time> [skip ci]`, push.
4. `npm run build`, `actions/upload-pages-artifact` (dist), `actions/deploy-pages`.

`scripts/rounds.ts`:
- Read `public/data/register.json` (with `cursor` = last processed signature). Fetch new signatures for `OFFICE_ADDRESS` (paginate `before`/`until`), parse and validate entries exactly like the browser (shared module).
- For every lease that is ACTIVE (and for `$LEASE`'s own lease): run all nine inspectors (including neighbours), evaluate clauses, and append a round to `public/data/leases/<fingerprint>.json` → `{ lease, recordedAt, tx, rounds: [{ t, findings, clauseStatus }] }`. Keep the last 500 rounds per lease; also keep one summary per day.
- Status transitions: ACTIVE → EVICTED on first BREACHED clause (record clause, time, evidence); ACTIVE → RENEWED when term ends with no breach. Transitions are permanent.
- Write `register.json` (index: fingerprint, ticker, mint, dev, term, start, state, lastRound), `bulletin.json` (last 30 real transitions + new leases), `office.json` (counts: onFile, active, renewed, evicted, lastRoundAt), `token.json` ($LEASE facts).
- **Alerts** (only if Telegram secrets exist): send one message per transition, deduped by `fingerprint+state`. Format from the copy deck. No price talk in alerts.
- Respect rate limits: sequential per lease, 150 ms spacing, retries with backoff; a failed inspector writes UNVERIFIABLE, never a false BREACHED. **A transient RPC failure must never evict a lease**: BREACHED requires the condition to be observed in 2 consecutive rounds (except authority not null, which is deterministic).

Document in the README that GitHub may delay scheduled runs, so "every 30 minutes" is approximate.

---

## 11. Copy

All user-facing strings come from `LEASE_COPY_DECK.md`. Put them in `src/copy.ts` (one object, grouped by section). Do not invent marketing lines; if a string is missing, add a short one in the same voice and list it in the final summary. Keep the specified lengths so layouts hold.

---

## 12. Accessibility, performance, quality

- Semantic HTML, landmarks, one `h1` per route, skip link, full keyboard support (hold-to-sign via Space/Enter, with click alternative), visible focus, `aria-live="polite"` for inspection progress, modals trap focus and close on Esc.
- `prefers-reduced-motion`: no intro sequence, no parallax, no marquee auto-scroll, no screen nudge; instant states.
- Mobile first; test at **320, 375, 768, 1280, 1920** widths; no horizontal scroll at 320 px; tap targets ≥ 44 px; the key cabinet becomes a vertical list; the hero form sits under the headline.
- Performance: Lighthouse mobile ≥ 90 performance, ≥ 95 accessibility/best-practices/SEO. Code-split routes; lazy-load GSAP plugins used only below the fold; fonts subset Latin, `font-display: swap`, preload the display font; images as SVG where possible.
- SEO: title, description, canonical, OG/Twitter tags, `favicon.svg` + PNG fallbacks (16/32/180/512) from `logo/`, `manifest.webmanifest`, `robots.txt`.
- Errors: global error boundary renders a "Paper jam" panel with a reload button; never a blank page.
- No trackers, no analytics, no cookies.

---

## 13. Project structure (suggested)

```
src/
  main.tsx, router.ts, config.ts, copy.ts, thresholds.ts
  chain/      rpc.ts, dex.ts, helius.ts, memo.ts, wallet.ts
  lease/      schema.ts, canonical.ts, fingerprint.ts, message.ts, encode.ts, verify.ts, evaluate.ts
  inspectors/ index.ts, mint.ts, freeze.ts, paint.ts, landlord.ts, tenant.ts, foundations.ts, locks.ts, noise.ts, neighbours.ts
  hearing/    templates.ts
  cards/      canvas.ts (share cards)
  components/ TriplicateForm, Stamp, KeyTag, PunchCard, Notice, Button, Modal, Toast, AddressChip, ...
  pages/      Home, Inspect, Draft, LeasePage, Register, Hearing, Keyring, Office, NotFound, Kit(dev only)
  anim/       intro.ts, hero.ts, sections.ts, reduced-motion.ts
  styles/     tokens.css, base.css, components.css, pages.css
scripts/rounds.ts
public/data/  register.json, bulletin.json, office.json, token.json, lease-own.json, leases/
public/       favicon.svg, og.png, manifest.webmanifest, robots.txt
tests/        unit/*.test.ts, e2e/*.spec.ts
.github/workflows/office-rounds.yml
README.md
```

Seed `public/data/*.json` with valid **empty** structures (`onFile: 0`, empty arrays). Samples for the register live in `src/samples.ts`, never in `public/data`.

---

## 14. Tests (must pass before you finish)

Unit (Vitest):
- canonical JSON is stable regardless of key order; fingerprint matches a fixed vector.
- message builder output is byte-identical for a fixture.
- sign with a generated keypair → verify true; tampered payload → false.
- base64url encode/decode round trip; payload > 2 KB rejected.
- memo size ≤ 560 bytes for the worst-case lease.
- each inspector with mocked RPC/Dex fixtures produces KEPT / WATCH / BREACHED / UNVERIFIABLE correctly; off-curve owners are excluded from landlord.
- clause evaluation and lease state machine (ACTIVE → RENEWED / EVICTED; two-round rule for transient breaches).
- register validator rejects: bad prefix, bad signature, fee payer ≠ dev, duplicate fingerprint.
- config: every optional link is not rendered when empty.
- truth guard: a test that scans `src/copy.ts` and `public/` text for banned words (see §16) and fails if found.

E2E (Playwright, with network mocked):
- home loads, intro plays once per session and Skip works; reduced-motion skips it.
- nav to every route; 404 works.
- desk: valid CA → nine rows resolve progressively; invalid CA → inline error.
- draft wizard with a mocked Wallet Standard wallet → lease page → link reopens and verifies.
- keyring export/import.
- 320 px: no horizontal overflow on every route.

---

## 15. README (write it for a non-expert)

What LEASE is (narrative in 5 lines), local dev, config fields, how to set the Helius client key with domain restriction, repo secrets/variables for Actions, how to create and fund the `OFFICE_ADDRESS` (a fresh wallet holding a little SOL so it stays rent-exempt; the site only ever sends 0 lamports or 1 lamport to it), how to sign `$LEASE`'s own lease and put it in `public/data/lease-own.json`, how to deploy to GitHub Pages and a custom domain.

**Limitations section (honest, required):** nothing enforces a lease in v1; signatures prove wallet approval, not identity; dev inference without a lease is best-effort; LP lock checks are partial; neighbours check is heuristic and slow; Actions schedule can be delayed; public RPC fallback can be rate-limited; verdicts at the Hearing are local only; Phases 2–3 are plans, not features.

---

## 16. Final checks before you report done (do these last, after everything in Part B)

1. `npm run test`, `npm run test:e2e`, `npm run build` all pass.
2. Grep the repo (excluding `node_modules`, `dist`, this prompt) for: `BLACKBOX`, `bureau`, `investigator`, `lorem`, `TODO`, `guaranteed`, `100x`, `moon`, `profit`, `returns`, `reward`, `airdrop`, `giveaway`, `passive income`, `financial freedom`, `buy now`. Fix every hit (the risk line's "not financial advice" is allowed).
3. Every external link and contract field reads from `CONFIG`.
4. Manually test with `TOKEN_CA` and `OFFICE_ADDRESS` empty (pre-launch) **and** filled with a real mainnet token (e.g. a well-known pump.fun token) to see live inspections.
5. Run Lighthouse mobile on Home and Inspect; report the scores.

**Then end with a short summary** containing: what was verified **live** (which endpoints actually responded from your environment), what was only **mocked** in tests, whether the 0-lamport transfer was confirmed on devnet, any copy strings you had to add, and the exact steps I must do (keys, secrets, office wallet, own lease) before launch.


---
---

# PART B — Detailed specification

## 17. Build stages and acceptance criteria

Work through these stages in order. At the end of each stage: run `npm run lint && npm run test`, commit with message `stage N: <name>`, and write two lines in `BUILD_LOG.md` (what was done, what is known to be missing). Do not start a stage while the previous stage's criteria fail.

| Stage | Name | Done when |
|---|---|---|
| 0 | Scaffold | Vite + TS + Preact + ESLint + Prettier + Vitest + Playwright installed; `npm run dev`, `build`, `preview`, `test`, `test:e2e`, `lint`, `rounds` scripts exist; strict TS (`strict`, `noUncheckedIndexedAccess`); `base: './'`; empty hash router renders a placeholder per route. |
| 1 | Tokens and kit | `tokens.css` with every palette, spacing, radius, shadow, z-index and motion token from §18–§19; fonts self-hosted; all components of §21 built with every state; dev-only `#/kit` route shows each component in each state on both navy and paper backgrounds. |
| 2 | Copy and config | `copy.ts` contains every string from `LEASE_COPY_DECK.md`; `config.ts` complete; a `<Show if={CONFIG.X_URL}>` style helper; unit test proves empty config hides links. |
| 3 | Lease core | schema, canonical JSON, fingerprint, message builder, base64url encode/decode, verify, memo encode/decode, register validator; 100% unit-test coverage on `src/lease/` and `src/chain/memo.ts`. |
| 4 | Chain layer | RPC wrapper with fallback/backoff/cache, DexScreener client, Helius client (optional), all nine inspectors with fixture tests (fixtures stored in `tests/fixtures/*.json`, captured from real responses where possible). A CLI `npm run inspect -- <mint>` prints a table of findings in the terminal for manual checks. |
| 5 | Home static | All home sections laid out to §20 at all breakpoints with real copy; no animation yet; Playwright: 320 px has no overflow. |
| 6 | Pages | Inspect, Draft, Lease, Register, Hearing, Keyring, Office, 404 laid out and wired to the chain layer; wallet modal; signing works with a real wallet on localhost. |
| 7 | Motion | Intro, hero hold-to-sign, section reveals, cabinet, bulletin, phases elevator, page transitions, toasts; reduced-motion path for every one of them. |
| 8 | Share cards and keyring | All five card types render correctly (snapshot test of canvas output dimensions and a visual check in Playwright); keyring export/import. |
| 9 | Office rounds | `scripts/rounds.ts` runs locally against mainnet with a real `HELIUS_API_KEY` from `.env` (git-ignored), writes valid data files; workflow YAML validated (`actionlint` if available). |
| 10 | Hardening | Security (§28), SEO (§29), performance budget (§30), full QA checklist (§31), README, final checks (§16). |

---

## 18. Design tokens (exact values)

```css
:root {
  /* spacing: 4px base */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px;
  --s-7: 48px; --s-8: 64px; --s-9: 96px; --s-10: 128px;
  --section-pad-y: clamp(72px, 12vw, 160px);
  --gutter: clamp(16px, 4vw, 48px);
  --maxw: 1320px;
  --maxw-text: 64ch;

  /* radius: paper is nearly square */
  --r-paper: 2px; --r-btn: 4px; --r-chip: 999px; --r-card: 6px;

  /* shadows */
  --sh-paper: 0 1px 0 rgba(0,0,0,.25), 0 8px 24px -8px rgba(0,0,0,.55);
  --sh-lift: 0 2px 0 rgba(0,0,0,.25), 0 22px 40px -12px rgba(0,0,0,.65);
  --sh-stamp: inset 0 0 0 3px currentColor, inset 0 0 0 6px transparent, inset 0 0 0 8px currentColor;
  --sh-lamp: 0 0 120px 40px rgba(226,195,138,.12);

  /* z-index */
  --z-base: 1; --z-sticky: 50; --z-nav: 100; --z-drawer: 200; --z-modal: 300; --z-toast: 400; --z-intro: 500;

  /* motion (see §19) */
  --ease-paper: cubic-bezier(.22,1,.36,1);
  --ease-stamp: cubic-bezier(.6,-0.28,.74,.05);
  --ease-swing: cubic-bezier(.34,1.56,.64,1);
  --d-xs: 120ms; --d-s: 200ms; --d-m: 360ms; --d-l: 600ms; --d-xl: 900ms;
}
```

Breakpoints (min-width): `sm 480px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1600px`. Container: `max-width: var(--maxw); padding-inline: var(--gutter); margin-inline: auto`.

Grid: 12 columns on `lg+` with 24px gaps; 6 columns on `md`; single column below `md`.

Status → colour → icon mapping (single source in `status.ts`, used by UI, cards and alerts):

| Status | Colour | Icon (inline SVG) | Stamp text |
|---|---|---|---|
| KEPT | ledger-green | check in circle | KEPT |
| WATCH | watch-amber | eye | WATCH |
| BREACHED | stamp-red | cross in square | BREACHED |
| UNVERIFIABLE | slate-grey | question in dashed circle | UNVERIFIABLE |
| PENDING | slate-grey outline | hourglass | PENDING |
| RENEWED | ledger-green | key | RENEWED |
| EVICTED | stamp-red | door with arrow | EVICTED |
| ACTIVE | brass | clock | ACTIVE |
| SAMPLE | slate-grey | none | SAMPLE — FICTIONAL COIN |

---

## 19. Motion specification

### 19.1 Principles
- Paper moves like paper: quick start, soft settle (`--ease-paper`). Stamps move like stamps: wind-up then slam (`--ease-stamp` down, 80 ms hold, `--ease-paper` lift). Keys swing (`--ease-swing`).
- Nothing loops forever except the bulletin marquee (pausable) and the lamp's very slow glow (8 s, opacity ±0.04).
- Every animation is created in a function that first checks `prefersReducedMotion()` and, if true, sets the end state with `gsap.set` and returns.
- Animations are killed on route change (`gsap.context()` per page, `ctx.revert()` on unmount).
- Never animate layout properties (width/height/top/left) on scroll; transforms and opacity only.

### 19.2 Element table

| Element | Trigger | From → To | Duration / ease | Notes |
|---|---|---|---|---|
| Section heading lines | enter 80% viewport | `yPercent:110, opacity:0` → 0/1 (masked) | 700 ms, paper, stagger 70 ms | wrap each line in an overflow-hidden span (split lines manually or with a tiny splitter; no paid plugin needed) |
| Accent phrase | after its line | `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` | 500 ms, paper | brass italic "writes on" |
| Paper card reveal | enter 85% | `y:40, rotate:±2°, opacity:0` → settled random rotate ±0.8° | 600 ms, paper, stagger 90 ms | rotation seeded per card id so it's stable between renders |
| Stamp | when status resolves | `scale:1.6, opacity:0, rotate:-18°` → `scale:1, opacity:1, rotate:-8°` | 140 ms stamp ease, then ink-bleed mask 300 ms | plus 2px `y` nudge on parent for 80 ms (not on mobile) |
| Key swing (hover/focus) | pointerenter/focus | `rotate:0` → `rotate:-14°` → settle `-10°` | 500 ms swing | transform-origin at hook point |
| Key tag flip | status resolves | `rotateY:0` → `180°` | 450 ms paper | back face shows the stamp |
| Pin on corkboard | enter 80% | pin `scale:0` → 1, card `y:-12` → 0 | 250 ms + 350 ms | sequential per step |
| Outcome card (step 4) | interval 3 s | `rotateY:0` ↔ `180°` | 700 ms paper | pause when off-screen (IntersectionObserver) |
| Bulletin marquee | always | `xPercent:0` → `-50` (duplicated content) | speed 40 px/s | pause on hover/focus/off-screen |
| Index card hover | pointerenter | `y:0` → `-18`, shadow → `--sh-lift` | 250 ms paper | |
| Elevator doors | floor click | two panels `xPercent:0` → `±100` | 600 ms paper, 150 ms delay after floor light | floor button glows brass first |
| Drawer (mobile menu) | toggle | `yPercent:-100` → 0 | 450 ms paper | items stagger 40 ms |
| Modal | open | backdrop opacity 0→.7 (200 ms), sheet `y:30, opacity:0` → 0/1 (360 ms) | | close reverses at 0.7× duration |
| Toast | show | slides out of a "printer slot" `y:-100%` → 0 with 1-step jitter | 420 ms | auto-dismiss 3.5 s, hover pauses |
| Typewriter | text set | chars appear one at a time | 28 ms/char, caret blinks 530 ms | respects reduced motion: full text instantly |
| Signature draw | hold | `stroke-dashoffset: L` → 0 tied to hold progress | linear to progress | release early: animate back 300 ms |
| Triplicate tear | sign complete | yellow `x:+120,rotate:6`, pink `x:-120,rotate:-6`, white stays | 700 ms paper | labels fade in 200 ms after |
| Punch card | on view | cells punch in order | 40 ms stagger, each 120 ms | red punch gets a stamp shake |
| Page transition | route change | outgoing `opacity:1→0, y:0→-8` (180 ms); incoming `y:12→0, opacity:0→1` (320 ms) | | focus moves to new `h1` |
| Lamp parallax | scroll | vignette centre moves ≤ 6% of viewport | scrub | desktop only |
| Hero form tilt | pointermove | `rotateX/rotateY` ≤ 4° | quickTo 400 ms | desktop + fine pointer only |

### 19.3 Hold-to-confirm spec (shared hook `useHold`)
- `durationMs` (default 1400 for hero, 1000 for signing, 1200 for clear keyring).
- Pointer: `pointerdown` starts, `pointerup/pointercancel/pointerleave` cancels. Keyboard: `keydown` Space/Enter starts (ignore repeat), `keyup` cancels.
- Exposes `progress` 0–1 (rAF loop) for the ring/signature; at 1 fires `onComplete` once, then a 600 ms cooldown.
- Haptics: `navigator.vibrate?.(12)` on complete (mobile).
- ARIA: role button, `aria-describedby` hint "Press and hold", plus a visually separate click alternative for users who can't hold.

---

## 20. Layout specs per page

### Home
- **Nav (sticky, 64 px):** transparent on hero, navy with 1px `--carbon-line` bottom border after 80 px of scroll (class toggle, 200 ms). Logo 28 px + wordmark "LEASE" (Archivo Black 18 px, tracking .08em).
- **Hero (min-height 100svh):** `lg+`: 7 cols text / 5 cols form; form rotated −3°, max-width 460 px. `md`: text above, form below at 80% width. `<md`: form max-width 340 px, centred. Live facts row under CTAs, IBM Plex Mono 13 px, separated by `·`.
- **Bulletin:** 44 px tall strip, `--carbon-deep` background, brass top/bottom hairlines, IBM Plex Mono 13 px uppercase, items separated by a small brass key glyph.
- **How:** corkboard texture (subtle brown-navy noise) panel; `lg`: 4 cards in a row with slight vertical offsets (0, 24, 8, 32 px); `md`: 2×2; `<md`: vertical stack with a dashed "string" line connecting pins.
- **Inspectors:** cabinet panel with brass frame (2px border + inner 1px highlight); 3×3 hooks, each cell 1:1; tag pops below key on hover. `<md`: list rows (key icon 40 px, name, checks line, chevron to expand the joke + source).
- **Desk:** paper sheet full width up to 960 px, centred; input 56 px tall, IBM Plex Mono 16 px (prevents iOS zoom); result table: columns Stamp / Inspector / Finding / Value / Source; on `<md` each row becomes a card.
- **Draft teaser:** 6/6 split; left copy, right half-filled form with ghost typing.
- **Register preview:** drawer front (brass handle) with 6 index cards in a 3×2 grid (`md` 2×3, `<md` horizontal scroll-snap row with 85% card width).
- **Hearing explainer:** 6/6 split white vs pink paper, a central vertical "staple" divider; `<md` stacked.
- **Building:** large triplicate form left (7 cols), facts list right (5 cols).
- **Phases:** elevator panel (brass plate with three round buttons labelled 1 2 3) left, doors and content right; `<md` buttons on top, content below.
- **FAQ:** card catalogue drawers, max-width 860 px.
- **Footer:** `--carbon-deep`, 3 columns (brand + line, links, contract chip + socials), risk line full width at the bottom in 12 px.

### Inspect `#/inspect/:mint`
Header strip: token image (48 px, rounded 4px, fallback = generic key glyph), name, symbol, short mint with copy, links (Solscan, DexScreener). Then the summary line and stamp counts, the nine-row report, then evidence accordions per inspector (raw JSON-ish key/value view, prettified, with source links), then share/save actions. Sticky action bar on mobile bottom (Save, Card, Link).

### Draft `#/draft`
Left (`lg`): vertical stepper with form numbers `L-01/1` … `L-01/4`; right: the active sheet. Previous/Next buttons at the bottom of the sheet; Next disabled until the step validates (with a reason line). Step state persisted in `sessionStorage` so a refresh doesn't lose the draft. `<md`: stepper becomes a 4-dot progress at the top.

### Lease `#/l/:payload`
Top: state stamp big (ACTIVE / RENEWED / EVICTED), ticker, term progress (PunchCard full width). Middle: the triplicate lease (clauses with their live status stamps on the right margin). Right column (`lg`): signature panel (valid/invalid, dev address, fingerprint), dates, record-on-chain panel, share actions. History timeline (if registered): one row per day with dots coloured by worst status that day.

### Register `#/register`
Filter bar (sticky under nav), results count, grid of index cards (4/3/2/1 columns). Infinite scroll in pages of 24 (client-side). Empty filter state with a "Clear filters" button.

### Hearing, Keyring, Office, 404
Hearing: split as in §8. Keyring: list of key rows with status, date, actions. Office: long-form doc page with a sticky table of contents on `lg`. 404: a closed door illustration with the copy and a button.

---

## 21. Component API specs

Each component: typed props, all states, ARIA, and a `#/kit` entry.

- `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading? disabled? href? hold?={ms} onComplete? icon?>`: when `href` it renders `<a>`; `loading` shows typewriter dots and sets `aria-busy`; `hold` renders a ring progress around the label.
- `<Stamp status size="sm|md|lg|xl" animate?>`: `animate` plays the slam once when it mounts or the status changes.
- `<TriplicateForm formNo title tilt? torn? labels?>`: three sheets; `torn` triggers the tear; `labels` shows "Your copy/Dev's copy/Office copy".
- `<KeyTag index name checks joke status source onOpen>`: keyboard focus opens the tag; Enter toggles pin-open.
- `<PunchCard days elapsed breachDay? compact?>`: `compact` for index cards (single row of 10 dots summarising).
- `<Notice kind="renewed|evicted" ticker clause? date>`.
- `<AddressChip address label? link?>`: shortened, copy button, tooltip with full address.
- `<Modal open onClose title>`: focus trap, Esc, backdrop click, scroll lock, `aria-modal`.
- `<Toast>` via a `toast()` store; max 3 visible; `role="status"`.
- `<WalletModal>`: lists Wallet Standard wallets sorted (Phantom, Solflare, Backpack first if present), shows "Detected" badge; error text inline.
- `<Accordion>` (FAQ, evidence), `<Tabs>` (Office page sections on mobile), `<Segmented>` (term picker), `<Toggle>` (clauses), `<NumberField>` (with min/max/step, suffix `%` or `$`), `<CopyButton>`, `<ExternalLink>` (adds `rel="noopener noreferrer"`, an outward arrow icon and "opens in new tab" SR text).
- `<InspectorTable findings mode="full|compact">`, `<InspectionLog lines>` (aria-live polite), `<LeaseClauses lease statuses>`, `<HistoryTimeline rounds>`, `<IndexCard leaseSummary sample?>`.

---

## 22. Data file schemas (`public/data/`)

All files include `"schema": 1` and `"generatedAt": ISO`. The browser validates shape with a tiny hand-written guard (no heavy schema lib) and treats invalid files as empty.

```ts
// office.json
{ schema:1, generatedAt, lastRoundAt: string|null, counts:{ onFile:number, active:number, renewed:number, evicted:number, rejected:number } }

// register.json
{ schema:1, generatedAt, cursor: string|null, // last processed office signature
  leases: Array<{ fp:string, mint:string, ticker:string|null, name:string|null, image:string|null,
                  dev:string, term:number, start:number /*blockTime*/, tx:string,
                  state:'ACTIVE'|'RENEWED'|'EVICTED', stateAt:number|null, breachedClause:string|null,
                  lastRoundAt:number|null, worst:Status }> }

// leases/<fp>.json
{ schema:1, generatedAt, lease: Lease, tx:string, start:number, state, stateAt, breachedClause,
  rounds: Array<{ t:number, clause: Record<string, Status>, findings: Array<{id:string,status:Status,value?:string|number}> }>,
  daily: Array<{ day:string /*YYYY-MM-DD*/, worst: Status }>,
  pendingBreach: Record<string, number> // clause -> first observed t (for the 2-round rule)
}

// bulletin.json
{ schema:1, generatedAt, items: Array<{ t:number, kind:'NEW'|'RENEWED'|'EVICTED', fp:string, ticker:string|null, clause?:string }> }

// token.json  ($LEASE facts)
{ schema:1, generatedAt, mint:string|null, supply:string|null, decimals:number|null,
  mintAuthority:string|null, freezeAuthority:string|null, liquidityUsd:number|null, pairUrl:string|null }

// lease-own.json  ($LEASE's own signed lease; null until signed)
{ schema:1, lease: Lease|null }
```
`ticker`, `name`, `image` are fetched once per lease from metadata in Actions and cached in the register so the browser doesn't need extra calls.

---

## 23. Chain integration details

### 23.1 RPC wrapper (`src/chain/rpc.ts`)
- JSON-RPC over `fetch` (don't depend on web3.js `Connection` for reads; keep the bundle small). Use web3.js only for transaction building and `PublicKey` helpers, lazy-loaded on Draft/Lease pages.
- Batch where possible (`getMultipleAccounts` with `jsonParsed`, up to 100 keys).
- Cache: in-memory `Map<key, {value, expires}>`, TTL 60 s for account data, 15 s for DexScreener.
- Commitment: `confirmed`.

### 23.2 Calls per inspector
- **Mint / Freeze:** `getAccountInfo(mint, {encoding:'jsonParsed'})` → `parsed.info.mintAuthority`, `freezeAuthority`, `supply`, `decimals`; owner program tells SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) vs Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`). Not a mint → page error "That address isn't a token."
- **Paint:** Helius DAS `POST {RPC_URL}` body `{"jsonrpc":"2.0","id":"paint","method":"getAsset","params":{"id":mint}}` → `mutable`, `content.metadata.name/symbol`, `content.links.image`. Fallback: derive Metaplex metadata PDA (`["metadata", METAPLEX_PROGRAM, mint]`, program `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`), read `isMutable` byte from the account data (write a minimal Borsh reader for name/symbol/uri/isMutable only). Token-2022 with metadata extension: read `updateAuthority` from the extension; null → locked.
- **Landlord:** `getTokenLargestAccounts(mint)` (top 20) → `getMultipleAccounts(jsonParsed)` for owners → `PublicKey.isOnCurve(owner)`; exclude off-curve owners and owners equal to any DexScreener `pairAddress`; take top 10 remaining; `pct = sum(amount)/supply`.
- **Tenant:** with lease: `getTokenAccountsByOwner(dev, {mint}, jsonParsed)` sum balances; compare to `b0` for `ns`; `pct` vs `dm`. Without lease (inference): `getSignaturesForAddress(mint, {limit:1000})` paginate to the oldest (max 5 pages, else give up → UNVERIFIABLE), `getTransaction(oldest)` → first account key (fee payer) = inferred dev. Label inferred everywhere.
- **Foundations / Noise:** DexScreener `GET /tokens/v1/solana/{mint}` (array of pairs); fallback `GET /latest/dex/tokens/{mint}` (`.pairs`). Choose max `liquidity.usd`. Use `pairCreatedAt`, `txns.h24.buys/sells`, `volume.h24`, `dexId`, `url`, `pairAddress`.
- **Locks:** rules table in `locks.ts`, each rule with a comment and source link: e.g. `dexId === 'pumpfun'` (bonding curve, no LP tokens exist) → KEPT "Bonding curve: no LP to pull"; `dexId === 'pumpswap'` → KEPT only if verified that the protocol burns or holds LP for migrated pools (verify at build time and document; if unsure → UNVERIFIABLE); lease `lpm` given → `getTokenSupply(lpm)` and `getTokenLargestAccounts(lpm)`: ≥95% supply burned or held by incinerator → KEPT.
- **Neighbours:** for each top-10 non-pool owner: Helius `GET {HELIUS_API_BASE}/v0/addresses/{owner}/transactions?api-key=…&type=TRANSFER&limit=100` paging backwards to the earliest page (max 3 pages) and take the first incoming native transfer's `fromUserAccount`; without Helius: oldest signature → parsed tx → SOL sender. Group by funder; ignore funders that are themselves known pool/program addresses. Browser: only on explicit click, with a progress bar per wallet; Actions: always for registered leases (cache funder per wallet forever in `public/data/funders.json`, it never changes).

### 23.3 Writing (only two writes exist)
- `signMessage(messageBytes)` for leases.
- `signAndSendTransaction` for Record on-chain: recent blockhash (`getLatestBlockhash`), priority fee `ComputeBudgetProgram.setComputeUnitPrice` with a small default (e.g. 10_000 micro-lamports) and `setComputeUnitLimit(30_000)`; confirm with `confirmTransaction` polling (max 60 s), show states: `Waiting for wallet…` → `Sending…` → `Confirming…` → `Recorded.` / error.

---

## 24. State matrix (every page must handle every row)

| State | What the user sees |
|---|---|
| Loading (first data) | skeleton paper with shimmer lines (no shimmer under reduced motion), typewriter "Pulling the file…" |
| Partial (some inspectors done) | done rows stamped, others PENDING with spinner key |
| Success | full content |
| Empty | copy-deck empty state + one clear action |
| Pre-launch (`TOKEN_CA` empty) | Building section in pending state; no CA chips; no market buttons |
| Offline | top banner "You're offline. Showing saved data." (`navigator.onLine` + events) |
| RPC degraded | small banner "Records room is slow. Some checks may say UNVERIFIABLE." when fallback used |
| Invalid input | inline error under field, `aria-invalid`, focus stays |
| Wallet missing / declined / wrong account | inline messages from copy deck, never a toast-only error |
| Data file missing / invalid | treat as empty, log once to console, never crash |
| Storage blocked | keyring shows copy-deck blocked message; export still works |

---

## 25. Share card layouts (1200×630)

Common: navy background, grain, lamp glow top-left, logo + "LEASE" top-left (40 px), site host bottom-left (IBM Plex Mono 20 px, slate), fingerprint bottom-right if applicable.

- **Inspection Report:** left 60%: white form (rotated −2°) with ticker (Archivo Black 64 px), short mint, and the nine rows as small stamps (3×3 grid). Right: big summary stamp ("7 KEPT") and date.
- **Lease:** triplicate centred, clauses list (max 6 lines, then "+n more"), signature line with the dev short address in the handwritten font, ACTIVE stamp.
- **Renewed:** green RENEWED stamp at −8° across a white notice, "Day {term}/{term}. Every clause kept."
- **Eviction Notice:** pink notice taped (two tape strips) to a dark door panel, red EVICTED stamp, the breached clause in one line, date.
- **Hearing:** split white/pink, the two readings shortened to 2 lines each, visitor's verdict stamp across the middle.
Fonts must be loaded before drawing; text wraps with a measured line-break helper; a unit test checks no text exceeds its box for long tickers (e.g. 12-char symbol).

---

## 26. Wallet edge cases
- Multiple wallets installed: let the user choose; remember the choice name in localStorage.
- Wallet account switches while on Draft: re-read balance, reset step 4, show "Wallet changed. Balance re-read."
- Wallet locked or popup closed: treat as declined.
- Mobile browsers without injected wallets: show "Open this page in your wallet's browser" with deep links for Phantom (`https://phantom.app/ul/browse/{url}`) and Solflare (`https://solflare.com/ul/v1/browse/{url}`), URL-encoded.
- Ledger/hardware: `signMessage` may be unsupported; show the copy-deck message.
- Never call `connect()` on page load without a user action (except silent reconnect if the wallet supports `silent: true` and the user connected before).

---

## 27. The Hearing: evidence algorithms
- **Dev sold:** fetch dev's signatures since lease start (max 200), parse token balance deltas for `mint` from `meta.preTokenBalances/postTokenBalances` where owner = dev. For each negative delta: classify the counterparty: owner off-curve and equals a pair/pool → "sold into a pool"; on-curve wallet → "moved to another wallet"; unknown program → "sent to a program". List with tx links, amounts and % of supply.
- **Top 10 over / Neighbours:** show the wallets table (rank, short owner, %, funder group colour).
- **Liquidity under:** show liquidity now vs the promised minimum and 24h volume. **Never show price** anywhere in the Hearing.
- **Authority / Metadata:** show the authority address with an explorer link.
All evidence lists cap at 20 rows with "Show all".

---

## 28. Security
- CSP via `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.helius-rpc.com https://api.helius.xyz https://api.mainnet-beta.solana.com https://api.dexscreener.com https://api.devnet.solana.com; frame-ancestors 'none'` (note: frame-ancestors is ignored in meta; document that for custom hosting). Adjust if the RPC host differs; the build must fail if `CONFIG.RPC_URL`'s host isn't covered.
- Treat all on-chain strings (name, symbol, memo, note, image URL) as untrusted: render as text only (Preact escapes by default; never use `dangerouslySetInnerHTML`), strip control characters, cap lengths (name 40, symbol 12, note 140). Images: only `https:` URLs, `referrerpolicy="no-referrer"`, `loading="lazy"`, on error swap to the key glyph. IPFS `ipfs://` → convert to a public gateway only if configured; otherwise glyph.
- Payload decoding: size cap, JSON parse in try/catch, strict shape guard, numbers range-checked, addresses validated as PublicKeys.
- No secrets in client code except the domain-restricted RPC key; a test greps `dist/` for `HELIUS_API_KEY` env leakage patterns and Telegram tokens (`/\d{8,10}:[A-Za-z0-9_-]{35}/`).
- Dependencies pinned; add `.github/dependabot.yml` (npm + actions, weekly).
- Clipboard reads only on explicit "Paste" click.

---

## 29. SEO and social
- Per-route `document.title` and meta description updates (copy deck), canonical set to the clean URL.
- Static `index.html` has full meta for the home route (crawlers don't run hash routes).
- `og.png` 1200×630 (render from the Inspection Report card layout with demo data labelled DEMO, or the image-prompt OG image when available), `twitter:card=summary_large_image`.
- `favicon.svg` (from `logo/lease-logo.svg`), `favicon-32.png`, `apple-touch-icon.png` (180), `icon-512.png`, `manifest.webmanifest` (name, short_name "LEASE", theme `#11172A`, background `#11172A`, display `standalone`).
- `robots.txt` allow all; `sitemap.xml` with just the root.
- Structured data: `WebSite` JSON-LD with name and URL only.

---

## 30. Performance budget
- Initial JS (home) ≤ 170 KB gzip, CSS ≤ 40 KB gzip, fonts ≤ 160 KB total for first view (subset, woff2). web3.js and canvas card code are lazy chunks.
- LCP ≤ 2.5 s on Lighthouse mobile; CLS ≤ 0.05 (reserve space for live facts and images); TBT ≤ 200 ms.
- The intro must not delay LCP: the hero text is in the DOM from the start (intro overlays it), and LCP is measured on the hero heading.
- Run `vite build --mode production` with `build.rollupOptions.output.manualChunks` for `gsap`, `web3`, `cards`. Print the chunk report in the final summary.

---

## 31. Manual QA checklist (do it in a real browser and tick it in `BUILD_LOG.md`)
- [ ] Intro: plays, skips with button/Esc/click, does not replay in the same session, replays in a new session, disabled with reduced motion (DevTools emulation).
- [ ] Hero hold-to-sign with mouse, touch (DevTools device mode) and keyboard; early release retracts.
- [ ] Every nav link, CTA, footer link and FAQ item works; empty-config items are absent.
- [ ] Inspect three real mainnet tokens: one pump.fun bonding-curve token, one migrated token, one older token with mint authority set (find one and note it). Record the findings in `BUILD_LOG.md`.
- [ ] Invalid address, a wallet address (not a mint), and an RPC failure (block the host in DevTools) all show the right states.
- [ ] Draft a lease on devnet (switch RPC via a dev-only `?net=devnet` query flag, documented in README), sign it, open the link in a private window, verify it.
- [ ] Record on devnet; the register picks it up live; `rounds.ts` with devnet env picks it up and writes data.
- [ ] Tamper with one character of a lease link → SIGNATURE INVALID panel.
- [ ] Keyring: save, reload, export, clear, import.
- [ ] All five share cards download and look right with a long ticker and a short one.
- [ ] 320 / 375 / 768 / 1280 / 1920 widths on every route: no overflow, no overlapping text.
- [ ] Keyboard only: full journey Home → Inspect → Draft → Lease without a mouse.
- [ ] Screen reader smoke test (VoiceOver or NVDA): headings, live inspection progress announcements, stamps read as words.
- [ ] Lighthouse mobile on Home and Inspect meets §30 and §12.

---

## 32. Final summary format (your last message)

```
## LEASE build summary
### Verified live
- <endpoint/feature>: <result>
### Mocked only
- ...
### Devnet tests
- 0-lamport transfer: <worked / fell back to 1 lamport>, tx: <sig>
### Lighthouse (mobile)
- Home: P/A/BP/SEO  · Inspect: P/A/BP/SEO
### Bundle
- <chunk table>
### Copy strings added (not in the deck)
- ...
### Known limitations
- ...
### Before launch, you must
1. Helius: create a domain-restricted client key → CONFIG.RPC_URL; second key → repo secret HELIUS_API_KEY
2. Create and fund the office wallet → CONFIG.OFFICE_ADDRESS and repo variable OFFICE_ADDRESS
3. Sign $LEASE's own lease → public/data/lease-own.json
4. Fill X/Telegram/GitHub URLs; set TOKEN_CA at launch
5. Enable GitHub Pages (source: GitHub Actions) and optional Telegram secrets
```
