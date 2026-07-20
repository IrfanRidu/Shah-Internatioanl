import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  orderSchema,
  couponSchema,
  quotationSchema,
  validate,
} from '@/lib/validators';

describe('validate() helper', () => {
  it('returns { valid: true, data } for a passing schema', () => {
    const result = validate(loginSchema, { email: 'a@b.com', password: 'x' });
    expect(result.valid).toBe(true);
    expect(result.data.email).toBe('a@b.com');
  });

  it('returns { valid: false, errors } keyed by field path for a failing schema', () => {
    const result = validate(loginSchema, { email: 'not-an-email', password: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
  });
});

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = validate(registerSchema, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      buyerType: 'local',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a password missing an uppercase letter or a number', () => {
    const result = validate(registerSchema, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'lowercase',
      buyerType: 'local',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('rejects an invalid buyerType', () => {
    const result = validate(registerSchema, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      buyerType: 'wholesale',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = validate(registerSchema, {
      name: 'J',
      email: 'john@example.com',
      password: 'Password1',
      buyerType: 'international',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });
});

describe('orderSchema', () => {
  const validOrder = {
    items: [{ productId: 'p1', name: 'Mango', quantity: 2 }],
    deliveryAddress: { name: 'Rahul', phone: '01711000000', street: '45 Mirpur Road', city: 'Dhaka' },
    paymentMethod: 'cod',
  };

  it('accepts a well-formed order', () => {
    expect(validate(orderSchema, validOrder).valid).toBe(true);
  });

  it('rejects an order with an empty cart', () => {
    const result = validate(orderSchema, { ...validOrder, items: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.items).toBeDefined();
  });

  it('rejects an unsupported payment method', () => {
    const result = validate(orderSchema, { ...validOrder, paymentMethod: 'paypal' });
    expect(result.valid).toBe(false);
  });

  it('rejects a delivery address missing required fields', () => {
    const result = validate(orderSchema, {
      ...validOrder,
      deliveryAddress: { name: 'Rahul', phone: '01711000000', street: 'X', city: '' },
    });
    expect(result.valid).toBe(false);
  });
});

describe('couponSchema', () => {
  it('uppercases the coupon code via the schema transform', () => {
    const result = validate(couponSchema, {
      code: 'save10',
      type: 'percentage',
      value: 10,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });
    expect(result.valid).toBe(true);
    expect(result.data.code).toBe('SAVE10');
  });

  it('defaults applicableFor to "all" and minimumOrderAmount to 0 when omitted', () => {
    const result = validate(couponSchema, {
      code: 'WELCOME',
      type: 'fixed',
      value: 100,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });
    expect(result.valid).toBe(true);
    expect(result.data.applicableFor).toBe('all');
    expect(result.data.minimumOrderAmount).toBe(0);
  });

  it('rejects a non-positive discount value', () => {
    const result = validate(couponSchema, {
      code: 'BAD',
      type: 'fixed',
      value: 0,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });
    expect(result.valid).toBe(false);
  });
});

describe('quotationSchema', () => {
  it('accepts a minimal quotation request with only the required fields', () => {
    const result = validate(quotationSchema, {
      name: 'Sarah Mueller',
      email: 'sarah@eurofresh.example',
      product: 'Alphonso Mango',
      quantity: '500kg',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a quotation with an invalid email', () => {
    const result = validate(quotationSchema, {
      name: 'Sarah Mueller',
      email: 'not-an-email',
      product: 'Alphonso Mango',
      quantity: '500kg',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });
});
