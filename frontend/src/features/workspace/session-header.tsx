"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check,
  Ellipsis,
  Eye,
  EyeOff,
  PanelLeft,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GatewaySession } from "@/lib/api";
import { cn } from "@/lib/utils";

export function SessionHeader({
  session,
  draftTitle,
  hasMessages,
  busy,
  sidebarCollapsed,
  onExpandSidebar,
  inspectorOpen,
  onToggleInspector,
  showMasked,
  onToggleMasked,
  onRename,
  onEndSession,
}: {
  session: GatewaySession | null;
  draftTitle: string;
  hasMessages: boolean;
  busy: boolean;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  showMasked: boolean;
  onToggleMasked: () => void;
  onRename: (title: string) => Promise<void>;
  onEndSession: () => void;
}) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const title = session?.title ?? (draftTitle.trim() || "New session");

  function startEditing() {
    setTitleInput(session?.title ?? draftTitle);
    setEditingTitle(true);
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }

  function cancelEditing() {
    setEditingTitle(false);
    setTitleInput("");
  }

  async function commitRename() {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === title) {
      cancelEditing();
      return;
    }
    setSavingTitle(true);
    try {
      await onRename(trimmed);
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      void commitRename();
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Dialog.Trigger
          aria-label="Open sessions"
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground lg:hidden"
            />
          }
        >
          <PanelLeft className="size-4" aria-hidden="true" />
        </Dialog.Trigger>

        {sidebarCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            onClick={onExpandSidebar}
            className="hidden shrink-0 cursor-pointer text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}

        {editingTitle ? (
          <div className="flex min-w-0 max-w-sm flex-1 items-center gap-1 rounded-control border border-ring bg-card px-2.5 py-1">
            <input
              ref={titleInputRef}
              type="text"
              aria-label="Chat name"
              maxLength={160}
              disabled={savingTitle}
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="Name this chat…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={savingTitle}
              aria-label="Save chat name"
              onClick={() => void commitRename()}
              className="cursor-pointer text-highlight hover:text-highlight"
            >
              <Check className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={savingTitle}
              aria-label="Cancel rename"
              onClick={cancelEditing}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={startEditing}
            title="Click to name or rename chat"
            className="group flex min-w-0 max-w-md cursor-pointer items-center gap-1.5 rounded-control px-2 py-1 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <h1 className="min-w-0 truncate text-sm font-medium text-foreground">{title}</h1>
            <Pencil
              className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {hasMessages || showMasked ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showMasked}
            title={showMasked ? "Switch to restored text" : "View exact masked text sent to AI"}
            onClick={onToggleMasked}
            className={cn(
              "h-8 cursor-pointer gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground",
              showMasked &&
                "border border-highlight/30 bg-accent text-highlight hover:bg-accent/80 hover:text-highlight",
            )}
          >
            {showMasked ? (
              <EyeOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{showMasked ? "Masked view" : "Restored"}</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={inspectorOpen ? "Close Privacy Inspector" : "Open Privacy Inspector"}
          title={inspectorOpen ? "Close Privacy Inspector" : "Open Privacy Inspector"}
          aria-expanded={inspectorOpen}
          aria-controls={inspectorOpen ? "privacy-inspector" : undefined}
          onClick={onToggleInspector}
          className={cn(
            "h-8 cursor-pointer gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground",
            inspectorOpen &&
              "border border-highlight/30 bg-accent text-highlight hover:bg-accent/80 hover:text-highlight",
          )}
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Inspector</span>
        </Button>

        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Session actions"
              title="Session actions"
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="min-w-48">
              <DropdownMenuItem disabled={busy} onClick={startEditing}>
                <Pencil aria-hidden="true" />
                <span>Rename chat</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleMasked}>
                {showMasked ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                <span>{showMasked ? "Show restored text" : "Show masked text"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmWipe(true)}
              >
                <Trash2 aria-hidden="true" />
                <span>End &amp; wipe vault</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/15 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>End session and wipe vault?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this conversation and destroys its encrypted vault mappings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy || !session}
              onClick={() => {
                setConfirmWipe(false);
                onEndSession();
              }}
              className="cursor-pointer"
            >
              <Trash2 aria-hidden="true" />
              <span>End &amp; wipe vault</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
