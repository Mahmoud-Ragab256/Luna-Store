# LUNA — Women's Fashion Store

An English-only, LTR, Luxury Minimal, Egypt-focused fashion storefront with a separate React/Vite application and Express/MongoDB API. Prices are displayed in Egyptian pounds. Headings use Playfair Display and interface text uses Inter. The application uses real MongoDB records, server-calculated checkout totals, transactional inventory allocation and authenticated order history.

## Stack

- Client: JavaScript, React, Vite, React Router, Redux Toolkit/RTK Query, Tailwind, React Hook Form/Zod, Lucide, Motion, Sonner and Swiper.
- API: JavaScript ESM, Express, Mongoose, JWT access tokens, rotating refresh cookies, bcrypt, Zod, Helmet, CORS, rate limits and Pino.
- Integrations: Cloudinary image upload, Nodemailer SMTP and an explicitly development-only payment adapter. Live online payment processing is disabled.
- Verification: Vitest, React Testing Library, Supertest and Playwright.

## Quick start

Use Node.js 22 LTS or a compatible supported release and npm. Run all commands from the repository root unless noted.

```sh
npm install
```

Copy `server/.env.example` to `server/.env`. Replace `JWT_SECRET` with at least 32 cryptographically random characters. The default API is `http://localhost:4000`, and the Vite app is `http://localhost:5173`.

Start a local MongoDB replica set using either Docker:

```sh
docker compose up -d
```

or the development-only MongoDB launcher:

```sh
npm run dev:database
```

The launcher downloads a real MongoDB executable on its first run and keeps data in ignored `.runtime/mongodb`. Keep its terminal open. It is not a mock API. Production must use a properly managed MongoDB replica set or Atlas.

In a second terminal:

```sh
npm run seed
npm run dev
```

The development seed is idempotent: it inserts missing records without replacing existing products. It includes 12 categories, 40 products with size/color SKUs, a `WELCOME10` sample coupon and clearly identified development reviews. Fashion photographs are development placeholders; replace them with licensed product photography before launch.

## Optional development administrator

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (minimum 12 characters) in the server environment, then run `npm run seed`. There are no shipped administrator credentials. The seed refuses to run when `NODE_ENV=production`. Registering through the public API always creates a customer.

## Commands

```sh
npm run dev                    # client + API
npm run seed                   # development data, requires MongoDB
npm run lint
npm test                       # backend + frontend tests
npm run test:e2e               # Playwright, see TESTING.md
npm run build                  # Vite production build
npm run build:seo              # public prerender + sitemap; requires running API
node scripts/verify-prerender.js
npm run start -w server        # API only
```

## Structure

```text
client/src/
  api/ app/                    RTK Query, state and routes
  components/                  shared interface primitives and product components
  features/                    auth, cart and wishlist client state
  pages/                       storefront, account and admin views
server/src/
  config/ common/              environment, logging, errors and middleware
  database/                    Mongoose contracts, connection and development seeds
  modules/auth/                account and session lifecycle
  modules/catalog/             browsing, reviews, saved items and contact
  modules/users/               profile, password and address management
  modules/admin/               catalog, customer, message and upload administration
  modules/commerce/            cart, shipping, orders, coupons, inventory and payments
  integrations/                external service boundaries
server/tests/                  MongoDB-backed integration and concurrency tests
tests/                         browser end-to-end tests
```

## Deployment and status

Read [DEPLOYMENT.md](DEPLOYMENT.md) for topology, environment configuration, database transactions and launch requirements. [PROJECT_STATUS.md](PROJECT_STATUS.md) records verified results and remaining limitations; the existence of a route does not establish production readiness.

Further documentation: [architecture](ARCHITECTURE.md), [API](API_DOCUMENTATION.md), [database](DATABASE_SCHEMA.md), [security](SECURITY.md), [testing](TESTING.md), [design](DESIGN.md).

## Verified update

24 backend tests, 10 component tests and 6 Chrome E2E workflows passed. See PROJECT_STATUS.md for exact scope and external-service limitations. The English/LTR update preserves COD and the development online-payment provider. To enable the labeled simulator locally, set `PAYMENT_PROVIDER=mock` with `NODE_ENV=development`; it is always disabled in production.

For browser tests using installed Chrome in PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e`. Clean machines may use the bundled Playwright Chromium install. On this Windows workspace an optional ignored `.local/mongodb/mongod.exe` is reused automatically; other machines download MongoDB normally.

## Hosted demonstration

The current target is a Vercel-hosted demonstration with MongoDB Atlas and Cloudinary imagery. All orders and online payment outcomes are explicitly test-only. Real payment activation, a custom domain, Render and Resend are outside scope; email will use Brevo SMTP. Deployment status and remaining authorization/configuration steps are recorded in [PROJECT_STATUS.md](PROJECT_STATUS.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

Live demonstration: https://luna-store-peach.vercel.app. The API is connected to Atlas; COD and online payment simulation were verified using fictional data. The demonstration does not collect real online payments or dispatch physical products.

The hosted catalog now includes 48 products, including eight individually illustrated AI capsule concepts with matching colours and photos. Image loading uses a shared image-only skeleton/hero preview and responsive delivery. The canonical public URL is https://luna-store-peach.vercel.app. See client/public/images/new/ASSETS.md for the generated-photo prompt set.
