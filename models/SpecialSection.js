import mongoose from 'mongoose';

const SpecialSectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  badge: String,
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isActive: { type: Boolean, default: true },
  position: { type: String, enum: ['home', 'productDetail', 'both'], default: 'home' },
  displayOrder: { type: Number, default: 0 },
  backgroundColor: String,
  textColor: String,
  targetAudience: { type: String, enum: ['all', 'local', 'international'], default: 'all' },
}, { timestamps: true });

export default mongoose.models.SpecialSection || mongoose.model('SpecialSection', SpecialSectionSchema);
