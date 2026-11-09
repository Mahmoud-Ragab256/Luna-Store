# Database schema

Canonical definitions: `server/src/database/models.js`. Mongoose enforces field validation and strict document shapes. A replica set is mandatory for order, inventory, coupon and payment transactions. Amounts are stored as EGP numbers; commerce converts amounts to integer piasters for arithmetic before storing rounded EGP snapshots.

| Collection/model     | Owned data and relationships                                                                                                                              | Important indexes/invariants                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| User                 | Identity, password hash, role, phone, bounded saved addresses, account/email status and single-use reset/verification hashes                              | Unique normalized email; customer role by default; secrets excluded from normal queries/JSON                            |
| Session              | User reference, refresh hash, token family, expiry/revocation, reuse marker and bounded user-agent metadata                                               | Unique refresh hash; user/family indexes; TTL on expired sessions                                                       |
| Category             | Name, slug, description, image, parent reference, display order and active status                                                                         | Unique slug; parent uses reference rather than recursive embedding                                                      |
| Product              | Category reference, media, description, base price, percent discount, bounded SKU variants, tags, specifications, rating aggregates and active status     | Unique slug; unique multikey SKU index plus within-document SKU validation; active/date and active/price indexes        |
| Cart                 | Unique user owner, up to 50 product/SKU/quantity lines and optional coupon selection                                                                      | Unique user; optimistic version check for concurrent mutation; no authoritative persisted prices                        |
| Order                | Customer, address and line snapshots, source product IDs/SKUs, totals, shipping/payment methods, fulfillment/payment/inventory state and idempotency hash | Unique order number; unique user/idempotency-key combination; user index                                                |
| Payment              | Order reference, provider reference/state, EGP amount, status, idempotency key and bounded processed-event IDs                                            | Unique provider/transaction pair and unique idempotency key; order index                                                |
| Coupon               | Uppercase code, percent/fixed value, minimum spend/cap, usage count/limit, expiry and enabled state                                                       | Unique code; conditional atomic usage increment in checkout transaction                                                 |
| Review               | User and product references, rating, comment, display-name snapshot and approval flag                                                                     | Unique user/product pair; product index; public posting requires delivered purchase                                     |
| Wishlist             | User reference and bounded product IDs                                                                                                                    | Unique user; product references avoid duplicate catalog data                                                            |
| ContactMessage       | Name/email/subject/message and inbox status                                                                                                               | Independent records, not an unbounded array on an administrator                                                         |
| InventoryReservation | Order/product/SKU, quantity, reserved/committed/released status and expiry                                                                                | Unique order/SKU; indexed order/expiry; deliberately **no TTL deletion** because stock must be released transactionally |
| Newsletter           | Email and consent timestamp                                                                                                                               | Unique email                                                                                                            |
| AuditLog             | Administrator ID, action, resource and resource ID with timestamps                                                                                        | Stores actions, not credentials or request bodies                                                                       |

## Embedding decisions

Variant, address and order line arrays are bounded and read with their parent, so they are embedded. Orders, reviews, messages and sessions grow independently and use separate collections. An order preserves product name, selected color/size, unit price and address history even when a catalog record is archived or edited.

## Inventory lifecycle

- COD order: `committed` stock on order creation.
- Online development order: `reserved`, expires in 30 minutes.
- Verified development payment: `reserved → committed` in the same transaction as payment status.
- Eligible cancellation, payment failure or timeout: `reserved/committed → released`; quantities and coupon usage return once.
- Fulfillment progresses pending/confirmed → processing → shipped → delivered. Canceled orders cannot resume fulfillment. Returned status records the lifecycle; provider refunds are not fabricated.

## Operational notes

Run index creation before serving production traffic through a deployment migration process. Development/test initialization creates indexes automatically. Keep backups and test restoration. Session TTL cleanup is asynchronous and is not relied upon for authentication expiry; the middleware checks `expiresAt` explicitly. Never TTL-delete reservations as a substitute for the release job.
