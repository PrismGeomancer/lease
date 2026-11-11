# LEASE — Copy deck

Voice: a 1970s leasing office after hours. Precise, bureaucratic, dry. Short sentences. Small jokes, never hype.
Accent phrases are marked `*like this*` (rendered in Courier Prime italic, brass).
`{curly}` = live value. Lines marked (JS) are set from script.

---

## Meta
- **Title:** LEASE — You don't own the coin. You're on the lease.
- **Description (≤155):** LEASE is Solana's leasing office. Devs sign public leases, nine inspectors check them on-chain, and everyone gets receipts.
- **OG title:** LEASE — The Leasing Office for Solana coins
- **OG description:** Devs sign the terms. The chain checks them. Kept means renewed. Broken means evicted.
- **Theme colour:** #11172A
- **noscript:** The Leasing Office needs JavaScript to open the filing cabinet.

## Intro (JS)
- Loader: `Filing paperwork… {n}/9 inspectors on duty`
- Typewriter on form: `FORM L-01 — LEASE AGREEMENT`
- Stamp: `ON THE LEASE`
- Skip button: `Skip paperwork`

## Nav
- Inspect · Draft a Lease · Register · Keyring · Office
- Wallet button: `Connect wallet` / connected: `{AbCd…WxYz}`
- Wallet menu: Copy address · My leases · Disconnect
- Mobile menu label: `Cabinet` / close: `Close drawer`

## Hero `#hero`
- Eyebrow: `LEASING OFFICE · SOLANA`
- **H1:** You don't own the coin. You're *on the lease.*
- Sub (≤160): Devs sign the terms. Nine inspectors check them against the chain. Keep the lease and it renews. Break it and the notice goes on the door.
- CTA primary: `Inspect a coin`
- CTA secondary: `Sign a lease`
- Live facts (JS): `{onFile} leases on file` · `{renewed} renewed` · `{evicted} evicted`
- Pre-opening line (when 0 / unavailable): `Office open. Filing cabinet empty. Be the first tenant.`
- Hold-to-sign hint: `Hold to sign the demo` / keyboard: `Hold Space to sign` / button alt: `Sign the demo`
- After demo: copies labelled `Your copy` · `Dev's copy` · `Office copy`; stamp `SIGNED (DEMO)`; link `Now sign a real one →`

## Bulletin `#bulletin` (JS)
- Label: `OFFICE BULLETIN`
- Item formats: `NEW LEASE · {ticker} · {term}-day term` · `RENEWED · {ticker} · day {term}/{term}` · `EVICTED · {ticker} · {clauseShort}`
- Empty: `Office quiet. No leases on file yet.`
- Pause button: `Pause bulletin` / `Resume bulletin`

## How it works `#how`
- Heading: How a lease *works*
- Lede: Four forms. One building. No handshakes.
1. **Sign.** The dev writes the terms: how much they hold, how long they won't sell, what's locked. Then signs with the wallet that holds the keys.
2. **Move in.** Holders arrive knowing the rules of the building. The lease is public, permanent and one link away.
3. **Inspection.** Nine inspectors check every clause against the chain, every round. They don't take bribes. They don't take lunch.
4. **Renewed or evicted.** Term ends clean: *Lease Renewed.* A clause breaks: *Eviction Notice*, on the door, for good.

## Inspectors `#inspectors`
- Heading: Nine inspectors. *One building.*
- Lede: Each one checks a single thing. Together they check the whole building.
- Tags (name · checks · joke):
  - **I · Ada Mint** · Can anyone still print more? · "Infinite supply is just a very fast exit."
  - **II · Otto Frost** · Can anyone freeze your tokens? · "Nobody should hold the thermostat to your wallet."
  - **III · Vera Varnish** · Can the name and picture still change? · "Fresh paint hides a lot of cracks."
  - **IV · Walter Deed** · How much do the top ten wallets own? · "Ten landlords is a committee. One is a king."
  - **V · Ruth Keys** · How much does the dev hold, and did they sell? · "She remembers every key you were given."
  - **VI · Basil Stone** · How deep is the liquidity? · "You can't live in a house with no floor."
  - **VII · Ivo Bolt** · Is the LP burned or locked? · "A lock you can open from inside is a door."
  - **VIII · Nora Knock** · Who's buying, who's selling, how loud? · "She hears the stairs before the footsteps."
  - **IX · Ned Fence** · Are the big wallets secretly one person? · "Same postman, same mailbox, same owner."
- Buttons: `Run a demo round` · `Inspect a real coin`
- Demo stamp: `DEMO`
- Footnote: The inspectors are fictional. The checks are real code reading the Solana chain.

## Inspection Desk `#desk` and `#/inspect`
- Heading: The inspection *desk*
- Lede: Paste any Solana token. Nine checks, straight from the chain, in seconds.
- Field label: `Contract address (mint)` · placeholder: `Paste a token address`
- Buttons: `Paste` · `Run inspection`
- Running log line (JS): `{roman} · {name}: {step}… done ({ms} ms)`
- Summary (JS): `{k} KEPT · {w} WATCH · {b} BREACHED · {u} UNVERIFIABLE`
- No-lease note: `No lease on file: checked against office defaults.`
- With lease: `Lease on file: checked against the dev's own terms.` + link `Open the lease →`
- Result buttons: `Open full report` · `Save to Keyring` · `Download report card` · `Copy link`
- Neighbours button: `Run Neighbours (slow)` · note: `Traces where the top wallets got their first SOL. Takes up to a minute.`
- Finding examples (JS):
  - Mint KEPT: `Mint authority is null. Nobody can print more.`
  - Mint BREACHED: `Mint authority is still set: {addr}.`
  - Landlord: `Top 10 wallets hold {pct}% (pools excluded).`
  - Tenant inferred: `Dev wallet inferred from the first transaction. Treat with care.`
  - Locks UNVERIFIABLE: `LP status can't be confirmed for this pool type.`
- Errors:
  - Invalid: `That's not a Solana address. Check for missing characters.`
  - Not a mint: `That address isn't a token. Try the mint address.`
  - RPC down: `The records room isn't answering. Some inspectors will report UNVERIFIABLE.`
  - Timeout: `{name} ran out of time. Marked UNVERIFIABLE, not guilty.`

## Draft teaser `#draft-teaser`
- Heading: Put your *promise* on paper.
- Body (≤240): Tweets get deleted. Leases don't. Sign your terms with the wallet that holds the keys, and let the inspectors prove you kept them. You get a live badge, a public record, and receipts that follow your wallet.
- CTA: `Draft a lease`

## Draft a Lease `#/draft`
- H1: Draft a *lease*
- Step labels: `1 The building` · `2 The tenant` · `3 The terms` · `4 Sign`
- Step 1: `Which coin are you leasing?` · helper `Paste the mint. We'll read the rest from chain.`
- Step 2: `Who's the tenant?` · `Connect the dev wallet. Its balance is recorded at signing.` · readout `You hold {pct}% of supply.`
- Step 3: `What are the terms?`
  - Term: `Lease term` (7 / 14 / 30 / 60 / 90 days)
  - `Authorities renounced` — Mint and freeze authority are null.
  - `Metadata locked` — Name and image can't change.
  - `Dev holds at most {n}% of supply`
  - `No dev sells for {n} days`
  - `LP burned or locked` (+ optional `LP mint (optional, improves the check)`)
  - `Top 10 wallets hold at most {n}%`
  - `Liquidity stays above ${n}`
  - `Dev's statement (optional, 140 chars)` · note `Shown on the lease. Not inspected.`
  - Live warning: `You'd be evicted on day one: this is already false.`
- Step 4: `Read what you're signing.` · truth notes: `A signature proves this wallet approved the text. It doesn't prove who you are.` / `A lease is a public promise, inspected live. Nothing enforces it in this version.`
- Button: `Hold to sign the lease`
- Wallet errors: `Signature declined. Nothing was signed.` · `This wallet can't sign messages. Try Phantom, Solflare or Backpack.`

## Lease page `#/l/:payload`
- Header: `FORM L-01 · LEASE AGREEMENT` · `Fingerprint {fp}`
- Signature: `SIGNATURE VALID` / `SIGNATURE INVALID — do not trust this lease`
- Dates: `Signed (self-declared): {date}` · `Recorded on-chain: {date}` / `Not recorded on-chain. Live check only, no history.`
- State stamps: `ACTIVE` · `RENEWED` · `EVICTED`
- Progress: `Day {d} of {term}`
- Buttons: `Copy lease link` · `Download lease card` · `Download lease.json` · `Save to Keyring` · `Record on-chain`
- Record modal: title `Record this lease on-chain?` · body `This is a real transaction (network fee ≈ {fee} SOL). It files your lease in the public register permanently. It cannot be edited or deleted.` · buttons `Record it` / `Not yet`
- Wrong wallet: `Only the tenant can record this lease. Connect {dev}.`

## Register `#register-preview` and `#/register`
- Heading: The *register*
- Lede: Every lease recorded on-chain, inspected every round.
- Filters: `All` · `Active` · `Renewed` · `Evicted` · search `Ticker or mint` · sort `Newest` / `Ending soon`
- Empty: `No leases on file yet. These are samples:` + stamp `SAMPLE — FICTIONAL COIN`
- Sample tickers: `$DRAFTY`, `$MOTEL`, `$ATTIC`
- Rejected line (JS): `{n} entries rejected (bad signature or format).`
- CTA: `View the full register`

## Hearing `#hearing-explainer` and `#/hearing/...`
- Heading: Every breach gets a *hearing.*
- Lede: Chains don't lie, but they don't explain either. We show both readings and the evidence. You stamp the verdict.
- Columns: `The innocent reading` · `The guilty reading`
- Verdict stamps: `Fair wear and tear` · `Breach of lease`
- Note: `Your verdict is stored only on this device.`
- Templates:
  - **Dev sold** — innocent: `Dev moved {pct}% to another wallet, possibly for marketing or an exchange.` · guilty: `Dev sold {pct}% inside a no-sell window. That's a partial exit.`
  - **Dev over max** — innocent: `Dev bought more. Confidence looks like this sometimes.` · guilty: `Dev holds {pct}% against a promised {max}%.`
  - **Top 10 over** — innocent: `Big holders may be exchanges or treasury wallets.` · guilty: `{pct}% of supply sits in ten wallets.`
  - **Liquidity under** — innocent: `The whole market dipped and took liquidity with it.` · guilty: `Liquidity fell below the promised ${min}. Floors were pulled.`
  - **Authority set** — innocent: `The dev hasn't got round to renouncing.` · guilty: `Someone can still {mint|freeze}. That was promised away.`
  - **Metadata mutable** — innocent: `Still fixing the logo and links.` · guilty: `The building can be renamed overnight.`
  - **Neighbours** — innocent: `Same exchange paid out to several wallets.` · guilty: `{n} top wallets share one funder. One tenant, many doors.`
  - **Noise** — innocent: `Holders cashing out after a run is normal traffic.` · guilty: `Sellers outnumber buyers {ratio} to 1.`
- Button: `Download hearing card`

## Building `#building` ($LEASE)
- Heading: The office's own *building.*
- Lede: $LEASE is the first coin to sign its own lease. Same nine inspectors. Same front page. No special treatment.
- Fact labels: `Supply` · `Mint authority` · `Freeze authority` · `Liquidity` · `Pair` (values: `Renounced` only when null, else the address)
- Pre-launch stamp: `PENDING — NOT YET LISTED`
- Pre-launch body: `The lease is drafted. The building isn't listed yet. When it is, the contract address appears here and on the official X. Nowhere else.`
- Buttons: `Copy contract address` · `View market` · `Open $LEASE's lease`

## Phases `#phases`
- Heading: Three *floors.*
- **1 · The Office (live):** Sign leases, record them on-chain, inspect any coin, get renewals and evictions in public.
- **2 · Escrow Leases (planned):** A Solana program that holds a dev's allocation and releases it term by term, only while the clauses hold.
- **3 · Launch on Lease (planned):** Coins launched with a lease attached from block one.
- Note: `Floors 2 and 3 are plans, not features. No dates until they're built.`

## FAQ `#faq`
1. **What is a lease?** A dev's public promise about their coin, signed with their wallet and checked against the chain.
2. **Does LEASE enforce anything?** Not in this version. It records and inspects. Enforcement is Floor 2.
3. **Does a signature prove who the dev is?** No. It proves the wallet approved the text. Identity is a separate problem.
4. **Does signing cost anything?** Signing is free and moves no funds. Recording on-chain is one small transaction the dev pays for.
5. **How often are leases inspected?** Every office round, roughly every {ROUND_INTERVAL_MIN} minutes. GitHub can delay rounds.
6. **Can an eviction be undone?** No. Evictions are permanent. That's the point of paper.
7. **Where does the data come from?** The Solana chain (via Helius or the public RPC) and DexScreener. Nothing is typed in by hand.
8. **What do I get for holding $LEASE?** Nothing extra: no payouts, no revenue share. You hold the coin with the most public lease in the building.
9. **Is this financial advice?** No. Meme coins can lose all their value.

## Keyring `#/keyring`
- H1: Your *keyring*
- Lede: Leases and reports you saved. Stored only in this browser.
- Buttons: `Re-inspect` · `Export` · `Import` · `Hold to clear`
- Empty: `No keys yet. Inspect a coin or open a lease, then save it here.`
- Storage blocked: `This browser won't let us keep keys. Use Export to save them yourself.`

## Office `#/office`
- H1: How the *office* works
- Sections: Data sources · Default thresholds · What's recorded on-chain · Rounds · Limitations · Phases
- Limitations intro: `Honest paperwork, so you know what this is and isn't.`

## Toasts (JS)
- `Address copied.` · `Lease link copied.` · `Saved to Keyring.` · `Card downloaded.` · `Lease signed.` · `Lease recorded on-chain.` + `View transaction` · `Wallet connected.` · `Wallet disconnected.` · `Import complete: {n} keys.` · `That file isn't a keyring export.`

## Alerts (Telegram, from Actions)
- `📄 NEW LEASE · {ticker} · {term}-day term · {url}`
- `🟢 LEASE RENEWED · {ticker} · {term}/{term} days, every clause kept · {url}`
- `🔴 EVICTION NOTICE · {ticker} · {clauseShort} · {url}`

## 404
- H1: Room *not found.*
- Body: `This door isn't on any floor plan.` · button `Back to the lobby`

## Error boundary
- `Paper jam.` · `Something broke on our side. Your wallet is untouched.` · button `Reload the office`

## Footer
- Line: `The Leasing Office for Solana coins. Holders get the truth. Devs get trust. Everyone gets receipts.`
- Last round (JS): `Last office round: {time}`
- **Risk line:** Not financial advice. Meme coins can lose all their value. Only trust the contract address posted on the official LEASE X account.
- `© LEASE OFFICE`
