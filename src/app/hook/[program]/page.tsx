import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Addr, Progress, SectionHead, StatusChip, short, sol } from "@/components/ui";
import { dominantStatus, hookByProgram, hookLabel, snapshot } from "@/lib/data";
import type { Status } from "@/lib/core/scan";

export async function generateMetadata(props: PageProps<"/hook/[program]">): Promise<Metadata> {
  const { program } = await props.params;
  return { title: `${hookLabel(program) ?? short(program)} hook — HookScan` };
}

export default function HookPage(props: PageProps<"/hook/[program]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-7xl px-4 py-8 sm:px-6" />}>
      <Hook params={props.params} />
    </Suspense>
  );
}

async function Hook({ params }: { params: PageProps<"/hook/[program]">["params"] }) {
  const { program } = await params;
  const h = hookByProgram.get(program);
  if (!h) notFound();
  const f = h.facts;
  const coins = snapshot.coins.filter((c) => c.hook === program).sort((a, b) => (BigInt(b.quoteReserve) > BigInt(a.quoteReserve) ? 1 : -1));
  const daysAgo = f?.lastDeploySlot ? (snapshot.slot - f.lastDeploySlot) / 216_000 : null;
  const sameKey = snapshot.hooks.filter(
    (o) => o.program !== program && f?.upgradeAuthority && o.facts?.upgradeAuthority === f.upgradeAuthority,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-xs text-ink-3">
        <Link href="/#rules" className="hover:text-ink">
          Hooks
        </Link>{" "}
        <span aria-hidden>/</span> <span className="num">{short(program, 6)}</span>
      </nav>

      <header className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{hookLabel(program) ?? "Unnamed hook"}</h1>
          <StatusChip status={dominantStatus(h) as Status} size="lg" />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          program <Addr value={program} n={8} />
        </p>
      </header>

      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Cell k="Coins" v={h.pools.toLocaleString("en-US")} sub={`${h.phases.curve} on curve · ${h.phases.graduated} graduated`} />
        <Cell k="Creators" v={h.creators.toLocaleString("en-US")} sub={`${h.withMintAuthority} coins with a live mint authority`} />
        <Cell
          k="Who can rewrite the rules"
          v={!f?.exists ? "program missing" : f.upgradeable ? short(f.upgradeAuthority!) : "nobody"}
          sub={
            f?.upgradeable
              ? h.creatorIsUpgradeAuthority
                ? `creator of ${h.creatorIsUpgradeAuthority} of these coins`
                : "upgrade authority"
              : "immutable program"
          }
          tone={f?.upgradeable ? "text-amber" : "text-green"}
        />
        <Cell
          k="Last deployed"
          v={daysAgo === null ? "—" : daysAgo < 1 ? `${Math.round(daysAgo * 24)}h ago` : `${Math.round(daysAgo)}d ago`}
          sub={f?.lastDeploySlot ? `slot ${f.lastDeploySlot.toLocaleString("en-US")}` : ""}
        />
      </div>
      {sameKey.length > 0 && (
        <p className="mt-3 text-sm text-amber">
          The same upgrade key also controls{" "}
          {sameKey.map((o, i) => (
            <span key={o.program}>
              {i > 0 && ", "}
              <Link className="underline" href={`/hook/${o.program}`}>
                {hookLabel(o.program) ?? short(o.program)}
              </Link>{" "}
              ({o.pools} coins)
            </span>
          ))}
          .
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead kicker="From the deployed code" title="Rules this hook can enforce">
            Messages compiled into the program{f?.hasIdl ? " and error messages from its published IDL" : ""}. They show what the hook is
            able to refuse, not which rules a given coin turned on.
          </SectionHead>
          {f?.rules.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {f.rules.map((r) => (
                <li key={r} className="px-4 py-2 font-mono text-[12.5px] text-ink-2">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-line p-4 text-sm text-ink-3">
              No readable messages. The hook only returns numeric error codes.
            </p>
          )}
          {f && f.instructions.length > 0 && (
            <p className="mt-3 text-xs text-ink-3">
              Admin instructions:{" "}
              {f.instructions.map((i) => (
                <code key={i} className="num mr-1.5 rounded bg-panel-2 px-1.5 py-0.5 text-ink-2">
                  {i}
                </code>
              ))}
            </p>
          )}
        </section>

        <section>
          <SectionHead kicker="Live tests" title="What happened on its busiest coins">
            A buy from an outside wallet, a sell by the largest real holder and a wallet-to-wallet transfer, simulated on mainnet.
          </SectionHead>
          {h.samples.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {h.samples.map((s) => (
                <li key={s.pool} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/coin/${s.mint}`} className="font-medium hover:text-amber">
                      {s.symbol ?? short(s.mint)}
                    </Link>
                    <StatusChip status={s.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{s.headline}</p>
                  <p className="num mt-1.5 text-[11px] text-ink-3">
                    buy {s.tests.buy.ran ? (s.tests.buy.ok ? "pass" : "fail") : "—"} · sell{" "}
                    {s.tests.sell.ran ? (s.tests.sell.ok ? "pass" : "fail") : "—"} · transfer{" "}
                    {s.tests.transfer.ran ? (s.tests.transfer.ok ? "pass" : "fail") : "—"}
                    {s.tests.sell.sdkOk === false && <span className="text-amber"> · SDK sell fails</span>}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-line p-4 text-sm text-ink-3">No coin on this hook is on the curve right now.</p>
          )}
        </section>
      </div>

      <section className="mt-12">
        <SectionHead kicker="Coins" title={`Every coin on this hook (${coins.length})`} />
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-panel text-left text-[11px] uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Coin</th>
                <th className="px-4 py-2.5 font-medium">Phase</th>
                <th className="px-4 py-2.5 text-right font-medium">In curve</th>
                <th className="px-4 py-2.5 font-medium">To graduation</th>
                <th className="px-4 py-2.5 font-medium">Creator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coins.slice(0, 200).map((c) => (
                <tr key={c.pool} className="hover:bg-panel/60">
                  <td className="px-4 py-2">
                    <Link href={`/coin/${c.mint}`} className="hover:text-amber">
                      <span className="font-medium">{c.symbol || short(c.mint)}</span> <span className="text-xs text-ink-3">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{c.phase}</td>
                  <td className="num px-4 py-2 text-right">
                    {c.quoteMint === "So11111111111111111111111111111111111111112" ? `${sol(c.quoteReserve)} SOL` : "non-SOL"}
                  </td>
                  <td className="px-4 py-2">
                    <Progress value={c.progress} />
                  </td>
                  <td className="px-4 py-2">
                    <Addr value={c.creator} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {coins.length > 200 && (
          <p className="mt-2 text-xs text-ink-3">
            Showing the 200 with the most SOL. The full list is in{" "}
            <Link className="underline" href="/api/snapshot">
              /api/snapshot
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function Cell({ k, v, sub, tone = "text-ink" }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-3">{k}</div>
      <div className={`num mt-1 text-xl ${tone}`}>{v}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function generateStaticParams() {
  return snapshot.hooks
    .filter((h) => h.program !== "revoked")
    .slice(0, 40)
    .map((h) => ({ program: h.program }));
}
