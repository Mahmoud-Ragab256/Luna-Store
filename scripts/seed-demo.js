import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { env } from '../server/src/config/env.js';
import { connectDatabase } from '../server/src/database/connection.js';
import * as models from '../server/src/database/models.js';
import { categoryData, productData } from '../server/src/database/seeds/data.js';
import { demoImages } from '../server/src/database/seeds/demo-images.js';

// Explicit opt-in, non-destructive upserts: never import sample customers or reviews.
if (env.DEMO_MODE !== 'true') throw new Error('Set DEMO_MODE=true to prepare a demo catalog.');
await connectDatabase();
try {
  await Promise.all(Object.values(models).map((model) => model.init()));
  const categories = [];
  for (const [index, category] of categoryData.entries()) {
    categories.push(
      await models.Category.findOneAndUpdate(
        { slug: category.slug },
        { $setOnInsert: { ...category, image: demoImages[index % demoImages.length] } },
        { upsert: true, new: true },
      ),
    );
  }
  for (const [index, entry] of productData(categories).entries()) {
    const product = {
      ...entry,
      images: [demoImages[index % demoImages.length], demoImages[(index + 3) % demoImages.length]],
      averageRating: 0,
      reviewCount: 0,
      soldCount: 0,
    };
    await models.Product.updateOne(
      { slug: product.slug },
      { $setOnInsert: product },
      { upsert: true, runValidators: true },
    );
  }
  const email = 'admin@luna.example';
  if (!(await models.User.exists({ email }))) {
    const password = randomBytes(24).toString('base64url');
    await mkdir('.runtime', { recursive: true });
    await writeFile('.runtime/demo-admin.json', JSON.stringify({ email, password }, null, 2), {
      flag: 'wx',
    });
    await models.User.create({
      name: 'LUNA demo administrator',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      isEmailVerified: true,
    });
  }
  console.log(
    JSON.stringify({
      categories: await models.Category.countDocuments(),
      products: await models.Product.countDocuments(),
      adminCredentialFile: '.runtime/demo-admin.json',
    }),
  );
} finally {
  await mongoose.disconnect();
}
