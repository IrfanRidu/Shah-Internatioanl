import mongoose from 'mongoose';

const ExportCountrySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, uppercase: true }, // ISO 3166-1 alpha-2
  flag: String,   // emoji flag or URL
  currency: { type: String, default: 'USD' },
  notes: String,
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.ExportCountry || mongoose.model('ExportCountry', ExportCountrySchema);
