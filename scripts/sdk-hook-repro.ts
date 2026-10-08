// Usage: RPC_URL=... bun scripts/sdk-hook-repro.ts <TransferHookPool> <holder wallet>
// Minimal repro: DynamicBondingCurveClient.pool.swap2WithTransferHook resolves hook extra accounts
// with PublicKey.default as source/destination/owner.
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { DynamicBondingCurveClient, SwapMode } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { TOKEN_2022_PROGRAM_ID, createTransferCheckedWithTransferHookInstruction, getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import BN from "bn.js";

const conn = new Connection(process.env.RPC_URL!, "confirmed");
const client = new DynamicBondingCurveClient(conn, "confirmed");
const pool = new PublicKey(process.argv[2]);
const holder = new PublicKey(process.argv[3]);

const state: any = await client.state.getPool(pool);
const ps = state.poolState ?? state;
const mint = await getMint(conn, ps.baseMint, "confirmed", TOKEN_2022_PROGRAM_ID);
const holderAta = getAssociatedTokenAddressSync(ps.baseMint, holder, false, TOKEN_2022_PROGRAM_ID);
const bal = (await conn.getTokenAccountBalance(holderAta)).value.amount;
const amountIn = new BN(bal).divn(20);

async function sim(tx: { instructions: any[] }) {
  const { blockhash } = await conn.getLatestBlockhash();
  const msg = new TransactionMessage({ payerKey: holder, recentBlockhash: blockhash, instructions: tx.instructions }).compileToV0Message();
  const r = await conn.simulateTransaction(new VersionedTransaction(msg), { sigVerify: false, replaceRecentBlockhash: true });
  return r.value;
}

const params = { owner: holder, pool, swapBaseForQuote: true, referralTokenAccount: null, swapMode: SwapMode.ExactIn, amountIn, minimumAmountOut: new BN(0) } as any;

// 1. SDK as-is
const sdkTx = await client.pool.swap2WithTransferHook(params);
const a = await sim(sdkTx);
console.log("SDK swap2WithTransferHook (unmodified):", a.err ? JSON.stringify(a.err) : "OK");
if (a.err) console.log("  " + (a.logs ?? []).filter((l) => /log:|failed/.test(l)).slice(-4).join("\n  "));

// 2. Same transaction, hook accounts resolved for the real transfer (holder ATA -> base vault, signed by holder)
const real = await createTransferCheckedWithTransferHookInstruction(conn, holderAta, ps.baseMint, ps.baseVault, holder, 1n, mint.decimals, [], "confirmed", TOKEN_2022_PROGRAM_ID);
const placeholder = await createTransferCheckedWithTransferHookInstruction(conn, PublicKey.default, ps.baseMint, PublicKey.default, PublicKey.default, 0n, mint.decimals, [], "confirmed", TOKEN_2022_PROGRAM_ID);
const realKeys = real.keys.slice(4), sdkKeys = placeholder.keys.slice(4);
console.log("hook accounts: SDK", sdkKeys.length, "real", realKeys.length);
sdkKeys.forEach((k, i) => { if (!k.pubkey.equals(realKeys[i]?.pubkey)) console.log(`  differs at ${i}: SDK ${k.pubkey.toBase58()}  real ${realKeys[i]?.pubkey.toBase58()}`); });
const ix = sdkTx.instructions.find((i) => i.programId.toBase58() === "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN")!;
if (realKeys.length !== sdkKeys.length) throw new Error("account count differs; slice length would need re-encoding");
ix.keys = [...ix.keys.slice(0, ix.keys.length - sdkKeys.length), ...realKeys.map((k) => ({ ...k, isSigner: false }))];
const b = await sim(sdkTx);
console.log("Same tx, hook accounts resolved for the real wallet:", b.err ? JSON.stringify(b.err) : "OK");
