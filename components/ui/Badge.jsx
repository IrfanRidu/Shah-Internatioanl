export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'text-white',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    harvest: 'badge-harvest',
    offseason: 'badge-offseason',
  };
  const style = variant === 'primary' ? { backgroundColor: 'var(--color-primary)' } : {};
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`} style={style}>
      {children}
    </span>
  );
}
