import mongoose from 'mongoose';

// Batch 8 (R9-R16) — a bulk incentive claim: 1-10 shipments that share the same Export Category
// and Export License (see the shipments API's own POST-time re-validation of that constraint),
// grouped together for a single government incentive application.
// Batch 9 (R18): the grouping rule changes to same Export Contract + same Export License (a
// contract already implies one category, so this is a strictly narrower, more correct grouping —
// see lib/incentiveUtils.js's canGroupForIncentive). `exportContract` added below as the new
// primary grouping identity; `exportCategory` is kept (denormalized from the contract at creation
// time) since it's still genuinely useful for display and for the category's own incentive-rate
// fields used in R20's costing math.
//
// Lifecycle: 'documentation' (just created, admin still assembling Ka Form / Others, can still be
// deleted — see R12) → 'claimed' (R13: member shipments become status:'completed' + fully locked,
// automatically surface in Export Archive; can only be viewed or unclaimed from here, not deleted).
//
// Rate override (R15): `manualRateBDT` is the admin's own entered number — once set, it is THE
// effective BDT rate for every member shipment everywhere a rate is shown or used (TT
// Configuration's Rate in BDT, Export Analytics), replacing that shipment's own live rate. If the
// application is claimed WITHOUT a manual rate ever having been set, `lockedRateBDT` captures
// whatever the live rate was at that exact moment, freezing it the same way. Neither field ever
// destructively overwrites a member shipment's own stored exchangeRateBDT — see
// lib/incentiveUtils.js's resolveEffectiveRateBDT, which is the single place that decides which
// number wins. This keeps the override 100% reversible: unclaiming (R13's "can be unclaimed") or
// deleting a still-pending application simply stops the resolver from firing, with nothing to
// restore.
const FileRefSchema = new mongoose.Schema({
  name: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const IncentiveApplicationSchema = new mongoose.Schema({
  // Stable serial used for the default "Incentive Application – N" title — assigned once at
  // creation from Settings.exportIncentiveApplicationCounter (never reused, even if an application
  // is later deleted, so two cards never end up sharing a number).
  applicationNumber: { type: Number, required: true },
  title: { type: String, required: true },

  exportCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCategory', required: true },
  exportLicense: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportLicense', required: true },
  // Batch 9 (R18) — the new grouping identity (replaces exportCategory as the thing member
  // shipments must share; see canGroupForIncentive). Also Section (B)'s data source on the Ka Form
  // (contract No/date/value).
  exportContract: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportContract', required: true },
  shipments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ExportShipment' }],

  // The base currency shared by the member shipments at the moment this application was created —
  // see R15's "the shipments base currency" (singular). Used to fetch/display the live BDT rate on
  // the Incentive Details tab.
  referenceCurrency: { type: String, default: 'EUR' },

  status: { type: String, enum: ['documentation', 'claimed'], default: 'documentation' },

  manualRateBDT: { type: Number, default: null },
  lockedRateBDT: { type: Number, default: null },

  // Batch 9 (R19/R20/R21) — the full Ka Form field set. Most of Sections A/B/C/E/F is fully
  // DERIVED (computed fresh from the Export License/Contract/member-shipments every time it's
  // needed — see lib/incentiveUtils.js's calculateIncentiveCosting) and deliberately NOT persisted
  // here, so it can never go stale relative to the underlying data. Only the pieces the real Ka
  // Form (Section D) and R20 actually call out as admin-editable/overridable live here:
  kaForm: {
    // Section D — "Name & Address of Supplier": the real reference form shows this as ONE combined
    // field ("Self-collected / own arrangement"), not separate name/address inputs — matching that.
    supplierNameAddress: { type: String, default: 'Self-collected / own arrangement' },
    // Section D — "Name & Quantity of Goods": name defaults to the Export Category name, quantity
    // to Σ gross weight of member shipments — both explicitly editable per R19. null/'' quantity
    // override means "use the computed total".
    goodsNameOverride: { type: String, default: '' },
    goodsQuantityOverrideKg: { type: Number, default: null },
    // Section F — "Commission, Insurance, etc., if any (FC)": one value for the whole application
    // (not per-shipment — the real form's per-row values are always identical/N/A anyway), default
    // "N/A" (0 for calculation purposes). R20's Net FOB math subtracts this.
    commissionInsuranceValue: { type: Number, default: 0 },
    commissionInsuranceLabel: { type: String, default: 'N/A' },
    // Boilerplate/label text an admin can override per-language — title, the 4 italic submission-
    // requirement notes, Section G's declaration paragraph, Section H's static labels. Keys match
    // DEFAULT_KA_FORM_TEXT in lib/kaFormDocuments.js; absent key = use that default. Plain objects
    // (not a Map) so they round-trip through JSON/the API exactly as typed.
    textOverrides: {
      en: { type: mongoose.Schema.Types.Mixed, default: {} },
      bn: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    notes: String,
    files: [FileRefSchema],
  },
  others: {
    notes: String,
    files: [FileRefSchema],
    // Batch 9 (R22) — Stamp Application. Unlike Ka Form's many small fields, this is flowing
    // paragraph text — one overridable string per language. Absent/empty = auto-assembled fresh
    // from current data every time (lib/kaFormDocuments.js's assembleStampApplicationText); once an
    // admin edits and saves, that exact text is frozen verbatim (same contract as R5's existing
    // per-shipment document-text-override feature) until cleared back to ''.
    stampApplication: {
      textOverride: {
        en: { type: String, default: '' },
        bn: { type: String, default: '' },
      },
    },
  },

  claimedAt: Date,
  unclaimedAt: Date,
}, { timestamps: true });

IncentiveApplicationSchema.index({ status: 1, createdAt: 1 });

export default mongoose.models.IncentiveApplication || mongoose.model('IncentiveApplication', IncentiveApplicationSchema);
