"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import localFont from "next/font/local";

const duneRise = localFont({
  src: "../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export default function DashboardNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Workspace", href: "/chat" },
    { label: "Custom Rules & Audit", href: "/rules" },
    { label: "Metrics", href: "/metrics" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#6441A5]/30 bg-black/70 backdrop-blur-xl px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className={`${duneRise.className} text-lg sm:text-xl tracking-[0.22em] uppercase text-white drop-shadow-[0_0_14px_rgba(100,65,165,0.7)]`}
        >
          NYXORA
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition-all ${
                  isActive
                    ? "bg-white text-black shadow-[0_0_20px_rgba(155,114,235,0.65)]"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <Link
          href="/login"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 hover:text-[#b896ff] transition-colors"
        >
          Sign Out
        </Link>
      </div>
    </header>
  );
}