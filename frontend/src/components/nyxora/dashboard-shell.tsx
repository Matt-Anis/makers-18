"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Workspace" },
  { href: "/rules", label: "Custom Rules & Audit", adminOnly: true },
  { href: "/metrics", label: "Metrics" },
] as const;

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <main className="nyxora-animated-bg flex min-h-screen items-center justify-center p-8 text-white/70">
        <p className="text-sm tracking-wide">Verifying workspace session...</p>
      </main>
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || user.role === "admin",
  );

  return (
    <div className="nyxora-animated-bg min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-[#6441A5]/35 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-5">
            <NyxoraWordmark href="/chat" className="text-lg sm:text-xl" />

            <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
              {visibleNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
                      isActive
                        ? "bg-white text-black shadow-[0_0_20px_rgba(155,114,235,0.65)]"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user.full_name}</p>
              <p className="text-xs text-white/55">{user.email}</p>
            </div>
            <Badge
              variant="outline"
              className="border-[#9b72eb]/50 bg-[#6441A5]/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d6c2ff]"
            >
              <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
              {user.role}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="cursor-pointer rounded-full border-white/20 bg-white/5 text-white hover:border-[#9b72eb] hover:bg-[#6441A5]/30"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {title ? (
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-white sm:text-2xl">
              {title}
            </h1>
            {subtitle ? <p className="text-sm text-white/60">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
