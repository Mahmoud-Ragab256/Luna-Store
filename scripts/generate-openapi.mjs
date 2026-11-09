import { writeFileSync } from 'node:fs';
// Documentation source. Runtime Zod validation remains in the owning feature modules.
const string = (extra = {}) => ({ type: 'string', ...extra });
const number = (extra = {}) => ({ type: 'number', ...extra });
const integer = (extra = {}) => ({ type: 'integer', ...extra });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const array = (items, extra = {}) => ({ type: 'array', items, ...extra });
const json = (schema) => ({ 'application/json': { schema } });
const response = (description, schema = object({ data: {} })) => ({
  description,
  content: json(schema),
});
const paths = {};
function operation(method, path, summary, options = {}) {
  const {
    body,
    schema,
    status = '200',
    auth = false,
    admin = false,
    parameters = [],
    description,
    content,
  } = options;
  const parametersForPath = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: string(),
  }));
  const value = {
    summary,
    tags: [admin ? 'Administration' : path.split('/')[1]],
    ...(description ? { description } : {}),
    ...(auth || admin ? { security: [{ bearerAuth: [] }] } : {}),
    ...(parameters.length || parametersForPath.length
      ? { parameters: [...parametersForPath, ...parameters] }
      : {}),
    ...(body || content ? { requestBody: { required: true, content: content || json(body) } } : {}),
    responses: {
      [status]: response('Success', schema),
      422: response('Invalid request', ref('Error')),
      ...(auth || admin
        ? {
            401: response('Authentication required', ref('Error')),
            403: response('Permission denied', ref('Error')),
          }
        : {}),
    },
  };
  paths[path] ||= {};
  paths[path][method] = value;
}
const paging = ['page', 'limit'].map((name) => ({
  name,
  in: 'query',
  schema: integer({ minimum: 1 }),
}));
const search = { name: 'search', in: 'query', schema: string({ maxLength: 100 }) };
const email = string({ format: 'email', maxLength: 254 });
const id = string({ pattern: '^[a-fA-F0-9]{24}$' });
const schemas = {
  Error: object(
    {
      error: object(
        {
          code: string(),
          message: string(),
          fields: { type: 'object', additionalProperties: array(string()) },
        },
        ['code', 'message'],
      ),
      requestId: string(),
    },
    ['error'],
  ),
  User: object(
    {
      _id: id,
      name: string(),
      email,
      phone: string(),
      role: string({ enum: ['customer', 'admin'] }),
      isEmailVerified: { type: 'boolean' },
      addresses: array(ref('Address')),
    },
    ['_id', 'name', 'email', 'role'],
  ),
  SessionResponse: object({ data: object({ user: ref('User'), accessToken: string() }) }),
  Address: object(
    {
      governorate: string(),
      city: string(),
      street: string(),
      building: string(),
      apartment: string(),
      postalCode: string(),
      notes: string(),
      label: string(),
    },
    ['governorate', 'city', 'street'],
  ),
  Variant: object(
    {
      sku: string(),
      size: string(),
      color: string(),
      colorHex: string(),
      stock: integer({ minimum: 0 }),
      priceOverride: number({ minimum: 0 }),
    },
    ['sku', 'size', 'color', 'stock'],
  ),
  ProductInput: object(
    {
      name: string({ minLength: 2, maxLength: 150 }),
      slug: string({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
      description: string(),
      categoryId: id,
      images: array(string({ format: 'uri' }), { minItems: 1, maxItems: 12 }),
      basePrice: number({ exclusiveMinimum: 0 }),
      discount: number({ minimum: 0, maximum: 90 }),
      variants: array(ref('Variant'), { minItems: 1, maxItems: 100 }),
      tags: array(string()),
      specifications: { type: 'object', additionalProperties: string() },
      isFeatured: { type: 'boolean' },
      isActive: { type: 'boolean' },
      subcategory: string(),
    },
    ['name', 'slug', 'description', 'categoryId', 'images', 'basePrice', 'variants'],
  ),
  CategoryInput: object(
    {
      name: string(),
      slug: string(),
      description: string(),
      image: string({ format: 'uri' }),
      parentCategoryId: { anyOf: [id, { type: 'null' }] },
      displayOrder: integer(),
      isActive: { type: 'boolean' },
    },
    ['name', 'slug'],
  ),
  CartItem: object({
    productId: id,
    variantSku: string(),
    quantity: integer({ minimum: 1, maximum: 20 }),
  }),
  QuoteInput: object(
    {
      items: array(ref('CartItem'), { minItems: 1, maxItems: 50 }),
      couponCode: string({ maxLength: 40 }),
      governorate: string(),
      shippingMethod: string({ enum: ['standard', 'express'] }),
    },
    ['items'],
  ),
  CheckoutInput: object(
    {
      items: array(ref('CartItem'), { minItems: 1, maxItems: 50 }),
      customer: object({
        name: string(),
        email,
        phone: string({ pattern: '^(?:\\+20|0020|0)1[0125]\\d{8}$' }),
      }),
      shippingAddress: ref('Address'),
      shippingMethod: string({ enum: ['standard', 'express'] }),
      paymentMethod: string({ enum: ['cod', 'online'] }),
      couponCode: string(),
    },
    ['items', 'customer', 'shippingAddress'],
  ),
  CouponInput: object(
    {
      code: string(),
      type: string({ enum: ['percentage', 'fixed'] }),
      value: number({ exclusiveMinimum: 0 }),
      minimumOrderAmount: number({ minimum: 0 }),
      maximumDiscount: { anyOf: [number({ exclusiveMinimum: 0 }), { type: 'null' }] },
      usageLimit: { anyOf: [integer({ minimum: 1 }), { type: 'null' }] },
      expiresAt: { anyOf: [string({ format: 'date-time' }), { type: 'null' }] },
      isActive: { type: 'boolean' },
    },
    ['code', 'type', 'value'],
  ),
};
operation('get', '/health', 'Database-aware readiness');
operation('get', '/openapi.json', 'Read this machine-readable API contract');
operation('get', '/config', 'Store contact and payment configuration');
operation('get', '/shipping', 'Configured Egyptian shipping zones');
operation('post', '/auth/register', 'Create customer account', {
  status: '201',
  body: object({
    name: string({ minLength: 2 }),
    email,
    password: string({ minLength: 10, maxLength: 128 }),
  }),
  schema: ref('SessionResponse'),
});
operation('post', '/auth/login', 'Sign in', {
  body: object({ email, password: string() }),
  schema: ref('SessionResponse'),
});
operation('post', '/auth/refresh', 'Rotate refresh session cookie', {
  description:
    'Requires credentials and the configured frontend Origin for cookie-authenticated requests.',
  schema: ref('SessionResponse'),
});
operation('post', '/auth/logout', 'Revoke current session and clear cookie');
operation('get', '/auth/me', 'Get current public user', { auth: true });
operation('post', '/auth/forgot-password', 'Request a password reset email', {
  body: object({ email }),
  description: 'Returns the same message whether or not the account exists.',
});
operation('post', '/auth/reset-password', 'Consume reset token and revoke sessions', {
  body: object({ token: string(), password: string({ minLength: 10, maxLength: 128 }) }),
});
operation('post', '/auth/verify-email', 'Consume email verification token', {
  body: object({ token: string() }),
});
const filters = [
  'category',
  'subcategory',
  'size',
  'color',
  'availability',
  'inStock',
  'discount',
  'featured',
  'sort',
].map((name) => ({ name, in: 'query', schema: string() }));
filters.push(
  ...['minPrice', 'maxPrice'].map((name) => ({
    name,
    in: 'query',
    schema: number({ minimum: 0 }),
  })),
);
operation('get', '/products', 'Filter, sort and paginate active products', {
  parameters: [...paging, search, ...filters],
});
for (const name of ['featured', 'new-arrivals', 'best-sellers'])
  operation('get', `/products/${name}`, `List ${name} products`);
operation('get', '/products/{slug}', 'Get an active product');
operation('get', '/products/{productId}/reviews', 'List approved product reviews');
operation('post', '/products/{productId}/reviews', 'Review a delivered purchase', {
  auth: true,
  status: '201',
  body: object({
    rating: integer({ minimum: 1, maximum: 5 }),
    comment: string({ minLength: 5, maxLength: 2000 }),
  }),
});
operation('get', '/categories', 'List active categories in display order');
operation('get', '/categories/{slug}', 'Get an active category');
operation('post', '/contact', 'Save a customer message', {
  status: '201',
  body: object(
    {
      name: string(),
      email,
      subject: string(),
      message: string({ minLength: 10, maxLength: 3000 }),
      website: string({ maxLength: 0 }),
    },
    ['name', 'email', 'subject', 'message'],
  ),
});
operation('post', '/newsletter', 'Subscribe an email address', {
  status: '201',
  body: object({ email }),
});
operation('get', '/users/me', 'Get own profile', { auth: true });
operation('patch', '/users/me', 'Update own profile', {
  auth: true,
  body: object({ name: string(), phone: string() }, ['name']),
});
operation('patch', '/users/me/password', 'Change password and revoke sessions', {
  auth: true,
  body: object({
    currentPassword: string(),
    newPassword: string({ minLength: 10, maxLength: 128 }),
  }),
});
operation('post', '/users/me/addresses', 'Save an address', {
  auth: true,
  status: '201',
  body: ref('Address'),
});
operation('delete', '/users/me/addresses/{id}', 'Remove saved address', { auth: true });
operation('get', '/wishlist', 'Get own active saved products', { auth: true });
operation('post', '/wishlist/items', 'Save a product', {
  auth: true,
  status: '201',
  body: object({ productId: id }),
});
operation('delete', '/wishlist/items/{productId}', 'Remove saved product', { auth: true });
operation('post', '/cart/quote', 'Calculate authoritative current totals', {
  body: ref('QuoteInput'),
});
operation('get', '/cart', 'Get own saved cart', { auth: true });
operation('post', '/cart/items', 'Add quantity to a cart variant', {
  auth: true,
  status: '201',
  body: ref('CartItem'),
});
operation('post', '/cart/merge', 'Merge guest selections repeatably', {
  auth: true,
  body: object({ items: array(ref('CartItem')), couponCode: string() }, ['items']),
});
operation('patch', '/cart/items/{itemId}', 'Update cart quantity', {
  auth: true,
  body: object({ quantity: integer({ minimum: 1, maximum: 20 }) }),
});
operation('delete', '/cart/items/{itemId}', 'Remove cart item', { auth: true });
operation('post', '/orders', 'Create an order transactionally', {
  auth: true,
  status: '201',
  body: ref('CheckoutInput'),
  parameters: [
    {
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      schema: string({ minLength: 16, maxLength: 100 }),
    },
  ],
  description:
    'Prices, shipping, coupons and stock are resolved on the server. A replica set is required.',
});
operation('get', '/orders', 'List own orders', { auth: true, parameters: paging });
operation('get', '/orders/{id}', 'Get own order', { auth: true });
operation('post', '/orders/{id}/cancel', 'Cancel an eligible unpaid order', { auth: true });
operation('post', '/orders/{id}/reorder', 'Revalidate and add an order to the cart', {
  auth: true,
});
operation('post', '/payments/create-session', 'Create development provider session', {
  auth: true,
  body: object({ orderId: id }),
  description: 'Unavailable in production until a real provider is implemented.',
});
operation('get', '/payments/{orderId}/status', 'Read authoritative payment status', { auth: true });
operation('post', '/payments/mock-confirm', 'Explicit development-only payment simulation', {
  auth: true,
  body: object({ orderId: id, outcome: string({ enum: ['paid', 'failed', 'canceled'] }) }),
  description:
    'Requires nonproduction NODE_ENV and PAYMENT_PROVIDER=mock. Never records a real production payment.',
});
operation('post', '/payments/webhook', 'Verify and process a development webhook', {
  parameters: [
    {
      name: 'x-payment-signature',
      in: 'header',
      required: true,
      schema: string({ pattern: '^[a-fA-F0-9]{64}$' }),
    },
  ],
  body: object({
    eventId: string(),
    providerTransactionId: string(),
    status: string({ enum: ['paid', 'failed', 'canceled'] }),
    amount: number(),
    currency: string({ const: 'EGP' }),
  }),
  description:
    'HMAC-SHA256 over original body bytes; amount and independently recorded development-provider state must match.',
});
for (const [name, input] of [
  ['products', 'ProductInput'],
  ['categories', 'CategoryInput'],
  ['coupons', 'CouponInput'],
]) {
  operation('get', `/admin/${name}`, `List ${name}`, {
    admin: true,
    parameters: [...paging, search],
  });
  operation('post', `/admin/${name}`, `Create ${name.slice(0, -1)}`, {
    admin: true,
    status: '201',
    body: ref(input),
  });
  if (name !== 'coupons')
    operation('get', `/admin/${name}/{id}`, `Get ${name.slice(0, -1)}`, { admin: true });
  operation('patch', `/admin/${name}/{id}`, `Update ${name.slice(0, -1)}`, {
    admin: true,
    body: { ...schemas[input], required: [] },
  });
  operation('delete', `/admin/${name}/{id}`, `Archive or disable ${name.slice(0, -1)}`, {
    admin: true,
  });
}
operation('get', '/admin/analytics', 'Get revenue, counts, recent orders and sales', {
  admin: true,
});
operation('get', '/admin/customers', 'Search customers', {
  admin: true,
  parameters: [...paging, search],
});
operation('patch', '/admin/customers/{id}', 'Enable or disable a customer', {
  admin: true,
  body: object({ isActive: { type: 'boolean' } }),
});
operation('get', '/admin/customers/{id}/orders', 'Get customer order history', { admin: true });
operation('get', '/admin/messages', 'Search contact messages', {
  admin: true,
  parameters: [...paging, search],
});
operation('patch', '/admin/messages/{id}', 'Update message status', {
  admin: true,
  body: object({ status: string({ enum: ['new', 'read', 'resolved'] }) }),
});
operation('get', '/admin/reviews', 'Get recent reviews', { admin: true });
operation('get', '/admin/orders', 'List orders by fulfillment status', {
  admin: true,
  parameters: [...paging, { name: 'status', in: 'query', schema: string() }],
});
operation('get', '/admin/orders/{id}', 'Get order details', { admin: true });
operation('patch', '/admin/orders/{id}/status', 'Apply a permitted fulfillment transition', {
  admin: true,
  body: object({
    status: string({
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'returned'],
    }),
  }),
});
operation('post', '/admin/orders/{id}/collect-cod', 'Record received cash after delivery', {
  admin: true,
  body: object({ confirmed: { const: true, type: 'boolean' } }),
});
operation('post', '/admin/orders/{id}/refund', 'Unavailable until real provider refunds exist', {
  admin: true,
  status: '501',
});
operation('post', '/admin/uploads', 'Upload validated product images to Cloudinary', {
  admin: true,
  status: '201',
  content: {
    'multipart/form-data': {
      schema: object({ images: array(string({ format: 'binary' }), { maxItems: 8 }) }),
    },
  },
});
const document = {
  openapi: '3.1.0',
  info: {
    title: 'LUNA Store API',
    version: '1.0.0',
    description:
      'Egypt-focused fashion commerce. EGP monetary values. Production online payments are intentionally disabled pending a real provider.',
  },
  servers: [{ url: '/api/v1' }],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas,
  },
};
writeFileSync(
  new URL('../server/openapi.json', import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
console.log(
  `Wrote OpenAPI document with ${Object.values(paths).reduce((sum, methods) => sum + Object.keys(methods).length, 0)} operations.`,
);
