import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";
import { DBC_PROGRAM, NATIVE_MINT, SIM_BUYER } from "./constants";
import { POOL_ACCOUNT_SIZE, decodePool, PoolRecord } from "./layout";
import { MintFacts, readMint } from "./mint";
import { HookProgramFacts, inspectHookProgram } from "./program";
import { connection, retry } from "./rpc";
import { SimResult, simulate } from "./simulate";
import { buildSwapInstructions, poolContext, PoolContext, withVirtualTokenAccounts } from "./swap";

export type Status = "open" | "pad-only" | "sell-blocked" | "broken" | "graduated" | "complete" | "untested";
export type Level = "danger" | "warn" | "info" | "good";

export interface Flag {
  level: Level;
  text: string;
}

export interface TestResult {
  ran: boolean;
  ok: boolean;
  reason: string | null;
  blockedByHook: boolean;
  detail?: string;
  /** For the holder sell: what the same sell does with Meteora SDK's hook account resolution. */
  sdkOk?: boolean;
  sdkReason?: string | null;
  wallet?: string;
}

export interface CoinReport {
  scannedAt: number;
  slot: number;
  pool: PoolRecord;
  mint: MintFacts;
  hook: HookProgramFacts | null;
  /** Rule messages the hook failed with on this coin, mapped through the hook IDL when there is one. */
  tests: { buy: TestResult; sell: TestResult; transfer: TestResult };
  jupiter: { routable: boolean; reason: string | null };
  status: Status;
  headline: string;
  flags: Flag[];
}

const SLOTS_PER_DAY = 216_000;

/** Failures that come from the runtime or a crash, not from a rule the hook's author wrote. */
export function isSystemFailure(reason: string | null): boolean {
  return /panick|Unsupported program id|Program is not cached|additional account keys|not enough account keys|AccountNotFound|invalid account data|account data too small|Couldn't build/i.test(
    reason ?? "",
  );
}
const notRun = (reason: string): TestResult => ({
  ran: false,
  ok: false,
  reason,
  blockedByHook: false,
});

export async function findPoolByMint(mint: PublicKey): Promise<PublicKey | null> {
  const res = await retry(() =>
    connection().getProgramAccounts(DBC_PROGRAM, {
      dataSlice: { offset: 0, length: 0 },
      filters: [{ dataSize: POOL_ACCOUNT_SIZE }, { memcmp: { offset: 136, bytes: mint.toBase58() } }],
    }),
  );
  return res[0]?.pubkey ?? null;
}

/** Accepts a mint or a DBC pool address. */
export async function resolvePool(addr: string): Promise<PublicKey> {
  const pk = new PublicKey(addr);
  const info = await retry(() => connection().getAccountInfo(pk));
  if (info?.owner.equals(DBC_PROGRAM)) return pk;
  const pool = await findPoolByMint(pk);
  if (!pool) throw new Error("No Meteora DBC pool found for this address");
  return pool;
}

function hookReason(sim: SimResult, hook: HookProgramFacts | null): { byHook: boolean; reason: string | null } {
  const byHook = !!hook && sim.failedProgram === hook.program;
  // The hook's error surfaces as Token-2022 / DBC failures too; check the logs for the hook invocation failing.
  const hookFailedInLogs = !!hook && sim.logs.some((l) => l.startsWith(`Program ${hook.program} failed`));
  let reason = sim.reason;
  if (hook && sim.customCode !== null && hook.errors[sim.customCode]) reason = hook.errors[sim.customCode];
  return { byHook: byHook || hookFailedInLogs, reason };
}

async function findHolder(
  mint: PublicKey,
  baseVault: PublicKey,
): Promise<{
  owner: PublicKey;
  tokenAccount: PublicKey;
  amount: bigint;
} | null> {
  const largest = await retry(() => connection().getTokenLargestAccounts(mint));
  const candidates = largest.value.filter((a) => !a.address.equals(baseVault) && BigInt(a.amount) > 0n).slice(0, 8);
  if (!candidates.length) return null;
  const accs = await retry(() => connection().getMultipleAccountsInfo(candidates.map((c) => c.address)));
  const owners = accs.map((a, i) => (a ? unpackAccount(candidates[i].address, a, TOKEN_2022_PROGRAM_ID) : null));
  const ownerInfos = await retry(() => connection().getMultipleAccountsInfo(owners.map((o) => o?.owner ?? PublicKey.default)));
  for (let i = 0; i < owners.length; i++) {
    const o = owners[i];
    const oi = ownerInfos[i];
    if (o && oi && oi.owner.equals(SystemProgram.programId) && !o.isFrozen)
      return { owner: o.owner, tokenAccount: o.address, amount: o.amount };
  }
  return null;
}

async function jupiterCheck(mint: string): Promise<{ routable: boolean; reason: string | null }> {
  try {
    const r = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${NATIVE_MINT.toBase58()}&outputMint=${mint}&amount=10000000&slippageBps=500`,
      {
        headers: { "user-agent": "hookscan" },
        signal: AbortSignal.timeout(8000),
      },
    );
    const j = await r.json();
    if (r.ok && j.routePlan?.length)
      return {
        routable: true,
        reason: j.routePlan.map((p: { swapInfo: { label: string } }) => p.swapInfo.label).join(" → "),
      };
    return {
      routable: false,
      reason: j.errorCode ?? j.error ?? `HTTP ${r.status}`,
    };
  } catch (e) {
    return {
      routable: false,
      reason: `unreachable: ${String(e).slice(0, 60)}`,
    };
  }
}

const failedToBuild = (e: unknown): TestResult => ({
  ran: false,
  ok: false,
  reason: `Couldn't build this transfer: ${e instanceof Error ? e.message || e.name : String(e)}`.slice(0, 200),
  blockedByHook: false,
});

async function guard(fn: () => Promise<TestResult>): Promise<TestResult> {
  try {
    return await fn();
  } catch (e) {
    return failedToBuild(e);
  }
}

export async function runTests(ctx: PoolContext, pool: PoolRecord, hook: HookProgramFacts | null): Promise<CoinReport["tests"]> {
  if (pool.phase !== "curve") {
    const why = pool.phase === "graduated" ? "Curve graduated; trading moved to DAMM v2" : "Curve is full and waiting to migrate";
    return { buy: notRun(why), sell: notRun(why), transfer: notRun(why) };
  }
  const tests = {} as CoinReport["tests"];

  // 1. An outside wallet buys on the curve: 0.01 SOL, then 0.25 SOL if the hook refused the small
  //    one (some hooks enforce a minimum buy or a fixed "equal start" size).
  if (ctx.quoteMint.equals(NATIVE_MINT))
    tests.buy = await guard(async () => {
      const userBase = getAssociatedTokenAddressSync(ctx.baseMint, SIM_BUYER, true, TOKEN_2022_PROGRAM_ID);
      let refused: TestResult | null = null;
      for (const lamports of [10_000_000n, 250_000_000n]) {
        const sim = await simulate(await buildSwapInstructions({ ctx, owner: SIM_BUYER, side: "buy", amountIn: lamports }), SIM_BUYER, [
          userBase,
        ]);
        const h = hookReason(sim, hook);
        const solIn = Number(lamports) / 1e9;
        if (sim.ok) {
          const got = sim.post[0]
            ? unpackAccount(
                userBase,
                { data: sim.post[0], owner: TOKEN_2022_PROGRAM_ID, lamports: 0, executable: false },
                TOKEN_2022_PROGRAM_ID,
              ).amount
            : 0n;
          return {
            ran: true,
            ok: true,
            blockedByHook: false,
            reason: refused ? `0.01 SOL was refused ("${refused.reason}"), ${solIn} SOL went through` : null,
            detail: `${solIn} SOL bought ${(Number(got) / 10 ** ctx.baseDecimals).toLocaleString("en-US", { maximumFractionDigits: 2 })} tokens`,
          };
        }
        const attempt = { ran: true, ok: false, reason: h.reason, blockedByHook: h.byHook, detail: `tried ${solIn} SOL` };
        if (!h.byHook) {
          refused = refused ?? attempt; // a hook refusal on the small buy is the more telling result
          break;
        }
        refused = attempt;
      }
      return refused!;
    });
  else {
    tests.buy = notRun(`Quote token is ${ctx.quoteMint.toBase58().slice(0, 6)}…, buy test only runs on SOL curves`);
  }

  // 2. The largest real holder sells 10% of their bag; 3. and sends some to a fresh wallet.
  const holder = await findHolder(ctx.baseMint, ctx.baseVault);
  if (!holder) {
    tests.sell = notRun("No wallet holds this coin yet");
    tests.transfer = notRun("No wallet holds this coin yet");
    return tests;
  }
  const amount = holder.amount / 10n || 1n;
  tests.sell = await guard(async () => {
    const sell = await simulate(
      await buildSwapInstructions({
        ctx,
        owner: holder.owner,
        payer: SIM_BUYER,
        side: "sell",
        amountIn: amount,
      }),
      SIM_BUYER,
    );
    const sdkSell = sell.ok
      ? await buildSwapInstructions({
          ctx,
          owner: holder.owner,
          payer: SIM_BUYER,
          side: "sell",
          amountIn: amount,
          resolution: "sdk",
        })
          .then((ixs) => simulate(ixs, SIM_BUYER))
          .catch(
            (e) =>
              ({
                ok: false,
                reason: `the SDK can't build this sell (${e?.name || e?.message || "error"})`,
                logs: [],
              }) as unknown as SimResult,
          )
      : null;
    const hs = hookReason(sell, hook);
    return {
      ran: true,
      ok: sell.ok,
      reason: hs.reason,
      blockedByHook: hs.byHook,
      wallet: holder.owner.toBase58(),
      sdkOk: sdkSell ? sdkSell.ok : undefined,
      sdkReason: sdkSell && !sdkSell.ok ? (sdkSell.logs.length ? hookReason(sdkSell, hook).reason : sdkSell.reason) : null,
    };
  });

  tests.transfer = await guard(async () => {
    const friend = Keypair.generate().publicKey;
    const friendAta = getAssociatedTokenAddressSync(ctx.baseMint, friend, false, TOKEN_2022_PROGRAM_ID);
    const xfer = await simulate(
      [
        createAssociatedTokenAccountIdempotentInstruction(SIM_BUYER, friendAta, friend, ctx.baseMint, TOKEN_2022_PROGRAM_ID),
        await createTransferCheckedWithTransferHookInstruction(
          withVirtualTokenAccounts(connection(), ctx.baseMint, new Map([[friendAta.toBase58(), friend]])),
          holder.tokenAccount,
          ctx.baseMint,
          friendAta,
          holder.owner,
          amount,
          ctx.baseDecimals,
          [],
          "confirmed",
          TOKEN_2022_PROGRAM_ID,
        ),
      ],
      SIM_BUYER,
    );
    const hx = hookReason(xfer, hook);
    return {
      ran: true,
      ok: xfer.ok,
      reason: hx.reason,
      blockedByHook: hx.byHook,
      wallet: holder.owner.toBase58(),
    };
  });
  return tests;
}

export function judge(
  r: Omit<CoinReport, "status" | "headline" | "flags">,
  slot: number,
): Pick<CoinReport, "status" | "headline" | "flags"> {
  const { pool, mint, hook, tests } = r;
  const flags: Flag[] = [];

  if (mint.mintAuthority)
    flags.push({
      level: "danger",
      text: `More of this coin can still be minted (mint authority ${short(mint.mintAuthority)})`,
    });
  if (mint.freezeAuthority)
    flags.push({
      level: "danger",
      text: `Your tokens can be frozen (freeze authority ${short(mint.freezeAuthority)})`,
    });
  if (mint.permanentDelegate)
    flags.push({
      level: "danger",
      text: `A permanent delegate can move tokens out of any wallet (${short(mint.permanentDelegate)})`,
    });
  if (mint.pausable) flags.push({ level: "danger", text: "All transfers can be paused" });
  if (mint.defaultFrozen) flags.push({ level: "warn", text: "New token accounts start frozen" });
  if (mint.transferFeeBps > 0)
    flags.push({
      level: "warn",
      text: `Every transfer pays a ${mint.transferFeeBps / 100}% fee`,
    });

  if (mint.hookProgram && !mint.hookAuthorityIsDbc && pool.phase !== "graduated") {
    flags.push({
      level: "danger",
      text: `Hook authority is ${short(mint.hookAuthority ?? "none")}, not Meteora's pool authority: the hook may survive graduation`,
    });
  }
  if (hook) {
    if (hook.upgradeable) {
      const byCreator = hook.upgradeAuthority === pool.creator;
      flags.push({
        level: byCreator ? "danger" : "warn",
        text: byCreator
          ? `The coin's creator holds the hook's upgrade key and can rewrite its rules at any time`
          : `The hook's rules can be rewritten by ${short(hook.upgradeAuthority!)} at any time`,
      });
      if (hook.lastDeploySlot && slot - hook.lastDeploySlot < 3 * SLOTS_PER_DAY) {
        const hours = Math.round(((slot - hook.lastDeploySlot) * 0.4) / 3600);
        flags.push({
          level: "warn",
          text: `The hook's code was redeployed ${hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`} ago`,
        });
      }
    } else if (hook.closed) {
      flags.push({ level: "danger", text: "The hook program was closed by its owner. No transfer of this coin can ever succeed again" });
    } else if (hook.exists) {
      flags.push({ level: "good", text: "The hook program is immutable; its rules cannot change" });
    } else {
      flags.push({ level: "danger", text: "The hook program does not exist on chain" });
    }
    const powers = hook.instructions.filter((i) => /unlock|lock|add|remove|set|pause|block|allow|admin|authority|freeze/i.test(i));
    if (powers.length)
      flags.push({
        level: "warn",
        text: `Hook admin controls: ${powers.join(", ")}`,
      });
  }

  if (pool.phase === "graduated") {
    return {
      status: "graduated",
      headline: "Graduated. The hook is revoked and the coin trades freely on Meteora DAMM v2.",
      flags,
    };
  }
  if (pool.phase === "complete") {
    return {
      status: "complete",
      headline: "The curve is full and waiting to migrate to DAMM v2. No trades until then.",
      flags,
    };
  }
  const { buy, sell, transfer } = tests;
  if (hook?.closed || (hook && !hook.exists)) {
    return { status: "broken", headline: "The hook program was closed, so this coin can never be bought, sold or moved again.", flags };
  }
  const ran = [buy, sell, transfer].filter((t) => t.ran);
  const failedSys = ran.filter((t) => !t.ok && isSystemFailure(t.reason));
  if (ran.length && failedSys.length === ran.length) {
    return { status: "broken", headline: `The hook fails on every transfer, so nothing moves: ${failedSys[0].reason}`, flags };
  }
  const refused = (t: TestResult) => t.ran && !t.ok && t.blockedByHook;
  if (refused(buy)) {
    const everything = refused(sell) && refused(transfer);
    return {
      status: "pad-only",
      headline: everything
        ? `Every buy, sell and transfer needs the launchpad. The hook says: "${buy.reason}"`
        : `Outside wallets can't buy. The hook says: "${buy.reason}"`,
      flags,
    };
  }
  if (refused(sell)) {
    return { status: "sell-blocked", headline: `A real holder can't sell right now. The hook says: "${sell.reason}"`, flags };
  }
  if (buy.ok && sell.ok) return { status: "open", headline: "Anyone can buy and real holders can sell. Trade it here.", flags };
  if (buy.ok && !sell.ran) return { status: "open", headline: "Anyone can buy. No holder to test a sell with yet.", flags };
  return { status: "untested", headline: buy.reason ?? sell.reason ?? "Could not complete the tests", flags };
}

const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export async function scanCoin(addr: string): Promise<CoinReport> {
  const conn = connection();
  const poolPk = await resolvePool(addr);
  const [poolAcc, slot] = await Promise.all([retry(() => conn.getAccountInfo(poolPk)), retry(() => conn.getSlot("confirmed"))]);
  if (!poolAcc) throw new Error("Pool account not found");
  const pool = decodePool(poolPk.toBase58(), poolAcc.data);
  const mintPk = new PublicKey(pool.mint);
  const mintAcc = await retry(() => conn.getAccountInfo(mintPk));
  if (!mintAcc) throw new Error("Mint not found");
  const mint = readMint(mintPk, mintAcc);
  const [hook, ctx, jupiter] = await Promise.all([
    mint.hookProgram ? inspectHookProgram(mint.hookProgram) : Promise.resolve(null),
    poolContext(poolPk, mint.decimals),
    jupiterCheck(pool.mint),
  ]);
  const tests = mint.hookProgram || pool.phase === "curve" ? await runTests(ctx, pool, hook) : await runTests(ctx, pool, null);
  const partial = {
    scannedAt: Date.now(),
    slot,
    pool,
    mint,
    hook,
    tests,
    jupiter,
  };
  return { ...partial, ...judge(partial, slot) };
}
