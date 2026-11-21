"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChartNoAxesColumn, LogOut, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Workspace", icon: MessageSquare },
  { href: "/rules", label: "Owner Settings", icon: SlidersHorizontal, ownerOnly: true },
  { href: "/metrics", label: "Metrics", icon: ChartNoAxesColumn, ownerOnly: true },
] as const;

export function DashboardShell({
  title,
  subtitle,
  children,
  workspace = false,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  workspace?: boolean;
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
      <main className="relative flex min-h-dvh items-center justify-center bg-background p-8 text-muted-foreground">
        <p className="text-sm">Verifying workspace session...</p>
      </main>
    );
  }

  if (workspace) {
    return (
      <main className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        {children}
      </main>
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !("ownerOnly" in item && item.ownerOnly) || user.role === "owner",
  );
  const displayName = user.full_name || user.email;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <NyxoraWordmark href="/chat" className="shrink-0 text-sm sm:text-base" />

            <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
              {visibleNav.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium transition-colors sm:px-3",
                      isActive
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn("size-3.5", isActive && "text-highlight")}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden items-center gap-2 md:flex">
              <div
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full border border-highlight/25 bg-accent text-[11px] font-semibold text-highlight"
              >
                {displayName.trim().charAt(0).toUpperCase()}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-medium text-foreground">{displayName}</p>
                <p className="text-[11px] capitalize text-muted-foreground">{user.role}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {title ? (
          <div className="space-y-1 border-b border-border pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
