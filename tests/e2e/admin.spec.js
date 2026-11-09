import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = 'http://127.0.0.1:4100/api/v1';
const origin = 'http://localhost:5180';

async function searchAdmin(page, resource, value) {
  await page.getByPlaceholder(`Search ${resource}`).fill(value);
  await expect(page).toHaveURL(
    new RegExp(`q=${encodeURIComponent(value).replaceAll('%20', '\\+')}`),
  );
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText(value, { exact: true })).toBeVisible();
}

test('administrator creates, edits and archives catalog records and advances an order through the UI', async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const categoryName = `Studio Edit ${suffix}`;
  const productName = `Studio Linen Shirt ${suffix}`;
  const sku = `STUDIO-${suffix}-M`;
  await page.goto('/login');
  await page.locator('#email').fill('e2e-admin@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('E2e-only-password-482!');
  const loginResponse = page.waitForResponse(
    (response) => response.url().endsWith('/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const login = await loginResponse;
  expect(login.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Hello, LUNA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible();

  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Add category' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(categoryName);
  await dialog.getByLabel('URL slug').fill(`studio-edit-${suffix}`);
  await dialog.getByLabel('Description', { exact: true }).fill('A focused edit of linen pieces.');
  const createCategory = page.waitForResponse(
    (response) =>
      response.url().endsWith('/admin/categories') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  expect((await createCategory).status()).toBe(201);
  await expect(dialog).not.toBeVisible();
  await searchAdmin(page, 'categories', categoryName);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('A refined edit, updated in the studio.');
  const editCategory = page.waitForResponse(
    (response) =>
      response.url().includes('/admin/categories/') && response.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  expect((await editCategory).status()).toBe(200);
  await expect(dialog).not.toBeVisible();

  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Add product' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(productName);
  await dialog.getByLabel('URL slug').fill(`studio-linen-${suffix}`);
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('An easy linen shirt with a relaxed silhouette and considered details.');
  await dialog.getByLabel('Category', { exact: true }).selectOption({ label: categoryName });
  await dialog.getByLabel('Base price (EGP)').fill('1290');
  await dialog.getByLabel('SKU 1', { exact: true }).fill(sku);
  await dialog.getByLabel('Size 1', { exact: true }).fill('M');
  await dialog.getByLabel('Stock 1', { exact: true }).fill('8');
  await dialog
    .getByLabel('Add existing image URL')
    .fill('https://images.unsplash.com/photo-1483985988355-763728e1935b');
  await dialog.getByRole('button', { name: 'Add image URL' }).click();
  const createProduct = page.waitForResponse(
    (response) =>
      response.url().endsWith('/admin/products') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const createdProductResponse = await createProduct;
  expect(createdProductResponse.status()).toBe(201);
  const product = (await createdProductResponse.json()).data;
  await expect(dialog).not.toBeVisible();
  await searchAdmin(page, 'products', productName);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Base price (EGP)').fill('1490');
  const editProduct = page.waitForResponse(
    (response) =>
      response.url().includes('/admin/products/') && response.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  expect((await editProduct).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('tbody')).toContainText('1,490');

  // The order fixture is created through the real API so this test does not depend on another test's purchase.
  const customerResponse = await request.post(`${api}/auth/register`, {
    headers: { Origin: origin },
    data: {
      name: 'Studio Customer',
      email: `studio-${suffix}@example.invalid`,
      password: 'Studio-customer-482!',
    },
  });
  expect(customerResponse.status()).toBe(201);
  const customer = (await customerResponse.json()).data;
  const orderResponse = await request.post(`${api}/orders`, {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${customer.accessToken}`,
      'Idempotency-Key': randomUUID(),
    },
    data: {
      items: [{ productId: product._id, sku, quantity: 1 }],
      customer: {
        name: 'Studio Customer',
        email: `studio-${suffix}@example.invalid`,
        phone: '01012345678',
      },
      shippingAddress: {
        governorate: 'Cairo',
        city: 'Cairo',
        street: '12 Studio Street',
        building: '12',
      },
      shippingMethod: 'standard',
      paymentMethod: 'cod',
    },
  });
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()).data;
  expect(order.fulfillmentStatus).toBe('confirmed');
  await page.goto('/admin/orders');
  await searchAdmin(page, 'orders', order.orderNumber);
  await page.getByRole('button', { name: 'View / update' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Fulfillment status').selectOption('processing');
  const updateOrder = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/admin/orders/${order._id}/status`) &&
      response.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Update order status' }).click();
  expect((await updateOrder).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('tbody')).toContainText('processing');
  const persistedOrder = await request.get(`${api}/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${customer.accessToken}` },
  });
  expect(persistedOrder.status()).toBe(200);
  expect((await persistedOrder.json()).data.fulfillmentStatus).toBe('processing');

  for (const nextStatus of ['shipped', 'delivered']) {
    await page.getByRole('button', { name: 'View / update' }).click();
    const orderDialog = page.getByRole('dialog');
    await orderDialog.getByLabel('Fulfillment status').selectOption(nextStatus);
    await orderDialog.getByRole('button', { name: 'Update order status' }).click();
    await expect(orderDialog).not.toBeVisible();
    await expect(page.locator('tbody')).toContainText(nextStatus);
  }
  await page.getByRole('button', { name: 'View / update' }).click();
  const collectionDialog = page.getByRole('dialog');
  await expect(
    collectionDialog.getByRole('button', { name: 'Record cash payment collected' }),
  ).toBeDisabled();
  await collectionDialog.getByLabel('I confirm the full cash payment has been received.').check();
  await collectionDialog.getByRole('button', { name: 'Record cash payment collected' }).click();
  await expect(collectionDialog).not.toBeVisible();
  const paidOrder = await request.get(`${api}/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${customer.accessToken}` },
  });
  expect((await paidOrder.json()).data.paymentStatus).toBe('paid');

  await page.goto('/admin/products');
  await searchAdmin(page, 'products', productName);
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Archive item', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('tbody')).toContainText('Inactive');
  await page.goto('/admin/categories');
  await searchAdmin(page, 'categories', categoryName);
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Archive item', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('tbody')).toContainText('Inactive');
});
