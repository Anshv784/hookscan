import type { Metadata } from "next";
import { SectionHead } from "@/components/ui";

export const metadata: Metadata = { title: "API — HookScan" };

const BASE = "https://hookscan.anshverma.tech";

export default function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SectionHead kicker="For terminals, bots and agents" title="HookScan API">
        Jupiter won&apos;t route DBC transfer-hook coins. These endpoints let any terminal check a hook coin and trade the ones that let
        outsiders in, with the hook&apos;s accounts resolved for the real wallet. No key needed.
      </SectionHead>

      <Endpoint
        method="GET"
        path="/api/scan/{mint or pool}"
        desc="Fresh scan of one coin: the hook's rules, who can change them, and live buy, sell and transfer tests against mainnet. Cached 30s."
      >
        {`curl ${BASE}/api/scan/<MINT>

{
  "status": "open" | "pad-only" | "sell-blocked" | "broken" | "graduated" | "complete" | "untested",
  "headline": "Outside wallets can't buy. The hook says: \\"FOMO_REQUIRED: ...\\"",
  "tests": {
    "buy":      { "ran": true, "ok": false, "reason": "...", "blockedByHook": true },
    "sell":     { "ran": true, "ok": true, "sdkOk": false, "sdkReason": "..." },
    "transfer": { "ran": true, "ok": true }
  },
  "flags": [{ "level": "danger", "text": "The coin's creator holds the hook's upgrade key ..." }],
  "hook": { "program": "...", "upgradeable": true, "upgradeAuthority": "...", "rules": ["..."], "instructions": ["UnlockSells"] },
  "mint": { "mintAuthority": null, "freezeAuthority": null, "permanentDelegate": null, ... },
  "jupiter": { "routable": false, "reason": "TOKEN_NOT_TRADABLE" }
}`}
      </Endpoint>

      <Endpoint
        method="POST"
        path="/api/swap"
        desc="Builds a swap2_with_transfer_hook transaction for a wallet, simulates it for that wallet, and returns it unsigned with the simulated output and a slippage-protected minimum. If the hook would refuse the trade you get the reason instead of a transaction."
      >
        {`curl -X POST ${BASE}/api/swap -H 'content-type: application/json' -d '{
  "mint": "<MINT>",            // or "pool"
  "owner": "<WALLET>",
  "side": "buy",               // "buy" | "sell"
  "amount": "50000000",        // lamports when buying, raw token units when selling
  "slippageBps": 300
}'

{ "ok": true, "transaction": "<base64 v0 tx>", "expectedOut": "1234567", "minimumOut": "1197530", "reason": null }`}
      </Endpoint>

      <Endpoint
        method="POST"
        path="/api/send"
        desc="Relays a wallet-signed transaction and waits for confirmation. Optional; you can send the signed transaction through your own RPC."
      >
        {`{ "tx": "<base64 signed tx>" }  ->  { "signature": "..." }`}
      </Endpoint>

      <Endpoint
        method="GET"
        path="/api/snapshot"
        desc="The latest census: every DBC transfer-hook pool on mainnet, every hook program with its rules and upgrade key, and live test results for the busiest coins of each hook."
      >
        {`curl ${BASE}/api/snapshot | jq '.totals'`}
      </Endpoint>

      <section className="mt-12 rounded-lg border border-amber/30 bg-amber/5 p-5 text-sm leading-relaxed text-ink-2">
        <h3 className="font-medium text-ink">Why trades built with the Meteora SDK can fail</h3>
        <p className="mt-2">
          <code className="num text-ink">swap2WithTransferHook</code> in{" "}
          <code className="num text-ink">@meteora-ag/dynamic-bonding-curve-sdk</code> resolves the hook&apos;s extra accounts by calling{" "}
          <code className="num text-ink">createTransferCheckedWithTransferHookInstruction</code> with{" "}
          <code className="num text-ink">PublicKey.default</code> as source, destination and owner. A hook whose extra accounts are seeded
          by the wallet (per-wallet records, allowlists, cooldowns) then receives the wrong accounts and fails. HookScan resolves them for
          the real transfer: base vault → buyer with the DBC pool authority on buys, seller → base vault with the seller on sells.
        </p>
      </section>
    </div>
  );
}

function Endpoint({ method, path, desc, children }: { method: string; path: string; desc: string; children: string }) {
  return (
    <section className="mt-10">
      <h3 className="num flex items-center gap-3 text-sm">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${method === "GET" ? "bg-green-bg text-green" : "bg-amber/10 text-amber"}`}
        >
          {method}
        </span>
        <span className="text-ink">{path}</span>
      </h3>
      <p className="mt-2 text-sm text-ink-2">{desc}</p>
      <pre className="num mt-3 overflow-x-auto rounded-lg border border-line bg-panel p-4 text-[12px] leading-relaxed text-ink-2">
        {children}
      </pre>
    </section>
  );
}
