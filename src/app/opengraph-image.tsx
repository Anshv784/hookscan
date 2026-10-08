import { ImageResponse } from "next/og";
import { snapshot } from "@/lib/data";

export const alt = "HookScan: read the rules before you buy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  const t = snapshot.totals;
  const upgradeablePct = Math.round((t.poolsOnUpgradeableHooks / Math.max(1, t.pools - t.graduated)) * 100);
  const stats: [string, string, string][] = [
    [t.curve.toLocaleString("en-US"), "on the curve, not on Jupiter", "#ece6da"],
    [`${upgradeablePct}%`, "on hooks whose rules can change", "#f2a93b"],
    [t.curvePoolsByStatus.broken.toLocaleString("en-US"), "frozen by their own hook", "#ef5b4c"],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0d0c0a", color: "#ece6da", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#f2a93b" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #f2a93b", borderRadius: 7 }} />
          HookScan
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 64, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
          <span>
            <span style={{ color: "#f2a93b" }}>{t.pools.toLocaleString("en-US")}</span>&nbsp;Meteora coins run their own code on every transfer.
          </span>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: "auto" }}>
          {stats.map(([v, l, c]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", flex: 1, border: "2px solid #2a2720", borderRadius: 12, padding: "22px 26px" }}>
              <span style={{ fontSize: 48, color: c }}>{v}</span>
              <span style={{ fontSize: 22, color: "#7d7668", marginTop: 6 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
