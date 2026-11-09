import { getPaymentProvider } from '../../integrations/payment/provider.js';
import { enqueueEmail, deliverEmailOutbox } from '../../integrations/email/outbox.service.js';
import { logger } from '../../config/logger.js';
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import {
  Product,
  Cart,
  Order,
  Payment,
  Coupon,
  InventoryReservation,
  AuditLog,
} from '../../database/models.js';
import { calculateShipping } from './shipping.js';
const fail = (statusCode, message) => {
  throw Object.assign(new Error(message), { statusCode });
};
const cents = (value) => Math.round(value * 100);
const amount = (value) => Math.round(value) / 100;

/** Consolidate duplicate lines before stock checks, preventing quantity-limit bypass. */
export function normalizeItems(items) {
  const merged = new Map();
  for (const item of items) {
    const variantSku = item.variantSku || item.sku;
    const key = `${item.productId}:${variantSku}`;
    merged.set(key, {
      productId: String(item.productId),
      variantSku,
      quantity: item.quantity + (merged.get(key)?.quantity || 0),
    });
  }
  const result = [...merged.values()].sort((a, b) =>
    `${a.productId}:${a.variantSku}`.localeCompare(`${b.productId}:${b.variantSku}`),
  );
  if (
    result.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20,
    )
  )
    fail(422, 'Choose between 1 and 20 of each variant');
  return result;
}

/** Catalogue values are the only source of price and availability. */
export async function quoteCart(input, session = null) {
  const requested = normalizeItems(input.items);
  const products = await Product.find({
    _id: { $in: requested.map((item) => item.productId) },
    isActive: true,
  })
    .session(session)
    .lean();
  let subtotalCents = 0;
  const items = requested.map((item) => {
    const product = products.find((entry) => String(entry._id) === item.productId);
    if (!product) fail(409, 'A product in your bag is unavailable. Remove it to continue.');
    const variant = product.variants.find((entry) => entry.sku === item.variantSku);
    if (!variant || variant.stock < item.quantity)
      fail(409, `${product.name}: selected quantity is unavailable`);
    const original = cents(variant.priceOverride ?? product.basePrice);
    const price = Math.round(
      original * (1 - Math.min(100, Math.max(0, product.discount || 0)) / 100),
    );
    subtotalCents += price * item.quantity;
    return {
      ...item,
      sku: item.variantSku,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      unitPrice: amount(price),
      originalPrice: amount(original),
      discount: amount(original - price),
      stock: variant.stock,
    };
  });
  let discountCents = 0;
  const couponCode = input.couponCode?.trim().toUpperCase();
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode, isActive: true })
      .session(session)
      .lean();
    if (
      !coupon ||
      (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
      (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit)
    )
      fail(422, 'This coupon is unavailable or expired');
    if (subtotalCents < cents(coupon.minimumOrderAmount || 0))
      fail(422, `This coupon requires EGP ${coupon.minimumOrderAmount}`);
    discountCents =
      coupon.type === 'percentage'
        ? Math.round((subtotalCents * coupon.value) / 100)
        : cents(coupon.value);
    if (coupon.maximumDiscount != null)
      discountCents = Math.min(discountCents, cents(coupon.maximumDiscount));
    discountCents = Math.min(subtotalCents, discountCents);
  }
  const shipping = calculateShipping(
    input.governorate || 'Cairo',
    input.shippingMethod || 'standard',
    amount(subtotalCents - discountCents),
  );
  return {
    items,
    subtotal: amount(subtotalCents),
    discount: amount(discountCents),
    shippingFee: shipping.fee,
    total: amount(subtotalCents - discountCents + cents(shipping.fee)),
    couponCode: couponCode || '',
    shipping,
  };
}

export async function getCart(userId) {
  return (await Cart.findOne({ userId }).lean()) || { userId, items: [], couponCode: '' };
}
export async function hydrateCart(cart) {
  const raw = cart.toObject?.() || cart;
  if (!raw.items.length)
    return { ...raw, items: [], subtotal: 0, discount: 0, shippingFee: 0, total: 0 };
  const quote = await quoteCart({ items: raw.items, couponCode: raw.couponCode });
  return {
    ...raw,
    ...quote,
    items: quote.items.map((item) => {
      const persisted = raw.items.find(
        (entry) =>
          String(entry.productId) === item.productId && entry.variantSku === item.variantSku,
      );
      return {
        ...item,
        ...(persisted?._id ? { _id: persisted._id, id: String(persisted._id) } : {}),
      };
    }),
  };
}
export async function replaceCart(userId, items, couponCode = '') {
  const normalized = normalizeItems(items);
  if (normalized.length) await quoteCart({ items: normalized, couponCode });
  return Cart.findOneAndUpdate(
    { userId },
    {
      $set: { items: normalized, couponCode: normalized.length ? couponCode : '' },
      $inc: { __v: 1 },
    },
    { upsert: true, new: true, runValidators: true },
  );
}
export async function mergeCart(userId, incoming, couponCode, strategy = 'add') {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cart = await Cart.findOne({ userId }).lean();
    const previous = cart?.items || [];
    // Login merges use the greater quantity, making a repeated guest-cart sync idempotent.
    const additions =
      strategy === 'maximum'
        ? normalizeItems(incoming)
            .map((item) => ({
              ...item,
              quantity: Math.max(
                0,
                item.quantity -
                  (previous.find(
                    (entry) =>
                      String(entry.productId) === item.productId &&
                      entry.variantSku === item.variantSku,
                  )?.quantity || 0),
              ),
            }))
            .filter((item) => item.quantity > 0)
        : incoming;
    const items = normalizeItems([...previous, ...additions]);
    if (items.length > 50) fail(422, 'Your bag can hold up to 50 variants');
    if (items.length) await quoteCart({ items, couponCode: couponCode || cart?.couponCode || '' });
    if (!cart) {
      try {
        return await Cart.create({ userId, items, couponCode: couponCode || '' });
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
    }
    const updated = await Cart.findOneAndUpdate(
      { _id: cart._id, __v: cart.__v },
      { $set: { items, couponCode: couponCode ?? cart.couponCode }, $inc: { __v: 1 } },
      { new: true },
    );
    if (updated) return updated;
  }
  fail(409, 'Your bag changed in another tab. Please try again.');
}
export async function updateCartItem(userId, itemId, quantity) {
  const cart = await Cart.findOne({ userId });
  const item = cart?.items.id(itemId);
  if (!item) fail(404, 'Bag item not found');
  if (quantity === 0) cart.items.pull(itemId);
  else item.quantity = quantity;
  if (cart.items.length) await quoteCart({ items: cart.items, couponCode: cart.couponCode });
  try {
    await cart.save();
  } catch (error) {
    if (error.name === 'VersionError') fail(409, 'Your bag changed. Please try again.');
    throw error;
  }
  return cart;
}
export function onlinePaymentsEnabled() {
  return getPaymentProvider().available;
}

/** Atomically create snapshots, claim stock, consume a coupon and reserve inventory. */
export async function createOrder(userId, rawInput, idempotencyKey) {
  await expireReservations();
  const input = { ...rawInput, items: normalizeItems(rawInput.items) };
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const existing = await Order.findOne({ userId, idempotencyKey });
  if (existing) {
    if (existing.requestHash !== requestHash)
      fail(409, 'Idempotency key was used with different order details');
    return existing;
  }
  if (input.paymentMethod === 'online' && !onlinePaymentsEnabled())
    fail(503, 'Online payments are not configured. Choose Cash on Delivery.');
  let order;
  try {
    await mongoose.connection.transaction(async (session) => {
      const quote = await quoteCart(
        { ...input, governorate: input.shippingAddress.governorate },
        session,
      );
      for (const item of quote.items) {
        const result = await Product.updateOne(
          {
            _id: item.productId,
            isActive: true,
            variants: { $elemMatch: { sku: item.variantSku, stock: { $gte: item.quantity } } },
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session },
        );
        if (result.modifiedCount !== 1) fail(409, `${item.name} just sold out. Update your bag.`);
      }
      if (quote.couponCode) {
        const result = await Coupon.updateOne(
          {
            code: quote.couponCode,
            isActive: true,
            $and: [
              { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
              { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
            ],
          },
          { $inc: { usageCount: 1 } },
          { session },
        );
        if (result.modifiedCount !== 1) fail(409, 'This coupon has reached its usage limit');
      }
      const reserved = input.paymentMethod === 'online';
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      [order] = await Order.create(
        [
          {
            orderNumber: `LUNA-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId,
            items: quote.items,
            customerSnapshot: input.customer,
            shippingAddressSnapshot: input.shippingAddress,
            shippingMethod: input.shippingMethod,
            subtotal: quote.subtotal,
            discount: quote.discount,
            shippingFee: quote.shippingFee,
            total: quote.total,
            couponCode: quote.couponCode,
            paymentMethod: input.paymentMethod,
            paymentStatus: 'pending',
            fulfillmentStatus: reserved ? 'pending' : 'confirmed',
            inventoryStatus: reserved ? 'reserved' : 'committed',
            reservationExpiresAt: reserved ? expiresAt : null,
            idempotencyKey,
            requestHash,
          },
        ],
        { session },
      );
      await InventoryReservation.create(
        quote.items.map((item) => ({
          orderId: order._id,
          productId: item.productId,
          variantSku: item.variantSku,
          quantity: item.quantity,
          status: reserved ? 'reserved' : 'committed',
          expiresAt,
        })),
        { session },
      );
      await Cart.updateOne(
        { userId },
        { $set: { items: [], couponCode: '' }, $inc: { __v: 1 } },
        { session },
      );
      await enqueueEmail(
        {
          key: `order:${order._id}:received`,
          to: input.customer.email,
          subject: `LUNA order ${order.orderNumber} received`,
          text: `Thank you for your order, ${input.customer.name}.\n\nOrder: ${order.orderNumber}\nTotal: EGP ${quote.total.toFixed(2)}\nPayment: ${input.paymentMethod === 'cod' ? 'Cash on delivery; payment pending collection' : 'Online payment simulation; no money will be charged'}\n\nTrack your order: ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/orders/${order._id}`,
        },
        session,
      );
    });
  } catch (error) {
    if (error.code === 11000) {
      const replay = await Order.findOne({ userId, idempotencyKey });
      if (replay?.requestHash === requestHash) return replay;
      if (replay) fail(409, 'Idempotency key was used with different order details');
    }
    throw error;
  }
  await deliverEmailOutbox({ limit: 1 }).catch(() =>
    logger.warn('Order email remains queued for retry.'),
  );
  return order;
}
export async function findOwnedOrder(userId, orderId, session = null) {
  if (!mongoose.isValidObjectId(orderId)) fail(404, 'Order not found');
  const order = await Order.findOne({ _id: orderId, userId }).session(session);
  if (!order) fail(404, 'Order not found');
  return order;
}
async function releaseInventory(order, session) {
  if (order.inventoryStatus === 'released') return;
  for (const item of order.items)
    await Product.updateOne(
      { _id: item.productId, 'variants.sku': item.variantSku },
      { $inc: { 'variants.$.stock': item.quantity } },
      { session },
    );
  await InventoryReservation.updateMany(
    { orderId: order._id, status: { $in: ['reserved', 'committed'] } },
    { $set: { status: 'released' } },
    { session },
  );
  if (order.couponCode)
    await Coupon.updateOne(
      { code: order.couponCode, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } },
      { session },
    );
  order.inventoryStatus = 'released';
}
export async function cancelOrder(userId, orderId, admin = false) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = admin
      ? await Order.findById(orderId).session(session)
      : await findOwnedOrder(userId, orderId, session);
    if (!order) fail(404, 'Order not found');
    if (order.fulfillmentStatus === 'canceled') {
      result = order;
      return;
    }
    if (!['pending', 'confirmed'].includes(order.fulfillmentStatus))
      fail(409, 'This order can no longer be canceled');
    if (order.paymentStatus === 'paid')
      fail(409, 'A paid order needs a provider refund before cancellation');
    await releaseInventory(order, session);
    order.fulfillmentStatus = 'canceled';
    await order.save({ session });
    await Payment.updateMany(
      { orderId: order._id, status: 'pending' },
      { $set: { status: 'canceled' } },
      { session },
    );
    result = order;
  });
  return result;
}
export async function expireReservations(now = new Date()) {
  const candidates = await Order.find({
    inventoryStatus: 'reserved',
    reservationExpiresAt: { $lte: now },
  })
    .select('_id')
    .limit(100)
    .lean();
  for (const candidate of candidates)
    await mongoose.connection.transaction(async (session) => {
      const order = await Order.findOne({
        _id: candidate._id,
        inventoryStatus: 'reserved',
        reservationExpiresAt: { $lte: now },
      }).session(session);
      if (!order) return;
      await releaseInventory(order, session);
      order.fulfillmentStatus = 'canceled';
      order.paymentStatus = 'failed';
      await order.save({ session });
      await Payment.updateMany(
        { orderId: order._id, status: 'pending' },
        { $set: { status: 'failed' } },
        { session },
      );
    });
  return candidates.length;
}
export async function createPaymentSession(userId, orderId) {
  if (!onlinePaymentsEnabled()) fail(503, 'Online payment provider is not configured');
  const order = await findOwnedOrder(userId, orderId);
  if (
    order.paymentMethod !== 'online' ||
    order.inventoryStatus !== 'reserved' ||
    order.reservationExpiresAt <= new Date()
  )
    fail(409, 'This order is not awaiting payment');
  const transaction = await getPaymentProvider().createTransaction({
    amount: order.total,
    currency: 'EGP',
  });
  const payment = await Payment.findOneAndUpdate(
    { orderId: order._id },
    {
      $setOnInsert: {
        provider: 'development-mock',
        providerTransactionId: transaction.providerTransactionId,
        amount: order.total,
        currency: 'EGP',
        status: 'pending',
        idempotencyKey: String(order._id),
        eventIds: [],
      },
    },
    { upsert: true, new: true },
  );
  return {
    provider: 'development-mock',
    developmentOnly: true,
    paymentId: payment._id,
    orderId: order._id,
    amount: order.total,
    currency: 'EGP',
    status: payment.status,
  };
}
export async function confirmMockPayment(userId, orderId, outcome) {
  if (!onlinePaymentsEnabled()) fail(404, 'Payment adapter not available');
  const order = await findOwnedOrder(userId, orderId);
  const payment = await Payment.findOne({ orderId: order._id });
  if (!payment) fail(409, 'Start a payment session first');
  await Payment.updateOne(
    { _id: payment._id, status: 'pending' },
    { $set: { providerStatus: outcome } },
  );
  return applyPaymentOutcome(
    payment.providerTransactionId,
    outcome,
    `mock:${payment.providerTransactionId}:${outcome}`,
  );
}
/** Payment transitions and inventory commits share one transaction and replay guard. */
export async function applyPaymentOutcome(providerTransactionId, outcome, eventId) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findOne({ providerTransactionId }).session(session);
    if (!payment) fail(404, 'Payment transaction not found');
    const order = await Order.findById(payment.orderId).session(session);
    if (payment.eventIds.includes(eventId) || payment.status === 'paid') {
      result = order;
      return;
    }
    if (payment.status !== 'pending') fail(409, 'Payment is already finalized');
    if (order.inventoryStatus !== 'reserved' || order.reservationExpiresAt <= new Date())
      fail(409, 'This checkout has expired');
    payment.eventIds.push(eventId);
    payment.status = outcome;
    if (outcome === 'paid') {
      order.inventoryStatus = 'committed';
      order.paymentStatus = 'paid';
      order.fulfillmentStatus = 'confirmed';
      await InventoryReservation.updateMany(
        { orderId: order._id, status: 'reserved' },
        { $set: { status: 'committed' } },
        { session },
      );
    } else {
      await releaseInventory(order, session);
      order.paymentStatus = 'failed';
      order.fulfillmentStatus = 'canceled';
    }
    await payment.save({ session });
    await order.save({ session });
    result = order;
  });
  return result;
}
const transitions = {
  pending: ['confirmed', 'canceled'],
  confirmed: ['processing', 'canceled'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: ['returned'],
  returned: [],
  canceled: [],
};
export async function updateFulfillment(orderId, status) {
  const order = await Order.findById(orderId);
  if (!order) fail(404, 'Order not found');
  if (status === order.fulfillmentStatus) return order;
  if (!transitions[order.fulfillmentStatus]?.includes(status))
    fail(409, 'This order status transition is not allowed');
  if (status === 'canceled') return cancelOrder(null, orderId, true);
  if (order.inventoryStatus !== 'committed')
    fail(409, 'Payment must be confirmed before fulfillment');
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, fulfillmentStatus: order.fulfillmentStatus },
    {
      $set: {
        fulfillmentStatus: status,
      },
    },
    { new: true },
  );
  if (!updated) fail(409, 'Order changed. Refresh and try again.');
  return updated;
}

/** Record actual COD collection only after delivery; retries cannot double-count payment. */
export async function collectCashOnDelivery(orderId, adminId) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) fail(404, 'Order not found');
    if (order.paymentMethod !== 'cod')
      fail(409, 'Only cash-on-delivery orders can be recorded here');
    if (order.fulfillmentStatus !== 'delivered')
      fail(409, 'Cash collection can be recorded after delivery');
    if (order.paymentStatus === 'paid') {
      result = order;
      return;
    }
    if (order.paymentStatus !== 'pending') fail(409, 'This payment cannot be collected');
    order.paymentStatus = 'paid';
    await order.save({ session });
    await Payment.create(
      [
        {
          orderId: order._id,
          provider: 'cash-on-delivery',
          providerTransactionId: 'cod_' + order._id,
          amount: order.total,
          currency: 'EGP',
          status: 'paid',
          paidAt: new Date(),
          idempotencyKey: 'cod_' + order._id,
        },
      ],
      { session },
    );
    await AuditLog.create(
      [
        {
          userId: adminId,
          action: 'payment.cod-collected',
          resource: 'order',
          resourceId: String(order._id),
        },
      ],
      { session },
    );
    result = order;
  });
  return result;
}
