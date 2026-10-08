import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { Addr, HookName, Progress, SectionHead, StatusChip, STATUS, short, sol } from "@/components/ui";
import { dominantStatus, hookByProgram, hookLabel, snapshot } from "@/lib/data";
import type { Status } from "@/lib/core/scan";

const SLOTS_PER_DAY = 216_000;

function age(slot: number | null) {
  if (!slot) return "—";
  const days = (snapshot.slot - slot) / SLOTS_PER_DAY;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h ago`;
  if (days < 60) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export default function Home() {
  const t = snapshot.totals;
  const hooks = snapshot.hooks.filter((h) => h.program !== "revoked");
  const by = t.curvePoolsByStatus;
  const curveTotal = Object.values(by).reduce((a, b) => a + b, 0) || 1;
  const upgradeablePct = Math.round((t.poolsOnUpgradeableHooks / Math.max(1, t.pools - t.graduated)) * 100);

  const samples = hooks.flatMap((h) => h.samples);
  const sdkBroken = samples.filter((s) => s.tests.sell.ok && s.tests.sell.sdkOk === false);
  const sdkBrokenHooks = new Set(
    hooks.filter((h) => h.samples.some((s) => s.tests.sell.ok && s.tests.sell.sdkOk === false)).map((h) => h.program),
  );
  const sdkBrokenPools = hooks.filter((h) => sdkBrokenHooks.has(h.program)).reduce((n, h) => n + h.phases.curve, 0);
  const sameKey = sharedKeys(hooks);

  const closed = hooks.filter((h) => h.facts?.closed || (h.facts && !h.facts.exists));
  const closedCoins = closed.reduce((n, h) => n + h.phases.curve, 0);
  const closedSet = new Set(closed.map((h) => h.program));
  const closedSol = snapshot.coins
    .filter((c) => closedSet.has(c.hook) && c.phase === "curve" && c.quoteMint === "So11111111111111111111111111111111111111112")
    .reduce((n, c) => n + BigInt(c.quoteReserve), 0n);
  const quotes = refusalQuotes(hooks);

  const topCoins = snapshot.coins
    .filter((c) => c.phase === "curve")
    .sort((a, b) => (BigInt(b.quoteReserve) > BigInt(a.quoteReserve) ? 1 : -1))
    .slice(0, 40);

  const generated = new Date(snapshot.generatedAt).toISOString().replace("T", " ").slice(0, 16);

  return (
    <>
      {/* Hero */}
      <section className="grid-paper border-b border-line">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:py-20">
          <div className="rise flex flex-col justify-center">
            <span className="num mb-5 text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Mainnet census · slot {snapshot.slot.toLocaleString("en-US")} · {generated} UTC
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
              <span className="tabular-nums text-amber">{t.pools.toLocaleString("en-US")}</span> Meteora coins run their own code on every
              transfer.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
              A transfer hook lets a launchpad decide who may buy, when you may sell and where your tokens may go. Jupiter won&apos;t route
              these coins. HookScan reads each hook&apos;s code, then tests a buy, a real holder&apos;s sell and a wallet-to-wallet transfer
              against mainnet, and trades the coins that pass.
            </p>
            <div className="mt-8 max-w-xl">
              <SearchBox />
            </div>
          </div>

          <div className="rise rounded-lg border border-line bg-panel/90 p-5 [animation-delay:80ms]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Coins on the curve right now</h2>
              <span className="num text-sm text-ink-2">{t.curve.toLocaleString("en-US")}</span>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              {(["open", "pad-only", "sell-blocked", "broken", "untested"] as const).map((s) => (
                <span key={s} className={barTone(s)} style={{ width: `${(by[s] / curveTotal) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 divide-y divide-line text-sm">
              {(["open", "pad-only", "sell-blocked", "broken", "untested"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-3">
                    <StatusChip status={s as Status} />
                    <span className="text-xs text-ink-3">{STATUS[s].blurb}</span>
                  </span>
                  <span className="num">{by[s].toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
              <Stat label="hook code can be rewritten" value={`${upgradeablePct}%`} tone="text-amber" />
              <Stat label="mint still open" value={t.withMintAuthority.toLocaleString("en-US")} tone="text-red" />
              <Stat label="graduated, hook gone" value={t.graduated.toLocaleString("en-US")} tone="text-blue" />
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              Verdicts come from live simulations on the busiest coins of each hook program. Open any coin for a fresh scan.
            </p>
          </div>
        </div>
      </section>

      {/* Hooks */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHead id="rules" kicker="Who sets the rules" title={`${hooks.length} hook programs, and what each one enforces`}>
          Each row is one program that every coin in it calls on every transfer. The quote is a rule we read out of its deployed code.
        </SectionHead>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-panel text-left text-[11px] uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Hook</th>
                <th className="px-4 py-2.5 text-right font-medium">Coins</th>
                <th className="px-4 py-2.5 font-medium">Verdict</th>
                <th className="px-4 py-2.5 font-medium">A rule from its code</th>
                <th className="px-4 py-2.5 font-medium">Who can rewrite it</th>
                <th className="px-4 py-2.5 text-right font-medium">Last deploy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hooks.slice(0, 30).map((h) => (
                <tr key={h.program} className="align-top hover:bg-panel/60">
                  <td className="px-4 py-3">
                    <HookName program={h.program} label={hookLabel(h.program)} />
                  </td>
                  <td className="num whitespace-nowrap px-4 py-3 text-right">
                    {h.pools.toLocaleString("en-US")}
                    <div className="text-[11px] text-ink-3">{h.phases.curve} live</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={dominantStatus(h) as Status} />
                  </td>
                  <td className="max-w-sm px-4 py-3 text-ink-2">
                    {pickRule(h.facts?.rules ?? []) ? (
                      <span className="line-clamp-2">&ldquo;{pickRule(h.facts?.rules ?? [])}&rdquo;</span>
                    ) : (
                      <span className="text-ink-3">No readable messages</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!h.facts?.exists ? (
                      <span className="text-red">program missing</span>
                    ) : !h.facts.upgradeable ? (
                      <span className="text-green">Nobody (immutable)</span>
                    ) : h.creatorIsUpgradeAuthority > 0 ? (
                      <span className="text-red">
                        The creator <Addr value={h.facts.upgradeAuthority!} />
                      </span>
                    ) : (
                      <Addr value={h.facts.upgradeAuthority!} />
                    )}
                    {(sameKey.get(h.facts?.upgradeAuthority ?? "")?.length ?? 0) > 1 ? (
                      <div className="text-[11px] text-ink-3">
                        same key controls {sameKey.get(h.facts!.upgradeAuthority!)!.length - 1} other hook
                        {sameKey.get(h.facts!.upgradeAuthority!)!.length > 2 ? "s" : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="num whitespace-nowrap px-4 py-3 text-right text-ink-2">{age(h.facts?.lastDeploySlot ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Coins */}
      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionHead id="coins" kicker="On the curve" title="The busiest hook coins right now">
            Ranked by SOL in the curve. The verdict is the hook&apos;s; open a coin to scan that coin specifically.
          </SectionHead>
          <div className="overflow-x-auto rounded-lg border border-line bg-bg">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-panel text-left text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Coin</th>
                  <th className="px-4 py-2.5 font-medium">Hook</th>
                  <th className="px-4 py-2.5 text-right font-medium">In curve</th>
                  <th className="px-4 py-2.5 font-medium">To graduation</th>
                  <th className="px-4 py-2.5 font-medium">Verdict</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topCoins.map((c) => {
                  const h = hookByProgram.get(c.hook);
                  const isSol = c.quoteMint === "So11111111111111111111111111111111111111112";
                  return (
                    <tr key={c.pool} className="hover:bg-panel/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/coin/${c.mint}`} className="group flex flex-col">
                          <span className="font-medium group-hover:text-amber">{c.symbol || short(c.mint)}</span>
                          <span className="max-w-[16rem] truncate text-[11px] text-ink-3">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{hookLabel(c.hook) ?? short(c.hook)}</td>
                      <td className="num px-4 py-2.5 text-right">{isSol ? `${sol(c.quoteReserve)} SOL` : "non-SOL"}</td>
                      <td className="px-4 py-2.5">
                        <Progress value={c.progress} />
                      </td>
                      <td className="px-4 py-2.5">{h && <StatusChip status={dominantStatus(h) as Status} />}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/coin/${c.mint}`} className="text-xs text-amber hover:underline">
                          Scan →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quotes */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <SectionHead kicker="In their own words" title="What the hooks told our test wallets">
          Each line is the exact message a hook returned when our simulated buyer, seller or sender was refused on mainnet.
        </SectionHead>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <li key={q.reason} className="flex flex-col justify-between gap-3 bg-bg p-4">
              <q className="font-mono text-[12.5px] leading-relaxed text-ink">{q.reason}</q>
              <span className="flex items-center justify-between text-[11px] text-ink-3">
                <Link href={`/hook/${q.program}`} className="hover:text-amber">
                  {hookLabel(q.program) ?? short(q.program)} · {q.coins.toLocaleString("en-US")} coins
                </Link>
                <span>refused a {q.test}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Findings */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHead id="findings" kicker="What the census found" title="What a trader can't see from a chart" />
        <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
          <Finding n={1} title="Jupiter can't trade them">
            While a coin is on the curve, Jupiter answers <code className="num text-ink">TOKEN_NOT_TRADABLE</code>. That is{" "}
            <b className="text-ink">{t.curve.toLocaleString("en-US")}</b> coins you can only reach through the app that launched them. The
            ones whose hooks let outsiders in, you can trade here.
          </Finding>
          <Finding n={2} title="The rules can change after you buy">
            <b className="text-ink">{t.upgradeableHookPrograms}</b> of {t.hookPrograms} hook programs are upgradeable, covering{" "}
            <b className="text-ink">{upgradeablePct}%</b> of live hook coins. Whoever holds the key can turn selling off tomorrow.
            {sameKey.size > 0 && <> One key controls {Math.max(...[...sameKey.values()].map((v) => v.length))} different hook programs.</>}
          </Finding>
          <Finding n={3} title="Meteora's SDK can't sell some of them">
            The SDK fills a hook&apos;s extra accounts with placeholder wallets. For hooks that keep per-wallet records, that sell fails. We
            resolve the accounts for the real wallet: in our tests <b className="text-ink">{sdkBroken.length}</b> holder sells failed with
            the SDK and passed with HookScan, across <b className="text-ink">{sdkBrokenPools.toLocaleString("en-US")}</b> live coins.
          </Finding>
          <Finding n={4} title="Some coins can never move again">
            {closed.length > 0 && (
              <>
                {closed.length} hook program{closed.length > 1 ? "s were" : " was"} closed by{" "}
                {closed.length > 1 ? "their owners" : "its owner"}. A hook can&apos;t be swapped while the coin is on the curve, so{" "}
                <b className="text-ink">{closedCoins.toLocaleString("en-US")}</b> coins and <b className="text-ink">{sol(closedSol)} SOL</b>{" "}
                in their curves are stuck for good.{" "}
              </>
            )}
            In total <b className="text-ink">{by.broken.toLocaleString("en-US")}</b> live coins sit behind hooks that are closed or crash on
            every transfer, and <b className="text-ink">{t.withMintAuthority.toLocaleString("en-US")}</b> coins still have a mint authority
            that can print more supply.
          </Finding>
        </ol>
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-panel px-2 py-3">
      <dd className={`num text-lg font-medium ${tone}`}>{value}</dd>
      <dt className="mt-0.5 text-[10px] leading-tight text-ink-3">{label}</dt>
    </div>
  );
}

function Finding({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 bg-bg p-6">
      <span className="num text-sm text-amber">0{n}</span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{children}</p>
      </div>
    </li>
  );
}

function barTone(s: string) {
  return { open: "bg-green", "pad-only": "bg-amber", "sell-blocked": "bg-red", broken: "bg-red/60", untested: "bg-ink-3/40" }[s] ?? "";
}

/** The most telling rule: prefer ones about selling, gating or co-signing. */
function pickRule(rules: string[]) {
  return rules.find((r) => /sell|co-?sign|only|requires|locked|blocklist/i.test(r)) ?? rules[0] ?? null;
}

/** One quote per distinct refusal, preferring hooks with the most coins. */
function refusalQuotes(hooks: typeof snapshot.hooks) {
  const seen = new Set<string>();
  const out: { reason: string; program: string; coins: number; test: string }[] = [];
  for (const h of [...hooks].sort((a, b) => b.pools - a.pools)) {
    for (const s of h.samples) {
      for (const [test, r] of [
        ["buy", s.tests.buy],
        ["sell", s.tests.sell],
        ["transfer", s.tests.transfer],
      ] as const) {
        if (!r.ran || r.ok || !r.blockedByHook || !r.reason) continue;
        if (/^custom program error|^Custom program error|panick|Unsupported program id|additional account keys|^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.reason))
          continue;
        const key = r.reason.replace(/\d+/g, "#").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ reason: r.reason, program: h.program, coins: h.pools, test });
      }
    }
  }
  return out.slice(0, 15);
}

function sharedKeys(hooks: typeof snapshot.hooks) {
  const m = new Map<string, string[]>();
  for (const h of hooks) {
    const k = h.facts?.upgradeable ? h.facts.upgradeAuthority : null;
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), h.program]);
  }
  return new Map([...m].filter(([, v]) => v.length > 1));
}
