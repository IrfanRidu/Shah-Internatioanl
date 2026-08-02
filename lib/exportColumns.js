// Single source of truth for which product-table columns can appear on each of the 3 printable
// export documents (Packing List, Buyer's Invoice, BD Invoice), and which subset each Export
// Category shows by default (batch 7 — "different export categories need different document
// formats"). Used by: the ExportCategory model (schema defaults), the category editor's
// column-picker UI, the shipment editor's read-only document-tab tables, and the print/PDF
// generation code — so all of them stay in sync and can never drift apart from each other.
//
// `name` (product name + botanical name together) and `slNo` are NOT in this registry — every
// document always shows them; they aren't togglable per category.
//
// The Shipment Details tab's MASTER product table is DELIBERATELY not driven by this registry — it
// always shows every field (see the shipment editor). Only the 3 *output* documents vary by
// category; keeping data entry consistent avoids category-conditional calculation logic, while the
// printed/downloaded presentation of already-captured data is safe to vary.

export const COLUMN_LABELS = {
  hsCode: 'HS Code',
  packSizeKg: 'Pack Size (KG)',
  totalCTN: 'Total CTN',
  quantityKg: 'Quantity (KG)',
  unitPrice: 'Unit Price',
  averagePrice: 'Average Price',
  totalValue: 'Total Value (CFR)',
};

// Which of the keys above are even meaningful/selectable for each document.
export const AVAILABLE_COLUMNS = {
  packingList: ['hsCode', 'packSizeKg', 'totalCTN', 'quantityKg'],
  buyerInvoice: ['hsCode', 'quantityKg', 'unitPrice', 'averagePrice', 'totalValue'],
  bdInvoice: ['totalCTN', 'quantityKg', 'unitPrice', 'averagePrice', 'totalValue'],
};

// "Fresh Fruits and Vegetables" reference format — verified against the 3 sample PDFs the user
// provided (Packing_List.pdf, Buyer_s_Invoice_.pdf, BD_Invoice.pdf). This is the default for every
// new category, and the fallback used whenever a shipment has no Export Category selected yet (or
// its category predates this feature) — so nothing is ever blank/broken before a category is
// chosen.
export const DEFAULT_DOCUMENT_COLUMNS = {
  packingList: ['packSizeKg', 'totalCTN', 'quantityKg'],
  buyerInvoice: ['quantityKg', 'unitPrice', 'totalValue'],
  bdInvoice: ['totalCTN', 'quantityKg', 'unitPrice', 'totalValue'],
};

export const DOC_KEYS = ['packingList', 'buyerInvoice', 'bdInvoice'];

export const DOC_LABELS = {
  packingList: 'Packing List',
  buyerInvoice: "Buyer's Invoice",
  bdInvoice: 'BD Invoice',
};

// Table-header text for a column, with the shipment's actual currency interpolated for the 3
// money-denominated columns — used by both the admin editor's read-only document views and the
// print/PDF generation code, so a header never reads differently in one place than the other.
export function columnHeaderLabel(key, currency = 'EUR') {
  if (key === 'unitPrice') return `Unit Price (${currency})`;
  if (key === 'averagePrice') return `Avg Price (${currency})`;
  if (key === 'totalValue') return `Total ${currency} (CFR)`;
  return COLUMN_LABELS[key] || key;
}

// Resolves the effective, order-preserving column list for a document, given a (possibly
// null/partial/stale) populated category. Filters out any unknown keys defensively (e.g. a
// category saved by an older or newer version of this registry) instead of letting them silently
// break rendering.
export function getDocumentColumns(category, docKey) {
  const fromCategory = category?.documentColumns?.[docKey];
  if (Array.isArray(fromCategory) && fromCategory.length > 0) {
    const allowed = new Set(AVAILABLE_COLUMNS[docKey] || []);
    const filtered = fromCategory.filter((k) => allowed.has(k));
    if (filtered.length > 0) return filtered;
  }
  return DEFAULT_DOCUMENT_COLUMNS[docKey] || [];
}

// BD Invoice shows HS Code as a sub-line under the product name, never as its own column (per the
// reference layout) — a plain on/off switch rather than a column key for that reason.
export function shouldShowBdHsCode(category) {
  return category?.bdInvoiceShowHsCode !== false; // defaults to true when unset
}

// Derived "Average Price" (R1) — deliberately never stored on the item itself, always computed, so
// it can never drift out of sync with unitPrice/totalValue.
export function avgPrice(totalValue, quantityKg) {
  const q = Number(quantityKg) || 0;
  if (q <= 0) return 0;
  return (Number(totalValue) || 0) / q;
}

// Shipment-wide weighted average price across every master item — this is what seeds BD Invoice's
// initial Unit Price the first time it's auto-seeded (R4: "Initially this field will show the
// average price from the shipment details tab").
export function shipmentAveragePrice(items) {
  const rows = (items || []).filter((i) => i?.productName);
  const totalValue = rows.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);
  const totalQty = rows.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  return avgPrice(totalValue, totalQty);
}
