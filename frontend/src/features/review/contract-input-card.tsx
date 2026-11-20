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
    <Card className="nyxora-glass rounded-2xl border ring-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-[0.16em] text-white/90">
          Contract Input &amp; Local Detection
        </CardTitle>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => onInputChange(SAMPLE_CONTRACT)}
          className="h-auto cursor-pointer p-0 text-xs text-[#b896ff]"
        >
          Load Sample Contract
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
            className="rounded-xl border-white/15 bg-white/5 p-4 text-sm text-white placeholder:text-white/35 focus-visible:border-[#9b72eb] focus-visible:ring-[#9b72eb]/40"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="contract-file-upload"
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/85 transition-colors hover:bg-white/10 focus-within:ring-2 focus-within:ring-[#9b72eb]"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              <span>Upload PDF / DOCX</span>
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
              <span className="text-xs text-[#b896ff]">
                Attached: {fileName} (metadata stripped)
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={!inputText.trim() || isWorking}
            onClick={onScan}
            className="min-h-11 cursor-pointer rounded-full bg-white px-6 text-xs font-bold uppercase tracking-[0.16em] text-black hover:bg-[#6441A5] hover:text-white"
          >
            {step === "detecting"
              ? "Detecting Locally..."
              : step === "sending"
                ? "Sending Masked..."
                : "Scan & Continue"}
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
