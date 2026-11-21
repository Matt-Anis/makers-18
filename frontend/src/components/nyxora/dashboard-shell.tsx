"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowUpRight,
  ChartNoAxesColumn,
  ChevronDown,
  LogOut,
  MessageSquare,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Workspace", shortLabel: "Chat", icon: MessageSquare },
  {
    href: "/rules",
    label: "Owner Settings",
    shortLabel: "Settings",
    icon: SlidersHorizontal,
    ownerOnly: true,
  },
  {
    href: "/metrics",
    label: "Metrics",
    shortLabel: "Metrics",
    icon: ChartNoAxesColumn,
    ownerOnly: true,
  },
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
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2 sm:px-6 lg:px-8">
        <header className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 rounded-full border border-border/90 bg-card/85 px-2.5 py-1.5 shadow-lg/25 backdrop-blur-xl sm:grid-cols-[1fr_auto_1fr] sm:px-3">
          {/* Brand lockup */}
          <div className="flex items-center gap-2.5 pl-1">
            <Link
              href="/chat"
              aria-label="Back to NYXORA Workspace"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-highlight/30 bg-accent text-highlight transition-transform duration-150 hover:scale-105"
            >
              <ScanLine className="size-4" aria-hidden="true" />
            </Link>
            <NyxoraWordmark href="/chat" className="hidden text-xs tracking-[0.24em] sm:inline" />
          </div>

          {/* Centered segmented pill nav */}
          <nav
            aria-label="Primary"
            className="mx-auto flex items-center gap-0.5 rounded-full border border-border/70 bg-background/75 p-1"
          >
            {visibleNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 sm:px-3.5",
                    isActive
                      ? "border border-highlight/30 bg-accent text-highlight shadow-xs"
                      : "border border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="md:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right user account menu */}
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-background/65 py-1 pr-2.5 pl-1 text-left transition-colors outline-none hover:border-input hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:border-input data-[popup-open]:bg-secondary/80"
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-highlight/25 bg-accent text-xs font-semibold text-highlight"
                >
                  {initial}
                </span>
                <span className="hidden max-w-28 truncate text-xs font-medium text-foreground sm:inline">
                  {firstName}
                </span>
                <ChevronDown
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="space-y-1.5 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full border-highlight/30 bg-accent/70 px-2 text-[10px] capitalize text-highlight"
                      >
                        <ShieldCheck className="mr-1 size-2.5" aria-hidden="true" />
                        {user.role}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-[11px] font-normal text-muted-foreground">
                      {user.email}
                    </p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/chat")}>
                  <MessageSquare aria-hidden="true" />
                  <span>Open Chat Workspace</span>
                  <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
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
