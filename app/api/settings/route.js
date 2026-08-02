import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { hasPermission } from '@/lib/permissions';

// Batch 7 (R5 investigation): flattens one level of plain-object nesting into dot-notation keys,
// e.g. { exportShipmentOptions: { modeOfCarrying: [...], landingPort: [...] } } becomes
// { 'exportShipmentOptions.modeOfCarrying': [...], 'exportShipmentOptions.landingPort': [...] }.
// Settings has several nested config groups defined via Mongoose's "shorthand nested schema"
// syntax (contact/social/payment/exportShipmentOptions) rather than an explicit sub-Schema —
// $set-ing the WHOLE nested object at once relies on Mongoose correctly casting an entire
// compound path in one step, whereas dot-notation on each leaf path is the most explicit,
// unambiguous update MongoDB/Mongoose supports (each key maps to one already-typed schema path,
// no whole-object casting involved at all). Arrays and non-plain-objects (Dates, ObjectIds, etc.)
// are left untouched and set directly — only genuine plain `{ ... }` objects get flattened, and
// only one level deep (matches how deep Settings' own nested groups actually go).
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}
function flattenForSet(body) {
  const out = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (isPlainObject(value)) {
      for (const [subKey, subValue] of Object.entries(value)) out[`${key}.${subKey}`] = subValue;
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Settings change frequently via the admin panel and must be reflected on
// the storefront immediately (phone/WhatsApp/email/address/logo/etc). Force
// this route to always run dynamically and never get cached at any layer.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await connectDB();
    let settings = await Settings.findOne().lean();
    if (!settings) settings = await Settings.create({});
    return NextResponse.json({ success: true, settings }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache' },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'settings', 'edit')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    // IMPORTANT: use $set, not a bare object. Mongo/Mongoose treats a plain object with no operators
    // as a full REPLACEMENT document — any field not present in `body` would be silently wiped from
    // the one-and-only Settings doc. $set only touches the fields actually sent, which is what every
    // caller here actually wants (this route is always called with a partial or full snapshot of the
    // settings form, never intending to erase untouched fields like footer/header links, FAQs, etc).
    // Nested config groups (contact/social/payment/exportShipmentOptions/etc.) are additionally
    // flattened to dot-notation paths — see flattenForSet above — so each save is as explicit and
    // unambiguous as a MongoDB update can be, rather than relying on whole-nested-object casting.
    const settings = await Settings.findOneAndUpdate({}, { $set: flattenForSet(body) }, { upsert: true, new: true });
    return NextResponse.json({ success: true, settings }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
