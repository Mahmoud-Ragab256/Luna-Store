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

| Variable                                                               | Purpose                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                                             | `production` on deployed API; disables development seeding/payment simulation                    |
| `PORT`                                                                 | API port, default 4000                                                                           |
| `MONGODB_URI`                                                          | Replica-set connection URI; production credentials must be private                               |
| `CLIENT_ORIGIN`                                                        | Exact frontend URL, default `http://localhost:5173`; CORS and CSRF allowlist                     |
| `JWT_SECRET`                                                           | Stable cryptographically random secret, at least 32 characters; mandatory production setting     |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`       | Transactional account email; port 465 uses TLS transport                                         |
| `CONTACT_EMAIL`, `CONTACT_PHONE`                                       | Store contact details; unset values are not invented                                             |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Administrator image storage; secrets stay on API only                                            |
| `PAYMENT_PROVIDER`                                                     | Default `disabled`; `mock` only for development; no production adapter is currently wired        |
| `MOCK_PAYMENT_WEBHOOK_SECRET`                                          | Development webhook HMAC secret; never reuse production provider secrets                         |
| `FREE_SHIPPING_THRESHOLD`                                              | Sample default 2500 EGP                                                                          |
| `SHIPPING_EXPRESS_ENABLED`, `SHIPPING_EXPRESS_SURCHARGE`               | Optional express method and sample surcharge                                                     |
| `SHIPPING_ZONES_JSON`                                                  | Optional JSON array of `{governorate,fee,minDays,maxDays}`; defaults are development store rules |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                              | Development-only admin creation; minimum 12-character password; never shipped defaults           |

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

### Generate crawlable public pages

Run the real API against the intended catalog, set `SITE_URL` to the public origin and optionally `PRERENDER_API_URL` (default http://127.0.0.1:4000/api/v1), then run `npm run build:seo` and `node scripts/verify-prerender.js`. Install Playwright Chromium first or set `PLAYWRIGHT_CHANNEL=chrome` for an installed Chrome. This produces public HTML only, product/breadcrumb JSON-LD and sitemap.xml. The Express app serves client/dist; reverse proxies can serve the same files and forward /api. Rebuild after catalog changes. Never point this process at a test database for a production release.

## Vercel demo deployment

The root `vercel.json` builds `client/dist`, sends `/api/*` to `api/index.js`, and preserves SPA navigation. The handler connects to Atlas using a reused, bounded Mongoose pool before delegating to the existing Express app. No permanent Node listener or in-process timer runs on Vercel.

Required hosting variables: `NODE_ENV=production`, `MONGODB_URI` pointing to the `luna` database, a private random `JWT_SECRET`, `CLIENT_ORIGIN` matching the actual assigned public URL, and a random `CRON_SECRET`. The current demo additionally requires `DEMO_MODE=true`, `PAYMENT_PROVIDER=mock` and build variable `VITE_DEMO_MODE=true`. Never set demo flags for a real commercial store.

The daily maintenance endpoint is `/api/v1/internal/maintenance`, authenticated with `Authorization: Bearer <CRON_SECRET>`. It processes bounded work: expired reservations, one queued email and one old unused application-tracked image. New checkouts also expire stale reservations. For retries faster than daily, configure a scheduler appropriate to the hosting plan. Email delivery is at least once: SMTP acceptance followed by a process crash can cause duplicate delivery; no exactly-once guarantee is claimed.

Brevo SMTP: host `smtp-relay.brevo.com`, port `465`, SMTP login and SMTP key (not the REST API key), and an approved `EMAIL_FROM` sender. Store these as SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM. Sender/domain authentication is completed in Brevo. The application queues order acknowledgements and account emails and attempts delivery during relevant requests; failed deliveries remain durable for retry.

Cloudinary photos have been uploaded through MCP and the catalog uses their public HTTPS URLs. Runtime admin uploads and cleanup use the backend SDK and require the three CLOUDINARY_* values separately. OAuth access granted to an assistant's MCP is not the application's API secret.

Use `DEMO_MODE=true node scripts/seed-demo.js` with a securely injected MONGODB_URI for non-destructive demo catalog initialization. It creates indexes and missing catalog records only, and never imports fake customer reviews. It saves a newly generated admin credential only in ignored `.runtime/demo-admin.json`.

The user explicitly approved storing MONGODB_URI, JWT_SECRET and CRON_SECRET as encrypted Vercel variables; all three are now configured. Runtime deployment is currently blocked by an Atlas TLS/network connection failure from Vercel. The actual production alias is already publicly readable, so no SSO setting change is needed. Do not claim a public live demo before its health, account, COD and simulated-payment flows pass against the actual deployment. No paid hosting upgrade is authorized or needed for the current preparation.

Cross-platform build note: the first automatic Vercel build found a missing Rollup Linux native module in the Windows-generated lockfile. Matching Linux binaries for Rollup, Lightning CSS, Tailwind Oxide and esbuild are recorded as explicit optional dependencies. Keep their exact versions aligned with their parent packages when updating Vite/Tailwind. See upstream npm/cli issue 4828.

Current connectivity diagnosis: Vercel reports ReplicaSetNoPrimary and ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR while local Atlas access works. Inspect Atlas project Network Access before changing credentials or TLS settings. The IP access list has not been inspected because the browser is signed out. Do not disable TLS checks or claim the allowlist diagnosis as confirmed.
