"use client";

import { ArrowRight, ArrowUpRight, ShieldAlert } from "lucide-react";
import { EntityBadge } from "@/components/nyxora/entity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MaskedText } from "@/features/review/masked-text";
import { ENTITY_COLORS, Finding } from "@/features/review/types";

interface ReviewPanelProps {
  reviewText: string;
  findings: Finding[];
  maskedPreview: string;
  onApproveAndSend: () => void;
  onReject: () => void;
  sending: boolean;
}

export function ReviewPanel({
  reviewText,
  findings,
  maskedPreview,
  onApproveAndSend,
  onReject,
  sending,
}: ReviewPanelProps) {
  const orderedFindings = [...findings].sort((a, b) => a.start - b.start);

  function renderHighlightedText() {
    if (orderedFindings.length === 0) {
      return <span>{reviewText}</span>;
    }

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    for (const f of orderedFindings) {
      if (f.start < cursor || f.start >= f.end || f.end > reviewText.length) continue;
      if (f.start > cursor) {
        elements.push(<span key={`t_${cursor}`}>{reviewText.slice(cursor, f.start)}</span>);
      }
      const badgeStyle = ENTITY_COLORS[f.type] ?? ENTITY_COLORS.CUSTOM;
      elements.push(
        <mark
          key={f.id}
          className={`rounded-sm border px-1 font-medium ${badgeStyle}`}
          title={`${f.type} · source: ${f.source} · ${f.placeholder}`}
        >
          {reviewText.slice(f.start, f.end)}
        </mark>,
      );
      cursor = f.end;
    }

    if (cursor < reviewText.length) {
      elements.push(<span key="t_end">{reviewText.slice(cursor)}</span>);
    }

    return elements;
  }

  const typeCounts = orderedFindings.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="gap-4 border-warning/35 bg-card py-4 sm:py-5">
      <CardHeader className="gap-2 px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-control border border-warning/30 bg-warning/10 text-warning"
              aria-hidden="true"
            >
              <ShieldAlert className="size-4" />
            </span>
            <CardTitle className="text-sm font-semibold text-foreground sm:text-base">
              Review before sending
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-warning/35 bg-warning/10 text-warning"
          >
            {orderedFindings.length} {orderedFindings.length === 1 ? "finding" : "findings"} · Awaiting approval
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground sm:text-sm">
          Verify the detected values and the exact masked payload that will be sent to the AI provider.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-5">
        {Object.keys(typeCounts).length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-1">
                <EntityBadge entityType={type} />
                {count > 1 ? (
                  <span className="font-mono text-[11px] text-muted-foreground">×{count}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid min-w-0 divide-y divide-border rounded-control border border-border bg-background/70 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="min-w-0 p-3.5">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Original text (stays local)
            </h3>
            <div
              tabIndex={0}
              role="region"
              aria-label="Original text"
              className="max-h-56 overflow-y-auto overscroll-contain whitespace-pre-wrap text-sm leading-relaxed text-foreground wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring"
            >
              {renderHighlightedText()}
            </div>
          </div>

          <div className="min-w-0 p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-highlight">
              <span>Exact text sent to provider</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </h3>
            <div
              tabIndex={0}
              role="region"
              aria-label="Text sent on approval"
              className="max-h-56 overflow-y-auto overscroll-contain whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90 wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring"
            >
              <MaskedText text={maskedPreview} />
            </div>
          </div>
        </div>

        <details className="rounded-control border border-border bg-muted/40 px-3 py-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
            Inspect all {orderedFindings.length} replacement{orderedFindings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2.5 divide-y divide-border">
            {orderedFindings.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs wrap-anywhere"
              >
                <EntityBadge entityType={f.type} />
                <span className="font-medium text-foreground">{f.text}</span>
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                <code className="font-mono text-token">{f.placeholder}</code>
                <span className="ml-auto text-[11px] text-muted-foreground">{f.source}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={onReject}
            className="cursor-pointer"
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="highlight"
            disabled={sending}
            onClick={onApproveAndSend}
            className="cursor-pointer font-semibold"
          >
            {sending ? "Sending…" : "Approve & send masked"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
