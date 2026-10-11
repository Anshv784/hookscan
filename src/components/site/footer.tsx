import Link from "next/link";
import { HOOKGUARD_DEVNET, Logo, REPO, SDK_ISSUE } from "./brand";

const COLS = [
  {
    title: "Product",
    links: [
      ["App", "/app"],
      ["Coins", "/app/coins"],
      ["Hooks", "/app/hooks"],
      ["hookguard", "/app/guard"],
    ],
  },
  {
    title: "Docs",
    links: [
      ["Introduction", "/docs"],
      ["Verdicts", "/docs/verdicts"],
      ["hookguard", "/docs/hookguard"],
      ["API", "/docs/api"],
    ],
  },
  {
    title: "Proof",
    links: [
      ["Source code", REPO],
      ["SDK bug report", SDK_ISSUE],
      ["hookguard on devnet", HOOKGUARD_DEVNET],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-6">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            Reads the rules every Meteora DBC transfer-hook coin enforces, tests them on mainnet, and guards the trade on-chain.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title} className="flex flex-col gap-3 text-sm">
            <p className="font-medium">{c.title}</p>
            {c.links.map(([label, href]) =>
              href.startsWith("http") ? (
                <a key={label} href={href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  {label}
                </a>
              ) : (
                <Link key={label} href={href} className="text-muted-foreground hover:text-foreground">
                  {label}
                </Link>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto w-full max-w-6xl border-t border-border px-4 py-5 text-xs text-ink-3 md:px-6">
        Scans are simulations against Solana mainnet. Nothing is sent without your signature.
      </div>
    </footer>
  );
}
