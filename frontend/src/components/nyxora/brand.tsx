import Link from "next/link";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const duneRise = localFont({
  src: "../../../dune_rise/Dune_Rise.ttf",
  display: "swap",
});

export function NyxoraWordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        duneRise.className,
        "tracking-[0.25em] uppercase text-white drop-shadow-[0_0_20px_rgba(100,65,165,0.6)] transition-opacity hover:opacity-90",
        className,
      )}
    >
      NYXORA
    </Link>
  );
}
