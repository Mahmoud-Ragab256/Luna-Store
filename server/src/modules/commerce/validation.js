import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const itemSchema = z
  .object({
    productId: objectId,
    sku: z.string().trim().min(1).max(100).optional(),
    variantSku: z.string().trim().min(1).max(100).optional(),
    quantity: z.number().int().min(1).max(20),
  })
  .refine((item) => item.sku || item.variantSku, 'Choose a product variant')
  .transform((item) => ({
    productId: item.productId,
    variantSku: item.variantSku || item.sku,
    quantity: item.quantity,
  }));
export const quoteSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  couponCode: z.string().trim().max(40).default(''),
  governorate: z.string().trim().max(80).default('Cairo'),
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
});
export const addressSchema = z.object({
  governorate: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  street: z.string().trim().min(3).max(250),
  building: z.string().trim().min(1).max(30),
  apartment: z.string().trim().max(30).default(''),
  postalCode: z.string().trim().max(15).default(''),
  notes: z.string().trim().max(500).default(''),
});
export const checkoutSchema = quoteSchema
  .omit({ governorate: true })
  .extend({
    customer: z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().email().max(254),
      phone: z
        .string()
        .regex(/^(?:\+20|0020|0)1[0125]\d{8}$/, 'Enter a valid Egyptian mobile number'),
    }),
    shippingAddress: addressSchema,
    paymentMethod: z.enum(['cod', 'online']).default('cod'),
  });
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[a-z\d_-]+$/i)
      .transform((value) => value.toUpperCase()),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive().max(100000),
    minimumOrderAmount: z.number().min(0).default(0),
    maximumDiscount: z.number().positive().nullable().default(null),
    usageLimit: z.number().int().positive().nullable().default(null),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (value) => value.type !== 'percentage' || value.value <= 100,
    'Percentage must not exceed 100',
  );
