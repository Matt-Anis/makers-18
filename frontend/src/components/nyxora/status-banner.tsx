"use client";

import { AlertCircle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "success" | "warning" | "error";

export interface NoticeState {
  tone: NoticeTone;
  text: string;
}

export function StatusBanner({
  notice,
  onDismiss,
  className,
}: {
  notice: NoticeState | null;
  onDismiss: () => void;
  className?: string;
}) {
  if (!notice) {
    return <div role="status" aria-live="polite" className="sr-only" />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-xs",
        notice.tone === "error" &&
          "border-destructive/35 bg-destructive/10 text-destructive-foreground",
        notice.tone === "warning" && "border-warning/35 bg-warning/10 text-warning",
        notice.tone === "success" && "border-success/35 bg-success/10 text-success",
        notice.tone === "info" && "border-border bg-card text-foreground",
        className,
      )}
    >
      {notice.tone === "error" ? (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      ) : notice.tone === "warning" ? (
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      ) : notice.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 size-3.5 shrink-0 text-highlight" aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1 leading-relaxed wrap-anywhere">{notice.text}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="-my-1 -mr-1 shrink-0 cursor-pointer text-current opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
