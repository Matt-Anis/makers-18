"use client";

import { useState, useRef } from "react";
import DashboardNav from "@/components/DashboardNav";

type EntityType =
  | "PERSON"
  | "COMPANY"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "ID"
  | "BANK"
  | "CUSTOM";

type FindingSource = "rule" | "ner" | "pii-model" | "llm" | "custom";

interface Finding {
  id: string;
  type: EntityType;
  text: string;
  start: number;
  end: number;
  source: FindingSource;
  confidence: number;
  status: "pending" | "approved" | "dismissed";
  placeholder: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  unmaskedText: string;
  maskedText: string;
}

const ENTITY_COLORS: Record<EntityType, string> = {
  PERSON: "bg-purple-500/30 border-purple-400 text-purple-200",
  COMPANY: "bg-blue-500/30 border-blue-400 text-blue-200",
  EMAIL: "bg-emerald-500/30 border-emerald-400 text-emerald-200",
  PHONE: "bg-amber-500/30 border-amber-400 text-amber-200",
  ADDRESS: "bg-pink-500/30 border-pink-400 text-pink-200",
  ID: "bg-red-500/30 border-red-400 text-red-200",
  BANK: "bg-cyan-500/30 border-cyan-400 text-cyan-200",
  CUSTOM: "bg-fuchsia-500/30 border-fuchsia-400 text-fuchsia-200",
};

const SAMPLE_CONTRACT = `SERVICE AGREEMENT between Atlas Tech SARL (Tax ID: 001928374650123) and Karim Benali, residing at 14 Rue Didouche Mourad, Algiers. Contact: karim.benali@atlastech.dz | Phone: +213 550 12 34 56. Project codename: APOLLO-X.`;

export default function ChatWorkspacePage() {
  const [provider, setProvider] = useState("GPT-4o (OpenAI)");
  const [sessionId, setSessionId] = useState("sess_98a4f2");
  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // Pipeline state: idle -> detecting -> clean | needs_review -> sending -> done
  const [step, setStep] = useState<
    "idle" | "detecting" | "clean" | "needs_review" | "sending"
  >("idle");

  const [reviewText, setReviewText] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMasked, setShowMasked] = useState(false);

  // Manual text selection state
  const [manualSelection, setManualSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [manualType, setManualType] = useState<EntityType>("PERSON");
  const reviewBoxRef = useRef<HTMLDivElement>(null);

  // Mock detection matching Cahier des charges findings contract
  const runMockDetection = (text: string) => {
    setStep("detecting");
    setReviewText(text);
    setManualSelection(null);

    setTimeout(() => {
      const patterns: {
        regex: RegExp;
        type: EntityType;
        source: FindingSource;
      }[] = [
        { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, type: "PERSON", source: "ner" },
        {
          regex: /\b[A-Z][A-Za-z0-9 ]+(?:SARL|SPA|LLC|Inc\.?|Corp\.?)\b/g,
          type: "COMPANY",
          source: "ner",
        },
        {
          regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          type: "EMAIL",
          source: "rule",
        },
        {
          regex: /\+?\d[\d\s-]{8,15}\d/g,
          type: "PHONE",
          source: "rule",
        },
        {
          regex: /\b\d{15}\b/g,
          type: "ID",
          source: "rule",
        },
        {
          regex: /\bAPOLLO-X\b/g,
          type: "CUSTOM",
          source: "custom",
        },
      ];

      const detected: Finding[] = [];
      const typeCounts: Record<string, number> = {};

      patterns.forEach(({ regex, type, source }) => {
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          // Avoid overlaps
          const overlaps = detected.some(
            (f) => start < f.end && end > f.start
          );
          if (!overlaps) {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
            detected.push({
              id: `f_${start}_${end}`,
              type,
              text: match[0],
              start,
              end,
              source,
              confidence: 0.96,
              status: "pending",
              placeholder: `[${type}_${typeCounts[type]}]`,
            });
          }
        }
      });

      detected.sort((a, b) => a.start - b.start);

      if (detected.length === 0) {
        setFindings([]);
        setStep("clean");
        // Send directly when clean
        sendToProvider(text, text);
      } else {
        setFindings(detected);
        setStep("needs_review");
      }
    }, 600);
  };

  // Build masked string from active (non-dismissed) findings
  const buildMaskedText = (raw: string, list: Finding[]) => {
    const active = list
      .filter((f) => f.status !== "dismissed")
      .sort((a, b) => b.start - a.start);
    let result = raw;
    active.forEach((f) => {
      result = result.slice(0, f.start) + f.placeholder + result.slice(f.end);
    });
    return result;
  };

  const toggleDismissFinding = (id: string) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: f.status === "dismissed" ? "pending" : "dismissed" }
          : f
      )
    );
  };

  const changeFindingType = (id: string, newType: EntityType) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, type: newType, placeholder: `[${newType}_1]` }
          : f
      )
    );
  };

  // Capture manual text selection in the review box
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedStr = selection.toString().trim();
    if (!selectedStr) return;

    const idx = reviewText.indexOf(selectedStr);
    if (idx !== -1) {
      setManualSelection({
        text: selectedStr,
        start: idx,
        end: idx + selectedStr.length,
      });
    }
  };

  const addManualFinding = () => {
    if (!manualSelection) return;
    const count =
      findings.filter((f) => f.type === manualType).length + 1;
    const newFinding: Finding = {
      id: `manual_${Date.now()}`,
      type: manualType,
      text: manualSelection.text,
      start: manualSelection.start,
      end: manualSelection.end,
      source: "custom",
      confidence: 1.0,
      status: "approved",
      placeholder: `[${manualType}_${count}]`,
    };
    setFindings((prev) =>
      [...prev, newFinding].sort((a, b) => a.start - b.start)
    );
    setManualSelection(null);
  };

  const sendToProvider = (unmasked: string, masked: string) => {
    setStep("sending");
    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        unmaskedText: unmasked,
        maskedText: masked,
      };

      const assistantMasked = `Summary from ${provider}: Reviewed "${masked}". No blocking legal clauses detected, though confidentiality obligations apply to all named parties.`;
      const assistantUnmasked = `Summary from ${provider}: Reviewed "${unmasked}". No blocking legal clauses detected, though confidentiality obligations apply to all named parties.`;

      const botMsg: ChatMessage = {
        id: `a_${Date.now() + 1}`,
        role: "assistant",
        unmaskedText: assistantUnmasked,
        maskedText: assistantMasked,
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInputText("");
      setFileName(null);
      setStep("idle");
    }, 600);
  };

  const handleApproveAndSend = () => {
    const masked = buildMaskedText(reviewText, findings);
    sendToProvider(reviewText, masked);
  };

  const handleEndSession = () => {
    setMessages([]);
    setFindings([]);
    setReviewText("");
    setInputText("");
    setFileName(null);
    setStep("idle");
    setSessionId(`sess_${Math.random().toString(36).slice(2, 8)}`);
  };

  // Render text with inline highlights using exact start/end offsets
  const renderHighlightedText = () => {
    const active = findings
      .filter((f) => f.status !== "dismissed")
      .sort((a, b) => a.start - b.start);

    if (active.length === 0) return <span>{reviewText}</span>;

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    active.forEach((f) => {
      if (f.start > cursor) {
        elements.push(
          <span key={`t_${cursor}`}>{reviewText.slice(cursor, f.start)}</span>
        );
      }
      elements.push(
        <mark
          key={f.id}
          className={`px-1.5 py-0.5 rounded border font-medium ${ENTITY_COLORS[f.type]}`}
          title={`${f.type} • source: ${f.source} • ${f.placeholder}`}
        >
          {reviewText.slice(f.start, f.end)}
          <span className="ml-1.5 text-[10px] uppercase opacity-80">
            [{f.type} · {f.source}]
          </span>
        </mark>
      );
      cursor = f.end;
    });

    if (cursor < reviewText.length) {
      elements.push(<span key="t_end">{reviewText.slice(cursor)}</span>);
    }

    return elements;
  };

  return (
    <div className="nyxora-animated-bg min-h-screen text-white flex flex-col">
      <DashboardNav />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Session & Provider Control Bar */}
        <div className="rounded-2xl bg-black/55 backdrop-blur-xl border border-[#6441A5]/40 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.15em] text-white/60">
              AI Provider:
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#9b72eb]"
            >
              <option className="bg-black" value="GPT-4o (OpenAI)">
                GPT-4o (OpenAI)
              </option>
              <option className="bg-black" value="Claude 3.5 Sonnet (Anthropic)">
                Claude 3.5 Sonnet (Anthropic)
              </option>
              <option className="bg-black" value="Gemini 2.5 Pro (Google)">
                Gemini 2.5 Pro (Google)
              </option>
            </select>
            <span className="text-[11px] font-mono text-[#b896ff] bg-[#6441A5]/20 px-3 py-1 rounded-full border border-[#6441A5]/40">
              Session: {sessionId}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Masked / Unmasked View Toggle */}
            <button
              type="button"
              onClick={() => setShowMasked(!showMasked)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.12em] border transition-all cursor-pointer ${
                showMasked
                  ? "bg-[#6441A5] border-[#b896ff] text-white"
                  : "bg-white/5 border-white/15 text-white/75 hover:text-white"
              }`}
            >
              {showMasked ? "Viewing: Masked Payload" : "Viewing: Unmasked"}
            </button>

            {/* End Session & Wipe Vault */}
            <button
              type="button"
              onClick={handleEndSession}
              className="px-3.5 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.12em] bg-red-500/15 border border-red-400/40 text-red-200 hover:bg-red-500/30 transition-all cursor-pointer"
            >
              End Session & Wipe Vault
            </button>
          </div>
        </div>

        {/* Input Box (Paste Contract or Upload PDF/DOCX) */}
        <div className="rounded-2xl bg-black/55 backdrop-blur-xl border border-[#6441A5]/40 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-white/90">
              Contract Input & Local Detection
            </h2>
            <button
              type="button"
              onClick={() => setInputText(SAMPLE_CONTRACT)}
              className="text-xs text-[#b896ff] hover:underline cursor-pointer"
            >
              Load Sample Contract
            </button>
          </div>

          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste contract text or ask a follow-up question..."
            className="w-full rounded-xl bg-white/5 border border-white/15 p-4 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb]"
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/15 text-xs text-white/80 hover:bg-white/10 cursor-pointer transition-all">
              <span>Upload PDF / DOCX</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFileName(file.name);
                    if (!inputText) setInputText(SAMPLE_CONTRACT);
                  }
                }}
              />
            </label>

            {fileName && (
              <span className="text-xs text-[#b896ff]">
                Attached: {fileName} (metadata stripped)
              </span>
            )}

            <button
              type="button"
              disabled={!inputText.trim() || step === "detecting" || step === "sending"}
              onClick={() => runMockDetection(inputText)}
              className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-[#6441A5] hover:text-white disabled:opacity-40 font-bold text-xs uppercase tracking-[0.16em] transition-all cursor-pointer"
            >
              {step === "detecting"
                ? "Detecting Locally..."
                : step === "sending"
                ? "Sending Masked..."
                : "Scan & Continue"}
            </button>
          </div>

          {step === "clean" && (
            <p className="text-xs text-emerald-300 font-medium">
              Verdict: No sensitive data detected. Sent directly to provider.
            </p>
          )}
        </div>

        {/* Human Review Panel (shown when sensitive data is detected) */}
        {step === "needs_review" && (
          <div className="rounded-2xl bg-black/70 backdrop-blur-xl border border-amber-400/50 p-5 sm:p-6 space-y-5 shadow-[0_0_40px_rgba(100,65,165,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  Needs Human Review
                </span>
                <p className="text-xs text-white/65 mt-2">
                  Verify detected entities below, or highlight any missed text with your cursor to add it manually.
                </p>
              </div>
            </div>

            {/* Highlighted Text Box */}
            <div
              ref={reviewBoxRef}
              onMouseUp={handleTextSelect}
              className="rounded-xl bg-white/5 border border-white/15 p-4 text-sm leading-relaxed select-text"
            >
              {renderHighlightedText()}
            </div>

            {/* Add Missed Entity Manually */}
            {manualSelection && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#6441A5]/25 border border-[#b896ff]/40">
                <span className="text-xs">
                  Add missed text: <strong>&quot;{manualSelection.text}&quot;</strong>
                </span>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as EntityType)}
                  className="rounded-lg bg-black/60 border border-white/20 px-2.5 py-1 text-xs"
                >
                  {Object.keys(ENTITY_COLORS).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addManualFinding}
                  className="px-3 py-1 rounded-full bg-white text-black text-xs font-bold uppercase cursor-pointer"
                >
                  + Mask Entity
                </button>
              </div>
            )}

            {/* Findings List Controls */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">
                Detected Findings ({findings.filter((f) => f.status !== "dismissed").length} active)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {findings.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 border text-xs ${
                      f.status === "dismissed"
                        ? "bg-white/5 border-white/10 opacity-45 line-through"
                        : "bg-white/5 border-white/15"
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-semibold text-white">{f.text}</span>
                      <span className="ml-2 text-[11px] text-[#b896ff]">
                        → {f.placeholder}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={f.type}
                        disabled={f.status === "dismissed"}
                        onChange={(e) =>
                          changeFindingType(f.id, e.target.value as EntityType)
                        }
                        className="rounded bg-black/60 border border-white/15 px-1.5 py-1 text-[11px]"
                      >
                        {Object.keys(ENTITY_COLORS).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleDismissFinding(f.id)}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-red-500/30 text-[11px] cursor-pointer"
                      >
                        {f.status === "dismissed" ? "Restore" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Masked Outgoing Preview */}
            <div className="rounded-xl bg-black/60 border border-white/10 p-4 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#b896ff]">
                Masked Preview (What leaves the company):
              </span>
              <p className="text-xs font-mono text-white/85 leading-relaxed">
                {buildMaskedText(reviewText, findings)}
              </p>
            </div>

            {/* Approve & Send Gate */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApproveAndSend}
                className="px-6 py-3 rounded-full bg-white text-black hover:bg-[#6441A5] hover:text-white font-bold text-xs uppercase tracking-[0.16em] shadow-[0_0_25px_rgba(155,114,235,0.7)] transition-all cursor-pointer"
              >
                Approve & Send Masked Payload
              </button>
            </div>
          </div>
        )}

        {/* Conversation History (Unmasked vs Masked Toggle) */}
        {messages.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
              Conversation ({showMasked ? "Masked View" : "Unmasked Restored View"})
            </h3>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl p-5 border ${
                  m.role === "user"
                    ? "bg-white/5 border-white/15"
                    : "bg-[#6441A5]/20 border-[#6441A5]/50"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#b896ff] mb-2">
                  {m.role === "user" ? "You" : provider}
                </div>
                <p className="text-sm leading-relaxed text-white/95">
                  {showMasked ? m.maskedText : m.unmaskedText}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}