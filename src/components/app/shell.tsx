"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { BookOpen, Code2, Coins, LayoutGrid, ShieldCheck, Webhook, Wallet } from "lucide-react";
import { Logo, REPO } from "@/components/site/brand";
import { SearchBox } from "@/components/search-box";

export const APP_LINKS = [
  { href: "/app", label: "Overview", icon: LayoutGrid },
  { href: "/app/coins", label: "Coins", icon: Coins },
  { href: "/app/hooks", label: "Hooks", icon: Webhook },
  { href: "/app/guard", label: "Guard", icon: ShieldCheck },
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/app"
    ? pathname === "/app" || pathname === "/app/"
    : pathname.startsWith(href) || (href === "/app/coins" && pathname.startsWith("/app/coin/"));

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-6 pb-28 md:gap-10 md:px-6 md:py-10">{children}</main>
      <Suspense fallback={<MobileTabs pathname="" />}>
        <MobileTabBar />
      </Suspense>
    </>
  );
}

function AppNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-border transition-colors ${scrolled ? "bg-background/80 backdrop-blur-xl" : "bg-background"}`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
        <Logo />
        <nav aria-label="App" className="hidden md:block">
          <Suspense fallback={<Pills pathname="" />}>
            <ActivePills />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden w-64 lg:block">
            <SearchBox compact />
          </div>
          <div className="hidden items-center rounded-full border border-border bg-card/60 p-0.5 sm:flex">
            <IconLink href="/docs" label="Docs" icon={BookOpen} />
            <IconLink href={REPO} label="Source code" icon={Code2} external />
          </div>
          <span className="hidden h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-xs text-muted-foreground sm:inline-flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-green" />
            </span>
            Mainnet
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function ActivePills() {
  return <Pills pathname={usePathname()} />;
}

function Pills({ pathname }: { pathname: string }) {
  const pill = (active: boolean) =>
    `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
      {APP_LINKS.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={pill(active)}>
            <l.icon className={`size-4 ${active ? "text-primary" : ""}`} aria-hidden />
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}

function IconLink({ href, label, icon: Icon, external }: { href: string; label: string; icon: typeof BookOpen; external?: boolean }) {
  const cls =
    "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={cls}>
      <Icon className="size-4" aria-hidden />
    </a>
  ) : (
    <Link href={href} aria-label={label} title={label} className={cls}>
      <Icon className="size-4" aria-hidden />
    </Link>
  );
}

export function WalletButton() {
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  if (!publicKey)
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-[filter] hover:brightness-110"
      >
        <Wallet className="size-4" aria-hidden /> Connect
      </button>
    );
  const k = publicKey.toBase58();
  return (
    <button
      onClick={() => disconnect()}
      title="Disconnect"
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/60 px-3 font-mono text-xs text-foreground hover:border-line-strong"
    >
      <span className="size-1.5 rounded-full bg-green" aria-hidden />
      {k.slice(0, 4)}…{k.slice(-4)}
    </button>
  );
}

/** Phones: a bottom tab bar like a native app. */
function MobileTabBar() {
  return <MobileTabs pathname={usePathname()} />;
}

function MobileTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {APP_LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <l.icon className="size-5" aria-hidden />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
