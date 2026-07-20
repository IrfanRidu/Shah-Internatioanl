import slugify from 'slugify';

export const generateSlug = (text) => slugify(text, { lower: true, strict: true, trim: true });

export const formatBDT = (amount) => {
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', minimumFractionDigits: 0 }).format(amount);
};

export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
};

export const formatCurrency = (amount, currency = 'BDT') => {
  const symbols = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: '₨', AED: 'د.إ', SAR: '﷼' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const convertCurrency = (amountBDT, targetCurrency, rates) => {
  if (!rates || targetCurrency === 'BDT') return amountBDT;
  const usdRate = rates['BDT'] || 110;
  const amountUSD = amountBDT / usdRate;
  if (targetCurrency === 'USD') return amountUSD;
  const targetRate = rates[targetCurrency];
  return targetRate ? amountUSD * targetRate : amountUSD;
};

export const getSeasonLabel = (product) => {
  if (product.isHarvestingSeason) return 'harvesting';
  return 'offseason';
};

export const getPriceForBuyer = (product, buyerType) => {
  if (buyerType === 'local') {
    return {
      price: product.discountPrice || product.price,
      originalPrice: product.discountPrice ? product.price : null,
      currency: 'BDT',
      display: formatBDT(product.discountPrice || product.price),
    };
  }
  return {
    priceMin: product.priceRangeMin,
    priceMax: product.priceRangeMax,
    currency: 'USD',
    display: `$${product.priceRangeMin} - $${product.priceRangeMax}`,
  };
};

export const isAdminOrAbove = (role) => ['superAdmin', 'admin'].includes(role);
export const isSuperAdmin = (role) => role === 'superAdmin';
export const isAdmin = (role) => ['superAdmin', 'admin', 'editor'].includes(role);

export const paginateQuery = (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  return { skip, limit: parseInt(limit) };
};

export const buildProductQuery = (filters = {}) => {
  const query = { isActive: true };
  if (filters.category) query.category = filters.category;
  if (filters.subcategory) query.subcategorySlug = filters.subcategory;
  if (filters.isFeatured) query.isFeatured = true;
  if (filters.isHarvesting !== undefined) query.isHarvestingSeason = filters.isHarvesting === 'true';

  // Buyer-type visibility scoping:
  // - Local buyers: only see products where availableForLocal is NOT explicitly set to false
  //   (undefined/null/true all pass — only false is excluded)
  // - International buyers: only see products where availableForInternational is NOT false
  // - Admin / no buyerType: all active products visible
  if (filters.buyerType === 'local') {
    query.availableForLocal = { $ne: false };
  } else if (filters.buyerType === 'international') {
    query.availableForInternational = { $ne: false };
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { scientificName: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
      { tags: { $in: [new RegExp(filters.search, 'i')] } },
    ];
  }
  return query;
};

// Client-safe (no DB import) visibility check, used anywhere a product card
// is about to be rendered outside of the main /api/products listing route —
// home page featured/campaign/section products, related products, search
// results, etc. These are fetched via direct Mongoose populate() calls that
// don't run through buildProductQuery, so without this second check a
// product restricted to one buyer type could still leak into a homepage
// section or campaign shown to the other buyer type.
export function isProductVisibleToBuyer(product, buyerType) {
  if (!product) return false;
  if (buyerType === 'local') return product.availableForLocal !== false;
  if (buyerType === 'international') return product.availableForInternational !== false;
  return true; // unknown/admin context — don't hide anything
}

export const getWhatsAppLink = (phone, message) => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

export const getCalLink = (phone) => `tel:${phone}`;

export const calculateMetrics = (orders) => {
  const delivered = orders.filter(o => o.status === 'delivered');
  const grossRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const netRevenue = delivered.reduce((sum, o) => sum + o.total, 0);
  const cogs = delivered.reduce((sum, o) => {
    return sum + o.items.reduce((s, i) => s + (i.productCost || 0) * i.quantity, 0);
  }, 0);
  const grossProfit = netRevenue - cogs;
  const totalDiscounts = orders.reduce((sum, o) => sum + (o.discount || 0) + (o.couponDiscount || 0), 0);
  const aov = orders.length > 0 ? grossRevenue / orders.length : 0;
  return { grossRevenue, netRevenue, cogs, grossProfit, netProfit: grossProfit, totalDiscounts, aov, orderCount: orders.length, deliveredCount: delivered.length };
};

export const generateOrderNumber = () => {
  return `SI${Date.now().toString().slice(-8)}`;
};

/**
 * Computes the delivery charge for an order given the admin-configured
 * delivery zones. Always called server-side when actually creating an
 * order (never trusts a client-supplied charge amount) — the checkout page
 * calls this too, purely to show the customer the right number before they
 * submit.
 *
 * @param {number} subtotal - order subtotal (product cost, before delivery)
 * @param {string} zoneName - the zone name the customer selected
 * @param {object} settings - the Settings document (or plain object)
 * @returns {{ charge: number, zoneName: string|null, estimatedDays: string|null }}
 */
export const computeDeliveryCharge = (subtotal, zoneName, settings) => {
  const zones = (settings?.deliveryZones || []).filter(z => z.isActive !== false);

  if (zones.length > 0) {
    const zone = zoneName ? zones.find(z => z.name === zoneName) : zones[0];
    if (zone) {
      const freeThreshold = zone.freeAbove || 0;
      const charge = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : zone.charge;
      return { charge, zoneName: zone.name, estimatedDays: zone.estimatedDays || null };
    }
  }

  // Fallback to the legacy single-rate fields if no zones are configured yet
  const legacyFree = settings?.freeDeliveryAbove || 1000;
  const legacyCharge = settings?.localDeliveryCharge ?? 60;
  const charge = subtotal >= legacyFree ? 0 : legacyCharge;
  return { charge, zoneName: null, estimatedDays: null };
};

// Issue 46: shared Export Analytics formulas — the SAME function is used for the shipment editor's
// live preview (frontend) and the shipment/analytics API routes (backend), so the two can never
// drift out of sync. Every field here is expected in the shipment's stored base (BDT) unit, except
// orderValueForeign, which is in the shipment's own configured currency (converted via
// exchangeRateBDT, never displayed as-converted per issue 47's Order Value exception).
export const calculateShipmentFinancials = ({
  initialBalance = 0,
  freightCost = 0,
  goodsCost = 0,
  exportProcessingCost = 0,
  othersCost = 0,
  damage = 0,
  orderValueForeign = 0,
  exchangeRateBDT = 0,
  incentive = 0,
} = {}) => {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  initialBalance = n(initialBalance); freightCost = n(freightCost); goodsCost = n(goodsCost);
  exportProcessingCost = n(exportProcessingCost); othersCost = n(othersCost); damage = n(damage);
  orderValueForeign = n(orderValueForeign); exchangeRateBDT = n(exchangeRateBDT); incentive = n(incentive);

  const totalCost = freightCost + goodsCost + exportProcessingCost + othersCost + damage;
  const receiveAmountBDT = orderValueForeign * exchangeRateBDT;
  const availableBalance = (initialBalance - totalCost) + receiveAmountBDT;
  const shipmentMargin = availableBalance - initialBalance;
  const netProfit = shipmentMargin + incentive;

  return { totalCost, receiveAmountBDT, availableBalance, shipmentMargin, netProfit };
};
