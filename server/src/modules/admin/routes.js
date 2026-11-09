import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import {
  Product,
  Category,
  User,
  ContactMessage,
  AuditLog,
  Order,
  Review,
  MediaAsset,
} from '../../database/models.js';
import { requireAuth, requireAdmin } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { AppError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const imageSource = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/(?:images|assets)\/[a-z\d/_-]+\.(?:jpg|jpeg|png|webp|avif)$/i.test(value)) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use an HTTPS image URL or an existing local image asset.');
const variant = z.object({
  sku: z.string().min(2).max(80),
  size: z.string().min(1).max(20),
  color: z.string().min(1).max(50),
  colorHex: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  stock: z.number().int().min(0).max(100000),
  priceOverride: z.number().min(0).optional(),
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(180),
  description: z.string().max(10000),
  categoryId: objectId,
  images: z.array(imageSource).min(1).max(12),
  basePrice: z.number().positive().max(1000000),
  discount: z.number().min(0).max(90).optional(),
  variants: z
    .array(variant)
    .min(1)
    .max(100)
    .refine(
      (items) => new Set(items.map((v) => v.sku)).size === items.length,
      'SKUs must be unique.',
    ),
  tags: z.array(z.string().max(50)).max(20).optional(),
  specifications: z.record(z.string(), z.string().max(1000)).optional(),
  subcategory: z.string().max(100).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  description: z.string().max(1000).optional(),
  image: imageSource.optional(),
  parentCategoryId: objectId.nullable().optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});
const audit = (req, action, resource, resourceId) =>
  AuditLog.create({ userId: req.user._id, action, resource, resourceId: String(resourceId) });
for (const [name, Model, schema] of [
  ['products', Product, productSchema],
  ['categories', Category, categorySchema],
]) {
  adminRouter.get(`/${name}/:id`, async (req, res) => {
    objectId.parse(req.params.id);
    const data = await Model.findById(req.params.id);
    if (!data) throw new AppError(404, 'Record not found.');
    res.json({ data });
  });
  adminRouter.get(`/${name}`, validate(pagination, 'query'), async (req, res) => {
    const { page, limit, search } = req.validated;
    const filter = search
      ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      : {};
    const [data, total] = await Promise.all([
      Model.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Model.countDocuments(filter),
    ]);
    res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  });
  adminRouter.post(`/${name}`, validate(schema), async (req, res) => {
    if (
      name === 'products' &&
      !(await Category.exists({ _id: req.validated.categoryId, isActive: true }))
    )
      throw new AppError(422, 'Choose an active category.');
    const data = await Model.create(req.validated);
    await audit(req, 'create', name, data._id);
    res.status(201).json({ data });
  });
  adminRouter.patch(`/${name}/:id`, validate(schema.partial()), async (req, res) => {
    objectId.parse(req.params.id);
    if (
      name === 'products' &&
      req.validated.categoryId &&
      !(await Category.exists({ _id: req.validated.categoryId, isActive: true }))
    )
      throw new AppError(422, 'Choose an active category.');
    const data = await Model.findByIdAndUpdate(
      req.params.id,
      { $set: req.validated },
      { new: true, runValidators: true },
    );
    if (!data) throw new AppError(404, 'Record not found.');
    await audit(req, 'update', name, data._id);
    res.json({ data });
  });
  adminRouter.delete(`/${name}/:id`, async (req, res) => {
    objectId.parse(req.params.id);
    const data = await Model.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!data) throw new AppError(404, 'Record not found.');
    await audit(req, 'archive', name, data._id);
    res.json({ data });
  });
}
adminRouter.get('/analytics', async (req, res) => {
  const [
    orders,
    customers,
    products,
    pendingOrders,
    revenue,
    recentOrders,
    lowStockProducts,
    sales,
  ] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments({ fulfillmentStatus: 'pending' }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(8),
    Product.find({ isActive: true, 'variants.stock': { $lt: 5 } }).limit(10),
    Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Cairo' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);
  res.json({
    data: {
      totalOrders: orders,
      totalCustomers: customers,
      totalProducts: products,
      pendingOrders,
      totalRevenue: revenue[0]?.total || 0,
      recentOrders,
      lowStockProducts,
      sales,
    },
  });
});
adminRouter.get('/customers', validate(pagination, 'query'), async (req, res) => {
  const { page, limit, search } = req.validated;
  const filter = { role: 'customer' };
  if (search)
    filter.$or = ['name', 'email'].map((field) => ({
      [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    }));
  const [data, total] = await Promise.all([
    User.find(filter)
      .select('name email phone isActive createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});
adminRouter.get('/customers/:id/orders', async (req, res) => {
  objectId.parse(req.params.id);
  res.json({
    data: await Order.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(100),
  });
});
adminRouter.patch(
  '/customers/:id',
  validate(z.object({ isActive: z.boolean() })),
  async (req, res) => {
    objectId.parse(req.params.id);
    const data = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      { $set: req.validated },
      { new: true },
    );
    if (!data) throw new AppError(404, 'Customer not found.');
    await audit(req, 'account-status', 'users', data._id);
    res.json({ data });
  },
);
adminRouter.get('/messages', validate(pagination, 'query'), async (req, res) => {
  const { page, limit, search } = req.validated;
  const filter = search
    ? {
        $or: ['name', 'email', 'subject'].map((field) => ({
          [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
        })),
      }
    : {};
  const [data, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ContactMessage.countDocuments(filter),
  ]);
  res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});
adminRouter.patch(
  '/messages/:id',
  validate(z.object({ status: z.enum(['new', 'read', 'resolved']) })),
  async (req, res) => {
    objectId.parse(req.params.id);
    const data = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: req.validated },
      { new: true },
    );
    if (!data) throw new AppError(404, 'Message not found.');
    res.json({ data });
  },
);
adminRouter.get('/reviews', async (req, res) =>
  res.json({ data: await Review.find().sort({ createdAt: -1 }).limit(100) }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter(req, file, done) {
    done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});
adminRouter.post('/uploads', upload.array('images', 8), async (req, res) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
    throw new AppError(503, 'Image uploads need Cloudinary configuration.');
  if (!req.files?.length) throw new AppError(422, 'Choose JPEG, PNG or WebP images up to 5 MB.');
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  const uploaded = [];
  try {
    for (const file of req.files) {
      const valid =
        (file.buffer[0] === 0xff && file.buffer[1] === 0xd8) ||
        file.buffer.subarray(1, 4).toString() === 'PNG' ||
        (file.buffer.subarray(0, 4).toString() === 'RIFF' &&
          file.buffer.subarray(8, 12).toString() === 'WEBP');
      if (!valid) throw new AppError(422, 'The file contents do not match a supported image.');
      const image = await new Promise((resolve, reject) =>
        cloudinary.uploader
          .upload_stream(
            {
              folder: 'luna/products',
              resource_type: 'image',
              allowed_formats: ['jpg', 'png', 'webp'],
              transformation: [{ width: 1800, crop: 'limit' }],
            },
            (error, result) => (error ? reject(error) : resolve(result)),
          )
          .end(file.buffer),
      );
      uploaded.push(image);
    }
    await MediaAsset.insertMany(
      uploaded.map((image) => ({ publicId: image.public_id, url: image.secure_url })),
    );
  } catch (error) {
    await Promise.allSettled(uploaded.map((image) => cloudinary.uploader.destroy(image.public_id)));
    throw error;
  }
  await audit(req, 'upload', 'images', uploaded.map((image) => image.public_id).join(','));
  res.status(201).json({
    data: uploaded.map((image) => ({ url: image.secure_url, publicId: image.public_id })),
  });
});
