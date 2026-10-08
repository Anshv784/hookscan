import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, unpackAccount } from "@solana/spl-token";
import { NATIVE_MINT } from "./constants";
import { connection, retry } from "./rpc";
import { resolvePool } from "./scan";
import { simulate } from "./simulate";
import { Side, buildSwapInstructions, poolContext, toTransaction } from "./swap";

export interface BuildSwapInput {
  target: string; // mint or pool
  owner: string;
  side: Side;
  amount: bigint;
  slippageBps: number;
}

export interface BuildSwapResult {
  ok: boolean;
  pool: string;
  mint: string;
  /** base64 unsigned v0 transaction; sign with the owner wallet and send */
  transaction: string | null;
  /** raw output units the simulation produced for this exact wallet */
  expectedOut: string | null;
  minimumOut: string | null;
  outMint: string;
  outDecimals: number;
  reason: string | null;
  logs: string[];
}

const PRIORITY_MICROLAMPORTS = 50_000;

export async function buildSwap(input: BuildSwapInput): Promise<BuildSwapResult> {
  if (input.amount <= 0n) throw new Error("amount must be positive");
  const slip = Math.min(5000, Math.max(0, Math.round(input.slippageBps)));
  const owner = new PublicKey(input.owner);
  const poolPk = await resolvePool(input.target);
  const ctx = await poolContext(poolPk);
  if (!ctx.quoteMint.equals(NATIVE_MINT)) throw new Error("Only SOL-quoted curves can be traded here for now");

  const userBase = getAssociatedTokenAddressSync(ctx.baseMint, owner, true, TOKEN_2022_PROGRAM_ID);
  const outMint = input.side === "buy" ? ctx.baseMint.toBase58() : NATIVE_MINT.toBase58();
  const outDecimals = input.side === "buy" ? ctx.baseDecimals : 9;

  // 1. Simulate with no minimum to learn the real output for this wallet, hooks included.
  const probe = await buildSwapInstructions({ ctx, owner, side: input.side, amountIn: input.amount });
  const conn = connection();
  const [preBase, preLamports] = await Promise.all([
    retry(() => conn.getAccountInfo(userBase)).then((a) => (a ? unpackAccount(userBase, a, TOKEN_2022_PROGRAM_ID).amount : 0n)),
    retry(() => conn.getBalance(owner)),
  ]);
  const sim = await simulate(probe, owner, [userBase, owner]);
  const base = { pool: poolPk.toBase58(), mint: ctx.baseMint.toBase58(), outMint, outDecimals, logs: sim.logs.slice(-30) };
  if (!sim.ok) return { ...base, ok: false, transaction: null, expectedOut: null, minimumOut: null, reason: sim.reason };

  let out: bigint;
  if (input.side === "buy") {
    const post = sim.post[0];
    out =
      (post
        ? unpackAccount(userBase, { data: post, owner: TOKEN_2022_PROGRAM_ID, lamports: 0, executable: false }, TOKEN_2022_PROGRAM_ID)
            .amount
        : 0n) - preBase;
  } else {
    // lamports gained by the wallet, adding back the 5000-lamport signature fee
    out = BigInt((sim.postLamports[1] ?? preLamports) - preLamports + 5000);
  }
  if (out <= 0n)
    return { ...base, ok: false, transaction: null, expectedOut: "0", minimumOut: null, reason: "Simulation produced no output" };

  // 2. The real transaction, with slippage protection and a priority fee.
  const minOut = (out * BigInt(10_000 - slip)) / 10_000n;
  const ixs = await buildSwapInstructions({ ctx, owner, side: input.side, amountIn: input.amount, minimumAmountOut: minOut });
  const tx = await toTransaction([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }), ...ixs], owner);
  return {
    ...base,
    ok: true,
    transaction: Buffer.from(tx.serialize()).toString("base64"),
    expectedOut: out.toString(),
    minimumOut: minOut.toString(),
    reason: null,
  };
}
