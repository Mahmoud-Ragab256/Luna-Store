import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const api = 'http://127.0.0.1:4100/api/v1';
test('catalog filters, variant bag, guest persistence, mobile and desktop storefront', async ({
  page,
}) => {
  await mkdir('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A softer kind/ })).toBeVisible();
  await expect(page.locator('.category-tile').first()).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  expect(await page.evaluate(() => [...document.images].every((img) => img.naturalWidth > 0))).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
  await page.screenshot({ path: 'artifacts/home-desktop-viewport.png' });
  await page.goto('/products');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('linen');
  await expect(page).toHaveURL(/search=linen/);
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page).not.toHaveURL(/search=/);
  await page.getByLabel('Sort by').selectOption('price-asc');
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.locator('.product-card').first().locator('h3').click();
  await expect(page.getByRole('button', { name: /Add to bag/ })).toBeDisabled();
  await page.locator('.variant-options').first().getByRole('button').first().click();
  await page.locator('.variant-options.sizes').locator('button:not([disabled])').first().click();
  await page.getByRole('button', { name: /Add to bag/ }).click();
  await page.goto('/cart');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expect(page.locator('.totals')).toBeVisible();
  await page.reload();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.category-tile').first()).toBeVisible();
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((img) => (img.loading = 'eager'));
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
  await page.screenshot({ path: 'artifacts/home-mobile-viewport.png' });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('register, COD checkout, order history and ownership', async ({ page, request }) => {
  const email = `shopper-${Date.now()}@example.invalid`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Luna Shopper');
  await page.locator('#email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Customer-test-921!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/account/);
  await page.goto('/products');
  await page.locator('.product-card').first().locator('h3').click();
  await page.locator('.variant-options').first().getByRole('button').first().click();
  await page.locator('.variant-options.sizes').getByRole('button').first().click();
  await page.getByRole('button', { name: /Add to bag/ }).click();
  await page.goto('/checkout');
  await page.getByLabel('Egyptian mobile number').fill('01012345678');
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByLabel('Governorate', { exact: true }).selectOption('Cairo');
  await page.getByLabel('City', { exact: true }).fill('Cairo');
  await page.getByLabel('Street address', { exact: true }).fill('12 Test Street');
  await page.getByLabel('Building', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByRole('button', { name: 'Continue', exact: false }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/orders\/[a-f\d]{24}/);
  await expect(page.locator('.order-status')).toContainText('Payment: pending');
  await page.goto('/orders');
  await expect(page.locator('.order-card')).toHaveCount(1);
  const health = await request.get(`${api}/health`);
  expect(health.ok()).toBe(true);
});
test('admin API creates a product and the protected UI finds it', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: 'e2e-admin@example.invalid', password: 'E2e-only-password-482!' },
    headers: { Origin: 'http://localhost:5180' },
  });
  expect(login.ok()).toBe(true);
  const { data: admin } = await login.json();
  const headers = { Authorization: `Bearer ${admin.accessToken}`, Origin: 'http://localhost:5180' };
  const categories = await (await request.get(`${api}/categories`)).json();
  const name = `E2E Linen Shirt ${Date.now()}`;
  const create = await request.post(`${api}/admin/products`, {
    headers,
    data: {
      name,
      slug: `e2e-shirt-${Date.now()}`,
      description: 'A considered linen shirt for testing the complete store workflow.',
      categoryId: categories.data[0]._id,
      images: ['https://images.unsplash.com/photo-1483985988355-763728e1935b'],
      basePrice: 1290,
      discount: 0,
      variants: [{ sku: `E2E-${Date.now()}`, size: 'M', color: 'Ivory', stock: 4 }],
      isActive: true,
    },
  });
  expect(create.status()).toBe(201);
  await page.goto('/login');
  await page.locator('#email').fill('e2e-admin@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('E2e-only-password-482!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible();
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'Store administration' })).toBeVisible();
  await page.getByPlaceholder(/Search/i).fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test('English LTR, typography, keyboard dialog and recovery states', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of [
    '/',
    '/products',
    '/categories',
    '/contact',
    '/login',
    '/register',
    '/wishlist',
    '/cart',
  ]) {
    await page.goto(route);
    await expect(page.locator('main h1,main h2').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    expect(await page.locator('body').innerText()).not.toMatch(/[\u0600-\u06ff]/);
  }
  await page.goto('/products?search=nonexistent-luna-piece');
  await expect(page.getByRole('heading', { name: 'No pieces found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.locator('.product-card').first()).toBeVisible();
  const quick = page.getByRole('button', { name: /Quick view/ }).first();
  await quick.focus();
  await quick.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(quick).toBeFocused();
  expect(await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    'Playfair Display',
  );
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    'Inter',
  );
  expect(errors).toEqual([]);
});

test('development online payment is labeled and only server verification confirms it', async ({
  page,
  request,
}) => {
  const email = `payment-${Date.now()}@example.invalid`;
  const password = 'Payment-test-password-47!';
  const origin = 'http://localhost:5180';
  const registration = await request.post(`${api}/auth/register`, {
    headers: { Origin: origin },
    data: { name: 'Payment Shopper', email, password },
  });
  expect(registration.status()).toBe(201);
  const customer = (await registration.json()).data;
  const products = (await (await request.get(`${api}/products`)).json()).data;
  const product = products.find((p) => p.variants.some((v) => v.stock > 0));
  const variant = product.variants.find((v) => v.stock > 0);
  const orderResponse = await request.post(`${api}/orders`, {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${customer.accessToken}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: {
      items: [{ productId: product._id, sku: variant.sku, quantity: 1 }],
      customer: { name: 'Payment Shopper', email, phone: '01012345678' },
      shippingAddress: {
        governorate: 'Cairo',
        city: 'Cairo',
        street: '25 Payment Street',
        building: '25',
      },
      shippingMethod: 'standard',
      paymentMethod: 'online',
    },
  });
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()).data;
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible();
  await page.goto(`/payment/${order._id}`);
  await page.getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(page.getByRole('heading', { name: 'Development payment simulator' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment confirmed' })).toBeVisible();
  const status = await request.get(`${api}/payments/${order._id}/status`, {
    headers: { Authorization: `Bearer ${customer.accessToken}` },
  });
  expect((await status.json()).data.paymentStatus).toBe('paid');
});
