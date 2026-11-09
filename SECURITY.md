# Security implementation and launch checklist

## Implemented boundaries

- Public registration allowlists fields and cannot create an admin.
- Passwords are bcrypt hashes (cost 12), never returned in JSON; login failures are generic.
- Access JWTs have fixed HS256 algorithm, issuer, audience and ten-minute expiry. Protected requests verify the database user and unrevoked session.
- Refresh tokens are opaque random values, stored as SHA-256 hashes, rotated with single-use claims, family replay detection and logout/password-reset revocation.
- Refresh cookies are HttpOnly, SameSite=Strict, auth-path-scoped and Secure in production. Access tokens stay in browser memory.
- Cookie mutations validate the configured Origin and reject cross-site Fetch Metadata. Cookie-bearing mutation requests without Origin or bearer authentication are rejected. Webhooks use signatures rather than browser CSRF checks.
- Zod validates request contracts; MongoDB filters are built from allowlisted scalar input. Regex searches escape metacharacters. Raw request objects are not merged into database filters.
- Backend role and owner checks protect admin routes and orders. Cross-customer order requests return not found.
- Helmet, CORS allowlist, body/file limits, authentication/contact/newsletter/global rate limits, safe central errors and request IDs are installed.
- Cloudinary uploads are administrator-only, size/MIME/signature checked and bounded. Partial upload failures clean up already-uploaded files.
- Checkout totals, coupon limits and stock are recomputed on the server. MongoDB transactions and unique idempotency keys protect concurrent writes.
- Payment signatures use timing-safe HMAC comparison; payment amounts/provider state are checked and duplicate events are not applied twice. Live production payments remain disabled.
- Reset and verification tokens are hashed, expiring and single-use; email links use URL fragments. Password reset/change revokes existing sessions.

## Secrets and environment

Do not commit `.env`, credentials, access/refresh tokens, uploaded personal files, payment payload secrets or database exports. `.env.example` contains names/placeholders only. Configure a stable strong JWT secret in production; startup refuses missing production JWT configuration. Development can use an ephemeral process-local secret, which invalidates sessions after restart.

Pino redacts authorization, cookie and common secret fields. Do not add body logging or token logging during troubleshooting. Security/audit events should include resource IDs, not customer message contents or full shipping addresses.

## Production work remaining

- Configure HTTPS and deployment-specific trusted proxy hops; do not enable broad `trust proxy=true` without a known topology.
- Use a managed MongoDB replica set, authenticated private networking, least-privilege credentials, backups and index/migration procedures.
- Configure SMTP delivery and verify domain authentication. Without SMTP, the application records that account emails were not sent; it does not fabricate delivery. Add a durable email retry/outbox policy for launch requirements.
- Configure real Cloudinary credentials and a media retention/cleanup policy for replaced/archived product media. Current upload rollback exists; automatic long-term orphan reconciliation is not implemented.
- Integrate and security-review the selected Egyptian payment provider before enabling online payment/refund features. Never enable the development mock as a production substitute.
- Replace IP-memory rate limiting with a shared store or edge limit when deploying multiple API instances.
- Establish operational audit-log retention, privacy/export/deletion policies and monitoring/alerting appropriate to the actual business. No invented legal policy is supplied.
- Run dependency/security scans in the actual deployment and review production configuration. Automated application tests are not an independent penetration test or a WCAG certification.

## Reporting an issue

Use the repository owner's private security channel. Do not post credentials or customer data in public issues. No fictional support email is supplied by default; contact details are configurable.
