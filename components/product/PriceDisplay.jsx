'use client';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useCurrency } from '@/contexts/CurrencyContext';

export default function PriceDisplay({ product, size = 'md', showRange = true }) {
  const { buyerType } = useBuyerType();
  const { format, formatUSD, currency } = useCurrency();
  // 'sm' is only ever used inside the fixed-size ProductCard grid/carousel — it must render a
  // predictable, bounded height every time (never 1 line for one product and 3 for another), so we
  // give it its own compact layout rather than letting flex-wrap decide how many lines it needs.
  const compact = size === 'sm';

  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' };
  const subSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' };

  if (buyerType === 'international') {
    const minFormatted = formatUSD(product.priceRangeMin || 0);
    const maxFormatted = formatUSD(product.priceRangeMax || 0);
    const hasRange = showRange && product.priceRangeMax;
    return (
      <div>
        <span className={`font-bold text-brand ${textSizes[size]}`}>
          {compact
            ? (hasRange ? `From ${minFormatted}` : minFormatted)
            : (hasRange ? `${minFormatted} – ${maxFormatted}` : minFormatted)}
        </span>
        <span className={`text-gray-400 ml-1 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
        {/* Compact (card) size skips this secondary line — no room for it, and the currency is
            already obvious from the site-wide currency switcher in the header. */}
        {!compact && currency !== 'USD' && <p className="text-xs text-gray-400 mt-0.5">Prices shown in {currency}</p>}
      </div>
    );
  }

  // Local buyer – BDT
  const displayPrice = product.discountPrice || product.price || 0;
  const original = product.discountPrice ? product.price : null;

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
              -{Math.round((1 - displayPrice / original) * 100)}%
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
          -{Math.round((1 - displayPrice / original) * 100)}%
        </span>
      )}
      <span className={`text-gray-400 ${subSizes[size]}`}>/ {product.unit || 'kg'}</span>
    </div>
  );
}
