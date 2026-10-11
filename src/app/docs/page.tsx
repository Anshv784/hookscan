import Link from "next/link";
import { C, Callout, DocTitle, H2, List, P, Table } from "@/components/docs/ui";
import { closedHooks, generatedLabel, snapshot, upgradeablePct } from "@/lib/data";

export default function Intro() {
  const t = snapshot.totals;
  const closed = closedHooks();
  return (
    <>
      <DocTitle
        eyebrow="Introduction"
        title="HookScan"
        lead="Reads the rules every Meteora DBC transfer-hook coin enforces, tests them against mainnet, trades the coins that let outsiders in, and guards the trade on-chain."
      />
      <H2 id="problem">The problem</H2>
      <P>
        Meteora&apos;s Dynamic Bonding Curve (DBC) v0.2.0 added <C>TransferHookPool</C>s. While a coin is on its bonding curve, a Token-2022
        transfer hook chosen by the launchpad runs on <strong>every</strong> transfer and can refuse it. Launchpads use that to decide who
        may buy, when holders may sell and where tokens may go. DBC revokes the hook when the coin graduates to DAMM v2.
      </P>
      <P>For a trader, that means three things a chart never shows:</P>
      <List>
        <li>
          <strong>Jupiter can&apos;t trade them.</strong> On the curve, Jupiter answers <C>TOKEN_NOT_TRADABLE</C>. That is{" "}
          {t.curve.toLocaleString("en-US")} coins right now.
        </li>
        <li>
          <strong>The rules are invisible and can change.</strong> {upgradeablePct()}% of live hook coins sit on programs whose owner can
          redeploy them with new rules at any time.
        </li>
        <li>
          <strong>Some coins can never move.</strong> {closed.hooks} hook programs were closed, freezing {closed.coins} coins and{" "}
          {closed.sol} SOL in their curves for good.
        </li>
      </List>
      <H2 id="what">What HookScan does</H2>
      <Table
        head={["Part", "What it does", "Where"]}
        rows={[
          [
            "Census",
            "Indexes every DBC transfer-hook pool, its mint, hook program, rules and upgrade key, and live-tests the busiest coins of each hook.",
            <Link key="a" href="/app" className="text-primary">
              App · Overview
            </Link>,
          ],
          [
            "Scanner",
            "Fresh scan of one coin: reads its hook and simulates an outside buy, a real holder's sell and a transfer on mainnet.",
            <Link key="b" href="/app/coins" className="text-primary">
              App · Coins
            </Link>,
          ],
          [
            "Trading",
            "Builds swap2_with_transfer_hook with the hook's accounts resolved for your wallet, simulates it for you, then you sign.",
            "Any open coin's page",
          ],
          [
            "hookguard",
            "On-chain program: one instruction in a swap reverts it if the hook changed after it was attested.",
            <Link key="c" href="/app/guard" className="text-primary">
              App · Guard
            </Link>,
          ],
          [
            "API",
            "Scan, swap and census endpoints for terminals, bots and agents. No key.",
            <Link key="d" href="/docs/api" className="text-primary">
              API docs
            </Link>,
          ],
        ]}
      />
      <Callout title="Data freshness">
        The census numbers in the app are from {generatedLabel()} UTC. Every coin page runs its own scan when you open it, so a single coin
        is always current.
      </Callout>
    </>
  );
}
