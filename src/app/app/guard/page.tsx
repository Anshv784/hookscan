import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Check, X } from "lucide-react";
import { PageHeader } from "@/components/app/shell";
import { VerdictLookup } from "@/components/app/verdict-lookup";
import { HOOKGUARD_DEVNET, REPO } from "@/components/site/brand";

export const metadata: Metadata = { title: "Guard" };

const RUN: [boolean, string, string][] = [
  [true, "set_verdict(open)", "pins deploy slot 453,436,681 and upgrade key DXFq…yUNq"],
  [true, "guarded buy, 0.1 SOL", "assert_hook + swap2_with_transfer_hook"],
  [false, "hook redeployed → guarded buy", "HookChanged: whole transaction reverted"],
  [true, "hook redeployed → unguarded buy", "goes through on rules nobody tested"],
  [true, "re-attested → guarded buy", "trades again on the new build"],
];

export default function GuardPage() {
  return (
    <>
      <PageHeader
        title="Guard"
        description="hookguard is our on-chain program. A verdict is pinned to the exact build of a hook, and one instruction in your swap reverts the trade if the hook changed since it was tested."
      >
        <a
          href={HOOKGUARD_DEVNET}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 text-sm hover:bg-muted"
        >
          Program on devnet <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "1",
            "Attest",
            "set_verdict reads the hook's programdata deploy slot and upgrade key from the BPF loader and stores them with the verdict. The attester can't fake them.",
          ],
          [
            "2",
            "Assert in the swap",
            "assert_hook goes in the same transaction as swap2_with_transfer_hook, with the attester you trust and the verdicts you accept.",
          ],
          [
            "3",
            "Revert on change",
            "If the hook was redeployed, its upgrade key changed, it was closed, or the verdict isn't one you accept, the whole trade fails before anything moves.",
          ],
        ].map(([n, t, b]) => (
          <div key={n} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
            <span className="font-mono text-xs text-primary">0{n}</span>
            <h2 className="font-medium">{t}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{b}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-medium">Tested on a fork of mainnet, real SPEC.fun pool</h2>
          <a
            href={`${REPO}/blob/main/docs/hookguard-fork-run.txt`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            full log ↗
          </a>
        </div>
        <ul className="divide-y divide-border">
          {RUN.map(([ok, what, detail]) => (
            <li key={what} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-green-bg text-green" : "bg-red-bg text-red"}`}
              >
                {ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{what}</span>
                <span className="font-mono text-xs text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 font-medium">Read a verdict on devnet</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Prefilled with a live verdict. It compares the pinned deploy slot with the hook&apos;s current one, exactly as assert_hook does.
        </p>
        <VerdictLookup attester="9Sg12k15Ann4SKSxcA85bq5fbpq7WMLH9bLCTUbTRkQV" hook="VWHcbCSH4kATcuPJgjZ6QC56W3NBQ53U6fxJNtGknh3" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-5 font-mono text-[12.5px] leading-6 text-ink-2">{`import { assertHookIx } from "@/lib/core/guard";

const tx = new Transaction().add(
  assertHookIx(attester, hook, programData, ["open"]),
  ...swapIxs, // swap2_with_transfer_hook
);`}</pre>
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">Program</span>{" "}
            <span className="font-mono text-xs">C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv</span>
          </p>
          <p>26 KB, written in Rust with Pinocchio. 14 tests run the compiled program in Mollusk.</p>
          <Link href="/docs/hookguard" className="text-primary hover:underline">
            Read the hookguard docs →
          </Link>
        </div>
      </section>
    </>
  );
}
