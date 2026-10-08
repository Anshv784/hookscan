"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CoinReport, TestResult } from "@/lib/core/scan";
import type { SnapshotCoin } from "@/lib/snapshot";
import { Addr, LevelGlyph, LEVEL_TONE, StatusChip, short } from "./ui";
import { TradePanel } from "./trade-panel";

type Known = (SnapshotCoin & { hookLabel: string | null }) | null;

export function CoinView({ id, known }: { id: string; known: Known }) {
  const [report, setReport] = useState<CoinReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const [nonce, setNonce] = useState(0);

  // Each change of `nonce` runs one scan; state is only set from the async callbacks.
  useEffect(() => {
    let live = true;
    const t0 = performance.now();
    const tick = setInterval(() => live && setElapsed((performance.now() - t0) / 1000), 100);
    fetch(`/api/scan/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        if (live) {
          setReport(j);
          setError(null);
        }
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        clearInterval(tick);
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      clearInterval(tick);
    };
  }, [id, nonce]);

  function rescan() {
    setLoading(true);
    setElapsed(0);
    setNonce((n) => n + 1);
  }

  const symbol = report?.mint.symbol ?? known?.symbol ?? null;
  const name = report?.mint.name ?? known?.name ?? null;
  const mint = report?.mint.mint ?? known?.mint ?? id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-xs text-ink-3">
        <Link href="/" className="hover:text-ink">
          Census
        </Link>{" "}
        <span aria-hidden>/</span> <span className="num">{short(mint, 6)}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {symbol ?? "Unknown coin"}
            {name && <span className="ml-3 text-lg font-normal text-ink-3">{name}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
            <span>
              mint <Addr value={mint} kind="token" n={6} />
            </span>
            {(report?.pool.pool ?? known?.pool) && (
              <span>
                pool <Addr value={(report?.pool.pool ?? known?.pool)!} n={6} />
              </span>
            )}
            {(report?.hook?.program ?? (known?.hook !== "revoked" ? known?.hook : null)) && (
              <span>
                hook{" "}
                <Link
                  className="num text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
                  href={`/hook/${report?.hook?.program ?? known?.hook}`}
                >
                  {known?.hookLabel ?? report?.hook?.label ?? short((report?.hook?.program ?? known?.hook)!)}
                </Link>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={rescan}
          disabled={loading}
          className="h-9 rounded-md border border-line px-4 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          {loading ? `Scanning… ${elapsed.toFixed(1)}s` : "Rescan"}
        </button>
      </header>

      {error && (
        <div className="mt-6 rounded-lg border border-red/30 bg-red-bg p-5 text-sm">
          <p className="font-medium text-red">Couldn&apos;t scan this address</p>
          <p className="mt-1 text-ink-2">{error}</p>
        </div>
      )}

      {!report && loading && <ScanSkeleton />}

      {report && (
        <div className={`mt-6 grid gap-6 lg:grid-cols-[1fr_360px] ${loading ? "opacity-60" : ""} transition-opacity`}>
          <div className="flex min-w-0 flex-col gap-6">
            <Verdict report={report} />
            <Tests report={report} />
            {report.flags.length > 0 && <Flags report={report} />}
            {report.hook && <Rules report={report} />}
            <Facts report={report} />
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <TradePanel report={report} />
          </aside>
        </div>
      )}
    </div>
  );
}

function Verdict({ report }: { report: CoinReport }) {
  return (
    <section className="rise rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={report.status} size="lg" />
        <span className="num text-[11px] text-ink-3">
          slot {report.slot.toLocaleString("en-US")} · {new Date(report.scannedAt).toLocaleTimeString()} · Jupiter:{" "}
          {report.jupiter.routable ? `routes via ${report.jupiter.reason}` : report.jupiter.reason}
        </span>
      </div>
      <p className="mt-3 text-lg leading-snug">{report.headline}</p>
    </section>
  );
}

function TestRow({ title, sub, t }: { title: string; sub: string; t: TestResult }) {
  const state = !t.ran ? "skip" : t.ok ? "pass" : "fail";
  const tone = { pass: "text-green", fail: "text-red", skip: "text-ink-3" }[state];
  return (
    <li className="grid grid-cols-[72px_1fr] gap-4 px-5 py-4">
      <span className={`num text-xs font-medium uppercase tracking-wider ${tone}`}>{state}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-ink-3">{sub}</p>
        {t.reason && (
          <p className={`mt-2 break-words text-sm ${state === "fail" ? "text-ink" : "text-ink-2"}`}>
            {state === "fail" && t.blockedByHook && <span className="mr-1 text-ink-3">Hook says:</span>}
            {state === "fail" ? <q>{t.reason}</q> : t.reason}
          </p>
        )}
        {t.detail && <p className="num mt-1 text-xs text-ink-3">{t.detail}</p>}
        {t.sdkOk === false && (
          <p className="mt-2 rounded border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            The same sell built with Meteora&apos;s SDK fails
            {t.sdkReason ? (
              <>
                : <q>{t.sdkReason}</q>
              </>
            ) : (
              "."
            )}{" "}
            HookScan resolves the hook&apos;s accounts for this wallet, so it goes through.
          </p>
        )}
      </div>
    </li>
  );
}

function Tests({ report }: { report: CoinReport }) {
  const w = report.tests.sell.wallet;
  return (
    <section className="rounded-lg border border-line">
      <h2 className="border-b border-line px-5 py-3 text-sm font-medium">Live tests against mainnet</h2>
      <ul className="divide-y divide-line">
        <TestRow
          title="An outside wallet buys"
          sub="0.01 SOL on the curve from a wallet the launchpad has never seen"
          t={report.tests.buy}
        />
        <TestRow
          title="A real holder sells"
          sub={w ? `10% of the bag of ${short(w)}, the largest wallet holding it` : "10% of the largest holder's bag"}
          t={report.tests.sell}
        />
        <TestRow title="A holder sends tokens to another wallet" sub="Plain transfer to a brand-new wallet" t={report.tests.transfer} />
      </ul>
      <p className="border-t border-line px-5 py-2.5 text-[11px] text-ink-3">
        Simulated with signature checks off against the current chain state. Nothing was sent.
      </p>
    </section>
  );
}

function Flags({ report }: { report: CoinReport }) {
  return (
    <section className="rounded-lg border border-line">
      <h2 className="border-b border-line px-5 py-3 text-sm font-medium">What else can happen to your tokens</h2>
      <ul className="divide-y divide-line">
        {report.flags.map((f, i) => (
          <li key={i} className="flex gap-3 px-5 py-3 text-sm">
            <LevelGlyph level={f.level} />
            <span className={f.level === "good" ? LEVEL_TONE.good : "text-ink"}>{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Rules({ report }: { report: CoinReport }) {
  const h = report.hook!;
  return (
    <section className="rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-sm font-medium">Rules written into the hook&apos;s code</h2>
        <Link href={`/hook/${h.program}`} className="text-xs text-amber hover:underline">
          All coins on this hook →
        </Link>
      </div>
      {h.rules.length ? (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {h.rules.map((r) => (
            <li key={r} className="px-5 py-2 font-mono text-[12.5px] text-ink-2">
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-ink-3">The hook has no readable messages; it only returns numeric errors.</p>
      )}
      {h.instructions.length > 0 && (
        <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
          Admin instructions:{" "}
          {h.instructions.map((i) => (
            <code key={i} className="num mr-1.5 rounded bg-panel-2 px-1.5 py-0.5 text-ink-2">
              {i}
            </code>
          ))}
        </div>
      )}
    </section>
  );
}

function Facts({ report }: { report: CoinReport }) {
  const m = report.mint;
  const h = report.hook;
  const rows: [string, React.ReactNode][] = [
    [
      "Phase",
      report.pool.phase === "curve"
        ? "On the bonding curve"
        : report.pool.phase === "complete"
          ? "Curve full, migrating"
          : "Graduated to DAMM v2",
    ],
    ["Creator", <Addr key="c" value={report.pool.creator} />],
    ["Hook program", h ? <Addr key="h" value={h.program} /> : "None (revoked)"],
    ["Hook upgrade key", h ? h.upgradeable ? <Addr key="u" value={h.upgradeAuthority!} /> : "None, immutable" : "—"],
    [
      "Hook authority",
      m.hookAuthority ? m.hookAuthorityIsDbc ? "Meteora DBC (revoked at graduation)" : <Addr key="a" value={m.hookAuthority} /> : "None",
    ],
    ["Mint authority", m.mintAuthority ? <Addr key="m" value={m.mintAuthority} /> : "None"],
    ["Freeze authority", m.freezeAuthority ? <Addr key="f" value={m.freezeAuthority} /> : "None"],
    [
      "Token-2022 extensions",
      <span key="e" className="num text-xs">
        {m.extensions.join(", ")}
      </span>,
    ],
  ];
  return (
    <section className="rounded-lg border border-line">
      <h2 className="border-b border-line px-5 py-3 text-sm font-medium">On-chain facts</h2>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[180px_1fr] gap-4 px-5 py-2.5">
            <dt className="text-ink-3">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ScanSkeleton() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="scanning h-28 rounded-lg border border-line bg-panel" />
        <div className="scanning h-64 rounded-lg border border-line bg-panel" />
        <p className="text-xs text-ink-3">
          Reading the hook&apos;s code and simulating a buy, a holder&apos;s sell and a transfer on mainnet…
        </p>
      </div>
      <div className="scanning h-72 rounded-lg border border-line bg-panel" />
    </div>
  );
}
