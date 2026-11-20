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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderConfigOut[]>([]);
  const [availableModels, setAvailableModels] = useState<DiscoveredModel[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [clearKeyByProvider, setClearKeyByProvider] = useState<Record<string, boolean>>({});
  const [baseUrlDrafts, setBaseUrlDrafts] = useState<Record<string, string>>({});
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
        if (active) setStatusMessage("Could not load owner settings.");
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
    setStatusMessage(null);
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
      setStatusMessage(`Saved ${item.label} settings (API key encrypted at rest).`);
      await refreshAvailableModels();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Failed to save provider.");
    }
  }

  async function handleDiscoverModels(providerId: string) {
    setStatusMessage(null);
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
      setStatusMessage(
        `Discovered ${result.models.length} model(s) for ${providerId} (${result.source}).`,
      );
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Discovery failed.");
    }
  }

  function toggleModelForProvider(providerId: string, modelId: string) {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.provider !== providerId) return p;
        const exists = p.enabled_models.includes(modelId);
        return {
          ...p,
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
    setStatusMessage(null);
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
      setStatusMessage("Saved workspace defaults & rulebook settings.");
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not save settings.");
    }
  }

  async function handleTestGpu() {
    if (!ws) return;
    setTestingGpu(true);
    setGpuTestResult(null);
    setStatusMessage(null);
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
      setStatusMessage(
        error instanceof ApiError ? error.message : "Could not test GPU SLM connection.",
      );
    } finally {
      setTestingGpu(false);
    }
  }

  async function handleAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = pattern.trim();
    if (!cleaned) return;
    setStatusMessage(null);
    try {
      const created = await apiFetch<CustomRule>("/rules", {
        method: "POST",
        body: JSON.stringify({ pattern: cleaned, entity_type: entityType, is_regex: isRegex }),
      });
      setRules((prev) => [created, ...prev]);
      setPattern("");
      setStatusMessage(`Added rule "${created.pattern}".`);
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not add rule.");
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
      setStatusMessage(error instanceof ApiError ? error.message : "Could not update rule.");
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      await apiFetch<{ status: string }>(`/rules/${ruleId}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not delete rule.");
    }
  }

  async function handleImportRulesMarkdown(file: File) {
    setImportingMarkdown(true);
    setStatusMessage(null);
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
      setStatusMessage(`Imported "${result.filename}": ${parts.join(", ")}.`);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Could not import Markdown rules file.",
      );
    } finally {
      setImportingMarkdown(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
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
      setStatusMessage("Provisioned new account.");
      await loadAll();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not create user.");
    }
  }

  async function handleToggleUserStatus(target: User, nextActive: boolean) {
    setStatusMessage(null);
    try {
      const updated = await apiFetch<User>(`/auth/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setStatusMessage(
        `${updated.email} is now ${updated.is_active ? "active" : "disabled"}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Could not update user status.",
      );
    }
  }

  async function handleRefreshAudit() {
    setRefreshingAudit(true);
    try {
      const logs = await apiFetch<AuditLogEntry[]>("/audit?limit=50");
      setAuditLogs(logs);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Could not refresh audit log.",
      );
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
      subtitle="Configure encrypted provider API keys, enabled models, rulebook instructions, custom rules, and workspace users."
    >
      <div
        role="status"
        aria-live="polite"
        className={
          statusMessage
            ? "rounded-2xl border border-[#9b82ff]/40 bg-[#7c5cff]/15 px-4 py-2.5 text-sm text-white"
            : "sr-only"
        }
      >
        {statusMessage ?? ""}
      </div>

      {!isOwner ? (
        <Alert className="nyxora-surface rounded-3xl border-amber-400/35 text-amber-100">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Owner access required</AlertTitle>
          <AlertDescription className="text-amber-200/80">
            Only the workspace Owner can manage API keys, rulebook settings, or audit logs.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="providers" className="space-y-4">
          <TabsList className="rounded-full border border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger value="providers" className="rounded-full px-4 text-xs">
              Providers &amp; Keys
            </TabsTrigger>
            <TabsTrigger value="rulebook" className="rounded-full px-4 text-xs">
              Rulebook &amp; Defaults
            </TabsTrigger>
            <TabsTrigger value="rules" className="rounded-full px-4 text-xs">
              Custom Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-full px-4 text-xs">
              Users &amp; Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            {providers.map((item) => {
              const disc = discoveredByProvider[item.provider];
              const isClearing = Boolean(clearKeyByProvider[item.provider]);
              return (
                <Card key={item.provider} className="nyxora-surface rounded-3xl border ring-0">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CardTitle className="text-base font-semibold text-white">
                          {item.label}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={
                            item.is_configured
                              ? "rounded-full border-emerald-400/40 bg-emerald-500/15 text-xs text-emerald-200"
                              : "rounded-full border-white/15 bg-white/[0.04] text-xs text-white/60"
                          }
                        >
                          <KeyRound className="mr-1 size-3" aria-hidden="true" />
                          {item.is_configured
                            ? item.key_hint
                              ? `Configured (${item.key_hint})`
                              : "Ready"
                            : "Key required"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          aria-label={`Enable ${item.label}`}
                          checked={item.enabled}
                          onCheckedChange={(checked) =>
                            setProviders((prev) =>
                              prev.map((p) =>
                                p.provider === item.provider ? { ...p, enabled: checked } : p,
                              ),
                            )
                          }
                        />
                        <span className="text-xs text-white/75">
                          {item.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {item.requires_api_key || item.provider === "openai_compatible" ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`key-${item.provider}`} className="text-xs text-white/75">
                              API key {item.key_hint ? `(saved: ${item.key_hint})` : ""}
                            </Label>
                            {item.key_hint ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setClearKeyByProvider((prev) => ({
                                    ...prev,
                                    [item.provider]: !prev[item.provider],
                                  }))
                                }
                                className="cursor-pointer text-[11px] text-red-300 hover:text-red-200"
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
                          <Label htmlFor={`url-${item.provider}`} className="text-xs text-white/75">
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
                            onChange={(e) =>
                              setBaseUrlDrafts((prev) => ({
                                ...prev,
                                [item.provider]: e.target.value,
                              }))
                            }
                            placeholder="http://gpu-server:8000/v1"
                          />
                        </div>
                      ) : null}
                    </div>

                    {item.enabled_models.length > 0 && !disc ? (
                      <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs text-white/60">
                          Enabled models ({item.enabled_models.length}) — click Discover models to
                          edit:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.enabled_models.map((modelId) => (
                            <Badge
                              key={modelId}
                              variant="outline"
                              className="rounded-full border-white/15 bg-white/[0.05] font-mono text-[11px] text-white/85"
                            >
                              {modelId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {disc ? (
                      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                        <p className="text-xs text-white/65">
                          Discovered models ({disc.source}) — toggle which ones users can select,
                          then click Save provider:
                        </p>
                        {disc.models.length === 0 ? (
                          <p className="text-xs text-amber-200/80">
                            No models returned. Check your API key or Base URL.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
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

                    <div className="flex flex-wrap justify-end gap-2">
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
                        size="sm"
                        onClick={() => handleSaveProvider(item)}
                        className="cursor-pointer bg-white text-zinc-950 hover:bg-white/90"
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
              <Card className="nyxora-surface rounded-3xl border ring-0">
                <CardHeader>
                  <CardTitle id="workspace-settings-heading" className="text-base font-semibold text-white">
                    Review defaults &amp; GPU rulebook
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Controls what simple users see on /chat and the rulebook used by the local GPU LLM layer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleSaveWorkspace}
                    aria-labelledby="workspace-settings-heading"
                    className="space-y-5"
                  >
                    <div className="flex flex-wrap items-center gap-6">
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
                        <Label htmlFor="allow-auto" className="text-sm text-white/85">
                          Allow Auto Review mode
                        </Label>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Switch
                          id="gpu-llm"
                          checked={ws.gpu_llm_enabled}
                          onCheckedChange={(checked) => setWs({ ...ws, gpu_llm_enabled: checked })}
                        />
                        <Label htmlFor="gpu-llm" className="text-sm text-white/85">
                          Enable GPU Rulebook LLM
                        </Label>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="default-model" className="text-xs text-white/75">
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
                          <SelectTrigger id="default-model" className="w-full rounded-full">
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
                        <Label htmlFor="default-mode" className="text-xs text-white/75">
                          Default review mode
                        </Label>
                        <Select
                          value={ws.default_review_mode}
                          onValueChange={(value) => {
                            if (value) setWs({ ...ws, default_review_mode: value as "manual" | "auto" });
                          }}
                        >
                          <SelectTrigger id="default-mode" className="w-full rounded-full">
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
                        <Label htmlFor="default-thinking" className="text-xs text-white/75">
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
                          <SelectTrigger id="default-thinking" className="w-full rounded-full">
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

                    {ws.gpu_llm_enabled ? (
                      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="gpu-endpoint" className="text-xs text-white/75">
                              GPU Server OpenAI-compatible Endpoint (vLLM / RunPod / Ollama)
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
                            <Label htmlFor="gpu-model" className="text-xs text-white/75">
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
                              <Label htmlFor="gpu-api-key" className="text-xs text-white/75">
                                Optional Bearer API Key{" "}
                                {ws.gpu_llm_key_hint ? (
                                  <span className="font-mono text-[#b8a5ff]">
                                    ({ws.gpu_llm_key_hint})
                                  </span>
                                ) : null}
                              </Label>
                              {ws.gpu_llm_key_configured ? (
                                <button
                                  type="button"
                                  onClick={() => setClearGpuKey((prev) => !prev)}
                                  className="cursor-pointer text-[11px] text-red-300 hover:text-red-200"
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
                            <span>{testingGpu ? "Testing connection..." : "Test GPU connection"}</span>
                          </Button>
                          <p className="text-xs text-white/55">
                            Probes <code className="font-mono text-white/75">/models</code> using
                            your current draft settings.
                          </p>
                        </div>

                        {gpuTestResult ? (
                          <div
                            role="status"
                            className={`space-y-2 rounded-2xl border p-3 text-xs ${
                              gpuTestResult.ok
                                ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                                : "border-amber-400/35 bg-amber-500/10 text-amber-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {gpuTestResult.ok ? (
                                <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
                              ) : (
                                <XCircle className="size-4 text-amber-300" aria-hidden="true" />
                              )}
                              <span>{gpuTestResult.detail}</span>
                            </div>
                            {gpuTestResult.available_models.length > 0 && !gpuTestResult.model_found ? (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-white/70">Use detected model:</span>
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
                      <Label htmlFor="rulebook-prompt" className="text-xs text-white/75">
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

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="cursor-pointer bg-white px-5 text-zinc-950 hover:bg-white/90"
                      >
                        Save workspace settings
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="rules">
            <Card className="nyxora-surface rounded-3xl border ring-0">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle id="custom-rules-heading" className="text-base font-semibold text-white">
                    Company custom rules
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Persisted in SQLite (/api/rules) and applied in Layer 1 filtering. Or import a{" "}
                    <code className="font-mono text-white/80">.md</code> policy file with{" "}
                    <code className="font-mono text-white/80">- pattern | TYPE</code> lines and SLM
                    rulebook notes.
                  </CardDescription>
                </div>
                <label
                  htmlFor="rules-md-upload"
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#9b82ff]/40 bg-[#7c5cff]/15 px-4 text-xs font-medium text-white transition-colors hover:bg-[#7c5cff]/25"
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
                    <Label htmlFor="rule-pattern" className="text-xs font-medium text-white/75">
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
                    <Label htmlFor="rule-type" className="text-xs font-medium text-white/75">
                      Entity type
                    </Label>
                    <Select
                      value={entityType}
                      onValueChange={(value) => {
                        if (value) setEntityType(value as EntityType);
                      }}
                    >
                      <SelectTrigger id="rule-type" className="w-full rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((item) => (
                          <SelectItem key={item} value={item} className="rounded-xl text-xs">
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
                    <Label htmlFor="rule-regex" className="text-xs text-white/75">
                      Regex
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="h-10 cursor-pointer bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-white/90"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    <span>Add rule</span>
                  </Button>
                </form>

                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="custom-rules-heading"
                  className="overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b82ff]"
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-xs text-white/55">Pattern</TableHead>
                        <TableHead className="text-xs text-white/55">Type</TableHead>
                        <TableHead className="text-xs text-white/55">Mode</TableHead>
                        <TableHead className="text-xs text-white/55">Enabled</TableHead>
                        <TableHead className="text-right text-xs text-white/55">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => (
                        <TableRow key={rule.id} className="border-white/[0.07] hover:bg-white/[0.03]">
                          <TableCell className="font-mono text-xs text-white">
                            {rule.pattern}
                          </TableCell>
                          <TableCell>
                            <EntityBadge entityType={rule.entity_type} />
                          </TableCell>
                          <TableCell className="text-xs text-white/70">
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
                              onClick={() => handleDeleteRule(rule.id)}
                              className="cursor-pointer text-white/60 hover:bg-red-500/15 hover:text-red-200"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="nyxora-surface rounded-3xl border ring-0">
              <CardHeader>
                <CardTitle id="provision-user-heading" className="text-base font-semibold text-white">
                  Provision workspace account
                </CardTitle>
                <CardDescription className="text-white/60">
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
                    <Label htmlFor="new-user-name" className="text-xs text-white/75">
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
                    <Label htmlFor="new-user-email" className="text-xs text-white/75">
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
                    <Label htmlFor="new-user-pass" className="text-xs text-white/75">
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
                    <Label htmlFor="new-user-role" className="text-xs text-white/75">
                      Role
                    </Label>
                    <Select
                      value={newUserRole}
                      onValueChange={(v) => {
                        if (v) setNewUserRole(v as "user" | "owner");
                      }}
                    >
                      <SelectTrigger id="new-user-role" className="w-full rounded-full text-xs">
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
                    className="h-10 cursor-pointer bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-white/90"
                  >
                    <UserPlus className="size-3.5" aria-hidden="true" />
                    <span>Add</span>
                  </Button>
                </form>

                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Provisioned workspace accounts"
                  className="overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b82ff]"
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-xs text-white/55">Name</TableHead>
                        <TableHead className="text-xs text-white/55">Email</TableHead>
                        <TableHead className="text-xs text-white/55">Role</TableHead>
                        <TableHead className="text-xs text-white/55">Status</TableHead>
                        <TableHead className="text-right text-xs text-white/55">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((account) => {
                        const isSelf = account.id === user?.id;
                        return (
                          <TableRow
                            key={account.id}
                            className="border-white/[0.07] hover:bg-white/[0.03]"
                          >
                            <TableCell className="text-xs font-medium text-white">
                              {account.full_name}
                              {isSelf ? (
                                <span className="ml-1.5 text-[11px] text-white/50">(you)</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-white/75">
                              {account.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="rounded-full border-white/15 bg-white/[0.04] text-[11px] capitalize text-white/80"
                              >
                                {account.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  account.is_active
                                    ? "rounded-full border-emerald-400/40 bg-emerald-500/15 text-[11px] text-emerald-200"
                                    : "rounded-full border-red-400/35 bg-red-500/10 text-[11px] text-red-200"
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

            <Card className="nyxora-surface rounded-3xl border ring-0">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle id="audit-log-heading" className="text-base font-semibold text-white">
                    Metadata-only audit log
                  </CardTitle>
                  <CardDescription className="text-white/60">
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
                  <p className="text-sm text-white/55">No audit events recorded yet.</p>
                ) : (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="audit-log-heading"
                    className="overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b82ff]"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-xs text-white/55">Event</TableHead>
                          <TableHead className="text-xs text-white/55">Provider</TableHead>
                          <TableHead className="text-xs text-white/55">Decision</TableHead>
                          <TableHead className="text-xs text-white/55">Entities</TableHead>
                          <TableHead className="text-xs text-white/55">Session</TableHead>
                          <TableHead className="text-right text-xs text-white/55">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((entry) => {
                          const counts = entry.entity_counts
                            ? Object.entries(entry.entity_counts)
                            : [];
                          return (
                            <TableRow
                              key={entry.id}
                              className="border-white/[0.07] hover:bg-white/[0.03]"
                            >
                              <TableCell className="font-mono text-xs text-[#a78bfa]">
                                {entry.action}
                              </TableCell>
                              <TableCell className="text-xs text-white/75">
                                {entry.provider ?? "—"}
                              </TableCell>
                              <TableCell>
                                {entry.approved === null ? (
                                  <span className="text-xs text-white/45">—</span>
                                ) : entry.approved ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-emerald-400/40 bg-emerald-500/15 text-[10px] text-emerald-200"
                                  >
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-red-400/35 bg-red-500/10 text-[10px] text-red-200"
                                  >
                                    Rejected
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {counts.length === 0 ? (
                                  <span className="text-xs text-white/45">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {counts.map(([key, count]) => (
                                      <Badge
                                        key={key}
                                        variant="outline"
                                        className="rounded-full border-white/15 bg-white/[0.04] font-mono text-[10px] text-white/80"
                                      >
                                        {key}:{count}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-white/60">
                                {entry.gateway_session_id
                                  ? entry.gateway_session_id.slice(0, 8)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs text-white/60">
                                {new Date(entry.created_at).toLocaleString()}
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
    </DashboardShell>
  );
}
