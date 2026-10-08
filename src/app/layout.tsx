import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://hookscan.anshverma.tech"),
  title: "HookScan — read the rules before you buy",
  description:
    "Every Meteora DBC transfer-hook coin runs its own code on each transfer. HookScan reads that code, tests buys and sells against mainnet, and trades the coins Jupiter can't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <Mark />
                <span>HookScan</span>
              </Link>
              <nav className="hidden items-center gap-5 text-sm text-ink-2 md:flex">
                <Link href="/#rules" className="hover:text-ink">
                  Hooks
                </Link>
                <Link href="/#coins" className="hover:text-ink">
                  Coins
                </Link>
                <Link href="/#findings" className="hover:text-ink">
                  Findings
                </Link>
                <Link href="/docs" className="hover:text-ink">
                  API
                </Link>
              </nav>
              <div className="ml-auto w-full max-w-sm">
                <SearchBox compact />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>
                HookScan reads Meteora DBC transfer-hook pools on Solana mainnet. Tests are simulations; nothing is sent without your
                signature.
              </span>
              <span className="num">Built on Meteora DBC · swap2_with_transfer_hook</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-amber">
      <rect x="1" y="1" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v7a3 3 0 0 0 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.5 10.5 13 9l1.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
