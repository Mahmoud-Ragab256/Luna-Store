import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createHmac, randomUUID } from 'node:crypto';
import app from '../src/app.js';
import {
  User,
  Session,
  Category,
  Product,
  Cart,
  Order,
  Payment,
  Coupon,
  InventoryReservation,
} from '../src/database/models.js';
import {
  createOrder,
  quoteCart,
  cancelOrder,
  expireReservations,
  createPaymentSession,
  confirmMockPayment,
  mergeCart,
} from '../src/modules/commerce/service.js';
import { checkoutSchema } from '../src/modules/commerce/validation.js';
import { env } from '../src/config/env.js';
import jwt from 'jsonwebtoken';

let mongo, user, otherUser, product, token;
const models = [
  User,
  Session,
  Category,
  Product,
  Cart,
  Order,
  Payment,
  Coupon,
  InventoryReservation,
];
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all(models.map((model) => model.init()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(models.map((model) => model.deleteMany({})));
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  [user, otherUser] = await User.create([
    { name: 'Customer One', email: 'one@example.test', passwordHash: 'test-hash' },
    { name: 'Customer Two', email: 'two@example.test', passwordHash: 'test-hash' },
  ]);
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: randomUUID(),
    tokenFamilyId: randomUUID(),
    expiresAt: new Date(Date.now() + 600000),
  });
  token = jwt.sign({ sid: String(session._id) }, env.JWT_SECRET, {
    subject: String(user._id),
    issuer: 'luna-api',
    audience: 'luna-store',
    expiresIn: '15m',
  });
  const category = await Category.create({ name: 'Dresses', slug: 'dresses' });
  product = await Product.create({
    name: 'Linen dress',
    slug: 'linen-dress',
    categoryId: category._id,
    images: ['/images/dress.svg'],
    basePrice: 1000,
    discount: 10,
    isActive: true,
    variants: [
      { sku: 'DRESS-S-BLACK', size: 'S', color: 'Black', stock: 10 },
      { sku: 'DRESS-M-BLACK', size: 'M', color: 'Black', stock: 5, priceOverride: 1200 },
    ],
  });
});
function input(overrides = {}) {
  return checkoutSchema.parse({
    items: [{ productId: String(product._id), sku: 'DRESS-S-BLACK', quantity: 1 }],
    customer: { name: 'Customer One', email: 'one@example.test', phone: '01012345678' },
    shippingAddress: { governorate: 'Cairo', city: 'Cairo', street: 'Test street', building: '10' },
    paymentMethod: 'cod',
    ...overrides,
  });
}
describe('authoritative checkout', () => {
  it('persists exact bag replacements and returns hydrated variant snapshots with item IDs', async () => {
    const auth = `Bearer ${token}`;
    const first = await request(app)
      .put('/api/v1/cart')
      .set('Authorization', auth)
      .send({ items: input().items });
    expect(first.status).toBe(200);
    expect(first.body.data.items[0].name).toBe('Linen dress');
    expect(first.body.data.items[0]._id).toBeTruthy();
    const saved = await request(app).get('/api/v1/cart').set('Authorization', auth);
    expect(saved.body.data.subtotal).toBe(900);
    const cleared = await request(app)
      .put('/api/v1/cart')
      .set('Authorization', auth)
      .send({ items: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.items).toHaveLength(0);
    expect(cleared.body.data.total).toBe(0);
  });
  it('merges a guest bag idempotently while preserving the greater saved quantity', async () => {
    const items = [{ productId: String(product._id), variantSku: 'DRESS-S-BLACK', quantity: 2 }];
    await mergeCart(user._id, items, undefined, 'maximum');
    await mergeCart(user._id, items, undefined, 'maximum');
    expect((await Cart.findOne({ userId: user._id })).items[0].quantity).toBe(2);
    await mergeCart(user._id, [{ ...items[0], quantity: 3 }], undefined, 'maximum');
    expect((await Cart.findOne({ userId: user._id })).items[0].quantity).toBe(3);
  });
  it('uses server variant prices, discounts and configured shipping instead of submitted totals', async () => {
    const response = await request(app)
      .post('/api/v1/cart/quote')
      .send({
        items: [
          { productId: String(product._id), sku: 'DRESS-M-BLACK', quantity: 2, unitPrice: 1 },
        ],
        total: 1,
      });
    expect(response.status).toBe(200);
    expect(response.body.data.subtotal).toBe(2160);
    expect(response.body.data.total).toBe(2225);
  });
  it('consolidates duplicated lines and rejects an excessive quantity', async () => {
    await expect(
      quoteCart({
        items: [
          { productId: String(product._id), variantSku: 'DRESS-S-BLACK', quantity: 6 },
          { productId: String(product._id), variantSku: 'DRESS-S-BLACK', quantity: 6 },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('creates a COD order with snapshots and decrements stock exactly once on replay', async () => {
    const key = randomUUID();
    const first = await createOrder(user._id, input(), key);
    const replay = await createOrder(user._id, input(), key);
    expect(String(replay._id)).toBe(String(first._id));
    expect(first.total).toBe(965);
    expect(first.items[0].unitPrice).toBe(900);
    expect(first.inventoryStatus).toBe('committed');
    expect((await Product.findById(product._id)).variants[0].stock).toBe(9);
    expect(await Order.countDocuments()).toBe(1);
  });
  it('rejects reuse of an idempotency key with different input', async () => {
    const key = randomUUID();
    await createOrder(user._id, input(), key);
    await expect(
      createOrder(
        user._id,
        input({ items: [{ productId: String(product._id), sku: 'DRESS-S-BLACK', quantity: 2 }] }),
        key,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('does not oversell the final item under concurrent checkouts', async () => {
    await Product.updateOne({ _id: product._id }, { $set: { 'variants.0.stock': 1 } });
    const outcomes = await Promise.allSettled([
      createOrder(user._id, input(), randomUUID()),
      createOrder(otherUser._id, input(), randomUUID()),
    ]);
    expect(outcomes.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(product._id)).variants[0].stock).toBe(0);
  });
  it('protects coupon usage limits under concurrent orders and rolls losing stock updates back', async () => {
    await Coupon.create({ code: 'LASTONE', type: 'fixed', value: 100, usageLimit: 1 });
    const outcomes = await Promise.allSettled([
      createOrder(user._id, input({ couponCode: 'LASTONE' }), randomUUID()),
      createOrder(otherUser._id, input({ couponCode: 'LASTONE' }), randomUUID()),
    ]);
    expect(outcomes.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect((await Coupon.findOne({ code: 'LASTONE' })).usageCount).toBe(1);
    expect((await Product.findById(product._id)).variants[0].stock).toBe(9);
  });
  it('releases stock and coupon use once on repeated cancellation', async () => {
    await Coupon.create({ code: 'WELCOME', type: 'percentage', value: 10, usageLimit: 5 });
    const order = await createOrder(user._id, input({ couponCode: 'WELCOME' }), randomUUID());
    await cancelOrder(user._id, order._id);
    await cancelOrder(user._id, order._id);
    expect((await Product.findById(product._id)).variants[0].stock).toBe(10);
    expect((await Coupon.findOne({ code: 'WELCOME' })).usageCount).toBe(0);
  });
  it('requires authentication, hides other users orders and validates Egyptian phone numbers', async () => {
    expect((await request(app).post('/api/v1/orders').send(input())).status).toBe(401);
    const order = await createOrder(otherUser._id, input(), randomUUID());
    expect(
      (
        await request(app)
          .get(`/api/v1/orders/${order._id}`)
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', randomUUID())
          .send({ ...input(), customer: { ...input().customer, phone: '123' } })
      ).status,
    ).toBe(422);
  });
});
describe('payment and reservation lifecycle', () => {
  it('disables unconfigured online payments without reserving stock', async () => {
    await expect(
      createOrder(user._id, input({ paymentMethod: 'online' }), randomUUID()),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect((await Product.findById(product._id)).variants[0].stock).toBe(10);
  });
  it('expires abandoned reservations and returns stock only once', async () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    const order = await createOrder(user._id, input({ paymentMethod: 'online' }), randomUUID());
    await Order.updateOne(
      { _id: order._id },
      { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } },
    );
    await expireReservations();
    await expireReservations();
    expect((await Order.findById(order._id)).inventoryStatus).toBe('released');
    expect((await Product.findById(product._id)).variants[0].stock).toBe(10);
  });
  it('commits a development payment idempotently and rejects unsigned/unverified webhooks', async () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.MOCK_PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
    const order = await createOrder(user._id, input({ paymentMethod: 'online' }), randomUUID());
    await createPaymentSession(user._id, order._id);
    const payment = await Payment.findOne({ orderId: order._id });
    const event = {
      eventId: 'event-1',
      providerTransactionId: payment.providerTransactionId,
      status: 'paid',
      amount: order.total,
      currency: 'EGP',
    };
    expect((await request(app).post('/api/v1/payments/webhook').send(event)).status).toBe(401);
    const signature = createHmac('sha256', process.env.MOCK_PAYMENT_WEBHOOK_SECRET)
      .update(JSON.stringify(event))
      .digest('hex');
    expect(
      (
        await request(app)
          .post('/api/v1/payments/webhook')
          .set('x-payment-signature', signature)
          .send(event)
      ).status,
    ).toBe(409);
    await confirmMockPayment(user._id, order._id, 'paid');
    await confirmMockPayment(user._id, order._id, 'paid');
    const replay = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .send(event);
    expect(replay.status).toBe(200);
    expect((await Order.findById(order._id)).paymentStatus).toBe('paid');
    expect((await Product.findById(product._id)).variants[0].stock).toBe(9);
  });
});
