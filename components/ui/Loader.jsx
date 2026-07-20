export default function Loader({ size = 'md', text = 'Loading...' }) {
  const sizes = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-16 h-16' };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className={`${sizes[size]} border-4 border-gray-200 rounded-full animate-spin`} style={{ borderTopColor: 'var(--color-primary)' }} />
      {text && <p className="text-gray-500 text-sm">{text}</p>}
    </div>
  );
}
