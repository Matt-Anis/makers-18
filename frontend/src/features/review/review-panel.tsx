"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildMaskedText } from "@/features/review/mock-pipeline";
import {
  ENTITY_COLORS,
  ENTITY_TYPES,
  EntityType,
  Finding,
} from "@/features/review/types";

interface ReviewPanelProps {
  reviewText: string;
  findings: Finding[];
  onToggleDismiss: (findingId: string) => void;
  onChangeType: (findingId: string, nextType: EntityType) => void;
  onAddManual: (text: string, start: number, end: number, type: EntityType) => void;
  onApproveAndSend: () => void;
  sending: boolean;
}

function resolveContractOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest('[data-badge="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let offset = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === targetNode) {
      return offset + targetOffset;
    }
    offset += current.textContent?.length ?? 0;
  }
  return null;
}

export function ReviewPanel({
  reviewText,
  findings,
  onToggleDismiss,
  onChangeType,
  onAddManual,
  onApproveAndSend,
  sending,
}: ReviewPanelProps) {
  const reviewBoxRef = useRef<HTMLDivElement>(null);
  const [manualSelection, setManualSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [manualType, setManualType] = useState<EntityType>("PERSON");

  const activeFindings = findings
    .filter((f) => f.status !== "dismissed")
    .sort((a, b) => a.start - b.start);

  function handleTextSelect() {
    const selection = window.getSelection();
    const container = reviewBoxRef.current;
    if (!selection || selection.isCollapsed || !container || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }

    const rawStart = resolveContractOffset(container, range.startContainer, range.startOffset);
    const rawEnd = resolveContractOffset(container, range.endContainer, range.endOffset);
    if (rawStart !== null && rawEnd !== null && rawEnd > rawStart) {
      const slice = reviewText.slice(rawStart, rawEnd);
      const leadingTrim = slice.length - slice.trimStart().length;
      const trailingTrim = slice.length - slice.trimEnd().length;
      const start = rawStart + leadingTrim;
      const end = rawEnd - trailingTrim;
      if (end > start) {
        setManualSelection({ text: reviewText.slice(start, end), start, end });
        return;
      }
    }

    const selectedStr = selection.toString().trim();
    if (!selectedStr) return;
    const idx = reviewText.indexOf(selectedStr);
    if (idx !== -1) {
      setManualSelection({ text: selectedStr, start: idx, end: idx + selectedStr.length });
    }
  }

  function renderHighlightedText() {
    if (activeFindings.length === 0) {
      return <span>{reviewText}</span>;
    }

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    for (const f of activeFindings) {
      if (f.start < cursor) continue;
      if (f.start > cursor) {
        elements.push(<span key={`t_${cursor}`}>{reviewText.slice(cursor, f.start)}</span>);
      }
      elements.push(
        <mark
          key={f.id}
          className={`rounded border px-1.5 py-0.5 font-medium ${ENTITY_COLORS[f.type]}`}
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
    <Card className="rounded-2xl border border-amber-400/50 bg-black/70 backdrop-blur-xl ring-0 shadow-[0_0_40px_rgba(100,65,165,0.35)]">
      <CardHeader className="space-y-2">
        <div>
          <Badge
            variant="outline"
            className="border-amber-400/45 bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200"
          >
            Needs Human Review
          </Badge>
        </div>
        <CardTitle className="sr-only">Review detected sensitive findings</CardTitle>
        <CardDescription className="text-xs text-white/65">
          Verify detected entities below, or highlight any missed text with your cursor to add it
          manually.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          ref={reviewBoxRef}
          onMouseUp={handleTextSelect}
          className="select-text rounded-xl border border-white/15 bg-white/5 p-4 text-sm leading-relaxed text-white"
        >
          {renderHighlightedText()}
        </div>

        {manualSelection ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#b896ff]/40 bg-[#6441A5]/25 p-3">
            <span className="text-xs text-white">
              Add missed text: <strong>&quot;{manualSelection.text}&quot;</strong>
            </span>
            <Select
              value={manualType}
              onValueChange={(value) => {
                if (value) setManualType(value as EntityType);
              }}
            >
              <SelectTrigger className="h-8 min-w-28 rounded-lg border-white/20 bg-black/60 text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#6441A5]/50 bg-[#140d24] text-white">
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAddManual(
                  manualSelection.text,
                  manualSelection.start,
                  manualSelection.end,
                  manualType,
                );
                setManualSelection(null);
              }}
              className="cursor-pointer rounded-full bg-white px-3.5 text-xs font-bold uppercase text-black hover:bg-[#6441A5] hover:text-white"
            >
              + Mask Entity
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">
            Detected Findings ({activeFindings.length} active)
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {findings.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                  f.status === "dismissed"
                    ? "border-white/10 bg-white/5 opacity-45 line-through"
                    : "border-white/15 bg-white/5"
                }`}
              >
                <div className="min-w-0 truncate">
                  <span className="font-semibold text-white">{f.text}</span>
                  <span className="ml-2 text-[11px] text-[#b896ff]">→ {f.placeholder}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    value={f.type}
                    disabled={f.status === "dismissed"}
                    onValueChange={(value) => {
                      if (value) onChangeType(f.id, value as EntityType);
                    }}
                  >
                    <SelectTrigger className="h-7 min-w-24 rounded border-white/15 bg-black/60 px-2 text-[11px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#6441A5]/50 bg-[#140d24] text-white">
                      {ENTITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onToggleDismiss(f.id)}
                    className="cursor-pointer rounded bg-white/10 px-2 text-[11px] text-white hover:bg-red-500/30"
                  >
                    {f.status === "dismissed" ? "Restore" : "Dismiss"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/60 p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#b896ff]">
            Masked Preview (What leaves the company):
          </span>
          <p className="font-mono text-xs leading-relaxed text-white/85">
            {buildMaskedText(reviewText, findings)}
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={sending}
            onClick={onApproveAndSend}
            className="min-h-11 cursor-pointer rounded-full bg-white px-6 text-xs font-bold uppercase tracking-[0.16em] text-black shadow-[0_0_25px_rgba(155,114,235,0.7)] hover:bg-[#6441A5] hover:text-white"
          >
            {sending ? "Sending Masked Payload..." : "Approve & Send Masked Payload"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
