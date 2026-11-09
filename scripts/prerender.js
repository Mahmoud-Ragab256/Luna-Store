import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { chromium } from '@playwright/test';

// Snapshot real public React pages against the configured live catalogue. No API mocks.
const api = (process.env.PRERENDER_API_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const site = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
const directory = resolve('client/dist');
async function get(path) {
  const response = await fetch(`${api}${path}`);
  if (!response.ok) throw new Error(`Prerender source unavailable: ${path} (${response.status})`);
  return response.json();
}
const products = [];
let page = 1;
let pages = 1;
do {
  const result = await get(`/products?page=${page}&limit=60`);
  products.push(...result.data);
  pages = result.meta.totalPages;
  page++;
} while (page <= pages);
const categories = (await get('/categories')).data;
const routes = [
  '/',
  '/products',
  '/categories',
  '/contact',
  '/journal',
  ...['shipping', 'returns', 'privacy', 'terms', 'size-guide'].map((p) => `/policies/${p}`),
  ...products.map((p) => `/products/${p.slug}`),
  ...categories.map((c) => `/categories/${c.slug}`),
];
const template = await readFile(join(directory, 'index.html'));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
// Repeated public GETs share a build-local snapshot, reducing API load without
// weakening the application's runtime rate limits or replacing catalogue data.
const publicCache = new Map();
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      if (req.method === 'GET' && publicCache.has(req.url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(publicCache.get(req.url));
        return;
      }
      const upstream = await fetch(new URL(req.url, new URL(api).origin), {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await upstream.text();
      if (req.method === 'GET' && upstream.ok) publicCache.set(req.url, payload);
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(payload);
      return;
    }
    const file = resolve(directory, `.${decodeURIComponent(path)}`);
    if (
      !file.startsWith(`${directory}\\`) &&
      !file.startsWith(`${directory}/`) &&
      file !== directory
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    let target = file;
    try {
      const s = await stat(file);
      if (s.isDirectory()) target = join(file, 'index.html');
    } catch {
      target = join(directory, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' });
    res.end(target === join(directory, 'index.html') ? template : await readFile(target));
  } catch (error) {
    res.writeHead(500);
    res.end(error.message);
  }
});
await new Promise((r) => server.listen(4175, '127.0.0.1', r));
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
);
const tab = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  for (const route of routes) {
    await tab.goto(`http://127.0.0.1:4175${route}`, { waitUntil: 'domcontentloaded' });
    await tab.waitForFunction(
      (route) => document.documentElement.dataset.lunaRoute === route,
      route,
    );
    await tab.waitForSelector('main h1');
    await tab.waitForFunction(
      () => !document.querySelector('.skeleton-card,.page-loader,[aria-busy="true"]'),
      { timeout: 30000 },
    );
    const product = products.find((p) => route === `/products/${p.slug}`);
    await tab.evaluate(
      ({ site, route, product }) => {
        document.querySelector('link[rel="canonical"]').href = site + route;
        const description =
          product?.description ||
          'Considered womenswear by LUNA. Explore everyday fashion in Egypt.';
        document.querySelector('meta[name="description"]').content = description;
        for (const [property, content] of Object.entries({
          'og:title': document.title,
          'og:description': description,
          'og:url': site + route,
          'og:type': product ? 'product' : 'website',
        })) {
          const meta = document.createElement('meta');
          meta.setAttribute('property', property);
          meta.content = content;
          document.head.append(meta);
        }
        if (product) {
          const structured = document.createElement('script');
          structured.type = 'application/ld+json';
          structured.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: product.images.map((i) => new URL(i, site).href),
            sku: product.variants[0]?.sku,
            offers: {
              '@type': 'Offer',
              priceCurrency: 'EGP',
              price:
                Math.round(product.basePrice * (1 - (product.discount || 0) / 100) * 100) / 100,
              availability: product.variants.some((v) => v.stock > 0)
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              url: site + route,
            },
          });
          document.head.append(structured);
        }
        const breadcrumbs = document.createElement('script');
        breadcrumbs.type = 'application/ld+json';
        breadcrumbs.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'LUNA', item: site },
            {
              '@type': 'ListItem',
              position: 2,
              name: product?.name || document.title,
              item: site + route,
            },
          ],
        });
        document.head.append(breadcrumbs);
      },
      { site, route, product },
    );
    const path = join(directory, route, 'index.html');
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, await tab.content());
    console.log(`Prerendered ${route}`);
  }
  const escape = (value) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  await writeFile(
    join(directory, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${escape(site + route)}</loc></url>`).join('')}</urlset>`,
  );
  console.log(
    `Prerender complete: ${routes.length} public pages. Rebuild after catalogue changes.`,
  );
} finally {
  await browser.close();
  server.close();
}
