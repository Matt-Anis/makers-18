"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, AuditLogEntry } from "@/lib/api";

export default function RulesPage() {
  const { user } = useAuth();
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

  return (
    <DashboardShell
      title="Custom Rules & Audit"
      subtitle="Manage company-specific keywords/regex patterns and inspect metadata-only audit events."
    >
      <Card className="nyxora-glass rounded-2xl border ring-0">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
            Company rule pack
          </CardTitle>
          <CardDescription className="text-white/60">
            {user?.role === "admin"
              ? "Ready to connect to GET/POST /rules once the detection module lands."
              : "Admin role required to manage custom rules."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <EntityBadge entityType="PERSON" />
          <EntityBadge entityType="COMPANY" />
          <EntityBadge entityType="ID" />
          <EntityBadge entityType="CUSTOM" />
        </CardContent>
      </Card>

      {user?.role === "admin" ? (
        <Card className="nyxora-glass rounded-2xl border ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Metadata-only audit log
            </CardTitle>
            <CardDescription className="text-white/60">
              Never stores raw text, prompts, or vault mappings.
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
