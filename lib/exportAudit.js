import ExportAuditLog from '@/models/ExportAuditLog';
import ExportRecycleBin from '@/models/ExportRecycleBin';

// A best-effort label so log/recycle-bin entries are readable without needing to re-join the
// original collection (which may itself have since been deleted/restored).
function labelFor(entityType, doc) {
  if (!doc) return '';
  if (entityType === 'shipment') return doc.shipmentNo || String(doc._id);
  if (entityType === 'buyer') return doc.name || String(doc._id);
  if (entityType === 'country') return doc.name || String(doc._id);
  if (entityType === 'exportContract') return doc.contractNo || String(doc._id);
  return String(doc._id || '');
}

// Records one audit-log entry. Never throws — a logging failure must not block the actual
// create/update/delete it's describing.
export async function recordAuditLog({ session, action, entityType, entityId, before, after }) {
  try {
    const label = labelFor(entityType, after || before);
    await ExportAuditLog.create({
      action,
      entityType,
      entityId,
      entityLabel: label,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      performedBy: session?.user?.id,
      performedByName: session?.user?.name,
      performedByEmail: session?.user?.email,
    });
  } catch (e) {
    console.error('recordAuditLog failed (non-fatal):', e.message);
  }
}

// Moves a full document snapshot into the recycle bin. Call this BEFORE actually deleting the
// document so the snapshot is guaranteed complete.
export async function moveToRecycleBin({ session, entityType, doc }) {
  const plain = JSON.parse(JSON.stringify(doc));
  await ExportRecycleBin.create({
    entityType,
    originalId: doc._id,
    entityLabel: labelFor(entityType, plain),
    data: plain,
    deletedBy: session?.user?.id,
    deletedByName: session?.user?.name,
  });
  await recordAuditLog({ session, action: 'delete', entityType, entityId: doc._id, before: plain, after: null });
}
