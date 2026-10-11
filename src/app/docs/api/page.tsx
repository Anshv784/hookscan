import type { Metadata } from "next";
import { C, Code, DocTitle, H2, P, Table } from "@/components/docs/ui";

export const metadata: Metadata = { title: "API" };

const BASE = "https://hookscan.anshverma.tech";

export default function Api() {
  return (
    <>
      <DocTitle eyebrow="Developers" title="API" lead="For terminals, bots and agents. JSON over HTTPS, CORS open, no key." />
      <Table
        head={["Endpoint", "Does"]}
        rows={[
          [<C key="a">GET /api/scan/{"{mint|pool}"}</C>, "Fresh scan of one coin. Cached 30 s."],
          [<C key="b">POST /api/swap</C>, "Simulated, unsigned swap transaction for a wallet."],
          [<C key="c">POST /api/send</C>, "Relays a signed transaction and confirms it."],
          [<C key="d">GET /api/snapshot</C>, "The full census."],
        ]}
      />
      <H2 id="scan">GET /api/scan</H2>
      <Code lang="shell">{`curl ${BASE}/api/scan/<MINT>`}</Code>
      <Code lang="json">{`{
  "status": "open | pad-only | sell-blocked | broken | graduated | complete | untested",
  "headline": "Outside wallets can't buy. The hook says: \\"FOMO_REQUIRED: ...\\"",
  "tests": {
    "buy":      { "ran": true, "ok": false, "reason": "...", "blockedByHook": true },
    "sell":     { "ran": true, "ok": true, "sdkOk": false, "sdkReason": "..." },
    "transfer": { "ran": true, "ok": true }
  },
  "flags": [{ "level": "danger", "text": "..." }],
  "hook": { "program": "...", "upgradeable": true, "upgradeAuthority": "...", "lastDeploySlot": 453436681,
            "closed": false, "rules": ["..."], "instructions": ["UnlockSells"] },
  "mint": { "mintAuthority": null, "freezeAuthority": null, "permanentDelegate": null, "...": "..." },
  "jupiter": { "routable": false, "reason": "TOKEN_NOT_TRADABLE" }
}`}</Code>
      <P>
        <C>status</C> values map to the app&apos;s labels: <C>pad-only</C> is Gated, <C>broken</C> is Frozen. <C>sdkOk: false</C> means the
        same sell fails when built with Meteora&apos;s SDK.
      </P>
      <H2 id="swap">POST /api/swap</H2>
      <Code lang="shell">{`curl -X POST ${BASE}/api/swap -H 'content-type: application/json' -d '{
  "mint": "<MINT>",
  "owner": "<WALLET>",
  "side": "buy",
  "amount": "50000000",
  "slippageBps": 300
}'`}</Code>
      <P>
        <C>amount</C> is lamports when buying and raw token units when selling. The server simulates the swap for that exact wallet to learn
        the real output, sets <C>minimumAmountOut</C> from your slippage, adds a priority fee and returns the unsigned v0 transaction. If
        the hook would refuse the trade you get <C>{'"ok": false'}</C> and the reason instead.
      </P>
      <Code lang="json">{`{ "ok": true, "transaction": "<base64>", "expectedOut": "4302615449497", "minimumOut": "4173536986012",
  "outMint": "...", "outDecimals": 6, "reason": null }`}</Code>
      <H2 id="send">POST /api/send</H2>
      <Code lang="json">{`{ "tx": "<base64 signed transaction>" }  ->  { "signature": "..." }`}</Code>
      <H2 id="snapshot">GET /api/snapshot</H2>
      <P>
        Totals, every hook program with its facts, rules and sample tests, and every coin with its hook, phase, curve progress and
        authorities.
      </P>
      <Code lang="shell">{`curl -s ${BASE}/api/snapshot | jq '.totals'`}</Code>
    </>
  );
}
