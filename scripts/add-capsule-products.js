import fs from 'node:fs';
import { capsuleData } from '../server/src/database/seeds/capsule-data.js';

const base = process.env.LUNA_STORE_URL || 'https://luna-store-peach.vercel.app';
async function api(path, options = {}) {
  const response = await fetch(`${base}/api/v1${path}`, options);
  const result = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${result.error?.message || 'Request failed'}`);
  return result.data;
}
if (!(await api('/config')).demoMode)
  throw new Error('This script only prepares an explicitly marked demo store.');
const credentials = JSON.parse(fs.readFileSync('.runtime/demo-admin.json', 'utf8'));
const session = await api('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify(credentials),
});
const headers = { Authorization: `Bearer ${session.accessToken}`, Origin: base };
const categories = await api('/categories');
const missing = [];
for (const entry of capsuleData) {
  const response = await fetch(`${base}/api/v1/products/${entry.slug}`);
  if (response.status === 404) missing.push(entry);
  else if (!response.ok) throw new Error(`Could not check existing product ${entry.slug}`);
}
if (missing.length) {
  const form = new FormData();
  for (const entry of missing)
    form.append(
      'images',
      new Blob([fs.readFileSync(`client/public/images/new/${entry.slug}.webp`)], {
        type: 'image/webp',
      }),
      `${entry.slug}.webp`,
    );
  const uploaded = await api('/admin/uploads', { method: 'POST', headers, body: form });
  if (uploaded.length !== missing.length)
    throw new Error('Image/product count mismatch. No products were inserted.');
  const evidence = [];
  for (const [index, entry] of missing.entries()) {
    const category = categories.find((value) => value.slug === entry.category);
    if (!category) throw new Error(`Missing category ${entry.category}`);
    const product = await api('/admin/products', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: entry.name,
        slug: entry.slug,
        description: `${entry.description} AI-generated concept photography for the LUNA demo; no physical goods are dispatched.`,
        categoryId: category._id,
        images: [uploaded[index].url],
        basePrice: entry.price,
        discount: 0,
        variants: ['XS', 'S', 'M', 'L', 'XL'].map((size) => ({
          sku: `LUNA-CAPSULE-${entry.slug.toUpperCase()}-${size}`,
          size,
          color: entry.color,
          colorHex: entry.hex,
          stock: 10,
        })),
        tags: ['new-arrival', 'capsule', 'ai-concept'],
        isFeatured: true,
        isActive: true,
        specifications: {
          Colour: entry.color,
          'Image provenance':
            'AI-generated product concept; the pictured colour is the available demo variant.',
          Fit: 'Illustrative relaxed fit; XS–XL demo sizing.',
        },
      }),
    });
    evidence.push({
      name: product.name,
      slug: product.slug,
      category: entry.category,
      color: entry.color,
      url: uploaded[index].url,
      localPhoto: `client/public/images/new/${entry.slug}.webp`,
    });
  }
  fs.writeFileSync('artifacts/capsule-products.json', JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({ added: missing.length, alreadyPresent: capsuleData.length - missing.length }),
);
