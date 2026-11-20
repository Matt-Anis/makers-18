"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
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
import { ENTITY_TYPES, EntityType } from "@/features/review/types";
import { apiFetch, AuditLogEntry } from "@/lib/api";

interface CustomRule {
  id: string;
  pattern: string;
  entityType: EntityType;
  isRegex: boolean;
  enabled: boolean;
}

const INITIAL_RULES: CustomRule[] = [
  { id: "r_1", pattern: "APOLLO-X", entityType: "CUSTOM", isRegex: false, enabled: true },
  { id: "r_2", pattern: "\\b\\d{15}\\b", entityType: "ID", isRegex: true, enabled: true },
];

export default function RulesPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<CustomRule[]>(INITIAL_RULES);
  const [pattern, setPattern] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("CUSTOM");
  const [isRegex, setIsRegex] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let active = true;
    apiFetch<AuditLogEntry[]>("/audit?limit=15")
      .then((logs) => {
        if (active) setAuditLogs(logs);
      })
      .catch(() => {
        if (active) setAuditLogs([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function handleAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = pattern.trim();
    if (!cleaned) return;
    setRules((prev) => [
      {
        id: `r_${Date.now()}`,
        pattern: cleaned,
        entityType,
        isRegex,
        enabled: true,
      },
      ...prev,
    ]);
    setPattern("");
  }

  return (
    <DashboardShell
      title="Rules & Audit"
      subtitle="Manage company-specific keywords/regex patterns and inspect metadata-only audit events."
    >
      {user?.role !== "admin" ? (
        <Alert className="nyxora-surface rounded-3xl border-amber-400/35 text-amber-100">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription className="text-amber-200/80">
            Only administrators can modify company detection rules or view audit metadata.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className="nyxora-surface rounded-3xl border ring-0">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-white">
                  Company custom rules
                </CardTitle>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/12 bg-white/[0.04] text-xs text-white/65"
                >
                  Local preview · awaiting /rules API
                </Badge>
              </div>
              <CardDescription className="text-white/60">
                Add confidential codenames, contract identifiers, or regex patterns to mask before leaving the company.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleAddRule}
                className="grid gap-4 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="rule-pattern" className="text-xs font-medium text-white/75">
                    Keyword or regex pattern
                  </Label>
                  <Input
                    id="rule-pattern"
                    required
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. PROJECT-ORION"
                    className="h-9 rounded-full px-4 font-mono text-sm"
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
                    <SelectTrigger
                      id="rule-type"
                      className="h-9 w-full rounded-full px-3.5 text-xs text-white"
                    >
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

                <div className="flex h-9 items-center gap-2 px-1">
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
                  className="h-9 cursor-pointer bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-white/90"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Add rule</span>
                </Button>
              </form>

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
                        <EntityBadge entityType={rule.entityType} />
                      </TableCell>
                      <TableCell className="text-xs text-white/70">
                        {rule.isRegex ? "Regex" : "Keyword"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          aria-label={`Toggle ${rule.pattern}`}
                          checked={rule.enabled}
                          onCheckedChange={(checked) =>
                            setRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id ? { ...item, enabled: checked } : item,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${rule.pattern}`}
                          onClick={() =>
                            setRules((prev) => prev.filter((item) => item.id !== rule.id))
                          }
                          className="cursor-pointer text-white/60 hover:bg-red-500/15 hover:text-red-200"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="nyxora-surface rounded-3xl border ring-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-white">
                Metadata-only audit log
              </CardTitle>
              <CardDescription className="text-white/60">
                Live from GET /api/audit · Never stores raw text, prompts, or vault mappings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-white/55">No audit events recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-xs text-white/55">Event</TableHead>
                      <TableHead className="text-xs text-white/55">Provider</TableHead>
                      <TableHead className="text-xs text-white/55">Session</TableHead>
                      <TableHead className="text-right text-xs text-white/55">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((entry) => (
                      <TableRow key={entry.id} className="border-white/[0.07] hover:bg-white/[0.03]">
                        <TableCell className="font-mono text-xs text-[#a78bfa]">
                          {entry.action}
                        </TableCell>
                        <TableCell className="text-xs text-white/75">
                          {entry.provider ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-white/60">
                          {entry.gateway_session_id ? entry.gateway_session_id.slice(0, 8) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-white/60">
                          {new Date(entry.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
