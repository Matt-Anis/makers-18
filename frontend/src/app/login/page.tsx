"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

const duneRise = localFont({
  src: "../../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

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
    <main className="nyxora-animated-bg relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 text-white overflow-hidden">
      {/* Logo NYXORA -> retour vers Landing Page */}
      <Link
        href="/"
        className={`${duneRise.className} text-2xl sm:text-3xl tracking-[0.25em] uppercase mb-8 drop-shadow-[0_0_20px_rgba(100,65,165,0.6)] hover:opacity-90 transition-opacity`}
      >
        NYXORA
      </Link>

      {/* Carte Glassmorphism Sign In */}
      <div className="w-full max-w-md rounded-2xl bg-black/55 backdrop-blur-xl border border-[#6441A5]/45 p-7 sm:p-8 shadow-[0_0_55px_rgba(100,65,165,0.32)]">
        <div className="text-center mb-7">
          <h1 id="signin-heading" className="text-xl sm:text-2xl font-bold tracking-[0.15em] uppercase">
            Sign In
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1.5 tracking-wide">
            Access your private contract workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} aria-labelledby="signin-heading" className="space-y-5">
          <div
            role="status"
            aria-live="polite"
            className={
              errorMessage
                ? "rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-2.5 text-xs sm:text-sm text-red-200"
                : "sr-only"
            }
          >
            {errorMessage ?? ""}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80 mb-2"
            >
              Email
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="you@company.com"
              className="w-full min-h-12 rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-base text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80"
              >
                Password
              </label>
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs text-[#b896ff] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
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
              className="w-full min-h-12 rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-base text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
            />
          </div>

          {/* Bouton Sign In */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-12 mt-2 rounded-full bg-white text-black hover:bg-[#6441A5] hover:text-white font-bold text-xs sm:text-sm tracking-[0.18em] uppercase py-3.5 shadow-[0_0_25px_rgba(100,65,165,0.45)] hover:shadow-[0_0_35px_rgba(155,114,235,0.85)] transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {SHOW_DEMO_QUICKFILL ? (
          <section aria-label="Demo accounts" className="mt-6 border-t border-white/10 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Demo quick-fill
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setErrorMessage(null);
                  }}
                  className="min-h-10 rounded-full border border-[#6441A5]/45 bg-white/5 px-3.5 text-xs font-medium text-white/85 hover:border-[#9b72eb] hover:bg-[#6441A5]/25 transition-colors cursor-pointer"
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
