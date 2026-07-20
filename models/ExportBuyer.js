import mongoose from 'mongoose';

const ExportBuyerSchema = new mongoose.Schema({
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'ExportCountry', required: true },
  name: { type: String, required: true },
  contactPerson: String,
  email: String,
  phone: String,
  address: String,
  taxId: String,
  currency: { type: String, default: 'EUR' },
  notes: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.ExportBuyer || mongoose.model('ExportBuyer', ExportBuyerSchema);
