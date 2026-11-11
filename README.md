# LEASE

*You don't own the coin. You're on the lease.*

LEASE is a website for Solana coins. A dev **signs a lease**: a short list of public promises, signed with their wallet. Nine **inspectors** check each promise against the chain, round after round. Keep the lease and it is **renewed**. Break a clause and an **eviction notice** goes up, permanently. `$LEASE` is the first coin to sign its own lease.

There is no server and no database. The site is static files on GitHub Pages. Shared state lives in two places only:

1. **Solana itself.** A recorded lease is one transaction to a fixed Lease Office address, carrying the signed lease in a Memo.
2. **GitHub Actions.** A scheduled job ("office rounds") inspects every active lease and writes JSON files into `public/data/`, which the site serves.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run build && npm run test:e2e   # browser tests (first time: npx playwright install chromium)
npm run inspect -- <mint>           # print the nine findings for any token in the terminal
npm run rounds                      # one office round (reads .env, writes public/data/)
```

Useful flags: open `/?net=devnet#/draft` to point the browser at devnet for testing. `#/kit` (dev server only) shows every component in every state.

## Configure

Everything is in [src/config.ts](src/config.ts). **An empty value hides the feature**: no dead links, no disabled buttons.

| Field | What it does |
|---|---|
| `TOKEN_CA` | `$LEASE` contract address. Empty = the "not yet listed" state everywhere. |
| `OFFICE_ADDRESS` | The Lease Office wallet. Empty = "Record on-chain" is hidden and the register shows samples. |
| `X_URL`, `TELEGRAM_URL`, `GITHUB_URL` | Social links. |
| `BUY_URL` | A market link, labelled "View market". |
| `RPC_URL` | Client-side Helius RPC URL (see below). |
| `HELIUS_API_BASE` | e.g. `https://api.helius.xyz`. Empty skips Helius-only extras. |
| `ROUND_INTERVAL_MIN` | Only used in copy ("roughly every 30 minutes"). |

All user-facing text is in [src/copy.ts](src/copy.ts), which mirrors `LEASE_COPY_DECK.md`.

### Helius keys: use two, never commit either

1. **Client key** → goes in `CONFIG.RPC_URL`. It ships to every visitor's browser, so in Helius → *Access Control* **restrict it to your site's domain**. This is the only key allowed in the repo.
2. **Actions key** → repository secret `HELIUS_API_KEY`. For local runs put it in a git-ignored `.env` file (`HELIUS_API_KEY=...`). Never log it.

The build fails if `RPC_URL`'s host isn't allowed by the Content-Security-Policy in `vite.config.ts`, and a test scans `dist/` for leaked keys and Telegram tokens.

## Set up the office

1. **Create the office wallet.** A fresh wallet with a little SOL so the account stays rent-exempt. The site only ever sends a zero-lamport (or, if a wallet or RPC rejects zero, one-lamport) transfer to it. Put its address in `CONFIG.OFFICE_ADDRESS` and in the repository variable `OFFICE_ADDRESS`.
2. **Sign `$LEASE`'s own lease.** Open `#/draft`, sign with the dev wallet, then **Download lease.json** on the lease page. Save it as `public/data/lease-own.json` in the form `{ "schema": 1, "lease": { ...the lease... } }`. Rounds will inspect it like any other lease.
3. **Repository variables:** `OFFICE_ADDRESS`, `TOKEN_CA` (at launch), `SITE_URL` (your public URL, no trailing slash; used for the canonical link, sitemap and alert links).
4. **Repository secrets:** `HELIUS_API_KEY`, and optionally `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` for alerts (one message per renewal or eviction, no price talk).
5. **Enable GitHub Pages** with source *GitHub Actions*. The workflow in `.github/workflows/office-rounds.yml` runs the rounds, commits the data and deploys.
6. **Custom domain:** add it under Pages settings. The build uses relative paths, so it works under `https://<user>.github.io/<repo>/` and on a custom domain.
7. After the first deploy run `npm run build && npm run preview` and `npx tsx scripts/make-og.ts` if you want to regenerate `public/og.png`.

Note that CSP set by a `<meta>` tag cannot include `frame-ancestors`. If you host somewhere that lets you set headers, add `Content-Security-Policy: frame-ancestors 'none'`.

## How the pieces fit

- `src/lease/` – the lease format: canonical JSON, fingerprint, signing message, verification, clause evaluation, the eviction state machine.
- `src/chain/` – RPC wrapper (retry, fallback, cache), DexScreener, Helius, Memo codec, wallet connection, recording.
- `src/inspectors/` – the nine checks. They have no DOM code, so the browser and the Actions job run the same code.
- `src/thresholds.ts` – every default threshold, shown on the Office page.
- `scripts/rounds.ts` – the scheduled job. A breach must be seen in **two consecutive rounds** before an eviction (authority checks excepted, because they are deterministic). A failed or timed-out check is `UNVERIFIABLE`, never guilty.

## Limitations (please read)

- **Nothing enforces a lease in this version.** It records and inspects. Enforcement is a planned future floor, not a feature.
- A signature proves a wallet approved the text. It does not prove who the dev is.
- Without a lease, the dev wallet is inferred from the token's first transaction. That is best-effort and labelled as inferred.
- LP lock checks are partial. Only bonding-curve pools and lease-supplied LP mints are judged; other pool types report `UNVERIFIABLE` rather than a guess.
- The neighbours check (shared first funder) is a heuristic and slow. In the browser it only runs when you click it.
- Very large tokens can't be listed by the RPC (it refuses "too many accounts"), so the top-10 check reports `UNVERIFIABLE` for them.
- GitHub may delay scheduled runs, so "every 30 minutes" is approximate.
- The public RPC fallback is rate-limited. Without a Helius key, holder-based checks will often be `UNVERIFIABLE`.
- Hearing verdicts are stored only in the visitor's browser.
- Floors 2 and 3 on the Office page are plans, not features.
- The site shows no price data anywhere, and no number on it is invented: zero is shown as zero.

## Not financial advice

Meme coins can lose all their value. Only trust the contract address posted on the official LEASE X account.
