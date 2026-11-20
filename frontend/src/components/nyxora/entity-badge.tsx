import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ENTITY_STYLES: Record<string, string> = {
  PERSON: "border-cyan-400/50 bg-cyan-500/20 text-cyan-200",
  ORG: "border-violet-400/50 bg-violet-500/25 text-violet-200",
  EMAIL: "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
  PHONE: "border-amber-400/50 bg-amber-500/20 text-amber-200",
  ADDRESS: "border-sky-400/50 bg-sky-500/20 text-sky-200",
  ID_NUMBER: "border-rose-400/50 bg-rose-500/20 text-rose-200",
  BANK: "border-orange-400/50 bg-orange-500/20 text-orange-200",
  CUSTOM: "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200",
};

export function EntityBadge({
  entityType,
  className,
}: {
  entityType: string;
  className?: string;
}) {
  const key = entityType.trim().toUpperCase();
  const palette = ENTITY_STYLES[key] ?? "border-white/25 bg-white/10 text-white/85";

  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[11px] uppercase tracking-wider", palette, className)}
    >
      {key}
    </Badge>
  );
}
