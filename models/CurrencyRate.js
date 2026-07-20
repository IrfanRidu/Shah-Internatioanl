import mongoose from 'mongoose';

const CurrencyRateSchema = new mongoose.Schema({
  base: { type: String, default: 'USD' },
  rates: {
    BDT: Number,
    EUR: Number,
    INR: Number,
    PKR: Number,
    GBP: Number,
    USD: { type: Number, default: 1 },
    AED: Number,
    SAR: Number,
    JPY: Number,
    CAD: Number,
    AUD: Number,
  },
  lastUpdated: { type: Date, default: Date.now },
  // Which live provider last supplied this rate (e.g. 'openexchangerates.org', 'open.er-api.com').
  // Purely informational — lets admins/devs confirm rates are coming from a real, live source.
  source: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.CurrencyRate || mongoose.model('CurrencyRate', CurrencyRateSchema);
