"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { LiquidBackdrop } from "@/components/nyxora/liquid-backdrop";
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

  return (
    <div className="relative min-h-screen text-foreground">
      <LiquidBackdrop />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <NyxoraWordmark href="/chat" className="text-lg sm:text-xl" />

            <nav aria-label="Primary" className="flex flex-wrap items-center gap-1">
              {visibleNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-control px-3 py-1.5 text-xs font-medium transition-[background-color,color] duration-150 ease-out sm:text-sm",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium leading-tight text-foreground">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-border bg-secondary/50 px-2.5 py-0.5 text-xs font-medium capitalize text-foreground"
            >
              <ShieldCheck className="mr-1 size-3 text-highlight" aria-hidden="true" />
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

      <main className="relative z-10 mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        {title ? (
          <div className="space-y-1">
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
