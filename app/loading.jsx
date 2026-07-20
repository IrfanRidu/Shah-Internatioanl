export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--color-primary)' }} />
        <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
