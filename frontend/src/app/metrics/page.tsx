"use client";

import { Info } from "lucide-react";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityType } from "@/features/review/types";

const ENTITY_PLACEHOLDERS: ReadonlyArray<{ type: EntityType; recall: string; precision: string }> = [
  { type: "PERSON", recall: "—", precision: "—" },
  { type: "COMPANY", recall: "—", precision: "—" },
  { type: "EMAIL", recall: "—", precision: "—" },
  { type: "PHONE", recall: "—", precision: "—" },
  { type: "ID", recall: "—", precision: "—" },
  { type: "CUSTOM", recall: "—", precision: "—" },
];

const ABLATION_LAYERS = [
  { label: "Layer 1: Regex & contract patterns", value: 0 },
  { label: "Layer 2: + spaCy NER", value: 0 },
  { label: "Layer 3: + GLiNER PII model", value: 0 },
  { label: "Layer 4: + Optional local LLM check", value: 0 },
] as const;

export default function MetricsPage() {
  return (
    <DashboardShell
      title="Evaluation & Ablation Metrics"
      subtitle="Recall, precision, leak-free contract rate, layer-by-layer ablation, and unmask round-trip accuracy."
    >
      <Alert className="nyxora-surface rounded-3xl border-white/12 text-white">
        <Info className="text-[#a78bfa]" aria-hidden="true" />
        <AlertTitle>Awaiting evaluation run</AlertTitle>
        <AlertDescription className="text-white/60">
          Run the evaluation suite and wire <code className="font-mono text-[#a78bfa]">GET /metrics/latest</code> to populate real recall, precision, and ablation numbers.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Overall recall", value: "—", hint: "Target: maximize catch rate" },
          { label: "Overall precision", value: "—", hint: "False-positive balance" },
          { label: "Leak-free contracts", value: "—", hint: "Zero missed entities" },
          { label: "Unmask round trip", value: "—", hint: "Target: 100% exact restore" },
        ].map((kpi) => (
          <Card key={kpi.label} className="nyxora-surface rounded-3xl border ring-0">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-medium text-white/60">
                {kpi.label}
              </CardDescription>
              <CardTitle className="font-mono text-2xl font-semibold text-white">
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/50">{kpi.hint}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="synthetic" className="space-y-4">
        <TabsList className="rounded-full border border-white/10 bg-white/[0.04] p-1">
          <TabsTrigger value="synthetic" className="rounded-full px-4 text-xs">
            Synthetic set (50–100)
          </TabsTrigger>
          <TabsTrigger value="realistic" className="rounded-full px-4 text-xs">
            Realistic public set (10–20)
          </TabsTrigger>
        </TabsList>

        {(["synthetic", "realistic"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="grid gap-6 lg:grid-cols-2">
            <Card className="nyxora-surface rounded-3xl border ring-0">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-white">
                  Per-entity recall &amp; precision
                </CardTitle>
                <CardDescription className="text-white/60">
                  {tab === "synthetic"
                    ? "Exact labels generated from contract templates (tends to overestimate real-world recall)."
                    : "Hand-labeled public contracts (honest realistic benchmark)."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-xs text-white/55">Entity</TableHead>
                      <TableHead className="text-right text-xs text-white/55">Recall</TableHead>
                      <TableHead className="text-right text-xs text-white/55">Precision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ENTITY_PLACEHOLDERS.map((row) => (
                      <TableRow key={row.type} className="border-white/[0.07] hover:bg-white/[0.03]">
                        <TableCell>
                          <EntityBadge entityType={row.type} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-white/75">
                          {row.recall}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-white/75">
                          {row.precision}
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
                  Layer-by-layer ablation
                </CardTitle>
                <CardDescription className="text-white/60">
                  Cumulative recall gain across the 4 local detection layers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {ABLATION_LAYERS.map((layer) => (
                  <Progress key={layer.label} value={layer.value} className="gap-2">
                    <ProgressLabel className="text-xs text-white/80">
                      {layer.label}
                    </ProgressLabel>
                    <ProgressValue className="font-mono text-xs text-[#a78bfa]">
                      {() => "—"}
                    </ProgressValue>
                  </Progress>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </DashboardShell>
  );
}
