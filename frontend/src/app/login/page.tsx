"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Requester (Anis)", email: "requester@acme.local", password: "demo-requester-pass" },
  { label: "Reviewer (Samira)", email: "reviewer@acme.local", password: "demo-reviewer-pass" },
  { label: "Admin", email: "admin@acme.local", password: "demo-admin-pass" },
] as const;

const SHOW_DEMO_QUICKFILL = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
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
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      router.replace("/");
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
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Contract Privacy Gateway
        </p>
        <h1 id="signin-heading" className="mt-1 text-2xl font-semibold text-slate-900">
          Sign in to your workspace
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Access is restricted to provisioned company accounts. Each review session keeps its
          encrypted redaction vault isolated to your account.
        </p>

        <form
          onSubmit={handleSubmit}
          aria-labelledby="signin-heading"
          className="mt-6 space-y-5"
        >
          <div
            role="status"
            aria-live="polite"
            className={
              errorMessage
                ? "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                : "sr-only"
            }
          >
            {errorMessage ?? ""}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-800">
              Work email
            </label>
            <input
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
              onChange={(event) => {
                setEmail(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="min-h-12 w-full rounded-lg border border-slate-400 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-800">
              Password
            </label>
            <div className="flex items-stretch gap-2">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                aria-invalid={Boolean(errorMessage)}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="min-h-12 w-full rounded-lg border border-slate-400 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="min-h-12 shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-base font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {SHOW_DEMO_QUICKFILL ? (
          <section aria-label="Demo accounts" className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Demo quick-fill
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setErrorMessage(null);
                  }}
                  className="min-h-10 rounded-md border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
