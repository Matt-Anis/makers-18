export const ENTITY_TYPES = [
  "PERSON",
  "COMPANY",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "ID",
  "BANK",
  "CUSTOM",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type FindingSource = "vault" | "rule" | "ner" | "pii-model" | "llm" | "custom";

export interface Finding {
  id: string;
  type: EntityType;
  text: string;
  start: number;
  end: number;
  source: FindingSource;
  confidence: number;
  placeholder: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  unmaskedText: string;
  maskedText: string;
  modelLabel?: string;
}

export const ENTITY_COLORS: Record<EntityType, string> = {
  PERSON: "bg-purple-500/30 border-purple-400 text-purple-200",
  COMPANY: "bg-blue-500/30 border-blue-400 text-blue-200",
  EMAIL: "bg-emerald-500/30 border-emerald-400 text-emerald-200",
  PHONE: "bg-amber-500/30 border-amber-400 text-amber-200",
  ADDRESS: "bg-pink-500/30 border-pink-400 text-pink-200",
  ID: "bg-red-500/30 border-red-400 text-red-200",
  BANK: "bg-cyan-500/30 border-cyan-400 text-cyan-200",
  CUSTOM: "bg-fuchsia-500/30 border-fuchsia-400 text-fuchsia-200",
};

export const SAMPLE_CONTRACT =
  "SERVICE AGREEMENT between Atlas Tech SARL (Tax ID: 001928374650123) and Karim Benali, residing at 14 Rue Didouche Mourad, Algiers. Contact: karim.benali@atlastech.dz | Phone: +213 550 12 34 56. Project codename: APOLLO-X.";
