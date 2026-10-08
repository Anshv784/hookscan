import { VersionedTransaction } from "@solana/web3.js";
import { connection } from "@/lib/core/rpc";

export const maxDuration = 60;

/** Relays a wallet-signed transaction through our RPC and waits for confirmation. */
export async function POST(req: Request) {
  try {
    const { tx } = (await req.json()) as { tx: string };
    const raw = Buffer.from(tx, "base64");
    const parsed = VersionedTransaction.deserialize(raw);
    if (!parsed.signatures.some((s) => s.some((b) => b !== 0)))
      return Response.json({ error: "transaction is not signed" }, { status: 400 });
    const conn = connection();
    const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3, preflightCommitment: "confirmed" });
    const bh = await conn.getLatestBlockhash("confirmed");
    const conf = await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    if (conf.value.err) return Response.json({ signature: sig, error: JSON.stringify(conf.value.err) }, { status: 422 });
    return Response.json({ signature: sig });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 400) : String(e) }, { status: 400 });
  }
}
