import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { connection, retry } from "./rpc";
import { toTransaction } from "./swap";

export interface SimResult {
  ok: boolean;
  /** Short plain reason when it failed, taken from the failing program's own log. */
  reason: string | null;
  /** Program that failed (hook, DBC, Token-2022...). */
  failedProgram: string | null;
  customCode: number | null;
  unitsConsumed: number | null;
  logs: string[];
  /** Post-simulation account data for accounts requested in `watch`. */
  post: (Buffer | null)[];
  postLamports: (number | null)[];
}

const GENERIC_LOG =
  /^(Instruction: |CreateIdempotent|Initialize the associated token account|Create|Please upgrade|Transfer|TransferChecked|SyncNative|CloseAccount|GetAccountDataSize|InitializeImmutableOwner)/;

export function explainFailure(logs: string[]): { reason: string | null; failedProgram: string | null; customCode: number | null } {
  const failIdx = logs.findIndex((l) => / failed: /.test(l));
  if (failIdx < 0) return { reason: null, failedProgram: null, customCode: null };
  // The innermost failure is the first "failed" line; its program is the culprit.
  const m = logs[failIdx].match(/^Program (\w+) failed: (.*)$/);
  const failedProgram = m?.[1] ?? null;
  const raw = m?.[2] ?? logs[failIdx];
  const code = raw.match(/custom program error: 0x([0-9a-f]+)/i);
  // Walk back to the nearest meaningful "Program log:" line written by that invocation.
  let reason: string | null = null;
  for (let i = failIdx - 1; i >= 0; i--) {
    const l = logs[i];
    if (/^Program \w+ invoke \[/.test(l) && l.includes(failedProgram ?? "~")) break;
    const lm = l.match(/^Program log: (.*)$/);
    if (!lm) continue;
    const msg = lm[1].trim();
    if (GENERIC_LOG.test(msg)) continue;
    const anchor = msg.match(/Error Message: (.*?)\.?$/);
    reason = anchor ? anchor[1] : msg;
    // Rust panics log "panicked at file:line:col:" with the message on the following raw line.
    if (/^panicked at /.test(reason)) {
      const next = logs[i + 1] && !logs[i + 1].startsWith("Program ") ? logs[i + 1].trim() : "";
      reason = `panicked: ${reason.replace(/^panicked at .*?:\d+:\d+:\s*/, "")}${next}`.trim();
    }
    break;
  }
  if (!reason) reason = raw;
  return { reason: reason.slice(0, 240), failedProgram, customCode: code ? parseInt(code[1], 16) : null };
}

export async function simulate(ixs: TransactionInstruction[], payer: PublicKey, watch: PublicKey[] = []): Promise<SimResult> {
  const tx = await toTransaction(ixs, payer);
  const res = await retry(() =>
    connection().simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
      accounts: watch.length ? { encoding: "base64", addresses: watch.map((w) => w.toBase58()) } : undefined,
    }),
  );
  const v = res.value;
  const logs = v.logs ?? [];
  const failure = v.err ? explainFailure(logs) : { reason: null, failedProgram: null, customCode: null };
  if (v.err && !failure.reason) failure.reason = JSON.stringify(v.err);
  return {
    ok: !v.err,
    ...failure,
    unitsConsumed: v.unitsConsumed ?? null,
    logs,
    post: (v.accounts ?? []).map((a) => (a ? Buffer.from(a.data[0], "base64") : null)),
    postLamports: (v.accounts ?? []).map((a) => (a ? a.lamports : null)),
  };
}
