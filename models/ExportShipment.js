import mongoose from 'mongoose';

// Line-item row. Batch 7: `items` is now the SINGLE MASTER product table, entered only in the
// Shipment Details tab — Packing List and Buyer's Invoice are read-only views computed FROM it
// (see the shipment editor page). `hsCode` added per-row (batch 7 requirement R1) — manually
// entered, optionally auto-filled from the chosen Product's own hsCode if it has one set.
// Average Price is NOT stored here — it's always derived (totalValue / quantityKg) so it can never
// drift out of sync with unitPrice/totalValue; see lib/exportColumns.js's `avgPrice` helper.
const ShipmentItemSchema = new mongoose.Schema({
  slNo: Number,
  productName: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  botanicalName: String,
  // batch 17 (R1/R2/R3) — snapshot of the selected catalog Product's own category NAME (Product.
  // category -> Category.name; a storefront catalog category like "Fresh Fruits", NOT the same
  // thing as the shipment-level ExportCategory used for incentives/document-format selection),
  // taken at selection time — same auto-fill-then-independently-editable pattern as botanicalName
  // /hsCode above. Deliberately a snapshot, not a live join: it survives the source Product being
  // edited/deleted later, and lets the category-wise totals (shipment editor's "Category Wise
  // Product Details" section, and BD Invoice's per-category rows) be computed client-side with no
  // extra fetch as the admin adds/edits rows. Rows never matched to a catalog product (manually
  // typed product names) simply have no category and group under "Uncategorized".
  category: String,
  hsCode: String, // batch 7 (R1) — per-product HS code, shown as its own column (Shipment Details/
                   // Packing List when enabled) or as its own column on BD Invoice too (batch 17)
  ctnSizeKg: Number, // requirement 3: renamed from packSizeKg
  totalCTN: Number,
  // requirement 4: totalCTN × (matching CtnConfig's ctnWeightGm / 1000) — 0/unset when no saved
  // CTN Configuration entry matches this row's ctnSizeKg.
  totalCtnWeightKg: Number,
  quantityKg: Number,
  unitPrice: Number,
  totalValue: Number,
});

// Batch 8 (R7): one telegraphic-transfer receipt against this shipment. `ttValue` is always in the
// shipment's own baseCurrency (not BDT) — see R8 for how the sum of these overrides Order Value for
// the Receive Amount (BDT) calculation once at least one entry has a value.
const TTEntrySchema = new mongoose.Schema({
  ttNumber: String,
  ttDate: Date,
  ttValue: Number,
});

const ExportShipmentSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportBuyer', required: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCountry', required: true },

  // Identifiers
  shipmentNo: { type: String, required: true },
  contractNo: String,
  invoiceNo: String,
  date: { type: Date, required: true },

  // Logistics / shipping
  modeOfCarrying: { type: String, default: 'By Air' },
  landingPort: String,
  portOfDischarge: String,
  finalDestination: String,
  salesTerm: String,        // e.g. "CFR, France"
  countryOfOrigin: { type: String, default: 'Bangladesh' },

  // Exporter IDs
  tinNo: String,
  binNo: String,
  ercNo: String,
  expNo: String,
  expDate: Date,
  awbNo: String,
  awbDate: Date,
  pcNo: String,
  pcDate: Date,
  // Batch 7 (R1) — REX registration number, e.g. "04343". Interpolated into the Buyer's Invoice's
  // GSP/origin declaration as "BDREX{rexNo}". Auto-fills from the selected Export License (same
  // pattern as tinNo/binNo below), then stays independently editable per shipment.
  rexNo: String,

  // Bank — requirement 6: bankAccount records WHICH saved ExportBankAccount was picked; the 6
  // fields below are snapshotted from it at selection time (auto-fill), then stay independently
  // editable, same pattern as botanical name auto-filling from a selected catalog product.
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportBankAccount' },
  beneficiaryBank: String,
  accountNo: String,
  branchName: String,
  bankAddress: String,
  routingNo: String,
  swiftCode: String,

  // Requirement 7: WHICH saved ExportLicense was picked — its tinNo/binNo/letterheadUrl auto-fill
  // tinNo/binNo below and this shipment's effective document letterhead (see
  // lib/exportDocuments.js's resolveLetterheadUrl), falling back to the global company letterhead
  // when no license is selected.
  exportLicense: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportLicense' },

  // Base currency — set once by admin before documentation begins
  // All financial values in this shipment are in this currency (converted from USD live rate)
  baseCurrency: { type: String, default: 'EUR' },

  // Requirement 10: drives this shipment's incentive calculation (see ExportCategory's own 4
  // incentive-related fields) and its card image on the buyer's shipment list (requirement 11).
  exportCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCategory' },

  // Batch 9 (R18): every shipment now belongs to exactly one Export Contract (country → buyer →
  // Export Contract → shipments). Selecting one auto-fills contractNo/baseCurrency/exportCategory
  // below from the contract (same auto-fill-then-stays-editable pattern as bank account/license
  // selection) — this field is the actual reference; contractNo etc. are independent snapshot
  // fields kept for backward compatibility with the existing document generators, which already
  // just read shipment.contractNo directly. `null` only for pre-batch-9 shipments that predate this
  // entity — see the buyer/contracts pages' "shipments without a contract" fallback view.
  exportContract: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportContract', default: null },

  // Batch 8 (R9-R16): set once this shipment is selected into an Incentive Application (R11);
  // cleared again only if that application is deleted before being claimed (R12). Drives: (a)
  // exclusion from the "Available for Incentive Application" list (R10), (b) the effective-rate
  // resolver in lib/incentiveUtils.js (R15), (c) the full edit-lock once the application is
  // claimed (R13) — enforced server-side in the shipments PUT/DELETE routes, not just in the UI.
  incentiveApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'IncentiveApplication', default: null },

  // Batch 7 architecture (R1-R4): `items` is now the ONE master product table, entered only in
  // the Shipment Details tab. Packing List and Buyer's Invoice are READ-ONLY views computed from
  // `items` (filtered to each document's own column set — see lib/exportColumns.js) — they no
  // longer have their own editable data, so they can never disagree with Shipment Details.
  // `bdItems` is repurposed: a SMALL, admin-editable set of consolidated override rows for the BD
  // Invoice specifically (per R4, BD Invoice shows the shipment as one or a few HS-code lines, not
  // one row per product). It CONTINUOUSLY auto-syncs to the Export Category + shipment totals for as
  // long as `bdItemsLocked` is false — the moment the admin edits a row, or adds/removes one, the
  // editor flips this to true and BD Invoice becomes the admin's own independently-owned data from
  // then on (a "Re-fill from Shipment Details" button flips it back to false on request). Batch 7
  // round 2: this replaced an earlier "seed once, then freeze forever" design, which left BD Invoice
  // showing stale numbers whenever the admin kept adding products to Shipment Details after BD
  // Invoice had already auto-seeded once — exactly the mismatch a real test run surfaced.
  // `buyerItems` is kept in the schema for backward compatibility with shipments saved before this
  // batch (so no old data is lost) but is no longer read or written by the UI going forward.
  items: [ShipmentItemSchema],       // MASTER — Shipment Details, mirrored (read-only) into Packing List & Buyer's Invoice
  buyerItems: [ShipmentItemSchema],  // legacy/unused — kept only so pre-batch-7 shipments don't lose data
  bdItems: [ShipmentItemSchema],     // BD Invoice — small admin-editable override rows, auto-synced from category + totals until locked
  bdItemsLocked: { type: Boolean, default: false },

  // Totals
  totalCTN: Number,
  totalNetWeightKg: Number,
  totalGrossWeightKg: Number,
  // Requirement 4: auto-calculated from items (Σ totalCtnWeightKg + totalNetWeightKg), persisted so
  // it's visible in Shipment Details even after totalGrossWeightKg has been manually overridden.
  // totalGrossWeightKg itself starts out equal to this and keeps auto-following it as items change
  // UNTIL grossWeightOverridden flips true (the admin directly edited Gross Weight themselves) — at
  // that point it detaches and stays admin-controlled, per "won't change the estimated gross weight"
  // (a one-way relationship: the estimate can drive the shared field, a manual edit never drives the
  // estimate back).
  estimatedGrossWeightKg: Number,
  grossWeightOverridden: { type: Boolean, default: false },
  freightCost: Number,          // BDT
  freightCostCurrency: { type: String, default: 'BDT' },
  goodsCost: Number,            // BDT
  exportProcessingCost: Number, // BDT
  othersCost: Number,           // BDT
  totalCost: Number,            // BDT
  receiveAmountBDT: Number,     // BDT actually received
  orderValueForeign: Number,    // e.g. EUR
  orderCurrency: { type: String, default: 'EUR' },
  exchangeRateBDT: Number,      // rate used
  availableBalance: Number,     // BDT
  shipmentMargin: Number,       // BDT — Available Balance − Initial Balance (issue 46)
  incentive: Number,            // BDT
  damage: Number,               // BDT
  netProfit: Number,            // BDT

  // Batch 8 (R6/R7): TT Configuration section — admin logs each telegraphic transfer received
  // against this shipment. See R8: once any entry here has a value, the SUM (converted at
  // exchangeRateBDT) overrides orderValueForeign for Receive Amount (BDT) purposes, permanently
  // (i.e. from then on, for as long as any entry remains) — see calculateShipmentFinancials in
  // lib/utils.js for the exact formula.
  ttEntries: [TTEntrySchema],

  // Currency of invoice (for Buyer's Invoice)
  invoiceCurrency: { type: String, default: 'EUR' },

  // Additional docs (uploaded PDFs/files by admin)
  additionalDocs: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Orphaned field from an early design iteration, predating even the old global-Settings
  // letterhead approach — nothing in the app reads or writes this directly (letterhead now comes
  // from the shipment's selected exportLicense.letterheadUrl, falling back to the global
  // Settings.exportLetterheadUrl; see requirement 7 / batch 17). Left in place harmlessly for the
  // same reason as ExportCategory.bdInvoiceShowHsCode above: no live code path touches it.
  letterheadUrl: String,

  // Batch 8 (R5): lets the admin edit the hardcoded declaration paragraph / signatory title on a
  // per-shipment, per-document basis before downloading or printing. Empty/undefined = use the
  // built-in default text (see DEFAULT_DOCUMENT_TEXT in lib/exportDocuments.js) — this object only
  // ever holds an admin's deliberate override, so a shipment nobody has touched costs nothing extra.
  documentTextOverrides: {
    packingList: { declaration: String, signatoryTitle: String },
    buyerInvoice: { declaration: String, signatoryTitle: String },
    bdInvoice: { declaration: String, signatoryTitle: String },
  },

  // Admin-editable photos + captions shown alongside the packing list / invoice (issue 43)
  photos: [{
    url: String,
    caption: String,
  }],

  // Batch 8 (R2/R3): a shipment now starts life as 'draft' — it can be saved repeatedly while draft
  // with no audit logging at all (see the shipments API routes), and only becomes 'active'
  // (permanently — a PUT can never move it back to draft, see the route) the moment the admin uses
  // the real Save action, which is also the moment audit logging starts for it. Shipments saved
  // before this batch already have an explicit 'active'/'completed'/'archived' status stored, so
  // this default only affects genuinely new documents from here on.
  status: { type: String, enum: ['draft', 'active', 'completed', 'archived'], default: 'draft' },
  notes: String,
}, { timestamps: true });

ExportShipmentSchema.index({ buyer: 1, date: -1 });
ExportShipmentSchema.index({ country: 1, date: -1 });
ExportShipmentSchema.index({ shipmentNo: 1 }, { unique: true });

export default mongoose.models.ExportShipment || mongoose.model('ExportShipment', ExportShipmentSchema);
