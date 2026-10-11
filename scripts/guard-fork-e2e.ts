/**
 * hookguard end to end on a Surfpool fork of mainnet, against a real DBC transfer-hook pool.
 *
 *   surfpool start --rpc-url <mainnet rpc> --no-tui --airdrop <trader>
 *   solana program deploy programs/hookguard/target/deploy/hookguard.so --program-id programs/hookguard/target/deploy/hookguard-keypair.json -u http://localhost:8899
 *   RPC_URL=http://localhost:8899 bun scripts/guard-fork-e2e.ts <trader keypair> <pool>
 *
 * 1. attest the pool's hook as "open"  2. guarded buy succeeds  3. the hook is "redeployed"
 * 4. guarded buy reverts with HookChanged while an unguarded buy still goes through  5. re-attest, guarded buy works again
 */
import { Keypair, PublicKey, TransactionInstruction, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "fs";
import { connection } from "../src/lib/core/rpc";
import { buildSwapInstructions, poolContext } from "../src/lib/core/swap";
import { GUARD_ERRORS, assertHookIx, decodeVerdict, identityAccount, setVerdictIx, verdictAddress } from "../src/lib/core/guard";

const conn = connection();
const trader = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.argv[2], "utf8"))));
const pool = new PublicKey(process.argv[3]);

async function send(label: string, ixs: TransactionInstruction[]) {
  const { blockhash } = await conn.getLatestBlockhash();
  const tx = new VersionedTransaction(
    new TransactionMessage({ payerKey: trader.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(),
  );
  tx.sign([trader]);
  try {
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, "confirmed");
    console.log(`  ✓ ${label}  ${sig.slice(0, 16)}…`);
    return true;
  } catch (e: unknown) {
    const msg = String((e as Error).message ?? e);
    const code = msg.match(/custom program error: 0x([0-9a-f]+)/i);
    console.log(`  ✕ ${label}  ${code ? (GUARD_ERRORS[parseInt(code[1], 16)] ?? `0x${code[1]}`) : msg.slice(0, 160)}`);
    return false;
  }
}

async function balance(ata: PublicKey) {
  const b = await conn.getTokenAccountBalance(ata).catch(() => null);
  return b ? b.value.uiAmountString : "0";
}

const ctx = await poolContext(pool);
const mintInfo = await conn.getAccountInfo(ctx.baseMint);
const { getTransferHook, unpackMint } = await import("@solana/spl-token");
const hook = getTransferHook(unpackMint(ctx.baseMint, mintInfo!, TOKEN_2022_PROGRAM_ID))!.programId;
const hookAcc = (await conn.getAccountInfo(hook))!;
const programdata = identityAccount(hook, hookAcc);
const ata = getAssociatedTokenAddressSync(ctx.baseMint, trader.publicKey, false, TOKEN_2022_PROGRAM_ID);
const buy = () => buildSwapInstructions({ ctx, owner: trader.publicKey, side: "buy", amountIn: 100_000_000n });
const guard = () => assertHookIx(trader.publicKey, hook, programdata, ["open"]);

console.log(`pool ${pool.toBase58()}\nhook ${hook.toBase58()}  programdata ${programdata.toBase58()}\n`);

console.log("1. attest the hook as open");
await send("set_verdict(open)", [setVerdictIx(trader.publicKey, hook, programdata, "open")]);
const v = decodeVerdict((await conn.getAccountInfo(verdictAddress(trader.publicKey, hook)))!.data)!;
console.log(`  verdict pinned deploy slot ${v.deploySlot}, upgrade key ${v.authority}`);

console.log("2. guarded buy, 0.1 SOL");
await send("assert_hook + swap2_with_transfer_hook", [guard(), ...(await buy())]);
console.log(`  balance ${await balance(ata)}`);

console.log("3. the hook's owner redeploys it (fork cheatcode bumps the programdata deploy slot)");
const pd = (await conn.getAccountInfo(programdata))!;
const data = Buffer.from(pd.data);
data.writeBigUInt64LE(data.readBigUInt64LE(4) + 1n, 4);
await fetch(process.env.RPC_URL!, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_setAccount",
    params: [programdata.toBase58(), { lamports: pd.lamports, data: data.toString("hex"), owner: pd.owner.toBase58(), executable: false }],
  }),
});

console.log("4. same trades after the redeploy");
await send("guarded buy", [guard(), ...(await buy())]);
await send("unguarded buy", await buy());
console.log(`  balance ${await balance(ata)}`);

console.log("5. HookScan re-tests the new build and attests it again");
await send("set_verdict(open)", [setVerdictIx(trader.publicKey, hook, programdata, "open")]);
await send("guarded buy", [guard(), ...(await buy())]);
console.log(`  balance ${await balance(ata)}`);
