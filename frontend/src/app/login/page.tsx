"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

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
    <main className="nyxora-unified-page-bg relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-12 text-white">
      <NyxoraWordmark href="/" className="mb-8 text-2xl sm:text-3xl" />

      <Card className="nyx-glass-features-frame w-full max-w-md gap-6 rounded-3xl border border-white/15 bg-transparent p-6 text-white ring-0 sm:p-8">
        <CardHeader className="p-0 text-center">
          <CardTitle id="signin-heading" className="text-xl font-semibold text-white sm:text-2xl">
            Sign in
          </CardTitle>
          <CardDescription className="mt-1 text-sm text-white/65">
            Access your private contract workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} aria-labelledby="signin-heading" className="space-y-4">
            {errorMessage ? (
              <Alert
                variant="destructive"
                className="rounded-2xl border-red-500/35 bg-red-500/10 text-red-200"
              >
                <AlertCircle aria-hidden="true" />
                <AlertDescription className="text-red-200">{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-white/85">
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
                className="h-11 rounded-2xl border-white/10 bg-[#222026] px-4 text-white placeholder:text-white/35 focus-visible:border-[#23969D] focus-visible:ring-[#23969D]/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-white/85">
                  Password
                </Label>
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium text-[#23969D] transition-colors duration-200 hover:text-white"
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
                className="h-11 rounded-2xl border-white/10 bg-[#222026] px-4 text-white placeholder:text-white/35 focus-visible:border-[#23969D] focus-visible:ring-[#23969D]/30"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 w-full cursor-pointer rounded-full bg-[#23969D] text-sm font-semibold text-white shadow-[0_0_20px_rgba(35,150,157,0.35)] transition-all hover:bg-[#006268]"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}