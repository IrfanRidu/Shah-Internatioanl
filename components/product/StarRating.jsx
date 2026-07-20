'use client';
export default function StarRating({ rating = 0, max = 5, size = 'md', interactive = false, onChange }) {
  const sizes = { sm: 'w-3 h-3', md: 'w-5 h-5', lg: 'w-7 h-7' };
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating);
        const partial = !filled && i < rating;
        return (
          <button
            key={i}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onChange?.(i + 1) : undefined}
            className={`${sizes[size]} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} flex-shrink-0`}
            disabled={!interactive}
          >
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <defs>
                {partial && (
                  <linearGradient id={`partial-${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset={`${(rating % 1) * 100}%`} stopColor="#f59e0b" />
                    <stop offset={`${(rating % 1) * 100}%`} stopColor="#d1d5db" />
                  </linearGradient>
                )}
              </defs>
              <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill={filled ? '#f59e0b' : partial ? `url(#partial-${i})` : '#e5e7eb'}
                stroke={filled || partial ? '#f59e0b' : '#e5e7eb'}
                strokeWidth="1"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
