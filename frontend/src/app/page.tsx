import type { Metadata } from "next";
import Link from "next/link";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { GatewayDiagram } from "@/components/nyxora/gateway-diagram";
import { LandingNav } from "@/components/nyxora/landing-nav";
import { SendGatePreview } from "@/components/nyxora/send-gate-preview";

export const metadata: Metadata = {
  title: "NYXORA | Contract Privacy Gateway",
  description:
    "Review contracts with external AI. NYXORA masks sensitive details, lets you review what goes out, and restores names in your workspace.",
};

const RULEBOOK = [
  { term: "Project Halcyon", type: "Custom term" },
  { term: "Corvid Health", type: "Company" },
  { term: "FR76 •••• •••• ••••", type: "Bank account" },
] as const;

const AUDIT_LOG = [
  { time: "11:04", user: "lena.rao", action: "approved send", entities: "4", provider: "OpenAI" },
  { time: "11:03", user: "lena.rao", action: "review opened", entities: "4", provider: "—" },
  { time: "10:47", user: "omar.b", action: "vault wiped", entities: "—", provider: "—" },
] as const;

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12";

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <LandingNav />

      <main>
        <section aria-labelledby="landing-title" className="border-b border-border">
          <div className={`${container} grid gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:pt-24 lg:pb-28`}>
            <div className="max-w-xl">
              <h1
                id="landing-title"
                className="font-serif text-[clamp(2.6rem,5.6vw,4.4rem)] leading-[1.04] font-normal tracking-[-0.02em] text-balance"
              >
                Ask AI about the contract. <em>Leave the names out.</em>
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
                NYXORA swaps names, companies and IDs for placeholders on your own server before a prompt reaches an
                external AI model. You see exactly what leaves, and the answer comes back with the real names in place.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center rounded-md bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-highlight"
                >
                  Open workspace
                </Link>
                <a
                  href="#how-it-works"
                  className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-highlight"
                >
                  How it works
                </a>
              </div>
            </div>

            <SendGatePreview />
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="workflow-title" className="scroll-mt-16 border-b border-border">
          <div className={`${container} py-20 lg:py-24`}>
            <h2 id="workflow-title" className="max-w-2xl font-serif text-3xl leading-tight tracking-[-0.01em] sm:text-4xl">
              What happens to a prompt, step by step.
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
              Pick a step to see how your data is protected there, and what your team gets out of it.
            </p>
            <div className="mt-12">
              <GatewayDiagram />
            </div>
          </div>
        </section>

        <div className={`${container} grid gap-16 py-20 md:grid-cols-2 md:gap-12 lg:gap-20 lg:py-24`}>
          <section id="teams" aria-labelledby="teams-title" className="scroll-mt-16">
            <h2 id="teams-title" className="font-serif text-2xl tracking-[-0.01em] sm:text-3xl">
              Your rules, set once for the team.
            </h2>
            <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
              Workspace owners pick which models are available, add the terms that must never leave, and decide whether
              teammates can skip manual review.
            </p>
            <div className="mt-8 rounded-md border border-border">
              <p className="flex justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span>Workspace rulebook</span>
                <span>Owner only</span>
              </p>
              <dl className="divide-y divide-border text-sm">
                {RULEBOOK.map((rule) => (
                  <div key={rule.term} className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="font-mono text-[0.8rem]">{rule.term}</dt>
                    <dd className="text-muted-foreground">{rule.type}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section id="security" aria-labelledby="security-title" className="scroll-mt-16">
            <h2 id="security-title" className="font-serif text-2xl tracking-[-0.01em] sm:text-3xl">
              A record of actions, not of words.
            </h2>
            <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
              The audit log keeps who did what and when. Prompts, replies and vault contents are never written to it, and
              ending a conversation wipes its vault.
            </p>
            <div className="mt-8 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[26rem] text-left font-mono text-[0.8rem]">
                <caption className="border-b border-border px-4 py-2.5 text-left font-sans text-xs text-muted-foreground">
                  Audit log · metadata only
                </caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entities</th>
                    <th scope="col">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {AUDIT_LOG.map((row) => (
                    <tr key={`${row.time}-${row.action}`} className="[&>td]:px-4 [&>td]:py-3">
                      <td className="text-muted-foreground">{row.time}</td>
                      <td>{row.user}</td>
                      <td>{row.action}</td>
                      <td className="text-muted-foreground">{row.entities}</td>
                      <td className="text-muted-foreground">{row.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className={`${container} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted-foreground`}>
          <div className="flex items-center gap-4">
            <NyxoraWordmark className="text-xs" />
            <span>Built for MAKERS² 2026</span>
          </div>
          <p>Reduces what external AI sees. Not a legal compliance certification.</p>
        </div>
      </footer>
    </div>
  );
}
