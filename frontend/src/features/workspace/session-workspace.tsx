"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ApiError,
  apiFetch,
  AuditLogEntry,
  GatewaySession,
  GatewaySessionDetail,
} from "@/lib/api";

const PROVIDERS = ["anthropic", "openai", "mistral", "mock"] as const;

export function SessionWorkspace() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<GatewaySessionDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [title, setTitle] = useState("Supplier NDA review");
  const [provider, setProvider] = useState<string>("anthropic");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    const owned = await apiFetch<GatewaySession[]>("/sessions");
    setSessions(owned);

    if (user.role === "admin") {
      try {
        const logs = await apiFetch<AuditLogEntry[]>("/audit?limit=10");
        setAuditLogs(logs);
      } catch {
        setAuditLogs([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const isAdmin = user.role === "admin";
    Promise.all([
      apiFetch<GatewaySession[]>("/sessions"),
      isAdmin
        ? apiFetch<AuditLogEntry[]>("/audit?limit=10").catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([owned, logs]) => {
        if (!active) return;
        setSessions(owned);
        setAuditLogs(logs);
      })
      .catch(() => {
        if (active) setStatusMessage("Could not load sessions.");
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    try {
      const created = await apiFetch<GatewaySession>("/sessions", {
        method: "POST",
        body: JSON.stringify({ title, provider }),
      });
      const detail = await apiFetch<GatewaySessionDetail>(`/sessions/${created.id}`);
      setSelectedDetail(detail);
      setStatusMessage(`Started session "${created.title}" with an isolated encrypted vault.`);
      await loadWorkspace();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInspectSession(sessionId: string) {
    setStatusMessage(null);
    try {
      const detail = await apiFetch<GatewaySessionDetail>(`/sessions/${sessionId}`);
      setSelectedDetail(detail);
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not load session.");
    }
  }

  async function handleEndSession(sessionId: string) {
    setBusy(true);
    setStatusMessage(null);
    try {
      await apiFetch<{ status: string }>(`/sessions/${sessionId}`, { method: "DELETE" });
      if (selectedDetail?.id === sessionId) {
        setSelectedDetail(null);
      }
      setStatusMessage("Session ended and its encrypted vault was wiped from memory.");
      await loadWorkspace();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not end session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      title="Privacy Gateway Workspace"
      subtitle="Each session owns an isolated, RAM-only encrypted Redis vault and sends only approved masked text."
    >
      <div
        role="status"
        aria-live="polite"
        className={
          statusMessage
            ? "rounded-xl border border-[#9b72eb]/45 bg-[#6441A5]/20 px-4 py-2.5 text-sm text-white"
            : "sr-only"
        }
      >
        {statusMessage ?? ""}
      </div>

      <Card className="nyxora-glass rounded-2xl border ring-0">
        <CardHeader>
          <CardTitle
            id="new-session-heading"
            className="text-sm font-bold uppercase tracking-[0.14em] text-white"
          >
            Start a gateway session
          </CardTitle>
          <CardDescription className="text-white/60">
            Select a frontier model provider and create a user-owned session before pasting or uploading a contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreateSession}
            aria-labelledby="new-session-heading"
            className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label
                htmlFor="session-title"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80"
              >
                Session label (no raw contract PII)
              </Label>
              <Input
                id="session-title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-h-11 rounded-xl border-white/15 bg-white/5 px-3.5 text-base text-white placeholder:text-white/35 focus-visible:border-[#9b72eb] focus-visible:ring-[#9b72eb]/40"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="session-provider"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80"
              >
                Strong AI provider
              </Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  if (value) setProvider(value);
                }}
              >
                <SelectTrigger
                  id="session-provider"
                  className="min-h-11 w-full rounded-xl border-white/15 bg-white/5 px-3.5 text-sm text-white"
                >
                  <SelectValue placeholder="Choose provider" />
                </SelectTrigger>
                <SelectContent className="border-[#6441A5]/50 bg-[#140d24] text-white">
                  {PROVIDERS.map((item) => (
                    <SelectItem key={item} value={item} className="capitalize">
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="min-h-11 cursor-pointer rounded-full bg-white px-6 text-xs font-bold uppercase tracking-[0.16em] text-black hover:bg-[#6441A5] hover:text-white"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>New session</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="nyxora-glass rounded-2xl border ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Your active sessions ({sessions.length})
            </CardTitle>
            <CardDescription className="text-white/60">
              Strictly scoped to your authenticated account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-white/55">
                No active sessions yet. Create one above to initialize an encrypted vault.
              </p>
            ) : (
              <ul className="space-y-3">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{session.title}</p>
                      <p className="text-xs text-white/55">
                        Provider: <span className="capitalize">{session.provider}</span> &middot;{" "}
                        {session.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectSession(session.id)}
                        className="rounded-full border-white/20 bg-white/5 text-white hover:border-[#9b72eb] hover:bg-[#6441A5]/25"
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleEndSession(session.id)}
                        className="rounded-full"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span>End &amp; wipe</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="nyxora-glass rounded-2xl border ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Selected session status
            </CardTitle>
            <CardDescription className="text-white/60">
              Vault encryption &amp; masked history summary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDetail ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">Title</span>
                  <span className="font-medium text-white">{selectedDetail.title}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">Encrypted Redis vault</span>
                  <Badge
                    variant="outline"
                    className={
                      selectedDetail.vault_active
                        ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-200"
                        : "border-red-400/45 bg-red-500/20 text-red-200"
                    }
                  >
                    <Lock className="mr-1 size-3" aria-hidden="true" />
                    {selectedDetail.vault_active ? "Active (RAM-only, TTL)" : "Wiped / Expired"}
                  </Badge>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white/60">Masked turns stored</span>
                  <span className="font-mono font-medium text-white">
                    {selectedDetail.masked_messages.length}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/55">
                Select or create a session to inspect its vault state. Next step: wire detection,
                inline review highlights, and the send gate into this panel.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.role === "admin" ? (
        <Card className="nyxora-glass rounded-2xl border ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Recent metadata-only audit events
            </CardTitle>
            <CardDescription className="text-white/60">
              Admin view &middot; Never stores raw contract text, prompts, or vault mappings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-white/55">No audit events recorded yet.</p>
            ) : (
              <ul className="divide-y divide-white/10 text-sm">
                {auditLogs.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="font-mono text-xs text-[#d6c2ff]">{entry.action}</span>
                    <span className="text-xs text-white/55">
                      {entry.provider ? `provider=${entry.provider} · ` : ""}
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </DashboardShell>
  );
}
