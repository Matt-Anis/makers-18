"use client";

import { EyeOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaskedText } from "@/features/review/masked-text";
import type { ChatMessage } from "@/features/review/types";

export function ConversationThread({
  messages,
  showMasked,
  onShowRestored,
  providerLabel,
}: {
  messages: ChatMessage[];
  showMasked: boolean;
  onShowRestored?: () => void;
  providerLabel: string;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={showMasked ? "Masked conversation" : "Restored conversation"}
      className="space-y-6"
    >
      {showMasked ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-highlight/30 bg-accent/55 px-3 py-2 text-xs text-accent-foreground">
          <div className="flex items-center gap-2">
            <EyeOff className="size-3.5 shrink-0 text-highlight" aria-hidden="true" />
            <span>Viewing exact masked wire text exchanged with the AI provider.</span>
          </div>
          {onShowRestored ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onShowRestored}
              className="h-6 cursor-pointer px-2 text-xs text-highlight hover:bg-accent hover:text-highlight"
            >
              Show restored
            </Button>
          ) : null}
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          key={message.id}
          aria-label={message.role === "user" ? "Your message" : undefined}
          className={
            message.role === "user"
              ? "ml-auto w-fit max-w-[85%] rounded-surface border border-border/80 bg-card px-4 py-3 sm:max-w-[78%] sm:px-5"
              : "max-w-full"
          }
        >
          {message.role === "assistant" ? (
            <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="grid size-6 shrink-0 place-items-center rounded-control border border-highlight/25 bg-accent text-highlight"
                aria-hidden="true"
              >
                <ScanLine className="size-3.5" />
              </span>
              <span className="text-foreground">{message.modelLabel ?? providerLabel}</span>
            </div>
          ) : null}

          <div
            className={`whitespace-pre-wrap text-sm leading-7 wrap-anywhere sm:text-[0.9375rem] ${
              showMasked ? "font-mono text-xs leading-relaxed text-token sm:text-[0.8125rem]" : "text-foreground"
            }`}
          >
            {showMasked ? <MaskedText text={message.maskedText} /> : message.unmaskedText}
          </div>
        </article>
      ))}
    </section>
  );
}
