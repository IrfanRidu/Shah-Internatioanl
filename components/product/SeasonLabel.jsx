import { Leaf, Clock } from 'lucide-react';

export default function SeasonLabel({ isHarvestingSeason, harvestingSeason, size = 'sm' }) {
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' };
  if (isHarvestingSeason) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-semibold bg-green-100 text-green-700 ${sizes[size]}`}>
        <Leaf className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} /> In Season
        {harvestingSeason && size === 'md' && <span className="ml-1 text-green-500">({harvestingSeason})</span>}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold bg-amber-100 text-amber-700 ${sizes[size]}`}>
      <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} /> Off Season
      {size === 'md' && <span className="ml-1 text-amber-500">(Pre-order)</span>}
    </span>
  );
}
