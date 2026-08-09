// Batch 8 (R9-R16) — SERVER-ONLY companion to lib/incentiveUtils.js (imports Mongoose models +
// audit logging, so this must never be imported from a client component — the pure, client-safe
// resolver/validation helpers live in lib/incentiveUtils.js instead).
import ExportShipment from '@/models/ExportShipment';
import ExportCategory from '@/models/ExportCategory';
import IncentiveApplication from '@/models/IncentiveApplication';
import Settings from '@/models/Settings';
import { calculateShipmentFinancials } from './utils';
import { recordAuditLog } from './exportAudit';
import { resolveEffectiveRateBDT, calculateIncentiveCosting } from './incentiveUtils';

// R15: whenever an Incentive Application's effective rate changes (a manual rate is set, edited, or
// CLEARED, or claiming/unclaiming flips which rate applies), every member shipment's DERIVED
// financial fields need to be recomputed and persisted — not just resolvable live via
// resolveEffectiveRateBDT — so anything reading a shipment's stored fields directly (the buyer's
// shipment list, etc.), not only the couple of call sites that go through the resolver themselves,
// stays correct too. `exchangeRateBDT` itself is deliberately left untouched on each shipment (see
// IncentiveApplication.js's own comment on why the override is non-destructive/fully reversible) —
// only the numbers DERIVED from it are updated here.
//
// Takes the (already-updated-in-memory) `application`, not a single shared rate number, and
// resolves each shipment's effective rate individually via the real resolver — this is what makes
// clearing a manual rate work correctly too: with no override active, each shipment simply falls
// back to its OWN stored exchangeRateBDT again, which can legitimately differ between shipments.
// `shipmentDocs` may be plain lean objects or real Mongoose documents — either works. `statusOverride`
// (optional) additionally sets shipment.status as part of the SAME update + audit entry — used by
// claim (→ 'completed') and unclaim (→ 'active') so each shipment gets one combined log entry for
// "claimed/unclaimed" rather than two separate ones (a status-change entry plus a financials-only
// recompute entry) for what is really a single admin action.
//
// Batch 9 (R20): also computes the group's "incentive after costing" distribution ONCE up front
// (needs every member shipment together — a single-shipment view can't derive it) and feeds each
// shipment's equal share in as its `incentive` value below, replacing the old "pass
// beforeSnapshot.incentive straight through unchanged" behavior. This is what makes R20's "appears
// automatically in the TT Configuration section of every shipment" literal — every existing call
// site (create/rate-change/claim/unclaim) gets this for free since they all already funnel through
// here; a NEW call site (recalculateGroupIfPending, below) covers the one gap those didn't: a
// member shipment's own financial data changing via the ordinary shipments PUT route.
export async function cascadeRecomputeShipments(shipmentDocs, application, session, statusOverride, options = {}) {
  const { skipLogForId } = options;
  const settings = await Settings.findOne().lean();
  const initialBalance = settings?.exportAnalyticsInitialBalance || 0;

  let perShipmentShareBDT = null;
  if (application) {
    const category = (application.exportCategory && typeof application.exportCategory === 'object' && application.exportCategory.incentivePercentage !== undefined)
      ? application.exportCategory
      : await ExportCategory.findById(application.exportCategory).lean();
    const plainShipments = shipmentDocs.map(d => (d.toObject ? d.toObject() : d));
    // The group's one representative rate — in the intended usage (R19) an application always has
    // its own manual/locked rate, which every member resolves to identically; falling back to the
    // first shipment's own rate only matters in the (uncommon) case where neither is set yet.
    const groupRate = plainShipments.length ? resolveEffectiveRateBDT(plainShipments[0], application) : 0;
    const costing = calculateIncentiveCosting({
      shipments: plainShipments,
      category,
      effectiveRateBDT: groupRate,
      commissionInsuranceValue: application.kaForm?.commissionInsuranceValue,
    });
    perShipmentShareBDT = costing.perShipmentShareBDT;
  }

  for (const before of shipmentDocs) {
    const beforeSnapshot = before.toObject ? before.toObject() : before;
    const effectiveRate = resolveEffectiveRateBDT(beforeSnapshot, application);
    const computed = calculateShipmentFinancials({
      initialBalance,
      freightCost: beforeSnapshot.freightCost, goodsCost: beforeSnapshot.goodsCost, exportProcessingCost: beforeSnapshot.exportProcessingCost,
      othersCost: beforeSnapshot.othersCost, damage: beforeSnapshot.damage, orderValueForeign: beforeSnapshot.orderValueForeign,
      exchangeRateBDT: effectiveRate,
      incentive: perShipmentShareBDT !== null ? perShipmentShareBDT : beforeSnapshot.incentive,
      ttEntries: beforeSnapshot.ttEntries,
    });
    const setFields = statusOverride ? { ...computed, status: statusOverride } : computed;
    const updated = await ExportShipment.findByIdAndUpdate(beforeSnapshot._id, { $set: setFields }, { new: true });
    // R3: shipments are a logged entity type once active — a rate-driven recompute (and, via
    // statusOverride, a claim/unclaim status change) is a real change like any other and gets the
    // same 'update' audit entry (drafts can't reach this path at all, since only active shipments
    // can be selected into an Incentive Application in the first place). `skipLogForId` (R18/R20)
    // is for the one case where the caller already recorded its own accurate before→after entry for
    // this specific shipment moments ago (recalculateGroupIfPending, called right after the
    // shipments PUT route's own save+log) — logging it again here would just be a near-duplicate
    // entry for the same user action; the DB write itself still happens either way, this only skips
    // the second log line for that one shipment. Every OTHER sibling still gets logged normally —
    // for them, this really is a new, first-time-logged change.
    if (beforeSnapshot.status !== 'draft' && String(beforeSnapshot._id) !== String(skipLogForId || '')) {
      await recordAuditLog({ session, action: 'update', entityType: 'shipment', entityId: beforeSnapshot._id, before: beforeSnapshot, after: updated?.toObject() });
    }
  }
}

// Batch 9 (R18/R20): re-runs the cascade above for every member of a shipment's still-pending
// Incentive Application — called from the shipments PUT route (not from the application routes,
// which already call cascadeRecomputeShipments directly) so editing one member's own financial data
// (freight cost, TT entries, order value...) keeps the whole group's Ka Form figures and distributed
// Incentive field in sync, not just whatever the client happened to send for the shipment actually
// being saved. Safe no-op when the shipment isn't grouped, or its application is already claimed
// (claimed shipments are fully locked and can never reach the PUT route in the first place — see
// isShipmentLockedByIncentive — so this second check is defensive, not load-bearing).
export async function recalculateGroupIfPending(shipmentAfterSave, session) {
  if (!shipmentAfterSave?.incentiveApplication) return;
  const application = await IncentiveApplication.findById(shipmentAfterSave.incentiveApplication).lean();
  if (!application || application.status === 'claimed') return;
  const siblings = await ExportShipment.find({ incentiveApplication: application._id });
  // The shipment that triggered this was already saved + logged by the caller (the shipments PUT
  // route, moments ago, with a correct before→after diff of its own edit) — skipLogForId avoids a
  // redundant near-duplicate entry for it here; its derived fields (specifically `incentive`, which
  // this cascade may adjust as a side effect of the group total changing) still get silently
  // corrected via the same DB write every other sibling gets, just without a second log entry.
  await cascadeRecomputeShipments(siblings, application, session, undefined, { skipLogForId: shipmentAfterSave._id });
}
