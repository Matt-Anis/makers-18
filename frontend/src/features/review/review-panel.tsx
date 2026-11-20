"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          className={`rounded border px-1.5 py-0.5 font-medium ${badgeStyle}`}
          title={`${f.type} • source: ${f.source} • ${f.placeholder}`}
        >
          {reviewText.slice(f.start, f.end)}
          <span
            data-badge="true"
            className="ml-1.5 select-none text-[10px] uppercase opacity-80"
          >
            [{f.type} · {f.source}]
          </span>
        </mark>,
      );
      cursor = f.end;
    }

    if (cursor < reviewText.length) {
      elements.push(<span key="t_end">{reviewText.slice(cursor)}</span>);
    }

    return elements;
  }

  return (
    <Card className="nyxora-surface rounded-3xl border border-amber-400/35 ring-0">
      <CardHeader className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-amber-400/40 bg-amber-500/15 px-3 py-0.5 text-xs font-medium text-amber-200"
          >
            Needs human approval
          </Badge>
        </div>
        <CardTitle className="sr-only">Review detected sensitive findings</CardTitle>
        <CardDescription className="text-xs text-white/60">
          Review detected entities and the exact masked payload below. Approve to dispatch only
          tokenized text, or reject to wipe this pending request without calling any provider.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white">
          {renderHighlightedText()}
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-white/65">
            Detected findings ({orderedFindings.length})
          </h3>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {orderedFindings.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-white">{f.text}</span>
                  <span className="ml-2 font-mono text-[11px] text-[#b8a5ff]">
                    → {f.placeholder}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-full border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase text-white/75"
                >
                  {f.type} · {f.source}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-2xl border border-white/10 bg-black/40 p-4">
          <span className="text-xs font-medium text-[#b8a5ff]">
            Masked preview (outgoing payload)
          </span>
          <p className="break-words font-mono text-xs leading-relaxed text-white/80">
            {maskedPreview}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={onReject}
            className="h-10 cursor-pointer border-red-400/35 bg-red-500/10 px-5 text-sm font-medium text-red-200 hover:bg-red-500/20 hover:text-red-100"
          >
            Reject (deny)
          </Button>
          <Button
            type="button"
            disabled={sending}
            onClick={onApproveAndSend}
            className="h-10 cursor-pointer bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-white/90"
          >
            {sending ? "Sending masked payload..." : "Approve & send masked"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
