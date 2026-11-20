"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Requester (Anis)", email: "requester@acme.local", password: "demo-requester-pass" },
  { label: "Reviewer (Samira)", email: "reviewer@acme.local", password: "demo-reviewer-pass" },
  { label: "Admin", email: "admin@acme.local", password: "demo-admin-pass" },
] as const;

const SHOW_DEMO_QUICKFILL = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      router.replace("/chat");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to sign in right now. Please try again.");
      }
      emailRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="nyxora-animated-bg relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-12 text-white">
      <NyxoraWordmark href="/" className="mb-8 text-2xl sm:text-3xl" />

      <Card className="nyxora-glass w-full max-w-md rounded-2xl border p-2 text-white ring-0">
        <CardHeader className="pt-5 text-center">
          <CardTitle
            id="signin-heading"
            className="text-xl font-bold uppercase tracking-[0.15em] text-white sm:text-2xl"
          >
            Sign In
          </CardTitle>
          <CardDescription className="text-xs tracking-wide text-white/60 sm:text-sm">
            Access your private contract workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} aria-labelledby="signin-heading" className="space-y-5">
            <div
              role="status"
              aria-live="polite"
              className={
                errorMessage
                  ? "rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-2.5 text-xs text-red-200 sm:text-sm"
                  : "sr-only"
              }
            >
              {errorMessage ?? ""}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-[0.15em] text-white/80"
              >
                Email
              </Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="none"
                enterKeyHint="next"
                required
                aria-invalid={Boolean(errorMessage)}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="you@company.com"
                className="min-h-12 rounded-xl border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-white/35 focus-visible:border-[#9b72eb] focus-visible:ring-[#9b72eb]/40"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-[0.15em] text-white/80"
                >
                  Password
                </Label>
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="cursor-pointer text-xs text-[#b896ff] transition-colors hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                minLength={8}
                aria-invalid={Boolean(errorMessage)}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••"
                className="min-h-12 rounded-xl border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-white/35 focus-visible:border-[#9b72eb] focus-visible:ring-[#9b72eb]/40"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 min-h-12 w-full cursor-pointer rounded-full bg-white text-xs font-bold uppercase tracking-[0.18em] text-black shadow-[0_0_25px_rgba(100,65,165,0.45)] transition-all duration-300 hover:bg-[#6441A5] hover:text-white hover:shadow-[0_0_35px_rgba(155,114,235,0.85)] sm:text-sm"
            >
              {submitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {SHOW_DEMO_QUICKFILL ? (
            <section aria-label="Demo accounts" className="mt-6 space-y-3">
              <Separator className="bg-white/10" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
                Demo quick-fill
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setErrorMessage(null);
                    }}
                    className="min-h-9 cursor-pointer rounded-full border-[#6441A5]/45 bg-white/5 px-3.5 text-xs text-white/85 hover:border-[#9b72eb] hover:bg-[#6441A5]/25"
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
