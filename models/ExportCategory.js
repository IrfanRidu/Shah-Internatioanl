import mongoose from 'mongoose';
import { DEFAULT_DOCUMENT_COLUMNS } from '@/lib/exportColumns';

// Requirement 8 (Incentive Configuration) — each entry IS an "Export Category": admin defines the
// category alongside its image, HS Code, and the 4 numbers used to calculate this category's
// incentive. Requirement 10 then has shipments select one of these (their own incentive is
// calculated from it), and requirement 11 uses its image on shipment cards.
//
// Batch 7: Export Category becomes the export dashboard's central concept — different categories
// need different Packing List / Buyer's Invoice / BD Invoice FORMATS (e.g. Fresh Fruits &
// Vegetables vs some other category), so each category now owns its own `documentColumns` template
// (which optional columns show on each of the 3 output documents, see lib/exportColumns.js for the
// full registry + defaults). The underlying shipment DATA entry (Shipment Details tab) stays the
// same full field set for every category — only the printed/downloaded PRESENTATION varies.
const ExportCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  image: String, // Cloudinary URL — shown on shipment cards (requirement 11) and in this config's grid
  hsCode: String,
  incentivePercentage: { type: Number, default: 0, min: 0, max: 100 },
  taxPercentage: { type: Number, default: 0, min: 0, max: 100 },
  // Both costs are in the admin dashboard's current/default currency per the spec's own note.
  incentiveApplicationCost: { type: Number, default: 0, min: 0 },
  othersCost: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },

  // Batch 7 — per-document optional column selection (see lib/exportColumns.js COLUMN_REGISTRY for
  // the full set of togglable keys per document). Defaults match the "Fresh Fruits and Vegetables"
  // reference format exactly, so any category created without explicit customization behaves the
  // same as before this feature existed.
  documentColumns: {
    packingList: { type: [String], default: DEFAULT_DOCUMENT_COLUMNS.packingList },
    buyerInvoice: { type: [String], default: DEFAULT_DOCUMENT_COLUMNS.buyerInvoice },
    bdInvoice: { type: [String], default: DEFAULT_DOCUMENT_COLUMNS.bdInvoice },
  },
  // BD Invoice shows HS Code as a sub-line under the product name (never its own column, per the
  // reference layout) — a separate on/off switch rather than a column key for that reason.
  // batch 17: superseded — HS Code is now a normal togglable column in documentColumns.bdInvoice
  // (see lib/exportColumns.js) like every other BD Invoice column, instead of this separate
  // switch. Left in the schema harmlessly for any already-saved documents; nothing reads it.
  bdInvoiceShowHsCode: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.ExportCategory || mongoose.model('ExportCategory', ExportCategorySchema);
