import type { Metadata } from "next";
import { C, Callout, DocTitle, H2, P, Table } from "@/components/docs/ui";

export const metadata: Metadata = { title: "Verdicts" };

export default function Verdicts() {
  return (
    <>
      <DocTitle
        eyebrow="Overview"
        title="Verdicts"
        lead="Every coin gets one verdict, decided from the live tests, with the hook's own message as the reason."
      />
      <H2 id="list">The six verdicts</H2>
      <Table
        head={["Verdict", "Means", "Decided when"]}
        rows={[
          [
            "Open",
            "Anyone can buy, and a real holder can sell.",
            "The outside buy passes and the holder sell passes (or no holder exists yet).",
          ],
          [
            "Gated",
            "The hook refuses outside buyers.",
            "The outside buy is refused by the hook itself, for example a launchpad co-signature, an allowlist or trading hours.",
          ],
          [
            "Sell blocked",
            "A real holder can't sell right now.",
            "The buy passes but the hook refuses the largest holder's sell: a sell lock, a cooldown, a sell cap.",
          ],
          [
            "Frozen",
            "Nothing moves.",
            "The hook program was closed, or every test fails with a crash or runtime error rather than a rule.",
          ],
          ["Migrating", "The curve is full.", "The pool completed and is waiting to migrate to DAMM v2."],
          ["Graduated", "The hook is gone.", "The pool migrated; DBC revoked the hook and the coin trades on DAMM v2 (Jupiter routes it)."],
        ]}
      />
      <H2 id="rule-vs-crash">Rule refusals vs failures</H2>
      <P>
        A refusal counts against a coin as a rule only when the hook program itself failed the transaction with a message its author wrote.
        Runtime failures (<C>Unsupported program id</C> from a closed program, panics, missing accounts) are treated as a broken hook, which
        is why &quot;Frozen&quot; and &quot;Gated&quot; are separate.
      </P>
      <H2 id="minimum">Minimum buys</H2>
      <P>
        Some hooks refuse small buys (&quot;below the minimum to open a new wallet slot&quot;). If 0.01 SOL is refused, the test retries
        with 0.25 SOL before calling the coin Gated, and reports both.
      </P>
      <H2 id="flags">Flags</H2>
      <P>Independent of the verdict, a coin page lists what else can happen to your tokens:</P>
      <Table
        head={["Flag", "Why it matters"]}
        rows={[
          ["Mint authority", "More supply can be printed."],
          ["Freeze authority", "Your token account can be frozen."],
          ["Permanent delegate", "Tokens can be moved out of any wallet."],
          ["Upgradeable hook", "The rules can be rewritten; flagged red when the coin's creator holds the key."],
          ["Recent redeploy", "The hook's code changed in the last three days."],
          ["Admin instructions", "The hook exposes controls like UnlockSells or AddTrader."],
        ]}
      />
      <Callout title="Hook verdicts vs coin verdicts">
        Tables show the verdict of a coin&apos;s hook program, taken from its busiest coins. Hooks like SPEC.fun configure rules per coin,
        so open the coin for its own scan before trading.
      </Callout>
    </>
  );
}
