"use client";

import { Eye, EyeOff, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiscoveredModel, GatewaySession } from "@/lib/api";

interface SessionControlBarProps {
  models: DiscoveredModel[];
  selectedModelKey: string;
  onSelectModelKey: (key: string) => void;
  thinkingEffort: "low" | "medium" | "high";
  onThinkingEffortChange: (effort: "low" | "medium" | "high") => void;
  reviewMode: "manual" | "auto";
  allowAutoReview: boolean;
  onReviewModeChange: (mode: "manual" | "auto") => void;
  sessions: GatewaySession[];
  activeSession: GatewaySession | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onEndSession: () => void;
  showMasked: boolean;
  onToggleShowMasked: () => void;
  inspectorEnabled: boolean;
  onToggleInspector: () => void;
  busy: boolean;
}

export function modelOptionKey(model: DiscoveredModel): string {
  return `${model.provider}::${model.model_id}`;
}

export function SessionControlBar({
  models,
  selectedModelKey,
  onSelectModelKey,
  thinkingEffort,
  onThinkingEffortChange,
  reviewMode,
  allowAutoReview,
  onReviewModeChange,
  sessions,
  activeSession,
  onSelectSession,
  onNewSession,
  onEndSession,
  showMasked,
  onToggleShowMasked,
  inspectorEnabled,
  onToggleInspector,
  busy,
}: SessionControlBarProps) {
  const currentModel = models.find((m) => modelOptionKey(m) === selectedModelKey) ?? models[0];

  return (
    <Card className="nyxora-surface rounded-3xl border ring-0">
      <CardContent className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <Label htmlFor="model-select" className="text-xs font-medium text-white/60">
              Model
            </Label>
            <Select
              value={selectedModelKey}
              onValueChange={(value) => {
                if (value) onSelectModelKey(value);
              }}
            >
              <SelectTrigger
                id="model-select"
                className="h-9 w-full rounded-full px-3.5 text-xs text-white sm:w-auto sm:min-w-48 sm:text-sm"
              >
                <SelectValue placeholder="No models enabled" />
              </SelectTrigger>
              <SelectContent>
                {models.map((item) => {
                  const key = modelOptionKey(item);
                  return (
                    <SelectItem key={key} value={key} className="rounded-xl">
                      {item.display_name} ({item.provider_label})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {currentModel?.supports_thinking ? (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <Label htmlFor="thinking-select" className="text-xs font-medium text-white/60">
                Thinking
              </Label>
              <Select
                value={thinkingEffort}
                onValueChange={(value) => {
                  if (value) onThinkingEffortChange(value as "low" | "medium" | "high");
                }}
              >
                <SelectTrigger
                  id="thinking-select"
                  className="h-9 w-full rounded-full px-3 text-xs capitalize text-white sm:w-auto sm:min-w-28"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentModel.thinking_efforts.map((effort) => (
                    <SelectItem key={effort} value={effort} className="rounded-xl capitalize">
                      {effort}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <Label htmlFor="mode-select" className="text-xs font-medium text-white/60">
              Mode
            </Label>
            <Select
              value={reviewMode}
              disabled={!allowAutoReview}
              onValueChange={(value) => {
                if (value) onReviewModeChange(value as "manual" | "auto");
              }}
            >
              <SelectTrigger
                id="mode-select"
                className="h-9 w-full rounded-full px-3 text-xs text-white sm:w-auto sm:min-w-36"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual" className="rounded-xl">
                  Manual approval
                </SelectItem>
                {allowAutoReview ? (
                  <SelectItem value="auto" className="rounded-xl">
                    Auto review
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sessions.length > 0 ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                <Label htmlFor="session-select" className="shrink-0 text-xs font-medium text-white/60">
                  Session
                </Label>
                <Select
                  value={activeSession?.id ?? ""}
                  onValueChange={(value) => {
                    if (value) onSelectSession(value);
                  }}
                >
                  <SelectTrigger
                    id="session-select"
                    className="h-9 w-full rounded-full px-3.5 font-mono text-xs text-white/85 sm:w-auto sm:min-w-44"
                  >
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="rounded-xl font-mono text-xs">
                        {item.title} ({item.id.slice(0, 8)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/65"
              >
                Starts on scan
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onNewSession}
              className="h-9 cursor-pointer px-3.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>New</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 lg:pt-0">
          <Button
            type="button"
            variant={inspectorEnabled ? "default" : "outline"}
            size="sm"
            aria-pressed={inspectorEnabled}
            onClick={onToggleInspector}
            className="h-9 cursor-pointer px-3.5"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>{inspectorEnabled ? "Vault Inspector: ON" : "Vault Inspector"}</span>
          </Button>

          <Button
            type="button"
            variant={showMasked ? "default" : "outline"}
            size="sm"
            aria-pressed={showMasked}
            onClick={onToggleShowMasked}
            className="h-9 cursor-pointer px-3.5"
          >
            {showMasked ? (
              <EyeOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
            <span>{showMasked ? "Masked view" : "Unmasked view"}</span>
          </Button>

          {activeSession ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={onEndSession}
              className="h-9 cursor-pointer px-3.5"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>End &amp; wipe vault</span>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
