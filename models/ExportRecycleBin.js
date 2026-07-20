import mongoose from 'mongoose';

// Issue 45: deleted shipments/buyers/countries land here as a full document snapshot (not just an
// ID) so "restore" can recreate the record with the SAME _id and EXACT prior field values — putting
// it back "exactly where it was before deletion", including references from other collections that
// pointed at that _id (e.g. shipments referencing a restored buyer/country still resolve correctly).
const ExportRecycleBinSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['shipment', 'buyer', 'country'], required: true },
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityLabel: String,
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // full document snapshot at time of delete
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedByName: String,
  restored: { type: Boolean, default: false },
  restoredAt: Date,
}, { timestamps: true });

ExportRecycleBinSchema.index({ entityType: 1, restored: 1, createdAt: -1 });

export default mongoose.models.ExportRecycleBin || mongoose.model('ExportRecycleBin', ExportRecycleBinSchema);
