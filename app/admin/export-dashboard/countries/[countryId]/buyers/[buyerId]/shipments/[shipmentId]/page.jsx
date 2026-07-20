'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Printer, FileText, Upload, Save, Package, ReceiptText, Globe, MoreHorizontal, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import ProductNameCombobox from '@/components/admin/ProductNameCombobox';
import { generateShipmentDocPDF, docTypeLabel } from '@/lib/exportDocuments';
import { calculateShipmentFinancials } from '@/lib/utils';
import toast from 'react-hot-toast';

// Print vs Download are now genuinely separate actions (issue 35): Print opens the isolated print
// route and triggers the browser's print dialog; Download generates a real PDF file client-side and
// saves it directly — no dialog, and (since it's built from data, not a DOM screenshot) never any
// website UI. Both share one Letterhead/Plain A4 style toggle so admins don't have to pick twice.
function DocActionBar({ baseDocType, docStyle, setDocStyle, onPrint, onDownload, downloadingDoc }) {
  const isDownloading = downloadingDoc === baseDocType;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
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
      <button onClick={() => onPrint(baseDocType)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
      <button onClick={() => onDownload(baseDocType)} disabled={isDownloading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60">
        <FileText className="w-3.5 h-3.5" /> {isDownloading ? 'Preparing…' : 'Download'}
      </button>
    </div>
  );
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'BDT', 'SAR', 'SGD', 'JPY'];

// ─── Currency rate hook ─────────────────────────────────────────────────────
function useLiveRate(baseCurrency) {
  const [rate, setRate] = useState(null); // rate = how many baseCurrency units = 1 USD
  const [bdtRate, setBdtRate] = useState(null); // live BDT-per-USD, so BDT cross-rates are never hardcoded
  const [loading, setLoading] = useState(false);
  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/currency');
      const d = await r.json();
      const rates = d.rates || {};
      // rates.USD = 1, rates.BDT = ~110, rates.EUR = ~0.92 per USD
      const usdBase = rates[baseCurrency] || 1;
      setRate(usdBase);
      setBdtRate(rates.BDT || null);
    } catch {}
    setLoading(false);
  }, [baseCurrency]);
  useEffect(() => { fetch_(); }, [fetch_]);
  // bdtPerUnit = how many BDT equal 1 unit of baseCurrency, e.g. bdtPerUnit(EUR) = rates.BDT / rates.EUR.
  // This replaces any hardcoded "110" — it's a real cross rate derived from the same live fetch.
  const bdtPerUnit = (bdtRate && rate) ? bdtRate / rate : null;
  return { rate, bdtRate, bdtPerUnit, loading, refresh: fetch_ };
}

// ─── Product autocomplete ────────────────────────────────────────────────────
function ProductSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    fetch(`/api/products?search=${encodeURIComponent(query)}&limit=8`).then(r => r.json()).then(d => {
      setResults(d.products || []);
      setOpen(true);
    });
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length && setOpen(true)}
        placeholder="Type to search products from catalog..." className="input-field py-2 text-sm w-full" />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-30 max-h-48 overflow-y-auto">
          {results.map(p => (
            <button key={p._id} onClick={() => { onSelect(p); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
              {p.scientificName && <p className="text-xs text-gray-400 italic">{p.scientificName}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Items table with auto-calc and product search ──────────────────────────
function ItemsTable({ items, onChange, currency = 'EUR', showPrice = true, showPackSize = true }) {
  // Sets one or more fields on row `i` in a single state update (needed so selecting a catalog product
  // can set productName AND botanicalName atomically — calling the old single-field `update()` twice in
  // a row would have the second call overwrite the first, since both would compute their "next" array
  // from the same stale `items` prop before React re-renders in between).
  const updateFields = (i, fields) => {
    const next = [...items];
    next[i] = { ...next[i], ...fields };
    // Auto SL number
    next[i].slNo = i + 1;
    // Auto-calc: packSizeKg × totalCTN → quantityKg (total net weight per line)
    if ('packSizeKg' in fields || 'totalCTN' in fields) {
      const ps = Number(next[i].packSizeKg) || 0;
      const ctn = Number(next[i].totalCTN) || 0;
      next[i].quantityKg = ps && ctn ? +(ps * ctn).toFixed(2) : next[i].quantityKg;
    }
    // Auto-calc: unitPrice × quantityKg → totalValue
    if (showPrice && ('unitPrice' in fields || 'quantityKg' in fields || 'packSizeKg' in fields || 'totalCTN' in fields)) {
      const qty = Number(next[i].quantityKg) || 0;
      const price = Number(next[i].unitPrice) || 0;
      if (qty && price) next[i].totalValue = +(qty * price).toFixed(2);
    }
    onChange(next);
  };
  const update = (i, k, v) => updateFields(i, { [k]: v });
  // Row-level "choose from catalog" (issue 37): selecting a product sets both fields at once and
  // auto-fills the botanical name exactly as it was entered when the product was first listed.
  const selectProductForRow = (i, product) => updateFields(i, { productName: product.name, botanicalName: product.scientificName || '' });

  const addRow = () => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: '', botanicalName: '', packSizeKg: '', totalCTN: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  };
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));
  const addFromProduct = (product) => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: product.name, botanicalName: product.scientificName || '', packSizeKg: '', totalCTN: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  };

  const grandCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const grandKg = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const grandVal = items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);

  return (
    <div>
      <div className="mb-2">
        <ProductSearch onSelect={addFromProduct} />
        <p className="text-xs text-gray-400 mt-1">Select a product above to add a new row, or type/select directly in any row's "Product Name" field — botanical name auto-fills either way</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-2 py-2 text-center w-8">SL</th>
              <th className="px-2 py-2 text-left">Product Name</th>
              <th className="px-2 py-2 text-left">Botanical Name</th>
              {/* Pack (kg) was clipping its own numbers: "w-20" was fine, but the CTN/Qty/Unit/Total
                  columns next to it used w-18/w-22/w-26, which are NOT real Tailwind widths (the default
                  scale has no 18/22/26 step) — those classes silently did nothing, so the browser
                  auto-shrank every numeric column, including this one, to fit its header text. Now using
                  real scale values and giving Pack(kg) extra room (w-24) since it's the one users report
                  as too small. */}
              {showPackSize && <th className="px-2 py-2 text-right w-24 whitespace-nowrap">Pack (kg)</th>}
              <th className="px-2 py-2 text-right w-16 whitespace-nowrap">CTN</th>
              <th className="px-2 py-2 text-right w-24 whitespace-nowrap">Qty (kg)</th>
              {showPrice && <th className="px-2 py-2 text-right w-24 whitespace-nowrap">Unit ({currency})</th>}
              {showPrice && <th className="px-2 py-2 text-right w-28 whitespace-nowrap">Total ({currency})</th>}
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <ProductNameCombobox
                    value={item.productName || ''}
                    onChange={v => update(i, 'productName', v)}
                    onSelect={p => selectProductForRow(i, p)}
                    placeholder="Product name"
                    className="input-field py-1 text-xs w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input value={item.botanicalName || ''} onChange={e => update(i, 'botanicalName', e.target.value)} className="input-field py-1 text-xs w-full" placeholder="Botanical name" />
                </td>
                {showPackSize && <td className="px-2 py-1.5">
                  <input type="number" value={item.packSizeKg || ''} onChange={e => update(i, 'packSizeKg', e.target.value)} className="input-field py-1 text-xs w-full min-w-[64px] text-right" />
                </td>}
                <td className="px-2 py-1.5">
                  <input type="number" value={item.totalCTN || ''} onChange={e => update(i, 'totalCTN', e.target.value)} className="input-field py-1 text-xs w-full text-right" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={item.quantityKg || ''} onChange={e => update(i, 'quantityKg', e.target.value)} className="input-field py-1 text-xs w-full text-right" />
                </td>
                {showPrice && <td className="px-2 py-1.5">
                  <input type="number" value={item.unitPrice || ''} onChange={e => update(i, 'unitPrice', e.target.value)} className="input-field py-1 text-xs w-full text-right" />
                </td>}
                {showPrice && <td className="px-2 py-1.5">
                  <input type="number" value={item.totalValue || ''} onChange={e => update(i, 'totalValue', e.target.value)} className="input-field py-1 text-xs w-full text-right font-semibold" />
                </td>}
                <td className="px-1 py-1.5">
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white text-xs font-bold">
              <td colSpan={showPackSize ? 4 : 3} className="px-2 py-2 text-right">Grand Total:</td>
              <td className="px-2 py-2 text-right">{grandCTN}</td>
              <td className="px-2 py-2 text-right">{grandKg.toFixed(1)}</td>
              {showPrice && <td></td>}
              {showPrice && <td className="px-2 py-2 text-right text-green-400">{grandVal.toFixed(2)}</td>}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addRow} className="mt-2 flex items-center gap-1.5 text-xs text-brand hover:text-green-700 font-medium transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Blank Row
      </button>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
const EMPTY = () => Array.from({ length: 3 }, (_, i) => ({ slNo: i + 1, productName: '', botanicalName: '', packSizeKg: '', totalCTN: '', quantityKg: '', unitPrice: '', totalValue: '' }));

export default function ShipmentDetailPage() {
  const { countryId, buyerId, shipmentId } = useParams();
  const router = useRouter();
  const isNew = shipmentId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('packing');
  const [buyer, setBuyer] = useState(null);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState(0);
  const [uploadingLH, setUploadingLH] = useState(false);
  const [docStyle, setDocStyle] = useState('letterhead'); // 'letterhead' | 'plain' — shared by Print & Download, all 3 doc types
  const [downloadingDoc, setDownloadingDoc] = useState(null); // which baseDocType is currently generating a PDF, or null

  const [form, setFormState] = useState({
    shipmentNo: `SI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    contractNo: '', invoiceNo: '', dateStr: new Date().toISOString().slice(0, 10),
    baseCurrency: 'EUR',
    modeOfCarrying: 'By Air',
    landingPort: 'Hazrat Shahjalal International Airport',
    portOfDischarge: '', finalDestination: '', salesTerm: 'CFR',
    countryOfOrigin: 'Bangladesh',
    tinNo: '518591244958', binNo: '71367570202', ercNo: '260326210852625',
    expNo: '', awbNo: '', pcNo: '',
    beneficiaryBank: 'Sonali Bank', accountNo: '1608902003846',
    branchName: 'Foreign Exchange Corporate Branch',
    routingNo: '200272320', swiftCode: 'BSONBDDHFEB',
    // THREE independent item sets:
    items: EMPTY(),       // Packing list
    buyerItems: EMPTY(),  // Buyer invoice
    bdItems: EMPTY(),     // BD invoice
    totalNetWeightKg: '', totalGrossWeightKg: '',
    invoiceCurrency: 'EUR',
    freightCost: '', goodsCost: '', exportProcessingCost: '', othersCost: '',
    totalCost: '', receiveAmountBDT: '', orderValueForeign: '',
    orderCurrency: 'EUR', exchangeRateBDT: '',
    availableBalance: '', incentive: '', damage: '', netProfit: '',
    notes: '', status: 'active', additionalDocs: [], photos: [],
  });
  const set = (k, v) => setFormState(p => ({ ...p, [k]: v }));

  const { rate, bdtPerUnit, loading: rateLoading, refresh: refreshRate } = useLiveRate(form.baseCurrency);

  useEffect(() => {
    fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()).then(d => setBuyer(d.buyer));
    // Company letterhead is a GLOBAL setting now (issue 39) — uploaded once, used for every shipment
    // until replaced, rather than re-uploaded per shipment. Always load the current one on mount.
    // Also grab the persisted Export Analytics Initial Balance (issue 46) so this editor's live
    // Available Balance / Shipment Margin / Net Profit preview matches what the server will compute.
    fetch('/api/settings').then(r => r.json()).then(d => {
      setLetterheadUrl(d?.settings?.exportLetterheadUrl || '');
      setInitialBalance(d?.settings?.exportAnalyticsInitialBalance || 0);
    }).catch(() => {});
    if (!isNew) {
      setLoading(true);
      fetch(`/api/export/shipments/${shipmentId}`).then(r => r.json()).then(d => {
        if (d.shipment) {
          const s = d.shipment;
          setFormState(p => ({
            ...p, ...s,
            dateStr: s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
            items: s.items?.length ? s.items : EMPTY(),
            buyerItems: s.buyerItems?.length ? s.buyerItems : EMPTY(),
            bdItems: s.bdItems?.length ? s.bdItems : EMPTY(),
            photos: s.photos || [],
          }));
        }
        setLoading(false);
      });
    }
  }, [shipmentId, buyerId, isNew]);

  const handleSave = async () => {
    setSaving(true);
    // Auto-fill totals from packing list items
    const totalCTN = form.items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
    const totalNetWeightKg = form.items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
    const payload = {
      ...form,
      buyer: buyerId, country: countryId,
      date: form.dateStr ? new Date(form.dateStr) : new Date(),
      // Issue 43: Net Weight and Total Carton are auto-completed from the packing-list items — the
      // freshly-computed total always wins over whatever (now-unused) manual value might be sitting
      // in form state from an older save, rather than the old "prefer manual" priority.
      totalCTN,
      totalNetWeightKg,
    };
    const url = isNew ? '/api/export/shipments' : `/api/export/shipments/${shipmentId}`;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    setSaving(false);
    if (d.success) {
      toast.success('Shipment saved!');
      if (isNew) router.push(`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/shipments/${d.shipment._id}`);
    } else toast.error(d.message);
  };

  const handleLetterheadUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingLH(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: reader.result, folder: 'letterheads' }) });
      const data = await res.json();
      if (data.success) {
        // Save GLOBALLY — this is the one company letterhead, reused for every shipment until
        // replaced again, not something re-uploaded per shipment (issue 39).
        const settingsRes = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exportLetterheadUrl: data.url, exportLetterheadUpdatedAt: new Date() }) });
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          setLetterheadUrl(data.url);
          toast.success('Company letterhead updated — now used on every shipment');
        } else {
          toast.error('Uploaded, but failed to save as the company letterhead');
        }
      } else toast.error('Upload failed');
      setUploadingLH(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = (baseDocType) => {
    if (isNew) { toast.error('Save the shipment first'); return; }
    const docType = `${baseDocType}-${docStyle}`;
    const qs = new URLSearchParams({ doc: docType, currency: form.baseCurrency });
    window.open(`/print/export/${shipmentId}?${qs}`, '_blank', 'width=900,height=700,scrollbars=yes');
  };

  // Genuinely separate from Print: builds a real PDF client-side via jsPDF and saves it directly —
  // no print dialog, no popup window, and (since it's built from data rather than a screenshot of the
  // page) no possibility of website UI ending up in the file.
  const handleDownload = async (baseDocType) => {
    if (isNew) { toast.error('Save the shipment first'); return; }
    setDownloadingDoc(baseDocType);
    try {
      const r = await fetch(`/api/export/shipments/${shipmentId}`);
      const d = await r.json();
      if (!d.shipment) { toast.error('Could not load the saved shipment'); return; }
      const docType = `${baseDocType}-${docStyle}`;
      const pdf = await generateShipmentDocPDF({ docType, shipment: d.shipment, buyer: d.shipment.buyer, letterheadUrl });
      pdf.save(`${docTypeLabel(baseDocType).replace(/\s+/g, '-')}-${d.shipment.shipmentNo || shipmentId}.pdf`);
    } catch {
      toast.error('Could not generate the PDF — try Print instead');
    } finally {
      setDownloadingDoc(null);
    }
  };

  if (loading) return <div className="py-20"><Loader /></div>;

  const tabs = [
    { id: 'packing', label: '📦 Packing List', icon: Package },
    { id: 'buyer-invoice', label: "🧾 Buyer's Invoice", icon: ReceiptText },
    { id: 'bd-invoice', label: '🇧🇩 BD Invoice', icon: Globe },
    { id: 'other', label: '📎 Other Details', icon: MoreHorizontal },
  ];

  const usdEquiv = rate ? (1 / rate).toFixed(4) : '...';

  // Issue 43: Net Weight and Total Carton are auto-completed from the Packing List items — they must
  // NOT be free-typed by the admin, since they're supposed to always match what's actually in the
  // table below. Gross Weight and Freight Cost remain admin-entered (nothing else can derive them).
  const liveTotalCTN = form.items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const liveTotalNetWeightKg = form.items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);

  // Issue 46: live financial preview, computed with the SAME shared function the backend uses, so
  // what the admin sees while typing always matches what will actually be persisted on save.
  const liveFinancials = calculateShipmentFinancials({
    initialBalance,
    freightCost: form.freightCost, goodsCost: form.goodsCost, exportProcessingCost: form.exportProcessingCost,
    othersCost: form.othersCost, damage: form.damage, orderValueForeign: form.orderValueForeign,
    exchangeRateBDT: form.exchangeRateBDT || bdtPerUnit || 0, incentive: form.incentive,
  });

  const addPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: reader.result, folder: 'shipment-photos' }) });
      const data = await res.json();
      if (data.success) set('photos', [...(form.photos || []), { url: data.url, caption: '' }]);
      else toast.error('Photo upload failed');
    };
    reader.readAsDataURL(file);
  };
  const updatePhotoCaption = (i, caption) => {
    const next = [...(form.photos || [])];
    next[i] = { ...next[i], caption };
    set('photos', next);
  };
  const removePhoto = (i) => set('photos', (form.photos || []).filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => router.push(`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}`)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? 'New Shipment' : form.shipmentNo}</h1>
          <p className="text-sm text-gray-500">{buyer?.name}</p>
        </div>
        <Button onClick={handleSave} loading={saving} variant="primary" icon={Save}>Save</Button>
      </div>

      {/* Base currency + live rate banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Base Currency (set once — applies to entire shipment)</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Live rate: 1 USD = <span className="font-bold">{rate ? rate.toFixed(4) : '...'} {form.baseCurrency}</span>
            {form.baseCurrency !== 'BDT' && bdtPerUnit ? ` · BDT rate used in analytics: ৳${bdtPerUnit.toFixed(2)} ≈ 1 ${form.baseCurrency} (live)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} className="input-field py-2 text-sm font-bold w-auto">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={refreshRate} disabled={rateLoading} className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all" title="Refresh live rate">
            <RefreshCw className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Letterhead upload — a GLOBAL company setting (issue 39): upload once here, it's reused on
          every shipment's printed/downloaded documents until it's replaced again. Also manageable
          from the main Export Dashboard page without opening any specific shipment. */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Company Letterhead (used on ALL shipments)</p>
          <p className="text-xs text-amber-600 mt-0.5">Upload once (PNG/JPG) — it becomes the header on every printed/downloaded document, for every shipment, until you replace it again here</p>
          {letterheadUrl && <p className="text-xs text-green-600 mt-1">✓ Currently set</p>}
        </div>
        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-amber-300 rounded-xl cursor-pointer text-sm font-medium text-amber-700 hover:bg-amber-50 transition-all">
          <Upload className="w-4 h-4" /> {uploadingLH ? 'Uploading...' : letterheadUrl ? 'Replace Company Letterhead' : 'Upload Company Letterhead'}
          <input type="file" accept="image/*" onChange={handleLetterheadUpload} className="hidden" disabled={uploadingLH} />
        </label>
      </div>

      {/* Shipment identifiers */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Shipment Identifiers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Shipment No" value={form.shipmentNo} onChange={e => set('shipmentNo', e.target.value)} />
          <Input label="Contract No" value={form.contractNo} onChange={e => set('contractNo', e.target.value)} />
          <Input label="Invoice No" value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Shipment Date</label>
            <input type="date" value={form.dateStr} onChange={e => set('dateStr', e.target.value)} className="input-field py-2 text-sm" />
          </div>
          <Input label="TIN" value={form.tinNo} onChange={e => set('tinNo', e.target.value)} />
          <Input label="BIN" value={form.binNo} onChange={e => set('binNo', e.target.value)} />
          <Input label="ERC" value={form.ercNo} onChange={e => set('ercNo', e.target.value)} />
          <Input label="EXP No" value={form.expNo} onChange={e => set('expNo', e.target.value)} />
          <Input label="AWB No" value={form.awbNo} onChange={e => set('awbNo', e.target.value)} />
          <Input label="PC No" value={form.pcNo} onChange={e => set('pcNo', e.target.value)} />
        </div>
      </div>

      {/* Document tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-100 dark:border-gray-800 pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            style={tab === t.id ? { backgroundColor: 'var(--color-primary)' } : {}}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">

        {/* ── Packing List ── */}
        {tab === 'packing' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Packing List</h3>
              <div className="flex gap-2">
                <DocActionBar baseDocType="packing" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Input label="Mode of Carrying" value={form.modeOfCarrying} onChange={e => set('modeOfCarrying', e.target.value)} />
              <Input label="Landing Port" value={form.landingPort} onChange={e => set('landingPort', e.target.value)} />
              <Input label="Port of Discharge" value={form.portOfDischarge} onChange={e => set('portOfDischarge', e.target.value)} />
              <Input label="Final Destination" value={form.finalDestination} onChange={e => set('finalDestination', e.target.value)} />
              <Input label="Sales Term" value={form.salesTerm} onChange={e => set('salesTerm', e.target.value)} placeholder="CFR, France" />
              <Input label="Country of Origin" value={form.countryOfOrigin} onChange={e => set('countryOfOrigin', e.target.value)} />
              <Input label="Net Weight (kg) — auto" type="number" value={liveTotalNetWeightKg.toFixed(2)} disabled readOnly hint="Auto-filled: sum of Qty (kg) from the items table below" className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
              <Input label="Total Carton — auto" type="number" value={liveTotalCTN} disabled readOnly hint="Auto-filled: sum of CTN from the items table below" className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
              <Input label="Gross Weight (kg)" type="number" min="0" value={form.totalGrossWeightKg} onChange={e => set('totalGrossWeightKg', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Freight Cost (BDT)" type="number" min="0" value={form.freightCost} onChange={e => set('freightCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} hint="Same field used in Other Details / Financial Analysis" />
            </div>

            {/* Photos section — admin can add product/shipment photos and edit each caption (issue 43) */}
            <div className="mb-5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Photos</p>
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 cursor-pointer text-xs text-gray-500 hover:border-brand hover:text-brand transition-all">
                  <Upload className="w-3.5 h-3.5" /> Add Photo
                  <input type="file" accept="image/*" className="hidden" onChange={addPhoto} />
                </label>
              </div>
              {(form.photos || []).length === 0 ? (
                <p className="text-xs text-gray-400">No photos added yet. Photos and their captions can be edited any time and are fully admin-controlled.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {form.photos.map((p, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="relative w-full aspect-square bg-gray-100">
                        <img src={p.url} alt={p.caption || `Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <input value={p.caption || ''} onChange={e => updatePhotoCaption(i, e.target.value)} placeholder="Caption / description..." className="w-full text-xs px-2 py-1.5 border-t border-gray-100 dark:border-gray-700 bg-transparent focus:outline-none" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <ItemsTable items={form.items} onChange={v => set('items', v)} currency={form.baseCurrency} showPrice={false} showPackSize={true} />
          </div>
        )}

        {/* ── Buyer's Invoice — INDEPENDENT from BD Invoice ── */}
        {tab === 'buyer-invoice' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Buyer's Commercial Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">Independent from BD Invoice — changes here do not affect BD Invoice</p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="buyer-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 text-sm">
              <span className="text-blue-700 dark:text-blue-300 font-semibold">Currency: {form.baseCurrency}</span>
              <span className="text-blue-500">1 USD = {rate ? rate.toFixed(4) : '...'} {form.baseCurrency}</span>
            </div>
            <ItemsTable items={form.buyerItems} onChange={v => set('buyerItems', v)} currency={form.baseCurrency} showPrice={true} showPackSize={true} />
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-semibold text-green-700">
              Total Invoice Value: {form.buyerItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0).toFixed(2)} {form.baseCurrency}
              <span className="ml-3 text-xs text-gray-500 font-normal">
                ≈ USD {rate ? (form.buyerItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0) / rate).toFixed(2) : '...'}
              </span>
            </div>
          </div>
        )}

        {/* ── BD Invoice — INDEPENDENT from Buyer Invoice ── */}
        {tab === 'bd-invoice' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Bangladeshi Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">Independent from Buyer Invoice — changes here do not affect Buyer Invoice</p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="bd-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <Input label="Beneficiary Bank" value={form.beneficiaryBank} onChange={e => set('beneficiaryBank', e.target.value)} />
              <Input label="Account No" value={form.accountNo} onChange={e => set('accountNo', e.target.value)} />
              <Input label="Branch" value={form.branchName} onChange={e => set('branchName', e.target.value)} />
              <Input label="Routing No" value={form.routingNo} onChange={e => set('routingNo', e.target.value)} />
              <Input label="SWIFT Code" value={form.swiftCode} onChange={e => set('swiftCode', e.target.value)} />
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 text-sm">
              <span className="text-green-700 dark:text-green-300 font-semibold">Currency: {form.baseCurrency}</span>
              <span className="text-green-500">1 USD = {rate ? rate.toFixed(4) : '...'} {form.baseCurrency}</span>
            </div>
            <ItemsTable items={form.bdItems} onChange={v => set('bdItems', v)} currency={form.baseCurrency} showPrice={true} showPackSize={true} />
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-semibold text-green-700">
              Total BD Invoice Value: {form.bdItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0).toFixed(2)} {form.baseCurrency}
              <span className="ml-3 text-xs text-gray-500 font-normal">
                ≈ USD {rate ? (form.bdItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0) / rate).toFixed(2) : '...'}
              </span>
            </div>
          </div>
        )}

        {/* ── Other Details ── */}
        {tab === 'other' && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-900 dark:text-white">Financial Details & Profit Analysis</h3>
            <p className="text-xs text-gray-500 -mt-3">Enter the raw costs and order value below — Total Cost, Receive Amount, Available Balance, Shipment Margin, and Net Profit are all calculated automatically (issue 46) using the persisted Initial Balance ({initialBalance.toFixed(2)} BDT, set from the Export Analytics dashboard).</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="Freight Cost (BDT)" type="number" min="0" value={form.freightCost} onChange={e => set('freightCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Goods Cost (BDT)" type="number" min="0" value={form.goodsCost} onChange={e => set('goodsCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Export Processing Cost (BDT)" type="number" min="0" value={form.exportProcessingCost} onChange={e => set('exportProcessingCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Others / Logistics / Labour (BDT)" type="number" min="0" value={form.othersCost} onChange={e => set('othersCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Damage (BDT)" type="number" min="0" value={form.damage} onChange={e => set('damage', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label={`Order Value (${form.baseCurrency})`} type="number" min="0" value={form.orderValueForeign} onChange={e => set('orderValueForeign', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Rate in BDT (live)" type="number" min="0" value={form.exchangeRateBDT || (bdtPerUnit ? bdtPerUnit.toFixed(2) : '')} onChange={e => set('exchangeRateBDT', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Incentive (BDT)" type="number" min="0" value={form.incentive} onChange={e => set('incentive', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Cost (BDT) — auto</p>
                <p className="font-bold text-gray-900 dark:text-white">{liveFinancials.totalCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Receive Amount (BDT) — auto</p>
                <p className="font-bold text-gray-900 dark:text-white">{liveFinancials.receiveAmountBDT.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Available Balance (BDT) — auto</p>
                <p className="font-bold text-blue-600">{liveFinancials.availableBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Shipment Margin (BDT) — auto</p>
                {/* Issue 46: neon green when positive, light red when negative, default text color at exactly zero */}
                <p className={`font-bold ${liveFinancials.shipmentMargin > 0 ? 'text-[#39ff14]' : liveFinancials.shipmentMargin < 0 ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {liveFinancials.shipmentMargin.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Net Profit (BDT) — auto</p>
                <p className="font-bold text-emerald-600">{liveFinancials.netProfit.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field text-sm">
                  {['draft', 'active', 'completed', 'archived'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none" />
            </div>
            {/* Additional document uploads */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Additional Documents</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer text-sm text-gray-500 hover:border-brand hover:text-brand transition-all w-fit">
                <Upload className="w-4 h-4" /> Upload Document (PDF/Image)
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: reader.result, folder: 'shipment-docs' }) });
                    const data = await res.json();
                    if (data.success) { set('additionalDocs', [...(form.additionalDocs || []), { name: file.name, url: data.url }]); toast.success('Uploaded'); }
                    else toast.error('Upload failed');
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
              {(form.additionalDocs || []).map((doc, i) => (
                <div key={i} className="flex items-center gap-3 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline flex-1 truncate">{doc.name}</a>
                  <button onClick={() => set('additionalDocs', form.additionalDocs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} loading={saving} variant="primary" icon={Save} size="lg">Save Shipment</Button>
      </div>
    </div>
  );
}
