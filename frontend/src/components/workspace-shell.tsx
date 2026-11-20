"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  apiFetch,
  AuditLogEntry,
  GatewaySession,
  GatewaySessionDetail,
} from "@/lib/api";

const PROVIDERS = ["anthropic", "openai", "mistral", "mock"] as const;

export function WorkspaceShell() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<GatewaySessionDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [title, setTitle] = useState("Supplier NDA review");
  const [provider, setProvider] = useState<string>("anthropic");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    const owned = await apiFetch<GatewaySession[]>("/sessions");
    setSessions(owned);

    if (user.role === "admin") {
      try {
        const logs = await apiFetch<AuditLogEntry[]>("/audit?limit=10");
        setAuditLogs(logs);
      } catch {
        setAuditLogs([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!user) return;

    let active = true;
    const isAdmin = user.role === "admin";
    Promise.all([
      apiFetch<GatewaySession[]>("/sessions"),
      isAdmin
        ? apiFetch<AuditLogEntry[]>("/audit?limit=10").catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([owned, logs]) => {
        if (!active) return;
        setSessions(owned);
        setAuditLogs(logs);
      })
      .catch(() => {
        if (active) setStatusMessage("Could not load sessions.");
      });

    return () => {
      active = false;
    };
  }, [loading, user, router]);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    try {
      const created = await apiFetch<GatewaySession>("/sessions", {
        method: "POST",
        body: JSON.stringify({ title, provider }),
      });
      const detail = await apiFetch<GatewaySessionDetail>(`/sessions/${created.id}`);
      setSelectedDetail(detail);
      setStatusMessage(`Started session "${created.title}" with an isolated encrypted vault.`);
      await loadWorkspace();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInspectSession(sessionId: string) {
    setStatusMessage(null);
    try {
      const detail = await apiFetch<GatewaySessionDetail>(`/sessions/${sessionId}`);
      setSelectedDetail(detail);
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not load session.");
    }
  }

  async function handleEndSession(sessionId: string) {
    setBusy(true);
    setStatusMessage(null);
    try {
      await apiFetch<{ status: string }>(`/sessions/${sessionId}`, { method: "DELETE" });
      if (selectedDetail?.id === sessionId) {
        setSelectedDetail(null);
      }
      setStatusMessage("Session ended and its encrypted vault was wiped from memory.");
      await loadWorkspace();
    } catch (error) {
      setStatusMessage(error instanceof ApiError ? error.message : "Could not end session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-600">
        <p>Checking session...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Contract Privacy Gateway</h1>
            <p className="text-xs text-slate-500">
              Owned review sessions &middot; Ephemeral encrypted Redis vault
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-medium text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">
                {user.email} &middot;{" "}
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium uppercase text-emerald-800">
                  {user.role}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div role="status" aria-live="polite" className={statusMessage ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900" : "sr-only"}>
          {statusMessage ?? ""}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="new-session-heading" className="text-base font-semibold text-slate-900">
            Start a gateway session
          </h2>
          <form
            onSubmit={handleCreateSession}
            aria-labelledby="new-session-heading"
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="session-title" className="text-sm font-medium text-slate-800">
                Session label (no raw contract PII)
              </label>
              <input
                id="session-title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-h-12 rounded-lg border border-slate-400 px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="session-provider" className="text-sm font-medium text-slate-800">
                Strong AI provider
              </label>
              <select
                id="session-provider"
                name="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="min-h-12 rounded-lg border border-slate-400 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {PROVIDERS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="min-h-12 rounded-lg bg-emerald-700 px-5 text-base font-medium text-white hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              New session
            </button>
          </form>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Your active sessions ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No active sessions yet. Create one above to initialize an encrypted vault.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{session.title}</p>
                      <p className="text-xs text-slate-500">
                        Provider: {session.provider} &middot; ID: {session.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleInspectSession(session.id)}
                        className="min-h-10 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleEndSession(session.id)}
                        className="min-h-10 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100"
                      >
                        End &amp; wipe
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Selected session status</h2>
            {selectedDetail ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Title</dt>
                  <dd className="font-medium text-slate-900">{selectedDetail.title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Encrypted Redis vault</dt>
                  <dd className="font-medium text-emerald-700">
                    {selectedDetail.vault_active ? "Active (RAM-only, TTL)" : "Wiped / Expired"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Masked turns stored</dt>
                  <dd className="font-medium text-slate-900">
                    {selectedDetail.masked_messages.length}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Select or create a session to inspect its vault state.
              </p>
            )}
          </section>
        </div>

        {user.role === "admin" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Recent metadata-only audit events (Admin)
            </h2>
            {auditLogs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No audit events recorded yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {auditLogs.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-mono text-xs text-slate-800">{entry.action}</span>
                    <span className="text-xs text-slate-500">
                      {entry.provider ? `provider=${entry.provider} · ` : ""}
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
