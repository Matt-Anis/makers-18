import Link from "next/link";
import localFont from "next/font/local";

const duneRise = localFont({
  src: "../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export default function LandingPage() {
  return (
    <main className="nyxora-animated-bg relative overflow-hidden min-h-screen w-full flex flex-col items-center justify-center px-4 text-white select-none">
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl">
        {/* Titre NYXORA */}
        <h1
          className={`${duneRise.className} text-5xl sm:text-7xl md:text-8xl tracking-[0.25em] uppercase mb-6 drop-shadow-[0_0_25px_rgba(100,65,165,0.45)]`}
        >
          NYXORA
        </h1>

        {/* Sous-titre */}
        <p className="font-bold text-sm sm:text-xl md:text-[26px] tracking-[0.2em] uppercase text-white/95 mb-14">
          THINK FREELY. SHARE NOTHING SENSITIVE
        </p>

        {/* Bouton GET STARTED sans cercle autour de la flèche */}
        <Link
          href="/login"
          className="group relative inline-flex items-center justify-center p-[2px] rounded-full overflow-hidden shadow-[0_0_30px_rgba(100,65,165,0.55)] hover:shadow-[0_0_45px_rgba(155,114,235,0.9)] hover:scale-105 active:scale-95 transition-all duration-300"
        >
          {/* Bordure lumineuse qui tourne */}
          <span
            className="nyxora-btn-border pointer-events-none absolute inset-[-150%]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, #6441A5 35%, #ffffff 50%, #6441A5 65%, transparent 100%)",
            }}
          />

          {/* Intérieur du bouton */}
          <span className="relative z-10 inline-flex items-center gap-3 bg-white text-black group-hover:bg-[#0d0817] group-hover:text-white font-bold text-xs sm:text-sm tracking-[0.18em] uppercase px-8 py-4 rounded-full overflow-hidden transition-colors duration-300">
            {/* Reflet lumineux (shimmer) */}
            <span className="nyxora-btn-shimmer pointer-events-none absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-[#6441A5]/30 to-transparent" />

            {/* Flèche simple sans cercle */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="relative z-10 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>

            {/* Texte */}
            <span className="relative z-10">GET STARTED</span>
          </span>
        </Link>
      </div>
    </main>
  );
}
