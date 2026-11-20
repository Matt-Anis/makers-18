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
        "uppercase tracking-[0.22em] text-white transition-opacity duration-150 ease-out hover:opacity-80",
        className,
      )}
    >
      NYXORA
    </Link>
  );
}
