'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, History, Trash2, RotateCcw, Plus, Pencil, X as XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';
import toast from 'react-hot-toast';

// Issue 45: every add/edit/delete anywhere in the export dashboard is recorded, and every deletion
// is recoverable. This page has two tabs: a chronological Activity Log, and a Recycle Bin from which
// deleted shipments/buyers/countries can be restored to their exact prior state.

const ACTION_META = {
  create: { label: 'Created', icon: Plus, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  update: { label: 'Updated', icon: Pencil, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  delete: { label: 'Deleted', icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  restore: { label: 'Restored', icon: RotateCcw, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
};

export default function ExportAuditLogPage() {
  const router = useRouter();
  const [tab, setTab] = useState('log'); // 'log' | 'bin'
  const [logs, setLogs] = useState([]);
  const [bin, setBin] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    const q = entityFilter ? `?entityType=${entityFilter}` : '';
    if (tab === 'log') {
      const r = await fetch(`/api/export/audit-log${q}`);
      const d = await r.json();
      setLogs(d.logs || []);
    } else {
      const r = await fetch(`/api/export/recycle-bin${q}`);
      const d = await r.json();
      setBin(d.items || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab, entityFilter]);

  const restore = async (item) => {
    if (!confirm(`Restore this ${item.entityType} ("${item.entityLabel}")? It will be put back exactly as it was before deletion.`)) return;
    setRestoringId(item._id);
    const r = await fetch(`/api/export/recycle-bin/${item._id}`, { method: 'POST' });
    const d = await r.json();
    setRestoringId(null);
    if (d.success) { toast.success('Restored successfully'); load(); }
    else toast.error(d.message || 'Restore failed');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/admin/export-dashboard')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-brand" /> Audit Log & Recycle Bin
          </h1>
          <p className="text-sm text-gray-500">Every add / edit / delete across the export dashboard, and full restore for anything deleted.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-sm font-medium">
          <button onClick={() => setTab('log')} className={`px-4 py-2 transition-colors ${tab === 'log' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Activity Log</button>
          <button onClick={() => setTab('bin')} className={`px-4 py-2 transition-colors ${tab === 'bin' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Recycle Bin</button>
        </div>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="input-field py-2 text-sm w-auto ml-auto">
          <option value="">All Types</option>
          <option value="shipment">Shipments</option>
          <option value="buyer">Buyers</option>
          <option value="country">Countries</option>
        </select>
      </div>

      {loading ? <Loader /> : tab === 'log' ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {logs.length === 0 && <div className="py-16 text-center text-gray-400">No activity recorded yet.</div>}
          {logs.map(log => {
            const meta = ACTION_META[log.action] || ACTION_META.update;
            const Icon = meta.icon;
            return (
              <div key={log._id} className="p-4 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-semibold">{meta.label}</span> {log.entityType} <span className="font-semibold">"{log.entityLabel}"</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.performedByName || log.performedByEmail || 'Unknown admin'} · {new Date(log.createdAt).toLocaleString()}
                  </p>
                  {(log.before || log.after) && (
                    <button onClick={() => setExpanded(expanded === log._id ? null : log._id)} className="text-xs text-brand hover:underline mt-1">
                      {expanded === log._id ? 'Hide details' : 'View details'}
                    </button>
                  )}
                  {expanded === log._id && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {log.before && (
                        <div className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-2">
                          <p className="text-[10px] font-semibold text-red-500 mb-1">BEFORE</p>
                          <pre className="text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto max-h-40">{JSON.stringify(log.before, null, 1)}</pre>
                        </div>
                      )}
                      {log.after && (
                        <div className="bg-green-50/50 dark:bg-green-900/10 rounded-lg p-2">
                          <p className="text-[10px] font-semibold text-green-600 mb-1">AFTER</p>
                          <pre className="text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto max-h-40">{JSON.stringify(log.after, null, 1)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {bin.length === 0 && <div className="py-16 text-center text-gray-400">Recycle bin is empty.</div>}
          {bin.map(item => (
            <div key={item._id} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-400">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 font-semibold">{item.entityLabel} <span className="text-xs font-normal text-gray-400">({item.entityType})</span></p>
                <p className="text-xs text-gray-400 mt-0.5">Deleted by {item.deletedByName || 'Unknown admin'} · {new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => restore(item)} disabled={restoringId === item._id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
