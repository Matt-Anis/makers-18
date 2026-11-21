"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
        "sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none",
        hidden
          ? "pointer-events-none -translate-y-full focus-within:pointer-events-auto focus-within:translate-y-0"
          : "translate-y-0",
      )}
    >
      <header className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <NyxoraWordmark className="rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-highlight" />

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Section navigation" className="hidden items-center gap-1 md:flex">
            {LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-highlight"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            Sign in
          </Link>
        </div>
      </header>
    </div>
  );
}
