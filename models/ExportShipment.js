import mongoose from 'mongoose';

// Line-item row (separate sets for packing list, buyer invoice, BD invoice)
const ShipmentItemSchema = new mongoose.Schema({
  slNo: Number,
  productName: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  botanicalName: String,
  packSizeKg: Number,
  totalCTN: Number,
  quantityKg: Number,
  unitPrice: Number,
  totalValue: Number,
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

  // Bank
  beneficiaryBank: String,
  accountNo: String,
  branchName: String,
  routingNo: String,
  swiftCode: String,

  // Base currency — set once by admin before documentation begins
  // All financial values in this shipment are in this currency (converted from USD live rate)
  baseCurrency: { type: String, default: 'EUR' },

  // Line items — THREE independent sets:
  // 1. packingItems  → Packing List (no price, just weights/quantities)
  // 2. buyerItems    → Buyer's Commercial Invoice (price in baseCurrency)
  // 3. bdItems       → Bangladeshi Invoice (price in BDT or baseCurrency)
  // Changes in one DO NOT affect the others.
  items: [ShipmentItemSchema],       // legacy / packing list
  buyerItems: [ShipmentItemSchema],  // Buyer's Invoice — independent
  bdItems: [ShipmentItemSchema],     // BD Invoice — independent

  // Totals
  totalCTN: Number,
  totalNetWeightKg: Number,
  totalGrossWeightKg: Number,
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

  // Currency of invoice (for Buyer's Invoice)
  invoiceCurrency: { type: String, default: 'EUR' },

  // Additional docs (uploaded PDFs/files by admin)
  additionalDocs: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Company letterhead (Cloudinary URL uploaded by admin for this buyer/shipment)
  letterheadUrl: String,

  // Admin-editable photos + captions shown alongside the packing list / invoice (issue 43)
  photos: [{
    url: String,
    caption: String,
  }],

  status: { type: String, enum: ['draft', 'active', 'completed', 'archived'], default: 'active' },
  notes: String,
}, { timestamps: true });

ExportShipmentSchema.index({ buyer: 1, date: -1 });
ExportShipmentSchema.index({ country: 1, date: -1 });
ExportShipmentSchema.index({ shipmentNo: 1 }, { unique: true });

export default mongoose.models.ExportShipment || mongoose.model('ExportShipment', ExportShipmentSchema);
