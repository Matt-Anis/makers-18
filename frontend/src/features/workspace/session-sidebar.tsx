"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import {
  ChartNoAxesColumn,
  Check,
  LogOut,
  PanelLeftClose,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Button } from "@/components/ui/button";
import type { GatewaySession } from "@/lib/api";
import { formatRelativeTime } from "@/lib/relative-time";

export function SessionSidebar({
  sessions,
  activeSessionId,
  busy,
  collapsed,
  onToggleCollapse,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  sessions: GatewaySession[];
  activeSessionId: string | null;
  busy: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (sessionId: string, title: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const name = user?.full_name || user?.email || "";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GatewaySession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function startEditing(session: GatewaySession) {
    setEditingId(session.id);
    setDraftTitle(session.title);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftTitle("");
  }

  async function commitRename(session: GatewaySession) {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === session.title) {
      cancelEditing();
      return;
    }
    setSavingRename(true);
    try {
      await onRename(session.id, trimmed);
      setEditingId(null);
      setDraftTitle("");
    } finally {
      setSavingRename(false);
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, session: GatewaySession) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      void commitRename(session);
    }
  }

  const body = (
    <>
      <div className="shrink-0 p-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onNew}
          disabled={busy}
          className="h-10 w-full cursor-pointer justify-start gap-2.5 border-sidebar-border bg-sidebar-accent/70 px-3 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Plus className="size-4 text-highlight" aria-hidden="true" />
          <span>New session</span>
        </Button>
      </div>

      <nav
        aria-label="Recent sessions"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pt-2 pb-3 [scrollbar-gutter:stable]"
      >
        <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Recents
        </p>
        {sessions.length ? (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;
              const relativeTime = formatRelativeTime(
                session.updated_at || session.created_at,
                nowMs,
              );

              if (isEditing) {
                return (
                  <li key={session.id} className="px-1 py-0.5">
                    <div className="flex items-center gap-1 rounded-control border border-ring bg-sidebar-accent px-2 py-1">
                      <input
                        ref={inputRef}
                        type="text"
                        aria-label="Rename session"
                        maxLength={160}
                        disabled={savingRename}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, session)}
                        className="min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground outline-none"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={savingRename}
                        aria-label="Save name"
                        onClick={() => void commitRename(session)}
                        className="cursor-pointer text-highlight hover:text-highlight"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={savingRename}
                        aria-label="Cancel rename"
                        onClick={cancelEditing}
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    disabled={busy}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onSelect(session.id)}
                    title={session.title}
                    className="flex w-full cursor-pointer flex-col items-start rounded-control px-2.5 py-2 pr-14 text-left outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 aria-[current=true]:bg-sidebar-accent"
                  >
                    <span
                      className={`w-full truncate text-sm ${
                        isActive
                          ? "font-medium text-sidebar-foreground"
                          : "text-muted-foreground group-hover:text-sidebar-foreground"
                      }`}
                    >
                      {session.title}
                    </span>
                    {relativeTime ? (
                      <span className="mt-0.5 text-[11px] text-muted-foreground/80">
                        {relativeTime}
                      </span>
                    ) : null}
                  </button>

                  <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={busy}
                      aria-label={`Rename ${session.title}`}
                      title="Rename chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(session);
                      }}
                      className="cursor-pointer text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={busy}
                      aria-label={`Delete ${session.title}`}
                      title="Delete chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(session);
                      }}
                      className="cursor-pointer text-destructive/80 hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            Your private sessions will appear here.
          </p>
        )}
      </nav>

      <footer className="shrink-0 space-y-2 border-t border-sidebar-border p-2.5">
        {user?.role === "owner" ? (
          <nav
            aria-label="Workspace administration"
            className="space-y-0.5 text-sm text-muted-foreground"
          >
            <Link
              href="/rules"
              className="flex min-h-9 items-center gap-2.5 rounded-control px-2.5 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
              <span>Owner Settings</span>
            </Link>
            <Link
              href="/metrics"
              className="flex min-h-9 items-center gap-2.5 rounded-control px-2.5 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <ChartNoAxesColumn className="size-4 shrink-0" aria-hidden="true" />
              <span>Metrics</span>
            </Link>
          </nav>
        ) : null}

        <div className="flex items-center gap-2.5 rounded-control px-1.5 py-1">
          <div
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-highlight/25 bg-accent text-xs font-semibold text-highlight"
          >
            {name.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium leading-tight text-sidebar-foreground"
              title={user?.email}
            >
              {name}
            </p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">
              {user?.role}
            </p>
          </div>
          <Button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </>
  );

  return (
    <>
      {!collapsed ? (
        <aside
          aria-label="Session history"
          className="hidden min-h-0 w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex"
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3.5">
            <NyxoraWordmark href="/chat" className="text-sm" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapse}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {body}
        </aside>
      ) : null}

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/75 backdrop-blur-xs lg:hidden" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,88vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl outline-none lg:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3.5">
            <Dialog.Title className="sr-only">Sessions</Dialog.Title>
            <NyxoraWordmark href="/chat" className="text-sm" />
            <Dialog.Close
              aria-label="Close sessions"
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                />
              }
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {body}
        </Dialog.Popup>
      </Dialog.Portal>

      <AlertDialog.Root
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-background/75 backdrop-blur-xs" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-surface border border-destructive/30 bg-popover p-5 text-popover-foreground shadow-2xl outline-none">
            <AlertDialog.Title className="text-base font-semibold text-foreground">
              Delete conversation and wipe vault?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                &ldquo;{pendingDelete?.title}&rdquo;
              </span>{" "}
              and destroys its encrypted vault mappings. This action cannot be undone.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Close
                render={<Button type="button" variant="outline" className="cursor-pointer" />}
              >
                Cancel
              </AlertDialog.Close>
              <AlertDialog.Close
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || !pendingDelete}
                    onClick={() => {
                      if (pendingDelete) {
                        const targetId = pendingDelete.id;
                        setPendingDelete(null);
                        void onDelete(targetId);
                      }
                    }}
                    className="cursor-pointer"
                  />
                }
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete &amp; wipe vault</span>
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
