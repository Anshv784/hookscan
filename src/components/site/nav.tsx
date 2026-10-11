"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";
import { buttonVariants } from "./button";
import { Logo, REPO } from "./brand";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#findings", label: "Findings" },
  { href: "/#guard", label: "hookguard" },
  { href: "/docs", label: "Docs" },
];

/** Transparent over the hero, frosted once the page scrolls. */
export function SiteNav({ children }: { children?: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 md:px-6">
      <div
        className={`mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 rounded-2xl border px-3 transition-[background-color,border-color,box-shadow] duration-300 md:px-4 ${
          scrolled ? "border-border bg-background/70 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl" : "border-transparent"
        }`}
      >
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1">
          <ul className="hidden items-center md:flex">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Code2 className="size-4" aria-hidden /> GitHub
              </a>
            </li>
          </ul>
          {children}
          <Link href="/app" className={buttonVariants({ className: "ml-2" })}>
            Launch app <ArrowUpRight aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  );
}
