// Batch 8 (R9-R16) shared helpers for the Incentive Application workflow. Kept separate from
// lib/utils.js since these are incentive-specific and pull in nothing else that file needs.

// R15: the single place that decides which BDT rate is "real" for a shipment that belongs to an
// Incentive Application. Never mutates anything — purely resolves a number from whatever's already
// stored, so nothing needs to be restored if a manual rate is cleared or an application is
// unclaimed (see IncentiveApplication.js's own comment for the full reasoning).
// `application` may be null/undefined (shipment has no incentiveApplication, or it wasn't
// populated) — falls back to the shipment's own rate in that case, same as before this batch.
export function resolveEffectiveRateBDT(shipment, application) {
  const ownRate = Number(shipment?.exchangeRateBDT) || 0;
  if (!application) return ownRate;
  if (application.manualRateBDT !== null && application.manualRateBDT !== undefined && application.manualRateBDT !== '') {
    const manual = Number(application.manualRateBDT);
    if (Number.isFinite(manual) && manual > 0) return manual;
  }
  if (application.status === 'claimed' && application.lockedRateBDT) {
    const locked = Number(application.lockedRateBDT);
    if (Number.isFinite(locked) && locked > 0) return locked;
  }
  return ownRate;
}

// R15's override is "active" (i.e. the TT Configuration Rate in BDT field should show the resolved
// value read-only rather than the shipment's own live-tracked one) whenever a manual rate is set,
// OR the application has already been claimed (which always carries either a manual or locked rate).
export function isRateOverrideActive(application) {
  if (!application) return false;
  if (application.manualRateBDT !== null && application.manualRateBDT !== undefined && application.manualRateBDT !== '') return true;
  return application.status === 'claimed';
}

// R13: a shipment is fully locked (no edits of any kind) exactly when its Incentive Application has
// been claimed. Used both for the shipment editor's read-only banner and the server-side PUT/DELETE
// guard in the shipments API routes.
export function isShipmentLockedByIncentive(application) {
  return !!application && application.status === 'claimed';
}

// R11's bulk-selection rule, factored out so both the client (disabling checkboxes live) and the
// server (re-validating a POST body it can't fully trust) apply the exact same test.
export const MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION = 10;

// Batch 9 (R18): grouping rule changed from "same Export Category + same Export License" to "same
// Export Contract No + same Export License" — a contract already implies one category, so this is
// strictly narrower/more correct (two shipments can share a category via two DIFFERENT contracts,
// which would incorrectly let them into one Ka Form's single Section B contract no/date/value).
// ALSO now requiring the same Base Currency — not literally asked for in the source spec, but
// necessary for correctness: Section D/F sum every member shipment's figures into single "(FC)"
// totals with ONE currency label (confirmed against the real reference Ka Form, which has exactly
// one currency column throughout) — mixing currencies there would silently produce a wrong number
// with no error shown anywhere. Shipments under one contract already default to that contract's
// currency (R18), so this is a no-op in the common case and only blocks the genuine edge case of an
// admin overriding one member's currency individually.
export function canGroupForIncentive(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) return { ok: false, reason: 'No shipments selected.' };
  if (shipments.length > MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION) {
    return { ok: false, reason: `A maximum of ${MAX_SHIPMENTS_PER_INCENTIVE_APPLICATION} shipments can be selected at a time.` };
  }
  const contractIds = new Set(shipments.map(s => String(s.exportContract?._id || s.exportContract || '')));
  const licenseIds = new Set(shipments.map(s => String(s.exportLicense?._id || s.exportLicense || '')));
  const currencies = new Set(shipments.map(s => String(s.baseCurrency || '')));
  if (contractIds.has('') || licenseIds.has('')) {
    return { ok: false, reason: 'Every selected shipment must have both an Export Contract and an Export License set.' };
  }
  if (contractIds.size > 1 || licenseIds.size > 1) {
    return { ok: false, reason: 'All selected shipments must share the same Export Contract No and the same Export License.' };
  }
  if (currencies.size > 1) {
    return { ok: false, reason: 'All selected shipments must share the same Base Currency.' };
  }
  return { ok: true };
}

// Batch 9 (R19/R20) — the Ka Form's Section D/E/F math plus the "incentive after costing" layer on
// top of it, in one shared pure function used by BOTH the live client-side preview (Incentive
// Details tab) and the server-side cascade that actually persists each member shipment's share
// (lib/incentiveServer.js) — same "one shared formula, never two" discipline lib/utils.js's own
// calculateShipmentFinancials already established for the rest of this app.
//
// Every formula below was cross-checked against the real numbers in the reference Ka Form PDF
// (see KA_FORM_AND_STAMP_REFERENCE.md's own "Formula confirmation" section) — these aren't a guess
// from the prose spec alone.
//
// `shipments`: array of shipment objects/leans, each needs orderValueForeign, freightCost.
// `category`: the Export Category doc (or plain object) carrying incentivePercentage/
//   taxPercentage/incentiveApplicationCost/othersCost.
// `effectiveRateBDT`: the resolved BDT rate for the group (resolveEffectiveRateBDT's result) — the
//   Ka Form's own "TT Buying Rate ... on the Date of Repatriation".
// `commissionInsuranceValue`: the application's single admin-editable Section F figure (FC),
//   default 0/"N/A".
export function calculateIncentiveCosting({ shipments, category, effectiveRateBDT, commissionInsuranceValue }) {
  const list = Array.isArray(shipments) ? shipments : [];

  // Section E: Invoice Value (FC) = order value + freight, both already in the shipment's own base
  // currency. Repatriated Export Value (FC) is the identical figure per R19's own description,
  // confirmed row-for-row against the reference sample.
  const perShipment = list.map(s => {
    const invoiceValueFC = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
    return { shipmentId: String(s._id || ''), invoiceValueFC, repatriatedValueFC: invoiceValueFC, freightFC: Number(s.freightCost) || 0 };
  });
  const totalRepatriatedFC = perShipment.reduce((sum, r) => sum + r.repatriatedValueFC, 0);
  const totalFreightFC = perShipment.reduce((sum, r) => sum + r.freightFC, 0);
  const commissionInsuranceFC = Number(commissionInsuranceValue) || 0;

  // Section F: Net FOB Export Value (FC) = (1) Repatriated − ((2) Freight + (3) Commission/Insurance).
  const netFobFC = totalRepatriatedFC - (totalFreightFC + commissionInsuranceFC);

  const incentivePercentage = Number(category?.incentivePercentage) || 0;
  const taxPercentage = Number(category?.taxPercentage) || 0;
  const incentiveApplicationCostBDT = Number(category?.incentiveApplicationCost) || 0;
  const othersCostBDT = Number(category?.othersCost) || 0;
  const rate = Number(effectiveRateBDT) || 0;

  // Incentive Receivable (FC) = Net FOB × Export Category's incentive%.
  const incentiveReceivableFC = netFobFC * (incentivePercentage / 100);
  // Section H — Payable Incentive Amount (BDT) = Incentive Receivable (FC) × the resolved TT
  // buying rate. This is the government form's own final figure — everything past this point (R20)
  // is Shah International's own internal layer, not part of the real Ka Form.
  const payableIncentiveBDT = incentiveReceivableFC * rate;

  // R20 calls this BDT figure "Incentive Receivable" when describing the costing deduction (its own
  // wording: "After calculating Incentive Receivable in bdt...") — same number as payableIncentiveBDT
  // above, just a different name at that point in the source spec. Tax is computed on it directly.
  const taxBDT = payableIncentiveBDT * (taxPercentage / 100);
  // R20: Application Cost + Others Cost count ONCE per application, never per shipment.
  const afterCostingBDT = payableIncentiveBDT - (taxBDT + incentiveApplicationCostBDT + othersCostBDT);
  const shipmentCount = list.length || 1;
  // Never a negative per-shipment credit even if costs exceed the receivable — afterCostingBDT
  // itself is still returned un-clamped below so the UI can show a true (possibly negative) total.
  const perShipmentShareBDT = Math.max(0, afterCostingBDT) / shipmentCount;

  return {
    perShipment, totalRepatriatedFC, totalFreightFC, commissionInsuranceFC, netFobFC,
    incentiveReceivableFC, payableIncentiveBDT,
    taxBDT, incentiveApplicationCostBDT, othersCostBDT, afterCostingBDT, perShipmentShareBDT,
  };
}

// Batch 9 (R20): once a shipment belongs to ANY Incentive Application, its TT Configuration
// "Incentive" field is taken over by the group's computed distribution (calculateIncentiveCosting's
// perShipmentShareBDT) — same read-only-while-grouped treatment isRateOverrideActive already gives
// the Rate in BDT field, just for the Incentive field instead.
export function isIncentiveOverrideActive(application) {
  return !!application;
}
