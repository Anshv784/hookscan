/**
 * Mainnet snapshot of every Meteora DBC transfer-hook pool.
 *   bun scripts/index.ts            -> data/snapshot.json
 * Static facts (mint, hook program, rules) for every pool; live buy/sell/transfer tests on the
 * busiest curve-phase pools of each hook program.
 */
import { PublicKey } from "@solana/web3.js";
import { mkdirSync, writeFileSync } from "fs";
import { DBC_PROGRAM } from "../src/lib/core/constants";
import { TRANSFER_HOOK_POOL_DISC, decodePool, PoolRecord } from "../src/lib/core/layout";
import { MintFacts, readMint } from "../src/lib/core/mint";
import { HookProgramFacts, inspectHookProgram } from "../src/lib/core/program";
import { connection, retry } from "../src/lib/core/rpc";
import { CoinReport, judge, runTests } from "../src/lib/core/scan";
import { dbc, poolContext } from "../src/lib/core/swap";
import type { Snapshot, SnapshotCoin, SnapshotHook } from "../src/lib/snapshot";

const SAMPLES_PER_HOOK = Number(process.env.SAMPLES_PER_HOOK ?? 3);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const conn = connection();
  const slot = await retry(() => conn.getSlot("confirmed"));
  log("slot", slot);

  const accs = await retry(() =>
    conn.getProgramAccounts(DBC_PROGRAM, { filters: [{ memcmp: { offset: 0, bytes: TRANSFER_HOOK_POOL_DISC } }] }),
  );
  const pools: PoolRecord[] = accs.map((a) => decodePool(a.pubkey.toBase58(), a.account.data));
  log("hook pools", pools.length);

  // Mints
  const mints = new Map<string, MintFacts>();
  for (let i = 0; i < pools.length; i += 100) {
    const batch = pools.slice(i, i + 100).map((p) => new PublicKey(p.mint));
    const infos = await retry(() => conn.getMultipleAccountsInfo(batch));
    infos.forEach((info, j) => {
      if (!info) return;
      try {
        mints.set(batch[j].toBase58(), readMint(batch[j], info));
      } catch {
        /* unparsable mint */
      }
    });
  }
  log("mints", mints.size);

  // Configs: migration threshold -> curve progress
  const configs = [...new Set(pools.map((p) => p.config))];
  const threshold = new Map<string, bigint>();
  const quoteMintOf = new Map<string, string>();
  const coder = dbc().pool.program.coder.accounts;
  for (let i = 0; i < configs.length; i += 100) {
    const batch = configs.slice(i, i + 100);
    const infos = await retry(() => conn.getMultipleAccountsInfo(batch.map((c) => new PublicKey(c))));
    infos.forEach((info, j) => {
      if (!info) return;
      try {
        // Hook pools point at a ConfigWithTransferHook account, which wraps the PoolConfig.
        let c;
        try {
          c = coder.decode("configWithTransferHook", info.data).config;
        } catch {
          c = coder.decode("poolConfig", info.data);
        }
        threshold.set(batch[j], BigInt(c.migrationQuoteThreshold.toString()));
        quoteMintOf.set(batch[j], c.quoteMint.toBase58());
      } catch {
        /* not a config */
      }
    });
  }
  log("configs", threshold.size);

  // Hook programs. Pools whose hook was revoked (graduated) are keyed by "revoked".
  const hookOf = (p: PoolRecord) => mints.get(p.mint)?.hookProgram ?? "revoked";
  const byHook = new Map<string, PoolRecord[]>();
  for (const p of pools) {
    const h = hookOf(p);
    if (!byHook.has(h)) byHook.set(h, []);
    byHook.get(h)!.push(p);
  }
  const programs = [...byHook.keys()].filter((h) => h !== "revoked");
  const facts = new Map<string, HookProgramFacts>();
  await pool(programs, CONCURRENCY, async (h) => {
    try {
      facts.set(h, await inspectHookProgram(h));
    } catch (e) {
      log("hook inspect failed", h, String(e).slice(0, 80));
    }
  });
  log("hook programs", facts.size);

  // Live tests on the busiest curve-phase pools of each hook program.
  const jobs: { hook: string; p: PoolRecord }[] = [];
  for (const [h, ps] of byHook) {
    if (h === "revoked") continue;
    ps.filter((p) => p.phase === "curve")
      .sort((a, b) => (BigInt(b.quoteReserve) > BigInt(a.quoteReserve) ? 1 : -1))
      .slice(0, SAMPLES_PER_HOOK)
      .forEach((p) => jobs.push({ hook: h, p }));
  }
  log("live test jobs", jobs.length);
  const reports = new Map<string, CoinReport[]>();
  let done = 0;
  await pool(jobs, CONCURRENCY, async ({ hook, p }) => {
    try {
      const mint = mints.get(p.mint)!;
      const hf = facts.get(hook) ?? null;
      const ctx = await poolContext(new PublicKey(p.pool), mint.decimals);
      const tests = await runTests(ctx, p, hf);
      const partial = {
        scannedAt: Date.now(),
        slot,
        pool: p,
        mint,
        hook: hf,
        tests,
        jupiter: { routable: false, reason: "not checked in batch" },
      };
      const r: CoinReport = { ...partial, ...judge(partial, slot) };
      if (!reports.has(hook)) reports.set(hook, []);
      reports.get(hook)!.push(r);
    } catch (e) {
      log("test failed", p.pool.slice(0, 8), String(e).slice(0, 100));
    }
    if (++done % 25 === 0) log("tested", done, "/", jobs.length);
  });

  // Assemble
  const coins: SnapshotCoin[] = pools.map((p) => {
    const m = mints.get(p.mint);
    const t = threshold.get(p.config);
    const q = BigInt(p.quoteReserve);
    return {
      pool: p.pool,
      mint: p.mint,
      symbol: m?.symbol ?? null,
      name: m?.name ?? null,
      hook: hookOf(p),
      phase: p.phase,
      creator: p.creator,
      quoteMint: quoteMintOf.get(p.config) ?? null,
      quoteReserve: p.quoteReserve,
      progress: t && t > 0n ? Math.min(1, Number((q * 10_000n) / t) / 10_000) : null,
      mintAuthority: m?.mintAuthority ?? null,
      freezeAuthority: m?.freezeAuthority ?? null,
      permanentDelegate: m?.permanentDelegate ?? null,
    };
  });

  const hooks: SnapshotHook[] = [...byHook.entries()].map(([h, ps]) => {
    const rs = reports.get(h) ?? [];
    const statuses: Record<string, number> = {};
    for (const r of rs) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    const f = facts.get(h) ?? null;
    return {
      program: h,
      facts: f,
      pools: ps.length,
      phases: {
        curve: ps.filter((p) => p.phase === "curve").length,
        complete: ps.filter((p) => p.phase === "complete").length,
        graduated: ps.filter((p) => p.phase === "graduated").length,
      },
      creators: new Set(ps.map((p) => p.creator)).size,
      creatorIsUpgradeAuthority: f?.upgradeAuthority ? ps.filter((p) => p.creator === f.upgradeAuthority).length : 0,
      withMintAuthority: ps.filter((p) => mints.get(p.mint)?.mintAuthority).length,
      quoteReserveLamports: ps.reduce((s, p) => s + BigInt(p.quoteReserve), 0n).toString(),
      statuses,
      samples: rs.map((r) => ({
        pool: r.pool.pool,
        mint: r.mint.mint,
        symbol: r.mint.symbol,
        status: r.status,
        headline: r.headline,
        tests: r.tests,
      })),
    };
  });
  hooks.sort((a, b) => b.pools - a.pools);

  const snapshot: Snapshot = { generatedAt: Date.now(), slot, totals: totals(coins, hooks), hooks, coins };
  mkdirSync("data", { recursive: true });
  writeFileSync("data/snapshot.json", JSON.stringify(snapshot));
  log("wrote data/snapshot.json", (JSON.stringify(snapshot).length / 1e6).toFixed(2), "MB");
}

function totals(coins: SnapshotCoin[], hooks: SnapshotHook[]): Snapshot["totals"] {
  const live = hooks.filter((h) => h.program !== "revoked");
  const status = (s: string) => live.filter((h) => dominant(h.statuses) === s).reduce((n, h) => n + h.phases.curve, 0);
  return {
    pools: coins.length,
    curve: coins.filter((c) => c.phase === "curve").length,
    complete: coins.filter((c) => c.phase === "complete").length,
    graduated: coins.filter((c) => c.phase === "graduated").length,
    hookPrograms: live.length,
    upgradeableHookPrograms: live.filter((h) => h.facts?.upgradeable).length,
    poolsOnUpgradeableHooks: live.filter((h) => h.facts?.upgradeable).reduce((n, h) => n + h.pools, 0),
    withMintAuthority: coins.filter((c) => c.mintAuthority).length,
    curvePoolsByStatus: {
      open: status("open"),
      "pad-only": status("pad-only"),
      "sell-blocked": status("sell-blocked"),
      broken: status("broken"),
      untested:
        live.reduce((n, h) => n + h.phases.curve, 0) - ["open", "pad-only", "sell-blocked", "broken"].reduce((n, s) => n + status(s), 0),
    },
    quoteLockedLamports: coins
      .filter((c) => c.phase === "curve" && c.quoteMint === "So11111111111111111111111111111111111111112")
      .reduce((s, c) => s + BigInt(c.quoteReserve), 0n)
      .toString(),
  };
}

export function dominant(statuses: Record<string, number>): string {
  const order = ["broken", "sell-blocked", "pad-only", "open", "complete", "graduated", "untested"];
  const entries = Object.entries(statuses).filter(([s]) => s !== "untested");
  if (!entries.length) return "untested";
  entries.sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]));
  return entries[0][0];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
