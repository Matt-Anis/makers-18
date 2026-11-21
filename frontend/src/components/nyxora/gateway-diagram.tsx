"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Token({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] bg-accent px-1 font-mono text-[0.8em] text-token box-decoration-clone wrap-anywhere">
      {children}
    </span>
  );
}

function Name({ children }: { children: ReactNode }) {
  return <mark className="rounded-[3px] bg-paper-mark/15 px-0.5 text-paper-mark box-decoration-clone">{children}</mark>;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs text-muted-foreground">{children}</p>;
}

type Stage = {
  id: string;
  short: string;
  title: string;
  tagline: string;
  happens: string;
  protection: string;
  benefit: string;
  example: ReactNode;
};

const STAGES: Stage[] = [
  {
    id: "detect",
    short: "1",
    title: "Detect",
    tagline: "Find and mask",
    happens:
      "Your message is scanned on your server: names already seen in this chat, pattern rules, your rulebook terms, and a name-recognition model.",
    protection:
      "Each detail becomes a random placeholder. The same name keeps the same placeholder for the whole conversation.",
    benefit: "Client names, emails and IDs stay inside your infrastructure.",
    example: (
      <>
        <Label>Found in your message</Label>
        <dl className="space-y-1.5 text-sm">
          {[
            ["Aster Vale Ltd", "[COMPANY_3c91a2]"],
            ["Lena Rao", "[PERSON_7f3a9b]"],
            ["l.rao@corvidhealth.com", "[EMAIL_5d1c8e]"],
          ].map(([name, token]) => (
            <div key={token} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <dt>
                <Name>{name}</Name>
              </dt>
              <dd className="flex items-center gap-2">
                <span className="text-muted-foreground" aria-label="becomes">
                  →
                </span>
                <Token>{token}</Token>
              </dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    id: "gate",
    short: "2",
    title: "Send Gate",
    tagline: "A person approves",
    happens:
      "In manual review, the masked prompt pauses. You see every finding, then choose to approve and send, or reject.",
    protection:
      "The gate is enforced in the backend, so only approved, masked text can reach a provider. Changing the page in a browser can't skip it.",
    benefit: "Nothing leaves without a decision. Owners can allow automatic review for routine work.",
    example: (
      <>
        <Label>Waiting for your approval</Label>
        <p className="font-serif text-base leading-relaxed">
          <Token>[COMPANY_3c91a2]</Token> shall notify <Token>[PERSON_7f3a9b]</Token> within five business days…
        </p>
        <div className="mt-3 flex gap-2 text-xs font-medium" aria-hidden="true">
          <span className="rounded-md bg-foreground px-2.5 py-1.5 text-background">Approve &amp; send</span>
          <span className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground">Reject</span>
        </div>
      </>
    ),
  },
  {
    id: "keys",
    short: "3",
    title: "Key vault",
    tagline: "Server-side keys",
    happens:
      "NYXORA attaches the workspace's own provider key on the server and sends the masked prompt to a model the owner has enabled.",
    protection:
      "API keys are encrypted at rest and only ever shown as ••••a9f2. Teammates never see or handle them.",
    benefit:
      "Bring any key: OpenAI, Anthropic, Gemini, or any OpenAI-compatible or self-hosted model. Switch providers without changing how people work.",
    example: (
      <>
        <Label>Request leaving your server</Label>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[0.8rem]">
          <dt className="text-muted-foreground">provider</dt>
          <dd>chosen by the owner</dd>
          <dt className="text-muted-foreground">api key</dt>
          <dd>••••a9f2 <span className="text-muted-foreground">(decrypted on the server only)</span></dd>
          <dt className="text-muted-foreground">prompt</dt>
          <dd className="min-w-0">
            <Token>[COMPANY_3c91a2]</Token> shall notify <Token>[PERSON_7f3a9b]</Token>…
          </dd>
        </dl>
      </>
    ),
  },
  {
    id: "restore",
    short: "4",
    title: "Restore",
    tagline: "Real names return",
    happens:
      "The model replies using placeholders. NYXORA swaps them back from the session's encrypted vault before anyone reads it.",
    protection: "The vault is encrypted and tied to one conversation. End the conversation to wipe it.",
    benefit: "Answers read naturally, with the real names, instantly and at no extra AI cost.",
    example: (
      <>
        <Label>The model replied</Label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <Token>[PERSON_7f3a9b]</Token> must get written notice from <Token>[COMPANY_3c91a2]</Token>…
        </p>
        <Label>
          <span className="mt-4 block">You read</span>
        </Label>
        <p className="font-serif text-base leading-relaxed">
          <Name>Lena Rao</Name> must get written notice from <Name>Aster Vale Ltd</Name>…
        </p>
      </>
    ),
  },
  {
    id: "audit",
    short: "∞",
    title: "Audit log",
    tagline: "Every step, metadata only",
    happens: "Each action is recorded: who did it, when, which provider was used and how many details were masked.",
    protection: "Prompts, replies and vault contents are never written to the log.",
    benefit: "A clear record for internal reviews, without creating another copy of sensitive text.",
    example: (
      <>
        <Label>Log entry</Label>
        <p className="font-mono text-[0.8rem] leading-relaxed">
          11:04 · lena.rao · approved send · 3 details masked · provider: OpenAI
        </p>
        <p className="mt-3 text-xs text-muted-foreground">No message text stored.</p>
      </>
    ),
  },
];

const AUDIT = STAGES.length - 1;

/** Horizontal connector used on large screens. */
function Connector({ lit, reverse = false }: { lit: boolean; reverse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex min-w-6 flex-1 items-center transition-colors duration-300 motion-reduce:transition-none",
        reverse && "flex-row-reverse",
        lit ? "text-highlight" : "text-border",
      )}
    >
      <span className="h-px flex-1 bg-current" />
      <ChevronRight className={cn("-mx-1 size-3.5", reverse && "rotate-180")} />
    </span>
  );
}

function MobileArrow({ lit }: { lit: boolean }) {
  return (
    <ArrowDown
      aria-hidden="true"
      className={cn("mx-auto my-2 size-4 lg:hidden", lit ? "text-highlight" : "text-muted-foreground/40")}
    />
  );
}

function Endpoint({ title, detail, lit }: { title: string; detail: string; lit: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-center transition-colors duration-300 motion-reduce:transition-none lg:mt-16 lg:flex lg:h-24 lg:w-40 lg:shrink-0 lg:flex-col lg:justify-center lg:self-start",
        lit ? "border-highlight/60 text-foreground" : "border-border text-muted-foreground",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-snug">{detail}</p>
    </div>
  );
}

export function GatewayDiagram() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = STAGES[active];

  // Which parts of the path a prompt has travelled through at this step.
  const reached = (index: number) => active !== AUDIT && active >= index;

  function select(index: number, focus = false) {
    const next = (index + STAGES.length) % STAGES.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowDown: active + 1,
      ArrowLeft: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: STAGES.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key], true);
    }
  }

  function renderTab(index: number, className?: string) {
    const item = STAGES[index];
    const selected = index === active;
    return (
      <button
        ref={(node) => {
          tabRefs.current[index] = node;
        }}
        key={item.id}
        type="button"
        role="tab"
        id={`stage-tab-${item.id}`}
        aria-selected={selected}
        aria-controls="stage-panel"
        tabIndex={selected ? 0 : -1}
        onClick={() => select(index)}
        onKeyDown={onKeyDown}
        className={cn(
          "group flex cursor-pointer items-baseline gap-3 rounded-md border px-3.5 py-3 text-left lg:h-18 lg:items-center transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight motion-reduce:transition-none",
          selected
            ? "border-highlight bg-accent text-foreground"
            : "border-border bg-background hover:border-muted-foreground/60",
          className,
        )}
      >
        <span className={cn("font-serif text-lg italic", selected ? "text-highlight" : "text-muted-foreground")}>
          {item.short}
        </span>
        <span>
          <span className="block text-sm font-semibold">{item.title}</span>
          <span className="block text-xs text-muted-foreground">{item.tagline}</span>
        </span>
      </button>
    );
  }

  return (
    <div>
      {/* Path diagram */}
      <div className="lg:flex lg:items-center">
        <Endpoint title="Your team" detail="Asks in chat" lit={reached(0) || active === 3} />

        <div className="hidden w-12 shrink-0 flex-col gap-[74px] self-start pt-[61px] lg:flex xl:w-16" aria-hidden="true">
          <Connector lit={reached(0)} />
          <Connector lit={reached(3)} reverse />
        </div>
        <MobileArrow lit={reached(0)} />

        <div className="relative flex-1 rounded-lg border border-dashed border-muted-foreground/40 p-3 pt-8 sm:p-4 sm:pt-8">
          <p className="absolute top-2.5 left-4 text-xs text-muted-foreground">Your server · NYXORA</p>

          <div role="tablist" aria-label="Steps a prompt goes through" aria-orientation="horizontal">
            {/* Outbound: detect → gate → keys */}
            <div className="grid gap-2 lg:flex lg:items-center lg:gap-0">
              {renderTab(0, "lg:flex-1")}
              <span className="hidden lg:flex lg:w-6 xl:w-8">
                <Connector lit={reached(1)} />
              </span>
              {renderTab(1, "lg:flex-1")}
              <span className="hidden lg:flex lg:w-6 xl:w-8">
                <Connector lit={reached(2)} />
              </span>
              {renderTab(2, "lg:flex-1")}
            </div>

            {/* Return: provider → restore */}
            <div className="mt-2 grid gap-2 lg:mt-4 lg:flex lg:items-center lg:gap-0">
              {renderTab(3, "lg:w-[calc((100%-3rem)/3)] xl:w-[calc((100%-4rem)/3)]")}
              <span className="hidden flex-1 lg:flex lg:pl-2">
                <Connector lit={reached(3)} reverse />
              </span>
            </div>

            {renderTab(AUDIT, "mt-2 w-full lg:mt-4")}
          </div>
        </div>

        <MobileArrow lit={reached(2)} />
        <div className="hidden w-12 shrink-0 flex-col gap-[74px] self-start pt-[61px] lg:flex xl:w-16" aria-hidden="true">
          <Connector lit={reached(2)} />
          <Connector lit={reached(3)} reverse />
        </div>

        <Endpoint
          title="AI provider"
          detail="OpenAI · Anthropic · Gemini · self-hosted"
          lit={active === 2 || active === 3}
        />
      </div>

      {/* Detail panel */}
      <div
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={`stage-tab-${stage.id}`}
        className="mt-6 grid gap-6 rounded-lg border border-border bg-card p-5 sm:p-7 md:grid-cols-[1fr_1.1fr] md:gap-10"
      >
        <div className="min-w-0">
          <h3 className="font-serif text-2xl">{stage.title}</h3>
          <div className="mt-4 rounded-md border border-border bg-background p-4">{stage.example}</div>
        </div>

        <div className="flex min-w-0 flex-col">
          <dl className="space-y-4">
            {[
              ["What happens", stage.happens],
              ["How it's protected", stage.protection],
              ["What you get", stage.benefit],
            ].map(([term, text], i) => (
              <div key={term} className={cn(i > 0 && "border-t border-border pt-4")}>
                <dt className={cn("text-xs font-medium", i === 2 ? "text-highlight" : "text-muted-foreground")}>{term}</dt>
                <dd className={cn("mt-1 leading-relaxed", i === 2 && "text-foreground")}>{text}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex items-center justify-between gap-4 pt-2 md:mt-auto">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Step {active + 1} of {STAGES.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => select(active - 1)}
                aria-label="Previous step"
                className="grid size-9 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-highlight"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => select(active + 1)}
                className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-highlight"
              >
                Next step
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
