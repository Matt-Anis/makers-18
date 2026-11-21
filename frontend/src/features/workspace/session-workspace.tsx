"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertCircle, Info, ScanLine, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { Button } from "@/components/ui/button";
import { ContractInputCard } from "@/features/review/contract-input-card";
import { ConversationThread } from "@/features/review/conversation-thread";
import { PrivacyInspectorPanel } from "@/features/review/privacy-inspector-panel";
import { ReviewPanel } from "@/features/review/review-panel";
import { modelOptionKey, SessionControlBar } from "@/features/review/session-control-bar";
import {
  ChatMessage,
  ENTITY_TYPES,
  EntityType,
  Finding,
  FindingSource,
  SAMPLE_CONTRACT,
} from "@/features/review/types";
import { SessionHeader } from "@/features/workspace/session-header";
import { SessionSidebar } from "@/features/workspace/session-sidebar";
import {
  ApiError,
  apiFetch,
  apiUpload,
  DiscoveredModel,
  ExtractedDocument,
  FindingOut,
  GatewaySession,
  GatewaySessionDetail,
  MaskedMessage,
  ModelDiscoveryResponse,
  ReviewRejectResponse,
  SendMessageResponse,
  SessionInspector,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type StatusNotice = {
  tone: "info" | "warning" | "error";
  text: string;
};

const FALLBACK_MODEL: DiscoveredModel = {
  provider: "mock",
  provider_label: "Local Mock Provider",
  model_id: "nyxora-mock-v1",
  display_name: "NYXORA Mock Model",
  supports_thinking: true,
  thinking_efforts: ["low", "medium", "high"],
};

function toChatMessage(msg: MaskedMessage, modelLabel?: string): ChatMessage {
  return {
    id: msg.id,
    role: msg.role === "assistant" ? "assistant" : "user",
    unmaskedText: msg.unmasked_content,
    maskedText: msg.masked_content,
    modelLabel: msg.role === "assistant" ? modelLabel : undefined,
  };
}

function toFinding(item: FindingOut): Finding {
  const normalizedType = ENTITY_TYPES.includes(item.type as EntityType)
    ? (item.type as EntityType)
    : "CUSTOM";
  return {
    id: item.id,
    type: normalizedType,
    text: item.text,
    start: item.start,
    end: item.end,
    source: item.source as FindingSource,
    confidence: item.confidence,
    placeholder: item.placeholder,
  };
}

export function SessionWorkspace() {
  const { user } = useAuth();

  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [hasEnabledModels, setHasEnabledModels] = useState(true);
  const [selectedModelKey, setSelectedModelKey] = useState<string>("");
  const [thinkingEffort, setThinkingEffort] = useState<"low" | "medium" | "high">("medium");
  const [allowAutoReview, setAllowAutoReview] = useState(true);
  const [reviewMode, setReviewMode] = useState<"manual" | "auto">("manual");

  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [draftSessionTitle, setDraftSessionTitle] = useState("");
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);

  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSummary, setFileSummary] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [step, setStep] = useState<
    "idle" | "detecting" | "clean" | "needs_review" | "sending"
  >("idle");
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [maskedPreview, setMaskedPreview] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMasked, setShowMasked] = useState(false);
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [isDesktopXl, setIsDesktopXl] = useState(true);
  const [inspectorResult, setInspectorResult] = useState<{
    sessionId: string;
    data: SessionInspector | null;
  } | null>(null);
  const [inspectorRevision, setInspectorRevision] = useState(0);
  const skipNextLoadRef = useRef<string | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsDesktopXl(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const historyLoading = Boolean(activeSessionId && loadedSessionId !== activeSessionId);
  const sessionBusy = busy || uploadingFile || step === "detecting" || step === "sending";
  const inspector = inspectorResult?.sessionId === activeSessionId ? inspectorResult : null;

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const selectedModel = useMemo(
    () => models.find((m) => modelOptionKey(m) === selectedModelKey) ?? models[0] ?? FALLBACK_MODEL,
    [models, selectedModelKey],
  );

  const refreshSessions = useCallback(async () => {
    if (!user) return;
    const owned = await apiFetch<GatewaySession[]>("/sessions");
    setSessions(owned);
    setActiveSessionId((prev) =>
      prev && owned.some((item) => item.id === prev) ? prev : (owned[0]?.id ?? null),
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      apiFetch<GatewaySession[]>("/sessions"),
      apiFetch<ModelDiscoveryResponse>("/providers/models"),
    ])
      .then(([owned, discovery]) => {
        if (!active) return;
        setSessions(owned);
        setActiveSessionId(owned[0]?.id ?? null);
        setModelsLoaded(true);

        if (discovery.models.length > 0) {
          setModels(discovery.models);
          setHasEnabledModels(true);
          const defaultKey =
            discovery.default_provider && discovery.default_model
              ? `${discovery.default_provider}::${discovery.default_model}`
              : modelOptionKey(discovery.models[0]);
          const exists = discovery.models.some((m) => modelOptionKey(m) === defaultKey);
          setSelectedModelKey(exists ? defaultKey : modelOptionKey(discovery.models[0]));
        } else {
          setModels([]);
          setHasEnabledModels(false);
          setSelectedModelKey("");
          setStatusNotice({
            tone: "warning",
            text:
              user.role === "owner"
                ? "No AI models are enabled yet. Open Owner Settings (/rules) to configure a provider."
                : "No AI models are currently enabled for this workspace. Ask your Owner to enable one.",
          });
        }
        setAllowAutoReview(discovery.allow_auto_review);
        setReviewMode(discovery.default_review_mode);
        setThinkingEffort(discovery.default_thinking_effort);
      })
      .catch(() => {
        if (active) {
          setModelsLoaded(true);
          setStatusNotice({ tone: "error", text: "Could not load sessions or models." });
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !activeSessionId) {
      return;
    }
    if (skipNextLoadRef.current === activeSessionId) {
      skipNextLoadRef.current = null;
      return;
    }
    let active = true;
    apiFetch<GatewaySessionDetail>(`/sessions/${activeSessionId}`)
      .then((detail) => {
        if (!active) return;
        setLoadedSessionId(activeSessionId);
        setMessages(detail.masked_messages.map((item) => toChatMessage(item)));
        if (detail.pending_review) {
          setPendingReviewId(detail.pending_review.review_id);
          setReviewText(detail.pending_review.raw_text);
          setMaskedPreview(detail.pending_review.masked_preview);
          setFindings(detail.pending_review.findings.map(toFinding));
          setStep("needs_review");
        } else {
          setPendingReviewId(null);
          setReviewText("");
          setMaskedPreview("");
          setFindings([]);
          setStep("idle");
        }
        if (!detail.vault_active) {
          setStatusNotice({
            tone: "warning",
            text: "This session's vault has expired or been wiped; historical messages cannot be unmasked.",
          });
        }
      })
      .catch(() => {
        if (active) {
          setLoadedSessionId(activeSessionId);
          setStatusNotice({ tone: "error", text: "Could not load session history." });
        }
      });
    return () => {
      active = false;
    };
  }, [user, activeSessionId]);

  useEffect(() => {
    if (!user || !inspectorEnabled || !activeSessionId) {
      return;
    }
    let active = true;
    apiFetch<SessionInspector>(`/sessions/${activeSessionId}/inspector`)
      .then((snapshot) => {
        if (active) setInspectorResult({ sessionId: activeSessionId, data: snapshot });
      })
      .catch(() => {
        if (active) setInspectorResult({ sessionId: activeSessionId, data: null });
      });
    return () => {
      active = false;
    };
  }, [user, inspectorEnabled, activeSessionId, inspectorRevision, messages.length]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (reviewRef.current) {
      reviewRef.current.scrollIntoView({ block: "start" });
    } else if (conversation) {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [activeSessionId, historyLoading, messages.length, pendingReviewId]);

  const clearPendingReview = useCallback(() => {
    setPendingReviewId(null);
    setReviewText("");
    setMaskedPreview("");
    setFindings([]);
  }, []);

  const ensureActiveSession = useCallback(async (): Promise<GatewaySession | null> => {
    if (activeSession) return activeSession;
    try {
      const created = await apiFetch<GatewaySession>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: draftSessionTitle.trim() || fileName || "Contract review",
          provider: selectedModel.provider,
        }),
      });
      skipNextLoadRef.current = created.id;
      setDraftSessionTitle("");
      await refreshSessions();
      setLoadedSessionId(created.id);
      setActiveSessionId(created.id);
      return created;
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not start session.",
      });
      return null;
    }
  }, [activeSession, draftSessionTitle, fileName, selectedModel.provider, refreshSessions]);

  async function handleRenameSession(sessionId: string, title: string) {
    setStatusNotice(null);
    try {
      const updated = await apiFetch<GatewaySession>(`/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not rename session.",
      });
    }
  }

  async function handleNewSession() {
    setSessionDrawerOpen(false);
    setBusy(true);
    setStatusNotice(null);
    try {
      const created = await apiFetch<GatewaySession>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: `Review ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          provider: selectedModel.provider,
        }),
      });
      await refreshSessions();
      setInspectorResult(null);
      setActiveSessionId(created.id);
      setMessages([]);
      clearPendingReview();
      setStep("idle");
      setStatusNotice({
        tone: "info",
        text: `Started "${created.title}" with an isolated encrypted vault.`,
      });
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not create session.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    setBusy(true);
    setStatusNotice(null);
    try {
      await apiFetch<{ status: string }>(`/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (sessionId === activeSessionId) {
        setMessages([]);
        setInspectorResult(null);
        clearPendingReview();
        setInputText("");
        setFileName(null);
        setFileSummary(null);
        setStep("idle");
      }
      setStatusNotice({
        tone: "info",
        text: "Session deleted and its encrypted vault was wiped from storage.",
      });
      await refreshSessions();
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Could not delete session.",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleSelectSession(id: string) {
    setSessionDrawerOpen(false);
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    setLoadedSessionId(null);
    setMessages([]);
    setInspectorResult(null);
    clearPendingReview();
    setStatusNotice(null);
    setStep("idle");
  }

  async function handleScan() {
    if (!inputText.trim()) return;
    setStatusNotice(null);
    clearPendingReview();
    setStep("detecting");

    const session = await ensureActiveSession();
    if (!session) {
      setStep("idle");
      return;
    }

    const prompt = inputText;
    try {
      const response = await apiFetch<SendMessageResponse>(`/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: prompt,
          provider: selectedModel.provider,
          model: selectedModel.model_id,
          thinking_effort: thinkingEffort,
          mode: allowAutoReview ? reviewMode : "manual",
        }),
      });

      if (response.status === "needs_review") {
        setPendingReviewId(response.review_id);
        setReviewText(prompt);
        setMaskedPreview(response.masked_preview ?? "");
        setFindings(response.findings.map(toFinding));
        setStep("needs_review");
        return;
      }

      const appended: ChatMessage[] = [];
      if (response.user_message) appended.push(toChatMessage(response.user_message));
      if (response.assistant_message) {
        appended.push(toChatMessage(response.assistant_message, selectedModel.display_name));
      }
      setMessages((prev) => [...prev, ...appended]);
      setInputText("");
      setFileName(null);
      setFileSummary(null);
      setStep(response.findings.length === 0 ? "clean" : "idle");
      await refreshSessions();
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to process message.",
      });
      setStep("idle");
    }
  }

  async function handleApproveAndSend() {
    if (!activeSession || !pendingReviewId) return;
    setStatusNotice(null);
    setStep("sending");
    try {
      const response = await apiFetch<SendMessageResponse>(
        `/sessions/${activeSession.id}/reviews/${pendingReviewId}/approve`,
        { method: "POST" },
      );
      const appended: ChatMessage[] = [];
      if (response.user_message) appended.push(toChatMessage(response.user_message));
      if (response.assistant_message) {
        appended.push(toChatMessage(response.assistant_message, selectedModel.display_name));
      }
      setMessages((prev) => [...prev, ...appended]);
      clearPendingReview();
      setInputText("");
      setFileName(null);
      setFileSummary(null);
      setStep("idle");
      await refreshSessions();
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to dispatch approved message.",
      });
      setStep("needs_review");
    }
  }

  async function handleReject() {
    if (!activeSession || !pendingReviewId) return;
    setStatusNotice(null);
    setStep("sending");
    try {
      await apiFetch<ReviewRejectResponse>(
        `/sessions/${activeSession.id}/reviews/${pendingReviewId}/reject`,
        { method: "POST" },
      );
      clearPendingReview();
      setStep("idle");
      setStatusNotice({
        tone: "info",
        text: "Request rejected and pending payload wiped. No data was sent to the provider.",
      });
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to reject pending review.",
      });
      setStep("needs_review");
    }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    setStatusNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const extracted = await apiUpload<ExtractedDocument>("/ingestion/extract", formData);
      setInputText(extracted.text);
      setFileName(extracted.filename);

      const details: string[] = [];
      if (extracted.page_count) {
        details.push(`${extracted.page_count} page${extracted.page_count === 1 ? "" : "s"}`);
      }
      if (extracted.stripped_metadata_fields.length > 0) {
        details.push(`${extracted.stripped_metadata_fields.length} metadata fields stripped`);
      }
      if (extracted.stripped_comments_count > 0) {
        details.push(`${extracted.stripped_comments_count} comment(s) stripped`);
      }
      if (extracted.stripped_revisions_count > 0) {
        details.push(`${extracted.stripped_revisions_count} deleted revision(s) stripped`);
      }
      if (details.length === 0) {
        details.push("clean text extracted");
      }
      setFileSummary(details.join(", "));
      if (extracted.truncated) {
        setStatusNotice({
          tone: "warning",
          text: `Extracted "${extracted.filename}" (truncated to 50,000 characters to fit the review limit).`,
        });
      }
    } catch (error) {
      setStatusNotice({
        tone: "error",
        text:
          error instanceof ApiError ? error.message : "Could not extract text from uploaded file.",
      });
    } finally {
      setUploadingFile(false);
    }
  }

  const emptyConversation = !historyLoading && messages.length === 0 && !pendingReviewId;

  const inspectorPanelNode = (
    <PrivacyInspectorPanel
      inspector={inspector?.data ?? null}
      loading={Boolean(activeSessionId && !inspector)}
      hasActiveSession={Boolean(activeSessionId)}
      providerLabel={selectedModel.display_name}
      onRefresh={() => {
        setInspectorResult(null);
        setInspectorRevision((revision) => revision + 1);
      }}
      onClose={() => setInspectorEnabled(false)}
    />
  );

  return (
    <DashboardShell workspace>
      <Dialog.Root open={sessionDrawerOpen} onOpenChange={setSessionDrawerOpen}>
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          busy={sessionBusy}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
        />

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SessionHeader
              session={activeSession}
              draftTitle={draftSessionTitle}
              hasMessages={Boolean(activeSessionId && messages.length > 0)}
              busy={sessionBusy || historyLoading}
              sidebarCollapsed={sidebarCollapsed}
              onExpandSidebar={() => setSidebarCollapsed(false)}
              inspectorOpen={inspectorEnabled}
              onToggleInspector={() => {
                setInspectorEnabled((open) => !open);
                setInspectorResult(null);
              }}
              showMasked={showMasked}
              onToggleMasked={() => setShowMasked((visible) => !visible)}
              onRename={async (nextTitle) => {
                if (activeSession) {
                  await handleRenameSession(activeSession.id, nextTitle);
                } else {
                  setDraftSessionTitle(nextTitle);
                }
              }}
              onEndSession={() => {
                if (activeSession) {
                  void handleDeleteSession(activeSession.id);
                }
              }}
            />

            {statusNotice ? (
              <div role="status" className="shrink-0 px-4 pt-3 sm:px-6">
                <div
                  className={cn(
                    "mx-auto flex w-full max-w-3xl items-start gap-2.5 rounded-control border px-3 py-2 text-xs",
                    statusNotice.tone === "error" &&
                      "border-destructive/35 bg-destructive/10 text-destructive-foreground",
                    statusNotice.tone === "warning" &&
                      "border-warning/35 bg-warning/10 text-warning",
                    statusNotice.tone === "info" &&
                      "border-border bg-card text-foreground",
                  )}
                >
                  {statusNotice.tone === "error" ? (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  ) : statusNotice.tone === "warning" ? (
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Info className="mt-0.5 size-3.5 shrink-0 text-highlight" aria-hidden="true" />
                  )}
                  <p className="min-w-0 flex-1 leading-relaxed wrap-anywhere">{statusNotice.text}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Dismiss notification"
                    onClick={() => setStatusNotice(null)}
                    className="-my-1 -mr-1 shrink-0 cursor-pointer text-current opacity-70 hover:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}

            <section
              aria-label="Chat workspace"
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                emptyConversation && "justify-center overflow-y-auto",
              )}
            >
              <div
                ref={conversationRef}
                className={
                  emptyConversation
                    ? "shrink-0"
                    : "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
                }
              >
                {historyLoading ? (
                  <p role="status" className="p-6 text-center text-sm text-muted-foreground">
                    Loading conversation…
                  </p>
                ) : (
                  <div
                    className={cn(
                      "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 sm:px-6",
                      emptyConversation ? "pt-6 pb-6" : "min-h-full py-6 sm:py-8",
                    )}
                  >
                    {emptyConversation ? (
                      <div className="flex flex-col items-center text-center">
                        <div
                          className="mb-4 grid size-12 place-items-center rounded-surface border border-highlight/25 bg-accent text-highlight"
                          aria-hidden="true"
                        >
                          <ScanLine className="size-5" strokeWidth={1.75} />
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                          What are we reviewing?
                        </h2>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                          Attach a contract or paste sensitive text. NYXORA masks confidential details before anything reaches an external AI.
                        </p>
                      </div>
                    ) : null}

                    <ConversationThread
                      messages={activeSessionId ? messages : []}
                      showMasked={showMasked}
                      onShowRestored={() => setShowMasked(false)}
                      providerLabel={selectedModel.display_name}
                    />

                    {pendingReviewId ? (
                      <div ref={reviewRef} className="scroll-mt-4">
                        <ReviewPanel
                          reviewText={reviewText}
                          findings={findings}
                          maskedPreview={maskedPreview}
                          onApproveAndSend={handleApproveAndSend}
                          onReject={handleReject}
                          sending={sessionBusy}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <footer
                className={cn(
                  "shrink-0 bg-background px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5",
                  pendingReviewId && "hidden",
                )}
              >
                <div className="mx-auto w-full max-w-3xl">
                  <ContractInputCard
                    inputText={inputText}
                    onInputChange={setInputText}
                    onLoadSample={() => {
                      setInputText(SAMPLE_CONTRACT);
                      setFileName(null);
                      setFileSummary(null);
                    }}
                    fileName={fileName}
                    fileSummary={fileSummary}
                    onClearFile={() => {
                      setFileName(null);
                      setFileSummary(null);
                      setInputText("");
                    }}
                    uploading={uploadingFile}
                    busy={busy || historyLoading}
                    canScan={hasEnabledModels && modelsLoaded}
                    onFileAttach={handleFileUpload}
                    step={step}
                    onScan={handleScan}
                    showQuickActions={emptyConversation}
                    settings={
                      <SessionControlBar
                        models={models}
                        modelsLoaded={modelsLoaded}
                        selectedModelKey={selectedModelKey}
                        onSelectModelKey={setSelectedModelKey}
                        thinkingEffort={thinkingEffort}
                        onThinkingEffortChange={setThinkingEffort}
                        reviewMode={reviewMode}
                        allowAutoReview={allowAutoReview}
                        onReviewModeChange={setReviewMode}
                        busy={sessionBusy || historyLoading}
                      />
                    }
                  />
                </div>
              </footer>
            </section>
          </div>

          {inspectorEnabled && isDesktopXl ? (
            <aside
              id="privacy-inspector"
              aria-label="Privacy Inspector"
              className="hidden min-h-0 w-96 shrink-0 border-l border-border bg-sidebar xl:flex xl:flex-col"
            >
              {inspectorPanelNode}
            </aside>
          ) : null}
        </div>
      </Dialog.Root>

      <Dialog.Root
        open={inspectorEnabled && !isDesktopXl}
        onOpenChange={(open) => {
          if (!open) setInspectorEnabled(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md xl:hidden" />
          <Dialog.Popup
            id="privacy-inspector"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(25rem,92vw)] flex-col border-l border-border bg-sidebar shadow-2xl outline-none xl:hidden"
          >
            <Dialog.Title className="sr-only">Privacy Inspector</Dialog.Title>
            {inspectorPanelNode}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </DashboardShell>
  );
}
