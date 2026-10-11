import { AccountInfo, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { BPF_UPGRADEABLE_LOADER } from "./constants";

/** hookguard program (programs/hookguard). Same id on devnet and the mainnet fork tests. */
export const HOOKGUARD_PROGRAM = new PublicKey("C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv");

export const GUARD_STATUS = { open: 1, gated: 2, "sell-blocked": 3, frozen: 4 } as const;
export type GuardStatus = keyof typeof GUARD_STATUS;

export const GUARD_ERRORS: Record<number, string> = {
  0x48470000: "InvalidInstruction",
  0x48470001: "BadStatus",
  0x48470002: "NotExecutable",
  0x48470003: "HookClosed: the hook program was closed",
  0x48470004: "WrongProgramData",
  0x48470005: "WrongVerdictAccount",
  0x48470006: "WrongAttester: verdict is not from the attester you trust",
  0x48470007: "WrongHook",
  0x48470008: "HookChanged: the hook was redeployed after it was checked",
  0x48470009: "AuthorityChanged: the hook's upgrade key changed after it was checked",
  0x4847000a: "StatusNotAllowed: the hook's verdict is not one you accept",
  0x4847000b: "VerdictStale: the verdict is older than you allow",
};

export function verdictAddress(attester: PublicKey, hook: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("verdict"), attester.toBuffer(), hook.toBuffer()], HOOKGUARD_PROGRAM)[0];
}

/** The account hookguard reads a hook's identity from: its programdata if upgradeable, else the program itself. */
export function identityAccount(hook: PublicKey, hookAccount: AccountInfo<Buffer>): PublicKey {
  if (hookAccount.owner.equals(BPF_UPGRADEABLE_LOADER) && hookAccount.data.length >= 36)
    return new PublicKey(hookAccount.data.subarray(4, 36));
  return hook;
}

export function setVerdictIx(
  attester: PublicKey,
  hook: PublicKey,
  programdata: PublicKey,
  status: GuardStatus,
  reportHash: Buffer = Buffer.alloc(32),
): TransactionInstruction {
  return new TransactionInstruction({
    programId: HOOKGUARD_PROGRAM,
    keys: [
      { pubkey: attester, isSigner: true, isWritable: true },
      { pubkey: verdictAddress(attester, hook), isSigner: false, isWritable: true },
      { pubkey: hook, isSigner: false, isWritable: false },
      { pubkey: programdata, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([0, GUARD_STATUS[status]]), reportHash.subarray(0, 32)]),
  });
}

/**
 * Put this in the same transaction as a swap. The transaction fails unless `attester` attested
 * `hook` with one of `allow`, and the hook is still the exact build (and upgrade key) it attested.
 */
export function assertHookIx(
  attester: PublicKey,
  hook: PublicKey,
  programdata: PublicKey,
  allow: GuardStatus[] = ["open"],
  maxAgeSlots = 0n,
): TransactionInstruction {
  const mask = allow.reduce((m, s) => m | (1 << GUARD_STATUS[s]), 0);
  const age = Buffer.alloc(8);
  age.writeBigUInt64LE(maxAgeSlots);
  return new TransactionInstruction({
    programId: HOOKGUARD_PROGRAM,
    keys: [
      { pubkey: verdictAddress(attester, hook), isSigner: false, isWritable: false },
      { pubkey: hook, isSigner: false, isWritable: false },
      { pubkey: programdata, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([1]), attester.toBuffer(), Buffer.from([mask]), age]),
  });
}

export interface Verdict {
  status: GuardStatus;
  attester: string;
  hook: string;
  programdata: string;
  authority: string | null;
  deploySlot: number;
  attestedSlot: number;
}

export function decodeVerdict(data: Buffer): Verdict | null {
  if (data.length < 188 || data.subarray(0, 8).toString() !== "HKVERDCT") return null;
  const status = (Object.keys(GUARD_STATUS) as GuardStatus[]).find((k) => GUARD_STATUS[k] === data[9]) ?? "frozen";
  const auth = new PublicKey(data.subarray(108, 140));
  return {
    status,
    attester: new PublicKey(data.subarray(12, 44)).toBase58(),
    hook: new PublicKey(data.subarray(44, 76)).toBase58(),
    programdata: new PublicKey(data.subarray(76, 108)).toBase58(),
    authority: auth.equals(PublicKey.default) ? null : auth.toBase58(),
    deploySlot: Number(data.readBigUInt64LE(140)),
    attestedSlot: Number(data.readBigUInt64LE(148)),
  };
}
