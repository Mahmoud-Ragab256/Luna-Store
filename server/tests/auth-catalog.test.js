import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, Session, Product, Category, ContactMessage } from '../src/database/models.js';
import { connectDatabase } from '../src/database/connection.js';
import { seedDatabase } from '../src/database/seeds/seed.js';
import { hashToken } from '../src/modules/auth/auth.service.js';
let replica;
const origin = 'http://localhost:5173';
const account = { name: 'Mariam Hassan', email: 'mariam@example.test', password: 'a-strong-password-2026' };
const cookie = (response) => response.headers['set-cookie']?.[0]?.split(';')[0];
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await connectDatabase(replica.getUri('luna_test')); await Promise.all(Object.values(mongoose.models).map((Model) => Model.init())); });
afterAll(async () => { await mongoose.disconnect(); if (replica) await replica.stop(); });
beforeEach(async () => { await Promise.all(Object.values(mongoose.models).map((Model) => Model.deleteMany({}))); });
describe('Authentication and session boundaries', () => {
  it('restricts email connection tests to admins and fails closed without SMTP configuration', async () => {
    expect((await request(app).post('/api/v1/admin/email/test').send({ to: account.email })).status).toBe(401);
    const registered = await request(app).post('/api/v1/auth/register').send(account);
    const authorization = `Bearer ${registered.body.data.accessToken}`;
    expect((await request(app).post('/api/v1/admin/email/test').set('Authorization', authorization).send({ to: account.email })).status).toBe(403);
    await User.updateOne({ email: account.email }, { $set: { role: 'admin' } });
    expect((await request(app).post('/api/v1/admin/email/test').set('Authorization', authorization).send({ to: 'invalid' })).status).toBe(422);
    expect((await request(app).post('/api/v1/admin/email/test').set('Authorization', authorization).send({ to: account.email })).status).toBe(503);
  });
  it('registers with a hashed password and a HttpOnly refresh cookie; rejects invalid data', async () => {
    const invalid = await request(app).post('/api/v1/auth/register').send({ ...account, password: 'short' }); expect(invalid.status).toBe(422);
    const response = await request(app).post('/api/v1/auth/register').send(account); expect(response.status).toBe(201); expect(response.body.data.user.email).toBe(account.email); expect(response.body.data.user.passwordHash).toBeUndefined(); expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    const stored = await User.findOne().select('+passwordHash'); expect(stored.passwordHash).not.toBe(account.password);
    expect((await Session.findOne()).refreshTokenHash).not.toBe(cookie(response).split('=')[1]);
  });
  it('rotates multiple times and rejects replay by revoking the entire family', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(account);
    const firstCookie = cookie(registered);
    const first = await request(app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', firstCookie); expect(first.status).toBe(200); expect(cookie(first)).not.toBe(firstCookie);
    const second = await request(app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', cookie(first)); expect(second.status).toBe(200);
    const replay = await request(app).post('/api/v1/auth/refresh').set('Origin', origin).set('Cookie', firstCookie); expect(replay.status).toBe(401);
    const denied = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${second.body.data.accessToken}`); expect(denied.status).toBe(401);
  });
  it('protects admin APIs and prevents cross-origin refresh/logout', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(account);
    expect((await request(app).get('/api/v1/admin/products')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/products').set('Authorization', `Bearer ${registered.body.data.accessToken}`)).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/refresh').set('Origin', 'https://attacker.invalid').set('Cookie', cookie(registered))).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie(registered))).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${registered.body.data.accessToken}`)).status).toBe(401);
  });
  it('uses generic login failures and does not allow registration role escalation', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({ ...account, role: 'admin' }); expect(registered.body.data.user.role).toBe('customer');
    const invalid = await request(app).post('/api/v1/auth/login').send({ email: account.email, password: 'incorrect' });
    const missing = await request(app).post('/api/v1/auth/login').send({ email: 'missing@example.test', password: 'incorrect' });
    expect(invalid.status).toBe(401); expect(missing.body.error.message).toBe(invalid.body.error.message);
    expect((await request(app).post('/api/v1/auth/login').send({ email: account.email, password: account.password })).status).toBe(200);
  });
  it('consumes reset and verification tokens once and revokes previous access after password reset', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(account);
    const token = 'valid-test-token-with-more-than-thirty-two-characters';
    await User.updateOne({ email: account.email }, { $set: { resetTokenHash: hashToken(token), resetExpiresAt: new Date(Date.now() + 60000), verifyTokenHash: hashToken(token), verifyExpiresAt: new Date(Date.now() + 60000) } });
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'replacement-password-2026' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'replacement-password-2026' })).status).toBe(400);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${registered.body.data.accessToken}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: account.email, password: 'replacement-password-2026' })).status).toBe(200);
  });
});
describe('Catalog, admin CRUD and customer data', () => {
  it('seeds 40 real MongoDB products and filters/paginates on the server', async () => {
    await seedDatabase(); expect(await Product.countDocuments()).toBe(40); expect(await Category.countDocuments()).toBe(12);
    const response = await request(app).get('/api/v1/products?category=dresses&size=M&sort=price-asc&limit=2');
    expect(response.status).toBe(200); expect(response.body.data).toHaveLength(2); expect(response.body.meta.total).toBe(4); expect(response.body.data[0].catalogPrice).toBeLessThanOrEqual(response.body.data[1].catalogPrice);
    expect((await request(app).get('/api/v1/products?minPrice=oops')).status).toBe(422);
    expect((await request(app).get('/api/v1/products?search=%5B')).status).toBe(200);
    const discounted = await request(app).get('/api/v1/products?category=dresses&maxPrice=1650&sort=price-asc');
    expect(discounted.body.data.some((product) => product.basePrice > 1650 && product.catalogPrice <= 1650)).toBe(true);
  });
  it('permits validated admin product/category create/update/archive and rejects duplicate SKUs', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send(account); await User.updateOne({ email: account.email }, { $set: { role: 'admin' } });
    const authorization = `Bearer ${registered.body.data.accessToken}`;
    const category = await request(app).post('/api/v1/admin/categories').set('Authorization', authorization).send({ name: 'Dresses', slug: 'dresses' }); expect(category.status).toBe(201);
    const input = { name: 'Linen dress', slug: 'linen-dress', description: 'A relaxed summer dress.', categoryId: category.body.data._id, images: ['/images/catalog/fashion-1.jpg'], basePrice: 1200, discount: 15, isFeatured: true, tags: ['essentials'], variants: [{ sku: 'DRESS-M-SAND', size: 'M', color: 'Sand', stock: 3 }] };
    const product = await request(app).post('/api/v1/admin/products').set('Authorization', authorization).send(input); expect(product.status).toBe(201);
    expect((await request(app).post('/api/v1/admin/products').set('Authorization', authorization).send({ ...input, name: 'Other dress', slug: 'other-dress' })).status).toBe(409);
    const edited = await request(app).patch(`/api/v1/admin/products/${product.body.data._id}`).set('Authorization', authorization).send({ basePrice: 1350 });
    expect(edited.body.data.basePrice).toBe(1350); expect(edited.body.data.discount).toBe(15); expect(edited.body.data.isFeatured).toBe(true); expect(edited.body.data.tags).toEqual(['essentials']);
    expect((await request(app).delete(`/api/v1/admin/products/${product.body.data._id}`).set('Authorization', authorization)).status).toBe(200);
    expect((await request(app).get('/api/v1/products/linen-dress')).status).toBe(404);
    expect((await request(app).patch(`/api/v1/admin/categories/${category.body.data._id}`).set('Authorization', authorization).send({ displayOrder: 5 })).status).toBe(200);
    expect((await request(app).delete(`/api/v1/admin/categories/${category.body.data._id}`).set('Authorization', authorization)).status).toBe(200);
  });
  it('stores contact messages and blocks the honeypot', async () => {
    const input = { name: 'Mariam', email: account.email, subject: 'Size question', message: 'Can you help me choose a size?' };
    expect((await request(app).post('/api/v1/contact').send(input)).status).toBe(201); expect(await ContactMessage.countDocuments()).toBe(1);
    expect((await request(app).post('/api/v1/contact').send({ ...input, website: 'spam.invalid' })).status).toBe(422);
  });
});
