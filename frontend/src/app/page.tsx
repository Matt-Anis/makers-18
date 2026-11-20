import Link from "next/link";
import localFont from "next/font/local";
import { ArrowRight } from "lucide-react";

const duneRise = localFont({
  src: "../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 text-white">
      <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
        <h1
          className={`${duneRise.className} mb-5 text-5xl uppercase tracking-[0.25em] text-white sm:text-7xl md:text-8xl`}
        >
          NYXORA
        </h1>

        <p className="mb-10 text-sm font-medium uppercase tracking-[0.18em] text-white/75 sm:text-lg md:text-xl">
          Think freely. Share nothing sensitive.
        </p>

        <Link
          href="/login"
          className="group inline-flex min-h-12 items-center gap-2.5 rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-950 transition-[background-color,transform] duration-200 ease-out hover:bg-white/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#9b82ff]"
        >
          <span>Get started</span>
          <ArrowRight
            className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  );
}
