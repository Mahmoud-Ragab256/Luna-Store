import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { connectDatabase } from '../connection.js';
import { Category, Product, User, Coupon, Review } from '../models.js';
import { categoryData, productData } from './data.js';
export async function seedDatabase() {
  if (env.NODE_ENV === 'production')
    throw new Error('Development seeding is disabled in production.');
  const categories = [];
  for (const category of categoryData)
    categories.push(
      await Category.findOneAndUpdate(
        { slug: category.slug },
        { $setOnInsert: category },
        { upsert: true, new: true },
      ),
    );
  for (const product of productData(categories))
    await Product.updateOne(
      { slug: product.slug },
      { $setOnInsert: product },
      { upsert: true, runValidators: true },
    );
  const reviewer = await User.findOneAndUpdate(
    { email: 'reviewer@example.invalid' },
    {
      $setOnInsert: {
        name: 'LUNA sample customer',
        email: 'reviewer@example.invalid',
        passwordHash: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
        role: 'customer',
        isActive: false,
      },
    },
    { upsert: true, new: true },
  );
  for (const product of await Product.find().sort({ createdAt: 1 }).limit(12)) {
    await Review.updateOne(
      { productId: product._id, userId: reviewer._id },
      {
        $setOnInsert: {
          productId: product._id,
          userId: reviewer._id,
          name: 'Development sample review',
          rating: 5,
          comment:
            'Development sample: soft fabric and a comfortable fit. Replace with verified customer feedback before launch.',
          isApproved: true,
        },
      },
      { upsert: true },
    );
    const [stats] = await Review.aggregate([
      { $match: { productId: product._id, isApproved: true } },
      { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    ]);
    await Product.updateOne(
      { _id: product._id },
      { $set: { averageRating: stats.averageRating, reviewCount: stats.reviewCount } },
    );
  }
  await Coupon.updateOne(
    { code: 'WELCOME10' },
    {
      $setOnInsert: {
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        minimumOrderAmount: 1000,
        maximumDiscount: 500,
        usageLimit: 100,
        expiresAt: new Date(Date.now() + 365 * 86400000),
        isActive: true,
      },
    },
    { upsert: true },
  );
  if (env.SEED_ADMIN_EMAIL || env.SEED_ADMIN_PASSWORD) {
    if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD.length < 12)
      throw new Error(
        'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (minimum 12 characters) together.',
      );
    await User.updateOne(
      { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
      {
        $setOnInsert: {
          name: 'LUNA administrator',
          email: env.SEED_ADMIN_EMAIL.toLowerCase(),
          passwordHash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
          role: 'admin',
          isEmailVerified: true,
        },
      },
      { upsert: true },
    );
  }
  return { categories: await Category.countDocuments(), products: await Product.countDocuments() };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/seed.js')) {
  await connectDatabase();
  console.log(await seedDatabase());
  await mongoose.disconnect();
}
