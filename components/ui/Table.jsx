'use client';
export default function Table({ columns, data, loading, emptyMessage = 'No data found' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {columns.map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="skeleton h-4 w-3/4" /></td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={row._id || i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className={`px-4 py-3 text-gray-800 dark:text-gray-200 ${col.className || ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
