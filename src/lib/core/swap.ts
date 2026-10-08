import {
  AccountInfo,
  AccountMeta,
  Commitment,
  Connection,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  AccountState,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { DynamicBondingCurveClient, SwapMode } from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";
import { DBC_POOL_AUTHORITY, NATIVE_MINT } from "./constants";
import { connection, retry } from "./rpc";

let client: DynamicBondingCurveClient | null = null;
export function dbc(): DynamicBondingCurveClient {
  if (!client) client = new DynamicBondingCurveClient(connection(), "confirmed");
  return client;
}

export interface PoolContext {
  pool: PublicKey;
  config: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseDecimals: number;
  quoteTokenProgram: PublicKey;
  needsInstructionsSysvar: boolean;
}

export async function poolContext(pool: PublicKey, baseDecimals?: number): Promise<PoolContext> {
  const c = dbc();
  const vp = (await retry(() => c.state.getPool(pool))) as unknown as { poolState?: Record<string, PublicKey> } & Record<string, PublicKey>;
  if (!vp) throw new Error("pool not found");
  const ps = (vp.poolState ?? vp) as Record<string, PublicKey>;
  const cfg = await retry(() => c.state.getPoolConfig(ps.config));
  if (!cfg) throw new Error("pool config not found");
  let decimals = baseDecimals;
  if (decimals === undefined) {
    const mi = await retry(() => connection().getParsedAccountInfo(ps.baseMint));
    decimals = (mi.value?.data as { parsed: { info: { decimals: number } } }).parsed.info.decimals;
  }
  const baseFee = cfg.poolFees.baseFee as { baseFeeMode: number };
  return {
    pool,
    config: ps.config,
    baseMint: ps.baseMint,
    quoteMint: cfg.quoteMint,
    baseVault: ps.baseVault,
    quoteVault: ps.quoteVault,
    baseDecimals: decimals,
    quoteTokenProgram: cfg.quoteTokenFlag === 1 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
    needsInstructionsSysvar:
      baseFee.baseFeeMode === 2 || Boolean((cfg as unknown as { enableFirstSwapWithMinFee?: number }).enableFirstSwapWithMinFee),
  };
}

/**
 * Resolve the hook's extra accounts for the transfer the DBC program will actually make.
 * Meteora's SDK resolves them with placeholder (default) source/destination/owner, which breaks
 * every hook whose extra accounts are derived from the wallet (per-wallet records, allowlists).
 */
export async function resolveHookAccounts(
  mint: PublicKey,
  decimals: number,
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  /** token accounts this transaction creates before the swap: address -> owner */
  creates: Map<string, PublicKey> = new Map(),
): Promise<AccountMeta[]> {
  const conn = withVirtualTokenAccounts(connection(), mint, creates);
  const ix = await retry(() =>
    createTransferCheckedWithTransferHookInstruction(
      conn,
      source,
      mint,
      destination,
      authority,
      1n,
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    ),
  );
  return ix.keys.slice(4).map((k) => ({ ...k, isSigner: false }));
}

/**
 * Hooks may derive extra accounts from a token account's data (e.g. its owner). When the
 * transaction itself creates that token account, it doesn't exist yet at resolution time, so
 * answer with the data it will have once created.
 */
export function withVirtualTokenAccounts(conn: Connection, mint: PublicKey, creates: Map<string, PublicKey>): Connection {
  if (!creates.size) return conn;
  return new Proxy(conn, {
    get(target, prop, receiver) {
      if (prop === "getAccountInfo") {
        return async (pk: PublicKey, c?: Commitment) => {
          const owner = creates.get(pk.toBase58());
          if (!owner) return target.getAccountInfo(pk, c);
          const real = await target.getAccountInfo(pk, c);
          if (real) return real;
          // 165-byte base account, then Token-2022's account type byte and the extensions every
          // hook-mint ATA carries: ImmutableOwner (len 0) and TransferHookAccount (len 1).
          const data = Buffer.alloc(ACCOUNT_SIZE + 1 + 4 + 4 + 1);
          AccountLayout.encode(
            {
              mint,
              owner,
              amount: 0n,
              delegateOption: 0,
              delegate: PublicKey.default,
              state: AccountState.Initialized,
              isNativeOption: 0,
              isNative: 0n,
              delegatedAmount: 0n,
              closeAuthorityOption: 0,
              closeAuthority: PublicKey.default,
            },
            data,
          );
          data[ACCOUNT_SIZE] = 2; // AccountType::Account
          data.writeUInt16LE(ExtensionType.ImmutableOwner, ACCOUNT_SIZE + 1);
          data.writeUInt16LE(0, ACCOUNT_SIZE + 3);
          data.writeUInt16LE(ExtensionType.TransferHookAccount, ACCOUNT_SIZE + 5);
          data.writeUInt16LE(1, ACCOUNT_SIZE + 7);
          return { data, owner: TOKEN_2022_PROGRAM_ID, lamports: 2_039_280, executable: false, rentEpoch: 0 } as AccountInfo<Buffer>;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export type Side = "buy" | "sell";

export interface SwapRequest {
  ctx: PoolContext;
  owner: PublicKey;
  payer?: PublicKey;
  side: Side;
  /** lamports of quote when buying, raw base units when selling */
  amountIn: bigint;
  minimumAmountOut?: bigint;
  /** "sdk" reproduces Meteora's SDK resolution for comparison */
  resolution?: "fixed" | "sdk";
}

export async function buildSwapInstructions(req: SwapRequest): Promise<TransactionInstruction[]> {
  const { ctx, owner, side } = req;
  const payer = req.payer ?? owner;
  const userBase = getAssociatedTokenAddressSync(ctx.baseMint, owner, true, TOKEN_2022_PROGRAM_ID);
  const userQuote = getAssociatedTokenAddressSync(ctx.quoteMint, owner, true, ctx.quoteTokenProgram);
  const quoteIsSol = ctx.quoteMint.equals(NATIVE_MINT);

  const pre: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    createAssociatedTokenAccountIdempotentInstruction(payer, userBase, owner, ctx.baseMint, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(payer, userQuote, owner, ctx.quoteMint, ctx.quoteTokenProgram),
  ];
  if (side === "buy" && quoteIsSol) {
    pre.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: userQuote, lamports: req.amountIn }));
    pre.push(createSyncNativeInstruction(userQuote));
  }
  const post: TransactionInstruction[] = quoteIsSol ? [createCloseAccountInstruction(userQuote, owner, owner)] : [];

  const hookAccounts =
    req.resolution === "sdk"
      ? await resolveHookAccounts(ctx.baseMint, ctx.baseDecimals, PublicKey.default, PublicKey.default, PublicKey.default)
      : side === "buy"
        ? await resolveHookAccounts(
            ctx.baseMint,
            ctx.baseDecimals,
            ctx.baseVault,
            userBase,
            DBC_POOL_AUTHORITY,
            new Map([[userBase.toBase58(), owner]]),
          )
        : await resolveHookAccounts(ctx.baseMint, ctx.baseDecimals, userBase, ctx.baseVault, owner);

  const remaining: AccountMeta[] = [];
  if (ctx.needsInstructionsSysvar) remaining.push({ pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false });
  remaining.push(...hookAccounts);

  const program = dbc().pool.program;
  const swapIx = await program.methods
    .swap2WithTransferHook(
      {
        amount0: new BN(req.amountIn.toString()),
        amount1: new BN((req.minimumAmountOut ?? 0n).toString()),
        swapMode: side === "buy" ? SwapMode.PartialFill : SwapMode.ExactIn,
      },
      { slices: [{ accountsType: { transferHookBase: {} }, length: hookAccounts.length }] },
    )
    .accountsPartial({
      poolAuthority: DBC_POOL_AUTHORITY,
      config: ctx.config,
      pool: ctx.pool,
      inputTokenAccount: side === "buy" ? userQuote : userBase,
      outputTokenAccount: side === "buy" ? userBase : userQuote,
      baseVault: ctx.baseVault,
      quoteVault: ctx.quoteVault,
      baseMint: ctx.baseMint,
      quoteMint: ctx.quoteMint,
      payer: owner,
      tokenBaseProgram: TOKEN_2022_PROGRAM_ID,
      tokenQuoteProgram: ctx.quoteTokenProgram,
      referralTokenAccount: null,
    })
    .remainingAccounts(remaining)
    .instruction();

  return [...pre, swapIx, ...post];
}

export async function toTransaction(ixs: TransactionInstruction[], payer: PublicKey): Promise<VersionedTransaction> {
  const { blockhash } = await retry(() => connection().getLatestBlockhash("confirmed"));
  return new VersionedTransaction(
    new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(),
  );
}

export { SwapMode };
