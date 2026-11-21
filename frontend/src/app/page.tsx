import Link from "next/link";
import localFont from "next/font/local";
import {
  ArrowRight,
  Check,
  Database,
  FileSearch,
  KeyRound,
  Lock,
  MessageSquare,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { LandingNav } from "@/components/nyxora/landing-nav";
import { SendGatePreview } from "@/components/nyxora/send-gate-preview";

const duneRise = localFont({
  src: "../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

const PIPELINE_STEPS = [
  {
    number: "01",
    title: "Scrub & detect locally",
    description:
      "Upload PDF or DOCX contracts—hidden metadata, comments, and deleted revisions are stripped automatically. Layered detection combines session vault memory, custom rules, Presidio NER, and an optional local GPU SLM.",
    icon: FileSearch,
    tag: "Pass 0 · Rules · NER · SLM",
  },
  {
    number: "02",
    title: "Human-in-the-loop Send Gate",
    description:
      "Inspect every flagged entity side-by-side against the exact masked payload before anything leaves your network. Approve, reject, or enforce mandatory manual review across the workspace.",
    icon: ShieldCheck,
    tag: "Backend-enforced gate",
  },
  {
    number: "03",
    title: "Instant local restore & wipe",
    description:
      "Replies return masked from OpenAI, Anthropic, or Gemini and restore deterministically in under 1ms from your encrypted session vault. Wipe the vault permanently with a single click.",
    icon: RotateCcw,
    tag: "<1ms restore · 1-click wipe",
  },
] as const;

const TEAM_FEATURES = [
  "Familiar ChatGPT / Claude-style workspace with session history",
  "Pick from Owner-approved models and adjust thinking effort",
  "Upload PDF, DOCX, or TXT contracts with automatic metadata scrubbing",
  "Switch between Restored and exact Masked Wire views anytime",
  "Live Privacy Inspector showing vault index and Fernet ciphertext",
] as const;

const OWNER_FEATURES = [
  "Store provider API keys Fernet-encrypted at rest (never returned in plaintext)",
  "Discover live models and enforce workspace defaults or manual-only review",
  "Create keyword/regex rules or import Markdown privacy policy files",
  "Provision and deactivate accounts with role-based access control",
  "Review metadata-only audit logs and run live recall & ablation benchmarks",
] as const;

const SECURITY_PILLARS = [
  {
    title: "Backend-enforced Send Gate",
    description:
      "External AI providers only ever receive approved masked text—enforced on the server, never trusted to the browser.",
    icon: ShieldCheck,
  },
  {
    title: "Fernet-encrypted vaults",
    description:
      "Per-session AES-128-CBC + HMAC-SHA256 vaults cached in memory with persistence-disabled Redis and instant wipe.",
    icon: Lock,
  },
  {
    title: "Random 6-hex placeholders",
    description:
      "Tokens like [PERSON_7f3a9b] avoid entity-count leakage while keeping exact round-trip unmasking across 100+ turns.",
    icon: KeyRound,
  },
  {
    title: "Metadata-only audit trail",
    description:
      "Logs user actions, providers, decisions, and entity counts—never raw documents, prompts, or vault mappings.",
    icon: ScrollText,
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      {/* Subtle architectural top glow driven strictly by global CSS variables */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in srgb, var(--primary) 28%, transparent), transparent 76%)",
        }}
      />

      <LandingNav />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-highlight/25 bg-accent/60 px-3.5 py-1.5 text-xs font-medium text-highlight">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Contract Privacy Gateway · Designed in respect of Law 18-07</span>
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Strong AI on sensitive contracts.{" "}
              <span className="text-highlight">Zero raw data leaves your control.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
              NYXORA sits between your company and frontier AI models. Client names, companies,
              tax IDs, emails, and internal codenames are masked locally into random tokens before
              sending—and restored deterministically when the reply returns.
            </p>

            <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-highlight px-6 text-sm font-semibold text-highlight-foreground transition-[background-color,transform] duration-150 hover:bg-highlight/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
              >
                <span>Open Workspace</span>
                <ArrowRight
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-card/80 px-6 text-sm font-medium text-foreground transition-colors hover:border-input hover:bg-secondary sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="mt-12 sm:mt-14">
            <SendGatePreview />
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-border/70 bg-sidebar/40 py-16 sm:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2.5">
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-highlight">
                How it works
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Three deterministic safeguards between your files and external models.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Every prompt and document passes through a verifiable local pipeline before any
                request touches a cloud provider.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PIPELINE_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.number}
                    className="flex flex-col justify-between rounded-surface border border-border bg-card p-6 transition-colors hover:border-input"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="grid size-10 place-items-center rounded-control border border-highlight/25 bg-accent text-highlight">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {step.number}
                        </span>
                      </div>

                      <h3 className="mt-5 text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-border pt-3.5">
                      <span className="font-mono text-[11px] text-highlight">{step.tag}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* For Teams vs Owners */}
        <section id="teams" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-2.5 text-center">
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-highlight">
                Built for real organizations
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Frictionless chat for employees. Full control for owners.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Role-separated workspaces keep daily contract review effortless while giving
                security owners complete visibility and policy control.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="flex flex-col justify-between rounded-surface border border-border bg-card p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-control border border-highlight/25 bg-accent text-highlight">
                        <MessageSquare className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          Employee Workspace
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Clean, distraction-free AI chat
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      /chat
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {TEAM_FEATURES.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/90">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-highlight"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="flex flex-col justify-between rounded-surface border border-border bg-card p-6 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-control border border-highlight/25 bg-accent text-highlight">
                        <SlidersHorizontal className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          Owner Governance
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Keys, policies, users &amp; benchmarks
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      /rules · /metrics
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {OWNER_FEATURES.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/90">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-highlight"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Security Architecture */}
        <section
          id="security"
          className="scroll-mt-20 border-t border-border/70 bg-sidebar/40 py-16 sm:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2.5">
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-highlight">
                Security architecture
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Built on verifiable engineering guarantees—not vague promises.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-surface border border-border bg-card p-5"
                  >
                    <Icon className="size-5 text-highlight" aria-hidden="true" />
                    <h3 className="mt-4 text-sm font-semibold text-foreground">{pillar.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-surface border border-border bg-card/70 px-4 py-3.5 text-xs text-muted-foreground">
              <Database className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden="true" />
              <p className="leading-relaxed">
                NYXORA is engineered to reduce personal-data exposure and keep a human in control
                in respect of Algerian Law 18-07 &amp; 25-11. It is a technical privacy gateway and
                does not constitute legal certification or legal counsel.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-surface border border-border bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 70% at 50% 100%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 75%)",
                }}
              />
              <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center">
                <p
                  className={`${duneRise.className} text-lg uppercase tracking-[0.25em] text-highlight sm:text-xl`}
                >
                  NYXORA
                </p>
                <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Think freely. Share nothing sensitive.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Sign in to your private NYXORA workspace and review your next contract safely.
                </p>
                <Link
                  href="/login"
                  className="group mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-highlight px-7 text-sm font-semibold text-highlight-foreground transition-[background-color,transform] duration-150 hover:bg-highlight/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span>Sign in to Workspace</span>
                  <ArrowRight
                    className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className={`${duneRise.className} tracking-[0.22em] text-foreground`}>
              NYXORA
            </span>
            <span>·</span>
            <span>Contract Privacy Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <span>MAKERS² 2026</span>
            <Link href="/login" className="text-foreground transition-colors hover:text-highlight">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
