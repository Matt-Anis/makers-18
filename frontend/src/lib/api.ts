export type UserRole = "owner" | "user";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface GatewaySession {
  id: string;
  owner_user_id: string;
  title: string;
  provider: string;
  status: "active" | "ended";
  created_at: string;
  updated_at: string;
  expires_at: string;
  ended_at: string | null;
}

export interface MaskedMessage {
  id: string;
  role: string;
  masked_content: string;
  unmasked_content: string;
  created_at: string;
}

export interface FindingOut {
  id: string;
  type: string;
  text: string;
  start: number;
  end: number;
  source: string;
  confidence: number;
  placeholder: string;
}

export interface PendingReviewOut {
  review_id: string;
  provider: string;
  model: string;
  thinking_effort: "low" | "medium" | "high";
  raw_text: string;
  findings: FindingOut[];
  masked_preview: string;
  created_at: string;
}

export interface GatewaySessionDetail extends GatewaySession {
  vault_active: boolean;
  masked_messages: MaskedMessage[];
  pending_review: PendingReviewOut | null;
}

export interface SendMessageResponse {
  status: "needs_review" | "sent";
  review_id: string | null;
  provider: string;
  model: string;
  thinking_effort: "low" | "medium" | "high";
  findings: FindingOut[];
  masked_preview: string | null;
  user_message: MaskedMessage | null;
  assistant_message: MaskedMessage | null;
}

export interface ReviewRejectResponse {
  status: "rejected";
  review_id: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  gateway_session_id: string | null;
  action: string;
  provider: string | null;
  approved: boolean | null;
  entity_counts: Record<string, number> | null;
  created_at: string;
}

export interface ProviderConfigOut {
  provider: string;
  label: string;
  requires_api_key: boolean;
  is_configured: boolean;
  key_hint: string | null;
  base_url: string | null;
  enabled: boolean;
  enabled_models: string[];
  updated_at: string | null;
}

export interface DiscoveredModel {
  provider: string;
  provider_label: string;
  model_id: string;
  display_name: string;
  supports_thinking: boolean;
  thinking_efforts: string[];
}

export interface ProviderDiscoveryResult {
  provider: string;
  source: "live" | "fallback";
  models: DiscoveredModel[];
}

export interface ModelDiscoveryResponse {
  models: DiscoveredModel[];
  allow_auto_review: boolean;
  default_review_mode: "manual" | "auto";
  default_provider: string | NoneOrString;
  default_model: string | NoneOrString;
  default_thinking_effort: "low" | "medium" | "high";
}

type NoneOrString = null;

export interface WorkspaceSettings {
  allow_auto_review: boolean;
  default_review_mode: "manual" | "auto";
  default_provider: string | null;
  default_model: string | null;
  default_thinking_effort: "low" | "medium" | "high";
  rulebook_prompt: string;
  gpu_llm_enabled: boolean;
  gpu_llm_endpoint: string | null;
  gpu_llm_model: string | null;
  gpu_llm_key_configured: boolean;
  gpu_llm_key_hint: string | null;
  updated_at: string;
}

export interface CustomRule {
  id: string;
  pattern: string;
  entity_type: string;
  is_regex: boolean;
  enabled: boolean;
  created_at: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore non-JSON error payloads.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}
