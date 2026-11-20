"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import localFont from "next/font/local";

const duneRise = localFont({
  src: "../../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  unmaskedText: string;
  maskedText: string;
}

interface SessionItem {
  id: string;
  title: string;
  date: string;
  messages: ChatMessage[];
  vault: Record<string, string>;
}

const SAMPLE_CONTRACT = `SERVICE AGREEMENT between Atlas Tech SARL (NIF: 001928374650123, IBAN: DZ58-0042-9910) and Karim Benali, residing at 14 Rue Didouche Mourad, Algiers. Contact: karim.benali@atlastech.dz | Phone: +213 550 12 34 56. Project: APOLLO-X. Please summarize the key obligations and risks.`;

const INITIAL_SESSIONS: SessionItem[] = [
  {
    id: "sess_01",
    title: "New session",
    date: "Starts on scan",
    messages: [],
    vault: {},
  },
  {
    id: "sess_02",
    title: "NDA — Atlas Tech SARL",
    date: "Yesterday",
    messages: [
      {
        id: "m1",
        role: "user",
        unmaskedText:
          "Summarize the confidentiality obligations for Atlas Tech SARL and Karim Benali.",
        maskedText:
          "Summarize the confidentiality obligations for [COMPANY_1] and [PERSON_1].",
      },
      {
        id: "m2",
        role: "assistant",
        unmaskedText:
          "Summary: Both Atlas Tech SARL and Karim Benali are bound by a 24-month non-disclosure obligation covering all technical and financial records.",
        maskedText:
          "Summary: Both [COMPANY_1] and [PERSON_1] are bound by a 24-month non-disclosure obligation covering all technical and financial records.",
      },
    ],
    vault: {
      "atlas tech sarl": "[COMPANY_1]",
      "karim benali": "[PERSON_1]",
    },
  },
];

export default function ChatWorkspacePage() {
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: "Owner" | "User";
  }>({
    name: "Workspace Owner",
    email: "owner@acme.local",
    role: "Owner",
  });

  useEffect(() => {
    const saved = localStorage.getItem("nyxora_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        // keep default
      }
    }
  }, []);

  const [model, setModel] = useState("mock::nyxora-mock-v1");
  const [thinking, setThinking] = useState("Medium");
  const [mode, setMode] = useState<"manual" | "rules-only">("manual");
  const [unmaskedView, setUnmaskedView] = useState(true);

  const [sessions, setSessions] = useState<SessionItem[]>(INITIAL_SESSIONS);
  const [activeId, setActiveId] = useState("sess_01");

  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

  const [pendingRaw, setPendingRaw] = useState<string | null>(null);
  const [maskedDraft, setMaskedDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [maskedCount, setMaskedCount] = useState(0);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const isOwner = currentUser.role === "Owner";

  const resetGate = () => {
    setPendingRaw(null);
    setMaskedDraft("");
    setIsEditing(false);
    setMaskedCount(0);
  };

  const handleNewSession = () => {
    const id = `sess_${Math.random().toString(36).slice(2, 6)}`;
    setSessions((prev) => [
      { id, title: "New session", date: "Starts on scan", messages: [], vault: {} },
      ...prev,
    ]);
    setActiveId(id);
    setInputText("");
    setAttachedFile(null);
    resetGate();
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      const fresh: SessionItem = {
        id: `sess_${Math.random().toString(36).slice(2, 6)}`,
        title: "New session",
        date: "Starts on scan",
        messages: [],
        vault: {},
      };
      setSessions([fresh]);
      setActiveId(fresh.id);
    } else {
      setSessions(filtered);
      if (activeId === id) setActiveId(filtered[0].id);
    }
    resetGate();
  };

  const handleScanAndContinue = () => {
    const raw = [
      attachedFile ? `[File: ${attachedFile}]\n${SAMPLE_CONTRACT}` : "",
      inputText.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!raw) return;

    const currentVault = { ...activeSession.vault };
    let count = 0;

    const getPlaceholder = (val: string, label: string) => {
      const k = val.trim().toLowerCase();
      if (currentVault[k]) return currentVault[k];
      const num =
        Object.values(currentVault).filter((v) => v.startsWith(`[${label}_`)).length + 1;
      const token = `[${label}_${num}]`;
      currentVault[k] = token;
      return token;
    };

    const rulesPatterns: { rx: RegExp; label: string }[] = [
      { rx: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "EMAIL" },
      { rx: /\+?\d[\d\s-]{8,15}\d/g, label: "PHONE" },
      { rx: /\b\d{15}\b/g, label: "ID" },
      { rx: /\bDZ\d{2}-\d{4}-\d{4}\b/g, label: "IBAN" },
      { rx: /\bAPOLLO-X\b/gi, label: "PROJECT" },
    ];

    const aiPatterns: { rx: RegExp; label: string }[] =
      mode === "rules-only"
        ? []
        : [
            { rx: /\b[A-Z][A-Za-z0-9 ]+(?:SARL|SPA|LLC|Inc\.?|Corp\.?)\b/g, label: "COMPANY" },
            { rx: /\b\d{1,3}\s+Rue\s+[A-Za-z\s]+,\s*[A-Za-z]+\b/g, label: "ADDRESS" },
            { rx: /\b(?:Karim Benali|Karim|Yacine Khelifi)\b/g, label: "PERSON" },
          ];

    let masked = raw;
    [...rulesPatterns, ...aiPatterns].forEach(({ rx, label }) => {
      masked = masked.replace(rx, (m) => {
        count += 1;
        return getPlaceholder(m, label);
      });
    });

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, vault: currentVault } : s))
    );

    setPendingRaw(raw);
    setMaskedDraft(masked);
    setMaskedCount(count);
    setIsEditing(false);
  };

  const handleAcceptSubmit = () => {
    if (!pendingRaw || !maskedDraft.trim()) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      unmaskedText: pendingRaw,
      maskedText: maskedDraft,
    };

    const maskedReply = `Summary (${model} · ${thinking}):\n• Entities covered: ${
      Object.values(activeSession.vault).join(", ") || "None"
    }.\n• Key takeaways: Delivery milestones, payment schedules, and strict confidentiality clauses apply under local jurisdiction.`;

    let unmaskedReply = maskedReply;
    Object.entries(activeSession.vault).forEach(([realLower, token]) => {
      const formatted = realLower
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      unmaskedReply = unmaskedReply.split(token).join(formatted);
    });

    const botMsg: ChatMessage = {
      id: `a_${Date.now() + 1}`,
      role: "assistant",
      unmaskedText: unmaskedReply,
      maskedText: maskedReply,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title:
                s.messages.length === 0
                  ? attachedFile || inputText.slice(0, 26) || "Contract Review"
                  : s.title,
              date: "Active",
              messages: [...s.messages, userMsg, botMsg],
            }
          : s
      )
    );

    setInputText("");
    setAttachedFile(null);
    resetGate();
  };

  return (
    <div className="nyxora-animated-bg min-h-screen text-white flex flex-col">
      {/* Top Navbar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#23969D]/20 bg-[#00181a]/60 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className={`${duneRise.className} text-lg tracking-[0.25em] uppercase text-white`}
          >
            NYXORA
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/chat"
              className="px-4 py-1.5 rounded-full bg-[#23969D]/30 border border-[#23969D]/50 text-xs font-medium text-white"
            >
              Workspace
            </Link>

            {isOwner && (
              <>
                <Link
                  href="/rules"
                  className="px-4 py-1.5 rounded-full hover:bg-[#23969D]/20 text-xs font-medium text-white/70 hover:text-white transition-colors"
                >
                  Owner Settings
                </Link>
                <Link
                  href="/metrics"
                  className="px-4 py-1.5 rounded-full hover:bg-[#23969D]/20 text-xs font-medium text-white/70 hover:text-white transition-colors"
                >
                  Metrics
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">{currentUser.name}</div>
            <div className="text-[11px] text-white/50">{currentUser.email}</div>
          </div>

          <span className="px-3 py-1 rounded-full bg-[#006268]/45 border border-[#23969D]/45 text-[11px] text-white/90">
            🛡 {currentUser.role}
          </span>

          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-[#23969D]/35 border border-white/15 text-xs text-white/85 transition-all"
          >
            ↪ Sign out
          </Link>
        </div>
      </header>

      {/* 3-Column Workspace */}
      <div className="flex-1 max-w-[1550px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT SIDEBAR (3 cols): Session history */}
        <aside className="lg:col-span-3 rounded-3xl bg-[#001d20]/80 backdrop-blur-xl border border-[#23969D]/25 p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-white/85">
                Session history
              </span>
              <button
                type="button"
                onClick={handleNewSession}
                className="px-3 py-1 rounded-full bg-[#23969D] hover:bg-[#006268] text-xs font-medium text-white cursor-pointer transition-all"
              >
                + New
              </button>
            </div>

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {sessions.map((s) => {
                const active = s.id === activeSession.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveId(s.id);
                      resetGate();
                    }}
                    className={`group flex items-center justify-between gap-2 rounded-2xl px-3.5 py-3 border text-xs cursor-pointer transition-all ${
                      active
                        ? "bg-[#006268]/50 border-[#23969D]/70 text-white"
                        : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-[#006268]/25"
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="text-[11px] text-white/45 mt-0.5">{s.date}</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete session"
                      className="px-1.5 py-0.5 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#23969D]/20 flex items-center justify-between text-[11px] text-white/50 px-1">
            <span>Vault keys: {Object.keys(activeSession.vault).length}</span>
            <span className="text-[#23969D]">● Session local</span>
          </div>
        </aside>

        {/* CENTER PANEL (5 cols) */}
        <main className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-full bg-[#001d20]/85 backdrop-blur-xl border border-[#23969D]/25 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-white/50">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-white focus:outline-none"
              >
                <option className="bg-[#001d20]" value="mock::nyxora-mock-v1">
                  mock::nyxora-mock-v1
                </option>
                <option className="bg-[#001d20]" value="openai::gpt-4o">
                  openai::gpt-4o
                </option>
                <option className="bg-[#001d20]" value="anthropic::claude-3.5">
                  anthropic::claude-3.5
                </option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-white/50">Thinking</span>
              <select
                value={thinking}
                onChange={(e) => setThinking(e.target.value)}
                className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-white focus:outline-none"
              >
                <option className="bg-[#001d20]" value="Low">Low</option>
                <option className="bg-[#001d20]" value="Medium">Medium</option>
                <option className="bg-[#001d20]" value="High">High</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-white/50">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "manual" | "rules-only")}
                className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-white focus:outline-none"
              >
                <option className="bg-[#001d20]" value="manual">
                  manual
                </option>
                <option className="bg-[#001d20]" value="rules-only">
                  rules-only
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setUnmaskedView(!unmaskedView)}
              className="px-3.5 py-1 rounded-full bg-[#006268]/45 hover:bg-[#23969D]/45 border border-[#23969D]/40 text-xs text-white cursor-pointer transition-all"
            >
              👁 {unmaskedView ? "Unmasked view" : "Masked view"}
            </button>
          </div>

          {activeSession.messages.length > 0 && (
            <div className="rounded-3xl bg-[#001d20]/80 backdrop-blur-xl border border-[#23969D]/25 p-5 space-y-3 max-h-72 overflow-y-auto">
              {activeSession.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-line border ${
                    m.role === "user"
                      ? "bg-white/[0.04] border-white/10 ml-6"
                      : "bg-[#006268]/35 border-[#23969D]/45 mr-6"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#23969D] mb-1">
                    {m.role === "user" ? "You" : model}
                  </div>
                  <div className="text-white/95">
                    {unmaskedView ? m.unmaskedText : m.maskedText}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-3xl bg-[#001d20]/80 backdrop-blur-xl border border-[#23969D]/25 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Contract input &amp; local detection
              </h2>
              <button
                type="button"
                onClick={() => setInputText(SAMPLE_CONTRACT)}
                className="text-xs text-[#23969D] hover:underline cursor-pointer"
              >
                Load sample contract
              </button>
            </div>

            {attachedFile && (
              <div className="flex items-center justify-between rounded-xl bg-[#006268]/35 border border-[#23969D]/45 px-3.5 py-2 text-xs text-[#23969D]">
                <span>📄 {attachedFile}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <textarea
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste contract text or ask a follow-up question..."
              className="w-full rounded-2xl bg-white/[0.04] border border-[#23969D]/25 p-4 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#23969D] resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <label className="px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-[#006268]/35 border border-[#23969D]/30 text-xs font-medium text-white/85 cursor-pointer transition-all">
                ↥ Attach PDF / DOCX
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachedFile(f.name);
                  }}
                />
              </label>

              <button
                type="button"
                disabled={!inputText.trim() && !attachedFile}
                onClick={handleScanAndContinue}
                className="px-6 py-2.5 rounded-full bg-[#23969D] hover:bg-[#006268] disabled:bg-white/25 disabled:text-white/50 text-white font-semibold text-xs transition-all cursor-pointer"
              >
                Scan &amp; continue
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT BAR (4 cols): Masked Version Gate */}
        <aside className="lg:col-span-4 rounded-3xl bg-[#001d20]/80 backdrop-blur-xl border border-[#23969D]/25 p-6 flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#23969D]/20">
              <h2 className="text-sm font-semibold text-white">Masked version</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#006268]/45 text-[11px] text-[#23969D] font-medium">
                {pendingRaw ? `${maskedCount} masked` : "Gate locked"}
              </span>
            </div>

            {!pendingRaw ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
                <p className="text-xs font-medium text-white/75">
                  No masked payload waiting
                </p>
                <p className="text-xs text-white/45 mt-1.5 leading-relaxed">
                  Click <strong className="text-white/85">Scan &amp; continue</strong> to generate the masked version here. You can edit, decline, or accept &amp; submit it to the AI.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3 pt-4">
                <div className="flex items-center justify-between text-[11px] text-white/55">
                  <span>
                    {isEditing ? "Editing masked text:" : "Preview before sending:"}
                  </span>
                  <span className="text-[#23969D]">
                    {mode === "rules-only" ? "Rules only" : "Rules + Local AI"}
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    rows={11}
                    value={maskedDraft}
                    onChange={(e) => setMaskedDraft(e.target.value)}
                    className="flex-1 w-full rounded-2xl bg-black/50 border border-[#23969D] p-3.5 font-mono text-xs text-white leading-relaxed focus:outline-none resize-none"
                  />
                ) : (
                  <div className="flex-1 rounded-2xl bg-black/40 border border-[#23969D]/25 p-3.5 font-mono text-xs text-white/90 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[45vh]">
                    {maskedDraft}
                  </div>
                )}
              </div>
            )}
          </div>

          {pendingRaw && (
            <div className="pt-4 mt-4 border-t border-[#23969D]/20 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDecline}
                className="py-2.5 rounded-full bg-red-500/15 hover:bg-red-500/30 border border-red-400/35 text-red-200 font-semibold text-xs transition-all cursor-pointer"
              >
                Decline
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs transition-all cursor-pointer"
              >
                {isEditing ? "Save edit" : "Edit"}
              </button>

              <button
                type="button"
                onClick={handleAcceptSubmit}
                className="py-2.5 rounded-full bg-[#23969D] hover:bg-[#006268] text-white font-semibold text-xs transition-all cursor-pointer"
              >
                Accept &amp; submit
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}