import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { MediaAsset, Product, Category, Order } from '../../database/models.js';

// Only uploads tracked by this application are eligible. Never scan/delete the user's library.
export async function cleanupUnusedImages({ destroy, now = new Date(), limit = 10 } = {}) {
  if (!destroy) {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
      return { configured: false, deleted: 0 };
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    destroy = (id) => cloudinary.uploader.destroy(id, { timeout: 10000 });
  }
  const result = { configured: true, deleted: 0 };
  const candidates = await MediaAsset.find({
    createdAt: { $lt: new Date(now.getTime() - 7 * 86400000) },
    $or: [{ status: 'active' }, { status: 'deleting', leaseUntil: { $lte: now } }],
  })
    .sort({ checkedAt: 1 })
    .limit(limit);
  for (const asset of candidates) {
    const claimed = await MediaAsset.findOneAndUpdate(
      {
        _id: asset._id,
        $or: [{ status: 'active' }, { status: 'deleting', leaseUntil: { $lte: now } }],
      },
      {
        $set: { status: 'deleting', checkedAt: now, leaseUntil: new Date(now.getTime() + 120000) },
      },
      { new: true },
    );
    if (!claimed) continue;
    try {
      const references = await Promise.all([
        Product.exists({ images: asset.url }),
        Category.exists({ image: asset.url }),
        Order.exists({ 'items.image': asset.url }),
      ]);
      if (references.some(Boolean)) {
        await MediaAsset.updateOne(
          { _id: asset._id },
          { $set: { status: 'active' }, $unset: { leaseUntil: 1 } },
        );
        continue;
      }
      const removed = await destroy(asset.publicId);
      if (!['ok', 'not found'].includes(removed.result))
        throw new Error('Cloudinary deletion was not confirmed');
      await MediaAsset.updateOne(
        { _id: asset._id },
        { $set: { status: 'deleted' }, $unset: { leaseUntil: 1 } },
      );
      result.deleted++;
    } catch {
      await MediaAsset.updateOne(
        { _id: asset._id },
        { $set: { status: 'active' }, $unset: { leaseUntil: 1 } },
      );
    }
  }
  return result;
}
