'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Printer, FileText, Upload, Save, Package, ReceiptText, Globe, MoreHorizontal, RefreshCw, Lock, Landmark, Tag, Edit3, RotateCcw, FileSignature } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Loader from '@/components/ui/Loader';
import ProductNameCombobox from '@/components/admin/ProductNameCombobox';
import { generateShipmentDocPDF, generateShipmentDocDOCX, generateShipmentDocXLSX, docTypeLabel, DEFAULT_DOCUMENT_TEXT } from '@/lib/exportDocuments';
import { calculateShipmentFinancials } from '@/lib/utils';
import { resolveEffectiveRateBDT, isRateOverrideActive } from '@/lib/incentiveUtils';
import { AVAILABLE_COLUMNS, COLUMN_LABELS, DOC_LABELS, columnHeaderLabel, getDocumentColumns, computeCategoryBreakdown, avgPrice, shipmentAveragePrice } from '@/lib/exportColumns';
import toast from 'react-hot-toast';
import { resizeImageFile } from '@/lib/clientImageResize';

// Print vs Download are now genuinely separate actions (issue 35): Print opens the isolated print
// route and triggers the browser's print dialog; Download generates a real PDF file client-side and
// saves it directly — no dialog, and (since it's built from data, not a DOM screenshot) never any
// website UI. Both share one Letterhead/Plain A4 style toggle so admins don't have to pick twice.
function DocActionBar({ baseDocType, docStyle, setDocStyle, onPrint, onDownload, onEditText, downloadingDoc, downloadFormat, setDownloadFormat, locked }) {
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
      {/* R5: PDF/DOCX/XLSX — one shared format choice across all 3 document bars, same pattern as
          the Letterhead/Plain A4 toggle above. */}
      <select value={downloadFormat} onChange={e => setDownloadFormat(e.target.value)} className="input-field py-1.5 text-xs w-auto" title="Download format">
        <option value="pdf">PDF</option>
        <option value="docx">DOCX</option>
        <option value="xlsx">XLSX</option>
      </select>
      <button onClick={() => onDownload(baseDocType)} disabled={isDownloading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60">
        <FileText className="w-3.5 h-3.5" /> {isDownloading ? 'Preparing…' : 'Download'}
      </button>
      {/* R5: lets the admin edit the hardcoded declaration/signatory text for this specific
          document before generating it. Hidden once locked (R13) — a claimed shipment is
          unavailable for any kind of change, including this. */}
      {!locked && (
        <button onClick={() => onEditText(baseDocType)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          <Edit3 className="w-3.5 h-3.5" /> Edit Text
        </button>
      )}
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
              {(p.scientificName || p.localName) && (
                <p className="text-xs text-gray-400 italic">
                  {[p.scientificName, p.localName].filter(Boolean).join(' · ')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Items table with auto-calc and product search ──────────────────────────
// Batch 7: this is now the MASTER table, used ONLY in the Shipment Details tab — Packing List and
// Buyer's Invoice render read-only derived views instead (see ReadOnlyItemsView below), so
// `showPrice`/`showCtnSize` toggles are no longer needed, every column always shows.
function ItemsTable({ items, onChange, currency = 'EUR', ctnConfigs = [] }) {
  // Sets one or more fields on row `i` in a single state update (needed so selecting a catalog product
  // can set productName AND botanicalName atomically — calling the old single-field `update()` twice in
  // a row would have the second call overwrite the first, since both would compute their "next" array
  // from the same stale `items` prop before React re-renders in between).
  const updateFields = (i, fields) => {
    const next = [...items];
    next[i] = { ...next[i], ...fields };
    // Auto SL number
    next[i].slNo = i + 1;
    // Auto-calc: ctnSizeKg × totalCTN → quantityKg (total net weight per line)
    if ('ctnSizeKg' in fields || 'totalCTN' in fields) {
      const ps = Number(next[i].ctnSizeKg) || 0;
      const ctn = Number(next[i].totalCTN) || 0;
      next[i].quantityKg = ps && ctn ? +(ps * ctn).toFixed(2) : next[i].quantityKg;
      // Requirement 4: total CTN × the matching saved CTN Configuration's weight = this row's total
      // CTN weight. No match (e.g. a custom size not in the saved list) → can't be estimated, 0.
      const matchedConfig = ctnConfigs.find(c => Number(c.ctnSizeKg) === ps);
      next[i].totalCtnWeightKg = matchedConfig && ctn ? +((ctn * matchedConfig.ctnWeightGm / 1000)).toFixed(3) : 0;
    }
    // Auto-calc: unitPrice × quantityKg → totalValue (R1: "Total EUR (CFR) = Quantity KG × Unit Price")
    if ('unitPrice' in fields || 'quantityKg' in fields || 'ctnSizeKg' in fields || 'totalCTN' in fields) {
      const qty = Number(next[i].quantityKg) || 0;
      const price = Number(next[i].unitPrice) || 0;
      if (qty && price) next[i].totalValue = +(qty * price).toFixed(2);
    }
    onChange(next);
  };
  const update = (i, k, v) => updateFields(i, { [k]: v });
  // Row-level "choose from catalog" (issue 37): selecting a product sets productName + botanicalName
  // at once, auto-filling the botanical name exactly as it was entered when the product was listed.
  // hsCode auto-fills the same way, but ONLY when the picked product actually has one set — unlike
  // botanical name, it deliberately does NOT clobber an hsCode the admin already typed in for this row
  // just because the newly-selected product happens not to have one saved (R1).
  const selectProductForRow = (i, product) => {
    // R1/R2/R3: also snapshot productId + the catalog category's name, so category-wise totals
    // (the "Category Wise Product Details" section and BD Invoice's per-category rows) can be
    // computed instantly from `items` with no extra fetch. /api/products already populates
    // `category` with { _id, name, slug }, so `product.category?.name` is available right here.
    const fields = { productName: product.name, botanicalName: product.scientificName || '', productId: product._id, category: product.category?.name || '' };
    if (product.hsCode) fields.hsCode = product.hsCode;
    updateFields(i, fields);
  };

  const addRow = () => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: '', botanicalName: '', productId: '', category: '', hsCode: '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  };
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));
  const addFromProduct = (product) => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: product.name, botanicalName: product.scientificName || '', productId: product._id, category: product.category?.name || '', hsCode: product.hsCode || '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  };

  const grandCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const grandCtnWeight = items.reduce((a, r) => a + (Number(r.totalCtnWeightKg) || 0), 0);
  const grandKg = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const grandVal = items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);

  return (
    <div>
      <div className="mb-2">
        <ProductSearch onSelect={addFromProduct} />
        <p className="text-xs text-gray-400 mt-1">Select a product above to add a new row, or type/select directly in any row's "Product Name" field — botanical name (and H.S. Code, if the product has one saved) auto-fill either way</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        {/* table-fixed + an explicit width on EVERY column (not just some) — under the default
            table-layout:auto, Product Name/Botanical Name had no width hint at all, so the browser
            gave them most of the available space and starved the numeric columns next to them down
            to barely-legible widths. Fixed layout makes these widths authoritative instead of just
            hints; overflow-x-auto on the wrapper above still lets the whole table scroll
            horizontally on narrower screens rather than forcing everything to be squeezed to fit. */}
        <table className="w-full text-xs table-fixed" style={{ minWidth: '1120px' }}>
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-3 py-2.5 text-center w-9">SL</th>
              <th className="px-3 py-2.5 text-left w-40">Product Name</th>
              <th className="px-3 py-2.5 text-left w-36">Botanical Name</th>
              <th className="px-3 py-2.5 text-left w-24">H.S. Code</th>
              <th className="px-3 py-2.5 text-right w-24 whitespace-nowrap">Pack Size (kg)</th>
              <th className="px-3 py-2.5 text-right w-16 whitespace-nowrap">CTN</th>
              <th className="px-3 py-2.5 text-right w-24 whitespace-nowrap">CTN Wt (kg)</th>
              <th className="px-3 py-2.5 text-right w-24 whitespace-nowrap">Qty (kg)</th>
              <th className="px-3 py-2.5 text-right w-24 whitespace-nowrap">Unit ({currency})</th>
              <th className="px-3 py-2.5 text-right w-24 whitespace-nowrap">Avg Price ({currency})</th>
              <th className="px-3 py-2.5 text-right w-28 whitespace-nowrap">Total ({currency})</th>
              <th className="w-9"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              // A row's ctnSizeKg might be a legacy/custom value that isn't in the saved CTN
              // Configuration list — synthesize an extra option for it instead of silently
              // blanking it out of the dropdown.
              const hasMatchingConfig = ctnConfigs.some(c => Number(c.ctnSizeKg) === Number(item.ctnSizeKg));
              return (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2 text-center text-gray-500 font-medium">{i + 1}</td>
                <td className="px-2 py-2">
                  <ProductNameCombobox
                    value={item.productName || ''}
                    onChange={v => update(i, 'productName', v)}
                    onSelect={p => selectProductForRow(i, p)}
                    placeholder="Product name"
                    className="input-field py-1.5 text-xs w-full"
                  />
                </td>
                <td className="px-2 py-2">
                  <input value={item.botanicalName || ''} onChange={e => update(i, 'botanicalName', e.target.value)} className="input-field py-1.5 text-xs w-full" placeholder="Botanical name" />
                </td>
                <td className="px-2 py-2">
                  <input value={item.hsCode || ''} onChange={e => update(i, 'hsCode', e.target.value)} className="input-field py-1.5 text-xs w-full" placeholder="H.S. Code" />
                </td>
                <td className="px-2 py-2">
                  {/* R1: "Admin will choose the pack size that are saved in CTN configuration section" */}
                  <select value={item.ctnSizeKg || ''} onChange={e => update(i, 'ctnSizeKg', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right">
                    <option value="">—</option>
                    {ctnConfigs.map(c => <option key={c._id} value={c.ctnSizeKg}>{c.ctnSizeKg} kg</option>)}
                    {item.ctnSizeKg && !hasMatchingConfig && <option value={item.ctnSizeKg}>{item.ctnSizeKg} kg (custom)</option>}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input type="number" value={item.totalCTN || ''} onChange={e => update(i, 'totalCTN', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" />
                </td>
                <td className="px-3 py-2 text-right text-gray-400 font-medium" title="Auto-calculated from CTN Size × CTN, using the matching saved CTN Configuration">
                  {item.totalCtnWeightKg ? Number(item.totalCtnWeightKg).toFixed(2) : '—'}
                </td>
                <td className="px-2 py-2">
                  <input type="number" value={item.quantityKg || ''} onChange={e => update(i, 'quantityKg', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" />
                </td>
                <td className="px-2 py-2">
                  <input type="number" value={item.unitPrice || ''} onChange={e => update(i, 'unitPrice', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" />
                </td>
                <td className="px-3 py-2 text-right text-gray-400 font-medium" title="Total Value ÷ Quantity — always derived, never entered directly">
                  {avgPrice(item.totalValue, item.quantityKg) ? avgPrice(item.totalValue, item.quantityKg).toFixed(2) : '—'}
                </td>
                <td className="px-2 py-2">
                  <input type="number" value={item.totalValue || ''} onChange={e => update(i, 'totalValue', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right font-semibold" />
                </td>
                <td className="px-1 py-2 text-center">
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white text-xs font-bold">
              <td colSpan={5} className="px-3 py-2.5 text-right">Grand Total:</td>
              <td className="px-3 py-2.5 text-right">{grandCTN}</td>
              <td className="px-3 py-2.5 text-right">{grandCtnWeight.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right">{grandKg.toFixed(1)}</td>
              <td></td>
              <td className="px-3 py-2.5 text-right">{grandKg ? avgPrice(grandVal, grandKg).toFixed(2) : ''}</td>
              <td className="px-3 py-2.5 text-right text-green-400">{grandVal.toFixed(2)}</td>
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

// Batch 7: Packing List and Buyer's Invoice are read-only views computed FROM the Shipment
// Details master table — `columns` (an ordered subset of AVAILABLE_COLUMNS[docKey], resolved via
// getDocumentColumns() against the shipment's Export Category) decides which extra columns show,
// so the same component serves every category's document format without any per-category branching
// here — all the category-awareness lives in lib/exportColumns.js.
// Shared by ReadOnlyItemsView and BdInvoiceTable below — explicit widths for every dynamic column
// key, since neither the read-only spans nor the table's <th> elements had a width hint before,
// letting the Name column balloon and everything else get squeezed (the same root cause as the
// master ItemsTable's fix above).
const DOC_COLUMN_WIDTH = {
  hsCode: 'w-24', packSizeKg: 'w-28', totalCTN: 'w-24', quantityKg: 'w-28',
  unitPrice: 'w-28', averagePrice: 'w-28', totalValue: 'w-32',
};

function ReadOnlyItemsView({ items, columns, currency = 'EUR', salesTerm }) {
  const visible = (items || []).filter(r => r.productName);
  const grand = {
    totalCTN: visible.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0),
    quantityKg: visible.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0),
    totalValue: visible.reduce((a, r) => a + (Number(r.totalValue) || 0), 0),
  };
  const renderCell = (key, r) => {
    switch (key) {
      case 'hsCode': return r.hsCode || '—';
      case 'packSizeKg': return r.ctnSizeKg || '—';
      case 'totalCTN': return r.totalCTN || 0;
      case 'quantityKg': return Number(r.quantityKg || 0).toFixed(1);
      case 'unitPrice': return Number(r.unitPrice || 0).toFixed(2);
      case 'averagePrice': return avgPrice(r.totalValue, r.quantityKg).toFixed(2);
      case 'totalValue': return Number(r.totalValue || 0).toFixed(2);
      default: return '';
    }
  };
  const renderGrand = (key) => {
    switch (key) {
      case 'totalCTN': return grand.totalCTN;
      case 'quantityKg': return grand.quantityKg.toFixed(1);
      case 'averagePrice': return grand.quantityKg ? avgPrice(grand.totalValue, grand.quantityKg).toFixed(2) : '';
      case 'totalValue': return grand.totalValue.toFixed(2);
      default: return '';
    }
  };
  if (!visible.length) return <p className="text-sm text-gray-400 italic py-6 text-center">No products yet — add them in the Shipment Details tab</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
      <table className="w-full text-xs table-fixed" style={{ minWidth: '640px' }}>
        <thead>
          <tr className="bg-gray-900 text-white">
            <th className="px-3 py-2.5 text-center w-12">SL NO.</th>
            <th className="px-3 py-2.5 text-left w-56">Name of Products (Botanical Name)</th>
            {columns.map(k => <th key={k} className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH[k] || 'w-28'}`}>{columnHeaderLabel(k, currency, salesTerm)}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2.5 text-center text-gray-500 font-medium">{i + 1}</td>
              <td className="px-3 py-2.5">{r.productName}{r.botanicalName && <span className="italic text-gray-400"> ({r.botanicalName})</span>}</td>
              {columns.map(k => <td key={k} className="px-3 py-2.5 text-right">{renderCell(k, r)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900 text-white text-xs font-bold">
            <td colSpan={2} className="px-3 py-2.5 text-right">Grand Total:</td>
            {columns.map(k => <td key={k} className="px-3 py-2.5 text-right">{renderGrand(k)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Batch 7 (R4) — BD Invoice's small set of admin-editable, category-seeded override rows. Unlike
// ReadOnlyItemsView above, these ARE inputs (Name/H.S. Code/Total CTN/Quantity KG/Unit Price are
// all "admin will be able to add these fields manually" per R4) — but Total Value is always
// derived (qty × price), never a free input, matching R4's "filled automatically" wording for that
// one field specifically. Batch 17 (R3): each row is now a PRODUCT CATEGORY (auto-seeded from
// computeCategoryBreakdown, one row per category found in Shipment Details — see
// seedBdItemsFromShipment above), not an individual product, so there's no botanical name concept
// here at all any more; H.S. Code is now a normal column (via `has('hsCode')`, driven by
// `columns` exactly like every other field here) instead of a second line under the name.
function BdInvoiceTable({ items, onChange, columns, currency = 'EUR', salesTerm }) {
  const has = (k) => columns.includes(k);
  // Only recompute totalValue when the fields that actually drive it change — editing productName,
  // hsCode, or totalCTN must NOT touch it. Without this gate, editing e.g. the product name on a
  // freshly-seeded row would silently recompute totalValue as qty × the *rounded* unit price,
  // discarding the precisely-seeded exact shipment total and reintroducing a rounding gap large
  // enough to trip the mismatch check before the admin has changed anything price/quantity-related.
  const updateRow = (i, k, v) => {
    const next = [...items];
    next[i] = { ...next[i], [k]: v, slNo: i + 1 };
    if (k === 'quantityKg' || k === 'unitPrice') {
      const qty = Number(next[i].quantityKg) || 0;
      const price = Number(next[i].unitPrice) || 0;
      next[i].totalValue = +(qty * price).toFixed(2);
    }
    onChange(next);
  };
  const addRow = () => onChange([...items, { slNo: items.length + 1, productName: '', hsCode: '', totalCTN: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));
  const grand = {
    totalCTN: items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0),
    quantityKg: items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0),
    totalValue: items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0),
  };
  if (!items.length) return <p className="text-sm text-gray-400 italic py-6 text-center">Add products in Shipment Details — this table seeds itself automatically, one row per product category</p>;
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        {/* Same fix as the master ItemsTable above: the Name column had no width hint at all, so it
            was absorbing most of the table's width and squeezing every numeric column next to it
            down to barely-usable size — visible directly in the bug report's screenshot. */}
        <table className="w-full text-xs table-fixed" style={{ minWidth: '620px' }}>
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-3 py-2.5 text-center w-12">SL NO.</th>
              <th className="px-3 py-2.5 text-left w-52">Name of Products</th>
              {has('hsCode') && <th className={`px-3 py-2.5 text-left whitespace-nowrap ${DOC_COLUMN_WIDTH.hsCode}`}>HS Code</th>}
              {has('totalCTN') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.totalCTN}`}>Total CTN</th>}
              {has('quantityKg') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.quantityKg}`}>Quantity KG</th>}
              {has('unitPrice') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.unitPrice}`}>{columnHeaderLabel('unitPrice', currency, salesTerm)}</th>}
              {has('averagePrice') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.averagePrice}`}>{columnHeaderLabel('averagePrice', currency, salesTerm)}</th>}
              {has('totalValue') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.totalValue}`}>{columnHeaderLabel('totalValue', currency, salesTerm)}</th>}
              <th className="w-9"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 text-center text-gray-500 font-medium">{i + 1}</td>
                <td className="px-2 py-2">
                  <input value={item.productName || ''} onChange={e => updateRow(i, 'productName', e.target.value)} className="input-field py-1.5 text-xs w-full" placeholder="e.g. Fresh Fruits" />
                </td>
                {has('hsCode') && <td className="px-2 py-2"><input value={item.hsCode || ''} onChange={e => updateRow(i, 'hsCode', e.target.value)} className="input-field py-1.5 text-xs w-full" placeholder="HS Code" /></td>}
                {has('totalCTN') && <td className="px-2 py-2"><input type="number" value={item.totalCTN || ''} onChange={e => updateRow(i, 'totalCTN', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" /></td>}
                {has('quantityKg') && <td className="px-2 py-2"><input type="number" value={item.quantityKg || ''} onChange={e => updateRow(i, 'quantityKg', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" /></td>}
                {has('unitPrice') && <td className="px-2 py-2"><input type="number" value={item.unitPrice || ''} onChange={e => updateRow(i, 'unitPrice', e.target.value)} className="input-field px-1.5 py-1.5 text-xs w-full text-right" /></td>}
                {has('averagePrice') && <td className="px-3 py-2 text-right text-gray-400 font-medium">{avgPrice(item.totalValue, item.quantityKg) ? avgPrice(item.totalValue, item.quantityKg).toFixed(2) : '—'}</td>}
                {has('totalValue') && <td className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">{Number(item.totalValue || 0).toFixed(2)}</td>}
                <td className="px-1 py-2 text-center"><button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 text-white text-xs font-bold">
              <td colSpan={2} className="px-3 py-2.5 text-right">Grand Total:</td>
              {has('hsCode') && <td></td>}
              {has('totalCTN') && <td className="px-3 py-2.5 text-right">{grand.totalCTN}</td>}
              {has('quantityKg') && <td className="px-3 py-2.5 text-right">{grand.quantityKg.toFixed(1)}</td>}
              {has('unitPrice') && <td></td>}
              {has('averagePrice') && <td className="px-3 py-2.5 text-right">{grand.quantityKg ? avgPrice(grand.totalValue, grand.quantityKg).toFixed(2) : ''}</td>}
              {has('totalValue') && <td className="px-3 py-2.5 text-right text-green-400">{grand.totalValue.toFixed(2)}</td>}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addRow} className="mt-2 flex items-center gap-1.5 text-xs text-brand hover:text-green-700 font-medium transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Row
      </button>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
const EMPTY = () => Array.from({ length: 3 }, (_, i) => ({ slNo: i + 1, productName: '', botanicalName: '', productId: '', category: '', hsCode: '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }));

export default function ShipmentDetailPage() {
  const { countryId, buyerId, shipmentId } = useParams();
  const router = useRouter();
  const isNew = shipmentId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [buyer, setBuyer] = useState(null);
  // Batch 17 (R7): letterheadUrl is now READ-ONLY here — a passive fallback for any shipment with
  // no Export License selected yet. Its own upload UI was removed; the one remaining place to
  // upload a company letterhead is the Export License editor (components/admin/export-settings/
  // ExportLicenseSection.jsx) — see effectiveLetterheadUrl below for how the two combine.
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState(0);
  // Batch 7 (R1) — read-only reference, sourced from Settings (edited on the Export Dashboard home
  // page, not per-shipment — see app/admin/export-dashboard/page.jsx).
  const [exporterInfo, setExporterInfo] = useState({ exporterName: 'Shah International', exporterAddress: '' });
  const [docStyle, setDocStyle] = useState('letterhead'); // 'letterhead' | 'plain' — shared by Print & Download, all 3 doc types
  const [downloadingDoc, setDownloadingDoc] = useState(null); // which baseDocType is currently generating a document, or null
  // Batch 8 (R5): PDF/DOCX/XLSX — one shared format choice across all 3 doc types, same pattern as docStyle above.
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  // Which baseDocType's hardcoded text is currently being edited (null = modal closed), and a local
  // draft of {declaration, signatoryTitle} for it while the modal is open.
  const [editingDocType, setEditingDocType] = useState(null);
  const [textDraft, setTextDraft] = useState({ declaration: '', signatoryTitle: '' });
  const [savingText, setSavingText] = useState(false);

  // Settings-driven config, fetched once on mount (see loadConfig below) — CTN Configuration
  // (requirement 2/3/4), Bank Accounts (6), Export Licenses (7), Export Categories (8/10), and the
  // 6 shipment-field option lists (5).
  const [ctnConfigs, setCtnConfigs] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [exportLicenses, setExportLicenses] = useState([]);
  const [exportCategories, setExportCategories] = useState([]);
  // Batch 9 (R18): this buyer's Export Contracts, for the new banner-card selector below.
  const [exportContracts, setExportContracts] = useState([]);
  // Reads ?contract=X the same way settings/page.jsx already established for this codebase — plain
  // URLSearchParams against window.location, not next/navigation's useSearchParams, which would
  // require wrapping this whole page in a Suspense boundary just for one param.
  const [contractParam, setContractParam] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setContractParam(new URLSearchParams(window.location.search).get('contract') || '');
  }, []);
  const [shipmentOptions, setShipmentOptions] = useState({ modeOfCarrying: [], landingPort: [], portOfDischarge: [], finalDestination: [], salesTerm: [], countryOfOrigin: [] });

  const [form, setFormState] = useState({
    shipmentNo: `SI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    contractNo: '', exportContract: '', invoiceNo: '', dateStr: new Date().toISOString().slice(0, 10),
    baseCurrency: 'EUR',
    exportCategory: '', // requirement 10
    modeOfCarrying: 'By Air',
    landingPort: 'Hazrat Shahjalal International Airport',
    portOfDischarge: '', finalDestination: '', salesTerm: 'CFR',
    countryOfOrigin: 'Bangladesh',
    // Batch 19 (R33-1): default matches the schema default — new shipments start in the existing,
    // unchanged category-grouped BD Invoice behavior.
    bdHsCodeMode: 'category',
    tinNo: '518591244958', binNo: '71367570202', ercNo: '260326210852625',
    expNo: '', expDateStr: '', awbNo: '', awbDateStr: '', pcNo: '', pcDateStr: '', rexNo: '', // R1: REX No, auto-fills from the License below
    exportLicense: '', // requirement 7
    bankAccount: '', // requirement 6
    beneficiaryBank: 'Sonali Bank', accountNo: '1608902003846',
    branchName: 'Foreign Exchange Corporate Branch', bankAddress: '',
    routingNo: '200272320', swiftCode: 'BSONBDDHFEB',
    // Batch 7: `items` is now the ONE master product table (entered in the Shipment Details tab).
    // Packing List & Buyer's Invoice are read-only views derived from it (see ReadOnlyItemsView) —
    // they can no longer disagree with Shipment Details, since they're literally the same data.
    // `bdItems` is a SMALL, separate set of BD Invoice override rows (R4) that continuously
    // auto-syncs to the Export Category + these totals until the admin edits it directly (see
    // bdItemsLocked and the sync effect further down) — that's also why it CAN drift from Shipment
    // Details once locked (the mismatch check further down is what surfaces that when it happens).
    items: EMPTY(),
    bdItems: [], bdItemsLocked: false,
    totalNetWeightKg: '', totalGrossWeightKg: '',
    // requirement 4: the auto-calculated baseline, and whether totalGrossWeightKg has been
    // manually detached from following it.
    estimatedGrossWeightKg: 0, grossWeightOverridden: false,
    invoiceCurrency: 'EUR',
    freightCost: '', goodsCost: '', exportProcessingCost: '', othersCost: '',
    totalCost: '', receiveAmountBDT: '', orderValueForeign: '',
    orderCurrency: 'EUR', exchangeRateBDT: '',
    availableBalance: '', incentive: '', damage: '', netProfit: '',
    // Batch 8 (R7): TT Configuration entries — {ttNumber, ttDate, ttValue}.
    ttEntries: [],
    // Batch 8 (R5): per-document text overrides, empty until the admin edits one.
    documentTextOverrides: { packingList: {}, buyerInvoice: {}, bdInvoice: {} },
    // Batch 8 (R2): a brand new shipment starts life as a draft — see handleSave below for how
    // "Save Draft" vs "Save & Activate" set this explicitly rather than trusting whatever's here.
    notes: '', status: 'draft', additionalDocs: [], photos: [],
  });
  const set = (k, v) => setFormState(p => ({ ...p, [k]: v }));

  // Batch 8 (R13/R15): populated only when this shipment belongs to an Incentive Application —
  // read-only reference data (never sent back in a save payload) used to show the lock banner and
  // resolve the effective BDT rate. Stays null for a shipment that was never selected into one.
  const [incentiveApplication, setIncentiveApplication] = useState(null);

  // Requirement 10: selecting a category computes this shipment's incentive ONCE, from the
  // category's own rates against the order value known right now — same "auto-fill then stays a
  // normal editable field" pattern as botanical name/bank details elsewhere in this editor, rather
  // than a permanently-live derived value (Incentive already feeds into the existing Net Profit
  // calculation as a plain stored number, so keeping it a regular field the admin can still adjust
  // — e.g. if the order value changes later — fits the surrounding architecture better than adding
  // a second always-on auto-sync alongside Gross Weight's).
  const handleCategorySelect = (id) => {
    const cat = exportCategories.find(c => c._id === id);
    if (!cat) { set('exportCategory', id); return; }
    // Batch 8 (R8): Order Value is now always itemsTotalValue, not a separately-typed field, so the
    // estimate here uses that directly rather than the no-longer-authoritative form.orderValueForeign.
    const receiveBDT = itemsTotalValue * (Number(form.exchangeRateBDT) || 0);
    const netIncentive = Math.max(0,
      receiveBDT * ((Number(cat.incentivePercentage) || 0) / 100) * (1 - (Number(cat.taxPercentage) || 0) / 100)
      - (Number(cat.incentiveApplicationCost) || 0) - (Number(cat.othersCost) || 0)
    );
    setFormState(p => ({ ...p, exportCategory: id, incentive: +netIncentive.toFixed(2) }));
  };

  // Requirement 6: auto-fills the 5 bank fields from the selected saved account; they stay
  // independently editable afterward (e.g. a one-off correction for this specific shipment).
  const handleBankSelect = (id) => {
    const bank = bankAccounts.find(b => b._id === id);
    if (!bank) { set('bankAccount', id); return; }
    setFormState(p => ({
      ...p, bankAccount: id, beneficiaryBank: bank.beneficiaryBank, accountNo: bank.accountNo,
      branchName: bank.branch, bankAddress: bank.bankAddress, routingNo: bank.routingNo, swiftCode: bank.swiftCode,
    }));
  };

  // Requirement 7: auto-fills TIN/BIN; the license's own letterhead becomes this shipment's
  // effective document letterhead (see the docLetterheadUrl computed value + generateDoc below),
  // taking priority over the global company letterhead.
  const handleLicenseSelect = (id) => {
    const lic = exportLicenses.find(l => l._id === id);
    if (!lic) { set('exportLicense', id); return; }
    setFormState(p => ({ ...p, exportLicense: id, tinNo: lic.tinNo, binNo: lic.binNo, rexNo: lic.rexNo || p.rexNo }));
  };

  // Batch 9 (R18): auto-fills Contract No / Base Currency / Export Category from the selected
  // Export Contract — identical "auto-fill once, stays a normal editable field" pattern as the 3
  // handlers above.
  const handleContractSelect = (id) => {
    const contract = exportContracts.find(c => c._id === id);
    if (!contract) { set('exportContract', id); return; }
    setFormState(p => ({
      ...p, exportContract: id,
      contractNo: contract.contractNo || p.contractNo,
      baseCurrency: contract.baseCurrency || p.baseCurrency,
      exportCategory: contract.exportCategory?._id || contract.exportCategory || p.exportCategory,
    }));
  };

  const { rate, bdtPerUnit, loading: rateLoading, refresh: refreshRate } = useLiveRate(form.baseCurrency);

  useEffect(() => {
    fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()).then(d => setBuyer(d.buyer));
    // Batch 17 (R7): this global Settings letterhead is now a passive FALLBACK only, for a
    // shipment with no Export License selected — its own upload UI is gone; the one place to
    // actually upload a company letterhead is the Export License editor. Still load the current
    // fallback value on mount so effectiveLetterheadUrl below has it available if needed.
    // Also grab the persisted Export Analytics Initial Balance (issue 46) so this editor's live
    // Available Balance / Shipment Margin / Net Profit preview matches what the server will compute.
    // Requirement 5: also grab the 6 shipment-option lists for the logistics fields' suggestions.
    fetch('/api/settings').then(r => r.json()).then(d => {
      setLetterheadUrl(d?.settings?.exportLetterheadUrl || '');
      setInitialBalance(d?.settings?.exportAnalyticsInitialBalance || 0);
      setExporterInfo({ exporterName: d?.settings?.exporterName || 'Shah International', exporterAddress: d?.settings?.exporterAddress || '' });
      const opts = d?.settings?.exportShipmentOptions;
      if (opts) setShipmentOptions(opts);
    }).catch(() => {});
    // Requirements 2/6/7/8: this shipment's Settings-driven config, all fetched once here.
    fetch('/api/export/ctn-configs').then(r => r.json()).then(d => setCtnConfigs((d.items || []).filter(c => c.isActive))).catch(() => {});
    fetch('/api/export/bank-accounts').then(r => r.json()).then(d => setBankAccounts((d.items || []).filter(b => b.isActive))).catch(() => {});
    fetch('/api/export/licenses').then(r => r.json()).then(d => setExportLicenses((d.items || []).filter(l => l.isActive))).catch(() => {});
    fetch('/api/export/categories').then(r => r.json()).then(d => setExportCategories((d.items || []).filter(c => c.isActive))).catch(() => {});
    // Batch 9 (R18): this buyer's Export Contracts, for the new banner-card selector.
    fetch(`/api/export/contracts?buyer=${buyerId}`).then(r => r.json()).then(d => setExportContracts(d.contracts || [])).catch(() => {});
    if (!isNew) {
      setLoading(true);
      fetch(`/api/export/shipments/${shipmentId}`).then(r => r.json()).then(d => {
        if (d.shipment) {
          const s = d.shipment;
          setFormState(p => ({
            ...p, ...s,
            dateStr: s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
            expDateStr: s.expDate ? new Date(s.expDate).toISOString().slice(0, 10) : '',
            awbDateStr: s.awbDate ? new Date(s.awbDate).toISOString().slice(0, 10) : '',
            pcDateStr: s.pcDate ? new Date(s.pcDate).toISOString().slice(0, 10) : '',
            items: s.items?.length ? s.items : EMPTY(),
            // Batch 7: no forced EMPTY() fallback here — a genuinely empty array lets the
            // auto-seed effect (below, after liveTotalCTN etc. are computed) know it's safe to
            // seed a fresh row; an old shipment's pre-existing (possibly multi-row) bdItems from
            // before this batch are left exactly as saved.
            bdItems: s.bdItems || [],
            photos: s.photos || [],
            ttEntries: s.ttEntries || [],
            documentTextOverrides: { packingList: {}, buyerInvoice: {}, bdInvoice: {}, ...(s.documentTextOverrides || {}) },
            // exportCategory/bankAccount/exportLicense come back POPULATED (full docs, for
            // convenience elsewhere) — these 3 selects need just the id as their value.
            exportCategory: s.exportCategory?._id || s.exportCategory || '',
            bankAccount: s.bankAccount?._id || s.bankAccount || '',
            exportLicense: s.exportLicense?._id || s.exportLicense || '',
            // Batch 9 (R18): same "populated doc back, select needs just the id" handling.
            exportContract: s.exportContract?._id || s.exportContract || '',
            // Requirement 4: a shipment saved before this feature existed has
            // grossWeightOverridden left at its schema default (false) with a totalGrossWeightKg
            // an admin may have carefully set by hand — without this, the very first time such a
            // shipment is opened, the auto-sync effect below would treat it as "never touched" and
            // silently replace that value with a freshly computed estimate. Any already-set,
            // non-empty Gross Weight is treated as intentional unless the shipment explicitly says
            // otherwise.
            grossWeightOverridden: s.grossWeightOverridden === true || !!s.totalGrossWeightKg,
          }));
          setIncentiveApplication(s.incentiveApplication || null);
        }
        setLoading(false);
      });
    }
  }, [shipmentId, buyerId, isNew]);

  // Batch 9 (R18): arriving here from a contract's shipment list with ?contract=X pre-associates a
  // brand-new shipment with that contract, same as picking it from the selector manually would.
  // Runs once, as soon as both the query param and the contracts list are available; a no-op for
  // an existing shipment (isNew false) or once exportContract is already set from either source.
  useEffect(() => {
    if (!isNew || !contractParam || form.exportContract || exportContracts.length === 0) return;
    handleContractSelect(contractParam);
  }, [isNew, contractParam, exportContracts]);

  // Batch 8 (R2/R3): `activate` distinguishes the two save actions in the header/footer —
  // "Save Draft" (activate=false, only shown while still draft) leaves status exactly as-is, vs
  // "Save" / "Save & Activate" (activate=true) which moves a draft shipment to active. Once a
  // shipment is already active/completed/archived, activate=true is simply a no-op on status (it's
  // already "activated" in spirit) — this is also independently enforced server-side (a PUT can
  // never regress status back to draft), so this client logic is UX, not the only safeguard.
  const handleSave = async (activate) => {
    // R13: belt-and-braces — the Save button is hidden/disabled once locked, but a stale render
    // (e.g. a claim happening in another tab) shouldn't be able to slip a request through.
    if (incentiveApplication?.status === 'claimed') {
      toast.error(`This shipment is locked — it's part of the claimed Incentive Application "${incentiveApplication.title}".`);
      return;
    }

    // Bug fix (reported via screenshot, mobile — same root cause as the exportLicense/exportCategory/
    // bankAccount handling a few lines below, just never extended to cover this): a brand new
    // shipment starts with 3 blank rows in Shipment Details (see ItemsTable's EMPTY() further up),
    // and its "+ Add Row" button also adds one — both set productId: '' until a product is actually
    // picked for that row via the combobox. Saving with any row still unpicked sent that literal
    // empty string straight through, and since items.productId is an ObjectId reference, Mongoose's
    // cast failed with a raw "Cast to ObjectId failed for value \"\"" error — meaningless and alarming
    // to whoever hit it, easy to trigger simply by not needing all 3 starting rows. A row with
    // nothing else filled in either (never actually used — e.g. 2 of the 3 default rows on a
    // shipment that only needed 1 product) is dropped silently, since it was never meaningful data;
    // a row with other data filled in but no product chosen is flagged instead of being silently
    // discarded, so the admin doesn't lose entered data without knowing why.
    const rowHasOtherData = (r) => [r.productName, r.quantityKg, r.unitPrice, r.totalCTN, r.totalValue].some(v => String(v ?? '').trim() !== '');
    const incompleteRowIndex = form.items.findIndex(r => !r.productId && rowHasOtherData(r));
    if (incompleteRowIndex !== -1) {
      toast.error(`Row ${incompleteRowIndex + 1} in Shipment Details is missing a product — pick one from the list, or remove the row, before saving.`);
      return;
    }
    const cleanedItems = form.items
      .filter(r => r.productId || rowHasOtherData(r))
      .map((r, idx) => ({ ...r, slNo: idx + 1 }));

    setSaving(true);
    // Auto-fill totals from the master products table (Shipment Details tab)
    const totalCTN = cleanedItems.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
    const totalNetWeightKg = cleanedItems.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
    // R8: Order Value is no longer a free-typed input — it's always exactly the Packing List /
    // Shipment Details items total, in the shipment's own base currency (itemsTotalValue is defined
    // further down this component, but by the time this closure actually runs — on a later click,
    // never during render itself — it already holds the current render's computed total).
    const orderValueForeign = itemsTotalValue;
    const nextStatus = activate ? (form.status === 'draft' ? 'active' : form.status) : form.status;
    const payload = {
      ...form,
      items: cleanedItems,
      status: nextStatus,
      orderValueForeign,
      buyer: buyerId, country: countryId,
      date: form.dateStr ? new Date(form.dateStr) : new Date(),
      expDate: form.expDateStr ? new Date(form.expDateStr) : null,
      awbDate: form.awbDateStr ? new Date(form.awbDateStr) : null,
      pcDate: form.pcDateStr ? new Date(form.pcDateStr) : null,
      // Issue 43: Net Weight and Total Carton are auto-completed from the master products table —
      // the freshly-computed total always wins over whatever (now-unused) manual value might be
      // sitting in form state from an older save, rather than the old "prefer manual" priority.
      totalCTN,
      totalNetWeightKg,
      // Requirement 4: same logic as the on-screen displayGrossWeightKg — whichever the admin sees
      // is exactly what gets saved, whether that's their own manually-entered value or the current
      // estimate (for a shipment that's never been manually overridden).
      totalGrossWeightKg: form.grossWeightOverridden ? (Number(form.totalGrossWeightKg) || 0) : liveEstimatedGrossWeightKg,
      estimatedGrossWeightKg: liveEstimatedGrossWeightKg,
      // Bug fix: exportLicense/exportCategory/bankAccount are ObjectId references — the <select>
      // for any of them defaults to '' when nothing's chosen, and this route does a full-document
      // replace (no $set), so sending '' straight through made Mongoose try to cast an empty string
      // to an ObjectId and crash the whole save ("Cast to ObjectId failed for value \"\""). Setting
      // these to undefined removes the key entirely once JSON.stringify'd below, which correctly
      // clears the field server-side if the admin deselected a previously-chosen one, without ever
      // sending an uncastable value.
      exportLicense: form.exportLicense || undefined,
      exportCategory: form.exportCategory || undefined,
      bankAccount: form.bankAccount || undefined,
    };
    const url = isNew ? '/api/export/shipments' : `/api/export/shipments/${shipmentId}`;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    setSaving(false);
    if (d.success) {
      setFormState(p => ({ ...p, status: d.shipment?.status || nextStatus, orderValueForeign, items: cleanedItems }));
      toast.success(nextStatus === 'draft' ? 'Saved as draft' : (form.status === 'draft' ? 'Shipment activated!' : 'Shipment saved!'));
      if (isNew) router.push(`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/shipments/${d.shipment._id}`);
    } else toast.error(d.message);
  };

  const handlePrint = (baseDocType) => {
    if (isNew) { toast.error('Save the shipment first'); return; }
    const docType = `${baseDocType}-${docStyle}`;
    const qs = new URLSearchParams({ doc: docType, currency: form.baseCurrency });
    window.open(`/print/export/${shipmentId}?${qs}`, '_blank', 'width=900,height=700,scrollbars=yes');
  };

  // Genuinely separate from Print: builds a real document client-side (PDF via jsPDF, DOCX via the
  // docx package, XLSX via SheetJS — R5) and saves it directly — no print dialog, no popup window,
  // and (since it's built from data rather than a screenshot of the page) no possibility of website
  // UI ending up in the file.
  const handleDownload = async (baseDocType) => {
    if (isNew) { toast.error('Save the shipment first'); return; }
    setDownloadingDoc(baseDocType);
    try {
      const r = await fetch(`/api/export/shipments/${shipmentId}`);
      const d = await r.json();
      if (!d.shipment) { toast.error('Could not load the saved shipment'); return; }
      const docType = `${baseDocType}-${docStyle}`;
      // Requirement 7: the selected Export License's own letterhead (populated on this fresh
      // fetch) takes priority over the global company one, falling back to it if no license is
      // selected or the license somehow has none.
      const effectiveLetterheadUrl = d.shipment.exportLicense?.letterheadUrl || letterheadUrl;
      const baseFilename = `${docTypeLabel(baseDocType).replace(/\s+/g, '-')}-${d.shipment.shipmentNo || shipmentId}`;
      if (downloadFormat === 'docx') {
        await generateShipmentDocDOCX({ docType, shipment: d.shipment, buyer: d.shipment.buyer, exporterInfo, filename: `${baseFilename}.docx` });
      } else if (downloadFormat === 'xlsx') {
        generateShipmentDocXLSX({ docType, shipment: d.shipment, buyer: d.shipment.buyer, exporterInfo, filename: `${baseFilename}.xlsx` });
      } else {
        const pdf = await generateShipmentDocPDF({ docType, shipment: d.shipment, buyer: d.shipment.buyer, letterheadUrl: effectiveLetterheadUrl, exporterInfo });
        pdf.save(`${baseFilename}.pdf`);
      }
    } catch {
      toast.error('Could not generate the document — try Print instead');
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Batch 8 (R5): baseDocType ('packing' | 'buyer-invoice' | 'bd-invoice') → the key used in
  // documentTextOverrides / DEFAULT_DOCUMENT_TEXT (camelCase, no hyphen).
  const docTextKey = (baseDocType) => (baseDocType === 'packing' ? 'packingList' : baseDocType === 'buyer-invoice' ? 'buyerInvoice' : 'bdInvoice');

  const openTextOverrideEditor = (baseDocType) => {
    if (isNew) { toast.error('Save the shipment first'); return; }
    const key = docTextKey(baseDocType);
    const current = form.documentTextOverrides?.[key] || {};
    const fallback = DEFAULT_DOCUMENT_TEXT[key];
    setTextDraft({ declaration: current.declaration || fallback.declaration, signatoryTitle: current.signatoryTitle || fallback.signatoryTitle });
    setEditingDocType(baseDocType);
  };

  // Persists immediately (rather than waiting for the main Save button) through the dedicated
  // documentTextOverridesOnly path on the shipments PUT route — see that route for why a targeted
  // $set is used here instead of resending the whole shipment. This also means Print (a separate
  // browser tab that independently fetches its own data) and the next Download both see the change
  // right away, without the admin needing to remember to hit the main Save first.
  const handleSaveTextOverride = async () => {
    const key = docTextKey(editingDocType);
    setSavingText(true);
    try {
      const nextOverrides = { ...(form.documentTextOverrides || {}), [key]: { ...textDraft } };
      const r = await fetch(`/api/export/shipments/${shipmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTextOverridesOnly: true, documentTextOverrides: nextOverrides }),
      });
      const d = await r.json();
      if (d.success) {
        set('documentTextOverrides', nextOverrides);
        toast.success('Document text updated');
        setEditingDocType(null);
      } else toast.error(d.message || 'Could not save');
    } catch {
      toast.error('Could not save the text changes');
    } finally {
      setSavingText(false);
    }
  };

  // Issue 43: Net Weight and Total Carton are auto-completed from the Packing List items — they must
  // NOT be free-typed by the admin, since they're supposed to always match what's actually in the
  // table below. Freight Cost remains admin-entered (nothing derives it). Gross Weight also remains
  // admin-entered, but now starts out pre-filled from an auto-computed estimate — see
  // displayGrossWeightKg below.
  const liveTotalCTN = form.items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const liveTotalNetWeightKg = form.items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  // Requirement 4: total CTN weight (already computed per row by ItemsTable) summed across every
  // packing-list item, plus the total net weight = estimated gross weight.
  const liveTotalCtnWeightKg = form.items.reduce((a, r) => a + (Number(r.totalCtnWeightKg) || 0), 0);
  const liveEstimatedGrossWeightKg = +(liveTotalCtnWeightKg + liveTotalNetWeightKg).toFixed(2);

  // Requirement 4: Gross Weight starts out equal to the estimate and keeps following it as items
  // change, UNTIL the admin directly edits Gross Weight themselves (grossWeightOverridden flips to
  // true in that input's own onChange, below) — from then on it's fully manual. This used to be a
  // useEffect that copied the estimate into form state on every items change, which crashed the
  // page — a plain derived value computed fresh on every render is both simpler and safer here:
  // there's no effect timing to get wrong and nothing that can loop, since a render can never
  // trigger itself.
  const displayGrossWeightKg = form.grossWeightOverridden
    ? (form.totalGrossWeightKg === '' ? '' : Number(form.totalGrossWeightKg))
    : liveEstimatedGrossWeightKg;

  // Batch 7 — R1's "Average Price" (shipment-wide) and the category driving this shipment's
  // document format (documentColumns) & BD Invoice seed values.
  const liveShipmentAveragePrice = shipmentAveragePrice(form.items);
  const selectedCategory = exportCategories.find(c => c._id === form.exportCategory) || null;
  const itemsTotalValue = form.items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);
  // Batch 17 (R1/R2/R3): live, per-PRODUCT-category totals (Product.category — the catalog
  // category snapshotted on each row at selection time — NOT the same thing as `selectedCategory`
  // above, which is this shipment's own single Export Category used for incentives/document
  // format). Powers the "Category Wise Product Details" section below AND BD Invoice's auto-seed.
  const categoryBreakdown = computeCategoryBreakdown(form.items);

  // Batch 17 (R3): BD Invoice's rows are now computed fresh from the PRODUCT-category breakdown
  // (categoryBreakdown, above) — one row per distinct product category found in Shipment Details —
  // instead of a single row named after the shipment's Export Category. Each row's totalValue is
  // seeded from that group's EXACT summed totalValue, not quantityKg × the rounded (2dp) display
  // unit price — multiplying a rounded per-kg price back out across a potentially large quantity
  // can drift well past MISMATCH_TOLERANCE (e.g. a 0.005 rounding error × 2000kg = 10, not 0.01),
  // which would falsely flag an auto-synced row as "mismatched" even though the admin hasn't
  // touched anything. Once the admin actually edits qty or price themselves, BdInvoiceTable's
  // updateRow correctly switches to computing totalValue as qty × price from then on (that row is
  // no longer auto-synced at that point anyway — see setBdItems below). HS Code seeds from the
  // first non-empty HS code found among that category's own items — a sensible starting point;
  // the cell stays admin-editable afterward exactly like every other BD Invoice field.
  const seedBdItemsFromShipment = () => {
    return categoryBreakdown.map((g, i) => ({
      slNo: i + 1,
      productName: g.category,
      hsCode: g.hsCode || '',
      totalCTN: g.totalCTN || '',
      quantityKg: g.quantityKg || '',
      unitPrice: g.quantityKg ? +g.avgPrice.toFixed(2) : '',
      totalValue: +g.totalValue.toFixed(2),
    }));
  };

  // Batch 7 round 2: BD Invoice used to seed ONCE and then freeze forever, which meant a shipment
  // that got MORE products added to Shipment Details after BD Invoice had already auto-seeded once
  // would show permanently stale BD numbers with no obvious reason why — exactly what a real test
  // run surfaced (BD stuck at 5 CTN / 7.5 kg while Shipment Details had grown to 660 CTN / 2950 kg).
  // Now it CONTINUOUSLY tracks Shipment Details for as long as `bdItemsLocked` is false — every
  // change to the category or the master items table updates BD Invoice's row(s) immediately. The
  // moment the admin edits a field, or adds/removes a row, `setBdItems` (used as BdInvoiceTable's
  // onChange below) flips bdItemsLocked to true and this effect stops touching bdItems from then on
  // — it's the admin's own independently-owned data at that point, which is what makes the mismatch
  // banner below meaningful. "Re-fill from Shipment Details" (the button in the BD Invoice tab) is
  // the only other way bdItemsLocked goes back to false.
  // Batch 17 (R3): a plain string signature of categoryBreakdown, NOT the array itself, is used as
  // this effect's dependency below — categoryBreakdown is a fresh array reference every render, so
  // depending on it directly would re-run this effect (harmlessly, but pointlessly) on every single
  // keystroke anywhere on the page. A string compares by value, so React's dependency check
  // correctly treats two renders with identical category groupings/totals as "unchanged" even
  // though a new array was computed for each. This also fixes a real (if narrow) gap the previous
  // dependency list (liveTotalCTN/liveTotalNetWeightKg/liveShipmentAveragePrice/itemsTotalValue —
  // all shipment-WIDE aggregates) had: those 4 numbers can stay identical even when which category
  // a row belongs to changes (e.g. re-picking a different-category product with the same CTN/qty/
  // value) — this signature is sensitive to exactly that, since it's built from the same grouped
  // data seedBdItemsFromShipment() itself uses.
  const categoryBreakdownSignature = categoryBreakdown
    .map(g => `${g.category}|${g.totalCTN}|${g.quantityKg}|${g.totalValue}|${g.hsCode}`)
    .join('~');

  useEffect(() => {
    if (loading || form.bdItemsLocked) return;
    const next = categoryBreakdown.length > 0 ? seedBdItemsFromShipment() : [];
    // Only touch state when the computed row is actually different from what's already there —
    // avoids re-triggering this effect (and thus a render loop) on every single render.
    const current = form.bdItems || [];
    const unchanged = current.length === next.length && current.every((r, i) =>
      r.productName === next[i]?.productName && r.hsCode === next[i]?.hsCode &&
      Number(r.totalCTN || 0) === Number(next[i]?.totalCTN || 0) &&
      Number(r.quantityKg || 0) === Number(next[i]?.quantityKg || 0) &&
      Number(r.unitPrice || 0) === Number(next[i]?.unitPrice || 0) &&
      Number(r.totalValue || 0) === Number(next[i]?.totalValue || 0));
    if (!unchanged) setFormState(p => ({ ...p, bdItems: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, form.bdItemsLocked, categoryBreakdownSignature]);

  // The ONLY way BdInvoiceTable's onChange fires is from the admin's own click/keystroke inside it
  // (updateRow/addRow/removeRow) — the auto-sync effect above sets bdItems directly and never goes
  // through this, so any call here unambiguously means "the admin just took manual control."
  const setBdItems = (v) => setFormState(p => ({ ...p, bdItems: v, bdItemsLocked: true }));

  const handleReseedBd = () => {
    if (form.bdItems.some(r => r.productName) && !confirm("This replaces the current BD Invoice rows with fresh totals from Shipment Details, and BD Invoice will go back to auto-updating whenever Shipment Details changes. Continue?")) return;
    setFormState(p => ({ ...p, bdItems: seedBdItemsFromShipment(), bdItemsLocked: false }));
  };

  // R3/R4's cross-check: "must be same in all shipment details page, BD Invoice, Packing List,
  // Buyer's invoice... mark in red and show error message where the value is not matching."
  // Packing List and Buyer's Invoice are now READ-ONLY views of the very same `items` array as
  // Shipment Details (see ReadOnlyItemsView) — they're structurally the same data, so they can
  // never disagree with it. Gross Weight is one shared field mirrored on every tab, so it can't
  // disagree either. The one place a real mismatch CAN happen is BD Invoice in Category mode,
  // since R4 explicitly makes its rows independently admin-editable after the initial seed.
  // Batch 19 (R33-1): Product mode is ALSO a direct read-only mirror of `items` (same reasoning as
  // Packing List/Buyer's Invoice above — see the BD Invoice tab's conditional rendering below) —
  // so in that mode BD Invoice's totals are simply the shipment-wide totals already computed
  // above, not a separate reduce over bdItems (which isn't even being kept in sync in this mode),
  // and a mismatch is structurally impossible, exactly like Packing List/Buyer's Invoice.
  const isBdProductMode = form.bdHsCodeMode === 'product';
  const bdTotalCTN = isBdProductMode ? liveTotalCTN : form.bdItems.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const bdTotalQty = isBdProductMode ? liveTotalNetWeightKg : form.bdItems.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const bdTotalValue = isBdProductMode ? itemsTotalValue : form.bdItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);
  const bdHasData = isBdProductMode ? form.items.some(r => r.productName) : form.bdItems.some(r => r.productName);
  const MISMATCH_TOLERANCE = 0.01;
  const bdMismatches = [];
  if (bdHasData && !isBdProductMode) {
    if (Math.abs(bdTotalCTN - liveTotalCTN) > MISMATCH_TOLERANCE) bdMismatches.push(`Total CTN — BD Invoice: ${bdTotalCTN}, Shipment Details: ${liveTotalCTN}`);
    if (Math.abs(bdTotalQty - liveTotalNetWeightKg) > MISMATCH_TOLERANCE) bdMismatches.push(`Net Weight — BD Invoice: ${bdTotalQty.toFixed(2)} KG, Shipment Details: ${liveTotalNetWeightKg.toFixed(2)} KG`);
    if (Math.abs(bdTotalValue - itemsTotalValue) > MISMATCH_TOLERANCE) bdMismatches.push(`Total Value — BD Invoice: ${bdTotalValue.toFixed(2)} ${form.baseCurrency}, Shipment Details: ${itemsTotalValue.toFixed(2)} ${form.baseCurrency}`);
  }

  if (loading) return <div className="py-20"><Loader /></div>;

  const tabs = [
    { id: 'details', label: '📋 Shipment Details', icon: MoreHorizontal },
    { id: 'packing', label: '📦 Packing List', icon: Package },
    { id: 'buyer-invoice', label: "🧾 Buyer's Invoice", icon: ReceiptText },
    { id: 'bd-invoice', label: '🇧🇩 BD Invoice', icon: Globe },
  ];

  const usdEquiv = rate ? (1 / rate).toFixed(4) : '...';

  // Batch 8 (R15): while this shipment's Incentive Application has an active rate override (a
  // manual rate, or — once claimed — the frozen one), that resolved number IS the rate everywhere
  // below, replacing the shipment's own live-tracked exchangeRateBDT.
  const rateOverrideActive = isRateOverrideActive(incentiveApplication);
  const effectiveExchangeRateBDT = rateOverrideActive
    ? resolveEffectiveRateBDT(form, incentiveApplication)
    : (form.exchangeRateBDT || bdtPerUnit || 0);

  // Issue 46: live financial preview, computed with the SAME shared function the backend uses, so
  // what the admin sees while typing always matches what will actually be persisted on save.
  // R8: orderValueForeign is always the Packing List / Shipment Details items total now, not a free
  // input — and ttEntries feed in so the preview reflects the same TT-overrides-Order-Value rule
  // the backend applies.
  const liveFinancials = calculateShipmentFinancials({
    initialBalance,
    freightCost: form.freightCost, goodsCost: form.goodsCost, exportProcessingCost: form.exportProcessingCost,
    othersCost: form.othersCost, damage: form.damage, orderValueForeign: itemsTotalValue,
    exchangeRateBDT: effectiveExchangeRateBDT, incentive: form.incentive, ttEntries: form.ttEntries,
  });

  const addPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      // Resized client-side first — see resizeImageFile's own comment on why that matters on Vercel.
      const dataUrl = await resizeImageFile(file, { maxDimension: 1600, quality: 0.85 });
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'shipment-photos' }) });
      const data = await res.json();
      if (data.success) set('photos', [...(form.photos || []), { url: data.url, caption: '' }]);
      else toast.error(data.message || 'Photo upload failed');
    } catch (err) {
      toast.error(err.message || 'Photo upload failed');
    }
  };
  const updatePhotoCaption = (i, caption) => {
    const next = [...(form.photos || [])];
    next[i] = { ...next[i], caption };
    set('photos', next);
  };
  const removePhoto = (i) => set('photos', (form.photos || []).filter((_, idx) => idx !== i));

  // Batch 8 (R7): TT Configuration entry helpers — same add/update/remove-row shape as the photo
  // helpers just above.
  const addTTEntry = () => set('ttEntries', [...(form.ttEntries || []), { ttNumber: '', ttDate: '', ttValue: '' }]);
  const updateTTEntry = (i, field, value) => {
    const next = [...(form.ttEntries || [])];
    next[i] = { ...next[i], [field]: value };
    set('ttEntries', next);
  };
  const removeTTEntry = (i) => set('ttEntries', (form.ttEntries || []).filter((_, idx) => idx !== i));
  const ttEntriesTotal = (form.ttEntries || []).reduce((a, t) => a + (Number(t.ttValue) || 0), 0);

  const locked = incentiveApplication?.status === 'claimed';
  // R11/R18: Base Currency / Export Category / Export License / Export Contract specifically
  // define the grouping an Incentive Application shares — restricted the moment this shipment
  // belongs to ANY application (pending or claimed), matching the server-side guard in the
  // shipments PUT route. Every other field stays governed by `locked` alone (only claimed fully
  // locks the rest of the shipment).
  const groupingLocked = locked || !!incentiveApplication;
  const statusBadgeVariant = { draft: 'warning', active: 'info', completed: 'success', archived: 'default' }[form.status] || 'default';
  const statusBadgeLabel = { draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived' }[form.status] || form.status;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => router.push(form.exportContract ? `/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}/contracts/${form.exportContract}` : `/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}`)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? 'New Shipment' : form.shipmentNo}</h1>
            {!isNew && <Badge variant={statusBadgeVariant}>{statusBadgeLabel}</Badge>}
          </div>
          <p className="text-sm text-gray-500">{buyer?.name}</p>
        </div>
        {/* R2/R3: while still draft, two explicit actions — Save Draft keeps it a draft (never
            logged), Save & Activate is the one that flips it to active and starts the audit trail.
            Once active/completed/archived, a single Save covers every later edit. Locked (R13)
            shipments show no save action at all — see the banner below instead. */}
        {locked ? null : form.status === 'draft' ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => handleSave(false)} loading={saving} variant="secondary">Save Draft</Button>
            <Button onClick={() => handleSave(true)} loading={saving} variant="primary" icon={Save}>Save &amp; Activate</Button>
          </div>
        ) : (
          <Button onClick={() => handleSave(true)} loading={saving} variant="primary" icon={Save}>Save</Button>
        )}
      </div>

      {locked && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Locked — claimed by an Incentive Application</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              This shipment is part of <span className="font-semibold">"{incentiveApplication.title}"</span>, which has been marked as Incentive Claimed. It's read-only (including its BDT rate, now frozen) until that application is unclaimed.
            </p>
            <Link href={`/admin/export-dashboard/incentives/${incentiveApplication._id}`} className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline mt-1 inline-block">View the Incentive Application →</Link>
          </div>
        </div>
      )}

      {/* R11/R18: pending (not yet claimed) — everything else on the page stays editable, but
          these 4 specific cards are disabled since they define the grouping the Incentive
          Application shares (see the note on each disabled card, and the server-side guard in the
          shipments PUT route). Only shown when NOT also fully locked — the amber banner above
          already covers that. */}
      {groupingLocked && !locked && (
        <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2 mb-3 text-xs text-blue-700 dark:text-blue-400">
          Export Contract, Currency, Category &amp; License are locked while this shipment is part of{' '}
          <Link href={`/admin/export-dashboard/incentives/${incentiveApplication._id}`} className="font-semibold underline">{incentiveApplication.title}</Link> — everything else below stays editable.
        </div>
      )}

      {/* R1/R18: Export Contract / Base Currency / Export Category / Beneficiary Bank / Export
          License — a compact grid of small cards (2-across on mobile, 3-across on tablet,
          5-across on desktop), so picking all five costs a fraction of the vertical space 5
          stacked full-width banners would. Export Contract leads since it's the new top-level
          context (R18) that auto-fills Contract No / Currency / Category below it — same auto-
          fill-then-editable pattern as the other 4 cards. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileSignature className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 truncate">Export Contract</p>
          </div>
          <select value={form.exportContract} onChange={e => handleContractSelect(e.target.value)} disabled={groupingLocked} className="input-field py-1.5 text-xs font-bold w-full disabled:opacity-60">
            <option value="">— Select —</option>
            {exportContracts.map(c => <option key={c._id} value={c._id}>{c.contractNo}</option>)}
          </select>
          {exportContracts.length === 0 ? (
            <p className="text-[10px] text-amber-600 mt-1 leading-tight">None yet for this buyer — add one from its contracts page</p>
          ) : (
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 leading-tight">Auto-fills Contract No, Currency &amp; Category</p>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <p className="text-xs font-bold text-blue-800 dark:text-blue-300 truncate">Base Currency</p>
            <button onClick={refreshRate} disabled={rateLoading} className="ml-auto p-0.5 rounded text-blue-500 hover:bg-blue-100 transition-all flex-shrink-0" title="Refresh live rate">
              <RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <select value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} disabled={groupingLocked} className="input-field py-1.5 text-xs font-bold w-full disabled:opacity-60">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 leading-tight truncate" title={`1 USD = ${rate ? rate.toFixed(4) : '...'} ${form.baseCurrency}`}>
            1 USD = {rate ? rate.toFixed(4) : '...'} {form.baseCurrency} · set once
          </p>
        </div>

        {/* Requirement 10 + batch 7: drives this shipment's incentive calc, its shipment-list card
            image, AND which columns appear on Packing List / Buyer's Invoice / BD Invoice. */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
            <p className="text-xs font-bold text-purple-800 dark:text-purple-300 truncate">Export Category</p>
          </div>
          <select value={form.exportCategory} onChange={e => handleCategorySelect(e.target.value)} disabled={groupingLocked} className="input-field py-1.5 text-xs font-bold w-full disabled:opacity-60">
            <option value="">— Select —</option>
            {exportCategories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {exportCategories.length === 0 ? (
            <p className="text-[10px] text-amber-600 mt-1 leading-tight">None yet — <Link href="/admin/export-dashboard/categories" className="underline font-semibold">add one</Link></p>
          ) : (
            <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 leading-tight">Drives incentive &amp; document format</p>
          )}
        </div>

        {/* Requirement 6: auto-fills the 5 bank fields in the Shipment Details tab. */}
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Landmark className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
            <p className="text-xs font-bold text-cyan-800 dark:text-cyan-300 truncate">Beneficiary Bank</p>
          </div>
          <select value={form.bankAccount} onChange={e => handleBankSelect(e.target.value)} disabled={locked} className="input-field py-1.5 text-xs font-bold w-full disabled:opacity-60">
            <option value="">— Select —</option>
            {bankAccounts.map(b => <option key={b._id} value={b._id}>{b.beneficiaryBank}</option>)}
          </select>
          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-1 leading-tight">Auto-fills bank details below</p>
        </div>

        {/* Requirement 7: auto-fills TIN/BIN/REX No and this shipment's document letterhead. */}
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 truncate">Export License</p>
          </div>
          <select value={form.exportLicense} onChange={e => handleLicenseSelect(e.target.value)} disabled={groupingLocked} className="input-field py-1.5 text-xs font-bold w-full disabled:opacity-60">
            <option value="">— Select —</option>
            {exportLicenses.map(l => <option key={l._id} value={l._id}>{l.licenseName}</option>)}
          </select>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 leading-tight">Auto-fills TIN/BIN/REX &amp; letterhead</p>
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
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Packing List</h3>
                <p className="text-xs text-gray-400 mt-0.5">Read-only — mirrors the products table in Shipment Details</p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="packing" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} onEditText={openTextOverrideEditor} downloadingDoc={downloadingDoc} downloadFormat={downloadFormat} setDownloadFormat={setDownloadFormat} locked={locked} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Input label="Net Weight (kg) — auto" type="number" value={liveTotalNetWeightKg.toFixed(2)} disabled readOnly hint="Auto-filled: sum of Qty (kg) in Shipment Details' products table" className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
              <Input label="Total Carton — auto" type="number" value={liveTotalCTN} disabled readOnly hint="Auto-filled: sum of CTN in Shipment Details' products table" className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
              <div>
                <Input label="Gross Weight (kg)" type="number" min="0" value={displayGrossWeightKg}
                  onChange={e => setFormState(p => ({ ...p, totalGrossWeightKg: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)), grossWeightOverridden: true }))} />
                {/* Requirement 4: editing this never changes the estimate itself — just shown here
                    for reference, with a one-click way back to it. */}
                <p className="text-[11px] text-gray-400 mt-1">
                  Estimated: {liveEstimatedGrossWeightKg.toFixed(2)} kg
                  {form.grossWeightOverridden && (
                    <button type="button" onClick={() => setFormState(p => ({ ...p, grossWeightOverridden: false }))} className="ml-2 text-brand font-semibold hover:underline">Use estimated</button>
                  )}
                </p>
              </div>
              <Input label={`Freight Cost (${form.baseCurrency})`} type="number" min="0" value={form.freightCost} onChange={e => set('freightCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} hint="Same field as Shipment Details' Financial Analysis section" />
            </div>
            <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(selectedCategory, 'packingList')} currency={form.baseCurrency} salesTerm={form.salesTerm} />
          </div>
        )}

        {/* ── Buyer's Invoice — INDEPENDENT from BD Invoice ── */}
        {tab === 'buyer-invoice' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Buyer's Commercial Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">Read-only — mirrors the products table in Shipment Details</p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="buyer-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} onEditText={openTextOverrideEditor} downloadingDoc={downloadingDoc} downloadFormat={downloadFormat} setDownloadFormat={setDownloadFormat} locked={locked} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Net Weight</p><p className="font-bold text-gray-900 dark:text-white">{liveTotalNetWeightKg.toFixed(2)} kg</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Total CTN</p><p className="font-bold text-gray-900 dark:text-white">{liveTotalCTN}</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Gross Weight</p><p className="font-bold text-gray-900 dark:text-white">{Number(displayGrossWeightKg || 0).toFixed(2)} kg</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Freight Cost</p><p className="font-bold text-gray-900 dark:text-white">{form.freightCost || 0} {form.baseCurrency}</p></div>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 text-sm">
              <span className="text-blue-700 dark:text-blue-300 font-semibold">Currency: {form.baseCurrency}</span>
              <span className="text-blue-500">1 USD = {rate ? rate.toFixed(4) : '...'} {form.baseCurrency}</span>
            </div>
            <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(selectedCategory, 'buyerInvoice')} currency={form.baseCurrency} salesTerm={form.salesTerm} />
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-semibold text-green-700">
              Total Invoice Value: {itemsTotalValue.toFixed(2)} {form.baseCurrency}
              <span className="ml-3 text-xs text-gray-500 font-normal">≈ USD {rate ? (itemsTotalValue / rate).toFixed(2) : '...'}</span>
            </div>
          </div>
        )}

        {/* ── BD Invoice — seeded once from Shipment Details' totals, then independently editable
             in Category mode; a live direct mirror of Shipment Details in Product mode (R33-1) ── */}
        {tab === 'bd-invoice' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">BD Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isBdProductMode
                    ? 'Product HS Code mode — one row per product, always mirroring Shipment Details directly'
                    : form.bdItemsLocked
                      ? 'Manually edited — no longer follows Shipment Details automatically'
                      : "Automatically follows Shipment Details' totals — edit a row below to take manual control"}
                </p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="bd-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} onEditText={openTextOverrideEditor} downloadingDoc={downloadingDoc} downloadFormat={downloadFormat} setDownloadFormat={setDownloadFormat} locked={locked} />
              </div>
            </div>

            {/* Batch 19 (R33-1): the HS Code mode toggle. Lives in its own small toolbar rather than
                literally inside a <th> — Category and Product mode render two structurally
                different tables (BdInvoiceTable's editable rows vs. ReadOnlyItemsView's read-only
                mirror of Shipment Details), so there's no single header cell that persists across
                both to put a dropdown inside. Positioned directly above the table it controls so
                the connection to "the HS Code column's behavior" stays clear regardless. */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900">
              <label className="text-sm font-semibold text-blue-800 dark:text-blue-300 whitespace-nowrap">HS Code Mode:</label>
              <select
                value={form.bdHsCodeMode}
                onChange={e => set('bdHsCodeMode', e.target.value)}
                className="input-field py-1.5 text-sm w-auto"
                disabled={locked}
              >
                <option value="category">Category HS Code (default)</option>
                <option value="product">Product HS Code</option>
              </select>
              <p className="text-xs text-blue-600 dark:text-blue-400 flex-1">
                {isBdProductMode
                  ? 'Every product shown individually, each with its own HS code.'
                  : 'Products grouped by category, one HS code per category.'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Net Weight</p><p className="font-bold text-gray-900 dark:text-white">{liveTotalNetWeightKg.toFixed(2)} kg</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Total CTN</p><p className="font-bold text-gray-900 dark:text-white">{liveTotalCTN}</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Gross Weight</p><p className="font-bold text-gray-900 dark:text-white">{Number(displayGrossWeightKg || 0).toFixed(2)} kg</p></div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Freight Cost</p><p className="font-bold text-gray-900 dark:text-white">{form.freightCost || 0} {form.baseCurrency}</p></div>
            </div>

            {/* R3/R4: "IF any of these value doesn't match... mark the value in red and show error
                message where the value is not matching." Can only ever fire once bdItemsLocked is
                true — while auto-syncing, BD Invoice is computed to always exactly equal these
                totals, so there's nothing to mismatch. */}
            {bdMismatches.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm font-bold text-red-700 dark:text-red-400">⚠ Doesn't match Shipment Details</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {bdMismatches.map((m, i) => <li key={i} className="text-xs text-red-600 dark:text-red-400">{m}</li>)}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 text-sm flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-green-700 dark:text-green-300 font-semibold">Currency: {form.baseCurrency}</span>
                <span className="text-green-500">1 USD = {rate ? rate.toFixed(4) : '...'} {form.baseCurrency}</span>
                {/* Batch 19 (R33-1): Locked/Auto-syncing is a Category-mode-only concept — Product
                    mode is always a live, un-lockable mirror of Shipment Details, same as Packing
                    List/Buyer's Invoice, so there's nothing here to lock or re-fill. */}
                {!isBdProductMode && (form.bdItemsLocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">🔒 Locked</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">🔄 Auto-syncing</span>
                ))}
              </div>
              {!isBdProductMode && (
                <button onClick={handleReseedBd} className="text-xs text-brand hover:underline font-semibold whitespace-nowrap">↻ Re-fill from Shipment Details</button>
              )}
            </div>
            {isBdProductMode ? (
              <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(selectedCategory, 'bdInvoice')} currency={form.baseCurrency} salesTerm={form.salesTerm} />
            ) : (
              <BdInvoiceTable items={form.bdItems} onChange={setBdItems} columns={getDocumentColumns(selectedCategory, 'bdInvoice')} currency={form.baseCurrency} salesTerm={form.salesTerm} />
            )}
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-semibold text-green-700">
              Total BD Invoice Value: {bdTotalValue.toFixed(2)} {form.baseCurrency}
              <span className="ml-3 text-xs text-gray-500 font-normal">≈ USD {rate ? (bdTotalValue / rate).toFixed(2) : '...'}</span>
            </div>
          </div>
        )}

        {/* ── Other Details ── */}
        {tab === 'details' && (
          <div className="space-y-5">
            {/* Requirement 9: relocated here from its old always-visible spot above the tabs —
                requirement 7's own wording ("The TIN and BIN fields of Shipment Details tab...")
                already treats these identifiers as living inside this tab. */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Shipment Identifiers</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Shipment No" value={form.shipmentNo} onChange={e => set('shipmentNo', e.target.value)} />
                <Input label="Contract No" value={form.contractNo} onChange={e => set('contractNo', e.target.value)} />
                <Input label="Invoice No" value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} />
                <Input label="Shipment Date" type="date" value={form.dateStr} onChange={e => set('dateStr', e.target.value)} />
                <Input label="TIN" value={form.tinNo} onChange={e => set('tinNo', e.target.value)} />
                <Input label="BIN" value={form.binNo} onChange={e => set('binNo', e.target.value)} />
                <Input label="ERC" value={form.ercNo} onChange={e => set('ercNo', e.target.value)} />
                <Input label="EXP No" value={form.expNo} onChange={e => set('expNo', e.target.value)} hint="Enter the full EXP number as issued (year included, e.g. 000367/2026) — nothing is appended to this automatically" />
                <Input label="EXP Date" type="date" value={form.expDateStr} onChange={e => set('expDateStr', e.target.value)} />
                <Input label="AWB No" value={form.awbNo} onChange={e => set('awbNo', e.target.value)} />
                <Input label="AWB Date" type="date" value={form.awbDateStr} onChange={e => set('awbDateStr', e.target.value)} />
                <Input label="PC No" value={form.pcNo} onChange={e => set('pcNo', e.target.value)} />
                <Input label="PC Date" type="date" value={form.pcDateStr} onChange={e => set('pcDateStr', e.target.value)} />
                <Input label="REX No" value={form.rexNo} onChange={e => set('rexNo', e.target.value)} hint="Used in the Buyer's Invoice declaration as BDREX + this number" />
              </div>
            </div>

            {/* Batch 7 (R1) — read-only reference: Exporter comes from Settings (edited on the
                Export Dashboard home page, a single company-wide identity), Importer comes from
                this shipment's Buyer record. Both are genuine source-of-truth elsewhere, so they're
                shown here rather than re-entered, with a link to where each is actually managed. */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Exporter &amp; Importer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Exporter Name</p>
                  <p className="text-sm text-gray-900 dark:text-white">{exporterInfo.exporterName || 'Shah International'}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-2 mb-1">Exporter Address</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{exporterInfo.exporterAddress || '—'}</p>
                  <Link href="/admin/export-dashboard" className="text-[11px] text-brand hover:underline mt-2 inline-block">Edit on Export Dashboard home →</Link>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Importer Name (Buyer's Company)</p>
                  <p className="text-sm text-gray-900 dark:text-white">{buyer?.name || '—'}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-2 mb-1">Importer Address</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{buyer?.address || '—'}</p>
                  <Link href={`/admin/export-dashboard/countries/${countryId}/buyers/${buyerId}`} className="text-[11px] text-brand hover:underline mt-2 inline-block">Edit buyer details →</Link>
                </div>
              </div>
            </div>

            {/* Batch 7 — moved here from the old Packing List tab: these describe the shipment
                itself, not any one document, so they belong on the master tab. */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Logistics</h3>
              {/* Requirement 5: each field suggests the admin's saved Settings → Shipment
                  Configuration options via a plain HTML datalist — still a free-text input, so a
                  one-off value this shipment needs doesn't require adding it to Settings first. */}
              <datalist id="opt-modeOfCarrying">{shipmentOptions.modeOfCarrying.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="opt-landingPort">{shipmentOptions.landingPort.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="opt-portOfDischarge">{shipmentOptions.portOfDischarge.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="opt-finalDestination">{shipmentOptions.finalDestination.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="opt-salesTerm">{shipmentOptions.salesTerm.map(v => <option key={v} value={v} />)}</datalist>
              <datalist id="opt-countryOfOrigin">{shipmentOptions.countryOfOrigin.map(v => <option key={v} value={v} />)}</datalist>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="Mode of Carrying" list="opt-modeOfCarrying" value={form.modeOfCarrying} onChange={e => set('modeOfCarrying', e.target.value)} />
                <Input label="Landing Port" list="opt-landingPort" value={form.landingPort} onChange={e => set('landingPort', e.target.value)} />
                <Input label="Port of Discharge" list="opt-portOfDischarge" value={form.portOfDischarge} onChange={e => set('portOfDischarge', e.target.value)} />
                <Input label="Final Destination" list="opt-finalDestination" value={form.finalDestination} onChange={e => set('finalDestination', e.target.value)} />
                <Input label="Sales Term" list="opt-salesTerm" value={form.salesTerm} onChange={e => set('salesTerm', e.target.value)} placeholder="CFR, France" />
                <Input label="Country of Origin" list="opt-countryOfOrigin" value={form.countryOfOrigin} onChange={e => set('countryOfOrigin', e.target.value)} />
              </div>
            </div>

            {/* Batch 7 — moved here from the old BD Invoice tab (R1 now lists these as Shipment
                Details fields); the picker above the tabs still drives the auto-fill. */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Bank Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="Beneficiary Bank" value={form.beneficiaryBank} onChange={e => set('beneficiaryBank', e.target.value)} />
                <Input label="Bank Account No" value={form.accountNo} onChange={e => set('accountNo', e.target.value)} />
                <Input label="Branch" value={form.branchName} onChange={e => set('branchName', e.target.value)} />
                <Input label="Bank Address" value={form.bankAddress} onChange={e => set('bankAddress', e.target.value)} />
                <Input label="Routing No" value={form.routingNo} onChange={e => set('routingNo', e.target.value)} />
                <Input label="SWIFT Code" value={form.swiftCode} onChange={e => set('swiftCode', e.target.value)} />
              </div>
            </div>

            {/* Requirement 4: "the estimated gross weight will be calculated automatically and
                will be saved in the [Shipment Details] tab" — shown here for reference alongside
                where it's actually used (the editable Gross Weight field lives on the Packing List
                tab, since that's what feeds the documents). */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Estimated Gross Weight</p>
                <p className="text-xs text-gray-400">Auto-calculated: total CTN weight (from the products table below) + total net weight</p>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{liveEstimatedGrossWeightKg.toFixed(2)} kg</p>
            </div>

            {/* Batch 7 (R1) — THE master table. Everything on Packing List, Buyer's Invoice, and
                BD Invoice's seed comes from here — entered once, never re-typed per document. */}
            <div>
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Products</h3>
                <p className="text-xs text-gray-400 mt-0.5">The single source of truth — Packing List and Buyer's Invoice mirror this table exactly; BD Invoice starts from its totals</p>
              </div>
              <ItemsTable items={form.items} onChange={v => set('items', v)} currency={form.baseCurrency} ctnConfigs={ctnConfigs} />
            </div>

            {/* Batch 17 (R1/R2): live per-product-category totals, computed from the table above via
                computeCategoryBreakdown (lib/exportColumns.js) — the exact same helper BD Invoice's
                auto-seed uses, so the two can never disagree with each other. */}
            <div>
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Category Wise Product Details</h3>
                <p className="text-xs text-gray-400 mt-0.5">Auto-calculated from the Products table above, grouped by each product's own catalog category</p>
              </div>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">Add products above to see category-wise totals</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-xs" style={{ minWidth: '640px' }}>
                    <thead>
                      <tr className="bg-gray-900 text-white">
                        <th className="px-3 py-2.5 text-left">Product Category</th>
                        <th className="px-3 py-2.5 text-right">Total CTN</th>
                        <th className="px-3 py-2.5 text-right">Total CTN Wt (kg)</th>
                        <th className="px-3 py-2.5 text-right">Qty (kg)</th>
                        <th className="px-3 py-2.5 text-right">Avg Price ({form.baseCurrency})</th>
                        <th className="px-3 py-2.5 text-right">Total ({form.baseCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map(g => (
                        <tr key={g.category} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200">{g.category}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{g.totalCTN}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{g.totalCtnWeightKg.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{g.quantityKg.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{g.avgPrice.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{g.totalValue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 text-white font-bold">
                        <td className="px-3 py-2.5 text-right">Grand Total :</td>
                        <td className="px-3 py-2.5 text-right">{liveTotalCTN}</td>
                        <td className="px-3 py-2.5 text-right">{liveTotalCtnWeightKg.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">{liveTotalNetWeightKg.toFixed(1)}</td>
                        <td className="px-3 py-2.5 text-right">{liveShipmentAveragePrice.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-green-400">{itemsTotalValue.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <h3 className="font-bold text-gray-900 dark:text-white">Financial Details & Profit Analysis</h3>
            <p className="text-xs text-gray-500 -mt-3">Enter the raw costs below — Order Value, Total Cost, Receive Amount, Available Balance, Shipment Margin, and Net Profit are all calculated automatically (issue 46) using the persisted Initial Balance ({initialBalance.toFixed(2)} BDT, set from the Export Analytics dashboard).</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label={`Freight Cost (${form.baseCurrency})`} type="number" min="0" disabled={locked} value={form.freightCost} onChange={e => set('freightCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Goods Cost (BDT)" type="number" min="0" disabled={locked} value={form.goodsCost} onChange={e => set('goodsCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Export Processing Cost (BDT)" type="number" min="0" disabled={locked} value={form.exportProcessingCost} onChange={e => set('exportProcessingCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Others / Logistics / Labour (BDT)" type="number" min="0" disabled={locked} value={form.othersCost} onChange={e => set('othersCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              <Input label="Damage (BDT)" type="number" min="0" disabled={locked} value={form.damage} onChange={e => set('damage', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              {/* R8: Order Value is no longer typed in — it's always exactly the Packing List /
                  Shipment Details items total, in the shipment's base currency. Shown read-only,
                  matching the "auto" fields further down, rather than as an editable Input. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Order Value ({form.baseCurrency}) — auto</label>
                <div className="input-field bg-gray-50 dark:bg-gray-800/60 font-semibold text-gray-700 dark:text-gray-200 flex items-center">{itemsTotalValue.toFixed(2)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-50/70 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Cost (BDT) — auto</p>
                <p className="font-bold text-gray-900 dark:text-white">{liveFinancials.totalCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Receive Amount (BDT) — auto</p>
                <p className="font-bold text-gray-900 dark:text-white">{liveFinancials.receiveAmountBDT.toFixed(2)}</p>
                {/* R8: makes it visible at a glance whether Order Value or the TT total is currently
                    driving this figure — same rule Export Analytics applies for this shipment. */}
                <p className="text-[10px] text-gray-400 mt-0.5">{liveFinancials.usingTTForReceiveAmount ? 'from TT total' : 'from Order Value'}</p>
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

            {/* R6/R7: TT Configuration — Rate in BDT (renamed from "Rate in BDT (live)") and
                Incentive moved here from Financial Details above; plus every TT entry the admin
                logs against this shipment (R8: their sum overrides Order Value for Receive Amount
                the moment any entry has a value — see the note next to it above). */}
            <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <h3 className="font-bold text-gray-900 dark:text-white">TT Configuration</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Rate in BDT and Incentive, plus every telegraphic transfer received against this shipment.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Input label="Rate in BDT" type="number" min="0" disabled={locked || rateOverrideActive}
                    value={rateOverrideActive ? effectiveExchangeRateBDT.toFixed(2) : (form.exchangeRateBDT || (bdtPerUnit ? bdtPerUnit.toFixed(2) : ''))}
                    onChange={e => set('exchangeRateBDT', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
                  {rateOverrideActive && (
                    <p className="text-[10px] text-amber-600 mt-1 leading-tight">
                      Set by Incentive Application "{incentiveApplication.title}" — <Link href={`/admin/export-dashboard/incentives/${incentiveApplication._id}`} className="underline">edit there</Link>
                    </p>
                  )}
                </div>
                <Input label="Incentive (BDT)" type="number" min="0" disabled={locked} value={form.incentive} onChange={e => set('incentive', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Telegraphic Transfers (TT)</p>
                  {!locked && <Button onClick={addTTEntry} variant="ghost" size="xs" icon={Plus}>Add TT</Button>}
                </div>
                {(form.ttEntries || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No TT entries yet — Receive Amount (BDT) uses Order Value until at least one is added here.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-gray-500 px-1">
                      <span>TT Number</span><span>TT Date</span><span>TT Value ({form.baseCurrency})</span><span></span>
                    </div>
                    {form.ttEntries.map((t, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                        <input value={t.ttNumber || ''} disabled={locked} onChange={e => updateTTEntry(i, 'ttNumber', e.target.value)} className="input-field py-1.5 text-sm disabled:opacity-60" placeholder="TT No." />
                        <input type="date" value={t.ttDate ? new Date(t.ttDate).toISOString().slice(0, 10) : ''} disabled={locked} onChange={e => updateTTEntry(i, 'ttDate', e.target.value)} className="input-field py-1.5 text-sm disabled:opacity-60" />
                        <input type="number" min="0" value={t.ttValue ?? ''} disabled={locked} onChange={e => updateTTEntry(i, 'ttValue', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} className="input-field py-1.5 text-sm disabled:opacity-60" placeholder="0.00" />
                        {!locked && <button onClick={() => removeTTEntry(i)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    ))}
                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Total TT: {ttEntriesTotal.toFixed(2)} {form.baseCurrency}<span className="text-xs font-normal text-green-600 ml-2">— now driving Receive Amount (BDT)</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* R2/R3: draft→active happens only via the Save Draft / Save & Activate buttons in
                  the header — this dropdown no longer offers 'draft' at all once a shipment has
                  left it, so a shipment already being logged can never be quietly walked back into
                  an unlogged state. Manually marking a shipment Completed/Archived outside the
                  Incentive workflow is still supported, same as before this batch. */}
              {form.status !== 'draft' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} disabled={locked} className="input-field text-sm disabled:opacity-60">
                    {['active', 'completed', 'archived'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
              <textarea rows={3} disabled={locked} value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field resize-none disabled:opacity-60" />
            </div>
            {/* Additional document uploads */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Additional Documents</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer text-sm text-gray-500 hover:border-brand hover:text-brand transition-all w-fit">
                <Upload className="w-4 h-4" /> Upload Document (PDF/Image)
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  // resizeImageFile only applies to actual images (it rejects anything else) — a
                  // PDF goes through as before, unresized; see its own comment for why images do.
                  const toDataUrl = file.type?.startsWith('image/')
                    ? resizeImageFile(file, { maxDimension: 1600, quality: 0.85 })
                    : new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(file);
                      });
                  toDataUrl.then(async (dataUrl) => {
                    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl, folder: 'shipment-docs' }) });
                    const data = await res.json();
                    if (data.success) { set('additionalDocs', [...(form.additionalDocs || []), { name: file.name, url: data.url }]); toast.success('Uploaded'); }
                    else toast.error(data.message || 'Upload failed');
                  }).catch((err) => toast.error(err.message || 'Upload failed'));
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

            {/* Batch 7 — moved here from the old Packing List tab (issue 43): shipment-wide
                reference photos, not tied to any one printed document. */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Photos</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer text-sm text-gray-500 hover:border-brand hover:text-brand transition-all w-fit">
                <Upload className="w-4 h-4" /> Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={addPhoto} />
              </label>
              {(form.photos || []).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {form.photos.map((photo, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.caption || `Shipment photo ${i + 1}`} className="w-full h-28 object-cover" />
                      <div className="p-2">
                        <input value={photo.caption || ''} onChange={e => updatePhotoCaption(i, e.target.value)} placeholder="Caption (optional)" className="input-field py-1 text-xs w-full" />
                        <button onClick={() => removePhoto(i)} className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* R2/R3: mirrors the header's Save Draft / Save & Activate / Save logic exactly — this footer
          button previously always called handleSave() with no argument (activate=undefined), which
          would have silently kept every save as a draft-preserving save forever, never activating a
          shipment. Locked (R13) shipments show neither header nor footer save controls. */}
      {!locked && (
        <div className="mt-4 flex justify-end gap-2">
          {form.status === 'draft' && <Button onClick={() => handleSave(false)} loading={saving} variant="secondary" size="lg">Save Draft</Button>}
          <Button onClick={() => handleSave(true)} loading={saving} variant="primary" icon={Save} size="lg">{form.status === 'draft' ? 'Save & Activate' : 'Save Shipment'}</Button>
        </div>
      )}

      {/* R5: Edit hardcoded document text — declaration paragraph + signatory title, per document
          type, before downloading or printing. */}
      <Modal isOpen={!!editingDocType} onClose={() => setEditingDocType(null)} title={`Edit Text — ${editingDocType ? docTypeLabel(editingDocType) : ''}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Declaration paragraph</label>
            <textarea rows={6} value={textDraft.declaration} onChange={e => setTextDraft(p => ({ ...p, declaration: e.target.value }))} className="input-field resize-none text-sm" />
          </div>
          <Input label="Signatory title" value={textDraft.signatoryTitle} onChange={e => setTextDraft(p => ({ ...p, signatoryTitle: e.target.value }))} />
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setTextDraft({ declaration: DEFAULT_DOCUMENT_TEXT[docTextKey(editingDocType)].declaration, signatoryTitle: DEFAULT_DOCUMENT_TEXT[docTextKey(editingDocType)].signatoryTitle })}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Reset to default
            </button>
            <div className="flex gap-2">
              <Button onClick={() => setEditingDocType(null)} variant="secondary">Cancel</Button>
              <Button onClick={handleSaveTextOverride} loading={savingText} variant="primary">Save</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
