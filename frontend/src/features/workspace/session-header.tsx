"use client";

import { useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Ellipsis, Eye, EyeOff, PanelLeft, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GatewaySession } from "@/lib/api";
import { cn } from "@/lib/utils";

export function SessionHeader({
  session,
  hasMessages,
  busy,
  sidebarCollapsed,
  onExpandSidebar,
  inspectorOpen,
  onToggleInspector,
  showMasked,
  onToggleMasked,
  onEndSession,
}: {
  session: GatewaySession | null;
  hasMessages: boolean;
  busy: boolean;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  showMasked: boolean;
  onToggleMasked: () => void;
  onEndSession: () => void;
}) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const title = session?.title ?? "New session";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
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

        <h1 className="min-w-0 truncate text-sm font-medium text-foreground" title={title}>
          {title}
        </h1>
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
              showMasked && "border border-highlight/30 bg-accent text-highlight hover:bg-accent/80 hover:text-highlight",
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
            inspectorOpen && "border border-highlight/30 bg-accent text-highlight hover:bg-accent/80 hover:text-highlight",
          )}
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Inspector</span>
        </Button>

        {session ? (
          <Menu.Root>
            <Menu.Trigger
              ref={menuTrigger}
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
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
                <Menu.Popup className="min-w-48 rounded-surface border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none">
                  <Menu.Item
                    onClick={onToggleMasked}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-xs outline-none data-[highlighted]:bg-sidebar-accent"
                  >
                    {showMasked ? (
                      <EyeOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span>{showMasked ? "Show restored text" : "Show masked text"}</span>
                  </Menu.Item>
                  <Menu.Separator className="my-1 border-t border-border" />
                  <Menu.Item
                    disabled={busy}
                    onClick={() => setConfirmWipe(true)}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-xs text-destructive-foreground outline-none data-[highlighted]:bg-destructive/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span>End &amp; wipe vault</span>
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
      </div>

      <AlertDialog.Root open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-background/75 backdrop-blur-xs" />
          <AlertDialog.Popup
            finalFocus={menuTrigger}
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-surface border border-border bg-popover p-5 text-popover-foreground shadow-2xl outline-none"
          >
            <AlertDialog.Title className="text-base font-semibold text-foreground">
              End session and wipe vault?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              This permanently removes this conversation and destroys its encrypted vault mappings.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Close render={<Button type="button" variant="outline" className="cursor-pointer" />}>
                Cancel
              </AlertDialog.Close>
              <AlertDialog.Close
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    className="cursor-pointer"
                    disabled={busy || !session}
                    onClick={onEndSession}
                  />
                }
              >
                End &amp; wipe vault
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </header>
  );
}
