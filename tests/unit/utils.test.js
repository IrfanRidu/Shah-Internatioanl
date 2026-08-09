import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  formatCurrency,
  convertCurrency,
  calculateMetrics,
  generateOrderNumber,
  getWhatsAppLink,
  isAdminOrAbove,
  isSuperAdmin,
  isAdmin,
  paginateQuery,
  buildProductQuery,
} from '@/lib/utils';

describe('generateSlug', () => {
  it('lowercases and hyphenates a plain title', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('handles multi-word product names', () => {
    expect(generateSlug('Fresh Ginger Root')).toBe('fresh-ginger-root');
  });
});

describe('formatCurrency', () => {
  it('formats BDT with the taka symbol and 2 decimals', () => {
    expect(formatCurrency(100, 'BDT')).toBe('৳100.00');
  });

  it('formats USD with the dollar symbol', () => {
    expect(formatCurrency(99.5, 'USD')).toBe('$99.50');
  });

  it('adds thousands separators', () => {
    expect(formatCurrency(1234.5, 'BDT')).toBe('৳1,234.50');
  });

  it('falls back to the currency code itself for unknown currencies', () => {
    expect(formatCurrency(10, 'XYZ')).toBe('XYZ10.00');
  });
});

describe('convertCurrency', () => {
  const rates = { BDT: 110, USD: 1, EUR: 0.92 };

  it('returns the BDT amount unchanged when target is BDT', () => {
    expect(convertCurrency(5000, 'BDT', rates)).toBe(5000);
  });

  it('converts BDT to USD using the BDT rate', () => {
    expect(convertCurrency(110, 'USD', rates)).toBe(1);
  });

  it('converts BDT to a third currency via USD', () => {
    expect(convertCurrency(110, 'EUR', rates)).toBeCloseTo(0.92, 5);
  });

  it('returns the raw BDT amount if rates are missing', () => {
    expect(convertCurrency(500, 'USD', null)).toBe(500);
  });
});

describe('calculateMetrics', () => {
  const orders = [
    {
      status: 'delivered',
      total: 1000,
      discount: 0,
      couponDiscount: 50,
      items: [{ productCost: 200, quantity: 2 }],
    },
    {
      status: 'pending',
      total: 500,
      discount: 0,
      couponDiscount: 0,
      items: [{ productCost: 100, quantity: 1 }],
    },
  ];

  it('only counts delivered orders toward net revenue and COGS', () => {
    const m = calculateMetrics(orders);
    expect(m.netRevenue).toBe(1000);
    expect(m.cogs).toBe(400); // 200 * 2, from the delivered order only
    expect(m.grossProfit).toBe(600);
    expect(m.netProfit).toBe(m.grossProfit);
  });

  it('counts every order toward gross revenue regardless of status', () => {
    const m = calculateMetrics(orders);
    expect(m.grossRevenue).toBe(1500);
  });

  it('sums discounts and coupon discounts across all orders', () => {
    const m = calculateMetrics(orders);
    expect(m.totalDiscounts).toBe(50);
  });

  it('computes AOV against the full order count, and tracks order/delivered counts', () => {
    const m = calculateMetrics(orders);
    expect(m.aov).toBe(750);
    expect(m.orderCount).toBe(2);
    expect(m.deliveredCount).toBe(1);
  });

  it('handles an empty order list without dividing by zero', () => {
    const m = calculateMetrics([]);
    expect(m.aov).toBe(0);
    expect(m.grossRevenue).toBe(0);
  });
});

describe('generateOrderNumber', () => {
  it('produces an "SI" prefix followed by 8 digits', () => {
    expect(generateOrderNumber()).toMatch(/^SI\d{8}$/);
  });
});

describe('getWhatsAppLink', () => {
  it('strips non-numeric characters from the phone number', () => {
    const link = getWhatsAppLink('+880 1700-000000', 'Hello');
    expect(link).toBe('https://wa.me/8801700000000?text=Hello');
  });

  it('URL-encodes the message', () => {
    const link = getWhatsAppLink('8801700000000', 'Hi there!');
    expect(link).toContain(encodeURIComponent('Hi there!'));
  });
});

describe('role helpers', () => {
  it('isAdminOrAbove only allows superAdmin/admin', () => {
    expect(isAdminOrAbove('superAdmin')).toBe(true);
    expect(isAdminOrAbove('admin')).toBe(true);
    expect(isAdminOrAbove('editor')).toBe(false);
  });

  it('isSuperAdmin only allows superAdmin', () => {
    expect(isSuperAdmin('superAdmin')).toBe(true);
    expect(isSuperAdmin('admin')).toBe(false);
  });

  it('isAdmin allows any admin-area role including editor', () => {
    expect(isAdmin('editor')).toBe(true);
    expect(isAdmin('localBuyer')).toBe(false);
  });
});

describe('paginateQuery', () => {
  it('computes the correct skip for a given page/limit', () => {
    expect(paginateQuery(1, 20)).toEqual({ skip: 0, limit: 20 });
    expect(paginateQuery(2, 10)).toEqual({ skip: 10, limit: 10 });
    expect(paginateQuery(3, 5)).toEqual({ skip: 10, limit: 5 });
  });
});

describe('buildProductQuery', () => {
  it('always scopes to active products (but not by excluding legacy docs missing the field)', () => {
    // isActive uses $ne:false, not ===true — see buildProductQuery's own comment: a product missing
    // the field entirely (predates it, or was inserted outside the app) must still be findable.
    expect(buildProductQuery({})).toEqual({ isActive: { $ne: false } });
  });

  it('adds a category filter', () => {
    expect(buildProductQuery({ category: 'veg123' })).toEqual({ isActive: { $ne: false }, category: 'veg123' });
  });

  it('maps buyerType to the correct availability flag', () => {
    expect(buildProductQuery({ buyerType: 'local' })).toEqual({ isActive: { $ne: false }, availableForLocal: { $ne: false } });
    expect(buildProductQuery({ buyerType: 'international' })).toEqual({ isActive: { $ne: false }, availableForInternational: { $ne: false } });
  });

  it('converts the isHarvesting string filter to a boolean', () => {
    expect(buildProductQuery({ isHarvesting: 'true' })).toEqual({ isActive: { $ne: false }, isHarvestingSeason: true });
    expect(buildProductQuery({ isHarvesting: 'false' })).toEqual({ isActive: { $ne: false }, isHarvestingSeason: false });
  });

  it('escapes regex special characters in search text instead of passing them through raw', () => {
    // Batch 7 round 2: botanical names throughout this catalog are written like
    // "Mango (Mangifera indica)" — typing that unescaped mid-search (e.g. the moment the opening
    // '(' is typed but before its closing ')') used to throw "Unterminated group" from MongoDB's
    // $regex, which the API route's catch-all error handler turned into an empty result set —
    // indistinguishable, from a search box, from "no matches" even though the catalog has them.
    const query = buildProductQuery({ search: 'Mango (Mangifera indica' });
    const namePattern = query.$or.find(c => c.name)?.name.$regex;
    expect(() => new RegExp(namePattern, 'i')).not.toThrow();
    expect(namePattern).toBe('Mango \\(Mangifera indica');
  });

  it('search still matches literally after escaping (no regex metacharacter side-effects)', () => {
    const query = buildProductQuery({ search: 'C.O.D' });
    const namePattern = query.$or.find(c => c.name)?.name.$regex;
    const re = new RegExp(namePattern, 'i');
    expect(re.test('C.O.D Delivery')).toBe(true);
    expect(re.test('CXOXD Delivery')).toBe(false); // '.' must match a literal dot, not "any character"
  });
});
