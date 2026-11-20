"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";

const duneRise = localFont({
  src: "../../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (newMode: "signin" | "signup") => {
    setMode(newMode);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    // TODO: Connect with backend /api/auth/login or /api/auth/register
    router.push("/chat");
  };

  return (
    <main className="nyxora-animated-bg relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 text-white overflow-hidden select-none">
      {/* Logo NYXORA -> retour vers Landing Page */}
      <Link
        href="/"
        className={`${duneRise.className} text-2xl sm:text-3xl tracking-[0.25em] uppercase mb-8 drop-shadow-[0_0_20px_rgba(100,65,165,0.6)] hover:opacity-90 transition-opacity`}
      >
        NYXORA
      </Link>

      {/* Carte Glassmorphism */}
      <div className="w-full max-w-md rounded-2xl bg-black/55 backdrop-blur-xl border border-[#6441A5]/45 p-7 sm:p-8 shadow-[0_0_55px_rgba(100,65,165,0.32)]">
        {/* Switch Tabs: Sign In / Sign Up */}
        <div className="grid grid-cols-2 rounded-full bg-white/5 p-1 border border-white/10 mb-7">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.16em] transition-all duration-300 cursor-pointer ${
              mode === "signin"
                ? "bg-white text-black shadow-[0_0_20px_rgba(155,114,235,0.6)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.16em] transition-all duration-300 cursor-pointer ${
              mode === "signup"
                ? "bg-white text-black shadow-[0_0_20px_rgba(155,114,235,0.6)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Titre & Sous-titre dynamiques */}
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-[0.15em] uppercase">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1.5 tracking-wide">
            {mode === "signin"
              ? "Sign in to access your private workspace"
              : "Think freely. Share nothing sensitive."}
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name (Sign Up uniquement) */}
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Saja"
                className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#b896ff] hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
            />
          </div>

          {/* Confirm Password (Sign Up uniquement) */}
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-white/80 mb-2">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
              />
            </div>
          )}

          {/* Message d'erreur */}
          {error && (
            <p className="text-xs text-red-400 font-medium">{error}</p>
          )}

          {/* Bouton Submit */}
          <button
            type="submit"
            className="w-full mt-2 rounded-full bg-white text-black hover:bg-[#6441A5] hover:text-white font-bold text-xs sm:text-sm tracking-[0.18em] uppercase py-3.5 shadow-[0_0_25px_rgba(100,65,165,0.45)] hover:shadow-[0_0_35px_rgba(155,114,235,0.85)] transition-all duration-300 cursor-pointer"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Switch rapide en bas */}
        <p className="text-center text-xs text-white/60 mt-6">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="text-[#b896ff] font-semibold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-[#b896ff] font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}