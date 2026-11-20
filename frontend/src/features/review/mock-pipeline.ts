import { EntityType, Finding, FindingSource } from "@/features/review/types";

const MOCK_PATTERNS: ReadonlyArray<{
  pattern: string;
  flags: string;
  type: EntityType;
  source: FindingSource;
}> = [
  { pattern: "\\b[A-Z][a-z]+ [A-Z][a-z]+\\b", flags: "g", type: "PERSON", source: "ner" },
  {
    pattern: "\\b[A-Z][A-Za-z0-9 ]+(?:SARL|SPA|LLC|Inc\\.?|Corp\\.?)\\b",
    flags: "g",
    type: "COMPANY",
    source: "ner",
  },
  {
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    type: "EMAIL",
    source: "rule",
  },
  { pattern: "\\+?\\d[\\d\\s-]{8,15}\\d", flags: "g", type: "PHONE", source: "rule" },
  { pattern: "\\b\\d{15}\\b", flags: "g", type: "ID", source: "rule" },
  { pattern: "\\bAPOLLO-X\\b", flags: "g", type: "CUSTOM", source: "custom" },
];

function normalizeKey(type: EntityType, text: string): string {
  return `${type}::${text.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/**
 * Recompute consistent [TYPE_N] placeholders across sorted findings.
 * Identical normalized text + type pairs share the same placeholder.
 */
export function recomputePlaceholders(list: Finding[]): Finding[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const seen = new Map<string, string>();
  const counters: Record<string, number> = {};

  return sorted.map((finding) => {
    if (finding.status === "dismissed") {
      return finding;
    }
    const key = normalizeKey(finding.type, finding.text);
    const existing = seen.get(key);
    if (existing) {
      return { ...finding, placeholder: existing };
    }
    const nextIndex = (counters[finding.type] ?? 0) + 1;
    counters[finding.type] = nextIndex;
    const placeholder = `[${finding.type}_${nextIndex}]`;
    seen.set(key, placeholder);
    return { ...finding, placeholder };
  });
}

/**
 * Temporary client-side mock detector matching the Block 1 findings contract.
 * Replace with POST /sessions/{id}/messages when the backend pipeline lands.
 */
export function runMockDetection(text: string): Finding[] {
  const detected: Finding[] = [];

  for (const { pattern, flags, type, source } of MOCK_PATTERNS) {
    const regex = new RegExp(pattern, flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = detected.some((f) => start < f.end && end > f.start);
      if (!overlaps) {
        detected.push({
          id: `f_${start}_${end}`,
          type,
          text: match[0],
          start,
          end,
          source,
          confidence: 0.96,
          status: "pending",
          placeholder: `[${type}_1]`,
        });
      }
    }
  }

  return recomputePlaceholders(detected);
}

/** Build a masked string from active (non-dismissed) findings. */
export function buildMaskedText(raw: string, list: Finding[]): string {
  const active = list
    .filter((f) => f.status !== "dismissed")
    .sort((a, b) => b.start - a.start);

  let result = raw;
  for (const finding of active) {
    result = result.slice(0, finding.start) + finding.placeholder + result.slice(finding.end);
  }
  return result;
}

/**
 * Simulate sending only the masked payload to the chosen provider and unmasking locally.
 * Replace with POST /sessions/{id}/reviews/{rid}/approve when the backend send gate lands.
 */
export function simulateMaskedProvider(
  providerLabel: string,
  unmasked: string,
  masked: string,
): { assistantUnmasked: string; assistantMasked: string } {
  return {
    assistantMasked: `Summary from ${providerLabel}: Reviewed "${masked}". No blocking legal clauses detected, though confidentiality obligations apply to all named parties.`,
    assistantUnmasked: `Summary from ${providerLabel}: Reviewed "${unmasked}". No blocking legal clauses detected, though confidentiality obligations apply to all named parties.`,
  };
}
