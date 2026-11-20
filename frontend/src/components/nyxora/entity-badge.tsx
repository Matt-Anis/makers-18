import { Badge } from "@/components/ui/badge";
import { ENTITY_COLORS, EntityType } from "@/features/review/types";
import { cn } from "@/lib/utils";

export function EntityBadge({
  entityType,
  className,
}: {
  entityType: string;
  className?: string;
}) {
  const key = entityType.trim().toUpperCase() as EntityType;
  const palette = ENTITY_COLORS[key] ?? "border-white/25 bg-white/10 text-white/85";

  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[11px] uppercase tracking-wider", palette, className)}
    >
      {key}
    </Badge>
  );
}
