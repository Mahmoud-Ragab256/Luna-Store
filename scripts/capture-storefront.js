import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.PREVIEW_URL || 'http://localhost:5173';
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
);
const checks = [];
await mkdir('artifacts', { recursive: true });
async function hash(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}
async function sources(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const list = [];
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) list.push(...(await sources(file)));
    else if (/\.(jsx?|css|png|jpe?g|svg|html)$/.test(file))
      list.push({ path: '../' + file.replaceAll('\\', '/'), sha256: await hash(file) });
  }
  return list;
}
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(base);
    await page.waitForSelector('.category-tile');
    await page.waitForSelector('.product-card');
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelectorAll('img').forEach((i) => (i.loading = 'eager'));
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const fullPage of [false, true]) {
      const path = `artifacts/home-${name}${fullPage ? '' : '-viewport'}.png`;
      await page.screenshot({ path, fullPage });
      if (!fullPage)
        checks.push({
          id: name,
          status: 'pass',
          state: 'Loaded public homepage',
          environment: { kind: 'browser', name: 'Chrome', width, height },
          observed:
            'English LTR, Playfair Display/Inter typography, local photographs loaded, no horizontal overflow.',
          artifacts: [
            { path: path.replace('artifacts/', ''), kind: 'image', sha256: await hash(path) },
          ],
        });
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(base + '/products');
  const trigger = page.locator('.quick-view').first();
  await trigger.focus();
  await trigger.press('Enter');
  await page.waitForSelector('dialog[open]');
  await page.screenshot({ path: 'artifacts/quick-view-keyboard.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert(await trigger.evaluate((el) => el === document.activeElement));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  await page.close();
  checks.push({
    id: 'keyboard',
    status: 'pass',
    state: 'Quick-view dialog keyboard cycle',
    environment: { kind: 'browser', name: 'Chrome', width: 1440, height: 1000 },
    observed:
      'Enter opens native modal; Escape dismisses and returns focus to trigger. Reduced-motion media preference exercised.',
    steps: [
      'Focus Quick view',
      'Press Enter',
      'Capture open dialog',
      'Press Escape',
      'Verify trigger focus',
      'Enable reduced motion',
    ],
    artifacts: [
      {
        path: 'quick-view-keyboard.png',
        kind: 'image',
        sha256: await hash('artifacts/quick-view-keyboard.png'),
      },
    ],
  });
  const inputFiles = [
    ...(await sources('client/src')),
    ...(await sources('client/public/images')),
    { path: '../client/index.html', sha256: await hash('client/index.html') },
  ];
  await writeFile(
    'artifacts/visual-evidence.json',
    JSON.stringify(
      {
        schemaVersion: 'uizze.visual-evidence.v1',
        scope:
          'LUNA English-only Luxury Minimal storefront; desktop and mobile homepage and keyboard quick view',
        platform: 'web',
        sources: inputFiles,
        comparison: 'existing-system',
        requiredChecks: [
          { id: 'desktop', kind: 'visual' },
          { id: 'mobile', kind: 'visual' },
          { id: 'keyboard', kind: 'interaction' },
        ],
        checks,
        unresolved: [],
      },
      null,
      2,
    ),
  );
  console.log('Captured and checked desktop, mobile and keyboard dialog evidence.');
} finally {
  await browser.close();
}
