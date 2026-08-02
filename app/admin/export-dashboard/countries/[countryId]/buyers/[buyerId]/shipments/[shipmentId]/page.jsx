'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Printer, FileText, Upload, Save, Package, ReceiptText, Globe, MoreHorizontal, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import ProductNameCombobox from '@/components/admin/ProductNameCombobox';
import { generateShipmentDocPDF, docTypeLabel } from '@/lib/exportDocuments';
import { calculateShipmentFinancials } from '@/lib/utils';
import { AVAILABLE_COLUMNS, COLUMN_LABELS, DOC_LABELS, columnHeaderLabel, getDocumentColumns, shouldShowBdHsCode, avgPrice, shipmentAveragePrice } from '@/lib/exportColumns';
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
    const fields = { productName: product.name, botanicalName: product.scientificName || '' };
    if (product.hsCode) fields.hsCode = product.hsCode;
    updateFields(i, fields);
  };

  const addRow = () => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: '', botanicalName: '', hsCode: '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
  };
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));
  const addFromProduct = (product) => {
    const slNo = items.length + 1;
    onChange([...items, { slNo, productName: product.name, botanicalName: product.scientificName || '', hsCode: product.hsCode || '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }]);
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

function ReadOnlyItemsView({ items, columns, currency = 'EUR' }) {
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
            {columns.map(k => <th key={k} className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH[k] || 'w-28'}`}>{columnHeaderLabel(k, currency)}</th>)}
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
// one field specifically. H.S. Code renders as a second line under the product name, not its own
// column — that's how it appears on the actual reference invoice.
function BdInvoiceTable({ items, onChange, columns, showHsCode, currency = 'EUR' }) {
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
  if (!items.length) return <p className="text-sm text-gray-400 italic py-6 text-center">Pick an Export Category and add products in Shipment Details — this table seeds itself from there automatically</p>;
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
              <th className="px-3 py-2.5 text-left w-52">Name of Products (Botanical Name)</th>
              {has('totalCTN') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.totalCTN}`}>Total CTN</th>}
              {has('quantityKg') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.quantityKg}`}>Quantity KG</th>}
              {has('unitPrice') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.unitPrice}`}>{columnHeaderLabel('unitPrice', currency)}</th>}
              {has('averagePrice') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.averagePrice}`}>{columnHeaderLabel('averagePrice', currency)}</th>}
              {has('totalValue') && <th className={`px-3 py-2.5 text-right whitespace-nowrap ${DOC_COLUMN_WIDTH.totalValue}`}>{columnHeaderLabel('totalValue', currency)}</th>}
              <th className="w-9"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 text-center text-gray-500 font-medium">{i + 1}</td>
                <td className="px-2 py-2">
                  <input value={item.productName || ''} onChange={e => updateRow(i, 'productName', e.target.value)} className="input-field py-1.5 text-xs w-full mb-1.5" placeholder="e.g. Vegetables & Fruits" />
                  {showHsCode && <input value={item.hsCode || ''} onChange={e => updateRow(i, 'hsCode', e.target.value)} className="input-field py-1.5 text-xs w-full" placeholder="H.S Code" />}
                </td>
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
const EMPTY = () => Array.from({ length: 3 }, (_, i) => ({ slNo: i + 1, productName: '', botanicalName: '', hsCode: '', ctnSizeKg: '', totalCTN: '', totalCtnWeightKg: '', quantityKg: '', unitPrice: '', totalValue: '' }));

export default function ShipmentDetailPage() {
  const { countryId, buyerId, shipmentId } = useParams();
  const router = useRouter();
  const isNew = shipmentId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [buyer, setBuyer] = useState(null);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState(0);
  // Batch 7 (R1) — read-only reference, sourced from Settings (edited on the Export Dashboard home
  // page, not per-shipment — see app/admin/export-dashboard/page.jsx).
  const [exporterInfo, setExporterInfo] = useState({ exporterName: 'Shah International', exporterAddress: '' });
  const [uploadingLH, setUploadingLH] = useState(false);
  const [docStyle, setDocStyle] = useState('letterhead'); // 'letterhead' | 'plain' — shared by Print & Download, all 3 doc types
  const [downloadingDoc, setDownloadingDoc] = useState(null); // which baseDocType is currently generating a PDF, or null

  // Settings-driven config, fetched once on mount (see loadConfig below) — CTN Configuration
  // (requirement 2/3/4), Bank Accounts (6), Export Licenses (7), Export Categories (8/10), and the
  // 6 shipment-field option lists (5).
  const [ctnConfigs, setCtnConfigs] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [exportLicenses, setExportLicenses] = useState([]);
  const [exportCategories, setExportCategories] = useState([]);
  const [shipmentOptions, setShipmentOptions] = useState({ modeOfCarrying: [], landingPort: [], portOfDischarge: [], finalDestination: [], salesTerm: [], countryOfOrigin: [] });

  const [form, setFormState] = useState({
    shipmentNo: `SI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    contractNo: '', invoiceNo: '', dateStr: new Date().toISOString().slice(0, 10),
    baseCurrency: 'EUR',
    exportCategory: '', // requirement 10
    modeOfCarrying: 'By Air',
    landingPort: 'Hazrat Shahjalal International Airport',
    portOfDischarge: '', finalDestination: '', salesTerm: 'CFR',
    countryOfOrigin: 'Bangladesh',
    tinNo: '518591244958', binNo: '71367570202', ercNo: '260326210852625',
    expNo: '', awbNo: '', pcNo: '', rexNo: '', // R1: REX No, auto-fills from the License below
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
    notes: '', status: 'active', additionalDocs: [], photos: [],
  });
  const set = (k, v) => setFormState(p => ({ ...p, [k]: v }));

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
    const receiveBDT = (Number(form.orderValueForeign) || 0) * (Number(form.exchangeRateBDT) || 0);
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

  const { rate, bdtPerUnit, loading: rateLoading, refresh: refreshRate } = useLiveRate(form.baseCurrency);

  useEffect(() => {
    fetch(`/api/export/buyers/${buyerId}`).then(r => r.json()).then(d => setBuyer(d.buyer));
    // Company letterhead is a GLOBAL setting now (issue 39) — uploaded once, used for every shipment
    // until replaced, rather than re-uploaded per shipment. Always load the current one on mount.
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
    if (!isNew) {
      setLoading(true);
      fetch(`/api/export/shipments/${shipmentId}`).then(r => r.json()).then(d => {
        if (d.shipment) {
          const s = d.shipment;
          setFormState(p => ({
            ...p, ...s,
            dateStr: s.date ? new Date(s.date).toISOString().slice(0, 10) : '',
            items: s.items?.length ? s.items : EMPTY(),
            // Batch 7: no forced EMPTY() fallback here — a genuinely empty array lets the
            // auto-seed effect (below, after liveTotalCTN etc. are computed) know it's safe to
            // seed a fresh row; an old shipment's pre-existing (possibly multi-row) bdItems from
            // before this batch are left exactly as saved.
            bdItems: s.bdItems || [],
            photos: s.photos || [],
            // exportCategory/bankAccount/exportLicense come back POPULATED (full docs, for
            // convenience elsewhere) — these 3 selects need just the id as their value.
            exportCategory: s.exportCategory?._id || s.exportCategory || '',
            bankAccount: s.bankAccount?._id || s.bankAccount || '',
            exportLicense: s.exportLicense?._id || s.exportLicense || '',
            // Requirement 4: a shipment saved before this feature existed has
            // grossWeightOverridden left at its schema default (false) with a totalGrossWeightKg
            // an admin may have carefully set by hand — without this, the very first time such a
            // shipment is opened, the auto-sync effect below would treat it as "never touched" and
            // silently replace that value with a freshly computed estimate. Any already-set,
            // non-empty Gross Weight is treated as intentional unless the shipment explicitly says
            // otherwise.
            grossWeightOverridden: s.grossWeightOverridden === true || !!s.totalGrossWeightKg,
          }));
        }
        setLoading(false);
      });
    }
  }, [shipmentId, buyerId, isNew]);

  const handleSave = async () => {
    setSaving(true);
    // Auto-fill totals from the master products table (Shipment Details tab)
    const totalCTN = form.items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
    const totalNetWeightKg = form.items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
    const payload = {
      ...form,
      buyer: buyerId, country: countryId,
      date: form.dateStr ? new Date(form.dateStr) : new Date(),
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
      // Requirement 7: the selected Export License's own letterhead (populated on this fresh
      // fetch) takes priority over the global company one, falling back to it if no license is
      // selected or the license somehow has none.
      const effectiveLetterheadUrl = d.shipment.exportLicense?.letterheadUrl || letterheadUrl;
      const pdf = await generateShipmentDocPDF({ docType, shipment: d.shipment, buyer: d.shipment.buyer, letterheadUrl: effectiveLetterheadUrl, exporterInfo });
      pdf.save(`${docTypeLabel(baseDocType).replace(/\s+/g, '-')}-${d.shipment.shipmentNo || shipmentId}.pdf`);
    } catch {
      toast.error('Could not generate the PDF — try Print instead');
    } finally {
      setDownloadingDoc(null);
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

  // R4: BD Invoice's row is computed fresh from the Export Category + these totals. totalValue is
  // seeded from the EXACT itemsTotalValue, not quantityKg × the rounded (2dp) display unit price —
  // multiplying a rounded per-kg price back out across a potentially large quantity can drift well
  // past MISMATCH_TOLERANCE (e.g. a 0.005 rounding error × 2000kg = 10, not 0.01), which would
  // falsely flag an auto-synced row as "mismatched" even though the admin hasn't touched anything.
  // Once the admin actually edits qty or price themselves, BdInvoiceTable's updateRow correctly
  // switches to computing totalValue as qty × price from then on (that row is no longer auto-synced
  // at that point anyway — see setBdItems below).
  const seedBdItemsFromShipment = () => {
    const unitPrice = +(liveShipmentAveragePrice || 0).toFixed(2);
    const quantityKg = liveTotalNetWeightKg || '';
    return [{
      slNo: 1,
      productName: selectedCategory?.name || '',
      hsCode: selectedCategory?.hsCode || '',
      totalCTN: liveTotalCTN || '',
      quantityKg,
      unitPrice: unitPrice || '',
      totalValue: +itemsTotalValue.toFixed(2),
    }];
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
  useEffect(() => {
    if (loading || form.bdItemsLocked) return;
    const hasSomethingToShow = !!form.exportCategory || liveTotalCTN > 0;
    const next = hasSomethingToShow ? seedBdItemsFromShipment() : [];
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
  }, [loading, form.bdItemsLocked, form.exportCategory, liveTotalCTN, liveTotalNetWeightKg, liveShipmentAveragePrice, itemsTotalValue]);

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
  // disagree either. The one place a real mismatch CAN happen is BD Invoice, since R4 explicitly
  // makes its rows independently admin-editable after the initial seed — so that's what this
  // actually checks.
  const bdTotalCTN = form.bdItems.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const bdTotalQty = form.bdItems.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const bdTotalValue = form.bdItems.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);
  const bdHasData = form.bdItems.some(r => r.productName);
  const MISMATCH_TOLERANCE = 0.01;
  const bdMismatches = [];
  if (bdHasData) {
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

      {/* Requirement 10 + batch 7: Export Category — drives this shipment's incentive calc, the
          image shown on the buyer's shipment list, AND (batch 7) which columns appear on this
          shipment's Packing List / Buyer's Invoice / BD Invoice — see /admin/export-dashboard/categories.
          Positioned right after Base Currency, matching the sequence the requirements themselves
          describe (currency → category → bank → license), and because it's now the dashboard's
          central concept — picking it early shapes everything else on this page. */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-purple-800 dark:text-purple-300">Export Category</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Drives this shipment's incentive calculation, its shipment-list card image, and its Packing List / Buyer's Invoice / BD Invoice document format</p>
        </div>
        <div>
          <select value={form.exportCategory} onChange={e => handleCategorySelect(e.target.value)} className="input-field py-2 text-sm font-bold w-auto min-w-[220px]">
            <option value="">— Select Export Category —</option>
            {exportCategories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {exportCategories.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              None yet — <Link href="/admin/export-dashboard/categories" className="underline font-semibold">add one here</Link>
            </p>
          )}
        </div>
      </div>

      {/* Requirement 6: Bank Account — auto-fills the 5 bank fields in the Shipment Details tab. */}
      <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-cyan-800 dark:text-cyan-300">Beneficiary Bank</p>
          <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-0.5">Auto-fills Account No, Branch, Bank Address, Routing No &amp; SWIFT Code in the Shipment Details tab below — still editable there afterward</p>
        </div>
        <select value={form.bankAccount} onChange={e => handleBankSelect(e.target.value)} className="input-field py-2 text-sm font-bold w-auto min-w-[220px]">
          <option value="">— Select Bank Account —</option>
          {bankAccounts.map(b => <option key={b._id} value={b._id}>{b.beneficiaryBank}</option>)}
        </select>
      </div>

      {/* Requirement 7: Export License — auto-fills TIN/BIN/REX No below and this shipment's
          document letterhead (takes priority over the global company letterhead once selected). */}
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Export License</p>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">Auto-fills TIN, BIN &amp; REX No below, and becomes the letterhead used on this shipment's documents</p>
        </div>
        <select value={form.exportLicense} onChange={e => handleLicenseSelect(e.target.value)} className="input-field py-2 text-sm font-bold w-auto min-w-[220px]">
          <option value="">— Select Export License —</option>
          {exportLicenses.map(l => <option key={l._id} value={l._id}>{l.licenseName}</option>)}
        </select>
      </div>

      {/* Letterhead upload — a GLOBAL company setting (issue 39): upload once here, it's reused on
          every shipment's printed/downloaded documents until it's replaced again. Also manageable
          from the main Export Dashboard page without opening any specific shipment. */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Company Letterhead (fallback when no Export License is selected)</p>
          <p className="text-xs text-amber-600 mt-0.5">Upload once (PNG/JPG) — used on every shipment's documents by default. Once a shipment has an Export License selected above, that license's own letterhead is used instead.</p>
          {letterheadUrl && <p className="text-xs text-green-600 mt-1">✓ Currently set</p>}
        </div>
        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-amber-300 rounded-xl cursor-pointer text-sm font-medium text-amber-700 hover:bg-amber-50 transition-all">
          <Upload className="w-4 h-4" /> {uploadingLH ? 'Uploading...' : letterheadUrl ? 'Replace Company Letterhead' : 'Upload Company Letterhead'}
          <input type="file" accept="image/*" onChange={handleLetterheadUpload} className="hidden" disabled={uploadingLH} />
        </label>
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
                <DocActionBar baseDocType="packing" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
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
            <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(selectedCategory, 'packingList')} currency={form.baseCurrency} />
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
                <DocActionBar baseDocType="buyer-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
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
            <ReadOnlyItemsView items={form.items} columns={getDocumentColumns(selectedCategory, 'buyerInvoice')} currency={form.baseCurrency} />
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm font-semibold text-green-700">
              Total Invoice Value: {itemsTotalValue.toFixed(2)} {form.baseCurrency}
              <span className="ml-3 text-xs text-gray-500 font-normal">≈ USD {rate ? (itemsTotalValue / rate).toFixed(2) : '...'}</span>
            </div>
          </div>
        )}

        {/* ── BD Invoice — seeded once from Shipment Details' totals, then independently editable;
             that's exactly what the mismatch banner below is watching for (R3/R4) ── */}
        {tab === 'bd-invoice' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">BD Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.bdItemsLocked
                    ? 'Manually edited — no longer follows Shipment Details automatically'
                    : "Automatically follows Shipment Details' totals — edit a row below to take manual control"}
                </p>
              </div>
              <div className="flex gap-2">
                <DocActionBar baseDocType="bd-invoice" docStyle={docStyle} setDocStyle={setDocStyle} onPrint={handlePrint} onDownload={handleDownload} downloadingDoc={downloadingDoc} />
              </div>
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
                {form.bdItemsLocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">🔒 Locked</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">🔄 Auto-syncing</span>
                )}
              </div>
              <button onClick={handleReseedBd} className="text-xs text-brand hover:underline font-semibold whitespace-nowrap">↻ Re-fill from Shipment Details</button>
            </div>
            <BdInvoiceTable items={form.bdItems} onChange={setBdItems} columns={getDocumentColumns(selectedCategory, 'bdInvoice')} showHsCode={shouldShowBdHsCode(selectedCategory)} currency={form.baseCurrency} />
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

            <h3 className="font-bold text-gray-900 dark:text-white">Financial Details & Profit Analysis</h3>
            <p className="text-xs text-gray-500 -mt-3">Enter the raw costs and order value below — Total Cost, Receive Amount, Available Balance, Shipment Margin, and Net Profit are all calculated automatically (issue 46) using the persisted Initial Balance ({initialBalance.toFixed(2)} BDT, set from the Export Analytics dashboard).</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label={`Freight Cost (${form.baseCurrency})`} type="number" min="0" value={form.freightCost} onChange={e => set('freightCost', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} />
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

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} loading={saving} variant="primary" icon={Save} size="lg">Save Shipment</Button>
      </div>
    </div>
  );
}
