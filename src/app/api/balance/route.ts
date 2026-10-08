import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, unpackAccount } from "@solana/spl-token";
import { connection, retry } from "@/lib/core/rpc";

/** GET ?owner=&mint= -> { lamports, token } (raw units) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const owner = new PublicKey(u.searchParams.get("owner") ?? "");
    const mint = new PublicKey(u.searchParams.get("mint") ?? "");
    const ata = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);
    const [lamports, acc] = await Promise.all([retry(() => connection().getBalance(owner)), retry(() => connection().getAccountInfo(ata))]);
    const token = acc ? unpackAccount(ata, acc, TOKEN_2022_PROGRAM_ID).amount.toString() : "0";
    return Response.json({ lamports, token }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
