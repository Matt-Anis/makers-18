"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { ContractInputCard } from "@/features/review/contract-input-card";
import { ConversationThread } from "@/features/review/conversation-thread";
import { ReviewPanel } from "@/features/review/review-panel";
import { modelOptionKey, SessionControlBar } from "@/features/review/session-control-bar";
import {
  ChatMessage,
  ENTITY_TYPES,
  EntityType,
  Finding,
  FindingSource,
} from "@/features/review/types";
import {
  ApiError,
  apiFetch,
  DiscoveredModel,
  FindingOut,
  GatewaySession,
  GatewaySessionDetail,
  MaskedMessage,
  ModelDiscoveryResponse,
  ReviewRejectResponse,
  SendMessageResponse,
} from "@/lib/api";

const FALLBACK_MODEL: DiscoveredModel = {
  provider: "mock",
  provider_label: "Local Mock Provider",
  model_id: "nyxora-mock-v1",
  display_name: "NYXORA Mock Model",
  supports_thinking: true,
  thinking_efforts: ["low", "medium", "high"],
};

function toChatMessage(msg: MaskedMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role === "assistant" ? "assistant" : "user",
    unmaskedText: msg.unmasked_content,
    maskedText: msg.masked_content,
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

  const [models, setModels] = useState<DiscoveredModel[]>([FALLBACK_MODEL]);
  const [selectedModelKey, setSelectedModelKey] = useState<string>(
    modelOptionKey(FALLBACK_MODEL),
  );
  const [thinkingEffort, setThinkingEffort] = useState<"low" | "medium" | "high">("medium");
  const [allowAutoReview, setAllowAutoReview] = useState(true);
  const [reviewMode, setReviewMode] = useState<"manual" | "auto">("manual");

  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<
    "idle" | "detecting" | "clean" | "needs_review" | "sending"
  >("idle");
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [maskedPreview, setMaskedPreview] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMasked, setShowMasked] = useState(false);
  const skipNextLoadRef = useRef<string | null>(null);

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

        if (discovery.models.length > 0) {
          setModels(discovery.models);
          const defaultKey =
            discovery.default_provider && discovery.default_model
              ? `${discovery.default_provider}::${discovery.default_model}`
              : modelOptionKey(discovery.models[0]);
          const exists = discovery.models.some((m) => modelOptionKey(m) === defaultKey);
          setSelectedModelKey(exists ? defaultKey : modelOptionKey(discovery.models[0]));
        }
        setAllowAutoReview(discovery.allow_auto_review);
        setReviewMode(discovery.default_review_mode);
        setThinkingEffort(discovery.default_thinking_effort);
      })
      .catch(() => {
        if (active) setStatusMessage("Could not load sessions or models.");
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
        setMessages(detail.masked_messages.map(toChatMessage));
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
          setStatusMessage(
            "This session's vault has expired or been wiped; historical messages cannot be unmasked.",
          );
        }
      })
      .catch(() => {
        if (active) setStatusMessage("Could not load session history.");
      });
    return () => {
      active = false;
    };
  }, [user, activeSessionId]);

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
          title: fileName ?? "Contract review",
          provider: selectedModel.provider,
        }),
      });
      skipNextLoadRef.current = created.id;
      await refreshSessions();
      setActiveSessionId(created.id);
      return created;
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not start session.");
      return null;
    }
  }, [activeSession, fileName, selectedModel.provider, refreshSessions]);

  async function handleNewSession() {
    setBusy(true);
    setStatusMessage(null);
    try {
      const created = await apiFetch<GatewaySession>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: `Review ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          provider: selectedModel.provider,
        }),
      });
      await refreshSessions();
      setActiveSessionId(created.id);
      setMessages([]);
      clearPendingReview();
      setStep("idle");
      setStatusMessage(`Started session "${created.title}" with an isolated encrypted vault.`);
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndSession() {
    if (!activeSession) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      await apiFetch<{ status: string }>(`/sessions/${activeSession.id}`, {
        method: "DELETE",
      });
      setMessages([]);
      clearPendingReview();
      setInputText("");
      setFileName(null);
      setStep("idle");
      setStatusMessage("Session ended and its encrypted vault was wiped from storage.");
      await refreshSessions();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not end session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleScan() {
    if (!inputText.trim()) return;
    setStatusMessage(null);
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
      if (response.assistant_message) appended.push(toChatMessage(response.assistant_message));
      setMessages((prev) => [...prev, ...appended]);
      setInputText("");
      setFileName(null);
      setStep(response.findings.length === 0 ? "clean" : "idle");
      await refreshSessions();
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Failed to process message.",
      );
      setStep("idle");
    }
  }

  async function handleApproveAndSend() {
    if (!activeSession || !pendingReviewId) return;
    setStatusMessage(null);
    setStep("sending");
    try {
      const response = await apiFetch<SendMessageResponse>(
        `/sessions/${activeSession.id}/reviews/${pendingReviewId}/approve`,
        { method: "POST" },
      );
      const appended: ChatMessage[] = [];
      if (response.user_message) appended.push(toChatMessage(response.user_message));
      if (response.assistant_message) appended.push(toChatMessage(response.assistant_message));
      setMessages((prev) => [...prev, ...appended]);
      clearPendingReview();
      setInputText("");
      setFileName(null);
      setStep("idle");
      await refreshSessions();
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Failed to dispatch approved message.",
      );
      setStep("needs_review");
    }
  }

  async function handleReject() {
    if (!activeSession || !pendingReviewId) return;
    setStatusMessage(null);
    setStep("sending");
    try {
      await apiFetch<ReviewRejectResponse>(
        `/sessions/${activeSession.id}/reviews/${pendingReviewId}/reject`,
        { method: "POST" },
      );
      clearPendingReview();
      setStep("idle");
      setStatusMessage(
        "Request rejected and pending payload wiped. No data was sent to the provider.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : "Failed to reject pending review.",
      );
      setStep("needs_review");
    }
  }

  return (
    <DashboardShell>
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

      <SessionControlBar
        models={models}
        selectedModelKey={selectedModelKey}
        onSelectModelKey={setSelectedModelKey}
        thinkingEffort={thinkingEffort}
        onThinkingEffortChange={setThinkingEffort}
        reviewMode={reviewMode}
        allowAutoReview={allowAutoReview}
        onReviewModeChange={setReviewMode}
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          clearPendingReview();
          setStatusMessage(null);
          setStep("idle");
        }}
        onNewSession={handleNewSession}
        onEndSession={handleEndSession}
        showMasked={showMasked}
        onToggleShowMasked={() => setShowMasked((prev) => !prev)}
        busy={busy}
      />

      <ContractInputCard
        inputText={inputText}
        onInputChange={setInputText}
        fileName={fileName}
        onFileAttach={(name) => {
          setFileName(name);
        }}
        step={step}
        onScan={handleScan}
      />

      {(step === "needs_review" || step === "sending") && findings.length > 0 ? (
        <ReviewPanel
          reviewText={reviewText}
          findings={findings}
          maskedPreview={maskedPreview}
          onApproveAndSend={handleApproveAndSend}
          onReject={handleReject}
          sending={step === "sending"}
        />
      ) : null}

      <ConversationThread
        messages={activeSessionId ? messages : []}
        showMasked={showMasked}
        providerLabel={selectedModel.display_name}
      />
    </DashboardShell>
  );
}
