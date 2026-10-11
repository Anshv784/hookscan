import Link from "next/link";

export const REPO = "https://github.com/Anshv784/hookscan";
export const SDK_ISSUE = "https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/issues/122";
export const HOOKGUARD_DEVNET = "https://explorer.solana.com/address/C3wRkdrAx9tr8FqfGuBEtLrnjpDZEb5aA9Dz2Kbv8ABv?cluster=devnet";

export function Mark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`text-primary ${className}`}>
      <rect x="1" y="1" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v7a3 3 0 0 0 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.5 10.5 13 9l1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
