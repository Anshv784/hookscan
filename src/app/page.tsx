import { Landing, LandingData } from "@/components/landing/landing";
import { closedHooks, fieldData, generatedLabel, refusalQuotes, sdkFailures, sharedKeys, snapshot, upgradeablePct } from "@/lib/data";

export default function Home() {
  const t = snapshot.totals;
  const by = t.curvePoolsByStatus;
  const data: LandingData = {
    field: fieldData(),
    pools: t.pools,
    curve: t.curve,
    graduated: t.graduated,
    hookPrograms: t.hookPrograms,
    upgradeablePct: upgradeablePct(),
    withMintAuthority: t.withMintAuthority,
    byStatus: { open: by.open, gated: by["pad-only"], sellBlocked: by["sell-blocked"], frozen: by.broken },
    closed: closedHooks(),
    sharedKeyMax: Math.max(0, ...[...sharedKeys().values()].map((v) => v.length)),
    sdk: sdkFailures(),
    quotes: refusalQuotes(12),
    generated: generatedLabel(),
  };
  return <Landing data={data} />;
}
