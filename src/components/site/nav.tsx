"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Code2 } from "lucide-react";
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
    <header
      className={`sticky top-0 z-40 w-full transition-[background-color,border-color] duration-300 ${
        scrolled ? "border-b border-border bg-background/75 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className={buttonVariants({ variant: "ghost" })}>
                  {l.href === "/docs" && <BookOpen aria-hidden />} {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={REPO} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
                <Code2 aria-hidden /> Code
              </a>
            </li>
          </ul>
          {children}
          <Link href="/app" className={buttonVariants()}>
            Launch app <ArrowUpRight aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  );
}
