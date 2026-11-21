import { ENTITY_COLORS, EntityType } from "@/features/review/types";

const PLACEHOLDER_SPLIT_RE = /(\[[A-Z]+_[0-9a-fA-F]{4,12}\])/g;
const PLACEHOLDER_EXACT_RE = /^\[([A-Z]+)_[0-9a-fA-F]{4,12}\]$/;

export function MaskedText({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_SPLIT_RE);
  return (
    <>
      {parts.map((part, idx) => {
        const match = PLACEHOLDER_EXACT_RE.exec(part);
        if (!match) {
          return <span key={`txt_${idx}`}>{part}</span>;
        }
        const entityType = match[1] as EntityType;
        const style = ENTITY_COLORS[entityType] ?? ENTITY_COLORS.CUSTOM;
        return (
          <span
            key={`tok_${idx}`}
            className={`mx-0.5 inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[0.78em] leading-none font-medium align-baseline ${style}`}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}
