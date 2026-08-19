'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Archive, Download, Package, ReceiptText, Globe, Paperclip, Trash2, Pencil } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import Pagination from '@/components/ui/Pagination';
import { format } from 'date-fns';
import { generateShipmentDocPDF, generateAllDocumentsPDF, docTypeLabel, isMergeableAttachment } from '@/lib/exportDocuments';
import toast from 'react-hot-toast';

// Issue 38: "only files ... in pdf format" — an uploaded Additional Document only belongs in the
// archive if it actually is a PDF (jpg/png attachments are excluded), checked by extension since
// that's what both the filename and the stored URL reliably carry.
function isPdf(doc) {
  const s = `${doc?.url || ''} ${doc?.name || ''}`.toLowerCase();
  return s.endsWith('.pdf') || s.includes('.pdf?') || s.includes('.pdf#');
}

// One completed shipment's file list: the 3 generatable documents (as real PDFs, on demand, via the
// same generator used for the shipment page's Download button) plus any uploaded attachment that is
// itself already a PDF.
function ShipmentFileGroup({ shipment, letterheadUrl, exporterInfo, docStyle }) {
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [mergingAll, setMergingAll] = useState(false);

  // Requirement 7: this shipment's own selected Export License's letterhead takes priority over
  // the global company one passed down from the page — different shipments on this same archive
  // page can have different licenses selected, so this has to be computed per-shipment rather than
  // once for the whole page.
  const effectiveLetterheadUrl = shipment.exportLicense?.letterheadUrl || letterheadUrl;

  const generatedDocs = [
    { key: 'packing', label: 'Packing List', Icon: Package, has: (shipment.items || []).some(i => i.productName) },
    // Batch 7: Buyer's Invoice is now a read-only mirror of the master `items` table (no longer its
    // own independently-filled `buyerItems`) — this availability check follows that.
    { key: 'buyer-invoice', label: "Buyer's Invoice", Icon: ReceiptText, has: (shipment.items || []).some(i => i.productName) },
    // Batch 19 (R33-1): Product HS Code mode mirrors `items` directly and never populates bdItems
    // at all (same reasoning as Buyer's Invoice above) — checking bdItems alone would incorrectly
    // hide BD Invoice from this list for a Product-mode shipment that actually has plenty of items.
    { key: 'bd-invoice', label: 'BD Invoice', Icon: Globe, has: shipment.bdHsCodeMode === 'product' ? (shipment.items || []).some(i => i.productName) : (shipment.bdItems || []).some(i => i.productName) },
  ].filter(d => d.has);

  const uploadedPdfs = (shipment.additionalDocs || []).filter(isPdf);
  // Issue 3: the merge (handleDownloadAll below) now also embeds JPG/PNG attachments, not just
  // PDFs — this broader count is only for the "N merged" badge and empty-state check just below;
  // the individual per-file list further down intentionally stays PDF-only (issue 38).
  const mergeableAttachments = (shipment.additionalDocs || []).filter(isMergeableAttachment);

  const handleDownloadGenerated = async (baseDocType) => {
    setDownloadingKey(baseDocType);
    try {
      const docType = `${baseDocType}-${docStyle}`;
      const pdf = await generateShipmentDocPDF({ docType, shipment, buyer: shipment.buyer, letterheadUrl: effectiveLetterheadUrl, exporterInfo });
      pdf.save(`${docTypeLabel(baseDocType).replace(/\s+/g, '-')}-${shipment.shipmentNo || shipment._id}.pdf`);
    } catch {
      toast.error('Could not generate this PDF');
    } finally {
      setDownloadingKey(null);
    }
  };

  // Issue 11: one merged PDF combining every generated document + uploaded PDF attachment for this
  // shipment, named "All Documents for (Shipment Name)".
  const handleDownloadAll = async () => {
    setMergingAll(true);
    try {
      const { blob, skipped } = await generateAllDocumentsPDF({ shipment, buyer: shipment.buyer, letterheadUrl: effectiveLetterheadUrl, docStyle, exporterInfo });
      if (!blob) { toast.error('No documents available to merge for this shipment'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All-Documents-for-${shipment.shipmentNo || shipment._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (skipped?.length) {
        toast.error(`Merged, but ${skipped.length} attachment(s) couldn't be included: ${skipped.join(', ')}. Try re-uploading them in the shipment's Other Details tab.`, { duration: 8000 });
      }
    } catch (e) {
      toast.error('Could not merge documents for this shipment');
    } finally {
      setMergingAll(false);
    }
  };

  if (generatedDocs.length === 0 && mergeableAttachments.length === 0) {
    return <div className="px-4 py-3 text-xs text-gray-400 italic">No documents for this shipment yet</div>;
  }

  return (
    <div className="divide-y divide-gray-50 dark:divide-gray-800">
      <div className="flex items-center justify-between px-4 py-2.5 gap-3 bg-brand/5">
        <div className="flex items-center gap-2 min-w-0">
          <Archive className="w-4 h-4 text-brand flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">All Documents for {shipment.shipmentNo || 'this shipment'}.pdf</span>
          <span className="text-xs text-gray-400 flex-shrink-0">({generatedDocs.length + mergeableAttachments.length} merged)</span>
        </div>
        <button onClick={handleDownloadAll} disabled={mergingAll}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60 flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Download className="w-3.5 h-3.5" /> {mergingAll ? 'Merging…' : 'Download All'}
        </button>
      </div>
      {generatedDocs.map(d => (
        <div key={d.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <d.Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.label}.pdf</span>
          </div>
          <button onClick={() => handleDownloadGenerated(d.key)} disabled={downloadingKey === d.key}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand hover:bg-green-50 dark:hover:bg-green-900/20 transition-all disabled:opacity-60 flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> {downloadingKey === d.key ? 'Preparing…' : 'Download'}
          </button>
        </div>
      ))}
      {uploadedPdfs.map((doc, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.name || 'Document.pdf'}</span>
          </div>
          <a href={doc.url} target="_blank" rel="noopener noreferrer" download
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand hover:bg-green-50 dark:hover:bg-green-900/20 transition-all flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      ))}
    </div>
  );
}

export default function ExportArchivePage() {
  const router = useRouter();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [exporterInfo, setExporterInfo] = useState({ exporterName: 'Shah International', exporterAddress: '' });
  const [docStyle, setDocStyle] = useState('letterhead');

  useEffect(() => {
    fetch('/api/export/countries').then(r => r.json()).then(d => setCountries(d.countries || []));
    // Same global company letterhead/exporter identity used everywhere else (issue 39, R1) — so a
    // PDF generated from the archive looks identical to one generated from the shipment page itself.
    fetch('/api/settings').then(r => r.json()).then(d => {
      setLetterheadUrl(d?.settings?.exportLetterheadUrl || '');
      setExporterInfo({ exporterName: d?.settings?.exporterName || 'Shah International', exporterAddress: d?.settings?.exporterAddress || '' });
    }).catch(() => {});
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    const q = new URLSearchParams({ page, limit: 20, status: 'completed' }); // archive = completed shipments only, always (issue 38)
    if (search) q.set('search', search);
    if (country) q.set('country', country);
    const r = await fetch(`/api/export/shipments?${q}`);
    const d = await r.json();
    setShipments(d.shipments || []);
    setPages(d.pages || 1);
    setTotal(d.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchShipments(); }, [page, search, country]);

  // Issue 8: the shipment DELETE route (app/api/export/shipments/[id]/route.js) already snapshots to
  // the recycle bin and writes an audit log entry before removing the document — that route already
  // existed and already does exactly what's needed here (see its own comments); the Archive page
  // itself just never exposed a way to call it. It also already enforces its own guards server-side
  // (a claimed/locked shipment, or one still tied to a pending Incentive Application, is refused with
  // an explanatory message) — surfaced below via the toast on failure, nothing duplicated client-side.
  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (s) => {
    if (!confirm(`Delete shipment ${s.shipmentNo}? It will be moved to the recycle bin and can be restored later. This does not permanently erase it.`)) return;
    setDeletingId(s._id);
    try {
      const r = await fetch(`/api/export/shipments/${s._id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) {
        toast.success('Shipment deleted — restorable from the recycle bin');
        setShipments((prev) => prev.filter((x) => x._id !== s._id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        toast.error(d.message || 'Could not delete this shipment');
      }
    } catch {
      toast.error('Could not delete this shipment');
    } finally {
      setDeletingId(null);
    }
  };

  // Same dedicated shipmentNoOnly branch as the contract-scoped shipment list (see that page's own
  // comment, and app/api/export/shipments/[id]/route.js) — the route's general save path is a
  // full-document REPLACE, so a rename needs its own $set-only branch rather than resending an
  // entire shipment. That branch sits behind the SAME server-side lock check every other write to
  // a shipment already goes through here (see handleDelete's own comment just above) — a claimed/
  // locked shipment is refused with an explanatory message via the toast below, nothing duplicated
  // client-side.
  const handleRename = async (s) => {
    const next = window.prompt('Rename shipment', s.shipmentNo);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === s.shipmentNo) return;
    const r = await fetch(`/api/export/shipments/${s._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentNoOnly: trimmed }),
    });
    const d = await r.json();
    if (d.success) {
      toast.success('Shipment renamed');
      setShipments((prev) => prev.map((x) => (x._id === s._id ? { ...x, shipmentNo: trimmed } : x)));
    } else {
      toast.error(d.message || 'Could not rename this shipment');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => router.push('/admin/export-dashboard')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Archive className="w-6 h-6 text-brand" /> Export Archives
          </h1>
          <p className="text-sm text-gray-500">{total} completed shipment{total === 1 ? '' : 's'} · PDF documents only, all in one place for review</p>
        </div>
        <Link href="/admin/export-dashboard/audit-log" className="text-xs font-semibold text-gray-500 hover:text-brand hover:underline flex-shrink-0">
          Deleted a shipment by mistake? Restore it →
        </Link>
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium flex-shrink-0" title="Style used when generating a document from this page">
          <button type="button" onClick={() => setDocStyle('letterhead')}
            className={`px-2.5 py-1.5 transition-colors ${docStyle === 'letterhead' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={docStyle === 'letterhead' ? { backgroundColor: 'var(--color-primary)' } : {}}>
            Letterhead
          </button>
          <button type="button" onClick={() => setDocStyle('plain')}
            className={`px-2.5 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${docStyle === 'plain' ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={docStyle === 'plain' ? { backgroundColor: 'var(--color-primary)' } : {}}>
            Plain A4
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search shipment no, invoice no..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-9 py-2 text-sm" />
        </div>
        <select value={country} onChange={e => { setCountry(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-auto">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c._id} value={c._id}>{c.flag || '🌍'} {c.name}</option>)}
        </select>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 text-xs font-medium text-green-700">
          ✅ Completed shipments only
        </div>
      </div>

      {loading ? <Loader /> : (
        <>
          <div className="space-y-4">
            {shipments.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 py-16 text-center text-gray-400">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No completed shipments found</p>
              </div>
            ) : shipments.map(s => (
              <div key={s._id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{s.shipmentNo}</p>
                      <button onClick={() => handleRename(s)} title="Rename shipment" className="p-1 rounded-lg text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{s.buyer?.name || '—'} · {s.country?.flag || '🌍'} {s.country?.name || '—'} · {s.date ? format(new Date(s.date), 'dd MMM yyyy') : '—'}</p>
                    {/* R13: shipments completed via a claimed Incentive Application land here
                        automatically — link straight back to it for context. */}
                    {s.incentiveApplication?.status === 'claimed' && (
                      <Link href={`/admin/export-dashboard/incentives/${s.incentiveApplication._id}`} className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-600 hover:underline">
                        🔒 Claimed via {s.incentiveApplication.title}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link href={`/admin/export-dashboard/countries/${s.country?._id}/buyers/${s.buyer?._id}/shipments/${s._id}`}
                      className="text-xs font-semibold text-brand hover:underline">
                      Open shipment →
                    </Link>
                    <button onClick={() => handleDelete(s)} disabled={deletingId === s._id}
                      title="Delete shipment (recoverable from the recycle bin)"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <ShipmentFileGroup shipment={s} letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} docStyle={docStyle} />
              </div>
            ))}
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
