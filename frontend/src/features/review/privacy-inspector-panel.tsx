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
} from "lucide-react";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITY_COLORS, EntityType } from "@/features/review/types";
import { SessionInspector } from "@/lib/api";

const PLACEHOLDER_SPLIT_RE = /(\[[A-Z]+_[0-9a-fA-F]{4,12}\])/g;
const PLACEHOLDER_EXACT_RE = /^\[([A-Z]+)_[0-9a-fA-F]{4,12}\]$/;

function renderObfuscatedTokens(text: string) {
  const parts = text.split(PLACEHOLDER_SPLIT_RE);
  return parts.map((part, idx) => {
    const match = PLACEHOLDER_EXACT_RE.exec(part);
    if (!match) {
      return <span key={`txt_${idx}`}>{part}</span>;
    }
    const entityType = match[1] as EntityType;
    const style = ENTITY_COLORS[entityType] ?? ENTITY_COLORS.CUSTOM;
    return (
      <span
        key={`tok_${idx}`}
        className={`mx-0.5 inline-block rounded border px-1.5 py-0.5 font-mono text-xs font-medium ${style}`}
      >
        {part}
      </span>
    );
  });
}

interface PrivacyInspectorPanelProps {
  inspector: SessionInspector | null;
  loading: boolean;
  hasActiveSession: boolean;
  providerLabel: string;
  onRefresh: () => void;
}

export function PrivacyInspectorPanel({
  inspector,
  loading,
  hasActiveSession,
  providerLabel,
  onRefresh,
}: PrivacyInspectorPanelProps) {
  const [blurOriginals, setBlurOriginals] = useState(false);
  const [sideBySide, setSideBySide] = useState(true);

  if (!hasActiveSession) {
    return (
      <Card className="nyxora-surface rounded-3xl border ring-0">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white">
            Privacy Inspector (Demo View)
          </CardTitle>
          <CardDescription className="text-white/60">
            Start a session or scan a contract in the Chat Workspace tab to inspect the live
            obfuscated payload, session token index, and encrypted vault proof.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="nyxora-surface rounded-3xl border ring-0">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold text-white">
                Session Vault &amp; Encryption Proof
              </CardTitle>
              {inspector?.vault_active ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-emerald-400/40 bg-emerald-500/15 text-[11px] text-emerald-200"
                >
                  <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
                  Vault active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="rounded-full border-red-400/35 bg-red-500/10 text-[11px] text-red-200"
                >
                  <ShieldOff className="mr-1 size-3" aria-hidden="true" />
                  Wiped / inactive
                </Badge>
              )}
            </div>
            <CardDescription className="text-white/60">
              Live snapshot for session{" "}
              <code className="font-mono text-white/80">
                {inspector ? inspector.session_id.slice(0, 8) : "..."}
              </code>{" "}
              — only visible to the session owner. External LLMs never see this vault.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={blurOriginals}
              onClick={() => setBlurOriginals((prev) => !prev)}
              className="cursor-pointer"
            >
              {blurOriginals ? (
                <Eye className="size-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="size-3.5" aria-hidden="true" />
              )}
              <span>{blurOriginals ? "Reveal originals" : "Blur originals"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onRefresh}
              className="cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/55">
                <KeyRound className="size-3.5 text-[#a78bfa]" aria-hidden="true" />
                <span>Indexed tokens</span>
              </div>
              <p className="mt-1 font-mono text-xl font-semibold text-white">
                {inspector?.entry_count ?? 0}
              </p>
              <p className="text-[11px] text-white/45">Random 6-hex placeholders</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/55">
                <Database className="size-3.5 text-[#a78bfa]" aria-hidden="true" />
                <span>Redis hot cache</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                {inspector?.redis_cached ? "Encrypted in RAM" : "Not cached"}
              </p>
              <p className="text-[11px] text-white/45">Persistence disabled (no RDB/AOF)</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/55">
                <Lock className="size-3.5 text-[#a78bfa]" aria-hidden="true" />
                <span>Disk backup</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                {inspector?.ephemeral_only
                  ? "Ephemeral only"
                  : inspector?.snapshot_persisted
                    ? "Fernet snapshot"
                    : "None"}
              </p>
              <p className="text-[11px] text-white/45">
                {inspector?.cipher_bytes ? `${inspector.cipher_bytes} ciphertext bytes` : "0 bytes"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/55">
                <ShieldCheck className="size-3.5 text-[#a78bfa]" aria-hidden="true" />
                <span>Vault TTL expiry</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                {inspector?.expires_at
                  ? new Date(inspector.expires_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
              <p className="text-[11px] text-white/45">Instant wipe via End &amp; wipe vault</p>
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-white/10 bg-black/45 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[#b8a5ff]">
                Fernet ciphertext at rest (zero plaintext PII stored)
              </span>
              <span className="font-mono text-[11px] text-white/45">
                AES-128-CBC + HMAC-SHA256
              </span>
            </div>
            <p className="break-all font-mono text-xs text-emerald-200/85">
              {inspector?.cipher_preview ?? "No encrypted vault blob present."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="nyxora-surface rounded-3xl border ring-0">
        <CardHeader>
          <CardTitle id="vault-index-heading" className="text-base font-semibold text-white">
            Token Index &amp; Vault Mappings ({inspector?.entry_count ?? 0})
          </CardTitle>
          <CardDescription className="text-white/60">
            Bidirectional lookup table used for Pass 0 consistency and deterministic &lt;1ms
            unmasking on replies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!inspector || inspector.entries.length === 0 ? (
            <p className="text-sm text-white/55">
              No sensitive entities have been committed to this session&apos;s vault yet. Scan and
              approve a contract in Chat Workspace to populate the index.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="vault-index-heading"
              className="overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b82ff]"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-12 text-xs text-white/55">#</TableHead>
                    <TableHead className="text-xs text-white/55">Obfuscated Token</TableHead>
                    <TableHead className="text-xs text-white/55">Type</TableHead>
                    <TableHead className="text-xs text-white/55">Original Value (Local)</TableHead>
                    <TableHead className="text-right text-xs text-white/55">Hits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspector.entries.map((entry) => (
                    <TableRow
                      key={entry.placeholder}
                      className="border-white/[0.07] hover:bg-white/[0.03]"
                    >
                      <TableCell className="font-mono text-xs text-white/50">
                        #{entry.index}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#c4b5fd]">
                        {entry.placeholder}
                      </TableCell>
                      <TableCell>
                        <EntityBadge entityType={entry.entity_type} />
                      </TableCell>
                      <TableCell className="text-xs text-white">
                        {blurOriginals ? (
                          <span className="select-none font-mono text-white/45 blur-[4px]">
                            {entry.original_value}
                          </span>
                        ) : (
                          entry.original_value
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-white/75">
                        {entry.occurrences}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="nyxora-surface rounded-3xl border ring-0">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-white">
              Obfuscated Wire Payload vs. Restored View
            </CardTitle>
            <CardDescription className="text-white/60">
              Exact masked text dispatched across the Send Gate compared with what the user reads
              locally.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={sideBySide}
            onClick={() => setSideBySide((prev) => !prev)}
            className="cursor-pointer self-start sm:self-auto"
          >
            <span>{sideBySide ? "Side-by-side view" : "Obfuscated only"}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {!inspector || inspector.messages.length === 0 ? (
            <p className="text-sm text-white/55">
              No messages sent in this session yet. Once a turn passes the Send Gate, its masked
              wire payload appears here.
            </p>
          ) : (
            inspector.messages.map((msg, idx) => (
              <div
                key={msg.id}
                className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#b8a5ff]">
                    Turn #{idx + 1} · {msg.role === "user" ? "User → Cloud LLM" : `${providerLabel} → User`}
                  </span>
                  <span className="font-mono text-[11px] text-white/45">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className={sideBySide ? "grid gap-3 lg:grid-cols-2" : "space-y-3"}>
                  <div className="space-y-1.5 rounded-2xl border border-amber-400/25 bg-black/45 p-3.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-amber-200/85">
                      Obfuscated wire text (left gateway)
                    </span>
                    <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-white/85">
                      {renderObfuscatedTokens(msg.masked_content)}
                    </p>
                  </div>

                  {sideBySide ? (
                    <div className="space-y-1.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.05] p-3.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-200/85">
                        Restored local text (unmasked via vault)
                      </span>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                        {blurOriginals ? (
                          <span className="select-none blur-[4px]">{msg.unmasked_content}</span>
                        ) : (
                          msg.unmasked_content
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
