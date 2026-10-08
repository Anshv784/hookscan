import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { createHash } from "crypto";

export function discriminator(account: string): Buffer {
  return createHash("sha256").update(`account:${account}`).digest().subarray(0, 8);
}

export const TRANSFER_HOOK_POOL_DISC = bs58.encode(discriminator("TransferHookPool"));
export const POOL_ACCOUNT_SIZE = 424;

/**
 * Byte offsets inside a DBC pool account (VirtualPool and TransferHookPool share PoolState).
 * 8 discriminator + 64 VolatilityTracker, then the fields below in order.
 */
const O = {
  config: 72,
  creator: 104,
  baseMint: 136,
  baseVault: 168,
  quoteVault: 200,
  baseReserve: 232,
  quoteReserve: 240,
  sqrtPrice: 280,
  activationPoint: 296,
  poolType: 304,
  isMigrated: 305,
  migrationProgress: 308,
  finishCurveTimestamp: 344,
} as const;

export type Phase = "curve" | "complete" | "graduated";

export interface PoolRecord {
  pool: string;
  config: string;
  creator: string;
  mint: string;
  baseVault: string;
  quoteVault: string;
  baseReserve: string;
  quoteReserve: string;
  sqrtPrice: string;
  phase: Phase;
  finishedAt: number | null;
}

const key = (d: Buffer, o: number) => new PublicKey(d.subarray(o, o + 32)).toBase58();

export function decodePool(pubkey: string, d: Buffer): PoolRecord {
  const isMigrated = d[O.isMigrated];
  const progress = d[O.migrationProgress];
  const finish = Number(d.readBigUInt64LE(O.finishCurveTimestamp));
  const sqrtLo = d.readBigUInt64LE(O.sqrtPrice);
  const sqrtHi = d.readBigUInt64LE(O.sqrtPrice + 8);
  return {
    pool: pubkey,
    config: key(d, O.config),
    creator: key(d, O.creator),
    mint: key(d, O.baseMint),
    baseVault: key(d, O.baseVault),
    quoteVault: key(d, O.quoteVault),
    baseReserve: d.readBigUInt64LE(O.baseReserve).toString(),
    quoteReserve: d.readBigUInt64LE(O.quoteReserve).toString(),
    sqrtPrice: ((sqrtHi << 64n) | sqrtLo).toString(),
    phase: isMigrated ? "graduated" : progress > 0 || finish > 0 ? "complete" : "curve",
    finishedAt: finish > 0 ? finish : null,
  };
}
