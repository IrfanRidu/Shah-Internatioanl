'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Upload, Trash2, FileText, Lock, RotateCcw, Printer, Download, Edit3 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Loader from '@/components/ui/Loader';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';
import { calculateIncentiveCosting, resolveEffectiveRateBDT } from '@/lib/incentiveUtils';
import {
  DEFAULT_KA_FORM_TEXT, resolveKaFormText, generateKaFormPDF, downloadKaFormPDF, downloadKaFormDOCX, generateKaFormXLSX,
  resolveStampApplicationText, assembleStampApplicationText, generateStampApplicationPDF, downloadStampApplicationPDF, downloadStampApplicationDOCX, generateStampApplicationXLSX,
} from '@/lib/kaFormDocuments';

// Plain Western grouping (.toLocaleString()) throughout this admin working view, matching every
// other number displayed elsewhere in this app (shipment cards, buyer pages, etc.) — the South
// Asian/lakh-style grouping the real Ka Form document itself uses (confirmed from the reference
// PDF: "EURO 5,00,000.00") is reserved for the actual printable Ka Form tab/document, which is
// deliberately styled to look like the authentic government form rather than match this app's own
// UI conventions. Keeping the two visually distinct is intentional, not an inconsistency.
const money = (n) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
// Section E/Stamp Application's "latest TT entry" per shipment (R19: "Date of Repatriation").
const latestTT = (ttEntries) => (ttEntries || []).reduce((latest, tt) => (!latest || new Date(tt.ttDate) > new Date(latest.ttDate) ? tt : latest), null);

// Same hook as the shipment editor (app/.../shipments/[shipmentId]/page.jsx) — duplicated locally
// rather than extracted to a shared file, matching this codebase's existing convention of a few
// small per-page helpers (e.g. flagEmoji) rather than a shared-hooks module.
function useLiveRate(currency) {
  const [rate, setRate] = useState(null);
  const [bdtRate, setBdtRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/currency');
      const d = await r.json();
      const rates = d.rates || {};
      setRate(rates[currency] || 1);
      setBdtRate(rates.BDT || null);
    } catch {}
    setLoading(false);
  }, [currency]);
  useEffect(() => { fetch_(); }, [fetch_]);
  const bdtPerUnit = (bdtRate && rate) ? bdtRate / rate : null;
  return { bdtPerUnit, loading, refresh: fetch_ };
}

const DETAIL_TABS = [
  { key: 'details', label: 'Incentive Details' },
  { key: 'kaform', label: 'Ka Form' },
  { key: 'others', label: 'Others' },
];

// R16: same at-a-glance info as the buyer's shipment-list card. Grid below caps this at 5 per row.
function ShipmentMiniCard({ s }) {
  return (
    <Link href={`/admin/export-dashboard/countries/${s.country?._id}/buyers/${s.buyer?._id}/shipments/${s._id}`}
      className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.shipmentNo}</p>
        <Badge variant={s.status === 'completed' ? 'success' : 'info'}>{s.status}</Badge>
      </div>
      <p className="text-xs text-gray-400 mb-2 truncate">{s.date ? new Date(s.date).toLocaleDateString() : ''} · {s.country?.flag} {s.country?.name}</p>
      <p className="text-xs text-gray-500 truncate mb-2">{s.buyer?.name}</p>
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
        <span>Net: {s.totalNetWeightKg || 0} kg</span>
        <span>CTN: {s.totalCTN || 0}</span>
        <span className="col-span-2 font-semibold text-gray-700 dark:text-gray-300 truncate">{s.baseCurrency} {(s.orderValueForeign || 0).toLocaleString()}</span>
      </div>
    </Link>
  );
}

// R14: Ka Form and Others share the exact same shape (notes + file uploads) — no field spec was
// given for either beyond "3 tabs", so this is the most generic, defensible interpretation: a place
// to jot notes and attach whatever supporting documents the government incentive application needs.
function DocSection({ field, label, notes, onNotesChange, onSaveNotes, savingNotes, files, onUpload, uploading, onRemove, locked }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label} Notes</label>
        <textarea rows={5} disabled={locked} value={notes} onChange={(e) => onNotesChange(e.target.value)} onBlur={() => onSaveNotes(field, notes)}
          className="input-field resize-none disabled:opacity-60" placeholder={`Notes for ${label}...`} />
        {savingNotes && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label} Documents</p>
        {!locked && (
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer text-sm text-gray-500 hover:border-brand hover:text-brand transition-all w-fit">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload Document (PDF/Image)'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(field, file); e.target.value = ''; }} />
          </label>
        )}
        {(files || []).map((doc, i) => (
          <div key={i} className="flex items-center gap-3 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline flex-1 truncate">{doc.name}</a>
            {!locked && <button onClick={() => onRemove(field, i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
        {(files || []).length === 0 && <p className="text-xs text-gray-400 mt-1">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}

// A single label/value row — Section A/B/D's read-only fields all use this same small shape.
// R21: Ka Form tab — language sub-tabs, a live PDF preview (the SAME generated document used for
// Download/Print, embedded directly via a blob URL — guarantees the preview can never drift from
// the real output, and avoids building a second, parallel HTML re-implementation of the A3 layout
// just for previewing), and Download(format)/Print/Edit Text actions matching the shipment editor's
// own DocActionBar conventions.
function KaFormPanel({ application, locked, onSaved }) {
  const [lang, setLang] = useState('en');
  const [previewUrl, setPreviewUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true; let objectUrl = '';
    (async () => {
      setGenerating(true);
      try {
        const doc = await generateKaFormPDF(application, lang);
        objectUrl = doc.output('bloburl');
        if (active) setPreviewUrl(objectUrl);
      } catch { if (active) toast.error('Could not render the Ka Form preview'); }
      finally { if (active) setGenerating(false); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [application, lang]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (downloadFormat === 'docx') await downloadKaFormDOCX(application, lang);
      else if (downloadFormat === 'xlsx') generateKaFormXLSX(application, lang);
      else await downloadKaFormPDF(application, lang);
    } catch { toast.error('Could not generate the document'); }
    finally { setDownloading(false); }
  };
  const handlePrint = () => { if (previewUrl) window.open(previewUrl, '_blank'); else toast.error('Still rendering — try again in a moment'); };
  const openEditor = () => {
    const d = {};
    Object.keys(DEFAULT_KA_FORM_TEXT.en).forEach((k) => { d[k] = resolveKaFormText(application, lang, k); });
    setDraft(d); setEditing(true);
  };
  const saveEdits = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${application._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kaForm: { ...(application.kaForm || {}), textOverrides: { ...(application.kaForm?.textOverrides || {}), [lang]: draft } } }),
      });
      const d = await r.json();
      if (d.success) { toast.success('Saved'); setEditing(false); onSaved(); } else toast.error(d.message);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium w-fit mb-4">
        <button onClick={() => setLang('en')} className={`px-4 py-2 transition-colors ${lang === 'en' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`} style={lang === 'en' ? { backgroundColor: 'var(--color-primary)' } : {}}>English</button>
        <button onClick={() => setLang('bn')} className={`px-4 py-2 border-l border-gray-200 dark:border-gray-700 transition-colors ${lang === 'bn' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`} style={lang === 'bn' ? { backgroundColor: 'var(--color-primary)' } : {}}>বাংলা (Bengali)</button>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
        <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="input-field py-1.5 text-xs w-auto" title="Download format">
          <option value="pdf">PDF</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option>
        </select>
        <button onClick={handleDownload} disabled={downloading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60">
          <Download className="w-3.5 h-3.5" /> {downloading ? 'Preparing…' : 'Download'}
        </button>
        {!locked && (
          <button onClick={openEditor} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Edit3 className="w-3.5 h-3.5" /> Edit Text
          </button>
        )}
      </div>
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800/50 relative" style={{ height: 700 }}>
        {generating && <div className="absolute inset-0 flex items-center justify-center"><Loader /></div>}
        {previewUrl && <iframe src={previewUrl} className="w-full h-full" title="Ka Form preview" />}
      </div>

      <Modal isOpen={editing} onClose={() => setEditing(false)} title={`Edit Ka Form Text — ${lang === 'en' ? 'English' : 'Bengali'}`} size="lg"
        footer={<div className="flex gap-3"><Button onClick={saveEdits} loading={saving} variant="primary">Save</Button><Button onClick={() => setEditing(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-gray-400">These are the boilerplate labels and notes printed on the form — the data fields (applicant, contract, amounts...) come from the Incentive Details tab and aren't edited here.</p>
          {Object.keys(draft).map((k) => (
            <div key={k}>
              <label className="text-xs text-gray-400 block mb-1 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
              {(k === 'declaration' || k.startsWith('note')) ? (
                <textarea rows={3} className="input-field text-sm resize-none" value={draft[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
              ) : (
                <input className="input-field text-sm" value={draft[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// R22: Others tab's Stamp Application section — same language-tabs/preview/actions shape as
// KaFormPanel above, but a single flowing-text Edit (one textarea, pre-filled with the CURRENT
// auto-assembled text) rather than many small labeled fields, matching how the underlying data is
// actually shaped (see resolveStampApplicationText's own contract).
function StampApplicationPanel({ application, locked, onSaved }) {
  const [lang, setLang] = useState('en');
  const [previewUrl, setPreviewUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const ctx = useMemo(() => ({
    shipments: application.shipments || [],
    license: application.exportLicense,
    contract: application.exportContract,
    bank: application.shipments?.[0]?.bankAccount,
  }), [application]);

  // Issue 1 (R25): Ka Form and Stamp Application no longer use the letterhead at all (reversing R24
  // issue 9 for just these 2 documents) — both are plain paper now (Ka Form: A3; Stamp Application:
  // legal size), per the explicit ask. No letterhead fetch/threading needed any more.
  useEffect(() => {
    let active = true; let objectUrl = '';
    (async () => {
      setGenerating(true);
      try {
        const doc = await generateStampApplicationPDF(application, lang, ctx);
        objectUrl = doc.output('bloburl');
        if (active) setPreviewUrl(objectUrl);
      } catch { if (active) toast.error('Could not render the Stamp Application preview'); }
      finally { if (active) setGenerating(false); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [application, lang, ctx]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (downloadFormat === 'docx') await downloadStampApplicationDOCX(application, lang, ctx);
      else if (downloadFormat === 'xlsx') generateStampApplicationXLSX(application, lang, ctx);
      else await downloadStampApplicationPDF(application, lang, ctx);
    } catch { toast.error('Could not generate the document'); }
    finally { setDownloading(false); }
  };
  const handlePrint = () => { if (previewUrl) window.open(previewUrl, '_blank'); else toast.error('Still rendering — try again in a moment'); };
  const openEditor = () => { setDraft(resolveStampApplicationText({ application, ...ctx, lang })); setEditing(true); };
  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${application._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ others: { ...(application.others || {}), stampApplication: { textOverride: { ...(application.others?.stampApplication?.textOverride || {}), [lang]: draft } } } }),
      });
      const d = await r.json();
      if (d.success) { toast.success('Saved'); setEditing(false); onSaved(); } else toast.error(d.message);
    } finally { setSaving(false); }
  };
  const resetToAuto = () => setDraft(assembleStampApplicationText({ application, ...ctx, lang }));

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Stamp Application</p>
      <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium w-fit mb-4">
        <button onClick={() => setLang('en')} className={`px-4 py-2 transition-colors ${lang === 'en' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`} style={lang === 'en' ? { backgroundColor: 'var(--color-primary)' } : {}}>English</button>
        <button onClick={() => setLang('bn')} className={`px-4 py-2 border-l border-gray-200 dark:border-gray-700 transition-colors ${lang === 'bn' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`} style={lang === 'bn' ? { backgroundColor: 'var(--color-primary)' } : {}}>বাংলা (Bengali)</button>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
        <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="input-field py-1.5 text-xs w-auto" title="Download format">
          <option value="pdf">PDF</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option>
        </select>
        <button onClick={handleDownload} disabled={downloading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60">
          <Download className="w-3.5 h-3.5" /> {downloading ? 'Preparing…' : 'Download'}
        </button>
        {!locked && (
          <button onClick={openEditor} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Edit3 className="w-3.5 h-3.5" /> Edit Text
          </button>
        )}
      </div>
      <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800/50 relative" style={{ height: 500 }}>
        {generating && <div className="absolute inset-0 flex items-center justify-center"><Loader /></div>}
        {previewUrl && <iframe src={previewUrl} className="w-full h-full" title="Stamp Application preview" />}
      </div>

      <Modal isOpen={editing} onClose={() => setEditing(false)} title={`Edit Stamp Application — ${lang === 'en' ? 'English' : 'Bengali'}`} size="xl"
        footer={<div className="flex gap-3"><Button onClick={saveEdit} loading={saving} variant="primary">Save</Button><Button onClick={resetToAuto} variant="ghost">Reset to Auto-filled</Button><Button onClick={() => setEditing(false)} variant="ghost">Cancel</Button></div>}>
        <p className="text-xs text-gray-400 mb-2">Pre-filled with the current auto-assembled text (from the Incentive Details/Export License/Contract data). Editing and saving freezes this exact wording — it won't update automatically after that until you Reset.</p>
        <textarea rows={20} className="input-field text-sm font-mono resize-none" value={draft} onChange={(e) => setDraft(e.target.value)} dir={lang === 'bn' ? 'auto' : 'ltr'} />
      </Modal>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  );
}

export default function IncentiveApplicationDetailPage() {
  const router = useRouter();
  const { applicationId } = useParams();
  const [tab, setTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [manualRate, setManualRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [kaFormNotes, setKaFormNotes] = useState('');
  const [othersNotes, setOthersNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploading, setUploading] = useState(false);
  // R19/R20: Section D/F's admin-editable fields — local state so the live costing preview updates
  // instantly on every keystroke, saved to the server on blur (same UX contract the notes textareas
  // above already use).
  const [supplierNameAddress, setSupplierNameAddress] = useState('');
  const [goodsNameOverride, setGoodsNameOverride] = useState('');
  const [goodsQuantityOverrideKg, setGoodsQuantityOverrideKg] = useState('');
  const [commissionInsuranceValue, setCommissionInsuranceValue] = useState('');
  const [commissionInsuranceLabel, setCommissionInsuranceLabel] = useState('');
  const [savingKaFormField, setSavingKaFormField] = useState(false);

  // R19/R20, fixed R24 (issue 3): every save-then-refresh call site below used to share the SAME
  // `loading` flag as the page's very first load, and `if (loading) return <Loader />` a few dozen
  // lines down unmounts EVERYTHING under it while that flag is true — so saving so much as one field
  // (Name of Goods, Quantity, the manual rate, an upload, a Ka Form/Stamp Application edit via
  // onSaved) replaced the whole page with a spinner and then remounted it from scratch, which is what
  // reads as "the whole page reloads". The actual data refetch after a save is correct and necessary
  // (the PUT route recomputes the whole group's incentive distribution server-side, so the client
  // needs the fresh computed numbers back) — only the full-page loading GATE around it was wrong.
  // Fix: silent by default (updates `application` in place, same smooth re-render as any other prop
  // change, no unmount); only the initial mount below explicitly asks for the full-page loader.
  const load = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${applicationId}`);
      const d = await r.json();
      if (d.success) {
        setApplication(d.application);
        setManualRate(d.application.manualRateBDT ?? '');
        setKaFormNotes(d.application.kaForm?.notes || '');
        setOthersNotes(d.application.others?.notes || '');
        setSupplierNameAddress(d.application.kaForm?.supplierNameAddress ?? 'Self-collected / own arrangement');
        setGoodsNameOverride(d.application.kaForm?.goodsNameOverride || '');
        setGoodsQuantityOverrideKg(d.application.kaForm?.goodsQuantityOverrideKg ?? '');
        setCommissionInsuranceValue(d.application.kaForm?.commissionInsuranceValue ?? 0);
        setCommissionInsuranceLabel(d.application.kaForm?.commissionInsuranceLabel ?? 'N/A');
      } else toast.error(d.message);
    } finally { if (showLoader) setLoading(false); }
  }, [applicationId]);
  useEffect(() => { load({ showLoader: true }); }, [load]);

  const { bdtPerUnit, loading: rateLoading, refresh } = useLiveRate(application?.referenceCurrency || 'EUR');
  const locked = application?.status === 'claimed';

  // R19/R20: the live costing preview — same resolver + formula the server uses (resolveEffective-
  // RateBDT / calculateIncentiveCosting, both imported from lib/incentiveUtils.js, never
  // reimplemented here), so what's shown always matches exactly what gets persisted. Uses the
  // LOCAL commissionInsuranceValue state (not application.kaForm's saved value) so the preview
  // updates instantly on every keystroke, before the on-blur save round-trip completes.
  //
  // Issue 2: resolveEffectiveRateBDT only knows about the manual rate, the claimed-and-locked rate,
  // and the shipment's own (possibly stale, manually-typed-once) rate — it has no notion of "live" at
  // all, and the useLiveRate() hook above was being fetched and DISPLAYED (the little rate card) but
  // never actually fed into this calculation, so "Payable Incentive (BDT)" was silently using the
  // shipment's stored rate even when the UI said "shipments use the live rate". Fixed here rather than
  // inside resolveEffectiveRateBDT itself, since that function is shared with the Ka Form PDF
  // generator, which must stay deterministic (a generated document shouldn't reflow to a different
  // number if reopened a minute later) — this page's own live preview is the right place for "live
  // until a manual rate is set" to actually apply.
  const storedEffectiveRateBDT = application?.shipments?.length ? resolveEffectiveRateBDT(application.shipments[0], application) : 0;
  const hasRateOverride = (application?.manualRateBDT !== null && application?.manualRateBDT !== undefined && application?.manualRateBDT !== '')
    || (application?.status === 'claimed' && !!application?.lockedRateBDT);
  const effectiveRateBDT = (!hasRateOverride && bdtPerUnit) ? bdtPerUnit : storedEffectiveRateBDT;
  const totalGrossWeightKg = (application?.shipments || []).reduce((sum, s) => sum + (Number(s.totalGrossWeightKg) || 0), 0);
  const costing = application ? calculateIncentiveCosting({
    shipments: application.shipments || [],
    category: application.exportCategory,
    effectiveRateBDT,
    commissionInsuranceValue: Number(commissionInsuranceValue) || 0,
  }) : null;
  // Section C: every TT entry across every member shipment, flattened into one table.
  const ttRows = (application?.shipments || []).flatMap((s) => (s.ttEntries || []).map((tt, i) => ({ ...tt, shipmentNo: s.shipmentNo, key: `${s._id}-${i}` })));

  // R15: "Input manual rate" — once set, wins over live everywhere for every member shipment.
  const saveManualRate = async () => {
    setSavingRate(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${applicationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualRateBDT: manualRate === '' ? null : Number(manualRate) }),
      });
      const d = await r.json();
      if (d.success) { toast.success('Rate updated — recalculated for every shipment in this application'); load(); } else toast.error(d.message);
    } finally { setSavingRate(false); }
  };

  const saveNotes = async (field, value) => {
    setSavingNotes(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${applicationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: { ...(application[field] || {}), notes: value } }),
      });
      const d = await r.json();
      if (!d.success) toast.error(d.message);
    } finally { setSavingNotes(false); }
  };

  // R19/R20: patches one or more kaForm sub-fields (supplierNameAddress, goodsNameOverride,
  // goodsQuantityOverrideKg, commissionInsuranceValue/Label) — same merge-and-PUT shape saveNotes
  // uses for kaForm.notes, just for the new structured fields instead of free text. Triggers a
  // server-side recompute of the whole group's incentive distribution when it lands (the PUT route
  // reruns the cascade on any kaForm change — see that route's own comment).
  const saveKaFormField = async (patch) => {
    setSavingKaFormField(true);
    try {
      const r = await fetch(`/api/export/incentive-applications/${applicationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kaForm: { ...(application.kaForm || {}), ...patch } }),
      });
      const d = await r.json();
      if (d.success) load(); else toast.error(d.message);
    } finally { setSavingKaFormField(false); }
  };

  // Same base64-JSON upload contract as the shipment editor's Additional Documents uploader. Accepts
  // PDFs as well as images (accept=".pdf,.jpg,.jpeg,.png" below) — resizeImageFile only applies to
  // actual images (it rejects anything else), so a PDF still goes through as before, unresized.
  const handleUpload = (field, file) => {
    setUploading(true);
    const toDataUrl = file.type?.startsWith('image/')
      ? resizeImageFile(file, { maxDimension: 1600, quality: 0.85 })
      : new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
    toDataUrl.then(async (dataUrl) => {
      try {
        const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'incentive-applications' }) });
        const data = await res.json();
        if (!data.success) { toast.error(data.message || 'Upload failed'); return; }
        const files = [...(application[field]?.files || []), { name: file.name, url: data.url }];
        const r2 = await fetch(`/api/export/incentive-applications/${applicationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: { ...(application[field] || {}), files } }) });
        const d2 = await r2.json();
        if (d2.success) { toast.success('Uploaded'); load(); } else toast.error(d2.message);
      } finally { setUploading(false); }
    }).catch((err) => { toast.error(err.message || 'Upload failed'); setUploading(false); });
  };

  const removeFile = async (field, idx) => {
    const files = (application[field]?.files || []).filter((_, i) => i !== idx);
    const r = await fetch(`/api/export/incentive-applications/${applicationId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: { ...(application[field] || {}), files } }) });
    const d = await r.json();
    if (d.success) { toast.success('Removed'); load(); } else toast.error(d.message);
  };

  if (loading) return <Loader />;
  if (!application) return <div className="text-center py-16 text-gray-400">Incentive Application not found.</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/admin/export-dashboard/incentives')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {application.title}
            <Badge variant={locked ? 'success' : 'warning'}>{locked ? 'Claimed' : 'Documentation'}</Badge>
          </h1>
          <p className="text-sm text-gray-500">{application.exportContract?.contractNo}{application.exportContract?.contractNo ? ' · ' : ''}{application.exportCategory?.name} · {application.exportLicense?.licenseName} · {application.shipments?.length || 0} shipment(s)</p>
        </div>
      </div>

      {locked && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Claimed — every shipment here is locked</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Unclaim to make further changes to the rate, Ka Form, Others, or any of the {application.shipments?.length || 0} shipments below.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2 flex-wrap">
        {DETAIL_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={tab === t.key ? { backgroundColor: 'var(--color-primary)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div>
          {/* R15 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Rate in BDT (live)</p>
                <button onClick={refresh} disabled={rateLoading} className="p-1 rounded text-blue-500 hover:bg-blue-100 transition-all"><RefreshCw className={`w-3.5 h-3.5 ${rateLoading ? 'animate-spin' : ''}`} /></button>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{bdtPerUnit ? `৳${bdtPerUnit.toFixed(2)}` : '...'}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">per 1 {application.referenceCurrency} — the live rate of BDT against these shipments' base currency</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Input manual rate</p>
              <div className="flex gap-2">
                <Input type="number" min="0" disabled={locked} value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="Leave blank to use live rate" />
                <Button onClick={saveManualRate} loading={savingRate} disabled={locked} variant="primary">Save</Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {application.manualRateBDT ? `Active — overriding the live rate for all ${application.shipments?.length || 0} shipments, everywhere.` : 'Not set — shipments use the live rate (or their own Rate in BDT once claimed freezes it).'}
              </p>
            </div>
          </div>

          {/* R19: Section A — Name and Address of the Applicant / ERC No, entirely from Export
              License — nothing editable here, this IS the license's own data. */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section A — Name &amp; Address of the Applicant</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Name & Address" value={application.exportLicense?.licenseName ? `${application.exportLicense.licenseName}, ${application.exportLicense.address || ''}` : '— set this on the Export License —'} />
              <Field label="Export Registration Certificate (ERC) No." value={application.exportLicense?.ercNumber} mono />
            </div>
          </div>

          {/* R19: Section B — from the Export Contract this application is grouped under (R18). */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section B — Export L/C / Contract No., Date &amp; Value</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Contract No" value={application.exportContract?.contractNo} mono />
              <Field label="Date" value={fmtDate(application.exportContract?.date)} />
              <Field label="Value" value={application.exportContract ? `${application.exportContract.baseCurrency} ${money(application.exportContract.value)}` : '—'} />
            </div>
          </div>

          {/* R19: Section C — every TT entry across every member shipment. */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 overflow-x-auto">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section C — TT No., Date &amp; Value</p>
            {ttRows.length === 0 ? <p className="text-sm text-gray-400">No TT entries yet on any shipment in this application.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-1.5 pr-3 font-medium">SL</th><th className="py-1.5 pr-3 font-medium">TT No.</th><th className="py-1.5 pr-3 font-medium">Date</th><th className="py-1.5 pr-3 font-medium">Shipment</th><th className="py-1.5 text-right font-medium">Value ({application.referenceCurrency})</th>
                </tr></thead>
                <tbody>
                  {ttRows.map((tt, i) => (
                    <tr key={tt.key} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                      <td className="py-1.5 pr-3 font-mono">{tt.ttNumber}</td>
                      <td className="py-1.5 pr-3">{fmtDate(tt.ttDate)}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{tt.shipmentNo}</td>
                      <td className="py-1.5 text-right font-semibold">{money(tt.ttValue)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold"><td colSpan={4} className="py-1.5 pr-3">TOTAL</td><td className="py-1.5 text-right">{money(ttRows.reduce((s, tt) => s + (Number(tt.ttValue) || 0), 0))}</td></tr>
                </tbody>
              </table>
            )}
          </div>

          {/* R19: Section D — Supplier + Goods editable, Value computed (= Net FOB total, Section
              F below — confirmed against the real reference form, where the same figure appears in
              both places; NOT "order value + freight" as an isolated reading of the prose spec
              alone would suggest — see KA_FORM_AND_STAMP_REFERENCE.md's own correction note). */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section D — Source of Collection of the Exported Goods</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Name &amp; Address of Supplier</label>
                <input disabled={locked} value={supplierNameAddress} onChange={(e) => setSupplierNameAddress(e.target.value)}
                  onBlur={() => saveKaFormField({ supplierNameAddress })} className="input-field text-sm disabled:opacity-60" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Name of Goods</label>
                <input disabled={locked} value={goodsNameOverride} onChange={(e) => setGoodsNameOverride(e.target.value)}
                  onBlur={() => saveKaFormField({ goodsNameOverride })} placeholder={application.exportCategory?.name || ''} className="input-field text-sm disabled:opacity-60" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Quantity of Goods (KG)</label>
                <input disabled={locked} type="number" min="0" value={goodsQuantityOverrideKg} onChange={(e) => setGoodsQuantityOverrideKg(e.target.value)}
                  onBlur={() => saveKaFormField({ goodsQuantityOverrideKg: goodsQuantityOverrideKg === '' ? null : Number(goodsQuantityOverrideKg) })}
                  placeholder={String(totalGrossWeightKg)} className="input-field text-sm disabled:opacity-60" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
              <Field label="Value (computed — Net FOB Export Value, see Section F)" value={`${application.referenceCurrency} ${money(costing?.netFobFC)}`} />
            </div>
            {savingKaFormField && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
          </div>

          {/* R19: Section E — one row per member shipment. Entirely computed/derived, no editable
              pieces here (matches the reference form — only Section D/F have admin-editable cells). */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 overflow-x-auto">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section E — Details of the Export Consignment</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-1.5 pr-3 font-medium">SL</th><th className="py-1.5 pr-3 font-medium">Goods</th><th className="py-1.5 pr-3 font-medium">Qty</th>
                <th className="py-1.5 pr-3 text-right font-medium">Invoice Value</th><th className="py-1.5 pr-3 font-medium">Ship Date</th>
                <th className="py-1.5 pr-3 font-medium">EXP No.</th><th className="py-1.5 text-right font-medium">Repatriated (Date)</th>
              </tr></thead>
              <tbody>
                {(application.shipments || []).map((s, i) => {
                  const invoiceValueFC = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
                  const tt = latestTT(s.ttEntries);
                  return (
                    <tr key={s._id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                      <td className="py-1.5 pr-3">{application.exportCategory?.name}</td>
                      <td className="py-1.5 pr-3">{s.totalGrossWeightKg || 0} kg</td>
                      <td className="py-1.5 pr-3 text-right font-semibold">{money(invoiceValueFC)}</td>
                      <td className="py-1.5 pr-3">{fmtDate(s.date)}</td>
                      <td className="py-1.5 pr-3 font-mono">{s.expNo}{s.expDate ? `/${new Date(s.expDate).getFullYear()}` : ''}</td>
                      <td className="py-1.5 text-right">{money(invoiceValueFC)} <span className="text-gray-400">({tt ? fmtDate(tt.ttDate) : '—'})</span></td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td colSpan={2} className="py-1.5 pr-3">TOTAL</td>
                  <td className="py-1.5 pr-3">{totalGrossWeightKg} kg</td>
                  <td className="py-1.5 pr-3 text-right">{money(costing?.totalRepatriatedFC)}</td>
                  <td colSpan={2}></td>
                  <td className="py-1.5 text-right">{money(costing?.totalRepatriatedFC)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* R19/R20: Section F — per-shipment AWB/Freight rows (Commission/Net FOB/Incentive
              Receivable are aggregate-only, matching the real reference form, which leaves those
              cells blank/dash per row and only fills them on the TOTAL row). */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 overflow-x-auto">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Section F — Amount of Incentive Applied For</p>
            <table className="w-full text-sm mb-3">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-1.5 pr-3 font-medium">Airway Bill / BL No.</th>
                <th className="py-1.5 text-right font-medium">(1) Repatriated (FC)</th>
                <th className="py-1.5 text-right font-medium">(2) Freight (FC)</th>
              </tr></thead>
              <tbody>
                {(application.shipments || []).map((s) => (
                  <tr key={s._id} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-1.5 pr-3 font-mono">{s.awbNo || '—'}</td>
                    <td className="py-1.5 text-right">{money((Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0))}</td>
                    <td className="py-1.5 text-right">{money(s.freightCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">(3) Commission, Insurance, etc. (FC) — one figure for the whole application</label>
                <div className="flex gap-2">
                  <input disabled={locked} type="number" min="0" step="0.01" value={commissionInsuranceValue} onChange={(e) => setCommissionInsuranceValue(e.target.value)}
                    onBlur={() => saveKaFormField({ commissionInsuranceValue: Number(commissionInsuranceValue) || 0 })} className="input-field text-sm disabled:opacity-60 flex-1" />
                  <input disabled={locked} value={commissionInsuranceLabel} onChange={(e) => setCommissionInsuranceLabel(e.target.value)}
                    onBlur={() => saveKaFormField({ commissionInsuranceLabel })} placeholder="N/A" className="input-field text-sm disabled:opacity-60 w-24" title="Label shown on the printed form when the value is 0 (e.g. 'N/A')" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Field label="(1) Repatriated Total" value={money(costing?.totalRepatriatedFC)} />
              <Field label="(2)+(3) Deductions" value={money((costing?.totalFreightFC || 0) + (costing?.commissionInsuranceFC || 0))} />
              <Field label="(4) Net FOB Export Value" value={money(costing?.netFobFC)} />
              <Field label={`(5) Incentive Receivable (${application.exportCategory?.incentivePercentage || 0}%)`} value={money(costing?.incentiveReceivableFC)} />
            </div>
          </div>

          {/* R20: Shah International's own internal net-take-home layer on top of the government
              form's gross Payable Incentive Amount above — deliberately styled/labeled distinctly
              so it doesn't read as part of the official form itself (it isn't — confirmed against
              the reference PDF, which ends at the bank's own gross payable figure). */}
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-3">Incentive After Costing (internal — not part of the Ka Form itself)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Field label="Receivable Incentive (BDT)" value={`৳${money(costing?.payableIncentiveBDT)}`} />
              <Field label={`Tax (${application.exportCategory?.taxPercentage || 0}%)`} value={`৳${money(costing?.taxBDT)}`} />
              <Field label="Application Cost" value={`৳${money(costing?.incentiveApplicationCostBDT)}`} />
              <Field label="Others Cost" value={`৳${money(costing?.othersCostBDT)}`} />
              <Field label="After Costing" value={`৳${money(costing?.afterCostingBDT)}`} />
              <Field label={`Per Shipment (÷${application.shipments?.length || 1})`} value={`৳${money(costing?.perShipmentShareBDT)}`} />
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70 mt-3">
              Application Cost and Others Cost (from the Export Category's settings) count once for the whole application, not per shipment. The per-shipment share is saved automatically into each shipment's TT Configuration "Incentive" field and counted in Export Analytics.
            </p>
          </div>

          {/* R16: max 5 per row, wraps to a 2nd row (10 max ÷ 5 = 2 rows) */}
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Shipments in this application</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {(application.shipments || []).map((s) => <ShipmentMiniCard key={s._id} s={s} />)}
          </div>
        </div>
      )}

      {tab === 'kaform' && (
        <div>
          <KaFormPanel application={application} locked={locked} onSaved={load} />
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            <DocSection field="kaForm" label="Notes & Uploads" notes={kaFormNotes} onNotesChange={setKaFormNotes} onSaveNotes={saveNotes} savingNotes={savingNotes}
              files={application.kaForm?.files} onUpload={handleUpload} uploading={uploading} onRemove={removeFile} locked={locked} />
          </div>
        </div>
      )}
      {tab === 'others' && (
        <div>
          <StampApplicationPanel application={application} locked={locked} onSaved={load} />
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
            <DocSection field="others" label="Notes & Uploads" notes={othersNotes} onNotesChange={setOthersNotes} onSaveNotes={saveNotes} savingNotes={savingNotes}
              files={application.others?.files} onUpload={handleUpload} uploading={uploading} onRemove={removeFile} locked={locked} />
          </div>
        </div>
      )}
    </div>
  );
}
