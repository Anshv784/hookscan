# HookScan

**Read the rules before you buy.** HookScan scans every Meteora Dynamic Bonding Curve pool whose token has a Token-2022 transfer hook, tells you what that hook will and won't let you do, and trades the ones that let outsiders in.

Live: https://hookscan.anshverma.tech · API: https://hookscan.anshverma.tech/docs

## Why

DBC v0.2.0 added `TransferHookPool`s: while a coin is on the curve, a program chosen by the launchpad runs on every transfer. Launchpads use it to decide who may buy, when holders may sell and where tokens may go. The census on mainnet (2026-10-08, 5,538 pools, 190 hook programs) shows what that means for a trader:

- **Jupiter can't trade them.** On the curve, Jupiter answers `TOKEN_NOT_TRADABLE`. The only way in is the app that launched the coin.
- **The rules are invisible.** Fomo's hook refuses every buyer who isn't using Fomo. SPEC.fun's hook can lock sells until an unlock time, cap wallets, enforce cooldowns and blocklist receivers. Another pad's hook only moves tokens in a transaction the pad co-signed. None of this shows up on a chart.
- **The rules can change after you buy.** 89% of live hook coins sit on upgradeable hook programs. One key controls both Fomo's and SPEC.fun's hooks.
- **Some coins can never move again.** 72 hook programs were closed by their owners. A hook can't be replaced while a coin is on the curve, and DBC has no way to return curve reserves before the curve completes, so 349 coins are frozen with 245 SOL inside them. In total 524 live coins sit behind hooks that are closed or crash on every transfer.
- **Meteora's SDK can't sell some of them.** `swap2WithTransferHook` resolves the hook's extra accounts with `PublicKey.default` as source, destination and owner. Any hook that derives accounts from the wallet then gets the wrong accounts, or the SDK can't build the transaction at all. HookScan resolves them for the real transfer.

## What it does

For every DBC transfer-hook pool on mainnet:

1. **Reads the hook.** Upgradeability, upgrade authority and last deploy slot from the BPF loader; the rule messages compiled into the program's ELF; error messages and admin instructions from its on-chain Anchor IDL when one is published.
2. **Reads the mint.** Mint and freeze authority, permanent delegate, pausable, transfer fee, default-frozen accounts, and whether the hook authority is DBC's pool authority (revoked at graduation) or someone else.
3. **Tests it live.** Three mainnet simulations with signature checks off, so nothing is sent:
   - an outside wallet buys on the curve (0.01 SOL, then 0.25 SOL if a minimum-size rule refused the first);
   - the largest real holder sells 10% of their bag, built both with HookScan's resolver and with the SDK's, so the difference is visible;
   - that holder sends tokens to a brand-new wallet.
4. **Gives a verdict.** `open`, `pad-only`, `sell-blocked`, `broken` (frozen), `complete` or `graduated`, with the hook's own words as the reason.
5. **Trades the open ones.** `/api/swap` builds a `swap2_with_transfer_hook` transaction for your wallet, simulates it for your wallet, and only returns it if it goes through, with a slippage-protected minimum out. Your wallet signs it.

## Meteora integration

| Piece | How HookScan uses it |
| --- | --- |
| DBC `TransferHookPool` | Census via `getProgramAccounts` on the account discriminator; PoolState decoded by offset |
| DBC `ConfigWithTransferHook` | Decoded through the SDK's Anchor coder for quote mint and migration threshold (curve progress) |
| DBC `swap2_with_transfer_hook` | Built with `TransferHookAccountsInfo` slices and correctly resolved hook accounts, for both the tests and real trades |
| DBC pool authority | Identified as the hook authority on curve-phase mints, so the scanner knows the hook is revoked at graduation |
| `@meteora-ag/dynamic-bonding-curve-sdk` | Program, coder and state readers; its own hook resolution is reproduced to show where it fails |

## API

No key needed. See [/docs](https://hookscan.anshverma.tech/docs).

```
GET  /api/scan/{mint|pool}   fresh scan of one coin
POST /api/swap               { mint, owner, side, amount, slippageBps } -> simulated, unsigned v0 tx
POST /api/send               relay a signed tx
GET  /api/snapshot           the full census
```

## Run it

```bash
npm install
echo 'RPC_URL=https://mainnet.helius-rpc.com/?api-key=...' > .env.local
bun scripts/index.ts      # writes data/snapshot.json (about 30 min on a free RPC tier)
npm run dev
```

A manually triggered GitHub Action (Actions → census → Run workflow) reruns the census and commits the snapshot.

## Layout

```
src/lib/core/       scanner: pool layout, mint facts, hook program reader, swap builder, simulations, verdicts
scripts/index.ts    mainnet census -> data/snapshot.json
src/app/            Next.js site and API routes
```
