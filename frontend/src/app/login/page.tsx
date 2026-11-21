"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NyxoraWordmark } from "@/components/nyxora/brand";
import { LiquidBackdrop } from "@/components/nyxora/liquid-backdrop";
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
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <LiquidBackdrop />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <NyxoraWordmark href="/" className="mb-8 text-2xl sm:text-3xl" />

        <Card className="nyxora-surface w-full gap-6 p-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            <CardTitle id="signin-heading" className="text-xl font-semibold text-foreground sm:text-2xl">
              Sign in
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Access your private contract workspace
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={handleSubmit} aria-labelledby="signin-heading" className="space-y-4">
              {errorMessage ? (
                <Alert
                  variant="destructive"
                  className="rounded-control border-destructive/35 bg-destructive/10 text-destructive-foreground"
                >
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription className="text-destructive-foreground">{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
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
                  className="h-11 px-3.5"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <button
                    type="button"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="cursor-pointer rounded-control px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
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
                  className="h-11 px-3.5"
                />
              </div>

              <Button
                type="submit"
                variant="highlight"
                disabled={submitting}
                className="mt-2 h-11 w-full cursor-pointer text-sm font-semibold"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
