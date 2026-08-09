import mongoose from 'mongoose';

// Requirement 7 (Export License Configuration) — admin-managed list of the company's export
// licenses. A shipment selects one (ExportShipment.exportLicense ref) and its TIN/BIN auto-fill
// into the shipment's own tinNo/binNo fields; its letterheadUrl also becomes the letterhead used
// on THAT shipment's documents, taking priority over the global company letterhead (Settings.
// exportLetterheadUrl) which remains the fallback for shipments with no license selected yet.
const ExportLicenseSchema = new mongoose.Schema({
  // "License Type(Options will be Export Categories)" — a dropdown of the saved Export Categories.
  licenseType: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCategory' },
  licenseName: { type: String, required: true },
  licenseNo: String,
  activationDate: Date,
  expiryDate: { type: Date, required: true },
  letterheadUrl: { type: String, required: true }, // Cloudinary URL — "License Letter Head"
  tinNo: { type: String, required: true },
  binNo: { type: String, required: true },
  // Batch 7 (R1) — optional: not every license has a REX/GSP registration number. When set, it
  // auto-fills a shipment's rexNo the same way tinNo/binNo do above.
  rexNo: String,
  // Batch 8 (R4) — the license-holder's own registration/contact details, entered once per license
  // in License Settings. Not auto-filled anywhere (unlike tinNo/binNo/rexNo above, which flow onto
  // a shipment) — these describe the license/company itself, not something a shipment reproduces.
  ercNumber: String,   // Export Registration Certificate Number
  address: String,
  ownerName: String,
  phone: String,
  email: String,
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.ExportLicense || mongoose.model('ExportLicense', ExportLicenseSchema);
