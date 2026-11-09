import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });
const options = { timestamps: true, toJSON: { virtuals: true, transform(doc, ret) { delete ret.__v; delete ret.passwordHash; delete ret.resetTokenHash; delete ret.verifyTokenHash; return ret; } } };
const bounded = (max) => ({ validator: (items) => items.length <= max, message: `Maximum ${max} entries allowed` });
const address = new Schema({ label: String, fullName: String, governorate: String, city: String, street: String, streetAddress: String, building: String, apartment: String, buildingNumber: String, apartmentNumber: String, postalCode: String, notes: String, phone: String, isDefault: Boolean });
const user = new Schema({ name: { type: String, required: true, maxlength: 100 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ['customer', 'admin'], default: 'customer' }, phone: String, addresses: { type: [address], validate: bounded(10) }, isEmailVerified: { type: Boolean, default: false }, isActive: { type: Boolean, default: true }, resetTokenHash: { type: String, select: false }, resetExpiresAt: Date, verifyTokenHash: { type: String, select: false }, verifyExpiresAt: Date }, options);
export const User = mongoose.model('User', user);
const session = new Schema({ userId: ref('User', { required: true, index: true }), refreshTokenHash: { type: String, unique: true, required: true }, tokenFamilyId: { type: String, required: true, index: true }, expiresAt: { type: Date, required: true }, revokedAt: Date, reuseDetected: { type: Boolean, default: false }, deviceMetadata: String }, options);
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.model('Session', session);
export const Category = mongoose.model('Category', new Schema({ name: { type: String, required: true }, slug: { type: String, required: true, unique: true }, description: String, image: String, parentCategoryId: ref('Category'), displayOrder: { type: Number, default: 0 }, isActive: { type: Boolean, default: true } }, options));
const variant = new Schema({ sku: { type: String, required: true }, size: { type: String, required: true }, color: { type: String, required: true }, colorHex: String, stock: { type: Number, min: 0, required: true, validate: Number.isInteger }, priceOverride: { type: Number, min: 0 } }, { _id: true });
const product = new Schema({ name: { type: String, required: true, maxlength: 150 }, slug: { type: String, required: true, unique: true }, description: String, categoryId: ref('Category', { required: true, index: true }), subcategory: String, images: { type: [String], validate: bounded(12) }, basePrice: { type: Number, required: true, min: 0 }, discount: { type: Number, min: 0, max: 90, default: 0 }, variants: { type: [variant], validate: [{ ...bounded(100) }, { validator: (items) => new Set(items.map((v) => v.sku)).size === items.length, message: 'Variant SKUs must be unique' }] }, tags: [String], specifications: { type: Map, of: String }, isFeatured: { type: Boolean, default: false }, isActive: { type: Boolean, default: true }, averageRating: { type: Number, default: 0 }, reviewCount: { type: Number, default: 0 }, soldCount: { type: Number, default: 0 } }, options);
product.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
product.index({ isActive: 1, createdAt: -1 }); product.index({ isActive: 1, basePrice: 1 });
export const Product = mongoose.model('Product', product);
const cartItem = new Schema({ productId: ref('Product', { required: true }), variantSku: { type: String, required: true }, quantity: { type: Number, min: 1, max: 99, required: true } });
export const Cart = mongoose.model('Cart', new Schema({ userId: ref('User', { required: true, unique: true }), items: { type: [cartItem], validate: bounded(50) }, couponCode: String }, { ...options, optimisticConcurrency: true }));
const orderItem = new Schema({ productId: ref('Product'), name: String, productName: String, slug: String, image: String, sku: String, variantSku: String, size: String, color: String, unitPrice: Number, originalPrice: Number, quantity: Number, discount: Number, lineTotal: Number }, { _id: false });
const order = new Schema({ orderNumber: { type: String, required: true, unique: true }, userId: ref('User', { required: true, index: true }), idempotencyKey: String, requestHash: String, customerSnapshot: { name: String, fullName: String, email: String, phone: String }, items: { type: [orderItem], validate: bounded(50) }, shippingAddressSnapshot: address, shippingMethod: String, subtotal: Number, discount: Number, shippingFee: Number, total: Number, couponCode: String, paymentMethod: { type: String, enum: ['cod', 'online', 'cash-on-delivery'], default: 'cod' }, paymentStatus: { type: String, default: 'pending' }, fulfillmentStatus: { type: String, default: 'pending' }, inventoryStatus: { type: String, enum: ['reserved', 'committed', 'released'], default: 'reserved' }, reservationExpiresAt: Date, inventoryReleased: { type: Boolean, default: false }, canceledAt: Date }, options);
order.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
export const Order = mongoose.model('Order', order);
const payment = new Schema({ orderId: ref('Order', { required: true, index: true }), provider: String, providerStatus: String, providerTransactionId: String, amount: Number, currency: { type: String, default: 'EGP' }, status: { type: String, default: 'pending' }, idempotencyKey: String, eventIds: { type: [String], validate: bounded(100) }, checkoutUrl: String, paidAt: Date }, options);
payment.index({ provider: 1, providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: 'string' } } });
payment.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
export const Payment = mongoose.model('Payment', payment);
export const Coupon = mongoose.model('Coupon', new Schema({ code: { type: String, uppercase: true, required: true, unique: true }, type: { type: String, enum: ['percentage', 'fixed'], required: true }, value: { type: Number, min: 0, required: true }, minimumOrderAmount: { type: Number, default: 0 }, maximumDiscount: Number, usageLimit: { type: Number, default: null }, usageCount: { type: Number, default: 0 }, expiresAt: Date, isActive: { type: Boolean, default: true } }, options));
const review = new Schema({ userId: ref('User', { required: true }), productId: ref('Product', { required: true, index: true }), name: String, rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, maxlength: 2000 }, isApproved: { type: Boolean, default: true } }, options);
review.index({ userId: 1, productId: 1 }, { unique: true });
export const Review = mongoose.model('Review', review);
export const Wishlist = mongoose.model('Wishlist', new Schema({ userId: ref('User', { required: true, unique: true }), productIds: { type: [ref('Product')], validate: bounded(200) } }, options));
export const ContactMessage = mongoose.model('ContactMessage', new Schema({ name: String, email: String, subject: String, message: String, status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' } }, options));
const reservation = new Schema({ orderId: ref('Order', { required: true, index: true }), productId: ref('Product', { required: true }), variantSku: String, quantity: Number, status: { type: String, default: 'reserved' }, expiresAt: { type: Date, index: true } }, options);
reservation.index({ orderId: 1, variantSku: 1 }, { unique: true });
export const InventoryReservation = mongoose.model('InventoryReservation', reservation);
export const Newsletter = mongoose.model('Newsletter', new Schema({ email: { type: String, required: true, unique: true }, consentAt: { type: Date, default: Date.now } }, options));
export const AuditLog = mongoose.model('AuditLog', new Schema({ userId: ref('User'), action: String, resource: String, resourceId: String }, options));




