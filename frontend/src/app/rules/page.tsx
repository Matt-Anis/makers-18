"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { NoticeState, StatusBanner } from "@/components/nyxora/status-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ENTITY_TYPES, EntityType } from "@/features/review/types";
import {
  ApiError,
  apiFetch,
  apiUpload,
  AuditLogEntry,
  CustomRule,
  DiscoveredModel,
  GpuTestResult,
  MarkdownRulesImportResult,
  ModelDiscoveryResponse,
  ProviderConfigOut,
  ProviderDiscoveryResult,
  User,
  WorkspaceSettings,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [providers, setProviders] = useState<ProviderConfigOut[]>([]);
  const [availableModels, setAvailableModels] = useState<DiscoveredModel[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [clearKeyByProvider, setClearKeyByProvider] = useState<Record<string, boolean>>({});
  const [baseUrlDrafts, setBaseUrlDrafts] = useState<Record<string, string>>({});
  const [dirtyProviders, setDirtyProviders] = useState<Record<string, boolean>>({});
  const [discoveredByProvider, setDiscoveredByProvider] = useState<
    Record<string, { source: string; models: DiscoveredModel[] }>
  >({});

  const [ws, setWs] = useState<WorkspaceSettings | null>(null);
  const [gpuKeyDraft, setGpuKeyDraft] = useState("");
  const [clearGpuKey, setClearGpuKey] = useState(false);
  const [testingGpu, setTestingGpu] = useState(false);
  const [gpuTestResult, setGpuTestResult] = useState<GpuTestResult | null>(null);

  const [rules, setRules] = useState<CustomRule[]>([]);
  const [importingMarkdown, setImportingMarkdown] = useState(false);
  const [pattern, setPattern] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("CUSTOM");
  const [isRegex, setIsRegex] = useState(false);
  const [pendingDeleteRule, setPendingDeleteRule] = useState<CustomRule | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [refreshingAudit, setRefreshingAudit] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "owner">("user");

  const loadAll = useCallback(async () => {
    if (!isOwner) return;
    const [provList, wsData, ruleList, logs, userList, modelResp] = await Promise.all([
      apiFetch<ProviderConfigOut[]>("/settings/providers"),
      apiFetch<WorkspaceSettings>("/settings/workspace"),
      apiFetch<CustomRule[]>("/rules"),
      apiFetch<AuditLogEntry[]>("/audit?limit=50"),
      apiFetch<User[]>("/auth/users"),
      apiFetch<ModelDiscoveryResponse>("/providers/models"),
    ]);
    setProviders(provList);
    setBaseUrlDrafts(
      Object.fromEntries(provList.map((p) => [p.provider, p.base_url ?? ""])),
    );
    setDirtyProviders({});
    setWs(wsData);
    setRules(ruleList);
    setAuditLogs(logs);
    setUsers(userList);
    setAvailableModels(modelResp.models);
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    Promise.all([
      apiFetch<ProviderConfigOut[]>("/settings/providers"),
      apiFetch<WorkspaceSettings>("/settings/workspace"),
      apiFetch<CustomRule[]>("/rules"),
      apiFetch<AuditLogEntry[]>("/audit?limit=50"),
      apiFetch<User[]>("/auth/users"),
      apiFetch<ModelDiscoveryResponse>("/providers/models"),
    ])
      .then(([provList, wsData, ruleList, logs, userList, modelResp]) => {
        if (!active) return;
        setProviders(provList);
        setBaseUrlDrafts(
          Object.fromEntries(provList.map((p) => [p.provider, p.base_url ?? ""])),
        );
        setWs(wsData);
        setRules(ruleList);
        setAuditLogs(logs);
        setUsers(userList);
        setAvailableModels(modelResp.models);
      })
      .catch(() => {
        if (active) setNotice({ tone: "error", text: "Could not load owner settings." });
      });
    return () => {
      active = false;
    };
  }, [isOwner]);

  async function refreshAvailableModels() {
    try {
      const modelResp = await apiFetch<ModelDiscoveryResponse>("/providers/models");
      setAvailableModels(modelResp.models);
    } catch {
      // Non-blocking refresh.
    }
  }

  async function handleSaveProvider(item: ProviderConfigOut) {
    setNotice(null);
    try {
      const updated = await apiFetch<ProviderConfigOut>(`/settings/providers/${item.provider}`, {
        method: "PUT",
        body: JSON.stringify({
          api_key: keyDrafts[item.provider]?.trim() || null,
          clear_api_key: Boolean(clearKeyByProvider[item.provider]),
          base_url: baseUrlDrafts[item.provider]?.trim() || null,
          enabled: item.enabled,
          enabled_models: item.enabled_models,
        }),
      });
      setProviders((prev) =>
        prev.map((p) => (p.provider === updated.provider ? updated : p)),
      );
      setKeyDrafts((prev) => ({ ...prev, [item.provider]: "" }));
      setClearKeyByProvider((prev) => ({ ...prev, [item.provider]: false }));
      setDirtyProviders((prev) => ({ ...prev, [item.provider]: false }));
      if (!updated.enabled && (updated.is_configured || updated.enabled_models.length > 0)) {
        setNotice({
          tone: "warning",
          text: `Saved ${item.label} settings, but this provider is Disabled — turn on the Enabled switch for its models to appear on /chat.`,
        });
      } else if (updated.enabled && !updated.is_configured) {
        setNotice({
          tone: "warning",
          text: `Saved ${item.label} settings, but ${
            updated.provider === "openai_compatible" ? "a Base URL" : "an API key"
          } is still required before its models appear on /chat.`,
        });
      } else {
        const details: string[] = [];
        if (updated.enabled) details.push("enabled on /chat");
        if (updated.key_hint) details.push("API key encrypted at rest");
        setNotice({
          tone: "success",
          text: `Saved ${item.label} settings${details.length > 0 ? ` (${details.join("; ")})` : ""}.`,
        });
      }
      await refreshAvailableModels();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to save provider.",
      });
    }
  }

  async function handleToggleProviderEnabled(item: ProviderConfigOut, checked: boolean) {
    setNotice(null);
    setProviders((prev) =>
      prev.map((p) => (p.provider === item.provider ? { ...p, enabled: checked } : p)),
    );

    if (!item.is_configured) {
      setDirtyProviders((prev) => ({ ...prev, [item.provider]: true }));
      return;
    }

    try {
      const updated = await apiFetch<ProviderConfigOut>(`/settings/providers/${item.provider}`, {
        method: "PUT",
        body: JSON.stringify({
          api_key: null,
          clear_api_key: false,
          base_url: item.base_url,
          enabled: checked,
          enabled_models: item.enabled_models,
        }),
      });
      setProviders((prev) =>
        prev.map((p) => (p.provider === updated.provider ? updated : p)),
      );
      setNotice({
        tone: "info",
        text: updated.enabled
          ? `${item.label} is now enabled and available on /chat.`
          : `${item.label} is now disabled and hidden from /chat.`,
      });
      await refreshAvailableModels();
    } catch (error) {
      setProviders((prev) =>
        prev.map((p) => (p.provider === item.provider ? { ...p, enabled: item.enabled } : p)),
      );
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to update provider.",
      });
    }
  }

  async function handleDiscoverModels(providerId: string) {
    setNotice(null);
    try {
      const result = await apiFetch<ProviderDiscoveryResult>(
        `/settings/providers/${providerId}/discover`,
        {
          method: "POST",
          body: JSON.stringify({
            api_key: keyDrafts[providerId]?.trim() || null,
            base_url: baseUrlDrafts[providerId]?.trim() || null,
          }),
        },
      );
      setDiscoveredByProvider((prev) => ({
        ...prev,
        [providerId]: { source: result.source, models: result.models },
      }));
      setNotice({
        tone: "info",
        text: `Discovered ${result.models.length} model(s) for ${providerId} (${result.source}).`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Discovery failed.",
      });
    }
  }

  function toggleModelForProvider(providerId: string, modelId: string) {
    setDirtyProviders((prev) => ({ ...prev, [providerId]: true }));
    setProviders((prev) =>
      prev.map((p) => {
        if (p.provider !== providerId) return p;
        const exists = p.enabled_models.includes(modelId);
        return {
          ...p,
          enabled: exists ? p.enabled : true,
          enabled_models: exists
            ? p.enabled_models.filter((m) => m !== modelId)
            : [...p.enabled_models, modelId],
        };
      }),
    );
  }

  async function handleSaveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ws) return;
    setNotice(null);
    try {
      const saved = await apiFetch<WorkspaceSettings>("/settings/workspace", {
        method: "PUT",
        body: JSON.stringify({
          allow_auto_review: ws.allow_auto_review,
          default_review_mode: ws.default_review_mode,
          default_provider: ws.default_provider,
          default_model: ws.default_model,
          default_thinking_effort: ws.default_thinking_effort,
          rulebook_prompt: ws.rulebook_prompt,
          gpu_llm_enabled: ws.gpu_llm_enabled,
          gpu_llm_endpoint: ws.gpu_llm_endpoint,
          gpu_llm_model: ws.gpu_llm_model,
          gpu_llm_api_key: gpuKeyDraft.trim() ? gpuKeyDraft.trim() : null,
          clear_gpu_llm_api_key: clearGpuKey,
        }),
      });
      setWs(saved);
      setGpuKeyDraft("");
      setClearGpuKey(false);
      setNotice({ tone: "success", text: "Saved workspace defaults & rulebook settings." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not save settings.",
      });
    }
  }

  async function handleTestGpu() {
    if (!ws) return;
    setTestingGpu(true);
    setGpuTestResult(null);
    setNotice(null);
    try {
      const result = await apiFetch<GpuTestResult>("/settings/workspace/test-gpu", {
        method: "POST",
        body: JSON.stringify({
          gpu_llm_endpoint: ws.gpu_llm_endpoint,
          gpu_llm_model: ws.gpu_llm_model,
          gpu_llm_api_key: gpuKeyDraft.trim() ? gpuKeyDraft.trim() : null,
          clear_gpu_llm_api_key: clearGpuKey,
        }),
      });
      setGpuTestResult(result);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not test GPU SLM connection.",
      });
    } finally {
      setTestingGpu(false);
    }
  }

  async function handleAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = pattern.trim();
    if (!cleaned) return;
    setNotice(null);
    try {
      const created = await apiFetch<CustomRule>("/rules", {
        method: "POST",
        body: JSON.stringify({ pattern: cleaned, entity_type: entityType, is_regex: isRegex }),
      });
      setRules((prev) => [created, ...prev]);
      setPattern("");
      setNotice({ tone: "success", text: `Added rule "${created.pattern}".` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not add rule.",
      });
    }
  }

  async function handleToggleRule(rule: CustomRule, enabled: boolean) {
    try {
      const updated = await apiFetch<CustomRule>(`/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not update rule.",
      });
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      await apiFetch<{ status: string }>(`/rules/${ruleId}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setNotice({ tone: "info", text: "Deleted custom rule." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not delete rule.",
      });
    }
  }

  async function handleImportRulesMarkdown(file: File) {
    setImportingMarkdown(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiUpload<MarkdownRulesImportResult>(
        "/rules/import-markdown",
        formData,
      );
      if (result.created_rules.length > 0) {
        setRules((prev) => [...result.created_rules, ...prev]);
      }
      if (result.rulebook_updated) {
        setWs((prev) => (prev ? { ...prev, rulebook_prompt: result.rulebook_prompt } : prev));
      }
      const parts: string[] = [];
      parts.push(`added ${result.created_rules.length} rule(s)`);
      if (result.skipped_existing_count > 0) {
        parts.push(`skipped ${result.skipped_existing_count} duplicate(s)`);
      }
      if (result.rulebook_updated) {
        parts.push("updated the SLM privacy rulebook");
      }
      setNotice({ tone: "success", text: `Imported "${result.filename}": ${parts.join(", ")}.` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not import Markdown rules file.",
      });
    } finally {
      setImportingMarkdown(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      await apiFetch<User>("/auth/users", {
        method: "POST",
        body: JSON.stringify({
          email: newUserEmail,
          full_name: newUserName,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNotice({ tone: "success", text: "Provisioned new workspace account." });
      await loadAll();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not create user.",
      });
    }
  }

  async function handleToggleUserStatus(target: User, nextActive: boolean) {
    setNotice(null);
    try {
      const updated = await apiFetch<User>(`/auth/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNotice({
        tone: "info",
        text: `${updated.email} is now ${updated.is_active ? "active" : "disabled"}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not update user status.",
      });
    }
  }

  async function handleRefreshAudit() {
    setRefreshingAudit(true);
    try {
      const logs = await apiFetch<AuditLogEntry[]>("/audit?limit=50");
      setAuditLogs(logs);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not refresh audit log.",
      });
    } finally {
      setRefreshingAudit(false);
    }
  }

  const activeDefaultModelValue =
    ws?.default_provider && ws?.default_model
      ? `${ws.default_provider}::${ws.default_model}`
      : "";

  return (
    <DashboardShell
      title="Owner Settings"
      subtitle="Configure encrypted provider API keys, enabled models, rulebook instructions, custom rules, users, and audit logs."
    >
      <StatusBanner notice={notice} onDismiss={() => setNotice(null)} />

      {!isOwner ? (
        <Alert className="border-warning/35 bg-card text-warning">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Owner access required</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Only the workspace Owner can manage API keys, rulebook settings, or audit logs.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="providers" className="space-y-5">
          <TabsList>
            <TabsTrigger value="providers" className="px-3.5 text-xs">
              Providers
            </TabsTrigger>
            <TabsTrigger value="rulebook" className="px-3.5 text-xs">
              Defaults &amp; GPU
            </TabsTrigger>
            <TabsTrigger value="rules" className="px-3.5 text-xs">
              Custom Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="px-3.5 text-xs">
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="px-3.5 text-xs">
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="grid gap-4 lg:grid-cols-2">
            {providers.map((item) => {
              const disc = discoveredByProvider[item.provider];
              const isClearing = Boolean(clearKeyByProvider[item.provider]);
              const isDirty = Boolean(dirtyProviders[item.provider]);
              return (
                <Card key={item.provider} className="flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base font-semibold text-foreground">
                          {item.label}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={
                            item.is_configured
                              ? "border-success/35 bg-success/10 text-[11px] text-success"
                              : "border-border bg-secondary/50 text-[11px] text-muted-foreground"
                          }
                        >
                          <KeyRound className="mr-1 size-3" aria-hidden="true" />
                          {item.is_configured
                            ? item.key_hint
                              ? `Saved (${item.key_hint})`
                              : "Ready"
                            : "Key required"}
                        </Badge>
                        {isDirty ? (
                          <Badge
                            variant="outline"
                            className="border-warning/35 bg-warning/10 text-[11px] text-warning"
                          >
                            Unsaved
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`enable-${item.provider}`}
                          aria-label={`Enable ${item.label}`}
                          checked={item.enabled}
                          onCheckedChange={(checked) => handleToggleProviderEnabled(item, checked)}
                        />
                        <Label
                          htmlFor={`enable-${item.provider}`}
                          className="cursor-pointer text-xs text-muted-foreground"
                        >
                          {item.enabled ? "Enabled" : "Disabled"}
                        </Label>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <div className="space-y-3.5">
                      {!item.enabled && (item.is_configured || item.enabled_models.length > 0) ? (
                        <p className="rounded-control border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
                          Provider is <strong>Disabled</strong> — toggle Enabled above for its
                          models to appear on /chat.
                        </p>
                      ) : null}

                      <div className="space-y-3">
                        {item.requires_api_key || item.provider === "openai_compatible" ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor={`key-${item.provider}`} className="text-xs text-muted-foreground">
                                API key {item.key_hint ? `(saved: ${item.key_hint})` : ""}
                              </Label>
                              {item.key_hint ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDirtyProviders((prev) => ({ ...prev, [item.provider]: true }));
                                    setClearKeyByProvider((prev) => ({
                                      ...prev,
                                      [item.provider]: !prev[item.provider],
                                    }));
                                  }}
                                  className="cursor-pointer text-[11px] text-destructive hover:text-destructive-foreground"
                                >
                                  {isClearing ? "Keep existing key" : "Clear stored key"}
                                </button>
                              ) : null}
                            </div>
                            <Input
                              id={`key-${item.provider}`}
                              name={`api_key_${item.provider}`}
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              autoCapitalize="none"
                              autoCorrect="off"
                              value={keyDrafts[item.provider] ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setKeyDrafts((prev) => ({ ...prev, [item.provider]: next }));
                                setDirtyProviders((prev) => ({ ...prev, [item.provider]: true }));
                                if (next) {
                                  setClearKeyByProvider((prev) => ({
                                    ...prev,
                                    [item.provider]: false,
                                  }));
                                }
                              }}
                              placeholder={
                                isClearing
                                  ? "Stored key will be removed on Save"
                                  : item.is_configured
                                    ? "Enter new key to rotate"
                                    : "sk-..."
                              }
                            />
                          </div>
                        ) : null}

                        {item.provider === "openai_compatible" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor={`url-${item.provider}`} className="text-xs text-muted-foreground">
                              Base URL
                            </Label>
                            <Input
                              id={`url-${item.provider}`}
                              name={`base_url_${item.provider}`}
                              type="url"
                              spellCheck={false}
                              autoCapitalize="none"
                              autoCorrect="off"
                              value={baseUrlDrafts[item.provider] ?? ""}
                              onChange={(e) => {
                                setDirtyProviders((prev) => ({ ...prev, [item.provider]: true }));
                                setBaseUrlDrafts((prev) => ({
                                  ...prev,
                                  [item.provider]: e.target.value,
                                }));
                              }}
                              placeholder="http://gpu-server:8000/v1"
                            />
                          </div>
                        ) : null}
                      </div>

                      {item.enabled_models.length > 0 && !disc ? (
                        <div className="space-y-1.5 rounded-control border border-border bg-muted/50 p-3">
                          <p className="text-[11px] text-muted-foreground">
                            Enabled models ({item.enabled_models.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.enabled_models.map((modelId) => (
                              <Badge
                                key={modelId}
                                variant="outline"
                                className="border-border bg-secondary/50 font-mono text-[11px] text-foreground"
                              >
                                {modelId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {disc ? (
                        <div className="space-y-2 rounded-control border border-border bg-muted/50 p-3">
                          <p className="text-[11px] text-muted-foreground">
                            Discovered models ({disc.source}) — select models, then Save:
                          </p>
                          {disc.models.length === 0 ? (
                            <p className="text-xs text-warning">
                              No models returned. Check your API key or Base URL.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {disc.models.map((m) => {
                                const active = item.enabled_models.includes(m.model_id);
                                return (
                                  <Button
                                    key={m.model_id}
                                    type="button"
                                    size="xs"
                                    variant={active ? "default" : "outline"}
                                    aria-pressed={active}
                                    onClick={() => toggleModelForProvider(item.provider, m.model_id)}
                                    className="cursor-pointer"
                                  >
                                    {m.display_name}
                                    {m.supports_thinking ? " · thinking" : ""}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDiscoverModels(item.provider)}
                        className="cursor-pointer"
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        <span>Discover models</span>
                      </Button>
                      <Button
                        type="button"
                        variant="highlight"
                        size="sm"
                        onClick={() => handleSaveProvider(item)}
                        className="cursor-pointer font-semibold"
                      >
                        Save provider
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="rulebook">
            {ws ? (
              <form
                onSubmit={handleSaveWorkspace}
                aria-labelledby="workspace-defaults-heading"
                className="space-y-5"
              >
                <Card>
                  <CardHeader>
                    <CardTitle
                      id="workspace-defaults-heading"
                      className="text-base font-semibold text-foreground"
                    >
                      Chat &amp; review defaults
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Controls default model, thinking effort, and Send Gate policy for users on /chat.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        id="allow-auto"
                        checked={ws.allow_auto_review}
                        onCheckedChange={(checked) =>
                          setWs({
                            ...ws,
                            allow_auto_review: checked,
                            default_review_mode: checked ? ws.default_review_mode : "manual",
                          })
                        }
                      />
                      <Label htmlFor="allow-auto" className="text-sm text-foreground">
                        Allow Auto Review mode
                      </Label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="default-model" className="text-xs text-muted-foreground">
                          Default provider &amp; model
                        </Label>
                        <Select
                          value={activeDefaultModelValue}
                          disabled={availableModels.length === 0}
                          onValueChange={(value) => {
                            if (!value) return;
                            const [prov, ...rest] = value.split("::");
                            const modelId = rest.join("::");
                            setWs({
                              ...ws,
                              default_provider: prov,
                              default_model: modelId,
                            });
                          }}
                        >
                          <SelectTrigger id="default-model" className="w-full">
                            <SelectValue placeholder="Enable a provider first" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map((m) => {
                              const value = `${m.provider}::${m.model_id}`;
                              return (
                                <SelectItem key={value} value={value}>
                                  {m.display_name} ({m.provider_label})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="default-mode" className="text-xs text-muted-foreground">
                          Default review mode
                        </Label>
                        <Select
                          value={ws.default_review_mode}
                          onValueChange={(value) => {
                            if (value)
                              setWs({ ...ws, default_review_mode: value as "manual" | "auto" });
                          }}
                        >
                          <SelectTrigger id="default-mode" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual approval</SelectItem>
                            {ws.allow_auto_review ? (
                              <SelectItem value="auto">Auto review</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="default-thinking" className="text-xs text-muted-foreground">
                          Default thinking effort
                        </Label>
                        <Select
                          value={ws.default_thinking_effort}
                          onValueChange={(value) => {
                            if (value) {
                              setWs({
                                ...ws,
                                default_thinking_effort: value as "low" | "medium" | "high",
                              });
                            }
                          }}
                        >
                          <SelectTrigger id="default-thinking" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold text-foreground">
                          Local GPU SLM &amp; privacy rulebook
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                          Optional extraction-only local SLM layer for catching domain-specific entities missed by rules and NER.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Switch
                          id="gpu-llm"
                          checked={ws.gpu_llm_enabled}
                          onCheckedChange={(checked) => setWs({ ...ws, gpu_llm_enabled: checked })}
                        />
                        <Label htmlFor="gpu-llm" className="cursor-pointer text-xs text-foreground">
                          {ws.gpu_llm_enabled ? "GPU SLM enabled" : "GPU SLM disabled"}
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {ws.gpu_llm_enabled ? (
                      <div className="space-y-4 rounded-control border border-border bg-muted/40 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="gpu-endpoint" className="text-xs text-muted-foreground">
                              OpenAI-compatible Endpoint (vLLM / RunPod / Ollama)
                            </Label>
                            <Input
                              id="gpu-endpoint"
                              name="gpu_llm_endpoint"
                              type="url"
                              spellCheck={false}
                              autoCapitalize="none"
                              autoCorrect="off"
                              value={ws.gpu_llm_endpoint ?? ""}
                              onChange={(e) => setWs({ ...ws, gpu_llm_endpoint: e.target.value })}
                              placeholder="https://<pod-id>-8000.proxy.runpod.net/v1"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="gpu-model" className="text-xs text-muted-foreground">
                              SLM Model ID
                            </Label>
                            <Input
                              id="gpu-model"
                              name="gpu_llm_model"
                              spellCheck={false}
                              autoCapitalize="none"
                              autoCorrect="off"
                              value={ws.gpu_llm_model ?? ""}
                              onChange={(e) => setWs({ ...ws, gpu_llm_model: e.target.value })}
                              placeholder="Qwen/Qwen2.5-7B-Instruct-AWQ"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor="gpu-api-key" className="text-xs text-muted-foreground">
                                Optional Bearer API Key{" "}
                                {ws.gpu_llm_key_hint ? (
                                  <span className="font-mono text-highlight">
                                    ({ws.gpu_llm_key_hint})
                                  </span>
                                ) : null}
                              </Label>
                              {ws.gpu_llm_key_configured ? (
                                <button
                                  type="button"
                                  onClick={() => setClearGpuKey((prev) => !prev)}
                                  className="cursor-pointer text-[11px] text-destructive hover:text-destructive-foreground"
                                >
                                  {clearGpuKey ? "Keep existing key" : "Clear stored key"}
                                </button>
                              ) : null}
                            </div>
                            <Input
                              id="gpu-api-key"
                              name="gpu_llm_api_key"
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              autoCapitalize="none"
                              autoCorrect="off"
                              value={gpuKeyDraft}
                              onChange={(e) => {
                                setGpuKeyDraft(e.target.value);
                                if (e.target.value) setClearGpuKey(false);
                              }}
                              placeholder={
                                ws.gpu_llm_key_configured
                                  ? "Enter new key to rotate (leave blank to keep)"
                                  : "Optional token for protected vLLM endpoints"
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={testingGpu || !ws.gpu_llm_endpoint?.trim()}
                            onClick={handleTestGpu}
                            className="cursor-pointer"
                          >
                            <Activity className="size-3.5" aria-hidden="true" />
                            <span>
                              {testingGpu ? "Testing connection..." : "Test GPU connection"}
                            </span>
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Probes <code className="font-mono text-foreground">/models</code> using
                            your current draft settings.
                          </p>
                        </div>

                        {gpuTestResult ? (
                          <div
                            role="status"
                            className={`space-y-2 rounded-control border p-3 text-xs ${
                              gpuTestResult.ok
                                ? "border-success/35 bg-success/10 text-success"
                                : "border-warning/35 bg-warning/10 text-warning"
                            }`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {gpuTestResult.ok ? (
                                <CheckCircle2 className="size-4" aria-hidden="true" />
                              ) : (
                                <XCircle className="size-4" aria-hidden="true" />
                              )}
                              <span>{gpuTestResult.detail}</span>
                            </div>
                            {gpuTestResult.available_models.length > 0 &&
                            !gpuTestResult.model_found ? (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-muted-foreground">Use detected model:</span>
                                {gpuTestResult.available_models.map((mid) => (
                                  <Button
                                    key={mid}
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setWs({ ...ws, gpu_llm_model: mid })}
                                    className="cursor-pointer font-mono text-[11px]"
                                  >
                                    {mid}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="rulebook-prompt" className="text-xs text-muted-foreground">
                        Privacy Rulebook Instructions
                      </Label>
                      <Textarea
                        id="rulebook-prompt"
                        name="rulebook_prompt"
                        rows={4}
                        value={ws.rulebook_prompt}
                        onChange={(e) => setWs({ ...ws, rulebook_prompt: e.target.value })}
                      />
                    </div>

                    <div className="flex justify-end border-t border-border pt-4">
                      <Button
                        type="submit"
                        variant="highlight"
                        className="cursor-pointer px-5 font-semibold"
                      >
                        Save workspace settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            ) : null}
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle id="custom-rules-heading" className="text-base font-semibold text-foreground">
                    Company custom rules
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Applied in Layer 1 filtering. Import a{" "}
                    <code className="font-mono text-foreground">.md</code> policy file with{" "}
                    <code className="font-mono text-foreground">- pattern | TYPE</code> lines and SLM
                    rulebook notes.
                  </CardDescription>
                </div>
                <label
                  htmlFor="rules-md-upload"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "shrink-0 cursor-pointer border-highlight/30 bg-accent/60 text-highlight hover:bg-accent",
                  )}
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  <span>{importingMarkdown ? "Importing .md..." : "Import rules (.md)"}</span>
                  <input
                    id="rules-md-upload"
                    type="file"
                    accept=".md,.markdown,.txt"
                    disabled={importingMarkdown}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportRulesMarkdown(file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  onSubmit={handleAddRule}
                  aria-labelledby="custom-rules-heading"
                  className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_180px_auto_auto] lg:items-end"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-pattern" className="text-xs font-medium text-muted-foreground">
                      Keyword or regex pattern
                    </Label>
                    <Input
                      id="rule-pattern"
                      name="pattern"
                      required
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="e.g. PROJECT-ORION"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rule-type" className="text-xs font-medium text-muted-foreground">
                      Entity type
                    </Label>
                    <Select
                      value={entityType}
                      onValueChange={(value) => {
                        if (value) setEntityType(value as EntityType);
                      }}
                    >
                      <SelectTrigger id="rule-type" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((item) => (
                          <SelectItem key={item} value={item} className="text-xs">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex h-10 items-center gap-2 px-1">
                    <Switch
                      id="rule-regex"
                      checked={isRegex}
                      onCheckedChange={(checked) => setIsRegex(checked)}
                    />
                    <Label htmlFor="rule-regex" className="text-xs text-muted-foreground">
                      Regex
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    variant="highlight"
                    className="h-10 cursor-pointer px-4 text-xs font-semibold"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    <span>Add rule</span>
                  </Button>
                </form>

                {rules.length === 0 ? (
                  <div className="rounded-control border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-foreground">No custom rules yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add internal codenames, client identifiers, or regex patterns above, or import a Markdown policy file.
                    </p>
                  </div>
                ) : (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="custom-rules-heading"
                    className="overflow-x-auto rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground">Pattern</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Type</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Mode</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Enabled</TableHead>
                          <TableHead className="text-right text-xs text-muted-foreground">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((rule) => (
                          <TableRow key={rule.id} className="border-border/60 hover:bg-secondary/40">
                            <TableCell className="font-mono text-xs text-foreground">
                              {rule.pattern}
                            </TableCell>
                            <TableCell>
                              <EntityBadge entityType={rule.entity_type} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rule.is_regex ? "Regex" : "Keyword"}
                            </TableCell>
                            <TableCell>
                              <Switch
                                aria-label={`Toggle ${rule.pattern}`}
                                checked={rule.enabled}
                                onCheckedChange={(checked) => handleToggleRule(rule, checked)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Delete ${rule.pattern}`}
                                onClick={() => setPendingDeleteRule(rule)}
                                className="cursor-pointer text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle id="provision-user-heading" className="text-base font-semibold text-foreground">
                  Workspace accounts
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Public sign-up is disabled. Only the Owner can add or deactivate accounts (
                  {users.filter((u) => u.is_active).length} active / {users.length} total).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  onSubmit={handleCreateUser}
                  aria-labelledby="provision-user-heading"
                  className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_130px_auto] lg:items-end"
                >
                  <div className="space-y-1">
                    <Label htmlFor="new-user-name" className="text-xs text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      id="new-user-name"
                      name="full_name"
                      autoComplete="name"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Karim"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-user-email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="new-user-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="karim@company.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-user-pass" className="text-xs text-muted-foreground">
                      Password
                    </Label>
                    <Input
                      id="new-user-pass"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="min 8 chars"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-user-role" className="text-xs text-muted-foreground">
                      Role
                    </Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(v) => {
                        if (v) setNewUserRole(v as "user" | "owner");
                      }}
                    >
                      <SelectTrigger id="new-user-role" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    variant="highlight"
                    className="h-10 cursor-pointer px-4 text-xs font-semibold"
                  >
                    <UserPlus className="size-3.5" aria-hidden="true" />
                    <span>Add</span>
                  </Button>
                </form>

                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Provisioned workspace accounts"
                  className="overflow-x-auto rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">Name</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Email</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Role</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                        <TableHead className="text-right text-xs text-muted-foreground">
                          Active
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((account) => {
                        const isSelf = account.id === user?.id;
                        return (
                          <TableRow
                            key={account.id}
                            className="border-border/60 hover:bg-secondary/40"
                          >
                            <TableCell className="text-xs font-medium text-foreground">
                              {account.full_name}
                              {isSelf ? (
                                <span className="ml-1.5 text-[11px] text-muted-foreground">
                                  (you)
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {account.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-border bg-secondary/50 text-[11px] capitalize text-foreground"
                              >
                                {account.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  account.is_active
                                    ? "border-success/35 bg-success/10 text-[11px] text-success"
                                    : "border-destructive/35 bg-destructive/10 text-[11px] text-destructive-foreground"
                                }
                              >
                                {account.is_active ? "Active" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex justify-end">
                                <Switch
                                  aria-label={`Toggle active status for ${account.email}`}
                                  checked={account.is_active}
                                  disabled={isSelf}
                                  onCheckedChange={(checked) =>
                                    handleToggleUserStatus(account, checked)
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle id="audit-log-heading" className="text-base font-semibold text-foreground">
                    Metadata-only audit log
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Live from GET /api/audit · Never stores raw text, prompts, or vault mappings.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={refreshingAudit}
                  onClick={handleRefreshAudit}
                  className="cursor-pointer"
                >
                  <RefreshCw
                    className={`size-3.5 ${refreshingAudit ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span>Refresh</span>
                </Button>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="rounded-control border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
                    No audit events recorded yet.
                  </div>
                ) : (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="audit-log-heading"
                    className="overflow-x-auto rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground">Event</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Provider</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Decision</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Entities</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Session</TableHead>
                          <TableHead className="text-right text-xs text-muted-foreground">
                            Time
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((entry) => {
                          const counts = entry.entity_counts
                            ? Object.entries(entry.entity_counts)
                            : [];
                          const exactDate = new Date(entry.created_at).toLocaleString();
                          return (
                            <TableRow
                              key={entry.id}
                              className="border-border/60 hover:bg-secondary/40"
                            >
                              <TableCell className="font-mono text-xs text-highlight">
                                {entry.action}
                              </TableCell>
                              <TableCell className="text-xs text-foreground">
                                {entry.provider ?? "—"}
                              </TableCell>
                              <TableCell>
                                {entry.approved === null ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : entry.approved ? (
                                  <Badge
                                    variant="outline"
                                    className="border-success/35 bg-success/10 text-[10px] text-success"
                                  >
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/35 bg-destructive/10 text-[10px] text-destructive-foreground"
                                  >
                                    Rejected
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {counts.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {counts.map(([key, count]) => (
                                      <Badge
                                        key={key}
                                        variant="outline"
                                        className="border-border bg-secondary/50 font-mono text-[10px] text-foreground"
                                      >
                                        {key}:{count}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {entry.gateway_session_id
                                  ? entry.gateway_session_id.slice(0, 8)
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="text-right text-xs text-muted-foreground"
                                title={exactDate}
                              >
                                {formatRelativeTime(entry.created_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog
        open={Boolean(pendingDeleteRule)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteRule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/15 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete custom rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <code className="font-mono font-medium text-foreground">
                {pendingDeleteRule?.pattern}
              </code>{" "}
              from Layer 1 filtering. Future messages will no longer match this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDeleteRule) {
                  const id = pendingDeleteRule.id;
                  setPendingDeleteRule(null);
                  void handleDeleteRule(id);
                }
              }}
              className="cursor-pointer"
            >
              <Trash2 aria-hidden="true" />
              <span>Delete rule</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
