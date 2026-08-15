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
  // batch 17 (R4): generic fallback label — no specific shipment/currency is available in the
  // category editor's column-picker checkboxes (where this is actually rendered; columnHeaderLabel
  // below is what shows the REAL currency + sales term once a specific shipment is in context).
  totalValue: 'Total Value (Sales Terms)',
};

// Which of the keys above are even meaningful/selectable for each document.
export const AVAILABLE_COLUMNS = {
  packingList: ['hsCode', 'packSizeKg', 'totalCTN', 'quantityKg'],
  buyerInvoice: ['hsCode', 'quantityKg', 'unitPrice', 'averagePrice', 'totalValue'],
  // batch 17 (R3): hsCode is now a normal togglable column here too, like every other document —
  // previously BD Invoice showed HS Code (if at all) as a sub-line under the product name via a
  // separate on/off switch (see the removed shouldShowBdHsCode below); it's now always its own
  // column instead, per the requested BD Invoice layout.
  bdInvoice: ['hsCode', 'totalCTN', 'quantityKg', 'unitPrice', 'averagePrice', 'totalValue'],
};

// "Fresh Fruits and Vegetables" reference format — verified against the 3 sample PDFs the user
// provided (Packing_List.pdf, Buyer_s_Invoice_.pdf, BD_Invoice.pdf). This is the default for every
// new category, and the fallback used whenever a shipment has no Export Category selected yet (or
// its category predates this feature) — so nothing is ever blank/broken before a category is
// chosen.
export const DEFAULT_DOCUMENT_COLUMNS = {
  packingList: ['packSizeKg', 'totalCTN', 'quantityKg'],
  buyerInvoice: ['quantityKg', 'unitPrice', 'totalValue'],
  // batch 17 (R3): hsCode leads, matching the requested column order (Name of Products, HS Code,
  // Total CTN, Quantity KG, Unit Price, Total).
  bdInvoice: ['hsCode', 'totalCTN', 'quantityKg', 'unitPrice', 'totalValue'],
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
// batch 17 (R4): `salesTerm` replaces what used to be a hardcoded "(CFR)" suffix on the Total
// column — every shipment already has its own free-text `salesTerm` field (e.g. "CFR", "FOB",
// "CIF, France"); the header now always reflects whatever THIS shipment's actual sales term is,
// instead of assuming CFR for every shipment regardless of what was really agreed. Falls back to
// the generic label "Sales Terms" only if a caller doesn't have one to pass (should not normally
// happen — every call site was updated to pass shipment.salesTerm/form.salesTerm).
export function columnHeaderLabel(key, currency = 'EUR', salesTerm = 'Sales Terms') {
  if (key === 'unitPrice') return `Unit Price (${currency})`;
  if (key === 'averagePrice') return `Avg Price (${currency})`;
  if (key === 'totalValue') return `Total ${currency} (${salesTerm || 'Sales Terms'})`;
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

// batch 17: shouldShowBdHsCode() used to gate a separate "sub-line under the name vs nothing"
// on/off switch for BD Invoice's HS Code. Removed — HS Code is now a normal togglable column in
// AVAILABLE_COLUMNS.bdInvoice/DEFAULT_DOCUMENT_COLUMNS.bdInvoice above, exactly like every other
// column, so the dedicated switch is redundant (the category's own documentColumns.bdInvoice list
// already controls this). The ExportCategory.bdInvoiceShowHsCode schema field itself is left in
// place harmlessly for any already-saved documents; nothing reads it anymore.

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

// batch 17 (R1/R2/R3) — groups the master Shipment Details items by each row's own captured
// PRODUCT CATEGORY (item.category — a snapshot of the catalog Product's Category.name, see
// ShipmentItemSchema; NOT the same thing as the shipment-level Export Category used for
// incentives/document-format selection). Rows never matched to a catalog product (a manually
// typed product name) group under "Uncategorized" rather than being silently dropped, so nothing
// entered in Shipment Details ever goes missing from either downstream view.
//
// This single function is the shared source of truth for BOTH:
//   - the shipment editor's "Category Wise Product Details" section (R1: live totals as products
//     are added; R2: the dedicated section itself), and
//   - BD Invoice's auto-seed (R3: one row per product category, replacing the old single row
//     named after the shipment's Export Category)
// so the two can never drift apart from each other.
//
// Returned rows are in first-seen order and carry: category (group key), totalCTN,
// totalCtnWeightKg, quantityKg, totalValue (all summed), hsCode (the first non-empty HS code seen
// in the group — a sensible starting point for BD Invoice's auto-seeded, still admin-editable HS
// Code cell), and avgPrice (derived via avgPrice() above, never separately summed/stored).
export function computeCategoryBreakdown(items) {
  const rows = (items || []).filter((i) => i?.productName);
  const groups = new Map();
  for (const r of rows) {
    const key = r.category || 'Uncategorized';
    if (!groups.has(key)) {
      groups.set(key, { category: key, totalCTN: 0, totalCtnWeightKg: 0, quantityKg: 0, totalValue: 0, hsCode: '' });
    }
    const g = groups.get(key);
    g.totalCTN += Number(r.totalCTN) || 0;
    g.totalCtnWeightKg += Number(r.totalCtnWeightKg) || 0;
    g.quantityKg += Number(r.quantityKg) || 0;
    g.totalValue += Number(r.totalValue) || 0;
    if (!g.hsCode && r.hsCode) g.hsCode = r.hsCode;
  }
  return Array.from(groups.values()).map((g) => ({ ...g, avgPrice: avgPrice(g.totalValue, g.quantityKg) }));
}
