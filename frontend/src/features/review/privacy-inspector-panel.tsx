"use client";

import { useState } from "react";
import {
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaskedText } from "@/features/review/masked-text";
import { SessionInspector } from "@/lib/api";

interface PrivacyInspectorPanelProps {
  inspector: SessionInspector | null;
  loading: boolean;
  hasActiveSession: boolean;
  providerLabel: string;
  onRefresh: () => void;
  onClose: () => void;
}

export function PrivacyInspectorPanel({
  inspector,
  loading,
  hasActiveSession,
  providerLabel,
  onRefresh,
  onClose,
}: PrivacyInspectorPanelProps) {
  const [blurOriginals, setBlurOriginals] = useState(false);
  const [showRestored, setShowRestored] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-highlight" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-foreground">Privacy Inspector</h2>
          {inspector ? (
            inspector.vault_active ? (
              <Badge
                variant="outline"
                className="border-success/35 bg-success/10 text-[11px] text-success"
              >
                Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-destructive/35 bg-destructive/10 text-[11px] text-destructive-foreground"
              >
                Wiped
              </Badge>
            )
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {hasActiveSession ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={loading}
              aria-label="Refresh Privacy Inspector"
              title="Refresh"
              onClick={onRefresh}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close Privacy Inspector"
            title="Close Privacy Inspector"
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
        {!inspector ? (
          <div className="space-y-3 rounded-surface border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground" role="status">
              {!hasActiveSession
                ? "Start a session to inspect masked wire payloads and encrypted vault mappings."
                : loading
                  ? "Loading session vault details…"
                  : "Could not load the Privacy Inspector."}
            </p>
            {hasActiveSession && !loading ? (
              <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="cursor-pointer">
                Try again
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Session{" "}
              <code className="font-mono text-foreground">{inspector.session_id.slice(0, 8)}</code>
              {" · "}Visible only to you.
            </p>

            <Tabs defaultValue="vault" className="space-y-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="vault">Vault ({inspector.entry_count})</TabsTrigger>
                <TabsTrigger value="wire">Wire ({inspector.messages.length})</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              <TabsContent value="vault" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Bidirectional mappings for Pass 0 &amp; instant unmasking.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-pressed={blurOriginals}
                    onClick={() => setBlurOriginals((prev) => !prev)}
                    className="shrink-0 cursor-pointer"
                  >
                    {blurOriginals ? (
                      <Eye className="size-3" aria-hidden="true" />
                    ) : (
                      <EyeOff className="size-3" aria-hidden="true" />
                    )}
                    <span>{blurOriginals ? "Reveal" : "Blur"}</span>
                  </Button>
                </div>

                {inspector.entries.length === 0 ? (
                  <div className="rounded-control border border-border bg-card p-4 text-xs text-muted-foreground">
                    No sensitive entities committed yet. Scan and approve a message to populate the vault.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {inspector.entries.map((entry) => (
                      <li
                        key={entry.placeholder}
                        className="space-y-1.5 rounded-control border border-border bg-card p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <EntityBadge entityType={entry.entity_type} />
                            <code className="truncate font-mono text-xs text-token">
                              {entry.placeholder}
                            </code>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            ×{entry.occurrences}
                          </span>
                        </div>
                        <p className="text-xs text-foreground wrap-anywhere">
                          {blurOriginals ? (
                            <span className="select-none font-mono text-muted-foreground blur-[4px]">
                              {entry.original_value}
                            </span>
                          ) : (
                            entry.original_value
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="wire" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Exact scrubbed messages sent through the Send Gate.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-pressed={showRestored}
                    onClick={() => setShowRestored((prev) => !prev)}
                    className="shrink-0 cursor-pointer"
                  >
                    <span>{showRestored ? "Masked only" : "Compare restored"}</span>
                  </Button>
                </div>

                {inspector.messages.length === 0 ? (
                  <div className="rounded-control border border-border bg-card p-4 text-xs text-muted-foreground">
                    No messages sent yet. Approved wire payloads will appear here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspector.messages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="overflow-hidden rounded-control border border-border bg-card"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px]">
                          <span className="font-medium text-highlight">
                            #{idx + 1} · {msg.role === "user" ? "User → Provider" : `${providerLabel} → User`}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="divide-y divide-border">
                          <div className="space-y-1 p-3">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Masked wire payload
                            </span>
                            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90 wrap-anywhere">
                              <MaskedText text={msg.masked_content} />
                            </div>
                          </div>

                          {showRestored ? (
                            <div className="space-y-1 bg-background/40 p-3">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Local restored text
                              </span>
                              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground wrap-anywhere">
                                {blurOriginals ? (
                                  <span className="select-none blur-[4px]">
                                    {msg.unmasked_content}
                                  </span>
                                ) : (
                                  msg.unmasked_content
                                )}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-control border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <KeyRound className="size-3.5 text-highlight" aria-hidden="true" />
                      <span>Indexed tokens</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                      {inspector.entry_count}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Random 6-hex IDs</p>
                  </div>

                  <div className="rounded-control border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Database className="size-3.5 text-highlight" aria-hidden="true" />
                      <span>Redis cache</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {inspector.redis_cached ? "Encrypted in RAM" : "Not cached"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">No RDB/AOF</p>
                  </div>

                  <div className="rounded-control border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="size-3.5 text-highlight" aria-hidden="true" />
                      <span>Disk backup</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {inspector.ephemeral_only
                        ? "Ephemeral only"
                        : inspector.snapshot_persisted
                          ? "Fernet snapshot"
                          : "None"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {inspector.cipher_bytes ? `${inspector.cipher_bytes} bytes` : "0 bytes"}
                    </p>
                  </div>

                  <div className="rounded-control border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {inspector.vault_active ? (
                        <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <ShieldOff className="size-3.5 text-destructive" aria-hidden="true" />
                      )}
                      <span>Vault expiry</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {inspector.expires_at
                        ? new Date(inspector.expires_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Wipe anytime</p>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-control border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="font-medium text-foreground">Fernet ciphertext at rest</span>
                    <span className="font-mono text-muted-foreground">AES-128-CBC + HMAC</span>
                  </div>
                  <p className="break-all font-mono text-[11px] leading-relaxed text-success/90">
                    {inspector.cipher_preview ?? "No encrypted vault blob present."}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
