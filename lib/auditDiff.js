// Batch 9 (R23) — "All the activity log is showing the changes as database which is too difficult
// for the admin to understand... display the whole before and after fields and values that are
// changed." The underlying data was already correct and complete (recordAuditLog has always stored
// full before/after snapshots — see lib/exportAudit.js) — this was purely a display-layer gap: the
// audit-log page was rendering `JSON.stringify(log.before, null, 1)` in a <pre> block. Pure,
// client-safe (no Mongoose imports), used only by the audit-log page.

const SKIP_FIELDS = new Set(['_id', '__v', 'id', 'createdAt', 'updatedAt']);

// Human labels for the fields an admin actually cares about — everything else falls back to a
// camelCase→Title Case conversion below, so nothing is ever left showing a raw key name.
const LABEL_MAP = {
  shipmentNo: 'Shipment No', contractNo: 'Contract No', exportContract: 'Export Contract',
  invoiceNo: 'Invoice No', date: 'Date', buyer: 'Buyer', country: 'Country',
  exportCategory: 'Export Category', exportLicense: 'Export License', bankAccount: 'Bank Account',
  status: 'Status', modeOfCarrying: 'Mode of Carrying', landingPort: 'Landing Port',
  portOfDischarge: 'Port of Discharge', finalDestination: 'Final Destination', salesTerm: 'Sales Term',
  countryOfOrigin: 'Country of Origin', items: 'Items', totalCTN: 'Total Carton',
  totalNetWeightKg: 'Total Net Weight (kg)', totalGrossWeightKg: 'Total Gross Weight (kg)',
  orderValueForeign: 'Order Value', orderCurrency: 'Order Currency', baseCurrency: 'Base Currency',
  exchangeRateBDT: 'Exchange Rate (BDT)', freightCost: 'Freight Cost', goodsCost: 'Goods Cost',
  exportProcessingCost: 'Export Processing Cost', othersCost: 'Others Cost', damage: 'Damage',
  incentive: 'Incentive (BDT)', initialBalance: 'Initial Balance', totalCost: 'Total Cost',
  receiveAmountBDT: 'Receive Amount (BDT)', netProfit: 'Net Profit', ttEntries: 'TT Entries',
  expNo: 'EXP No', expDate: 'EXP Date', awbNo: 'Airway Bill / BL No',
  documentTextOverrides: 'Document Text Overrides', incentiveApplication: 'Incentive Application',
  uploadedDocuments: 'Uploaded Documents', notes: 'Notes', files: 'Files',
  name: 'Name', contactPerson: 'Contact Person', email: 'Email', phone: 'Phone', address: 'Address',
  taxId: 'Tax ID', currency: 'Currency', isActive: 'Active', code: 'Code', flag: 'Flag',
  value: 'Value', licenseName: 'License Name', ownerName: 'Owner Name', ercNumber: 'ERC No',
  letterheadUrl: 'Letterhead',
};

function humanizeKey(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isIsoDateString(val) {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val);
}

function formatDateVal(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Renders one value for display — never raw JSON. Arrays and populated-ref-shaped objects get a
// short, meaningful summary rather than a dump; everything else is a plain readable string.
export function formatAuditValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (isIsoDateString(val)) return formatDateVal(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '(none)';
    if (key === 'items') {
      const names = val.slice(0, 3).map((i) => i.description || i.itemNo || '').filter(Boolean);
      return `${val.length} item${val.length !== 1 ? 's' : ''}${names.length ? ` (${names.join(', ')}${val.length > 3 ? ', …' : ''})` : ''}`;
    }
    if (key === 'ttEntries') {
      const total = val.reduce((sum, t) => sum + (Number(t.ttValue) || 0), 0);
      return `${val.length} TT entr${val.length !== 1 ? 'ies' : 'y'} (total ${total.toLocaleString()})`;
    }
    if (key === 'files' || key === 'uploadedDocuments') return `${val.length} file${val.length !== 1 ? 's' : ''}`;
    if (val.every((v) => v === null || typeof v !== 'object')) return val.join(', ');
    return `${val.length} item${val.length !== 1 ? 's' : ''}`;
  }
  if (typeof val === 'object') {
    // A populated reference (Mongoose doc/lean object) or a raw ObjectId — show something
    // meaningful rather than a raw {_id: "..."} dump.
    if (val.name) return val.name;
    if (val.shipmentNo) return val.shipmentNo;
    if (val.contractNo) return val.contractNo;
    if (val.licenseName) return val.licenseName;
    if (val.$oid) return String(val.$oid);
    if (val._id) return String(val._id);
    try { return JSON.stringify(val).slice(0, 80); } catch { return '(object)'; }
  }
  if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(val);
}

function deepEqual(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
}

// The main entry point — given one audit log entry, returns an ordered array of
// {key, label, before, after} rows ready to render:
// - create: every meaningful field on the new document, before shown as '—'
// - delete: every meaningful field the deleted document had, after shown as '—'
// - update/restore: ONLY the fields that actually changed between before and after
export function buildFieldDiff(log) {
  const action = log?.action;
  const before = log?.before || null;
  const after = log?.after || null;

  const listFields = (obj) => Object.keys(obj || {}).filter((k) => !SKIP_FIELDS.has(k) && obj[k] !== null && obj[k] !== undefined && obj[k] !== '');

  if (action === 'create') {
    return listFields(after).map((k) => ({ key: k, label: humanizeKey(k), before: null, after: formatAuditValue(k, after[k]) }));
  }
  if (action === 'delete') {
    return listFields(before).map((k) => ({ key: k, label: humanizeKey(k), before: formatAuditValue(k, before[k]), after: null }));
  }
  // update / restore
  const b = before || {}; const a = after || {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changed = [];
  keys.forEach((k) => {
    if (SKIP_FIELDS.has(k)) return;
    if (deepEqual(b[k], a[k])) return;
    changed.push({ key: k, label: humanizeKey(k), before: formatAuditValue(k, b[k]), after: formatAuditValue(k, a[k]) });
  });
  return changed;
}
