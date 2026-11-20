export type UserRole = "requester" | "reviewer" | "admin";

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
  created_at: string;
}

export interface GatewaySessionDetail extends GatewaySession {
  vault_active: boolean;
  masked_messages: MaskedMessage[];
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
