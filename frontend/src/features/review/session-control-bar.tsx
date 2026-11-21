"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DiscoveredModel } from "@/lib/api";

interface SessionControlBarProps {
  models: DiscoveredModel[];
  modelsLoaded: boolean;
  selectedModelKey: string;
  onSelectModelKey: (key: string) => void;
  thinkingEffort: "low" | "medium" | "high";
  onThinkingEffortChange: (effort: "low" | "medium" | "high") => void;
  reviewMode: "manual" | "auto";
  allowAutoReview: boolean;
  onReviewModeChange: (mode: "manual" | "auto") => void;
  busy: boolean;
}

const REVIEW_MODES = [
  {
    value: "manual",
    label: "Manual approval",
    description: "Inspect and approve masked text before sending.",
  },
  {
    value: "auto",
    label: "Auto review",
    description: "Mask and send automatically without pausing.",
  },
] as const;

export function modelOptionKey(model: DiscoveredModel): string {
  return `${model.provider}::${model.model_id}`;
}

export function SessionControlBar({
  models,
  modelsLoaded,
  selectedModelKey,
  onSelectModelKey,
  thinkingEffort,
  onThinkingEffortChange,
  reviewMode,
  allowAutoReview,
  onReviewModeChange,
  busy,
}: SessionControlBarProps) {
  const model = models.find((entry) => modelOptionKey(entry) === selectedModelKey) ?? models[0];
  const efforts = model?.thinking_efforts.filter(
    (effort): effort is "low" | "medium" | "high" =>
      effort === "low" || effort === "medium" || effort === "high",
  );
  const showThinking = Boolean(model?.supports_thinking && efforts && efforts.length > 0);

  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
      aria-label="Message settings"
      role="group"
    >
      <div className="min-w-0 max-w-52">
        <Select
          value={selectedModelKey}
          disabled={busy || !modelsLoaded || models.length === 0}
          onValueChange={(value) => value && onSelectModelKey(value)}
        >
          <SelectTrigger
            id="model-select"
            size="sm"
            aria-label="Model"
            title={model?.display_name}
            className="h-8 max-w-full cursor-pointer border-0 bg-transparent px-2 text-xs font-medium text-foreground hover:bg-secondary/80 data-[popup-open]:bg-secondary/80"
          >
            <SelectValue>
              <span className="truncate">
                {!modelsLoaded
                  ? "Loading models…"
                  : (model?.display_name ?? "No models enabled")}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side="top"
            align="start"
            sideOffset={8}
            alignItemWithTrigger={false}
            className="w-max min-w-48 max-w-[min(22rem,var(--available-width))]"
          >
            {models.map((entry) => (
              <SelectItem key={modelOptionKey(entry)} value={modelOptionKey(entry)} className="text-xs">
                <span>
                  {entry.display_name}{" "}
                  <span className="text-muted-foreground">({entry.provider_label})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showThinking ? (
        <Select
          value={thinkingEffort}
          disabled={busy}
          onValueChange={(value) => {
            if (value === "low" || value === "medium" || value === "high") {
              onThinkingEffortChange(value);
            }
          }}
        >
          <SelectTrigger
            id="thinking-effort-select"
            size="sm"
            aria-label="Thinking effort"
            title={`Thinking effort: ${thinkingEffort}`}
            className="h-8 cursor-pointer border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground data-[popup-open]:bg-secondary/80"
          >
            <Sparkles className="size-3.5 text-highlight" aria-hidden="true" />
            <SelectValue>
              <span className="capitalize">{thinkingEffort}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side="top"
            align="start"
            sideOffset={8}
            alignItemWithTrigger={false}
            className="min-w-36"
          >
            {efforts!.map((effort) => (
              <SelectItem key={effort} value={effort} className="text-xs capitalize">
                {effort} thinking
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {allowAutoReview ? (
        <Popover.Root>
          <Popover.Trigger
            aria-label={`Review mode: ${reviewMode === "manual" ? "manual approval" : "auto review"}`}
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="h-8 shrink-0 cursor-pointer gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              />
            }
          >
            <ShieldCheck className="size-3.5 text-highlight" aria-hidden="true" />
            <span>
              {reviewMode === "manual" ? "Manual" : "Auto"}
              <span className="hidden sm:inline">
                {reviewMode === "manual" ? " approval" : " review"}
              </span>
            </span>
            <ChevronDown className="size-3 opacity-70" aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50">
              <Popover.Popup className="w-[min(18.5rem,var(--available-width))] rounded-surface border border-border bg-popover p-2.5 text-popover-foreground shadow-xl outline-none">
                <Popover.Title className="px-1.5 pb-1.5 text-xs font-semibold text-foreground">
                  Send Gate review mode
                </Popover.Title>
                <fieldset className="space-y-1">
                  <legend className="sr-only">Review mode</legend>
                  {REVIEW_MODES.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-2.5 rounded-control p-2 transition-colors hover:bg-sidebar-accent has-[:checked]:bg-accent/70"
                    >
                      <input
                        type="radio"
                        name="review-mode"
                        value={option.value}
                        checked={reviewMode === option.value}
                        onChange={() => onReviewModeChange(option.value)}
                        className="mt-0.5 accent-highlight"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <span
          title="Manual approval is enforced by your workspace owner"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2 text-xs text-muted-foreground"
        >
          <ShieldCheck className="size-3.5 text-highlight" aria-hidden="true" />
          <span>Manual</span>
        </span>
      )}
    </div>
  );
}
