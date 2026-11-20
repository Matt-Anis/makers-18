"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
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
import { PROVIDERS } from "@/features/review/types";
import { GatewaySession } from "@/lib/api";

interface SessionControlBarProps {
  provider: string;
  onProviderChange: (providerId: string) => void;
  sessions: GatewaySession[];
  activeSession: GatewaySession | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onEndSession: () => void;
  showMasked: boolean;
  onToggleShowMasked: () => void;
  busy: boolean;
}

export function SessionControlBar({
  provider,
  onProviderChange,
  sessions,
  activeSession,
  onSelectSession,
  onNewSession,
  onEndSession,
  showMasked,
  onToggleShowMasked,
  busy,
}: SessionControlBarProps) {
  return (
    <Card className="nyxora-glass rounded-2xl border ring-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="provider-select"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65"
            >
              AI Provider
            </Label>
            <Select
              value={provider}
              onValueChange={(value) => {
                if (value) onProviderChange(value);
              }}
            >
              <SelectTrigger
                id="provider-select"
                className="min-h-10 min-w-52 rounded-xl border-white/15 bg-white/5 px-3 text-xs text-white sm:text-sm"
              >
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>
              <SelectContent className="border-[#6441A5]/50 bg-[#140d24] text-white">
                {PROVIDERS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sessions.length > 0 ? (
            <div className="flex items-center gap-2">
              <Label
                htmlFor="session-select"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65"
              >
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
                  className="min-h-10 min-w-44 rounded-xl border-[#6441A5]/45 bg-[#6441A5]/15 px-3 font-mono text-xs text-[#d6c2ff]"
                >
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent className="border-[#6441A5]/50 bg-[#140d24] text-white">
                  {sessions.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="font-mono text-xs">
                      {item.title} ({item.id.slice(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-[#6441A5]/45 bg-[#6441A5]/15 px-3 py-1 font-mono text-[11px] text-[#b896ff]"
            >
              New session starts on scan
            </Badge>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onNewSession}
            className="min-h-10 cursor-pointer rounded-full border-white/20 bg-white/5 px-3.5 text-xs text-white hover:border-[#9b72eb] hover:bg-[#6441A5]/25"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>New</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showMasked}
            onClick={onToggleShowMasked}
            className={
              showMasked
                ? "min-h-10 cursor-pointer rounded-full border-[#b896ff] bg-[#6441A5] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#6441A5]/90"
                : "min-h-10 cursor-pointer rounded-full border-white/20 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 hover:text-white"
            }
          >
            {showMasked ? (
              <EyeOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
            <span>{showMasked ? "Viewing: Masked Payload" : "Viewing: Unmasked"}</span>
          </Button>

          {activeSession ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={onEndSession}
              className="min-h-10 cursor-pointer rounded-full px-4 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>End Session &amp; Wipe Vault</span>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
