"use client";

import { useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { ArrowUp, FileText, LoaderCircle, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ContractInputCardProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onLoadSample: () => void;
  fileName: string | null;
  fileSummary?: string | null;
  onClearFile: () => void;
  uploading: boolean;
  busy: boolean;
  canScan: boolean;
  onFileAttach: (file: File) => void;
  step: "idle" | "detecting" | "clean" | "needs_review" | "sending";
  onScan: () => void;
  settings: ReactNode;
  showQuickActions?: boolean;
}

export function ContractInputCard({
  inputText,
  onInputChange,
  onLoadSample,
  fileName,
  fileSummary,
  onClearFile,
  uploading,
  busy,
  canScan,
  onFileAttach,
  step,
  onScan,
  settings,
  showQuickActions = false,
}: ContractInputCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const draft = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const processing = step === "detecting" || step === "sending" || uploading;
  const isWorking = busy || processing;
  const submitDisabled = !canScan || !inputText.trim() || isWorking;
  const sendLabel = uploading
    ? "Extracting document…"
    : step === "detecting"
      ? "Scanning for sensitive data…"
      : step === "sending"
        ? "Sending masked request…"
        : "Send message";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitDisabled) {
      onScan();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      if (!submitDisabled) {
        formRef.current?.requestSubmit();
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="min-w-0 rounded-surface border border-input bg-card shadow-lg/25 transition-colors focus-within:border-ring/80"
      >
        {fileName ? (
          <div className="mx-3 mt-3 flex w-fit max-w-[calc(100%-1.5rem)] items-start gap-2 rounded-control border border-border bg-secondary/70 px-2.5 py-2 text-xs">
            <FileText className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden="true" />
            <div className="min-w-0 wrap-anywhere">
              <p className="font-medium text-foreground">{fileName}</p>
              {fileSummary ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fileSummary}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={isWorking}
              aria-label={`Remove ${fileName}`}
              title="Remove attachment"
              onClick={onClearFile}
              className="ml-1 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <Label htmlFor="contract-input" className="sr-only">
          Contract text or follow-up question
        </Label>
        <textarea
          ref={draft}
          id="contract-input"
          name="contract_input"
          rows={1}
          value={inputText}
          readOnly={isWorking}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message NYXORA or paste contract text…"
          className="block h-auto max-h-[min(12rem,26dvh)] min-h-13 w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground sm:text-[0.9375rem] [field-sizing:content]"
        />

        <div className="flex min-w-0 items-center gap-1 px-2.5 pb-2.5">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={isWorking}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onFileAttach(file);
                event.target.value = "";
              }
            }}
          />

          <Menu.Root>
            <Menu.Trigger
              aria-label="Add attachment or sample"
              title="Attach document or load sample"
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isWorking}
                  className="shrink-0 cursor-pointer rounded-full text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Plus className="size-4" aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="top" align="start" sideOffset={8} className="z-50">
                <Menu.Popup className="min-w-48 rounded-surface border border-border bg-popover p-1 text-popover-foreground shadow-xl outline-none">
                  <Menu.Item
                    onClick={() => fileInput.current?.click()}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-xs outline-none data-[highlighted]:bg-sidebar-accent"
                  >
                    <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Attach PDF, DOCX, or TXT</span>
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => {
                      onLoadSample();
                      requestAnimationFrame(() => draft.current?.focus());
                    }}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-xs outline-none data-[highlighted]:bg-sidebar-accent"
                  >
                    <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Load sample contract</span>
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          {settings}

          <Button
            type="submit"
            variant="highlight"
            size="icon-sm"
            disabled={submitDisabled}
            aria-label={sendLabel}
            title={processing ? sendLabel : "Send (Enter) · New line (Shift+Enter)"}
            className="ml-auto shrink-0 cursor-pointer rounded-full disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
          >
            {processing ? (
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </form>

      {showQuickActions && !inputText.trim() && !fileName ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isWorking}
            onClick={() => fileInput.current?.click()}
            className="cursor-pointer rounded-full border-border bg-card/60 px-3.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="size-3.5 text-highlight" aria-hidden="true" />
            <span>Attach PDF / DOCX</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isWorking}
            onClick={() => {
              onLoadSample();
              requestAnimationFrame(() => draft.current?.focus());
            }}
            className="cursor-pointer rounded-full border-border bg-card/60 px-3.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3.5 text-highlight" aria-hidden="true" />
            <span>Try sample contract</span>
          </Button>
        </div>
      ) : null}

      <p role="status" className="text-center text-[11px] text-muted-foreground">
        {processing
          ? sendLabel
          : step === "clean"
            ? "No sensitive data detected. Sent to the selected provider."
            : "This model may make mistakes. NYXORA masks sensitive data locally in respect of Law 18-07."}
      </p>
    </div>
  );
}
