import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell";
import { Progress, STATUS, StatusChip, short, sol } from "@/components/ui";
import { dominantStatus, hookByProgram, hookLabel, snapshot } from "@/lib/data";
import type { Status } from "@/lib/core/scan";

export const metadata: Metadata = { title: "Coins" };

const PAGE = 50;
const SOL = "So11111111111111111111111111111111111111112";
const FILTERS = ["all", "open", "pad-only", "sell-blocked", "broken", "graduated"] as const;

export default function CoinsPage(props: PageProps<"/app/coins">) {
  return (
    <>
      <PageHeader
        title="Coins"
        description="Every coin with a transfer hook on Meteora DBC. The verdict shown is its hook program's; open a coin to scan that coin live."
      />
      <Suspense fallback={<div className="h-96 rounded-2xl border border-border bg-card" />}>
        <CoinTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function statusOf(c: (typeof snapshot.coins)[number]): Status | "graduated" {
  if (c.phase === "graduated") return "graduated";
  const h = hookByProgram.get(c.hook);
  return (h ? dominantStatus(h) : "untested") as Status;
}

async function CoinTable({ searchParams }: { searchParams: PageProps<"/app/coins">["searchParams"] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const status = typeof sp.status === "string" && (FILTERS as readonly string[]).includes(sp.status) ? sp.status : "all";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  const rows = snapshot.coins
    .filter((c) => status === "all" || statusOf(c) === status)
    .filter(
      (c) =>
        !q ||
        c.mint.toLowerCase() === q ||
        c.pool.toLowerCase() === q ||
        (c.symbol ?? "").toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (hookLabel(c.hook) ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => (BigInt(b.quoteReserve) > BigInt(a.quoteReserve) ? 1 : -1));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const link = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({
      ...(q && { q }),
      ...(status !== "all" && { status }),
      ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])),
    });
    if (p.get("status") === "all") p.delete("status");
    if (p.get("page") === "1") p.delete("page");
    return `/app/coins${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search symbol, name, hook or mint"
          className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm outline-none placeholder:text-ink-3 focus:border-primary sm:max-w-sm"
        />
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card/60 p-1">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={link({ status: f, page: 1 })}
              className={`inline-flex h-8 items-center rounded-full px-3 text-xs transition-colors ${status === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f === "all" ? "All" : (STATUS[f as Status | "graduated"]?.label ?? f)}
            </Link>
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground sm:ml-auto">{rows.length.toLocaleString("en-US")} coins</span>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-card text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Coin</th>
              <th className="px-4 py-3 font-medium">Hook</th>
              <th className="px-4 py-3 text-right font-medium">In curve</th>
              <th className="px-4 py-3 font-medium">To graduation</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((c) => (
              <tr key={c.pool} className="hover:bg-card/60">
                <td className="px-4 py-2.5">
                  <Link href={`/app/coin/${c.mint}`} className="group flex flex-col">
                    <span className="font-medium group-hover:text-primary">{c.symbol || short(c.mint)}</span>
                    <span className="max-w-[16rem] truncate text-[11px] text-ink-3">{c.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {c.hook === "revoked" ? (
                    "revoked"
                  ) : (
                    <Link href={`/app/hooks/${c.hook}`} className="hover:text-foreground">
                      {hookLabel(c.hook) ?? short(c.hook)}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{c.quoteMint === SOL ? `${sol(c.quoteReserve)} SOL` : "non-SOL"}</td>
                <td className="px-4 py-2.5">
                  {c.phase === "graduated" ? <span className="text-xs text-ink-3">done</span> : <Progress value={c.progress} />}
                </td>
                <td className="px-4 py-2.5">
                  <StatusChip status={statusOf(c) as Status} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No coins match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={link({ page: page - 1 })} className="rounded-full border border-border px-4 py-1.5 hover:bg-muted">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={link({ page: page + 1 })} className="rounded-full border border-border px-4 py-1.5 hover:bg-muted">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
