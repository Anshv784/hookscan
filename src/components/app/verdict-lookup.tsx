"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { decodeVerdict, verdictAddress, type Verdict } from "@/lib/core/guard";

const DEVNET = "https://api.devnet.solana.com";

async function getAccount(key: string): Promise<{ data: Buffer; slot: number } | null> {
  const r = await fetch(DEVNET, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [key, { encoding: "base64" }] }),
  });
  const j = await r.json();
  const v = j.result?.value;
  return v ? { data: Buffer.from(v.data[0], "base64"), slot: j.result.context.slot } : null;
}

/** Reads a hookguard verdict from devnet and checks it against the hook's live programdata. */
export function VerdictLookup({ attester: a0, hook: h0 }: { attester: string; hook: string }) {
  const [attester, setAttester] = useState(a0);
  const [hook, setHook] = useState(h0);
  const [state, setState] = useState<{ verdict: Verdict; address: string; live: number | null; slot: number } | { error: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  async function look(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    try {
      const address = verdictAddress(new PublicKey(attester.trim()), new PublicKey(hook.trim())).toBase58();
      const acc = await getAccount(address);
      if (!acc) throw new Error("No verdict from this attester for this hook on devnet.");
      const verdict = decodeVerdict(acc.data);
      if (!verdict) throw new Error("Account is not a hookguard verdict.");
      let live: number | null = null;
      if (verdict.programdata !== PublicKey.default.toBase58()) {
        const pd = await getAccount(verdict.programdata);
        live = pd && pd.data.length > 12 ? Number(pd.data.readBigUInt64LE(4)) : null;
      }
      setState({ verdict, address, live, slot: acc.slot });
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const input = "h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary";
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={look} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Attester
          <input className={input} value={attester} onChange={(e) => setAttester(e.target.value)} spellCheck={false} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hook program
          <input className={input} value={hook} onChange={(e) => setHook(e.target.value)} spellCheck={false} />
        </label>
        <button
          disabled={busy}
          className="h-10 self-end rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Reading…" : "Read verdict"}
        </button>
      </form>
      {state && "error" in state && <p className="text-sm text-red">{state.error}</p>}
      {state && "verdict" in state && (
        <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border text-sm sm:grid-cols-2">
          {(
            [
              ["Verdict account", state.address],
              ["Status", state.verdict.status],
              ["Pinned deploy slot", state.verdict.deploySlot.toLocaleString("en-US")],
              ["Live deploy slot", state.live === null ? "immutable" : state.live.toLocaleString("en-US")],
              ["Upgrade key", state.verdict.authority ?? "none"],
              ["assert_hook would", state.live === null || state.live === state.verdict.deploySlot ? "pass ✓" : "revert: HookChanged ✕"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 bg-card p-4">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
