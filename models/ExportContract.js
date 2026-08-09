import mongoose from 'mongoose';

// Batch 9 (R18) — sits between Buyer and Shipments in the admin's navigation:
// country → buyer → Export Contract → shipments (was country → buyer → shipments directly).
// Every shipment now belongs to exactly one of these (ExportShipment.exportContract).
//
// `baseCurrency` here is the DEFAULT a shipment created under this contract starts with — the
// shipment's own `baseCurrency` field is what's actually authoritative for that shipment and stays
// independently editable afterward (same "auto-fill once, then a normal editable field" pattern
// used everywhere else in this app for bank accounts/licenses/categories), never read live from the
// contract after the initial fill.
//
// `value` is the contract's own total value, in `baseCurrency` — used to populate Section (B) of
// the Ka Form ("EXPORT L/C / CONTRACT NO., DATE & VALUE") together with contractNo/date. It is NOT
// cross-checked against the sum of member shipments' order values — a real export contract's total
// value is agreed up front and shipments are drawn against it incrementally, so the two are
// expected to diverge (contract value is a ceiling/agreement, not a running total).
const ExportContractSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportBuyer', required: true },
  // Denormalized (same pattern ExportShipment already uses for country) — lets contract queries
  // filter by country without an extra populate/join.
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCountry', required: true },

  contractNo: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  exportCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCategory' },
  value: { type: Number, default: 0, min: 0 },
  baseCurrency: { type: String, default: 'EUR' },

  notes: String,
}, { timestamps: true });

ExportContractSchema.index({ buyer: 1, date: -1 });

export default mongoose.models.ExportContract || mongoose.model('ExportContract', ExportContractSchema);
