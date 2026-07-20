'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import { Search, Download, Phone, Mail, Filter, ChevronDown, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminCustomersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 25, role: 'localBuyer,internationalBuyer' });
    if (search) p.set('search', search);
    if (buyerTypeFilter) p.set('buyerType', buyerTypeFilter);
    const res = await fetch(`/api/users?${p}`);
    const data = await res.json();
    if (!data.success && data.message) { toast.error(data.message); setLoading(false); return; }
    // API already filters by role — no need to double-filter client-side
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setPages(data.pages || 1);
    setLoading(false);
  }, [page, search, buyerTypeFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const onClick = (e) => { if (!exportRef.current?.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const exportAs = (fmt) => {
    const p = new URLSearchParams({ format: fmt });
    if (buyerTypeFilter) p.set('buyerType', buyerTypeFilter);
    window.open(`/api/admin/customers/export?${p}`, '_blank');
    setExportOpen(false);
  };

  const exportOptions = [
    { fmt: 'csv', label: 'CSV', icon: FileText },
    { fmt: 'xlsx', label: 'Excel (XLSX)', icon: FileSpreadsheet },
    { fmt: 'pdf', label: 'PDF', icon: FileType },
    { fmt: 'doc', label: 'Word (DOCX)', icon: FileType },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1><p className="text-sm text-gray-500">{total} registered customers</p></div>
        <div className="relative" ref={exportRef}>
          <button onClick={() => setExportOpen(!exportOpen)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-50">
              {exportOptions.map(({ fmt, label, icon: Icon }) => (
                <button key={fmt} onClick={() => exportAs(fmt)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Icon className="w-4 h-4 text-gray-400" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" />
        </div>
        <select value={buyerTypeFilter} onChange={e => setBuyerTypeFilter(e.target.value)} className="input-field py-2 text-sm w-auto">
          <option value="">All Buyers</option>
          <option value="local">🇧🇩 Local</option>
          <option value="international">🌍 International</option>
        </select>
      </div>

      {loading ? <Loader /> : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr>{['Customer', 'Type', 'Phone', 'Country/Company', 'Joined', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.length === 0 ? <tr><td colSpan={6} className="text-center py-16 text-gray-400">No customers found</td></tr> : users.map(u => (
                    <tr key={u._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>{u.name?.[0]}</div>
                          <div><p className="font-semibold text-gray-900 dark:text-white">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.buyerType === 'international' ? 'info' : 'success'}>
                          {u.buyerType === 'international' ? '🌍 Int\'l' : '🇧🇩 Local'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{u.company || u.country || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{format(new Date(u.createdAt), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {u.phone && <a href={`tel:${u.phone}`} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all" title="Call"><Phone className="w-4 h-4" /></a>}
                          <a href={`mailto:${u.email}`} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all" title="Email"><Mail className="w-4 h-4" /></a>
                          {u.phone && <a href={`https://wa.me/${u.phone?.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all" title="WhatsApp">💬</a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
