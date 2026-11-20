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
    <section aria-label="Conversation history" className="space-y-3">
      <h2 className="text-xs font-medium text-white/60">
        Conversation ({showMasked ? "Masked view" : "Unmasked restored view"})
      </h2>

      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-xl border p-4 ${
            message.role === "user"
              ? "border-white/10 bg-white/[0.03]"
              : "border-[#7c5cff]/30 bg-[#7c5cff]/[0.08]"
          }`}
        >
          <div className="mb-1.5 text-xs font-medium text-[#a78bfa]">
            {message.role === "user" ? "You" : providerLabel}
          </div>
          <p className="text-sm leading-relaxed text-white/90">
            {showMasked ? message.maskedText : message.unmaskedText}
          </p>
        </div>
      ))}
    </section>
  );
}
