import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExportRecycleBin from '@/models/ExportRecycleBin';
import ExportShipment from '@/models/ExportShipment';
import ExportBuyer from '@/models/ExportBuyer';
import ExportCountry from '@/models/ExportCountry';
import ExportContract from '@/models/ExportContract';
import { recordAuditLog } from '@/lib/exportAudit';

const MODELS = { shipment: ExportShipment, buyer: ExportBuyer, country: ExportCountry, exportContract: ExportContract };

// Issue 45: restoring puts the deleted item back "exactly at its place as it was before deletion" —
// recreated with the SAME _id and the exact field values from the snapshot, so anything that still
// references that _id (e.g. a shipment pointing at a restored buyer) resolves correctly again.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!['superAdmin', 'admin'].includes(session?.user?.role)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  await connectDB();

  const entry = await ExportRecycleBin.findById(params.id);
  if (!entry || entry.restored) return NextResponse.json({ success: false, message: 'Recycle bin entry not found or already restored' }, { status: 404 });

  const Model = MODELS[entry.entityType];
  if (!Model) return NextResponse.json({ success: false, message: 'Unknown entity type' }, { status: 400 });

  // If something new already occupies that _id (extremely unlikely, but guard anyway), fail loudly
  // rather than silently overwrite it.
  const clash = await Model.findById(entry.originalId).lean();
  if (clash) return NextResponse.json({ success: false, message: 'A record with this ID already exists — cannot restore automatically' }, { status: 409 });

  const restoredDoc = await Model.create({ ...entry.data, _id: entry.originalId });
  entry.restored = true;
  entry.restoredAt = new Date();
  await entry.save();

  await recordAuditLog({ session, action: 'restore', entityType: entry.entityType, entityId: entry.originalId, before: null, after: restoredDoc.toObject() });

  return NextResponse.json({ success: true, restored: restoredDoc });
}
