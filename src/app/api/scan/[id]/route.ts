import { scanCoin } from "@/lib/core/scan";

export const maxDuration = 60;

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/scan/[id]">) {
  const { id } = await ctx.params;
  if (!BASE58.test(id)) return Response.json({ error: "not a Solana address" }, { status: 400 });
  try {
    const report = await scanCoin(id);
    return Response.json(report, {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120", "access-control-allow-origin": "*" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /No Meteora DBC pool|not found/i.test(msg) ? 404 : 500;
    return Response.json({ error: msg }, { status, headers: { "access-control-allow-origin": "*" } });
  }
}
