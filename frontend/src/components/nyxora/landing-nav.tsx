"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#teams", label: "For teams" },
  { href: "#security", label: "Security" },
] as const;

export function LandingNav() {
  const [hidden, setHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 48) {
        setHidden(false);
        lastScrollYRef.current = currentY;
        return;
      }

      if (Math.abs(delta) < 6) {
        return;
      }

      if (delta > 0 && currentY > 64) {
        setHidden(true);
      } else if (delta < 0) {
        setHidden(false);
      }

      lastScrollYRef.current = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "sticky top-0 z-40 px-4 pt-3 pb-2 transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none sm:px-6 lg:px-8",
        hidden
          ? "pointer-events-none -translate-y-full focus-within:pointer-events-auto focus-within:translate-y-0"
          : "translate-y-0",
      )}
    >
      <header className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-3 rounded-full border border-border/90 bg-card/85 px-2.5 py-1.5 shadow-lg/25 backdrop-blur-xl md:grid-cols-[1fr_auto_1fr] md:px-3">
        <div className="flex items-center gap-2.5 pl-1">
          <Link
            href="/"
            aria-label="NYXORA Home"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-highlight/30 bg-accent text-highlight transition-transform duration-150 hover:scale-105"
          >
            <ScanLine className="size-4" aria-hidden="true" />
          </Link>
          <NyxoraWordmark href="/" className="text-xs tracking-[0.24em] sm:text-sm" />
        </div>

        <nav
          aria-label="Section navigation"
          className="hidden items-center gap-1 rounded-full border border-border/70 bg-background/75 p-1 md:flex"
        >
          {LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end">
          <Link
            href="/login"
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-highlight px-4 text-xs font-semibold text-highlight-foreground transition-[background-color,transform] duration-150 hover:bg-highlight/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span>Sign in</span>
            <ArrowRight
              className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
          </Link>
        </div>
      </header>
    </div>
  );
}
