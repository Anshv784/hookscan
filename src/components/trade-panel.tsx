"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useEffect, useState } from "react";
import type { CoinReport } from "@/lib/core/scan";
import type { BuildSwapResult } from "@/lib/core/trade";

type Side = "buy" | "sell";

function toRaw(ui: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(ui) || ui === "" || ui === ".") return null;
  const [w, f = ""] = ui.split(".");
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0");
}

function fromRaw(raw: string | bigint, decimals: number, digits = 6) {
  const v = Number(BigInt(raw)) / 10 ** decimals;
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function TradePanel({ report }: { report: CoinReport }) {
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("0.05");
  const [slip, setSlip] = useState(300);
  const [quote, setQuote] = useState<BuildSwapResult | null>(null);
  const [busy, setBusy] = useState<"quote" | "send" | null>(null);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "ink"; text: string; sig?: string } | null>(null);
  const [bal, setBal] = useState<{ lamports: number; token: string } | null>(null);

  const decimals = report.mint.decimals;
  const symbol = report.mint.symbol ?? "tokens";
  const tradable = report.pool.phase === "curve" && report.tests.buy.ok;
  const canSell = report.pool.phase === "curve" && (report.tests.sell.ok || !report.tests.sell.ran);

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/balance?owner=${publicKey.toBase58()}&mint=${report.mint.mint}`)
      .then((r) => r.json())
      .then((j) => !j.error && setBal(j))
      .catch(() => {});
  }, [publicKey, report.mint.mint, msg]);

  // Any change to the trade invalidates the last simulation.
  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setQuote(null);
      setMsg(null);
    };
  }
  const changeSide = edit(setSide);
  const changeAmount = edit(setAmount);
  const changeSlip = edit(setSlip);
  const balance = publicKey ? bal : null;

  const rawAmount = side === "buy" ? toRaw(amount, 9) : toRaw(amount, decimals);

  async function review() {
    if (!publicKey || !rawAmount) return;
    setBusy("quote");
    setMsg(null);
    try {
      const r = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pool: report.pool.pool,
          owner: publicKey.toBase58(),
          side,
          amount: rawAmount.toString(),
          slippageBps: slip,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setQuote(j);
      if (!j.ok) setMsg({ tone: "red", text: j.reason ?? "The simulation failed for your wallet" });
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!quote?.transaction || !signTransaction) return;
    setBusy("send");
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(quote.transaction, "base64"));
      const signed = await signTransaction(tx);
      const r = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tx: Buffer.from(signed.serialize()).toString("base64") }),
      });
      const j = await r.json();
      if (j.error) throw Object.assign(new Error(j.error), { sig: j.signature });
      setMsg({ tone: "green", text: "Confirmed", sig: j.signature });
      setQuote(null);
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : String(e), sig: (e as { sig?: string }).sig });
    } finally {
      setBusy(null);
    }
  }

  const disabledReason =
    report.pool.phase === "graduated"
      ? "Graduated coins trade on Meteora DAMM v2 and route through Jupiter."
      : report.pool.phase === "complete"
        ? "The curve is full. Trading resumes on DAMM v2 after migration."
        : !tradable
          ? "The hook refuses outside buyers, so HookScan won't build a trade for this coin."
          : null;

  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="grid grid-cols-2 border-b border-line text-sm" role="tablist">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            onClick={() => {
              changeSide(s);
              changeAmount(s === "buy" ? "0.05" : "");
            }}
            className={`h-11 font-medium capitalize transition-colors ${side === s ? (s === "buy" ? "text-green" : "text-red") + " bg-bg" : "text-ink-3 hover:text-ink"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="p-5">
        {disabledReason ? (
          <p className="text-sm text-ink-2">{disabledReason}</p>
        ) : side === "sell" && !canSell ? (
          <p className="text-sm text-ink-2">
            A real holder&apos;s sell was refused by the hook. HookScan will still simulate yours before you sign.
          </p>
        ) : null}

        {!disabledReason && (
          <>
            <label className="mt-1 block text-xs text-ink-3" htmlFor="amt">
              {side === "buy" ? "You pay (SOL)" : `You sell (${symbol})`}
            </label>
            <div className="mt-1.5 flex items-center rounded-md border border-line bg-bg focus-within:border-amber">
              <input
                id="amt"
                inputMode="decimal"
                value={amount}
                onChange={(e) => changeAmount(e.target.value.replace(",", "."))}
                className="num h-11 w-full bg-transparent px-3 text-lg outline-none"
                placeholder="0.0"
              />
              <span className="num px-3 text-sm text-ink-3">{side === "buy" ? "SOL" : symbol}</span>
            </div>
            {balance && (
              <div className="num mt-1.5 flex justify-between text-[11px] text-ink-3">
                <span>
                  balance{" "}
                  {side === "buy" ? `${fromRaw(String(balance.lamports), 9, 4)} SOL` : `${fromRaw(balance.token, decimals, 2)} ${symbol}`}
                </span>
                {side === "sell" && BigInt(balance.token) > 0n && (
                  <span className="flex gap-2">
                    {[25, 50, 100].map((p) => (
                      <button
                        key={p}
                        className="hover:text-amber"
                        onClick={() =>
                          changeAmount(fromRaw((BigInt(balance.token) * BigInt(p)) / 100n, decimals, decimals).replace(/,/g, ""))
                        }
                      >
                        {p}%
                      </button>
                    ))}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs text-ink-3">
              <span>Max slippage</span>
              <span className="flex gap-1">
                {[100, 300, 1000].map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSlip(s)}
                    className={`num rounded px-2 py-1 ${slip === s ? "bg-panel-2 text-ink" : "hover:text-ink"}`}
                  >
                    {s / 100}%
                  </button>
                ))}
              </span>
            </div>

            {quote?.ok && quote.expectedOut && (
              <dl className="num mt-4 space-y-1.5 rounded-md border border-line bg-bg p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Simulated for your wallet</dt>
                  <dd className="text-ink">
                    {fromRaw(quote.expectedOut, quote.outDecimals)} {side === "buy" ? symbol : "SOL"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Minimum received</dt>
                  <dd>{fromRaw(quote.minimumOut!, quote.outDecimals)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Route</dt>
                  <dd>Meteora DBC · swap2_with_transfer_hook</dd>
                </div>
              </dl>
            )}

            {msg && (
              <p
                className={`mt-3 break-words text-xs ${msg.tone === "red" ? "text-red" : msg.tone === "green" ? "text-green" : "text-ink-2"}`}
              >
                {msg.text}{" "}
                {msg.sig && (
                  <a className="underline" href={`https://solscan.io/tx/${msg.sig}`} target="_blank" rel="noreferrer">
                    view transaction
                  </a>
                )}
              </p>
            )}

            {!publicKey ? (
              <button
                onClick={() => setVisible(true)}
                className="mt-4 h-11 w-full rounded-md bg-amber font-medium text-amber-ink transition-[filter] hover:brightness-110"
              >
                Connect wallet
              </button>
            ) : quote?.ok ? (
              <button
                onClick={send}
                disabled={busy !== null}
                className="mt-4 h-11 w-full rounded-md bg-amber font-medium text-amber-ink transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                {busy === "send" ? "Waiting for confirmation…" : `Sign & ${side}`}
              </button>
            ) : (
              <button
                onClick={review}
                disabled={busy !== null || !rawAmount}
                className="mt-4 h-11 w-full rounded-md border border-line-strong font-medium transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
              >
                {busy === "quote" ? "Simulating your trade…" : "Simulate my trade"}
              </button>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              Every trade is simulated for your exact wallet first, with the hook&apos;s accounts resolved for you. If the hook would refuse
              it, you see why before signing.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
