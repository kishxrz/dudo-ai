# Dudo Enterprise Security & Secure Development Rules

## Rule 1 — Security First
Every code change must be evaluated against:
- OWASP Top 10
- OWASP ASVS
- Principle of Least Privilege
- Secure by Default
- Defense in Depth
- Fail Securely

Never implement functionality that weakens existing security.

---

## Rule 2 — Never Trust User Input
Treat all external input as untrusted.
Validate:
- API payloads
- Query parameters
- Headers
- Cookies
- Multipart uploads
- AI prompts
- Documents
- Images
- Audio
- URLs
- Tool parameters

Use Zod validation wherever possible.

---

## Rule 3 — Authentication Before Business Logic
Every protected endpoint must verify:
- Firebase ID Token
- Workspace ownership
- User permissions
- Subscription status (where applicable)

Never execute business logic before authentication and authorization succeed.

---

## Rule 4 — Workspace Isolation
Never allow:
- Cross-workspace reads
- Cross-workspace writes
- Shared AI memory
- Shared vector search
- Shared conversations
- Shared uploaded files

Every query must be filtered by workspaceId.

---

## Rule 5 — Principle of Least Privilege
Grant the minimum permissions necessary.
Never expose:
- Admin APIs
- Secrets
- Internal IDs
- Firebase credentials
- Provider API keys

---

## Rule 6 — AI Safety
Protect against:
- Prompt injection
- Jailbreak attempts
- System prompt disclosure
- Tool abuse
- Function calling abuse
- RAG poisoning

Never expose hidden prompts or internal instructions.

---

## Rule 7 — Secret Management
Secrets must:
- Never be committed
- Never appear in logs
- Never reach the frontend
- Only exist in secure environment variables

---

## Rule 8 — Secure File Handling
Validate every upload using:
- MIME type
- File extension
- Magic bytes
- Maximum size

Reject:
- Executables
- Malicious PDFs
- Zip bombs
- Oversized files

---

## Rule 9 — Rate Limiting
Apply rate limits to:
- Authentication
- AI chat
- Voice APIs
- Image generation
- File uploads
- Webhooks
- Public APIs

Rate limiting must support:
- IP
- User
- Workspace

---

## Rule 10 — Logging
Log:
- Authentication failures
- Permission failures
- Security events
- Webhook failures
- Rate limiting

Never log:
- Passwords
- Tokens
- API keys
- Personal information
- Secrets

---

## Rule 11 — Error Handling
Production responses must never expose:
- Stack traces
- Internal paths
- SQL/Firestore queries
- Environment variables
- Secrets

Return safe error messages only.

---

## Rule 12 — Code Quality
Every change must pass:
- npm run lint
- npm run typecheck
- npm run build

No new TypeScript errors.
No ESLint warnings.
No regression.

---

## Rule 13 — Performance
Security improvements must not significantly degrade:
- TTFB
- Bundle size
- AI response latency
- Dashboard performance

Use middleware efficiently.
Cache where safe.

---

## Rule 14 — Architecture
Do not duplicate business logic.
Reuse existing services.
Maintain:
- ProviderRegistry
- Firebase architecture
- Workspace model
- Existing UI

Avoid unnecessary abstractions.

---

## Rule 15 — Documentation
Every security-related change must include:
- Reason for the change
- Risk addressed
- Files modified
- Breaking change analysis
- Verification steps

---

## Rule 16 — Definition of Done
A task is only complete when:
✓ Security reviewed
✓ Authorization verified
✓ Validation added
✓ Error handling implemented
✓ Logging added
✓ Tests passed
✓ Build successful
✓ No regression introduced
✓ Documentation updated
✓ Production-ready

No AI-generated code may be merged or deployed without automated verification (lint, typecheck, tests, build, and a security review). Treat AI output as a draft until it passes all project quality gates.
