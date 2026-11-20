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
          className={`rounded-3xl border p-5 backdrop-blur-xl ${
            message.role === "user"
              ? "border-white/10 bg-white/[0.04]"
              : "border-[#8b6eff]/30 bg-[#7c5cff]/[0.09]"
          }`}
        >
          <div className="mb-1.5 text-xs font-medium text-[#b8a5ff]">
            {message.role === "user" ? "You" : (message.modelLabel ?? providerLabel)}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
            {showMasked ? message.maskedText : message.unmaskedText}
          </p>
        </div>
      ))}
    </section>
  );
}
