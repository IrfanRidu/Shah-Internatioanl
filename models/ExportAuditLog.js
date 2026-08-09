import mongoose from 'mongoose';

// Issue 45: every add / edit / delete anywhere in the export dashboard (shipments, buyers,
// countries, and the derived analytics rows they produce) must be recorded here so admins can see
// exactly who changed what and when. `before`/`after` are full plain-object snapshots (Mixed) rather
// than diffs — simpler to reason about, always human-readable, and enough to reconstruct any prior
// state without re-deriving anything.
const ExportAuditLogSchema = new mongoose.Schema({
  action: { type: String, enum: ['create', 'update', 'delete', 'restore'], required: true },
  // Batch 9 (R18): 'exportContract' added — contracts sit at the same hierarchical tier as
  // buyers/countries (country > buyer > contract > shipments) so they're logged the same way.
  // Config-only entities (category/license/bank/ctn/incentive application) remain deliberately
  // unlogged, per batch 8's own explicit call on that.
  entityType: { type: String, enum: ['shipment', 'buyer', 'country', 'exportContract'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityLabel: String, // human-readable identifier at the time of the action (shipmentNo / buyer name / country name)
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: String,
  performedByEmail: String,
}, { timestamps: true });

ExportAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
ExportAuditLogSchema.index({ createdAt: -1 });

export default mongoose.models.ExportAuditLog || mongoose.model('ExportAuditLog', ExportAuditLogSchema);
