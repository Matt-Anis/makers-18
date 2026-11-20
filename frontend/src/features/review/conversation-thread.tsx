"use client";

import { ChatMessage } from "@/features/review/types";

export function ConversationThread({
  messages,
  showMasked,
  providerLabel,
}: {
  messages: ChatMessage[];
  showMasked: boolean;
  providerLabel: string;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section aria-label="Conversation history" className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
        Conversation ({showMasked ? "Masked View" : "Unmasked Restored View"})
      </h2>

      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-2xl border p-5 ${
            message.role === "user"
              ? "border-white/15 bg-white/5"
              : "border-[#6441A5]/50 bg-[#6441A5]/20"
          }`}
        >
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#b896ff]">
            {message.role === "user" ? "You" : providerLabel}
          </div>
          <p className="text-sm leading-relaxed text-white/95">
            {showMasked ? message.maskedText : message.unmaskedText}
          </p>
        </div>
      ))}
    </section>
  );
}
