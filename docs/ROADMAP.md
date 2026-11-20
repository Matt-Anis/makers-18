# NYXORA — Contract Privacy Gateway Roadmap & Architecture

> **Pitch:** Strong AI on your most sensitive documents, without the documents ever leaving your control.  
> **Context:** MAKERS² 2026 (Track 02: AI for Work & Business). Privacy gateway sitting between company users and external frontier AI models.

---

## 1. Non-Negotiable Privacy & Security Invariants

1. **Send Gate enforcement:** External AI providers must only ever receive approved, masked text (`[PERSON_1]`, `[COMPANY_1]`, etc.)—enforced in backend code, never trusted to the frontend.
2. **No plaintext secrets or raw PII at rest:**
   - Passwords hashed with Argon2id (`backend/app/security.py`).
   - Auth tokens stored as SHA-256 hashes (`auth_sessions`).
   - Provider API keys configured by the Owner are Fernet-encrypted at rest and never returned in plaintext (masked hints like `...a9f2` only).
   - Audit logs (`audit_logs`) store metadata only (user, session ID, action, provider, entity counts, timestamps)—never raw text, prompts, or vault mappings.
3. **Never claim legal compliance:** Position NYXORA as reducing personal-data exposure and keeping a human in control, not as legal certification (Law 18-07 / 25-11 context).

---

## 2. Locked-In Architecture Decisions

### Roles (`owner` vs `user`)
*(Note: `backend/app/models.py` currently has `requester`, `reviewer`, `admin`; Layer 1 below simplifies this to `owner` and `user`.)*
- **`owner`:** Manages workspace settings—provider API keys, enabled models & defaults, rulebook prompt & custom rules, user provisioning (`POST /auth/users`), metadata-only audit log (`/audit`), and evaluation metrics (`/metrics`).
- **`user`:** Clean ChatGPT/Claude-style experience at `/chat` only. Hides `/rules`, `/metrics`, and all technical settings. Picks from Owner-enabled models and chats using `manual` or `auto` review mode.

### Model Discovery & Provider Adapter
- `GET /providers/models` inspects Owner-configured API keys (or env fallbacks) and returns enabled models plus supported parameters (e.g., `thinking_effort`).
- All frontier providers sit behind one interface: `send(masked_messages, model, thinking_effort) -> text`.

### Layered Filtering Pipeline (Text-First MVP)
Each new message passes sequentially through pluggable layers:
1. **Pass 0 — Vault Lookup (`<1ms`):** Deterministically replaces any entity already in the session vault (`James` → `[PERSON_1]`) so placeholders stay consistent across the entire conversation.
2. **Layer 1 — Rules & Custom Rules:** Regex patterns, contract patterns, and company-defined keywords/regexes.
3. **Layer 2 — Local NER / PII Models (CPU):** spaCy / Presidio / GLiNER detectors.
4. **Layer 3 — Local Rulebook LLM (Separate GPU Server over HTTP, optional/post-MVP):** Inspects the *already-masked* chunk against the Owner's rulebook and returns strict JSON leftovers (validated by backend; untrusted output can only *add* findings).

### Two Review Modes & Deterministic Unmasking
- **`manual` (Manual Approval):** `POST /sessions/{id}/messages` returns findings and the masked preview (`needs_review`). User can approve, dismiss, change types, add missed text, or request changes before `POST /sessions/{id}/reviews/{rid}/approve` (**Send Gate**) dispatches to the provider.
- **`auto` (Auto Review):** Runs the same pipeline, commits the mapping to the vault, and dispatches through the Send Gate automatically without pausing.
- **Unmasking:** Restores placeholders in the external model's reply deterministically via `VaultData.unmask_text()` (longest-match, case-insensitive regex)—zero extra LLM calls needed.

### Persistent Multi-Week Sessions & Long Context (100+ Messages)
- **Persistent encrypted vault:** Persist the Fernet-encrypted vault blob in SQLite/Postgres alongside `MaskedMessage` (with Redis as fast hot cache) so users can reopen chats weeks later and still view unmasked text. Clicking **End & Wipe Vault** (`DELETE /sessions/{id}`) deletes both immediately. *(Keep an `EPHEMERAL_VAULTS_ONLY` env flag for strict zero-disk deployments.)*
- **Long-context efficiency:** Never re-filter message history `#1..#99` (it is already stored masked). Filter **only** the newest message (`#100`), pre-applying Pass 0 Vault Lookup first so the GPU LLM only sees new text. Window/summarize already-masked history when calling the external provider.

---

## 3. Build Order (MVP First, Then Refine)

### Done
- [x] Docker Compose stack (`compose.yaml`) + hot-reload dev override (`compose.dev.yaml`): Next.js 16, FastAPI, SQLite volume, persistence-disabled Redis.
- [x] Auth & RBAC (`POST /auth/login`, `/logout`, `/me`, admin `/users`, Argon2id + HttpOnly cookies, no public registration).
- [x] User-owned `GatewaySession` (`/sessions`), Fernet-encrypted `VaultData` (`RedisVaultStore`), and metadata-only `AuditLog` (`/audit`).
- [x] NYXORA UI shell (`shadcn/ui` + liquid backdrop): `/`, `/login`, `/chat` modular review UI (mock pipeline), `/rules`, `/metrics`.

### Next — Text-Only MVP
- [ ] **Layer 1 — Roles & Owner Settings (`backend`):** Simplify roles to `owner` / `user`; add encrypted `ProviderConfig` + `RulebookSettings` tables; add `GET/PUT /settings/providers`, `GET /providers/models` (discovery + thinking effort), and `/rules` CRUD.
- [ ] **Layer 2 — Persistent Vault + Filtering Pipeline (`backend`):** Persist encrypted vault snapshots in DB + Redis cache; implement Pass 0 Vault Lookup + Layer 1 Rules + Layer 2 NER/PII behind one `detect()` module.
- [ ] **Layer 3 — Review Modes & Send Gate (`backend`):** Implement `POST /sessions/{id}/messages` (`manual` / `auto` mode), `POST /sessions/{id}/reviews/{rid}/approve` Send Gate, and frontier `Provider.send(...)` wrapper + deterministic unmasking.
- [ ] **Layer 4 — Wire Frontend (`frontend`):** Hide `/rules` and `/metrics` from `user` role; connect `/chat` to real `/providers/models`, `/sessions/{id}/messages`, and `/reviews/{rid}/approve`; build Owner Settings UI for API keys, enabled models, and rulebook.

### Post-MVP Refinements (After Text Flow Works End-to-End)
- [ ] File ingestion: DOCX & text-layer PDF parsing with metadata stripping (and OCR for scanned PDFs if time allows).
- [ ] Separate GPU server HTTP client for the Layer 3 Rulebook LLM check (with chunking & JSON retry).
- [ ] Evaluation harness (synthetic + realistic public contract sets, ablation, 100% round-trip check) feeding `GET /metrics/latest` and `/metrics`.
- [ ] Long-context masked summarization/windowing & multimodal/image handling.
