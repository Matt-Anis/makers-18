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
    <Card className="nyxora-surface rounded-xl border ring-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="provider-select" className="text-xs font-medium text-white/60">
              Model
            </Label>
            <Select
              value={provider}
              onValueChange={(value) => {
                if (value) onProviderChange(value);
              }}
            >
              <SelectTrigger
                id="provider-select"
                className="h-9 min-w-52 rounded-lg border-white/12 bg-white/[0.04] px-3 text-xs text-white transition-colors duration-150 hover:border-white/20 sm:text-sm"
              >
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>
              <SelectContent className="border-white/12 bg-[#161322] text-white">
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
              <Label htmlFor="session-select" className="text-xs font-medium text-white/60">
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
                  className="h-9 min-w-44 rounded-lg border-white/12 bg-white/[0.04] px-3 font-mono text-xs text-white/85 transition-colors duration-150 hover:border-white/20"
                >
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent className="border-white/12 bg-[#161322] text-white">
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
              className="border-white/12 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-white/65"
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
            className="h-9 cursor-pointer px-3"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>New</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showMasked ? "default" : "outline"}
            size="sm"
            aria-pressed={showMasked}
            onClick={onToggleShowMasked}
            className="h-9 cursor-pointer px-3"
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
              className="h-9 cursor-pointer px-3"
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
