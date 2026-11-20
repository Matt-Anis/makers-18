"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/nyxora/dashboard-shell";
import { ContractInputCard } from "@/features/review/contract-input-card";
import { ConversationThread } from "@/features/review/conversation-thread";
import {
  buildMaskedText,
  recomputePlaceholders,
  runMockDetection,
  simulateMaskedProvider,
} from "@/features/review/mock-pipeline";
import { ReviewPanel } from "@/features/review/review-panel";
import { modelOptionKey, SessionControlBar } from "@/features/review/session-control-bar";
import {
  ChatMessage,
  EntityType,
  Finding,
  SAMPLE_CONTRACT,
} from "@/features/review/types";
import {
  ApiError,
  apiFetch,
  DiscoveredModel,
  GatewaySession,
  ModelDiscoveryResponse,
} from "@/lib/api";

const FALLBACK_MODEL: DiscoveredModel = {
  provider: "mock",
  provider_label: "Local Mock Provider",
  model_id: "nyxora-mock-v1",
  display_name: "NYXORA Mock Model",
  supports_thinking: true,
  thinking_efforts: ["low", "medium", "high"],
};

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
  const [reviewText, setReviewText] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMasked, setShowMasked] = useState(false);

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
      setFindings([]);
      setReviewText("");
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
      setFindings([]);
      setReviewText("");
      setInputText("");
      setFileName(null);
      setStep("idle");
      setStatusMessage("Session ended and its encrypted vault was wiped from memory.");
      await refreshSessions();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not end session.");
    } finally {
      setBusy(false);
    }
  }

  function dispatchToProvider(unmasked: string, masked: string) {
    setStep("sending");
    setTimeout(() => {
      const { assistantUnmasked, assistantMasked } = simulateMaskedProvider(
        selectedModel.display_name,
        unmasked,
        masked,
      );
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        unmaskedText: unmasked,
        maskedText: masked,
      };
      const botMsg: ChatMessage = {
        id: `a_${Date.now() + 1}`,
        role: "assistant",
        unmaskedText: assistantUnmasked,
        maskedText: assistantMasked,
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInputText("");
      setFileName(null);
      setReviewText("");
      setFindings([]);
      setStep("idle");
    }, 350);
  }

  async function handleScan() {
    if (!inputText.trim()) return;
    setStatusMessage(null);
    setStep("detecting");

    const session = await ensureActiveSession();
    if (!session) {
      setStep("idle");
      return;
    }

    const text = inputText;
    setReviewText(text);
    const detected = runMockDetection(text);

    if (detected.length === 0) {
      setFindings([]);
      setStep("clean");
      dispatchToProvider(text, text);
    } else if (reviewMode === "auto" && allowAutoReview) {
      const masked = buildMaskedText(text, detected);
      dispatchToProvider(text, masked);
    } else {
      setFindings(detected);
      setStep("needs_review");
    }
  }

  function handleToggleDismiss(findingId: string) {
    setFindings((prev) =>
      recomputePlaceholders(
        prev.map((f) =>
          f.id === findingId
            ? { ...f, status: f.status === "dismissed" ? "pending" : "dismissed" }
            : f,
        ),
      ),
    );
  }

  function handleChangeType(findingId: string, nextType: EntityType) {
    setFindings((prev) =>
      recomputePlaceholders(
        prev.map((f) => (f.id === findingId ? { ...f, type: nextType } : f)),
      ),
    );
  }

  function handleAddManual(text: string, start: number, end: number, type: EntityType) {
    const overlaps = findings.some(
      (f) => f.status !== "dismissed" && start < f.end && end > f.start,
    );
    if (overlaps) {
      setStatusMessage("Selection overlaps an existing active finding.");
      return;
    }
    const newFinding: Finding = {
      id: `manual_${Date.now()}`,
      type,
      text,
      start,
      end,
      source: "custom",
      confidence: 1.0,
      status: "approved",
      placeholder: `[${type}_1]`,
    };
    setFindings((prev) => recomputePlaceholders([...prev, newFinding]));
  }

  function handleApproveAndSend() {
    const masked = buildMaskedText(reviewText, findings);
    dispatchToProvider(reviewText, masked);
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
          setFindings([]);
          setReviewText("");
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
          if (!inputText) {
            setInputText(SAMPLE_CONTRACT);
          }
        }}
        step={step}
        onScan={handleScan}
      />

      {(step === "needs_review" || step === "sending") && findings.length > 0 ? (
        <ReviewPanel
          reviewText={reviewText}
          findings={findings}
          onToggleDismiss={handleToggleDismiss}
          onChangeType={handleChangeType}
          onAddManual={handleAddManual}
          onApproveAndSend={handleApproveAndSend}
          sending={step === "sending"}
        />
      ) : null}

      <ConversationThread
        messages={messages}
        showMasked={showMasked}
        providerLabel={selectedModel.display_name}
      />
    </DashboardShell>
  );
}
