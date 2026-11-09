import { getPaymentProvider } from '../../integrations/payment/provider.js';
import { Router } from 'express';
import { z } from 'zod';
import { Order, Payment, Coupon, AuditLog } from '../../database/models.js';
import { requireAuth, requireAdmin } from '../../common/middleware/auth.js';
import { quoteSchema, itemSchema, checkoutSchema, couponSchema, objectId } from './validation.js';
import { shippingConfiguration } from './shipping.js';
import {
  quoteCart,
  getCart,
  hydrateCart,
  replaceCart,
  mergeCart,
  updateCartItem,
  createOrder,
  findOwnedOrder,
  cancelOrder,
  onlinePaymentsEnabled,
  createPaymentSession,
  collectCashOnDelivery,
  confirmMockPayment,
  applyPaymentOutcome,
  updateFulfillment,
} from './service.js';

export const commerceRouter = Router();
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const ok = (res, data, status = 200, meta) =>
  res.status(status).json({ data, ...(meta ? { meta } : {}) });
const fail = (statusCode, message) => {
  throw Object.assign(new Error(message), { statusCode });
};
const paging = (query) => ({
  page: Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1)),
  limit: Math.max(1, Math.min(50, Number.parseInt(query.limit, 10) || 20)),
});
const searchPattern = (query) =>
  new RegExp(
    z
      .string()
      .max(100)
      .parse(query)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i',
  );
const audit = (req, action, resourceId) =>
  AuditLog.create({
    userId: req.user._id,
    action,
    resource: 'commerce',
    resourceId: String(resourceId),
  });

commerceRouter.get(
  '/shipping',
  route(async (req, res) =>
    ok(res, { ...shippingConfiguration(), onlinePaymentsEnabled: onlinePaymentsEnabled() }),
  ),
);
commerceRouter.post(
  '/cart/quote',
  route(async (req, res) => ok(res, await quoteCart(quoteSchema.parse(req.body)))),
);
commerceRouter.get(
  '/cart',
  requireAuth,
  route(async (req, res) => ok(res, await hydrateCart(await getCart(req.user._id)))),
);
commerceRouter.put(
  '/cart',
  requireAuth,
  route(async (req, res) => {
    const input = z
      .object({ items: z.array(itemSchema).max(50), couponCode: z.string().max(40).default('') })
      .parse(req.body);
    ok(res, await hydrateCart(await replaceCart(req.user._id, input.items, input.couponCode)));
  }),
);
commerceRouter.post(
  '/cart/merge',
  requireAuth,
  route(async (req, res) => {
    const input = z
      .object({ items: z.array(itemSchema).max(50), couponCode: z.string().max(40).optional() })
      .parse(req.body);
    ok(
      res,
      await hydrateCart(await mergeCart(req.user._id, input.items, input.couponCode, 'maximum')),
    );
  }),
);
commerceRouter.post(
  '/cart/items',
  requireAuth,
  route(async (req, res) =>
    ok(res, await hydrateCart(await mergeCart(req.user._id, [itemSchema.parse(req.body)])), 201),
  ),
);
commerceRouter.patch(
  '/cart/items/:itemId',
  requireAuth,
  route(async (req, res) => {
    const input = z.object({ quantity: z.number().int().min(1).max(20) }).parse(req.body);
    objectId.parse(req.params.itemId);
    ok(
      res,
      await hydrateCart(await updateCartItem(req.user._id, req.params.itemId, input.quantity)),
    );
  }),
);
commerceRouter.delete(
  '/cart/items/:itemId',
  requireAuth,
  route(async (req, res) => {
    objectId.parse(req.params.itemId);
    ok(res, await hydrateCart(await updateCartItem(req.user._id, req.params.itemId, 0)));
  }),
);

commerceRouter.post(
  '/orders',
  requireAuth,
  route(async (req, res) => {
    const input = checkoutSchema.parse(req.body);
    const key = z
      .string()
      .min(16)
      .max(100)
      .regex(/^[a-z\d_-]+$/i, 'Supply a unique Idempotency-Key header')
      .parse(req.get('Idempotency-Key'));
    const order = await createOrder(req.user._id, input, key);
    res.location(`/api/v1/orders/${order._id}`);
    ok(res, order, 201);
  }),
);
commerceRouter.get(
  '/orders',
  requireAuth,
  route(async (req, res) => {
    const { page, limit } = paging(req.query);
    const filter = { userId: req.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    ok(res, orders, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }),
);
commerceRouter.get(
  '/orders/:id',
  requireAuth,
  route(async (req, res) => ok(res, await findOwnedOrder(req.user._id, req.params.id))),
);
commerceRouter.post(
  '/orders/:id/cancel',
  requireAuth,
  route(async (req, res) => ok(res, await cancelOrder(req.user._id, req.params.id))),
);
commerceRouter.post(
  '/orders/:id/reorder',
  requireAuth,
  route(async (req, res) => {
    const order = await findOwnedOrder(req.user._id, req.params.id);
    const cart = await mergeCart(
      req.user._id,
      order.items.map((item) => ({
        productId: item.productId,
        variantSku: item.variantSku,
        quantity: item.quantity,
      })),
    );
    ok(res, await quoteCart({ items: cart.items, couponCode: cart.couponCode }));
  }),
);
commerceRouter.post(
  '/payments/create-session',
  requireAuth,
  route(async (req, res) => {
    const { orderId } = z.object({ orderId: objectId }).parse(req.body);
    ok(res, await createPaymentSession(req.user._id, orderId));
  }),
);
commerceRouter.get(
  '/payments/:orderId/status',
  requireAuth,
  route(async (req, res) => {
    const order = await findOwnedOrder(req.user._id, req.params.orderId);
    ok(res, {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      developmentOnly: onlinePaymentsEnabled(),
    });
  }),
);
commerceRouter.post(
  '/payments/mock-confirm',
  requireAuth,
  route(async (req, res) => {
    const input = z
      .object({ orderId: objectId, outcome: z.enum(['paid', 'failed', 'canceled']) })
      .parse(req.body);
    ok(res, await confirmMockPayment(req.user._id, input.orderId, input.outcome));
  }),
);
commerceRouter.post(
  '/payments/webhook',
  route(async (req, res) => {
    if (!onlinePaymentsEnabled()) fail(503, 'Online payment provider is not configured');
    const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
    if (!secret) fail(503, 'Development webhook secret is not configured');
    const signature = req.get('x-payment-signature') || '';
    const provider = getPaymentProvider();
    if (
      !provider.verifyWebhook(
        req.rawBody || Buffer.from(JSON.stringify(req.body)),
        signature,
        secret,
      )
    )
      fail(401, 'Invalid webhook signature');
    const event = z
      .object({
        eventId: z.string().min(1).max(100),
        providerTransactionId: z.string().min(1).max(100),
        status: z.enum(['paid', 'failed', 'canceled']),
        amount: z.number().nonnegative(),
        currency: z.literal('EGP'),
      })
      .parse(req.body);
    const payment = await Payment.findOne({ providerTransactionId: event.providerTransactionId });
    if (!payment || payment.amount !== event.amount) fail(409, 'Payment amount does not match');
    // This development adapter reads independently recorded provider state, not redirect parameters.
    if (!(await provider.verifyTransaction(payment, event)))
      fail(409, 'Provider transaction status is not verified');
    ok(res, await applyPaymentOutcome(event.providerTransactionId, event.status, event.eventId));
  }),
);

commerceRouter.get(
  '/admin/orders',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    const { page, limit } = paging(req.query);
    const filter = {};
    if (req.query.status)
      filter.fulfillmentStatus = z
        .enum([
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'canceled',
          'returned',
        ])
        .parse(req.query.status);
    if (req.query.search) {
      const pattern = searchPattern(req.query.search);
      filter.$or = [
        { orderNumber: pattern },
        { 'customerSnapshot.email': pattern },
        { 'customerSnapshot.name': pattern },
      ];
    }
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    ok(res, orders, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }),
);
commerceRouter.get(
  '/admin/orders/:id',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    objectId.parse(req.params.id);
    const order = await Order.findById(req.params.id);
    if (!order) fail(404, 'Order not found');
    ok(res, order);
  }),
);
commerceRouter.patch(
  '/admin/orders/:id/status',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    objectId.parse(req.params.id);
    const { status } = z
      .object({
        status: z.enum([
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'canceled',
          'returned',
        ]),
      })
      .parse(req.body);
    const order = await updateFulfillment(req.params.id, status);
    await audit(req, `order.${status}`, order._id);
    ok(res, order);
  }),
);
commerceRouter.post(
  '/admin/orders/:id/refund',
  requireAuth,
  requireAdmin,
  route(async () =>
    fail(
      501,
      'Refunds require a configured payment provider with refund support. No refund has been recorded.',
    ),
  ),
);
commerceRouter.get(
  '/admin/coupons',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    const { page, limit } = paging(req.query);
    const filter = req.query.search ? { code: searchPattern(req.query.search) } : {};
    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Coupon.countDocuments(filter),
    ]);
    ok(res, coupons, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }),
);
commerceRouter.post(
  '/admin/coupons',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    const coupon = await Coupon.create(couponSchema.parse(req.body));
    await audit(req, 'coupon.created', coupon._id);
    ok(res, coupon, 201);
  }),
);
commerceRouter.patch(
  '/admin/coupons/:id',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    objectId.parse(req.params.id);
    const existing = await Coupon.findById(req.params.id);
    if (!existing) fail(404, 'Coupon not found');
    const allowed = z
      .object({
        code: z.string().optional(),
        type: z.enum(['percentage', 'fixed']).optional(),
        value: z.number().optional(),
        minimumOrderAmount: z.number().optional(),
        maximumDiscount: z.number().nullable().optional(),
        usageLimit: z.number().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const input = couponSchema.parse({ ...existing.toObject(), ...allowed });
    Object.assign(existing, input);
    await existing.save();
    await audit(req, 'coupon.updated', existing._id);
    ok(res, existing);
  }),
);
commerceRouter.delete(
  '/admin/coupons/:id',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    objectId.parse(req.params.id);
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!coupon) fail(404, 'Coupon not found');
    await audit(req, 'coupon.archived', coupon._id);
    ok(res, coupon);
  }),
);

commerceRouter.post(
  '/admin/orders/:id/collect-cod',
  requireAuth,
  requireAdmin,
  route(async (req, res) => {
    objectId.parse(req.params.id);
    const input = z.object({ confirmed: z.literal(true) }).parse(req.body);
    if (!input.confirmed) return;
    ok(res, await collectCashOnDelivery(req.params.id, req.user._id));
  }),
);
