"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { MaskedText } from "@/features/review/masked-text";
import { ENTITY_COLORS, EntityType } from "@/features/review/types";
import { cn } from "@/lib/utils";

type PreviewStage = "compare" | "reply";

const SAMPLE_SEGMENTS: Array<{ text: string; type?: EntityType; token?: string }> = [
  { text: "Review liability caps in the NDA between " },
  { text: "Atlas Tech SARL", type: "COMPANY", token: "[COMPANY_3c91a2]" },
  { text: " (Tax ID: " },
  { text: "001928374650123", type: "ID", token: "[ID_9a14e0]" },
  { text: ") and " },
  { text: "Karim Benali", type: "PERSON", token: "[PERSON_7f3a9b]" },
  { text: ", reachable at " },
  { text: "karim.benali@atlastech.dz", type: "EMAIL", token: "[EMAIL_5b8c21]" },
  { text: " or " },
  { text: "+213 550 12 34 56", type: "PHONE", token: "[PHONE_8b2d14]" },
  { text: ", covering project " },
  { text: "APOLLO-X", type: "CUSTOM", token: "[CUSTOM_4e20f8]" },
  { text: "." },
];

const MASKED_PROMPT =
  "Review liability caps in the NDA between [COMPANY_3c91a2] (Tax ID: [ID_9a14e0]) and [PERSON_7f3a9b], reachable at [EMAIL_5b8c21] or [PHONE_8b2d14], covering project [CUSTOM_4e20f8].";

const MASKED_REPLY =
  "1. Liability Cap: Clause 7 limits [COMPANY_3c91a2]'s exposure, but omits a carve-out for confidentiality breaches involving [CUSTOM_4e20f8].\n2. Signatory Notice: Notices sent to [PERSON_7f3a9b] ([EMAIL_5b8c21]) should specify a 5-business-day cure window before termination.";

const RESTORED_REPLY =
  "1. Liability Cap: Clause 7 limits Atlas Tech SARL's exposure, but omits a carve-out for confidentiality breaches involving APOLLO-X.\n2. Signatory Notice: Notices sent to Karim Benali (karim.benali@atlastech.dz) should specify a 5-business-day cure window before termination.";

const DETECTED_TYPES: EntityType[] = ["COMPANY", "ID", "PERSON", "EMAIL", "PHONE", "CUSTOM"];

export function SendGatePreview() {
  const [stage, setStage] = useState<PreviewStage>("compare");
  const [mobilePane, setMobilePane] = useState<"original" | "masked">("original");
  const [peekMaskedReply, setPeekMaskedReply] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-surface border border-border bg-card shadow-2xl">
      {/* Top chrome bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-sidebar/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-2.5 rounded-full bg-success" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">NYXORA Send Gate</span>
          <span className="hidden rounded-full border border-border bg-background/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            6 entities scrubbed · 0 raw PII sent
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Preview stage"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={stage === "compare"}
            onClick={() => setStage("compare")}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
              stage === "compare"
                ? "border border-highlight/30 bg-accent text-highlight"
                : "border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            1. Mask &amp; Send
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={stage === "reply"}
            onClick={() => setStage("reply")}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
              stage === "reply"
                ? "border border-highlight/30 bg-accent text-highlight"
                : "border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            2. Local Restore
          </button>
        </div>
      </div>

      {stage === "compare" ? (
        <div className="p-4 sm:p-6">
          {/* Mobile toggle between original and masked */}
          <div className="mb-3 flex items-center justify-center gap-1 rounded-control border border-border bg-background/70 p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobilePane("original")}
              className={cn(
                "flex-1 cursor-pointer rounded-[calc(var(--radius-control)-4px)] px-3 py-1.5 text-xs font-medium transition-colors",
                mobilePane === "original"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Original (local)
            </button>
            <button
              type="button"
              onClick={() => setMobilePane("masked")}
              className={cn(
                "flex-1 cursor-pointer rounded-[calc(var(--radius-control)-4px)] px-3 py-1.5 text-xs font-medium transition-colors",
                mobilePane === "masked"
                  ? "bg-accent text-highlight shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sent to Cloud AI
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            {/* Local original pane */}
            <div
              className={cn(
                "flex flex-col justify-between rounded-control border border-border bg-background/70 p-4 text-left",
                mobilePane !== "original" && "hidden lg:flex",
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Your contract prompt
                  </span>
                  <span className="rounded-full border border-border bg-secondary/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Stays on your server
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {SAMPLE_SEGMENTS.map((seg, idx) =>
                    seg.type ? (
                      <mark
                        key={idx}
                        className={`mx-0.5 rounded-sm border px-1 py-0.5 text-[0.88em] font-medium ${ENTITY_COLORS[seg.type]}`}
                        title={`${seg.type} → ${seg.token}`}
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={idx}>{seg.text}</span>
                    ),
                  )}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {DETECTED_TYPES.map((type) => (
                  <EntityBadge key={type} entityType={type} />
                ))}
              </div>
            </div>

            {/* Center Send Gate bridge */}
            <div
              className="hidden flex-col items-center justify-center gap-2 px-1 lg:flex"
              aria-hidden="true"
            >
              <div className="grid size-10 place-items-center rounded-full border border-highlight/35 bg-accent text-highlight shadow-md">
                <ArrowRight className="size-4" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-highlight">
                Scrubbed
              </span>
            </div>

            {/* Masked wire payload pane */}
            <div
              className={cn(
                "flex flex-col justify-between rounded-control border border-highlight/30 bg-background/70 p-4 text-left",
                mobilePane !== "masked" && "hidden lg:flex",
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-highlight">
                    Exact payload sent to Cloud AI
                  </span>
                  <span className="rounded-full border border-highlight/30 bg-accent px-2 py-0.5 font-mono text-[10px] text-highlight">
                    Approved
                  </span>
                </div>
                <div className="font-mono text-xs leading-relaxed text-foreground/90">
                  <MaskedText text={MASKED_PROMPT} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Verified by human Send Gate</span>
                </span>
                <span className="font-mono text-[10px]">OpenAI · Anthropic · Gemini</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4 text-left sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-control border border-highlight/30 bg-accent text-highlight">
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {peekMaskedReply
                    ? "Raw masked reply received from Cloud AI"
                    : "Restored reply shown in your chat"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Deterministic local unmasking in &lt;1ms · Zero extra LLM calls
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPeekMaskedReply((prev) => !prev)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {peekMaskedReply ? (
                <Eye className="size-3.5 text-highlight" aria-hidden="true" />
              ) : (
                <EyeOff className="size-3.5 text-highlight" aria-hidden="true" />
              )}
              <span>{peekMaskedReply ? "Show restored" : "Peek masked reply"}</span>
            </button>
          </div>

          <div className="rounded-control border border-border bg-background/70 p-4">
            {peekMaskedReply ? (
              <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                <MaskedText text={MASKED_REPLY} />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {RESTORED_REPLY}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer status strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-sidebar/60 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-highlight" aria-hidden="true" />
          <span>Per-session Fernet vault (AES-128-CBC + HMAC-SHA256)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3 text-success" aria-hidden="true" />
          <span>One-click instant vault wipe</span>
        </span>
      </div>
    </div>
  );
}
