import mongoose from 'mongoose';

// Requirement 2 (CTN Configuration) — admin-managed carton presets. Suggested while typing a CTN
// Size value on any packing-list/invoice row (requirement 3); requirement 4's per-row CTN weight
// auto-calc looks up the entry whose ctnSizeKg matches the row's own CTN Size and uses its
// ctnWeightGm. ctnCost isn't currently consumed by any calculation (not referenced by requirements
// 3/4) but is captured since requirement 2 explicitly asks for it as part of each entry.
const CtnConfigSchema = new mongoose.Schema({
  ctnSizeKg: { type: Number, required: true },
  ctnWeightGm: { type: Number, required: true },
  ctnCost: { type: Number, required: true, min: 0 }, // currency = Settings.defaultCurrency
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.CtnConfig || mongoose.model('CtnConfig', CtnConfigSchema);
