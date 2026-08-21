import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
  buyerType: z.enum(['local', 'international']),
  phone: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const productSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10),
  category: z.string().min(1, 'Category is required'),
  price: z.number().optional(),
  priceRangeMin: z.number().optional(),
  priceRangeMax: z.number().optional(),
  productCost: z.number().optional(),
  quantity: z.number().min(0).default(0),
  unit: z.enum(['kg', 'ton', 'piece', 'box', 'bundle', 'bag', 'liter']).default('kg'),
  // Kept alongside the local/international split below (not removed) for the same backward-
  // compatibility reason models/Product.js keeps it — see that file's own comment.
  minimumOrderQuantity: z.number().min(1).default(1),
  minimumOrderQuantityLocal: z.number().min(1).optional(),
  minimumOrderQuantityInternational: z.number().min(1).optional(),
  additionalFields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  isActive: z.boolean().default(true),
});

export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
  })).min(1, 'Cart is empty'),
  deliveryAddress: z.object({
    name: z.string().min(1),
    phone: z.string().min(6),
    street: z.string().min(3),
    city: z.string().min(1),
  }),
  paymentMethod: z.enum(['cod', 'stripe', 'bkash', 'nagad', 'bank_transfer']),
});

export const couponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minimumOrderAmount: z.number().min(0).default(0),
  validFrom: z.string(),
  validUntil: z.string(),
  applicableFor: z.enum(['all', 'local', 'international']).default('all'),
});

export const quotationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  product: z.string().min(1),
  quantity: z.string().min(1),
  phone: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  message: z.string().optional(),
});

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.reduce((acc, e) => {
      acc[e.path.join('.')] = e.message;
      return acc;
    }, {});
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}
