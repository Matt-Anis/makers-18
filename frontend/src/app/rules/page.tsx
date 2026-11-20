"use client";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RulesPage() {
  const { user } = useAuth();

  return (
    <DashboardShell
      title="Custom Detection Rules"
      subtitle="Manage company-specific keywords and regex patterns (project codenames, internal IDs)."
    >
      <Card className="nyxora-glass rounded-2xl border ring-0">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
            Company rule pack
          </CardTitle>
          <CardDescription className="text-white/60">
            {user?.role === "admin"
              ? "Ready to connect to GET/POST /rules once the detection module lands."
              : "Admin role required to modify company custom rules."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <EntityBadge entityType="PERSON" />
          <EntityBadge entityType="ORG" />
          <EntityBadge entityType="ID_NUMBER" />
          <EntityBadge entityType="CUSTOM" />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
