import Link from "next/link";

export const REPO = "https://github.com/Anshv784/hookscan";
export const SDK_ISSUE = "https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/issues/122";
export const HOOKGUARD_DEVNET = "https://explorer.solana.com/address/C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv?cluster=devnet";

export function Mark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <defs>
        <linearGradient id="hs-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5bd00" />
          <stop offset="0.45" stopColor="#f54b00" />
          <stop offset="1" stopColor="#6e45ff" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="19" height="19" rx="6" fill="url(#hs-mark)" />
      <path d="M7 4.5v6.5a3 3 0 0 0 6 0V9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.4 10.4 13 8.8l1.6 1.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Mark />
      HookScan
    </Link>
  );
}
