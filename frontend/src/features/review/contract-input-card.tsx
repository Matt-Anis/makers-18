"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_CONTRACT } from "@/features/review/types";

interface ContractInputCardProps {
  inputText: string;
  onInputChange: (value: string) => void;
  fileName: string | null;
  onFileAttach: (name: string) => void;
  step: "idle" | "detecting" | "clean" | "needs_review" | "sending";
  onScan: () => void;
}

export function ContractInputCard({
  inputText,
  onInputChange,
  fileName,
  onFileAttach,
  step,
  onScan,
}: ContractInputCardProps) {
  const isWorking = step === "detecting" || step === "sending";

  return (
    <Card className="nyxora-surface rounded-xl border ring-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold text-white">
          Contract input &amp; local detection
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onInputChange(SAMPLE_CONTRACT)}
          className="h-7 cursor-pointer text-xs text-[#a78bfa] hover:text-white"
        >
          Load sample contract
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contract-input" className="sr-only">
            Contract text or follow-up question
          </Label>
          <Textarea
            id="contract-input"
            rows={4}
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Paste contract text or ask a follow-up question..."
            className="rounded-lg border-white/12 bg-white/[0.03] p-3.5 text-sm text-white placeholder:text-white/35 transition-[border-color,background-color] duration-150 hover:border-white/20 focus-visible:border-[#8b6eff] focus-visible:ring-2 focus-visible:ring-[#8b6eff]/25"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="contract-file-upload"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 text-xs font-medium text-white/85 transition-[background-color,border-color] duration-150 ease-out hover:border-white/20 hover:bg-white/[0.08] focus-within:ring-2 focus-within:ring-[#8b6eff]/40"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              <span>Attach PDF / DOCX</span>
              <input
                id="contract-file-upload"
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onFileAttach(file.name);
                  }
                }}
              />
            </label>

            {fileName ? (
              <span className="text-xs text-[#a78bfa]">
                Attached: {fileName} (metadata stripped)
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={!inputText.trim() || isWorking}
            onClick={onScan}
            className="h-9 cursor-pointer bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-white/90"
          >
            {step === "detecting"
              ? "Detecting locally..."
              : step === "sending"
                ? "Sending masked..."
                : "Scan & continue"}
          </Button>
        </div>

        {step === "clean" ? (
          <p role="status" aria-live="polite" className="text-xs font-medium text-emerald-300">
            Verdict: No sensitive data detected. Sent directly to provider.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
