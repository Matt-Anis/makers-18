"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type View = "original" | "masked";

const VIEWS: { id: View; label: string }[] = [
  { id: "original", label: "Your copy" },
  { id: "masked", label: "What the AI receives" },
];

const ENTITIES = {
  recipient: { name: "Aster Vale Ltd", token: "[COMPANY_3c91a2]" },
  contact: { name: "Lena Rao", token: "[PERSON_7f3a9b]" },
  discloser: { name: "Corvid Health SA", token: "[COMPANY_b2e047]" },
  email: { name: "l.rao@corvidhealth.com", token: "[EMAIL_5d1c8e]" },
} as const;

type EntityKey = keyof typeof ENTITIES;

function Entity({ id, view }: { id: EntityKey; view: View }) {
  const { name, token } = ENTITIES[id];

  if (view === "original") {
    return <mark className="rounded-[2px] bg-paper-mark px-0.5 text-paper-ink box-decoration-clone">{name}</mark>;
  }

  return (
    <span className="rounded-[2px] bg-paper-token px-1 font-mono text-[0.78em] font-medium tracking-tight text-paper-token-ink box-decoration-clone wrap-anywhere">
      {token}
    </span>
  );
}

export function SendGatePreview() {
  const [view, setView] = useState<View>("masked");
  const masked = view === "masked";

  return (
    <figure id="send-gate" aria-labelledby="send-gate-caption" className="scroll-mt-24">
      <div role="group" aria-label="Choose a view of the sample clause" className="mb-3 inline-flex rounded-md border border-border p-0.5">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "min-h-9 cursor-pointer rounded-[5px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
              view === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-[3px] bg-paper text-paper-ink shadow-[0_1px_0_#ffffff14,0_20px_50px_-20px_#000c]">
        <div className="flex items-baseline justify-between gap-4 border-b border-paper-rule px-5 py-3 font-serif text-[0.8rem] text-paper-muted sm:px-8">
          <span className="tracking-[0.08em] uppercase">Mutual non-disclosure agreement</span>
          <span className="shrink-0 italic">p. 4 of 9</span>
        </div>

        <div className="px-5 pt-6 pb-7 font-serif text-[1.05rem] leading-[1.75] sm:px-8 sm:text-lg">
          <h3 className="mb-3 font-semibold">7. Breach notification</h3>
          <p className="grid grid-cols-[2.25rem_1fr]">
            <span className="text-paper-muted">7.2</span>
            <span>
              <Entity id="recipient" view={view} /> (the &ldquo;Recipient&rdquo;) shall notify{" "}
              <Entity id="contact" view={view} />, acting for <Entity id="discloser" view={view} />, in writing within
              five (5) business days of discovering any unauthorised disclosure of Confidential Information.
            </span>
          </p>
          <p className="mt-3 grid grid-cols-[2.25rem_1fr]">
            <span className="text-paper-muted">7.3</span>
            <span>
              Notice under clause 7.2 shall be sent to <Entity id="email" view={view} />.
            </span>
          </p>
        </div>

        <p className="border-t border-paper-rule px-5 py-3 text-sm text-paper-muted sm:px-8" aria-live="polite">
          {masked
            ? "4 details replaced on your server. In manual review, this waits for your approval."
            : "4 sensitive details found. These never leave your server."}
        </p>
      </div>

      <figcaption id="send-gate-caption" className="mt-6 border-l-2 border-border pl-4">
        <span className="block text-sm text-muted-foreground">The reply, restored in your workspace</span>
        <span className="mt-1 block font-serif text-lg leading-relaxed text-foreground">
          {ENTITIES.contact.name} must get written notice from {ENTITIES.recipient.name} within five business days,
          sent to {ENTITIES.email.name}.
        </span>
      </figcaption>
    </figure>
  );
}
