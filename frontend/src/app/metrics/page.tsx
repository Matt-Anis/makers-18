"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
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
import { ApiError, apiFetch, DatasetMetrics, MetricsReport } from "@/lib/api";

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

export default function MetricsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [report, setReport] = useState<MetricsReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [includeGpuSlm, setIncludeGpuSlm] = useState(false);
  const [activeTab, setActiveTab] = useState<"synthetic" | "realistic">("realistic");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loading = isOwner && !loaded;

  useEffect(() => {
    if (!isOwner) {
      return;
    }
    let active = true;
    apiFetch<MetricsReport>("/metrics/latest")
      .then((data) => {
        if (!active) return;
        setReport(data);
        setIncludeGpuSlm(data.gpu_slm_active);
      })
      .catch(() => {
        if (active) setStatusMessage("Could not load evaluation metrics.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isOwner]);

  async function handleRunEvaluation() {
    setRunning(true);
    setStatusMessage(null);
    try {
      const data = await apiFetch<MetricsReport>("/metrics/run", {
        method: "POST",
        body: JSON.stringify({ include_gpu_slm: includeGpuSlm }),
      });
      setReport(data);
      setStatusMessage(
        `Completed benchmark in ${data.duration_ms ?? 0}ms across 60 synthetic + 14 realistic contracts.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Evaluation benchmark failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  const activeDataset: DatasetMetrics | null =
    activeTab === "synthetic" ? (report?.synthetic ?? null) : (report?.realistic ?? null);

  return (
    <DashboardShell
      title="Evaluation & Ablation Metrics"
      subtitle="Live recall, precision, leak-free contract rate, layer-by-layer ablation, and unmask round-trip accuracy."
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
            Evaluation benchmarks are restricted to the workspace Owner.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className="nyxora-surface rounded-3xl border ring-0">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {report?.has_run ? "Latest benchmark snapshot" : "Ready to run benchmark"}
                  </span>
                  {report?.has_run ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-400/40 bg-emerald-500/15 text-[11px] text-emerald-200"
                    >
                      <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
                      {report.duration_ms}ms
                    </Badge>
                  ) : null}
                  {report?.presidio_active ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-[#9b82ff]/40 bg-[#7c5cff]/15 text-[11px] text-[#d6cbff]"
                    >
                      Presidio + spaCy active
                    </Badge>
                  ) : null}
                  {report?.gpu_slm_active ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-400/40 bg-emerald-500/15 text-[11px] text-emerald-200"
                    >
                      GPU SLM evaluated
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-white/60">
                  {report?.has_run && report.created_at
                    ? `Last run: ${new Date(report.created_at).toLocaleString()} · Evaluates your live detection pipeline, active custom rules, and VaultData unmask round-trip.`
                    : "Runs 60 synthetic + 14 realistic labeled contract snippets against your active rules and detection layers."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="eval-include-gpu"
                    checked={includeGpuSlm}
                    disabled={!report?.gpu_slm_configured || running}
                    onCheckedChange={setIncludeGpuSlm}
                  />
                  <Label
                    htmlFor="eval-include-gpu"
                    className={`text-xs ${
                      report?.gpu_slm_configured ? "text-white/85" : "text-white/45"
                    }`}
                  >
                    Include GPU SLM
                  </Label>
                </div>

                <Button
                  type="button"
                  disabled={running || loading}
                  onClick={handleRunEvaluation}
                  className="h-9 cursor-pointer bg-white px-4 text-xs font-semibold text-zinc-950 hover:bg-white/90"
                >
                  {running ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                      <span>Running suite...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" aria-hidden="true" />
                      <span>{report?.has_run ? "Re-run benchmark" : "Run benchmark"}</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {!loading && !report?.has_run ? (
            <Alert className="nyxora-surface rounded-3xl border-white/12 text-white">
              <Info className="text-[#a78bfa]" aria-hidden="true" />
              <AlertTitle>No evaluation run saved yet</AlertTitle>
              <AlertDescription className="text-white/60">
                Click <strong className="text-white">Run benchmark</strong> above to execute
                NYXORA&apos;s live detection and unmasking pipeline across both contract suites and
                persist results to SQLite.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Overall recall",
                value: formatPct(activeDataset?.overall_recall),
                hint: activeDataset
                  ? `${activeDataset.tp} caught / ${activeDataset.tp + activeDataset.fn} gold entities`
                  : "Target: maximize catch rate",
              },
              {
                label: "Overall precision",
                value: formatPct(activeDataset?.overall_precision),
                hint: activeDataset
                  ? `${activeDataset.fp} false positive(s)`
                  : "False-positive balance",
              },
              {
                label: "Leak-free contracts",
                value: formatPct(activeDataset?.leak_free_rate),
                hint: activeDataset
                  ? `Zero missed entities (${activeDataset.document_count} contracts)`
                  : "Zero missed entities",
              },
              {
                label: "Unmask round trip",
                value: formatPct(activeDataset?.unmask_round_trip),
                hint: "Target: 100% exact VaultData restore",
              },
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

          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              if (val === "synthetic" || val === "realistic") setActiveTab(val);
            }}
            className="space-y-4"
          >
            <TabsList className="rounded-full border border-white/10 bg-white/[0.04] p-1">
              <TabsTrigger value="realistic" className="rounded-full px-4 text-xs">
                Realistic set ({report?.realistic?.document_count ?? 14})
              </TabsTrigger>
              <TabsTrigger value="synthetic" className="rounded-full px-4 text-xs">
                Synthetic set ({report?.synthetic?.document_count ?? 60})
              </TabsTrigger>
            </TabsList>

            {(["realistic", "synthetic"] as const).map((tab) => {
              const dataset = tab === "synthetic" ? report?.synthetic : report?.realistic;
              return (
                <TabsContent key={tab} value={tab} className="grid gap-6 lg:grid-cols-2">
                  <Card className="nyxora-surface rounded-3xl border ring-0">
                    <CardHeader>
                      <CardTitle
                        id={`entity-table-heading-${tab}`}
                        className="text-base font-semibold text-white"
                      >
                        Per-entity recall &amp; precision
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {tab === "synthetic"
                          ? "Exact labels generated from contract templates (tends to overestimate real-world recall)."
                          : "Hand-labeled realistic contract clauses (honest benchmark including unseen names/companies)."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        tabIndex={0}
                        role="region"
                        aria-labelledby={`entity-table-heading-${tab}`}
                        className="overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b82ff]"
                      >
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="text-xs text-white/55">Entity</TableHead>
                              <TableHead className="text-right text-xs text-white/55">
                                Recall
                              </TableHead>
                              <TableHead className="text-right text-xs text-white/55">
                                Precision
                              </TableHead>
                              <TableHead className="text-right text-xs text-white/55">
                                Support
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(dataset?.per_entity ?? []).length === 0 ? (
                              <TableRow className="border-white/[0.07]">
                                <TableCell
                                  colSpan={4}
                                  className="py-6 text-center text-xs text-white/50"
                                >
                                  Run benchmark to populate per-entity metrics.
                                </TableCell>
                              </TableRow>
                            ) : (
                              dataset!.per_entity.map((row) => (
                                <TableRow
                                  key={row.type}
                                  className="border-white/[0.07] hover:bg-white/[0.03]"
                                >
                                  <TableCell>
                                    <EntityBadge entityType={row.type} />
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-white/85">
                                    {formatPct(row.recall)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-white/85">
                                    {formatPct(row.precision)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-white/55">
                                    {row.tp}/{row.support}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="nyxora-surface rounded-3xl border ring-0">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-white">
                        Layer-by-layer ablation
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Cumulative recall as each NYXORA detection layer is enabled.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {(dataset?.ablation ?? []).length === 0 ? (
                        <p className="py-6 text-center text-xs text-white/50">
                          Run benchmark to compare cumulative recall across layers.
                        </p>
                      ) : (
                        dataset!.ablation.map((layer, index) => {
                          const prevRecall =
                            index > 0 ? dataset!.ablation[index - 1]?.recall : null;
                          const delta =
                            layer.active &&
                            layer.recall !== null &&
                            prevRecall !== null
                              ? Math.round((layer.recall - prevRecall) * 10) / 10
                              : null;

                          return (
                            <div key={layer.key} className="space-y-1.5">
                              <Progress
                                value={layer.active && layer.recall !== null ? layer.recall : 0}
                                className="gap-2"
                              >
                                <ProgressLabel
                                  className={`text-xs ${
                                    layer.active ? "text-white/85" : "text-white/45"
                                  }`}
                                >
                                  {layer.label}
                                </ProgressLabel>
                                <ProgressValue className="font-mono text-xs text-[#a78bfa]">
                                  {() =>
                                    layer.active && layer.recall !== null
                                      ? `${layer.recall.toFixed(1)}%${
                                          delta !== null && delta !== 0
                                            ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(1)}%)`
                                            : ""
                                        }`
                                      : "Skipped"
                                  }
                                </ProgressValue>
                              </Progress>
                              {layer.note ? (
                                <p className="text-[11px] text-white/45">{layer.note}</p>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}
    </DashboardShell>
  );
}
