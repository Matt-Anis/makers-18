"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

const duneRise = localFont({
  src: "../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const NAV_ITEMS = [
  { id: "how-it-works", label: "How It Works" },
  { id: "key-features", label: "Key Features" },
  { id: "providers", label: "Supported AI Providers" },
] as const;

export default function LandingPage() {
  const [activeNav, setActiveNav] = useState<string>("");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 240;
      const howEl = document.getElementById("how-it-works");
      const featEl = document.getElementById("key-features");
      const provEl = document.getElementById("providers");

      if (provEl && scrollPos >= provEl.offsetTop) {
        setActiveNav("providers");
      } else if (featEl && scrollPos >= featEl.offsetTop) {
        setActiveNav("key-features");
      } else if (howEl && scrollPos >= howEl.offsetTop) {
        setActiveNav("how-it-works");
      } else {
        setActiveNav("");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`${plusJakarta.className} ${jetbrainsMono.variable} nyxora-unified-page-bg relative min-h-screen w-full text-white select-none`}
    >
      {/* =========================================================
          NAVBAR (Transparent, clean, without About Us)
         ========================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className="max-w-[1360px] mx-auto px-6 sm:px-12 pt-5 pb-3 flex items-center justify-between">
          <div className="hidden md:block w-24" />

          <nav className="flex flex-wrap items-center justify-center gap-3 sm:gap-8 text-[13px] sm:text-[14px] font-normal text-white/90">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveNav(item.id)}
                className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                  activeNav === item.id
                    ? "nyx-nav-glass-pill text-white"
                    : "border border-transparent hover:text-[#23969D]"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center">
            <Link
              href="/login"
              className="px-6 py-1.5 rounded-full bg-[#23969D] hover:bg-[#006268] text-white text-[13px] font-medium transition-all shadow-[0_0_16px_rgba(35,150,157,0.35)]"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================
          SECTION 1: HERO
         ========================================================= */}
      <section className="relative min-h-screen w-full flex flex-col items-center justify-center text-center px-6 pt-12">
        <h1
          className={`${duneRise.className} text-4xl sm:text-6xl lg:text-[74px] font-normal tracking-[0.28em] uppercase text-white leading-none mr-[-0.28em]`}
        >
          NYXORA
        </h1>

        <p className="mt-5 text-[11px] sm:text-[13px] lg:text-[15px] font-medium tracking-[0.24em] uppercase text-white/90 mr-[-0.24em]">
          THINK FREELY. SHARE NOTHING SENSITIVE
        </p>

        <Link
          href="/login"
          className="mt-10 px-6 py-2.5 rounded-full bg-[#23969D]/25 hover:bg-[#23969D]/45 border border-[#23969D]/60 inline-flex items-center justify-center gap-2 text-[12px] font-medium tracking-[0.14em] uppercase text-white backdrop-blur-md transition-all"
        >
          <span>→</span>
          <span>GET STARTED</span>
        </Link>
      </section>

      {/* =========================================================
          SECTION 2: HOW IT WORKS ("Privacy Behind Every Prompt.")
         ========================================================= */}
      <section id="how-it-works" className="relative w-full py-20 px-6">
        <div className="max-w-[1000px] mx-auto space-y-6">
          {/* TOP GLASS FRAME: 4 Pipeline Steps */}
          <div className="nyx-glass-top-frame rounded-[24px] p-7 sm:p-10">
            <div className="text-center max-w-lg mx-auto mb-9">
              <span
                className={`${jetbrainsMono.className} text-[10px] font-semibold uppercase tracking-[0.24em] text-[#67e8f9]/85`}
              >
                ENGINE LIFECYCLE
              </span>
              <h2 className="text-2xl sm:text-[32px] font-bold text-white mt-1.5 tracking-tight leading-tight">
                Privacy Behind Every Prompt.
              </h2>
              <p className="text-xs sm:text-[13px] text-white/60 mt-2 leading-relaxed">
                Your data goes through a controlled privacy workflow before reaching
                <br className="hidden sm:inline" /> external AI models.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* STEP 01 */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col justify-between min-h-[240px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M4 7h6M4 11h4M4 15h5" />
                      <circle cx="15" cy="13" r="3" />
                      <path strokeLinecap="round" d="M17.5 15.5L20 18" />
                    </svg>
                  </div>
                  <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px] mb-1.5`}>
                    <span className="text-[#c4b5fd]/90">STEP 01</span>
                    <span className="text-white/40">Real-Time</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">Detect</h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Identify sensitive information using contextual AI detection and configurable rules.
                  </p>
                </div>
                <div className={`${jetbrainsMono.className} flex flex-wrap gap-1.5`}>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Multilingual NER
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Regex
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Rule Engine
                  </span>
                </div>
              </div>

              {/* STEP 02 */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col justify-between min-h-[240px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <circle cx="8" cy="12" r="3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 12h9m-3 0v2.5m3-2.5v2" />
                    </svg>
                  </div>
                  <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px] mb-1.5`}>
                    <span className="text-[#c4b5fd]/90">STEP 02</span>
                    <span className="text-white/40">Deterministic</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">Mask</h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Replace confidential information with consistent, typed placeholders while preserving context.
                  </p>
                </div>
                <div className={`${jetbrainsMono.className} flex flex-wrap gap-1.5`}>
                  <span className="px-2 py-0.5 rounded bg-[#00484d] border border-[#23969D]/30 text-[9px] text-[#5eead4]">
                    [PARTY_A]
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    In-memory Vault
                  </span>
                </div>
              </div>

              {/* STEP 03 */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col justify-between min-h-[240px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="2.5" />
                      <circle cx="12" cy="5" r="1.2" />
                      <circle cx="12" cy="19" r="1.2" />
                      <circle cx="5" cy="12" r="1.2" />
                      <circle cx="19" cy="12" r="1.2" />
                      <path strokeLinecap="round" d="M12 7.5v2M12 14.5v2M7.5 12h2M14.5 12h2" />
                    </svg>
                  </div>
                  <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px] mb-1.5`}>
                    <span className="text-[#c4b5fd]/90">STEP 03</span>
                    <span className="text-white/40">Zero Retention</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">Process</h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Send only approved, masked content to your selected external AI provider.
                  </p>
                </div>
                <div className={`${jetbrainsMono.className} flex flex-wrap gap-1.5`}>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    TLS 1.3
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Zero-Egress
                  </span>
                </div>
              </div>

              {/* STEP 04 */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col justify-between min-h-[240px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0114.93-4M20 4v4h-4M20 12a8 8 0 01-14.93 4M4 20v-4h4" />
                    </svg>
                  </div>
                  <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px] mb-1.5`}>
                    <span className="text-[#c4b5fd]/90">STEP 04</span>
                    <span className="text-white/40">Browser Side</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">Restore</h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Restore original values locally in the returned response.
                  </p>
                </div>
                <div className={`${jetbrainsMono.className} flex flex-wrap gap-1.5`}>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Client AES-256
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75">
                    Zero Cloud Storage
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM GLASS FRAME: Live Encapsulation Terminal */}
          <div className="nyx-glass-bottom-frame rounded-[24px] p-6 sm:p-10">
            <div className="nyx-charcoal-card max-w-[710px] mx-auto rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className={`${jetbrainsMono.className} ml-2 text-[10px] text-white/45`}>
                    session_live://enc-pipe-0x92f
                  </span>
                </div>

                <span className={`${jetbrainsMono.className} px-2.5 py-1 rounded bg-white/[0.04] border border-white/10 text-[9.5px] text-white/80 inline-flex items-center gap-1.5`}>
                  <span className="text-[#c4b5fd]">🛡</span>
                  <span>Local Vault Active (E2EE)</span>
                </span>
              </div>

              <div className="rounded-xl bg-[#27252c] border border-white/[0.05] p-4 space-y-2.5">
                <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px]`}>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/85">
                      Step 01 • Origin
                    </span>
                    <span className="text-white/45">Internal Workspace Input</span>
                  </div>
                  <span className="text-white/35">00:00:00.001</span>
                </div>

                <p className="text-[12px] text-white/85 leading-relaxed">
                  The contract between{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#4a1c1c] text-[#fca5a5] text-[10.5px]`}>
                    Acme Algeria
                  </span>{" "}
                  and{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#322947] text-[#d8b4fe] text-[10.5px]`}>
                    Karim B.
                  </span>{" "}
                  involves a payment of{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#00484d] text-[#5eead4] text-[10.5px]`}>
                    450,000 DZD
                  </span>{" "}
                  .
                </p>
              </div>

              <div className="relative flex items-center justify-center py-0.5">
                <div className="absolute inset-x-0 h-px bg-white/[0.06]" />
                <span className={`${jetbrainsMono.className} relative z-10 px-3.5 py-1 rounded-full bg-[#222026] border border-white/10 text-[9.5px] text-white/65`}>
                  ↻ Local Deterministic Masking Engine (Keystore Sealed in Browser AES-256)
                </span>
              </div>

              <div className="rounded-xl bg-[#27252c] border border-white/[0.05] p-4 space-y-2.5">
                <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px]`}>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#006268] text-[#67e8f9]">
                      Step 02 • Outbound Egress
                    </span>
                    <span className="text-white/45">Frontier Model API (Cloud Sanitized)</span>
                  </div>
                  <span className="text-[#c4b5fd]/75">Zero Plaintext Leakage</span>
                </div>

                <p className="text-[12px] text-white/85 leading-relaxed">
                  The contract between{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#00484d] text-[#5eead4] text-[10.5px]`}>
                    [PARTY_A]
                  </span>{" "}
                  and{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#00484d] text-[#5eead4] text-[10.5px]`}>
                    [PERSON_1]
                  </span>{" "}
                  involves a payment of{" "}
                  <span className={`${jetbrainsMono.className} px-1.5 py-0.5 rounded bg-[#00484d] text-[#5eead4] text-[10.5px]`}>
                    [AMOUNT_1]
                  </span>{" "}
                  .
                </p>
              </div>

              <div className="relative flex items-center justify-center py-0.5">
                <div className="absolute inset-x-0 h-px bg-white/[0.06]" />
                <span className={`${jetbrainsMono.className} relative z-10 px-3.5 py-1 rounded-full bg-[#222026] border border-white/10 text-[9.5px] text-white/65`}>
                  ↺ Client-Side Zero-Latency Local Restoration (8ms)
                </span>
              </div>

              <div className="rounded-xl bg-[#27252c] border border-white/[0.05] p-4 space-y-2.5">
                <div className={`${jetbrainsMono.className} flex items-center justify-between text-[9.5px]`}>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#006268] text-[#67e8f9]">
                      Step 03 • Secure AI Output
                    </span>
                    <span className="text-[#c4b5fd]/80">Restored in Sovereign Memory</span>
                  </div>
                  <span className="text-white/80">✓ Context Perfect</span>
                </div>

                <p className="text-[12px] text-white/85 leading-relaxed">
                  Analysis verified: Clause 4.2 governing payment obligations between{" "}
                  <strong className="text-white font-semibold">Acme Algeria</strong> and{" "}
                  <strong className="text-white font-semibold">Karim B.</strong> adheres to
                  Algerian commercial statute, with{" "}
                  <strong className="text-white font-semibold">450,000 DZD</strong> escrow terms
                  validated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 3: KEY FEATURES ("Powerful AI. Your Data. Your Control.")
         ========================================================= */}
      <section id="key-features" className="relative w-full py-20 px-6">
        <div className="max-w-[1000px] mx-auto">
          <div className="nyx-glass-features-frame rounded-[24px] p-7 sm:p-10">
            <div className="text-center max-w-lg mx-auto mb-9">
              <span
                className={`${jetbrainsMono.className} text-[10px] font-semibold uppercase tracking-[0.24em] text-[#67e8f9]/85`}
              >
                DEFENSE IN DEPTH
              </span>
              <h2 className="text-2xl sm:text-[32px] font-bold text-white mt-1.5 tracking-tight leading-tight">
                Powerful AI. Your Data. Your Control.
              </h2>
              <p className="text-xs sm:text-[13px] text-white/60 mt-2 leading-relaxed">
                Everything you need to use advanced AI while maintaining control over
                <br className="hidden sm:inline" /> sensitive information.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Intelligent Detection */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Intelligent Detection
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Identify sensitive entities through contextual AI detection, custom rules, and multiple detection methods.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    <span className="text-[#c4b5fd]">✦</span>
                    <span>NER + Heuristics</span>
                  </span>
                </div>
              </div>

              {/* 2. Smart Masking */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Smart Masking
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Replace sensitive values with consistent placeholders without losing the context needed for AI reasoning.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    <span className="text-[#c4b5fd]">⇄</span>
                    <span>[PARTY_A] ↔ [PARTY_A]</span>
                  </span>
                </div>
              </div>

              {/* 3. Human Approval */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Human Approval
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Review detected information, correct findings, and approve content before external transmission.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23969D]" />
                    <span>Approved / Dismissed Switch</span>
                  </span>
                </div>
              </div>

              {/* 4. Local Restoration */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Local Restoration
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Restore original information locally while keeping the external model&apos;s view anonymized.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    <span className="text-[#c4b5fd]">↺</span>
                    <span>&lt;12ms local swap</span>
                  </span>
                </div>
              </div>

              {/* 5. Multi-Model Freedom */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Multi-Model Freedom
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Work with supported external AI providers through a unified privacy layer.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-block px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    OpenAI, Anthropic, Gemini, OSS
                  </span>
                </div>
              </div>

              {/* 6. Transparent Auditing */}
              <div className="nyx-charcoal-card rounded-2xl p-6 flex flex-col justify-between min-h-[210px]">
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">
                    Transparent Auditing
                  </h3>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-5">
                    Track processing activities, policy decisions, and security events through metadata-based audit logs.
                  </p>
                </div>
                <div>
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/80`}
                  >
                    <span className="text-[#c4b5fd]">🔒</span>
                    <span>.json.sig cryptographic receipt</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 4: SUPPORTED AI PROVIDERS ("One Privacy Layer. Multiple AI Models.")
         ========================================================= */}
      <section id="providers" className="relative w-full pt-12 pb-28 px-6">
        <div className="max-w-[1000px] mx-auto">
          <div className="nyx-glass-features-frame rounded-[24px] p-7 sm:p-10">
            <div className="text-center max-w-xl mx-auto mb-9">
              <span
                className={`${jetbrainsMono.className} text-[10px] font-semibold uppercase tracking-[0.24em] text-[#67e8f9]/85`}
              >
                INTEROPERABLE SOVEREIGNTY
              </span>
              <h2 className="text-2xl sm:text-[32px] font-bold text-white mt-1.5 tracking-tight leading-tight">
                One Privacy Layer. Multiple AI Models.
              </h2>
              <p className="text-xs sm:text-[13px] text-white/60 mt-2 leading-relaxed">
                Connect with your preferred AI providers through one unified interface.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. OpenAI */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col items-center text-center justify-between min-h-[185px]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">OpenAI</h3>
                  <p className="text-[11px] text-white/45 mt-1">GPT-4o / GPT-5</p>
                </div>
                <div className="mt-4">
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23969D]" />
                    <span>Frontier Proxied</span>
                  </span>
                </div>
              </div>

              {/* 2. Anthropic */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col items-center text-center justify-between min-h-[185px]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 3A4.5 4.5 0 005 7.5c0 .75.18 1.45.5 2.08A4 4 0 004 13a4 4 0 002.2 3.57A3.5 3.5 0 009.5 21H12V3H9.5zm5 0A4.5 4.5 0 0119 7.5c0 .75-.18 1.45-.5 2.08A4 4 0 0120 13a4 4 0 01-2.2 3.57A3.5 3.5 0 0114.5 21H12V3h2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">Anthropic</h3>
                  <p className="text-[11px] text-white/45 mt-1">Claude 3.5 Sonnet</p>
                </div>
                <div className="mt-4">
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23969D]" />
                    <span>Zero-Knowledge</span>
                  </span>
                </div>
              </div>

              {/* 3. Google */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col items-center text-center justify-between min-h-[185px]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">Google</h3>
                  <p className="text-[11px] text-white/45 mt-1">Gemini 1.5 Pro</p>
                </div>
                <div className="mt-4">
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23969D]" />
                    <span>API Gateway</span>
                  </span>
                </div>
              </div>

              {/* 4. Mistral */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col items-center text-center justify-between min-h-[185px]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">Mistral</h3>
                  <p className="text-[11px] text-white/45 mt-1">Mistral Large 2</p>
                </div>
                <div className="mt-4">
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23969D]" />
                    <span>EU Sovereignty</span>
                  </span>
                </div>
              </div>

              {/* 5. Private Enclaves */}
              <div className="nyx-charcoal-card rounded-2xl p-5 flex flex-col items-center text-center justify-between min-h-[185px]">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#c4b5fd] mb-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white">Private Enclaves</h3>
                  <p className="text-[11px] text-white/45 mt-1">Qwen / Llama 3</p>
                </div>
                <div className="mt-4">
                  <span
                    className={`${jetbrainsMono.className} inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18171c] border border-white/[0.06] text-[9px] text-white/75`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]" />
                    <span>Air-Gapped Node</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 flex justify-center">
              <div className="nyx-charcoal-card rounded-xl px-5 py-3 inline-flex items-center gap-2.5 text-[11.5px] text-white/65 max-w-2xl">
                <span className="text-[#c4b5fd] shrink-0">🛡</span>
                <span>
                  <strong className="text-white font-semibold">Provider Agnostic Architecture:</strong>{" "}
                  Your credentials and local mapping vault stay exclusively in your sovereign infrastructure.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}