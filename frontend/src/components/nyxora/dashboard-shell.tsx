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
  { href: "/rules", label: "Owner Settings", ownerOnly: true },
  { href: "/metrics", label: "Metrics", ownerOnly: true },
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
      <main className="relative flex min-h-screen items-center justify-center p-8 text-white/60">
        <p className="text-sm">Verifying workspace session...</p>
      </main>
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !("ownerOnly" in item && item.ownerOnly) || user.role === "owner",
  );

  return (
    <div className="relative min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07060c]/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-6">
            <NyxoraWordmark href="/chat" className="text-lg sm:text-xl" />

            <nav aria-label="Primary" className="flex flex-wrap items-center gap-1.5">
              {visibleNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color] duration-200 ease-out",
                      isActive
                        ? "bg-white/12 text-white"
                        : "text-white/60 hover:bg-white/[0.06] hover:text-white",
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
              <p className="text-sm font-medium leading-tight text-white">{user.full_name}</p>
              <p className="text-xs text-white/50">{user.email}</p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-xs font-medium capitalize text-white/85"
            >
              <ShieldCheck className="mr-1 size-3 text-[#9b82ff]" aria-hidden="true" />
              {user.role}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="cursor-pointer"
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
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
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
