import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root = 'client/dist';
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.name === 'index.html') files.push(target);
  }
  return files;
}
const pages = [];
for (const path of await walk(root)) {
  const html = await readFile(path, 'utf8');
  assert.match(html, /<html[^>]+lang="en"[^>]+dir="ltr"/);
  assert.match(html, /<h1[\s>]/);
  assert.match(html, /<link[^>]+rel="canonical"/);
  assert.match(html, /property="og:title"/);
  const h1 = html
    .match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&');
  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));
  assert(schemas.some((s) => s['@type'] === 'BreadcrumbList'));
  const product = schemas.find((s) => s['@type'] === 'Product');
  if (product) {
    assert.equal(h1, product.name);
    assert.equal(product.offers.priceCurrency, 'EGP');
    assert(product.offers.price >= 0);
  }
  pages.push({ path, h1, product: !!product, status: 'pass' });
}
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length);
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/seo-verification.json',
  JSON.stringify(
    {
      pages: pages.length,
      productPages: pages.filter((p) => p.product).length,
      sitemap: 'pass',
      checks: pages,
    },
    null,
    2,
  ),
);
console.log(
  `Verified ${pages.length} public pages, ${pages.filter((p) => p.product).length} product schemas and sitemap.`,
);
