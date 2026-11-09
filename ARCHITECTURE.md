# Architecture

## Deployment boundaries

LUNA is a modular monolith: a separately built Vite SPA talks to a single Express API under `/api/v1`. MongoDB is the durable store. Browser product data always comes from the API; the development seed populates MongoDB rather than substituting a browser-side product array.

In development Vite proxies API requests to port 4000. For production put the static application and API behind one HTTPS origin, routing `/api` to Express and other application paths to the SPA/prerendered documents. The mandatory React/Vite stack is retained.

## Backend responsibilities

- Routes validate transport input, enforce authentication/roles and format responses.
- Auth services own password checks, session creation, rotation and family-reuse revocation.
- Catalog services build allowlisted MongoDB queries and pagination.
- Commerce services own authoritative pricing, stock, coupon claims, order snapshots, inventory release and payment outcomes.
- Mongoose models are the canonical persistence contracts in `server/src/database/models.js`.
- Infrastructure adapters keep SMTP and Cloudinary configuration outside customer workflows.

Small, direct modules are used instead of forwarding-only repository classes. All code is JavaScript as required by the project brief; installed skills that default to TypeScript do not override that choice.

## Authentication

An HS256 JWT access token expires after ten minutes and is held in Redux memory. It contains the session identifier, user subject, issuer and audience. The API reloads the user and session for protected requests, so logout, account deactivation and password resets revoke access promptly.

The refresh token is a random opaque 48-byte value. Only its SHA-256 hash is stored. Rotation atomically claims the old session, revokes it and creates a replacement within the same family. Reuse revokes that family. The browser receives the refresh value only through an HttpOnly cookie scoped to `/api/v1/auth`; no sensitive token belongs in localStorage.

## Checkout consistency

1. Validate the requested items and consolidate duplicate variants.
2. Resolve current products, SKU stock, prices, discounts, coupon rules and shipping on the server.
3. Within a MongoDB transaction, conditionally decrement each SKU, atomically consume any limited coupon, create immutable order line/address/customer snapshots and clear the saved cart.
4. Cash-on-delivery stock is committed immediately. Online development checkout stock is reserved for 30 minutes.
5. Payment confirmation commits a reservation. Failure, permitted cancellation or expiry releases stock and coupon usage within a transaction. Expiry runs every minute while the API is running.

An authenticated-user/idempotency-key unique index prevents duplicate order creation. Reusing a key with a different normalized request is rejected. Payment event/state checks and transactions prevent duplicate confirmations. A single-node development replica set supports transactions; a standalone MongoDB process does not.

## Frontend state

RTK Query owns remote records and invalidation. Redux slices own in-memory authentication and guest cart/wishlist selections. Guest persistence contains non-sensitive product choices only. Protected screens require authentication, but the API remains the authorization authority. Login merges guest selections into the saved cart through an authenticated endpoint; maximum quantities are used for repeatable merge requests.

## Operational boundaries

- Real card processing is not implemented and cannot be enabled in production by toggling the mock flag.
- SMTP and Cloudinary require real credentials. Missing integration configuration returns an honest unavailable state or records delivery failure rather than claiming a successful send/upload.
- Default shipping prices and windows are sample store configuration, not an integrated courier quote.
- Development images and reviews must be replaced or removed before launch.
