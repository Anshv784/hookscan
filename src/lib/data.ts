import "server-only";
import raw from "../../data/snapshot.json";
import type { Snapshot, SnapshotHook } from "./snapshot";

export const snapshot = raw as unknown as Snapshot;

const ORDER = ["broken", "sell-blocked", "pad-only", "open", "complete", "graduated", "untested"];

export function dominantStatus(h: SnapshotHook): string {
  if (h.program === "revoked") return "revoked";
  const entries = Object.entries(h.statuses).filter(([s]) => s !== "untested");
  if (!entries.length) return h.phases.curve === 0 ? (h.phases.graduated ? "graduated" : "complete") : "untested";
  entries.sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  return entries[0][0];
}

export const hookByProgram = new Map(snapshot.hooks.map((h) => [h.program, h]));

export function hookLabel(program: string): string | null {
  if (program === "revoked") return "Graduated (hook revoked)";
  return KNOWN[program] ?? hookByProgram.get(program)?.facts?.label ?? null;
}

/** Names confirmed from the hooks' own messages. */
const KNOWN: Record<string, string> = {
  AJVs2E5oH1mpszGoXKPf6dHzEyasN3vrhC3ow2WpfNWE: "Fomo",
  FKTNiFexa4dFRgKwGjJLwmwNH8pocfyUuKdGvcZGeSSa: "SPEC.fun",
  AvVQRmi5LwnTN64pkHbUEeAwwMgR2ms3FcL8VbfZV7FH: "ai-only pad",
  ARzxmFNCjWx7XuzXMci3WyDubMkg7FMd2xxy9s7tgdrM: "hook_guard",
};

// ------------------------------------------------------------------ derived census facts

const SOL = "So11111111111111111111111111111111111111112";
const liveHooks = () => snapshot.hooks.filter((h) => h.program !== "revoked");

export function closedHooks() {
  const closed = liveHooks().filter((h) => h.facts?.closed || (h.facts && !h.facts.exists));
  const set = new Set(closed.map((h) => h.program));
  const coins = snapshot.coins.filter((c) => set.has(c.hook) && c.phase === "curve");
  const lamports = coins.filter((c) => c.quoteMint === SOL).reduce((n, c) => n + BigInt(c.quoteReserve), 0n);
  return { hooks: closed.length, coins: coins.length, sol: Math.round(Number(lamports) / 1e9).toLocaleString("en-US") };
}

export function sharedKeys() {
  const m = new Map<string, string[]>();
  for (const h of liveHooks()) {
    const k = h.facts?.upgradeable ? h.facts.upgradeAuthority : null;
    if (k) m.set(k, [...(m.get(k) ?? []), h.program]);
  }
  return new Map([...m].filter(([, v]) => v.length > 1));
}

export function sdkFailures() {
  const hooks = liveHooks().filter((h) => h.samples.some((s) => s.tests.sell.ok && s.tests.sell.sdkOk === false));
  const sells = liveHooks()
    .flatMap((h) => h.samples)
    .filter((s) => s.tests.sell.ok && s.tests.sell.sdkOk === false).length;
  return { sells, coins: hooks.reduce((n, h) => n + h.phases.curve, 0) };
}

/** One quote per distinct hook refusal, preferring hooks with the most coins. */
export function refusalQuotes(limit = 15) {
  const seen = new Set<string>();
  const out: { reason: string; program: string; hook: string; coins: number; test: string }[] = [];
  for (const h of [...liveHooks()].sort((a, b) => b.pools - a.pools)) {
    for (const s of h.samples) {
      for (const [test, r] of [
        ["buy", s.tests.buy],
        ["sell", s.tests.sell],
        ["transfer", s.tests.transfer],
      ] as const) {
        if (!r.ran || r.ok || !r.blockedByHook || !r.reason) continue;
        if (/^custom program error|panick|Unsupported program id|additional account keys|^[1-9A-HJ-NP-Za-km-z]{32,44}$/i.test(r.reason))
          continue;
        const key = r.reason.replace(/\d+/g, "#").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          reason: r.reason,
          program: h.program,
          hook: hookLabel(h.program) ?? `${h.program.slice(0, 4)}…${h.program.slice(-4)}`,
          coins: h.pools,
          test,
        });
      }
    }
  }
  return out.slice(0, limit);
}

export function upgradeablePct() {
  const t = snapshot.totals;
  return Math.round((t.poolsOnUpgradeableHooks / Math.max(1, t.pools - t.graduated)) * 100);
}

export function generatedLabel() {
  return new Date(snapshot.generatedAt).toISOString().replace("T", " ").slice(0, 16);
}

const STATUS_INDEX: Record<string, number> = {
  graduated: 0,
  revoked: 0,
  open: 1,
  "pad-only": 2,
  "sell-blocked": 3,
  broken: 4,
  untested: 5,
  complete: 5,
};

/** Compact per-coin arrays for the landing page's 3D field. */
export function fieldData() {
  const order = [...snapshot.hooks].sort((a, b) => b.pools - a.pools);
  const idx = new Map(order.map((h, i) => [h.program, i]));
  const status = new Map(order.map((h) => [h.program, STATUS_INDEX[dominantStatus(h)] ?? 5]));
  return {
    hook: snapshot.coins.map((c) => idx.get(c.hook) ?? 0),
    status: snapshot.coins.map((c) => (c.phase === "graduated" ? 0 : (status.get(c.hook) ?? 5))),
    sizes: order.map((h) => h.pools),
  };
}
