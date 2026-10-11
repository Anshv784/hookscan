import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/shell";
import { SearchBox } from "@/components/search-box";
import { Progress, STATUS, StatusChip, short, sol } from "@/components/ui";
import { closedHooks, dominantStatus, generatedLabel, hookByProgram, hookLabel, snapshot, upgradeablePct } from "@/lib/data";
import type { Status } from "@/lib/core/scan";

const SLOTS_PER_DAY = 216_000;
const ORDER = ["open", "pad-only", "sell-blocked", "broken", "untested"] as const;
const BAR: Record<string, string> = {
  open: "bg-green",
  "pad-only": "bg-amber",
  "sell-blocked": "bg-red",
  broken: "bg-red/50",
  untested: "bg-ink-3/40",
};

export default function Overview() {
  const t = snapshot.totals;
  const by = t.curvePoolsByStatus;
  const total = ORDER.reduce((n, s) => n + by[s], 0) || 1;
  const closed = closedHooks();
  const hooks = snapshot.hooks.filter((h) => h.program !== "revoked");
  const recent = hooks
    .filter((h) => h.facts?.lastDeploySlot && snapshot.slot - h.facts.lastDeploySlot < 3 * SLOTS_PER_DAY)
    .sort((a, b) => (b.facts!.lastDeploySlot ?? 0) - (a.facts!.lastDeploySlot ?? 0));
  const busiest = snapshot.coins
    .filter((c) => c.phase === "curve")
    .sort((a, b) => (BigInt(b.quoteReserve) > BigInt(a.quoteReserve) ? 1 : -1))
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Every Meteora DBC transfer-hook pool on Solana mainnet. Census of ${generatedLabel()} UTC, slot ${snapshot.slot.toLocaleString("en-US")}.`}
      />

      <div className="rounded-2xl border border-border bg-[radial-gradient(80%_140%_at_0%_0%,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card))] p-6">
        <p className="mb-1 font-medium">Scan a coin</p>
        <p className="mb-4 text-sm text-muted-foreground">
          Paste a mint or pool. We read its hook and test a buy, a holder&apos;s sell and a transfer on mainnet, live.
        </p>
        <div className="max-w-xl">
          <SearchBox />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
        <Tile value={t.pools.toLocaleString("en-US")} label="hook coins" sub={`${t.graduated} graduated, hook revoked`} />
        <Tile value={t.curve.toLocaleString("en-US")} label="on the curve" sub="Jupiter can't route these" />
        <Tile
          value={`${upgradeablePct()}%`}
          label="on rewritable hooks"
          sub={`${t.upgradeableHookPrograms} of ${t.hookPrograms} programs upgradeable`}
          tone="text-primary"
        />
        <Tile
          value={`${closed.sol} SOL`}
          label="frozen for good"
          sub={`${closed.coins} coins on ${closed.hooks} closed hooks`}
          tone="text-red"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Verdicts for coins on the curve</h2>
          <span className="font-mono text-sm text-muted-foreground">{total.toLocaleString("en-US")}</span>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-border" aria-hidden>
          {ORDER.map((s) => (
            <span key={s} className={BAR[s]} style={{ width: `${(by[s] / total) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <StatusChip status={s as Status} />
                <span className="text-xs text-muted-foreground">{STATUS[s].blurb}</span>
              </span>
              <Link href={`/app/coins?status=${s}`} className="font-mono hover:text-primary">
                {by[s].toLocaleString("en-US")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Biggest hook programs" href="/app/hooks" more="All hooks">
          <ul className="divide-y divide-border">
            {hooks.slice(0, 8).map((h) => (
              <li key={h.program}>
                <Link href={`/app/hooks/${h.program}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{hookLabel(h.program) ?? "unnamed hook"}</span>
                    <span className="font-mono text-[11px] text-ink-3">{short(h.program)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{h.pools.toLocaleString("en-US")}</span>
                    <StatusChip status={dominantStatus(h) as Status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Busiest coins on the curve" href="/app/coins" more="All coins">
          <ul className="divide-y divide-border">
            {busiest.map((c) => {
              const h = hookByProgram.get(c.hook);
              return (
                <li key={c.pool}>
                  <Link href={`/app/coin/${c.mint}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{c.symbol || short(c.mint)}</span>
                      <span className="truncate text-[11px] text-ink-3">{hookLabel(c.hook) ?? short(c.hook)}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="hidden sm:block">
                        <Progress value={c.progress} />
                      </span>
                      <span className="w-24 text-right font-mono text-sm">
                        {c.quoteMint === "So11111111111111111111111111111111111111112" ? `${sol(c.quoteReserve)} SOL` : "non-SOL"}
                      </span>
                      {h && <StatusChip status={dominantStatus(h) as Status} />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {recent.length > 0 && (
        <Card title="Rules rewritten in the last 3 days" href="/app/hooks" more="All hooks">
          <ul className="divide-y divide-border">
            {recent.slice(0, 8).map((h) => (
              <li key={h.program}>
                <Link href={`/app/hooks/${h.program}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                  <span className="font-medium">{hookLabel(h.program) ?? short(h.program)}</span>
                  <span className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{h.pools} coins</span>
                    <span className="font-mono">
                      {Math.max(1, Math.round(((snapshot.slot - h.facts!.lastDeploySlot!) / SLOTS_PER_DAY) * 24))}h ago
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Tile({ value, label, sub, tone = "text-foreground" }: { value: string; label: string; sub: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className={`text-2xl font-medium tabular-nums ${tone}`}>{value}</span>
      <span className="text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function Card({ title, href, more, children }: { title: string; href: string; more: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="font-medium">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {more} <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}
