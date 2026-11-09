# Testing

## Backend integration tests

```sh
npm run test -w server
```

Vitest/Supertest exercise Express against isolated, real MongoDB replica sets supplied by `mongodb-memory-server`. This is not a repository-method mock. The first run downloads MongoDB; allow time and network access for that download. The test hook timeout is extended for bootstrap. No test connects to the production URI.

Covered auth/catalog behaviors include invalid input, password hashing, registration role-escalation rejection, generic login failures, repeated refresh rotations, replay-family revocation, logout revocation, Origin/role protections, one-use reset/verification tokens, catalog seeding/filtering/pagination, administrator product/category create/edit/archive, global SKU conflicts and contact anti-spam persistence.

Commerce tests cover authoritative pricing, duplicate item normalization, stock concurrency, coupon concurrency, idempotent order requests, ownership, cart operations, reservation expiry, safe cancellation and development payment-event replay. Inspect current test names for the exact evidence rather than assuming all production provider scenarios are covered.

## Frontend tests

```sh
npm run test -w client
```

React Testing Library/Vitest check user-visible forms and selected state transitions. Tests should use the stable interface behavior, not snapshots of implementation details. Browsing, gallery/variant/cart and checkout interactions also need browser verification.

## End-to-end

```sh
npx playwright install chromium
npm run test:e2e
```

Read the Playwright configuration for server bootstrap and test-specific environment. Use a dedicated development database. Never run checkout/admin tests against a live store with real payment credentials. End-to-end coverage should include product browsing/filtering, selecting a variant, cart quantities, COD checkout, order history and admin product/order updates.

## Static checks and build

```sh
npm run lint
npm run build
```

Production build success confirms compilation, not working checkout or production service configuration. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for actual commands/results and explicit blocked checks.

## Manual verification

Check desktop and narrow mobile widths, keyboard focus/order, menu/dialog open/close/focus restoration, loading/error/empty states, unavailable stock, long addresses/names, invalid mobile numbers, expired sessions, repeated checkout submission, disabled online payments and reduced-motion preferences. Review actual screenshots and browser traces; do not infer visual quality from a passing build.
