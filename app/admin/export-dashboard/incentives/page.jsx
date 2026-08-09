'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckSquare, Square, Trash2, Eye, CheckCircle2, RotateCcw, Edit2, Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION } from '@/lib/incentiveUtils';

const TABS = [
  { key: 'available', label: 'Available for Incentive Application', icon: '📋' },
  { key: 'documentation', label: 'Incentive Documentations', icon: '📁' },
  { key: 'claimed', label: 'Claimed Incentive Applications', icon: '✅' },
];

// R10: one row per available shipment — company + category shown alongside, oldest→newest (the
// API already returns them in that order for ?availableForIncentive=1). R11/R18: click anywhere on
// a row to toggle selection; once anything is selected, every other shipment whose Export
// Contract/License/Currency don't match the first pick becomes visibly disabled, and everything
// disables once 10 are picked. R18: "Every shipment under a EXPORT CONTRACT NO will be displayed
// together" — grouped into one section per contract (group order follows each group's earliest
// shipment, preserving the overall oldest→newest feel; shipments within a group stay date-sorted).
function AvailableTab({ shipments, selected, isSelectable, toggleSelect, onProceed, proceeding }) {
  const groups = useMemo(() => {
    const byContract = new Map();
    shipments.forEach((s) => {
      const key = s.exportContract?._id || s.exportContract || '__none__';
      if (!byContract.has(key)) byContract.set(key, { contract: s.exportContract, items: [] });
      byContract.get(key).items.push(s);
    });
    // Map preserves insertion order, and `shipments` already arrives oldest→newest, so the first
    // shipment seen for a contract is already that group's earliest — no extra sort needed here.
    return [...byContract.values()];
  }, [shipments]);

  if (shipments.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No shipments are currently available for incentive application.<br />
        A shipment needs to be active with both an Export Contract and an Export License set, and not already part of another application.
      </div>
    );
  }
  return (
    <div>
      {selected.length > 0 && (
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-3">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{selected.length} of {MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION} selected — same Export Contract No &amp; License</p>
          <Button onClick={onProceed} loading={proceeding} variant="primary">Proceed for Incentive Documentation</Button>
        </div>
      )}
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.contract?._id || group.contract || 'none'}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {group.contract?.contractNo ? `Contract: ${group.contract.contractNo}` : 'No Export Contract'}
              {group.items.length > 1 && ` · ${group.items.length} shipments`}
            </p>
            <div className="space-y-2">
              {group.items.map((s) => {
                const checked = selected.includes(s._id);
                const disabled = !checked && !isSelectable(s);
                return (
                  <div key={s._id} onClick={() => toggleSelect(s)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${checked ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer' : disabled ? 'border-gray-100 dark:border-gray-800 opacity-40 cursor-not-allowed' : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'}`}>
                    <div className="flex-shrink-0">{checked ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-300" />}</div>
                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{s.shipmentNo}</p>
                        <p className="text-xs text-gray-400">{s.date ? new Date(s.date).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="min-w-0"><p className="text-xs text-gray-400">Company</p><p className="font-medium truncate">{s.buyer?.name || '—'}</p></div>
                      <div className="min-w-0"><p className="text-xs text-gray-400">Category</p><p className="font-medium truncate">{s.exportCategory?.name || '—'}</p></div>
                      <div className="min-w-0"><p className="text-xs text-gray-400">License</p><p className="font-medium truncate">{s.exportLicense?.licenseName || '—'}</p></div>
                      <div className="min-w-0"><p className="text-xs text-gray-400">Order Value</p><p className="font-medium truncate">{s.baseCurrency} {(s.orderValueForeign || 0).toLocaleString()}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// R12/R13: one card per Incentive Application. Documentation cards: rename inline, Mark as
// Incentive Claimed / View / Delete. Claimed cards: View / Unclaim only (no rename, no delete —
// "only can be unclaimed and viewed").
function ApplicationCardGrid({ apps, claimed, emptyText, onView, onClaim, onDelete, onUnclaim, renamingId, renameValue, setRenameValue, startRename, saveRename, cancelRename }) {
  if (apps.length === 0) return <div className="text-center py-16 text-gray-400">{emptyText}</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => (
        <div key={app._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 group">
          <div className="flex items-start justify-between gap-2 mb-2">
            {renamingId === app._id ? (
              <div className="flex items-center gap-1 flex-1">
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRename(app)} className="input-field py-1 text-sm flex-1" />
                <button onClick={() => saveRename(app)} className="p-1 text-green-600"><Check className="w-4 h-4" /></button>
                <button onClick={cancelRename} className="p-1 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
                <span className="truncate">{app.title}</span>
                {!claimed && <button onClick={() => startRename(app)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><Edit2 className="w-3.5 h-3.5 text-gray-400" /></button>}
              </h3>
            )}
            <Badge variant={claimed ? 'success' : 'warning'}>{claimed ? 'Claimed' : 'Documentation'}</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-1 truncate">{app.exportContract?.contractNo}{app.exportContract?.contractNo ? ' · ' : ''}{app.exportCategory?.name} · {app.exportLicense?.licenseName}</p>
          <p className="text-xs text-gray-400 mb-4">{app.shipments?.length || 0} shipment{app.shipments?.length === 1 ? '' : 's'}</p>
          <div className="flex gap-2">
            {claimed ? (
              <>
                <Button onClick={() => onView(app)} variant="secondary" size="sm" icon={Eye} className="flex-1">View</Button>
                <Button onClick={() => onUnclaim(app)} variant="secondary" size="sm" icon={RotateCcw} className="flex-1">Unclaim</Button>
              </>
            ) : (
              <>
                <Button onClick={() => onClaim(app)} variant="primary" size="sm" icon={CheckCircle2} className="flex-1">Mark Claimed</Button>
                <Button onClick={() => onView(app)} variant="secondary" size="sm" icon={Eye}>View</Button>
                <Button onClick={() => onDelete(app)} variant="secondary" size="sm" icon={Trash2} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IncentivesPage() {
  const router = useRouter();
  const [tab, setTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [availableShipments, setAvailableShipments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selected, setSelected] = useState([]);
  const [proceeding, setProceeding] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'delete'|'claim'|'unclaim', app }
  const [actionLoading, setActionLoading] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [availRes, appsRes] = await Promise.all([
        fetch('/api/export/shipments?availableForIncentive=1&limit=500').then((r) => r.json()),
        fetch('/api/export/incentive-applications').then((r) => r.json()),
      ]);
      setAvailableShipments(availRes.shipments || []);
      setApplications(appsRes.applications || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const docApps = applications.filter((a) => a.status === 'documentation');
  const claimedApps = applications.filter((a) => a.status === 'claimed');

  // R11/R18
  const firstSelected = useMemo(() => (selected.length ? availableShipments.find((s) => s._id === selected[0]) : null), [selected, availableShipments]);
  const isSelectable = (s) => {
    if (selected.length >= MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION) return false;
    if (!firstSelected) return true;
    return String(s.exportContract?._id || s.exportContract) === String(firstSelected.exportContract?._id || firstSelected.exportContract)
      && String(s.exportLicense?._id) === String(firstSelected.exportLicense?._id)
      && s.baseCurrency === firstSelected.baseCurrency;
  };
  const toggleSelect = (s) => {
    const checked = selected.includes(s._id);
    if (!checked && !isSelectable(s)) return;
    setSelected((prev) => (prev.includes(s._id) ? prev.filter((id) => id !== s._id) : [...prev, s._id]));
  };

  const handleProceed = async () => {
    setProceeding(true);
    try {
      const r = await fetch('/api/export/incentive-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipmentIds: selected }) });
      const d = await r.json();
      if (d.success) { toast.success('Moved to Incentive Documentations'); setSelected([]); setTab('documentation'); load(); }
      else toast.error(d.message);
    } finally { setProceeding(false); }
  };

  const runAction = async (url, method, successMsg) => {
    setActionLoading(true);
    try {
      const r = await fetch(url, { method });
      const d = await r.json();
      if (d.success) { toast.success(successMsg); setConfirmModal(null); load(); }
      else toast.error(d.message);
    } finally { setActionLoading(false); }
  };

  const startRename = (app) => { setRenamingId(app._id); setRenameValue(app.title); };
  const saveRename = async (app) => {
    const r = await fetch(`/api/export/incentive-applications/${app._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: renameValue }) });
    const d = await r.json();
    if (d.success) { setRenamingId(null); load(); } else toast.error(d.message);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/admin/export-dashboard')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💰 Incentive</h1>
          <p className="text-sm text-gray-500">Government export incentive applications — bundle shipments, document, and claim.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={tab === t.key ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {t.icon} {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {t.key === 'available' ? availableShipments.length : t.key === 'documentation' ? docApps.length : claimedApps.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'available' && <AvailableTab shipments={availableShipments} selected={selected} isSelectable={isSelectable} toggleSelect={toggleSelect} onProceed={handleProceed} proceeding={proceeding} />}
      {tab === 'documentation' && (
        <ApplicationCardGrid apps={docApps} emptyText="No pending Incentive Applications yet — select shipments in Available for Incentive Application and proceed."
          renamingId={renamingId} renameValue={renameValue} setRenameValue={setRenameValue} startRename={startRename} saveRename={saveRename} cancelRename={() => setRenamingId(null)}
          onView={(app) => router.push(`/admin/export-dashboard/incentives/${app._id}`)}
          onClaim={(app) => setConfirmModal({ type: 'claim', app })}
          onDelete={(app) => setConfirmModal({ type: 'delete', app })} />
      )}
      {tab === 'claimed' && (
        <ApplicationCardGrid apps={claimedApps} claimed emptyText="No claimed Incentive Applications yet."
          onView={(app) => router.push(`/admin/export-dashboard/incentives/${app._id}`)}
          onUnclaim={(app) => setConfirmModal({ type: 'unclaim', app })} />
      )}

      <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)}
        title={confirmModal?.type === 'delete' ? 'Delete Incentive Application?' : confirmModal?.type === 'claim' ? 'Mark as Incentive Claimed?' : 'Unclaim Incentive Application?'}>
        {confirmModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmModal.type === 'delete' && `This deletes "${confirmModal.app.title}" and frees its ${confirmModal.app.shipments?.length || 0} shipment(s) back to Available for Incentive Application. This can't be undone.`}
              {confirmModal.type === 'claim' && `This freezes the BDT rate for all ${confirmModal.app.shipments?.length || 0} shipment(s) in "${confirmModal.app.title}", marks them completed, and moves them to Export Archive. They'll become fully locked until this application is unclaimed.`}
              {confirmModal.type === 'unclaim' && `This reverses the claim on "${confirmModal.app.title}" — its ${confirmModal.app.shipments?.length || 0} shipment(s) become active and editable again, and leave Export Archive.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmModal(null)} variant="secondary">Cancel</Button>
              <Button
                onClick={() => {
                  if (confirmModal.type === 'delete') runAction(`/api/export/incentive-applications/${confirmModal.app._id}`, 'DELETE', 'Deleted');
                  else if (confirmModal.type === 'claim') runAction(`/api/export/incentive-applications/${confirmModal.app._id}/claim`, 'POST', 'Marked as Incentive Claimed');
                  else runAction(`/api/export/incentive-applications/${confirmModal.app._id}/unclaim`, 'POST', 'Unclaimed');
                }}
                loading={actionLoading} variant={confirmModal.type === 'delete' ? 'danger' : 'primary'}>
                {confirmModal.type === 'delete' ? 'Delete' : confirmModal.type === 'claim' ? 'Mark as Claimed' : 'Unclaim'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
