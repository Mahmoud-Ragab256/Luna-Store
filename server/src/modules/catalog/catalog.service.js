import { z } from 'zod';
import { Product, Category } from '../../database/models.js';
import { AppError } from '../../common/errors/app-error.js';
export const catalogQuery = z.object({
  search: z.string().max(100).optional(),
  q: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  size: z.string().max(20).optional(),
  color: z.string().max(50).optional(),
  availability: z.enum(['in-stock', 'all']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  discount: z.enum(['true', 'false']).optional(),
  sort: z
    .enum(['newest', 'price-asc', 'price-desc', 'popularity', 'rating', 'price_asc', 'price_desc'])
    .default('newest'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
  featured: z.enum(['true', 'false']).optional(),
});
export async function listProducts(input, extra = {}) {
  const query = { isActive: true, ...extra };
  if (input.search || input.q)
    query.name = {
      $regex: (input.search || input.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    };
  if (input.category) {
    const category = await Category.findOne({ slug: input.category, isActive: true });
    if (!category)
      return { data: [], meta: { total: 0, page: input.page, limit: input.limit, totalPages: 0 } };
    query.categoryId = category._id;
  }
  if (input.subcategory) query.subcategory = input.subcategory;
  const variant = {};
  if (input.size) variant.size = input.size;
  if (input.color) variant.color = input.color;
  if (input.availability === 'in-stock' || input.inStock === 'true') variant.stock = { $gt: 0 };
  if (Object.keys(variant).length) query.variants = { $elemMatch: variant };
  if (input.discount === 'true') query.discount = { $gt: 0 };
  if (input.featured === 'true') query.isFeatured = true;
  const sorts = {
    newest: { createdAt: -1, _id: -1 },
    'price-asc': { catalogPrice: 1, _id: 1 },
    price_asc: { catalogPrice: 1, _id: 1 },
    'price-desc': { catalogPrice: -1, _id: 1 },
    price_desc: { catalogPrice: -1, _id: 1 },
    popularity: { soldCount: -1, _id: 1 },
    rating: { averageRating: -1, _id: 1 },
  };
  const priceFilter = {};
  if (input.minPrice !== undefined) priceFilter.$gte = input.minPrice;
  if (input.maxPrice !== undefined) priceFilter.$lte = input.maxPrice;
  // Filter and sort by the price shown on cards, including the catalog discount.
  // Variant overrides remain authoritative only after a specific SKU is selected.
  const pipeline = [
    { $match: query },
    {
      $addFields: {
        catalogPrice: {
          $round: [
            {
              $multiply: [
                '$basePrice',
                { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] },
              ],
            },
            2,
          ],
        },
      },
    },
  ];
  if (Object.keys(priceFilter).length) pipeline.push({ $match: { catalogPrice: priceFilter } });
  pipeline.push({
    $facet: {
      data: [
        { $sort: sorts[input.sort] },
        { $skip: (input.page - 1) * input.limit },
        { $limit: input.limit },
      ],
      count: [{ $count: 'total' }],
    },
  });
  const [result] = await Product.aggregate(pipeline);
  const data = result.data;
  const total = result.count[0]?.total || 0;
  return {
    data,
    meta: {
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
export async function getProduct(slug) {
  const product = await Product.findOne({ slug, isActive: true }).lean();
  if (!product) throw new AppError(404, 'This piece is no longer available.');
  return product;
}
