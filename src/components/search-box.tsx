"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!BASE58.test(v)) {
      setBad(true);
      return;
    }
    router.push(`/coin/${v}`);
  }

  return (
    <form onSubmit={go} className="relative" role="search">
      <label htmlFor={compact ? "q-compact" : "q"} className="sr-only">
        Mint or pool address
      </label>
      <input
        id={compact ? "q-compact" : "q"}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setBad(false);
        }}
        spellCheck={false}
        autoComplete="off"
        placeholder={compact ? "Scan a mint or pool…" : "Paste a mint or DBC pool address"}
        aria-invalid={bad}
        className={`num w-full rounded-md border bg-panel text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-amber ${
          bad ? "border-red" : "border-line"
        } ${compact ? "h-9 px-3 text-xs" : "h-12 px-4 pr-28 text-sm"}`}
      />
      {!compact && (
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 h-9 rounded bg-amber px-4 text-sm font-medium text-amber-ink transition-[filter] hover:brightness-110"
        >
          Scan
        </button>
      )}
      {bad && !compact && <p className="mt-2 text-xs text-red">That isn&apos;t a Solana address.</p>}
    </form>
  );
}
