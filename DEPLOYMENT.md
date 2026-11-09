# Deployment

## Recommended topology

Serve the Vite build from a static host or reverse proxy and route `/api/v1` to the Node Express service. Use one HTTPS origin where practical so refresh cookies remain first-party. Express and MongoDB remain separate from the frontend; no Next.js, Firebase or hosted replacement API is used.

```sh
npm ci
npm run build
npm run start -w server
```

Configure the static host to serve generated prerendered public pages when available and otherwise fall back to `index.html` for SPA routes. Do not route API failures to the SPA. Set long cache lifetimes only on hashed assets, not on product HTML or private API responses.

## Environment configuration

The API reads `server/.env` when launched through its workspace scripts. Production should inject environment variables through the deployment secret manager.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `production` on deployed API; disables development seeding/payment simulation |
| `PORT` | API port, default 4000 |
| `MONGODB_URI` | Replica-set connection URI; production credentials must be private |
| `CLIENT_ORIGIN` | Exact frontend URL, default `http://localhost:5173`; CORS and CSRF allowlist |
| `JWT_SECRET` | Stable cryptographically random secret, at least 32 characters; mandatory production setting |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Transactional account email; port 465 uses TLS transport |
| `CONTACT_EMAIL`, `CONTACT_PHONE` | Store contact details; unset values are not invented |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Administrator image storage; secrets stay on API only |
| `PAYMENT_PROVIDER` | Default `disabled`; `mock` only for development; no production adapter is currently wired |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | Development webhook HMAC secret; never reuse production provider secrets |
| `FREE_SHIPPING_THRESHOLD` | Sample default 2500 EGP |
| `SHIPPING_EXPRESS_ENABLED`, `SHIPPING_EXPRESS_SURCHARGE` | Optional express method and sample surcharge |
| `SHIPPING_ZONES_JSON` | Optional JSON array of `{governorate,fee,minDays,maxDays}`; defaults are development store rules |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Development-only admin creation; minimum 12-character password; never shipped defaults |

## MongoDB locally

```sh
docker compose up -d
docker compose logs mongo-init
```

The Docker configuration binds MongoDB only to loopback, stores data in a named volume and initializes a single-node `rs0` replica set. It is a local development service, not a hardened production database. The service URI is `mongodb://127.0.0.1:27017/luna?replicaSet=rs0`.

Without Docker, `npm run dev:database` starts a downloaded real MongoDB replica set and persists records in ignored `.runtime/mongodb`. Do not run both launchers on port 27017 simultaneously. Do not run development database tooling in production.

## Production rollout

1. Provision MongoDB replica-set networking, backups and secrets; validate transaction support.
2. Create collection indexes in a controlled migration before accepting traffic.
3. Configure frontend origin, JWT, contact details, SMTP and Cloudinary; verify uploads and mail delivery.
4. Import licensed product imagery and real catalog data; remove development sample reviews/users/coupons as appropriate. Do not run the development seed in production.
5. Keep online payment disabled until the selected provider's create/verify/webhook/refund adapter is implemented, tested and reviewed.
6. Run lint, integration/frontend/browser tests and production build. Monitor `/api/v1/health`, logs, stock reservations and email failures.
7. Run the API as a managed process with graceful termination. The in-process expiry worker runs once per minute; ensure at least one API instance remains running or deploy an equivalent dedicated reservation-expiry worker.

## SEO strategy

A client-only SPA is insufficient for reliable product metadata indexing. Preserve the required React/Vite stack and prerender public home/catalog/category/product routes from current MongoDB records, generating unique metadata, product/breadcrumb JSON-LD and a sitemap. Rebuild prerendered output when products change; do not prerender customer/admin/private data. Verify generated files and crawler responses before claiming SEO readiness. The status document records whether prerendering has actually been implemented and executed.
