import { buildSwap } from "@/lib/core/trade";

export const maxDuration = 60;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };

export function OPTIONS() {
  return new Response(null, { headers: { ...CORS, "access-control-allow-methods": "POST, OPTIONS" } });
}

/**
 * POST { pool | mint, owner, side: "buy"|"sell", amount: string (lamports when buying, raw base units when selling), slippageBps? }
 * -> an unsigned v0 transaction that has already been simulated for this wallet, plus the simulated output.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400, headers: CORS });
  }
  try {
    const result = await buildSwap({
      target: String(body.pool ?? body.mint ?? ""),
      owner: String(body.owner ?? ""),
      side: body.side === "sell" ? "sell" : "buy",
      amount: BigInt(String(body.amount ?? "0")),
      slippageBps: Number(body.slippageBps ?? 300),
    });
    return Response.json(result, { status: result.ok ? 200 : 422, headers: CORS });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400, headers: CORS });
  }
}
