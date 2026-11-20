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
  fileSummary?: string | null;
  uploading?: boolean;
  onFileAttach: (file: File) => void;
  step: "idle" | "detecting" | "clean" | "needs_review" | "sending";
  onScan: () => void;
}

export function ContractInputCard({
  inputText,
  onInputChange,
  fileName,
  fileSummary,
  uploading = false,
  onFileAttach,
  step,
  onScan,
}: ContractInputCardProps) {
  const isWorking = step === "detecting" || step === "sending" || uploading;

  return (
    <Card className="nyxora-surface rounded-3xl border ring-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold text-white">
          Contract input &amp; local detection
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onInputChange(SAMPLE_CONTRACT)}
          className="h-7 cursor-pointer text-xs text-[#b8a5ff] hover:text-white"
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
            className="rounded-2xl p-4"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="contract-file-upload"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 text-xs font-medium text-white/85 transition-[background-color,border-color] duration-200 ease-out hover:border-white/22 hover:bg-white/[0.09] focus-within:ring-2 focus-within:ring-[#9b82ff]/40"
            >
              <Upload className="size-3.5" aria-hidden="true" />
              <span>{uploading ? "Extracting & scrubbing..." : "Attach PDF / DOCX"}</span>
              <input
                id="contract-file-upload"
                type="file"
                accept=".pdf,.docx,.txt"
                disabled={isWorking}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onFileAttach(file);
                    e.target.value = "";
                  }
                }}
              />
            </label>

            {fileName ? (
              <span className="text-xs text-[#a78bfa]">
                Attached: {fileName}
                {fileSummary ? ` (${fileSummary})` : ""}
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={!inputText.trim() || isWorking}
            onClick={onScan}
            className="h-10 w-full cursor-pointer bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
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
