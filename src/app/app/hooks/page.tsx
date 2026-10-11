import type { Metadata } from "next";
import { PageHeader } from "@/components/app/shell";
import { Addr, HookName, StatusChip } from "@/components/ui";
import { dominantStatus, hookLabel, sharedKeys, snapshot } from "@/lib/data";
import type { Status } from "@/lib/core/scan";

export const metadata: Metadata = { title: "Hooks" };

const SLOTS_PER_DAY = 216_000;

function age(slot: number | null) {
  if (!slot) return "—";
  const days = (snapshot.slot - slot) / SLOTS_PER_DAY;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h ago`;
  if (days < 60) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** The most telling rule: prefer ones about selling, gating or co-signing. */
const pickRule = (rules: string[]) => rules.find((r) => /sell|co-?sign|only|requires|locked|blocklist/i.test(r)) ?? rules[0] ?? null;

export default function HooksPage() {
  const hooks = snapshot.hooks.filter((h) => h.program !== "revoked");
  const keys = sharedKeys();
  return (
    <>
      <PageHeader
        title="Hooks"
        description={`${hooks.length} hook programs. Every coin in a row runs that program on each buy, sell and transfer. The quote is a rule read out of its deployed code.`}
      />
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-card text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Hook</th>
              <th className="px-4 py-3 text-right font-medium">Coins</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
              <th className="px-4 py-3 font-medium">A rule from its code</th>
              <th className="px-4 py-3 font-medium">Who can rewrite it</th>
              <th className="px-4 py-3 text-right font-medium">Last deploy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hooks.map((h) => {
              const rule = pickRule(h.facts?.rules ?? []);
              const others = (keys.get(h.facts?.upgradeAuthority ?? "")?.length ?? 1) - 1;
              return (
                <tr key={h.program} className="align-top hover:bg-card/60">
                  <td className="px-4 py-3">
                    <HookName program={h.program} label={hookLabel(h.program)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                    {h.pools.toLocaleString("en-US")}
                    <div className="text-[11px] text-ink-3">{h.phases.curve} live</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={dominantStatus(h) as Status} />
                  </td>
                  <td className="max-w-sm px-4 py-3 text-muted-foreground">
                    {rule ? (
                      <span className="line-clamp-2">&ldquo;{rule}&rdquo;</span>
                    ) : (
                      <span className="text-ink-3">No readable messages</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {h.facts?.closed ? (
                      <span className="text-red">closed, frozen</span>
                    ) : !h.facts?.exists ? (
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
                    {others > 0 && (
                      <div className="text-[11px] text-ink-3">
                        same key controls {others} other hook{others > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-muted-foreground">
                    {age(h.facts?.lastDeploySlot ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
