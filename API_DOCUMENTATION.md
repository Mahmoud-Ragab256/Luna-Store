# API documentation

Base path: `/api/v1`. JSON successes use `{ "data": ... }` with optional `meta`. Lists use `meta.total`, `meta.page`, `meta.limit` and usually `meta.totalPages`. Errors use `{ "error": { "code", "message", "fields"? }, "requestId"? }`. Validation errors return 422. Request IDs are also returned in `X-Request-Id`. The machine-readable contract is [server/openapi.json](server/openapi.json).

## Authentication

| Method | Path | Request / purpose |
| --- | --- | --- |
| POST | `/auth/register` | `{name,email,password}`; password minimum 10 characters; creates customer only |
| POST | `/auth/login` | `{email,password}` |
| POST | `/auth/refresh` | Rotates the HttpOnly cookie; send allowed Origin and credentials |
| POST | `/auth/logout` | Revokes current refresh session and clears its cookie |
| GET | `/auth/me` | Current public user; bearer token required |
| POST | `/auth/forgot-password` | `{email}`; generic response protects account existence |
| POST | `/auth/reset-password` | `{token,password}`; single-use token |
| POST | `/auth/verify-email` | `{token}`; single-use token |

Register, login and refresh return `data: {user,accessToken}`. Use `Authorization: Bearer <accessToken>` for protected endpoints. Refresh/logout must include the exact configured frontend Origin for cookie-authenticated writes. Browser cross-site mutation requests are rejected. Reset/verification links carry tokens in the URL fragment.

## Catalog and configuration

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database-aware readiness (503 when disconnected) |
| GET | `/config` | Configurable contact details and enabled payment information |
| GET | `/shipping` | Governorates, fees, free shipping threshold and express availability |
| GET | `/categories` | Active categories in display order |
| GET | `/categories/:slug` | Active category |
| GET | `/products` | Active product list |
| GET | `/products/featured` | Featured products |
| GET | `/products/new-arrivals` | Newest products |
| GET | `/products/best-sellers` | Sorted by stored sales count |
| GET | `/products/:slug` | Active product, images and variants |
| GET | `/products/:productId/reviews` | Approved reviews; accepts product ID or slug |
| POST | `/products/:productId/reviews` | Authenticated `{rating,comment}`; delivered-order purchase required |
| POST | `/contact` | `{name,email,subject,message,website?}`; honeypot `website` must remain empty |
| POST | `/newsletter` | `{email}`; stores newsletter consent |

Product query parameters: `search` (or `q`), `category` slug, `subcategory`, `minPrice`, `maxPrice`, `size`, `color`, `availability=in-stock`, `inStock=true`, `discount=true`, `featured=true`, `sort`, `page`, `limit`. Sort accepts `newest`, `price-asc`, `price-desc`, `popularity`, `rating`. Page size is capped at 60. Monetary fields are EGP decimal amounts. Price filtering/sorting uses the displayed discounted catalog price (`catalogPrice`); checkout uses the selected variant's current discounted price, including an optional SKU price override.

## Customer account and saved choices

All require a bearer token.

| Method | Path | Request / purpose |
| --- | --- | --- |
| GET/PATCH | `/users/me` | Read/update `{name,phone}` |
| PATCH | `/users/me/password` | `{currentPassword,newPassword}`; revokes all sessions |
| POST | `/users/me/addresses` | Address fields; maximum ten saved addresses |
| DELETE | `/users/me/addresses/:id` | Remove saved address |
| GET | `/wishlist` | Active saved products |
| POST | `/wishlist/items` | `{productId}` |
| DELETE | `/wishlist/items/:productId` | Remove saved product |
| GET | `/cart` | Stored product/variant/quantity selections |
| POST | `/cart/items` | `{productId,variantSku,quantity}`; additive |
| POST | `/cart/merge` | `{items,couponCode?}`; repeatable maximum-quantity merge |
| PATCH | `/cart/items/:itemId` | `{quantity}` from 1 to 20 |
| DELETE | `/cart/items/:itemId` | Remove line |

`POST /cart/quote` is public and accepts `{items,couponCode?,governorate?,shippingMethod?}`. It returns authoritative resolved lines, subtotal, coupon discount, shipping and total. Empty carts are handled in the UI; quoting an empty list returns 422.

## Orders

`POST /orders` requires bearer authentication and an `Idempotency-Key` header (16–100 letters, digits, hyphens or underscores). The body is:

```json
{
  "items": [{"productId":"<MongoDB ObjectId>","variantSku":"LUNA-001-0-M","quantity":1}],
  "customer":{"name":"Customer name","email":"customer@example.test","phone":"01012345678"},
  "shippingAddress":{"governorate":"Cairo","city":"Cairo","street":"Street address","building":"12","apartment":"3","postalCode":"","notes":""},
  "shippingMethod":"standard",
  "paymentMethod":"cod",
  "couponCode":""
}
```

The API never accepts client totals as authority. Egyptian mobile numbers accept `01…`, `+201…` and `00201…` forms. Successful creation returns 201 and a Location header.

- `GET /orders`, `GET /orders/:id`: authenticated customer's own orders only.
- `POST /orders/:id/cancel`: pending/confirmed unpaid orders only; releases inventory once.
- `POST /orders/:id/reorder`: revalidates current stock and merges previous selections into the cart.

## Payments

- `POST /payments/create-session` accepts `{orderId}` for an owned online order.
- `GET /payments/:orderId/status` reads authoritative order state.
- `POST /payments/mock-confirm` is available only when `NODE_ENV!=production` and `PAYMENT_PROVIDER=mock`; accepts `{orderId,outcome:"paid"|"failed"|"canceled"}`. It is explicitly a development simulation.
- `POST /payments/webhook` verifies HMAC-SHA256 of the original bytes in `x-payment-signature` using `MOCK_PAYMENT_WEBHOOK_SECRET`, matches EGP amount and independently recorded development-provider status, then processes the event transactionally. Body fields: `eventId`, `providerTransactionId`, `status`, `amount`, `currency:"EGP"`.

Production online payment endpoints return unavailable until a real provider adapter is implemented and configured. A browser redirect never marks an order paid. No card fields are accepted or stored.

## Administration

Every admin route requires both bearer authentication and the database-backed admin role.

- `/admin/products`, `/admin/categories`: GET paginated list, POST create. `/:id`: GET record, PATCH edit, DELETE archive.
- `/admin/analytics`: paid revenue, counts, pending orders, low stock, recent orders and daily sales.
- `/admin/customers`: GET paginated list; PATCH `/:id` accepts `{isActive}`; GET `/:id/orders` returns order history.
- `/admin/messages`: GET paginated list; PATCH `/:id` accepts status `new`, `read` or `resolved`.
- `/admin/uploads`: POST multipart field `images`, up to eight JPEG/PNG/WebP files, 5 MB each. Requires Cloudinary credentials and verifies file signatures.
- `/admin/orders`: GET with optional fulfillment `status`; GET `/:id`; PATCH `/:id/status` with `{status}`. Invalid lifecycle transitions return 409.
- `/admin/orders/:id/refund`: POST returns 501 until real provider refund support exists; it does not fabricate a refund.
- `/admin/coupons`: GET/POST; `/:id` PATCH/DELETE (disable).

Products require unique slug, category ID, HTTPS image URLs, positive base price, and bounded SKU variants. Duplicate global SKUs and duplicate slugs return 409. Coupon types are `percentage` and `fixed`; usage limits are claimed atomically during checkout.
