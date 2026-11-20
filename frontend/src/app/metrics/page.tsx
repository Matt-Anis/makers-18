"use client";

import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MetricsPage() {
  return (
    <DashboardShell
      title="Evaluation & Ablation Metrics"
      subtitle="Recall, precision, leak-free contract rate, layer-by-layer ablation, and unmask round-trip accuracy."
    >
      <Card className="nyxora-glass rounded-2xl border ring-0">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-[0.14em] text-white">
            Latest benchmark snapshot
          </CardTitle>
          <CardDescription className="text-white/60">
            Ready to wire to GET /metrics/latest once the evaluation runner outputs results.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-white/65">
          Target metrics: per-entity recall &amp; precision, leak-free document %, layer ablation
          (rules → NER → GLiNER → LLM check), and 100% mask/unmask round trip.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
