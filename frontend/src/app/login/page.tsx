"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";

const duneRise = localFont({
  src: "../../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect with backend auth endpoint
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

      {/* Carte Glassmorphism Sign In */}
      <div className="w-full max-w-md rounded-2xl bg-black/55 backdrop-blur-xl border border-[#6441A5]/45 p-7 sm:p-8 shadow-[0_0_55px_rgba(100,65,165,0.32)]">
        <div className="text-center mb-7">
          <h1 className="text-xl sm:text-2xl font-bold tracking-[0.15em] uppercase">
            Sign In
          </h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1.5 tracking-wide">
            Access your private contract workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="you@company.com"
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
              placeholder="••••••••"
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#9b72eb] focus:ring-1 focus:ring-[#9b72eb] transition-all"
            />
          </div>

          {/* Bouton Sign In */}
          <button
            type="submit"
            className="w-full mt-2 rounded-full bg-white text-black hover:bg-[#6441A5] hover:text-white font-bold text-xs sm:text-sm tracking-[0.18em] uppercase py-3.5 shadow-[0_0_25px_rgba(100,65,165,0.45)] hover:shadow-[0_0_35px_rgba(155,114,235,0.85)] transition-all duration-300 cursor-pointer"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}