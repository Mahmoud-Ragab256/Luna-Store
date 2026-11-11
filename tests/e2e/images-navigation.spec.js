import { test, expect } from '@playwright/test';

test('catalog navigation has exactly one active choice and follows query sorting', async ({
  page,
}) => {
  await page.goto('/products');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Shop', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await navigation.getByRole('link', { name: 'New arrivals' }).click();
  await expect(page).toHaveURL(/sort=newest/);
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: 'New arrivals' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByLabel('Sort by').selectOption('price-asc');
  await expect(navigation.getByRole('link', { name: 'Shop', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
});

test('product image skeleton leaves product details usable and preserves its dimensions', async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/images/catalog/**', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    const card = page.locator('.product-card').first();
    const frame = card.locator('.progressive-image').first();
    await expect(frame).toHaveAttribute('data-image-state', 'loading');
    await expect(card.locator('h3')).toBeVisible();
    const before = await frame.boundingBox();
    await page.screenshot({ path: 'artifacts/product-image-skeleton.png' });
    release();
    await expect(frame).toHaveAttribute('data-image-state', 'loaded');
    const after = await frame.boundingBox();
    expect(Math.abs(before.height - after.height)).toBeLessThan(1);
    expect(Math.abs(before.width - after.width)).toBeLessThan(1);
    await card.getByRole('button', { name: /^Save .* to wishlist$/ }).click();
    await expect(card.getByRole('button', { name: /^Remove .* from wishlist$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await card.hover();
    await card.getByRole('button', { name: 'Quick view' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    release();
  }
});

test('hero shows its preview during loading and recovers from a failed image', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/images/luna-hero-*.webp', async (route) => {
    if (route.request().url().includes('preview')) return route.continue();
    await gate;
    return route.abort();
  });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const hero = page.locator('.hero-image');
    await expect(hero).toHaveAttribute('data-image-state', 'loading');
    await expect(hero.locator('.image-placeholder')).toHaveCSS(
      'background-image',
      /luna-hero-preview.webp/,
    );
    await expect(page.getByRole('heading', { name: /A softer kind/ })).toBeVisible();
    await page.screenshot({ path: 'artifacts/hero-preview-loading.png' });
    release();
    await expect(hero).toHaveAttribute('data-image-state', 'error');
    await expect(hero).toHaveClass(/image-ready/);
    await expect(hero.locator('img')).toHaveAttribute('src', '/images/product-placeholder.svg');
  } finally {
    release();
  }
});
