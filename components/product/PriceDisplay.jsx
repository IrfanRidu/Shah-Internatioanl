'use client';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getEffectivePricing } from '@/lib/utils';

// campaignItem (optional): the FlashSale item ({ salePrice, discountPercentage, ... }) this product
// is being shown under, when rendered inside a campaign carousel. When supplied, the bigger of the
// campaign's discount and the product's own discount is shown (issue 9) and international buyers get
// a discounted price RANGE alongside the plain range (issue 10). Omitted everywhere else — behaves
// exactly as before (the product's own discount only, no international discount ever shown).
export default function PriceDisplay({ product, size = 'md', showRange = true, campaignItem = null }) {
  const { buyerType } = useBuyerType();
  const { format, formatUSD, currency } = useCurrency();
  // 'sm' is only ever used inside the fixed-size ProductCard grid/carousel — it must render a
  // predictable, bounded height every time (never 1 line for one product and 3 for another), so we
  // give it its own compact layout rather than letting flex-wrap decide how many lines it needs.
  const compact = size === 'sm';
  const pricing = getEffectivePricing(product, campaignItem);
  const pct = Math.round(pricing.effectivePct * 100);

  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' };
  const subSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' };

  if (buyerType === 'international') {
    const minFormatted = formatUSD(pricing.intlMin || 0);
    const maxFormatted = formatUSD(pricing.intlMax || 0);
    const hasRange = showRange && pricing.intlMax;
    const hasDiscount = !!pricing.intlOriginalMin;
    const originalLabel = hasDiscount
      ? `${formatUSD(pricing.intlOriginalMin)}${pricing.intlOriginalMax ? ` – ${formatUSD(pricing.intlOriginalMax)}` : ''}`
      : '';

    if (compact) {
      // Same fixed 2-row skeleton as the local/compact branch below, so campaign carousels mixing
      // discounted and non-discounted cards never end up with mismatched row heights.
      return (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className={`font-bold text-brand ${textSizes[size]} truncate`}>
              {hasRange ? `From ${minFormatted}` : minFormatted}
            </span>
            <span className={`text-gray-400 flex-shrink-0 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
          </div>
          <div className="flex items-baseline gap-1.5 h-4 overflow-hidden">
            {hasDiscount && <span className={`text-gray-400 line-through ${subSizes[size]} truncate`}>{originalLabel}</span>}
            {hasDiscount && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-semibold flex-shrink-0">-{pct}%</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-bold text-brand ${textSizes[size]}`}>
            {hasRange ? `${minFormatted} – ${maxFormatted}` : minFormatted}
          </span>
          {hasDiscount && <span className={`text-gray-400 line-through ${subSizes[size]}`}>{originalLabel}</span>}
          {hasDiscount && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">-{pct}%</span>
          )}
        </div>
        <span className={`text-gray-400 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
        {/* Compact (card) size skips this secondary line — no room for it, and the currency is
            already obvious from the site-wide currency switcher in the header. */}
        {currency !== 'USD' && <p className="text-xs text-gray-400 mt-0.5">Prices shown in {currency}</p>}
      </div>
    );
  }

  // Local buyer – BDT. displayPrice/original now come from getEffectivePricing so a campaign's
  // discount is used whenever it beats the product's own (issue 9); with no campaignItem this is
  // identical to the product's own discountPrice/price as before.
  const displayPrice = pricing.localPrice;
  const original = pricing.localOriginal;

  if (compact) {
    // Fixed 2-row layout: row 1 is always just price + unit, row 2 is always just the
    // strikethrough/discount (present or not) — total height never varies with digit count.
    return (
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span className={`font-bold text-brand ${textSizes[size]} truncate`}>{format(displayPrice)}</span>
          <span className={`text-gray-400 flex-shrink-0 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
        </div>
        <div className="flex items-baseline gap-1.5 h-4 overflow-hidden">
          {original && <span className={`text-gray-400 line-through ${subSizes[size]} truncate`}>{format(original)}</span>}
          {original && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-semibold flex-shrink-0">
              -{pct}%
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={`font-bold text-brand ${textSizes[size]}`}>{format(displayPrice)}</span>
      {original && <span className={`text-gray-400 line-through ${subSizes[size]}`}>{format(original)}</span>}
      {original && (
        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
          -{pct}%
        </span>
      )}
      <span className={`text-gray-400 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
    </div>
  );
}
