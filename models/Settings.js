import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  siteTitle: { type: String, default: 'Shah International' },
  siteTagline: { type: String, default: 'Farm Fresh. Global Reach.' },
  siteDescription: String,
  logo: String,
  logoWhite: String,
  favicon: String,
  activeTheme: { type: String, default: 'green' },
  activeLanguage: { type: String, default: 'en' },
  supportedLanguages: [String],
  defaultCurrency: { type: String, default: 'BDT' },
  supportedCurrencies: { type: [String], default: ['BDT', 'USD', 'EUR', 'INR', 'PKR', 'GBP'] },
  contact: {
    phone: String,
    whatsapp: String,
    email: String,
    address: String,
    exportEmail: String,
  },
  social: {
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String,
    youtube: String,
  },
  headerLinks: [{ title: String, url: String, isExternal: Boolean }],
  footerSections: [{
    title: String,
    links: [{ title: String, url: String }],
  }],
  // Delivery zones for local buyers
  deliveryZones: [{
    name: { type: String, required: true },       // e.g. "Dhaka City"
    charge: { type: Number, required: true },     // e.g. 60
    freeAbove: { type: Number, default: 0 },      // free if order above this
    estimatedDays: String,                         // e.g. "1-2 days"
    isActive: { type: Boolean, default: true },
  }],
  // Legacy single-zone fallback
  localDeliveryCharge: { type: Number, default: 60 },
  freeDeliveryAbove: { type: Number, default: 1000 },
  vatPercentage: { type: Number, default: 0 },

  // Payment settings
  payment: {
    // Merchant "Send Money" numbers customers pay to for bKash/Nagad — since
    // these are manual mobile-banking transfers (not a card-style API),
    // verification works by the customer submitting their Transaction ID
    // (TrxID) + the phone number they paid from, which an admin then
    // cross-checks against their bKash/Nagad merchant app before confirming
    // the order. This is the standard approach used across Bangladeshi
    // e-commerce sites that don't have a full bKash/Nagad Merchant API
    // integration (which requires a separate business agreement).
    bkashNumber: String,
    nagadNumber: String,
    // When true, Cash-on-Delivery orders must have their delivery charge
    // paid upfront (via Stripe) before the order can be placed — only the
    // product cost remains collected at the door. When false (default),
    // COD orders require no upfront payment at all.
    codDeliveryChargeRequired: { type: Boolean, default: false },
  },

  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: String,
  aboutUs: String,
  termsAndConditions: String,
  privacyPolicy: String,
  refundPolicy: String,
  shippingPolicy: String,
  heroTitle: String,
  heroSubtitle: String,
  seoKeywords: [String],
  // FAQ section
  faqs: [{
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  }],

  // Certifications & Compliance (admin manageable — shown on homepage)
  certifications: [{
    name: String,
    description: String,
    icon: String,        // uploaded image/icon URL
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  }],

  // Hero section stats — the "35+ Countries / 120+ Products" counters
  heroStats: [{
    label: String,        // e.g. "Countries"
    value: String,        // e.g. "35+"
    order: { type: Number, default: 0 },
  }],

  // Partners / Our Buyers — company logos in the auto-scrolling homepage section
  partners: [{
    name: String,
    logo: String,         // uploaded logo URL
    website: String,
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  }],

  // Company letterhead used on every printed/downloaded export document (packing list, invoices).
  // Uploaded once here and reused for ALL shipments until the admin replaces it — see issue 39.
  exportLetterheadUrl: String,
  exportLetterheadUpdatedAt: Date,

  // Batch 7 (R1) — the exporter's own name/address, shown on every Shipment Details tab and every
  // printed/downloaded document. Previously hardcoded as literal text in 4+ places across the print
  // page and lib/exportDocuments.js; now a single editable source of truth (same "one global value
  // used everywhere" pattern as the letterhead above). Defaults match that previous hardcoded text
  // exactly, so nothing changes for existing shipments/documents until an admin edits it.
  exporterName: { type: String, default: 'Shah International' },
  exporterAddress: { type: String, default: '111 South Bashabo, Opposite of Sabujbagh Thana, Dhaka 1214' },

  // Issue 46: the Export Analytics "Initial Balance" (principal) persists here and is used as the
  // default principal for every future calculation until the admin updates it again.
  exportAnalyticsInitialBalance: { type: Number, default: 0 },
  // Issue 47: admin-selectable base currency for the Export Analytics dashboard specifically — every
  // cost/profit/capital-gain figure there is shown in this currency, EXCEPT Order Value, which always
  // displays in each shipment's own configured currency.
  exportAnalyticsBaseCurrency: { type: String, default: 'BDT' },

  // Requirement 5 (Shipment Configuration) — pre-added option lists suggested when filling in a
  // shipment's own Mode of Carrying / Landing Port / Port of Discharge / Final Destination / Sales
  // Terms / Country of Origin fields. Each shipment's field stays a plain String (unchanged) — these
  // are purely suggestion sources, not references, so an admin can still type a one-off value a
  // shipment needs without first adding it here.
  exportShipmentOptions: {
    modeOfCarrying: { type: [String], default: ['By Air', 'By Sea', 'By Road'] },
    landingPort: { type: [String], default: [] },
    portOfDischarge: { type: [String], default: [] },
    finalDestination: { type: [String], default: [] },
    salesTerm: { type: [String], default: ['CFR', 'FOB', 'CIF', 'EXW'] },
    countryOfOrigin: { type: [String], default: ['Bangladesh'] },
  },

}, { timestamps: true });

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
