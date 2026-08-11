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

// Issue 4: harvesting season is derived automatically from the admin-configured harvestingMonths
// (1-12) against the current date — never set by hand. Returns null when harvestingMonths is
// empty/unset so callers can fall back to whatever value already exists for that edge case (e.g. a
// product that predates this feature and has no months configured yet).
export function computeHarvestingSeason(harvestingMonths, now = new Date()) {
  if (!Array.isArray(harvestingMonths) || harvestingMonths.length === 0) return null;
  const currentMonth = now.getMonth() + 1;
  return harvestingMonths.includes(currentMonth);
}

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

// Escapes characters that are special in regex syntax before user-typed text is used inside a
// MongoDB $regex — without this, typing something containing '(', ')', '.', '+', '*', '[', ']', or
// similar (extremely common here: botanical names throughout this catalog are written like "Mango
// (Mangifera indica)") throws a regex compilation error the MOMENT a paren is unbalanced, i.e. on
// every keystroke between typing the opening '(' and its matching ')' — not just as a rare edge
// case, but during completely normal typing. That error gets caught by the route's generic
// try/catch and returned as a failed response with no products, which a search box then can only
// render as "no results" — genuinely indistinguishable from a real empty match without seeing the
// server error directly.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildProductQuery = (filters = {}) => {
  // `$ne: false` rather than `=== true`: isActive defaults to true at the schema level for products
  // CREATED through the app, but that default is a write-time behavior only — a product written any
  // other way (a direct DB insert/import, or created before this field existed) can have the field
  // genuinely absent, and Mongo's exact-match `{isActive: true}` does NOT treat "missing" as "true".
  // Every other boolean visibility flag in this same function already uses this $ne:false pattern
  // (see availableForLocal/availableForInternational just below) specifically to stay correct for
  // documents that predate a field; isActive was the one place still using the stricter, easy-to-miss
  // form, which silently hides any such product from every search (issue 1) as well as the storefront
  // listing itself. Only an EXPLICIT isActive:false now excludes a product, same as those other flags.
  //
  // filters.adminView (verified server-side by the caller — see app/api/products/route.js, which
  // only sets it when the session is confirmed an admin/editor role) skips isActive AND the
  // buyerType availability restrictions below entirely, so admin management views see every product
  // regardless of status. It must NOT also skip category/search/etc — a previous version of the
  // /api/products route swapped in a bare `{}` for adminView instead of calling this function at
  // all, which dropped search along with visibility: the admin product list's search box accepted
  // input and re-fetched, but the query sent to Mongo never actually filtered by it, so every search
  // silently returned the full unfiltered list. Routing adminView through here instead means the
  // admin list gets the same real search/category filtering as everyone else, just without the
  // visibility restrictions layered on top.
  const query = {};
  if (!filters.adminView) {
    query.isActive = { $ne: false };
  }
  if (filters.category) query.category = filters.category;
  if (filters.subcategory) query.subcategorySlug = filters.subcategory;
  if (filters.isFeatured) query.isFeatured = true;
  if (filters.isHarvesting === 'true' || filters.isHarvesting === 'false') query.isHarvestingSeason = filters.isHarvesting === 'true';
  if (filters.allowPreOrder === 'true') query.allowPreOrder = true;

  // Buyer-type visibility scoping:
  // - Local buyers: only see products where availableForLocal is NOT explicitly set to false
  //   (undefined/null/true all pass — only false is excluded)
  // - International buyers: only see products where availableForInternational is NOT false
  // - Admin / no buyerType: all active products visible
  if (!filters.adminView) {
    if (filters.buyerType === 'local') {
      query.availableForLocal = { $ne: false };
    } else if (filters.buyerType === 'international') {
      query.availableForInternational = { $ne: false };
    }
  }

  if (filters.search) {
    const safeSearch = escapeRegex(filters.search);
    query.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { scientificName: { $regex: safeSearch, $options: 'i' } },
      { localName: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
      { tags: { $in: [new RegExp(safeSearch, 'i')] } },
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

// Issue 9 + 10: a product shown inside a campaign (FlashSale) carousel must use WHICHEVER discount
// is bigger — its own (price vs discountPrice) or the campaign's (item.salePrice /
// item.discountPercentage) — never both stacked, never the smaller one. Expressing this as a single
// percentage lets the same comparison drive both the local BDT price and the international USD
// range from one number. Outside a campaign (campaignItem omitted/null) this reduces to exactly the
// product's own discount, so every existing non-campaign call site is unaffected.
const DISCOUNT_EPSILON = 0.0001;
export function getEffectivePricing(product, campaignItem = null) {
  const price = Number(product?.price) || 0;
  const discountPrice = Number(product?.discountPrice) || 0;
  const ownPct = (discountPrice > 0 && price > 0 && discountPrice < price) ? (1 - discountPrice / price) : 0;

  let campaignPct = 0;
  if (campaignItem) {
    const salePrice = Number(campaignItem.salePrice) || 0;
    const pctFromSalePrice = (price > 0 && salePrice > 0) ? Math.max(0, 1 - salePrice / price) : 0;
    const pctFromField = Number(campaignItem.discountPercentage) > 0 ? Number(campaignItem.discountPercentage) / 100 : 0;
    campaignPct = Math.max(pctFromSalePrice, pctFromField);
  }

  // Whichever discount is bigger is the one that counts (issue 9).
  const effectivePct = Math.min(0.95, Math.max(ownPct, campaignPct));
  const hasDiscount = effectivePct > DISCOUNT_EPSILON;
  const min = Number(product?.priceRangeMin) || 0;
  const max = Number(product?.priceRangeMax) || 0;
  // The product has no stored international discount field of its own — a discounted USD range
  // only ever comes from being inside a campaign (issue 10), so only surface one here when a
  // campaignItem was actually supplied. Outside a campaign, international buyers still see the
  // plain range exactly as before.
  const showIntlDiscount = !!campaignItem && hasDiscount;

  return {
    effectivePct,
    hasDiscount,
    localPrice: hasDiscount ? Math.round(price * (1 - effectivePct)) : price,
    localOriginal: hasDiscount ? price : null,
    intlMin: showIntlDiscount ? +(min * (1 - effectivePct)).toFixed(2) : min,
    intlMax: showIntlDiscount ? +(max * (1 - effectivePct)).toFixed(2) : max,
    intlOriginalMin: showIntlDiscount ? min : null,
    intlOriginalMax: showIntlDiscount ? max : null,
  };
}

// Issue 11: a campaign/section can be restricted to local-only or international-only buyers via its
// OWN targetAudience field — separate from (and in addition to) per-product availability, which
// isProductVisibleToBuyer above already handles. undefined/'all' means visible to everyone.
export function isCampaignVisibleToBuyer(campaign, buyerType) {
  if (!campaign) return false;
  const audience = campaign.targetAudience || 'all';
  if (audience === 'all') return true;
  return audience === buyerType;
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
  // Batch 8 (R7/R8) — TT Configuration entries (shipment's own base currency). Passed as the raw
  // array so every call site can just forward `shipment.ttEntries` without pre-summing.
  ttEntries = [],
} = {}) => {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  initialBalance = n(initialBalance); freightCost = n(freightCost); goodsCost = n(goodsCost);
  exportProcessingCost = n(exportProcessingCost); othersCost = n(othersCost); damage = n(damage);
  orderValueForeign = n(orderValueForeign); exchangeRateBDT = n(exchangeRateBDT); incentive = n(incentive);

  // Issue 14: Freight Cost is entered in the shipment's own base currency (the same currency
  // orderValueForeign/the invoices use — set once per shipment), not BDT — convert it here using
  // that shipment's own Rate in BDT before it feeds into Total Cost (BDT), same conversion already
  // used one line below for orderValueForeign → receiveAmountBDT.
  const freightCostBDT = freightCost * exchangeRateBDT;
  const totalCost = freightCostBDT + goodsCost + exportProcessingCost + othersCost + damage;

  // R8: Order Value drives Receive Amount (BDT) initially. The moment at least one TT entry has a
  // value, the SUM of TT values overrides Order Value for this calculation from then on (as long as
  // any entry remains) — both here and in Export Analytics, since both go through this same function.
  const ttTotal = (ttEntries || []).reduce((sum, t) => sum + n(t?.ttValue), 0);
  const usingTTForReceiveAmount = ttTotal > 0;
  const receiveAmountBDT = (usingTTForReceiveAmount ? ttTotal : orderValueForeign) * exchangeRateBDT;

  const availableBalance = (initialBalance - totalCost) + receiveAmountBDT;
  const shipmentMargin = availableBalance - initialBalance;
  const netProfit = shipmentMargin + incentive;

  // Issue 7: `incentive` was used to derive netProfit above but never actually included in this
  // return value — every caller that persists `computed` via {...computed} (the shipments POST/PUT
  // routes, and critically cascadeRecomputeShipments, which is what's supposed to write each
  // shipment's distributed share of a claimed Incentive Application back onto it) was therefore
  // silently never writing `incentive` to the database at all, regardless of how correctly it had
  // just been calculated — the number simply never made it into the $set. That's why it wasn't
  // appearing on the Shipment Details page (reads the stored field directly) or being counted in
  // Export Analytics (same — sums the stored field). Including it here is the actual fix; every
  // caller already computes/forwards the right input value, they just needed it reflected back.
  return { totalCost, receiveAmountBDT, availableBalance, shipmentMargin, netProfit, freightCostBDT, ttTotal, usingTTForReceiveAmount, incentive };
};

// Bug fix (batch 7 round 2): ObjectId-reference fields sent as an empty string (the natural
// "nothing selected" value for an HTML <select>) crash Mongoose with "Cast to ObjectId failed for
// value \"\"" — it only accepts a valid ObjectId string, undefined, or null. Used by both the
// shipment POST and PUT routes so a request can never reach ExportShipment.create/findByIdAndUpdate
// with an empty string in one of these fields, regardless of what the client sent — the editor's
// own handleSave already avoids sending '' in the first place, this is the server-side backstop.
export function sanitizeObjectIdFields(body, fields) {
  const clean = { ...body };
  for (const f of fields) {
    if (clean[f] === '') clean[f] = undefined;
  }
  return clean;
}
