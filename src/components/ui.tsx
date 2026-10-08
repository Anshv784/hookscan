import Link from "next/link";
import type { Level, Status } from "@/lib/core/scan";

export const STATUS: Record<Status | "revoked", { label: string; tone: "green" | "amber" | "red" | "muted" | "blue"; blurb: string }> = {
  open: { label: "Open", tone: "green", blurb: "Anyone can buy and holders can sell" },
  "pad-only": { label: "Gated", tone: "amber", blurb: "The hook refuses outside buyers" },
  "sell-blocked": { label: "Sell blocked", tone: "red", blurb: "A real holder's sell is refused right now" },
  broken: { label: "Frozen", tone: "red", blurb: "Hook closed or crashing; nothing moves" },
  graduated: { label: "Graduated", tone: "blue", blurb: "Hook revoked; trades on DAMM v2" },
  revoked: { label: "Graduated", tone: "blue", blurb: "Hook revoked; trades on DAMM v2" },
  complete: { label: "Migrating", tone: "muted", blurb: "Curve full, waiting to migrate" },
  untested: { label: "Untested", tone: "muted", blurb: "No live pool to test" },
};

const TONE = {
  green: "text-green border-green/30 bg-green-bg",
  amber: "text-amber border-amber/30 bg-amber/10",
  red: "text-red border-red/30 bg-red-bg",
  blue: "text-blue border-blue/30 bg-blue/10",
  muted: "text-ink-2 border-line bg-panel-2",
};

export function StatusChip({ status, size = "sm" }: { status: Status | "revoked"; size?: "sm" | "lg" }) {
  const s = STATUS[status] ?? STATUS.untested;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border font-medium ${TONE[s.tone]} ${
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export const LEVEL_TONE: Record<Level, string> = {
  danger: "text-red",
  warn: "text-amber",
  info: "text-ink-2",
  good: "text-green",
};

export function LevelGlyph({ level }: { level: Level }) {
  const glyph = { danger: "✕", warn: "!", info: "i", good: "✓" }[level];
  return (
    <span
      className={`num mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-current text-[10px] ${LEVEL_TONE[level]}`}
      aria-label={level}
    >
      {glyph}
    </span>
  );
}

export function short(k: string, n = 4) {
  return k.length > 2 * n + 1 ? `${k.slice(0, n)}…${k.slice(-n)}` : k;
}

export function Addr({ value, kind = "account", n = 4 }: { value: string; kind?: "account" | "token"; n?: number }) {
  return (
    <a
      href={`https://solscan.io/${kind}/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
      className="num text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink-3"
    >
      {short(value, n)}
    </a>
  );
}

export function SectionHead({ id, kicker, title, children }: { id?: string; kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-20 flex-col gap-1.5">
      <span className="num text-[11px] uppercase tracking-[0.14em] text-amber">{kicker}</span>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {children && <p className="max-w-2xl text-sm text-ink-2">{children}</p>}
    </div>
  );
}

export function sol(lamports: string | bigint | number, digits = 2) {
  const n = Number(BigInt(lamports)) / 1e9;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: n > 0 && n < 1 ? 2 : 0 });
}

export function Progress({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-3">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="block h-full bg-amber" style={{ width: `${Math.max(2, value * 100)}%` }} />
      </span>
      <span className="num text-ink-2">{(value * 100).toFixed(value < 0.1 ? 1 : 0)}%</span>
    </span>
  );
}

export function HookName({ program, label }: { program: string; label: string | null }) {
  return (
    <Link href={`/hook/${program}`} className="group flex flex-col">
      <span className="font-medium text-ink group-hover:text-amber">{label ?? "unnamed hook"}</span>
      <span className="num text-[11px] text-ink-3">{short(program, 4)}</span>
    </Link>
  );
}
